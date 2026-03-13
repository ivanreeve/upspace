import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import * as prismaModule from '@/lib/prisma';
import * as walletServer from '@/lib/wallet-server';
import { GET as walletStatsHandler } from '@/app/api/v1/wallet/stats/route';

describe('wallet stats api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns aggregated wallet stats for a partner', async () => {
    vi.spyOn(walletServer, 'resolveAuthenticatedUserForWallet').mockResolvedValue({
      response: null,
      dbUser: {
        user_id: 77n,
        auth_user_id: 'partner-auth-id',
        role: 'partner',
      },
    });

    vi.spyOn(walletServer, 'ensureWalletRow').mockResolvedValue({
      id: 'wallet-77',
      user_id: 77n,
      balance_minor: 31_000n,
      currency: 'PHP',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-03-01T00:00:00.000Z'),
    } as Awaited<ReturnType<typeof walletServer.ensureWalletRow>>);

    const aggregate = vi.fn()
      .mockResolvedValueOnce({ _sum: { amount_minor: 40_000n, }, _count: 4, })
      .mockResolvedValueOnce({ _sum: { amount_minor: 4_000n, }, _count: 1, })
      .mockResolvedValueOnce({ _sum: { amount_minor: 5_000n, }, _count: 2, });
    const count = vi.fn()
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(6);
    const queryRaw = vi.fn().mockResolvedValue([
      { month: '2026-02', earned: 20_000n, refunded: 2_000n, },
      { month: '2026-03', earned: 20_000n, refunded: 2_000n, },
    ]);

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      wallet_transaction: {
        aggregate,
        count,
      },
      $queryRaw: queryRaw,
    } as unknown as typeof prismaModule.prisma);

    const response = await walletStatsHandler();

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.data).toEqual({
      balanceMinor: '31000',
      currency: 'PHP',
      totalEarnedMinor: '40000',
      totalRefundedMinor: '4000',
      totalPaidOutMinor: '5000',
      transactionCount: 8,
      succeededCount: 6,
      successRate: 75,
      chargeCount: 4,
      refundCount: 1,
      payoutCount: 2,
      avgBookingChargeMinor: '10000',
      monthly: [
        { month: '2026-02', earnedMinor: '20000', refundedMinor: '2000', },
        { month: '2026-03', earnedMinor: '20000', refundedMinor: '2000', },
      ],
    });
  });
});
