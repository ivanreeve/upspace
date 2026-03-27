import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { AdminSessionError, requireAdminSession } from '@/lib/auth/require-admin-session';
import { decryptPayoutDestination } from '@/lib/financial/payout-destination';
import { getPartnerProviderAccountRecord } from '@/lib/financial/provider-accounts';
import { prisma } from '@/lib/prisma';
import { FinancialProviderError, ProviderConflictError, ProviderValidationError } from '@/lib/providers/errors';
import { getFinancialProvider } from '@/lib/providers/provider-registry';
import { adminPayoutRequestActionSchema } from '@/lib/validations/admin';
import { formatCurrencyMinor } from '@/lib/wallet';

type PayoutWorkflowStage =
  | 'awaiting_review'
  | 'submitting_to_provider'
  | 'submitted_to_provider'
  | 'succeeded'
  | 'failed';

function isJsonObject(value: Prisma.JsonValue | null): value is Prisma.JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readWorkflowStage(metadata: Prisma.JsonValue | null): PayoutWorkflowStage {
  if (!isJsonObject(metadata)) {
    return 'awaiting_review';
  }

  const candidate = metadata.workflow_stage;
  if (
    candidate === 'awaiting_review' ||
    candidate === 'submitting_to_provider' ||
    candidate === 'submitted_to_provider' ||
    candidate === 'succeeded' ||
    candidate === 'failed'
  ) {
    return candidate;
  }

  return 'awaiting_review';
}

function readProviderSnapshotAccountId(metadata: Prisma.JsonValue | null) {
  if (!isJsonObject(metadata)) {
    return null;
  }

  const snapshot = metadata.provider_account_snapshot;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return null;
  }

  return typeof snapshot.provider_account_id === 'string'
    ? snapshot.provider_account_id
    : null;
}

function readEncryptedDestination(metadata: Prisma.JsonValue | null) {
  if (!isJsonObject(metadata)) {
    return null;
  }

  return typeof metadata.payout_destination_encrypted === 'string'
    ? metadata.payout_destination_encrypted
    : null;
}

function buildMetadata(
  metadata: Prisma.JsonValue | null,
  patch: Prisma.InputJsonObject
): Prisma.InputJsonValue {
  const base = isJsonObject(metadata) ? metadata : {};

  return {
    ...base,
    ...patch,
  };
}

function buildSubmissionLockMetadata(
  metadata: Prisma.JsonValue | null,
  details: {
    processedAt: string;
    processedByAuthUserId: string;
    processedByUserId: string;
    resolutionNote: string | null;
  }
): Prisma.InputJsonValue {
  return buildMetadata(metadata, {
    workflow_stage: 'submitting_to_provider',
    payout_review: {
      action: 'submitting',
      processed_at: details.processedAt,
      processed_by_auth_user_id: details.processedByAuthUserId,
      processed_by_user_id: details.processedByUserId,
      resolution_note: details.resolutionNote,
    },
    payout_submission_error: null,
  });
}

function buildSubmittedMetadata(
  metadata: Prisma.JsonValue | null,
  details: {
    processedAt: string;
    processedByAuthUserId: string;
    processedByUserId: string;
    resolutionNote: string | null;
    payoutId: string;
    referenceId: string;
    providerStatus: string;
    channelCode: string;
    estimatedArrivalTime: string | null;
    failureCode: string | null;
  }
): Prisma.InputJsonValue {
  return buildMetadata(metadata, {
    workflow_stage: 'submitted_to_provider',
    payout_review: {
      action: 'submitted',
      processed_at: details.processedAt,
      processed_by_auth_user_id: details.processedByAuthUserId,
      processed_by_user_id: details.processedByUserId,
      resolution_note: details.resolutionNote,
    },
    payout_provider: {
      payout_id: details.payoutId,
      reference_id: details.referenceId,
      status: details.providerStatus,
      channel_code: details.channelCode,
      estimated_arrival_time: details.estimatedArrivalTime,
      failure_code: details.failureCode,
      submitted_at: details.processedAt,
      updated_at: details.processedAt,
    },
    payout_submission_error: null,
  });
}

function buildRejectedMetadata(
  metadata: Prisma.JsonValue | null,
  details: {
    processedAt: string;
    processedByAuthUserId: string;
    processedByUserId: string;
    resolutionNote: string | null;
  }
): Prisma.InputJsonValue {
  return buildMetadata(metadata, {
    workflow_stage: 'failed',
    payout_review: {
      action: 'failed',
      processed_at: details.processedAt,
      processed_by_auth_user_id: details.processedByAuthUserId,
      processed_by_user_id: details.processedByUserId,
      resolution_note: details.resolutionNote,
    },
  });
}

function buildSubmissionFailureMetadata(
  metadata: Prisma.JsonValue | null,
  errorMessage: string
): Prisma.InputJsonValue {
  return buildMetadata(metadata, {
    workflow_stage: 'awaiting_review',
    payout_submission_error: {
      message: errorMessage,
      at: new Date().toISOString(),
    },
  });
}

async function revertSubmissionLock(requestId: string, metadata: Prisma.JsonValue | null, errorMessage: string) {
  try {
    await prisma.wallet_transaction.update({
      where: { id: requestId, },
      data: {
        processed_at: null,
        processed_by_user_id: null,
        resolution_note: null,
        metadata: buildSubmissionFailureMetadata(metadata, errorMessage),
        updated_at: new Date(),
      },
    });
  } catch (error) {
    console.error('Failed to revert payout submission lock', {
      requestId,
      error,
    });
  }
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

    const requestId = parsedId.data;
    const resolutionNote = parsedBody.data.resolution_note?.trim() ?? null;
    const now = new Date();

    if (parsedBody.data.action === 'reject') {
      const result = await prisma.$transaction(async (tx) => {
        const payoutRequest = await tx.wallet_transaction.findUnique({
          where: { id: requestId, },
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

        if (readWorkflowStage(payoutRequest.metadata) !== 'awaiting_review') {
          return { kind: 'already_submitted' as const, };
        }

        const updated = await tx.wallet_transaction.updateMany({
          where: {
            id: payoutRequest.id,
            type: 'payout',
            status: 'pending',
          },
          data: {
            status: 'failed',
            processed_at: now,
            processed_by_user_id: session.userId,
            resolution_note: resolutionNote,
            metadata: buildRejectedMetadata(payoutRequest.metadata, {
              processedAt: now.toISOString(),
              processedByAuthUserId: session.authUserId,
              processedByUserId: session.userId.toString(),
              resolutionNote,
            }),
            updated_at: now,
          },
        });

        if (updated.count === 0) {
          return { kind: 'already_processed' as const, };
        }

        await tx.wallet.update({
          where: { id: payoutRequest.wallet_id, },
          data: {
            balance_minor: { increment: payoutRequest.amount_minor, },
            updated_at: now,
          },
        });

        const amountLabel = formatCurrencyMinor(
          payoutRequest.amount_minor.toString(),
          payoutRequest.currency
        );
        const notificationBody = resolutionNote
          ? `Your payout request for ${amountLabel} was rejected. The funds are available in your wallet again. Reason: ${resolutionNote}`
          : `Your payout request for ${amountLabel} was rejected. The funds are available in your wallet again.`;

        await tx.app_notification.create({
          data: {
            user_auth_id: payoutRequest.wallet.user.auth_user_id,
            title: 'Payout request rejected',
            body: notificationBody,
            href: '/partner/wallet',
            type: 'system',
          },
        });

        return {
          kind: 'updated' as const,
          status: 'failed' as const,
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

      if (result.kind === 'already_submitted') {
        return NextResponse.json(
          { error: 'This payout request has already been submitted to Xendit and can no longer be rejected here.', },
          { status: 409, }
        );
      }

      return NextResponse.json({ status: result.status, });
    }

    const lockedResult = await prisma.$transaction(async (tx) => {
      const payoutRequest = await tx.wallet_transaction.findUnique({
        where: { id: requestId, },
        select: {
          id: true,
          wallet_id: true,
          type: true,
          status: true,
          amount_minor: true,
          currency: true,
          description: true,
          metadata: true,
          wallet: {
            select: {
              user: {
                select: {
                  user_id: true,
                  auth_user_id: true,
                },
              },
            },
          },
        },
      });

      if (!payoutRequest || payoutRequest.type !== 'payout') {
        return { kind: 'not_found' as const, };
      }

      if (payoutRequest.status !== 'pending') {
        return { kind: 'already_processed' as const, };
      }

      if (readWorkflowStage(payoutRequest.metadata) !== 'awaiting_review') {
        return { kind: 'already_submitted' as const, };
      }

      const updated = await tx.wallet_transaction.updateMany({
        where: {
          id: payoutRequest.id,
          type: 'payout',
          status: 'pending',
        },
        data: {
          processed_at: now,
          processed_by_user_id: session.userId,
          resolution_note: resolutionNote,
          metadata: buildSubmissionLockMetadata(payoutRequest.metadata, {
            processedAt: now.toISOString(),
            processedByAuthUserId: session.authUserId,
            processedByUserId: session.userId.toString(),
            resolutionNote,
          }),
          updated_at: now,
        },
      });

      if (updated.count === 0) {
        return { kind: 'already_processed' as const, };
      }

      return {
        kind: 'locked' as const,
        payoutRequest,
      };
    }, { isolationLevel: 'Serializable', });

    if (lockedResult.kind === 'not_found') {
      return NextResponse.json(
        { error: 'Payout request not found.', },
        { status: 404, }
      );
    }

    if (lockedResult.kind === 'already_processed') {
      return NextResponse.json(
        { error: 'This payout request has already been processed.', },
        { status: 400, }
      );
    }

    if (lockedResult.kind === 'already_submitted') {
      return NextResponse.json(
        { error: 'This payout request has already been submitted to Xendit.', },
        { status: 409, }
      );
    }

    const currentProviderAccount = await getPartnerProviderAccountRecord(
      lockedResult.payoutRequest.wallet.user.user_id
    );
    const partnerProviderAccountId =
      currentProviderAccount?.provider_account_id ??
      readProviderSnapshotAccountId(lockedResult.payoutRequest.metadata);

    if (!partnerProviderAccountId) {
      await revertSubmissionLock(
        requestId,
        lockedResult.payoutRequest.metadata,
        'Partner payout provider account could not be resolved.'
      );
      return NextResponse.json(
        { error: 'Partner payout provider account could not be resolved.', },
        { status: 409, }
      );
    }

    const encryptedDestination = readEncryptedDestination(lockedResult.payoutRequest.metadata);
    if (!encryptedDestination) {
      await revertSubmissionLock(
        requestId,
        lockedResult.payoutRequest.metadata,
        'Payout destination details are missing from the request.'
      );
      return NextResponse.json(
        { error: 'Payout destination details are missing from the request.', },
        { status: 400, }
      );
    }

    let payoutDestination;
    try {
      payoutDestination = decryptPayoutDestination(encryptedDestination);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Stored payout destination could not be decrypted.';
      await revertSubmissionLock(
        requestId,
        lockedResult.payoutRequest.metadata,
        message
      );
      throw error;
    }

    const provider = getFinancialProvider();
    let providerPayout;

    try {
      providerPayout = await provider.createPayout({
        partnerProviderAccountId,
        referenceId: lockedResult.payoutRequest.id,
        amountMinor: lockedResult.payoutRequest.amount_minor,
        currency: lockedResult.payoutRequest.currency,
        description: lockedResult.payoutRequest.description ?? 'Partner payout',
        destination: {
          channelCode: payoutDestination.channelCode,
          accountNumber: payoutDestination.accountNumber,
          accountHolderName: payoutDestination.accountHolderName,
        },
        metadata: {
          wallet_transaction_id: lockedResult.payoutRequest.id,
          partner_user_id: lockedResult.payoutRequest.wallet.user.user_id.toString(),
        },
      });
    } catch (error) {
      if (error instanceof ProviderConflictError) {
        try {
          const existingPayouts = await provider.getPayoutsByReferenceId(
            lockedResult.payoutRequest.id,
            partnerProviderAccountId
          );
          providerPayout = existingPayouts[0];
        } catch (lookupError) {
          const message =
            lookupError instanceof Error
              ? lookupError.message
              : 'Failed to resolve the duplicate Xendit payout.';
          await revertSubmissionLock(
            requestId,
            lockedResult.payoutRequest.metadata,
            message
          );
          throw lookupError;
        }
      } else {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to submit payout to Xendit.';
        await revertSubmissionLock(
          requestId,
          lockedResult.payoutRequest.metadata,
          message
        );
        throw error;
      }
    }

    if (!providerPayout) {
      await revertSubmissionLock(
        requestId,
        lockedResult.payoutRequest.metadata,
        'Xendit did not return a payout record for this request.'
      );
      throw new ProviderValidationError(
        'Xendit did not return a payout record for this request.',
        502
      );
    }

    const submittedResult = await prisma.$transaction(async (tx) => {
      const updated = await tx.wallet_transaction.updateMany({
        where: {
          id: requestId,
          type: 'payout',
          status: 'pending',
        },
        data: {
          processed_at: now,
          processed_by_user_id: session.userId,
          resolution_note: resolutionNote,
          external_reference: providerPayout.payoutId,
          metadata: buildSubmittedMetadata(lockedResult.payoutRequest.metadata, {
            processedAt: now.toISOString(),
            processedByAuthUserId: session.authUserId,
            processedByUserId: session.userId.toString(),
            resolutionNote,
            payoutId: providerPayout.payoutId,
            referenceId: providerPayout.referenceId,
            providerStatus: providerPayout.status,
            channelCode: providerPayout.channelCode,
            estimatedArrivalTime: providerPayout.estimatedArrivalTime,
            failureCode: providerPayout.failureCode,
          }),
          updated_at: new Date(),
        },
      });

      if (updated.count === 0) {
        return { kind: 'already_processed' as const, };
      }

      const amountLabel = formatCurrencyMinor(
        lockedResult.payoutRequest.amount_minor.toString(),
        lockedResult.payoutRequest.currency
      );
      const notificationBody = resolutionNote
        ? `Your payout request for ${amountLabel} has been submitted to Xendit. Note: ${resolutionNote}`
        : `Your payout request for ${amountLabel} has been submitted to Xendit and is now processing.`;

      await tx.app_notification.create({
        data: {
          user_auth_id: lockedResult.payoutRequest.wallet.user.auth_user_id,
          title: 'Payout submitted',
          body: notificationBody,
          href: '/partner/wallet',
          type: 'system',
        },
      });

      return { kind: 'submitted' as const, };
    }, { isolationLevel: 'Serializable', });

    if (submittedResult.kind === 'already_processed') {
      return NextResponse.json(
        { error: 'This payout request has already been processed.', },
        { status: 400, }
      );
    }

    return NextResponse.json({
      status: 'pending',
      workflowStage: 'submitted_to_provider',
      providerStatus: providerPayout.status,
    });
  } catch (error) {
    if (error instanceof AdminSessionError) {
      return NextResponse.json(
        { error: error.message, },
        { status: error.status, }
      );
    }

    if (error instanceof FinancialProviderError) {
      return NextResponse.json(
        { error: error.message, },
        { status: error.status, }
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

    console.error('Failed to process payout request', error);
    return NextResponse.json(
      { error: 'Unable to process the payout request.', },
      { status: 500, }
    );
  }
}
