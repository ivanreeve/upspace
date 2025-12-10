'use server';

import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const unauthorizedResponse = NextResponse.json(
  { message: 'Authentication required.', },
  { status: 401, }
);

const missingProfileResponse = NextResponse.json(
  { message: 'Unable to resolve your profile.', },
  { status: 404, }
);

const partnerOnlyResponse = NextResponse.json(
  { message: 'Wallet access is limited to partners.', },
  { status: 403, }
);

type ResolveAuthenticatedUserForWalletOptions = {
  requirePartner?: boolean;
};

type AuthenticatedUserForWallet =
  | {
      response: null;
      dbUser: {
        user_id: bigint;
        auth_user_id: string;
        role: 'customer' | 'partner' | 'admin' | string;
      };
    }
  | {
      response: NextResponse;
      dbUser: null;
    };

export async function resolveAuthenticatedUserForWallet(
  options: ResolveAuthenticatedUserForWalletOptions = {}
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return {
      response: unauthorizedResponse,
      dbUser: null,
    };
  }

  const dbUser = await prisma.user.findFirst({
    where: { auth_user_id: authData.user.id, },
    select: {
      user_id: true,
      auth_user_id: true,
      role: true,
    },
  });

  if (!dbUser) {
    return {
      response: missingProfileResponse,
      dbUser: null,
    };
  }

  if (options.requirePartner && dbUser.role !== 'partner') {
    return {
      response: partnerOnlyResponse,
      dbUser: null,
    };
  }

  return {
    response: null,
    dbUser,
  } satisfies AuthenticatedUserForWallet;
}

export async function ensureWalletRow(dbUserId: bigint) {
  return prisma.wallet.upsert({
    where: { user_id: dbUserId, },
    create: {
      user_id: dbUserId,
      balance_minor: BigInt(0),
      currency: 'PHP',
    },
    update: {},
  });
}

export type RecordTestModeBookingWalletChargeOptions = {
  walletOwnerUserId: bigint;
  bookingId: string;
  amountMinor: number;
  currency: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function recordTestModeBookingWalletCharge(
  options: RecordTestModeBookingWalletChargeOptions
) {
  const amountMinor = Math.trunc(options.amountMinor);
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
    return null;
  }

  const walletRow = await ensureWalletRow(options.walletOwnerUserId);
  const metadata = {
    ...(options.metadata ?? {}),
    booking_id: options.bookingId,
    testing_mode: true,
  };
  const amount = BigInt(amountMinor);

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.wallet_transaction.create({
      data: {
        wallet_id: walletRow.id,
        type: 'charge',
        status: 'succeeded',
        amount_minor: amount,
        net_amount_minor: amount,
        currency: options.currency ?? walletRow.currency,
        description: options.description ?? null,
        booking_id: options.bookingId,
        metadata,
      },
    });

    await tx.wallet.update({
      where: { id: walletRow.id, },
      data: {
        balance_minor: { increment: amount, },
        updated_at: new Date(),
      },
    });

    return transaction;
  });
}
