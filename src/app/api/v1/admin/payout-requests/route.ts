import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { AdminSessionError, requireAdminSession } from '@/lib/auth/require-admin-session';
import { formatUserDisplayName } from '@/lib/user/display-name';
import { adminPayoutRequestsQuerySchema } from '@/lib/validations/admin';

export async function GET(req: NextRequest) {
  try {
    await requireAdminSession(req);

    const { searchParams, } = new URL(req.url);
    const parsed = adminPayoutRequestsQuerySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      cursor: searchParams.get('cursor') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid payout request query.', },
        { status: 400, }
      );
    }

    const {
      status,
      limit,
      cursor,
    } = parsed.data;
    const orderBy =
      status === 'pending'
        ? [
            { created_at: 'asc' as const, },
            { id: 'asc' as const, }
          ]
        : [
            { created_at: 'desc' as const, },
            { id: 'desc' as const, }
          ];

    const [payoutRequests, totalCount, pendingCount] = await Promise.all([
      prisma.wallet_transaction.findMany({
        where: {
          type: 'payout',
          status,
        },
        take: limit + 1,
        skip: cursor ? 1 : 0,
        ...(cursor ? { cursor: { id: cursor, }, } : {}),
        orderBy,
        include: {
          wallet: {
            select: {
              id: true,
              balance_minor: true,
              user: {
                select: {
                  user_id: true,
                  first_name: true,
                  last_name: true,
                  handle: true,
                  role: true,
                },
              },
            },
          },
          processed_by: {
            select: {
              first_name: true,
              last_name: true,
              handle: true,
            },
          },
        },
      }),
      prisma.wallet_transaction.count({
        where: {
          type: 'payout',
          status,
        },
      }),
      prisma.wallet_transaction.count({
        where: {
          type: 'payout',
          status: 'pending',
        },
      })
    ]);

    const hasNext = payoutRequests.length > limit;
    const items = hasNext ? payoutRequests.slice(0, limit) : payoutRequests;
    const nextCursor = hasNext ? items[items.length - 1]?.id ?? null : null;

    const payload = items.map((request) => ({
      id: request.id,
      status: request.status,
      amountMinor: request.amount_minor.toString(),
      netAmountMinor: request.net_amount_minor?.toString() ?? null,
      currency: request.currency,
      description: request.description,
      createdAt: request.created_at.toISOString(),
      processedAt: request.processed_at?.toISOString() ?? null,
      resolutionNote: request.resolution_note,
      partner: {
        userId: request.wallet.user.user_id.toString(),
        handle: request.wallet.user.handle,
        role: request.wallet.user.role,
        name: formatUserDisplayName(
          request.wallet.user.first_name,
          request.wallet.user.last_name,
          request.wallet.user.handle
        ),
        currentBalanceMinor: request.wallet.balance_minor.toString(),
      },
      processedBy: request.processed_by
        ? {
            name: formatUserDisplayName(
              request.processed_by.first_name,
              request.processed_by.last_name,
              request.processed_by.handle
            ),
          }
        : null,
    }));

    return NextResponse.json({
      data: payload,
      nextCursor,
      totalCount,
      pendingCount,
    });
  } catch (error) {
    if (error instanceof AdminSessionError) {
      return NextResponse.json(
        { error: error.message, },
        { status: error.status, }
      );
    }

    console.error('Failed to load payout requests', error);
    return NextResponse.json(
      { error: 'Unable to load payout requests.', },
      { status: 500, }
    );
  }
}
