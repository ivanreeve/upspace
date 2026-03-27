import { randomUUID } from 'crypto';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { buildPayoutDestinationSummary, encryptPayoutDestination, payoutDestinationInputSchema } from '@/lib/financial/payout-destination';
import { getPartnerProviderAccountRecord, getPartnerProviderAccountView } from '@/lib/financial/provider-accounts';
import { prisma } from '@/lib/prisma';
import { FinancialProviderError } from '@/lib/providers/errors';
import { getFinancialProvider } from '@/lib/providers/provider-registry';
import { enforceRateLimit, RateLimitExceededError } from '@/lib/rate-limit';
import { ensureWalletRow, resolveAuthenticatedUserForWallet } from '@/lib/wallet-server';
import { formatCurrencyMinor } from '@/lib/wallet';

const payoutSchema = z.object({
  amountMinor: z.number().int().min(10000, 'Minimum payout is ₱100.'),
  destination: payoutDestinationInputSchema,
});

const MIN_BALANCE_FOR_PAYOUT = 10000; // 100 PHP in minor units

function parseMinorAmount(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

class PayoutValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await resolveAuthenticatedUserForWallet({ requirePartner: true, });
    if (auth.response) {
      return auth.response;
    }

    await enforceRateLimit({
      scope: 'payout-request',
      identity: auth.dbUser!.auth_user_id,
    });

    const body = await req.json().catch(() => null);
    const parsed = payoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid payout request.', },
        { status: 400, }
      );
    }

    const {
      amountMinor,
      destination,
    } = parsed.data;
    const walletRow = await ensureWalletRow(auth.dbUser!.user_id);
    const [providerAccountView, providerAccountRecord] = await Promise.all([
      getPartnerProviderAccountView({
        partnerUserId: auth.dbUser!.user_id,
        forceRefresh: true,
      }),
      getPartnerProviderAccountRecord(auth.dbUser!.user_id)
    ]);

    if (!providerAccountView.configured || providerAccountView.setupState !== 'ready') {
      throw new PayoutValidationError(
        'Enable payouts in Partner Settings and wait for the Xendit account to be ready before requesting a payout.',
        409
      );
    }

    if (
      providerAccountView.syncWarning ||
      !providerAccountView.availableBalanceMinor ||
      !providerAccountView.currency
    ) {
      throw new PayoutValidationError(
        'Your Xendit balance is temporarily unavailable. Refresh the wallet and try again.',
        503
      );
    }

    if (providerAccountView.currency !== walletRow.currency) {
      throw new PayoutValidationError(
        'Your payout currency is out of sync. Refresh the wallet and try again.',
        409
      );
    }

    const providerAvailableBalanceMinor = parseMinorAmount(providerAccountView.availableBalanceMinor);
    if (providerAvailableBalanceMinor === null) {
      throw new PayoutValidationError(
        'Your Xendit balance is temporarily unavailable. Refresh the wallet and try again.',
        503
      );
    }

    if (providerAvailableBalanceMinor < BigInt(amountMinor)) {
      throw new PayoutValidationError(
        'Requested payout exceeds your synced Xendit available balance.',
        409
      );
    }

    const provider = getFinancialProvider();
    const payoutChannel = (await provider.listPayoutChannels(walletRow.currency)).find(
      (channel) => channel.channelCode === destination.channelCode
    );

    if (!payoutChannel || (payoutChannel.category !== 'BANK' && payoutChannel.category !== 'EWALLET')) {
      throw new PayoutValidationError('Select a valid payout destination.');
    }

    const requestedAmountMinor = BigInt(amountMinor);
    if (
      payoutChannel.minimumAmountMinor !== null &&
      requestedAmountMinor < payoutChannel.minimumAmountMinor
    ) {
      throw new PayoutValidationError(
        `Minimum payout for ${payoutChannel.channelName} is ${formatCurrencyMinor(payoutChannel.minimumAmountMinor, walletRow.currency)}.`,
        409
      );
    }

    if (
      payoutChannel.maximumAmountMinor !== null &&
      requestedAmountMinor > payoutChannel.maximumAmountMinor
    ) {
      throw new PayoutValidationError(
        `Maximum payout for ${payoutChannel.channelName} is ${formatCurrencyMinor(payoutChannel.maximumAmountMinor, walletRow.currency)}.`,
        409
      );
    }

    const encryptedDestination = encryptPayoutDestination({
      channelCode: payoutChannel.channelCode,
      channelName: payoutChannel.channelName,
      channelCategory: payoutChannel.category,
      currency: payoutChannel.currency,
      accountNumber: destination.accountNumber,
      accountHolderName: destination.accountHolderName,
    });
    const payoutDestinationSummary = buildPayoutDestinationSummary({
      channelCode: payoutChannel.channelCode,
      channelName: payoutChannel.channelName,
      channelCategory: payoutChannel.category,
      currency: payoutChannel.currency,
      accountNumber: destination.accountNumber,
      accountHolderName: destination.accountHolderName,
    });

    const transaction = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { id: walletRow.id, },
        select: {
          id: true,
          balance_minor: true,
          currency: true,
        },
      });

      if (!wallet) {
        throw new PayoutValidationError('Wallet not found.', 404);
      }

      if (wallet.balance_minor < BigInt(MIN_BALANCE_FOR_PAYOUT)) {
        throw new PayoutValidationError('Insufficient wallet balance for a payout.');
      }

      const pendingPayout = await tx.wallet_transaction.findFirst({
        where: {
          wallet_id: wallet.id,
          type: 'payout',
          status: 'pending',
        },
        select: { id: true, },
      });

      if (pendingPayout) {
        throw new PayoutValidationError('A payout is already pending. Please wait for it to complete.', 409);
      }

      const decremented = await tx.wallet.updateMany({
        where: {
          id: wallet.id,
          balance_minor: { gte: BigInt(amountMinor), },
        },
        data: {
          balance_minor: { decrement: BigInt(amountMinor), },
          updated_at: new Date(),
        },
      });

      if (decremented.count === 0) {
        throw new PayoutValidationError('Payout amount exceeds available balance.');
      }

      return tx.wallet_transaction.create({
        data: {
          id: randomUUID(),
          wallet_id: wallet.id,
          type: 'payout',
          status: 'pending',
          amount_minor: BigInt(amountMinor),
          net_amount_minor: BigInt(amountMinor),
          currency: wallet.currency,
          description: 'Payout request',
          metadata: {
            workflow_stage: 'awaiting_review',
            requested_by: auth.dbUser!.auth_user_id,
            requested_by_user_id: auth.dbUser!.user_id.toString(),
            requested_at: new Date().toISOString(),
            balance_before_minor: wallet.balance_minor.toString(),
            balance_after_minor: (wallet.balance_minor - BigInt(amountMinor)).toString(),
            payout_destination: payoutDestinationSummary,
            payout_destination_encrypted: encryptedDestination,
            provider_account_snapshot: {
              provider: providerAccountView.provider,
              provider_account_id: providerAccountRecord?.provider_account_id ?? null,
              provider_account_reference: providerAccountView.providerAccountReference,
              account_type: providerAccountView.accountType,
              status: providerAccountView.status,
              setup_state: providerAccountView.setupState,
              available_balance_minor: providerAccountView.availableBalanceMinor,
              currency: providerAccountView.currency,
              last_synced_at: providerAccountView.lastSyncedAt,
              sync_warning: providerAccountView.syncWarning,
            },
          },
        },
      });
    }, { isolationLevel: 'Serializable', });

    return NextResponse.json({
      data: {
        transactionId: transaction.id,
        amountMinor: transaction.amount_minor.toString(),
        currency: transaction.currency,
        status: transaction.status,
      },
    }, { status: 201, });
  } catch (error) {
    if (error instanceof PayoutValidationError) {
      return NextResponse.json(
        { error: error.message, },
        { status: error.status, }
      );
    }

    if (error instanceof RateLimitExceededError) {
      return NextResponse.json(
        { error: error.message, },
        {
          status: 429,
          headers: { 'Retry-After': String(error.retryAfter), },
        }
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    ) {
      return NextResponse.json(
        { error: 'A conflict occurred. Please try again.', },
        { status: 409, }
      );
    }

    if (error instanceof FinancialProviderError) {
      return NextResponse.json(
        { error: error.message, },
        { status: error.status, }
      );
    }

    console.error('Failed to process payout request', error);
    return NextResponse.json(
      { error: 'Unable to process payout request.', },
      { status: 500, }
    );
  }
}
