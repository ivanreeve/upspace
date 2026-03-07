import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { formatCurrencyMinor } from '@/lib/wallet';
import { AdminSessionError, requireAdminSession } from '@/lib/auth/require-admin-session';
import { adminPayoutRequestActionSchema } from '@/lib/validations/admin';

function buildReviewedMetadata(
  metadata: Prisma.JsonValue | null,
  details: {
    action: 'succeeded' | 'failed';
    processedAt: string;
    processedByAuthUserId: string;
    processedByUserId: string;
    resolutionNote: string | null;
  }
): Prisma.InputJsonValue {
  const base =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Prisma.JsonObject)
      : {};

  return {
    ...base,
    payout_review: {
      action: details.action,
      processed_at: details.processedAt,
      processed_by_auth_user_id: details.processedByAuthUserId,
      processed_by_user_id: details.processedByUserId,
      resolution_note: details.resolutionNote,
    },
  };
}

export async function PATCH(
  req: NextRequest,
  { params, }: { params: Promise<{ request_id: string }> }
) {
  const resolvedParams = await params;

  try {
    const session = await requireAdminSession(req);

    const parsedId = z.string().uuid().safeParse(resolvedParams.request_id);
    if (!parsedId.success) {
      return NextResponse.json(
        { error: 'Invalid payout request identifier.', },
        { status: 400, }
      );
    }

    const parsedBody = adminPayoutRequestActionSchema.safeParse(
      await req.json().catch(() => ({}))
    );
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error:
            parsedBody.error.issues[0]?.message ??
            'Invalid payout request action payload.',
        },
        { status: 400, }
      );
    }

    const resolutionNote = parsedBody.data.resolution_note?.trim() ?? null;
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const payoutRequest = await tx.wallet_transaction.findUnique({
        where: { id: parsedId.data, },
        select: {
          id: true,
          wallet_id: true,
          type: true,
          status: true,
          amount_minor: true,
          currency: true,
          metadata: true,
          wallet: { select: { user: { select: { auth_user_id: true, }, }, }, },
        },
      });

      if (!payoutRequest || payoutRequest.type !== 'payout') {
        return { kind: 'not_found' as const, };
      }

      if (payoutRequest.status !== 'pending') {
        return { kind: 'already_processed' as const, };
      }

      const nextStatus =
        parsedBody.data.action === 'complete' ? 'succeeded' : 'failed';
      const metadata = buildReviewedMetadata(payoutRequest.metadata, {
        action: nextStatus,
        processedAt: now.toISOString(),
        processedByAuthUserId: session.authUserId,
        processedByUserId: session.userId.toString(),
        resolutionNote,
      });

      const updated = await tx.wallet_transaction.updateMany({
        where: {
          id: payoutRequest.id,
          type: 'payout',
          status: 'pending',
        },
        data: {
          status: nextStatus,
          processed_at: now,
          processed_by_user_id: session.userId,
          resolution_note: resolutionNote,
          metadata,
          updated_at: now,
        },
      });

      if (updated.count === 0) {
        return { kind: 'already_processed' as const, };
      }

      if (nextStatus === 'failed') {
        await tx.wallet.update({
          where: { id: payoutRequest.wallet_id, },
          data: {
            balance_minor: { increment: payoutRequest.amount_minor, },
            updated_at: now,
          },
        });
      }

      const amountLabel = formatCurrencyMinor(
        payoutRequest.amount_minor.toString(),
        payoutRequest.currency
      );

      const notificationBody = nextStatus === 'succeeded'
        ? resolutionNote
          ? `Your payout request for ${amountLabel} has been completed. Note: ${resolutionNote}`
          : `Your payout request for ${amountLabel} has been completed.`
        : resolutionNote
          ? `Your payout request for ${amountLabel} was rejected. The funds are available in your wallet again. Reason: ${resolutionNote}`
          : `Your payout request for ${amountLabel} was rejected. The funds are available in your wallet again.`;

      await tx.app_notification.create({
        data: {
          user_auth_id: payoutRequest.wallet.user.auth_user_id,
          title:
            nextStatus === 'succeeded'
              ? 'Payout completed'
              : 'Payout request rejected',
          body: notificationBody,
          href: '/partner/wallet',
          type: 'system',
        },
      });

      return {
        kind: 'updated' as const,
        status: nextStatus,
      };
    }, { isolationLevel: 'Serializable', });

    if (result.kind === 'not_found') {
      return NextResponse.json(
        { error: 'Payout request not found.', },
        { status: 404, }
      );
    }

    if (result.kind === 'already_processed') {
      return NextResponse.json(
        { error: 'This payout request has already been processed.', },
        { status: 400, }
      );
    }

    return NextResponse.json({ status: result.status, });
  } catch (error) {
    if (error instanceof AdminSessionError) {
      return NextResponse.json(
        { error: error.message, },
        { status: error.status, }
      );
    }

    console.error('Failed to process payout request', error);
    return NextResponse.json(
      { error: 'Unable to process the payout request.', },
      { status: 500, }
    );
  }
}
