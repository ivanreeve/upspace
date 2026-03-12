import type { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import * as adminSessionModule from '@/lib/auth/require-admin-session';
import * as prismaModule from '@/lib/prisma';
import { GET as listPayoutRequestsHandler } from '@/app/api/v1/admin/payout-requests/route';
import { PATCH as updatePayoutRequestHandler } from '@/app/api/v1/admin/payout-requests/[request_id]/route';

const requestId = '11111111-1111-4111-8111-111111111111';
const secondRequestId = '22222222-2222-4222-8222-222222222222';

const makeRequest = ({
  url,
  method = 'GET',
  body,
}: {
  url: string;
  method?: string;
  body?: unknown;
}) =>
  ({
    url,
    method,
    nextUrl: new URL(url),
    headers: new Headers(),
    json: async () => body,
  } as unknown as NextRequest);

describe('admin payout requests api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists payout requests for the requested admin queue status', async () => {
    vi.spyOn(adminSessionModule, 'requireAdminSession').mockResolvedValue({
      authUserId: 'admin-auth-id',
      userId: 99n,
    });

    const count = vi
      .fn()
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(2);

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      wallet_transaction: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: requestId,
            status: 'pending',
            amount_minor: 150000n,
            net_amount_minor: 150000n,
            currency: 'PHP',
            description: 'Payout request',
            created_at: new Date('2026-03-07T12:00:00.000Z'),
            processed_at: null,
            resolution_note: null,
            wallet: {
              balance_minor: 350000n,
              user: {
                user_id: 42n,
                first_name: 'Paula',
                last_name: 'Partner',
                handle: 'paulapartner',
                role: 'partner',
              },
            },
            processed_by: null,
          },
          {
            id: secondRequestId,
            status: 'pending',
            amount_minor: 175000n,
            net_amount_minor: 175000n,
            currency: 'PHP',
            description: 'Payout request',
            created_at: new Date('2026-03-07T12:30:00.000Z'),
            processed_at: null,
            resolution_note: null,
            wallet: {
              balance_minor: 280000n,
              user: {
                user_id: 43n,
                first_name: 'Peter',
                last_name: 'Partner',
                handle: 'peterpartner',
                role: 'partner',
              },
            },
            processed_by: null,
          }
        ]),
        count,
      },
    } as unknown as typeof prismaModule.prisma);

    const response = await listPayoutRequestsHandler(
      makeRequest({ url: 'http://localhost/api/v1/admin/payout-requests?status=pending&limit=1', })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.nextCursor).toBe(requestId);
    expect(body.totalCount).toBe(2);
    expect(body.pendingCount).toBe(2);
    expect(body.data).toEqual([
      {
        id: requestId,
        status: 'pending',
        amountMinor: '150000',
        netAmountMinor: '150000',
        currency: 'PHP',
        description: 'Payout request',
        createdAt: '2026-03-07T12:00:00.000Z',
        processedAt: null,
        resolutionNote: null,
        partner: {
          userId: '42',
          handle: 'paulapartner',
          role: 'partner',
          name: 'Paula Partner',
          currentBalanceMinor: '350000',
        },
        processedBy: null,
      }
    ]);
    expect(count).toHaveBeenNthCalledWith(1, {
      where: {
        type: 'payout',
        status: 'pending',
      },
    });
    expect(count).toHaveBeenNthCalledWith(2, {
      where: {
        type: 'payout',
        status: 'pending',
      },
    });
  });

  it('marks a payout request as completed without restoring wallet balance', async () => {
    vi.spyOn(adminSessionModule, 'requireAdminSession').mockResolvedValue({
      authUserId: 'admin-auth-id',
      userId: 99n,
    });

    const tx = {
      wallet_transaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: requestId,
          wallet_id: 'wallet-1',
          type: 'payout',
          status: 'pending',
          amount_minor: 200000n,
          currency: 'PHP',
          metadata: { requested_at: '2026-03-07T10:00:00.000Z', },
          wallet: { user: { auth_user_id: 'partner-auth-id', }, },
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1, }),
      },
      wallet: { update: vi.fn(), },
      app_notification: { create: vi.fn().mockResolvedValue({ id: 'notif-1', }), },
    };

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx)
      ),
    } as unknown as typeof prismaModule.prisma);

    const response = await updatePayoutRequestHandler(
      makeRequest({
        url: `http://localhost/api/v1/admin/payout-requests/${requestId}`,
        method: 'PATCH',
        body: {
          action: 'complete',
          resolution_note: 'Settled through our payout rail.',
        },
      }),
      { params: Promise.resolve({ request_id: requestId, }), }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'succeeded', });
    expect(tx.wallet.update).not.toHaveBeenCalled();
    expect(tx.wallet_transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: requestId,
          type: 'payout',
          status: 'pending',
        },
        data: expect.objectContaining({
          status: 'succeeded',
          resolution_note: 'Settled through our payout rail.',
          processed_by_user_id: 99n,
        }),
      })
    );
    expect(tx.app_notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_auth_id: 'partner-auth-id',
          title: 'Payout completed',
          href: '/partner/wallet',
          type: 'system',
        }),
      })
    );
  });

  it('rejects a payout request and restores the reserved wallet balance', async () => {
    vi.spyOn(adminSessionModule, 'requireAdminSession').mockResolvedValue({
      authUserId: 'admin-auth-id',
      userId: 99n,
    });

    const tx = {
      wallet_transaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: requestId,
          wallet_id: 'wallet-1',
          type: 'payout',
          status: 'pending',
          amount_minor: 125000n,
          currency: 'PHP',
          metadata: null,
          wallet: { user: { auth_user_id: 'partner-auth-id', }, },
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1, }),
      },
      wallet: { update: vi.fn().mockResolvedValue({ id: 'wallet-1', }), },
      app_notification: { create: vi.fn().mockResolvedValue({ id: 'notif-2', }), },
    };

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx)
      ),
    } as unknown as typeof prismaModule.prisma);

    const response = await updatePayoutRequestHandler(
      makeRequest({
        url: `http://localhost/api/v1/admin/payout-requests/${requestId}`,
        method: 'PATCH',
        body: {
          action: 'reject',
          resolution_note: 'Bank account verification is incomplete.',
        },
      }),
      { params: Promise.resolve({ request_id: requestId, }), }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'failed', });
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1', },
      data: expect.objectContaining({ balance_minor: { increment: 125000n, }, }),
    });
    expect(tx.app_notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_auth_id: 'partner-auth-id',
          title: 'Payout request rejected',
          href: '/partner/wallet',
          type: 'system',
        }),
      })
    );
  });

  it('returns 409 when processing hits a serialization conflict', async () => {
    vi.spyOn(adminSessionModule, 'requireAdminSession').mockResolvedValue({
      authUserId: 'admin-auth-id',
      userId: 99n,
    });

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      $transaction: vi.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('serialization conflict', {
          code: 'P2034',
          clientVersion: 'test',
        })
      ),
    } as unknown as typeof prismaModule.prisma);

    const response = await updatePayoutRequestHandler(
      makeRequest({
        url: `http://localhost/api/v1/admin/payout-requests/${requestId}`,
        method: 'PATCH',
        body: {
          action: 'complete',
          resolution_note: 'Settled through our payout rail.',
        },
      }),
      { params: Promise.resolve({ request_id: requestId, }), }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'A conflict occurred. Please try again.', });
  });
});
