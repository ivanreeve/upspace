import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import * as prismaModule from '@/lib/prisma';
import * as walletServer from '@/lib/wallet-server';
import { GET as walletHandler } from '@/app/api/v1/wallet/route';
import { MockNextRequest } from '../../utils/mock-next-server';

describe('wallet api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects non-partner access', async () => {
    vi.spyOn(walletServer, 'resolveAuthenticatedUserForWallet').mockResolvedValue({
      response: Response.json({ message: 'Wallet access is limited to partners.', }, { status: 403, }),
      dbUser: null,
    });

    const response = await walletHandler(
      new MockNextRequest('http://localhost/api/v1/wallet')
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      message: 'Wallet access is limited to partners.',
    });
  });

  it('returns wallet data with filters, pagination, and booking details', async () => {
    vi.spyOn(walletServer, 'resolveAuthenticatedUserForWallet').mockResolvedValue({
      response: null,
      dbUser: {
        user_id: 44n,
        auth_user_id: 'partner-auth-id',
        role: 'partner',
      },
    });

    vi.spyOn(walletServer, 'ensureWalletRow').mockResolvedValue({
      id: 'wallet-1',
      user_id: 44n,
      balance_minor: 25_000n,
      currency: 'PHP',
      created_at: new Date('2026-03-01T00:00:00.000Z'),
      updated_at: new Date('2026-03-02T00:00:00.000Z'),
    } as Awaited<ReturnType<typeof walletServer.ensureWalletRow>>);

    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'txn-3',
        wallet_id: 'wallet-1',
        type: 'charge',
        status: 'succeeded',
        amount_minor: 15_000n,
        net_amount_minor: 15_000n,
        currency: 'PHP',
        description: 'Area A · Space A',
        booking_id: '11111111-1111-4111-8111-111111111111',
        external_reference: 'ext-3',
        metadata: { booking_id: '11111111-1111-4111-8111-111111111111', },
        created_at: new Date('2026-03-05T00:00:00.000Z'),
      },
      {
        id: 'txn-2',
        wallet_id: 'wallet-1',
        type: 'charge',
        status: 'succeeded',
        amount_minor: 10_000n,
        net_amount_minor: 10_000n,
        currency: 'PHP',
        description: null,
        booking_id: null,
        external_reference: 'ext-2',
        metadata: null,
        created_at: new Date('2026-03-04T00:00:00.000Z'),
      },
      {
        id: 'txn-1',
        wallet_id: 'wallet-1',
        type: 'charge',
        status: 'succeeded',
        amount_minor: 5_000n,
        net_amount_minor: 5_000n,
        currency: 'PHP',
        description: null,
        booking_id: null,
        external_reference: 'ext-1',
        metadata: null,
        created_at: new Date('2026-03-03T00:00:00.000Z'),
      },
    ]);

    const aggregate = vi.fn()
      .mockResolvedValueOnce({ _sum: { amount_minor: 25_000n, }, })
      .mockResolvedValueOnce({ _sum: { amount_minor: 1_000n, }, });
    const count = vi.fn().mockResolvedValue(3);
    const bookingFindMany = vi.fn().mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        space_name: 'Space A',
        area_name: 'Area A',
      },
    ]);

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      wallet_transaction: {
        findMany,
        aggregate,
        count,
      },
      booking: {
        findMany: bookingFindMany,
      },
    } as unknown as typeof prismaModule.prisma);

    const response = await walletHandler(
      new MockNextRequest('http://localhost/api/v1/wallet?limit=2&type=charge&status=succeeded')
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        wallet_id: 'wallet-1',
        type: 'charge',
        status: 'succeeded',
      },
      take: 3,
    }));
    expect(body.wallet.balanceMinor).toBe('25000');
    expect(body.transactions).toHaveLength(2);
    expect(body.transactions[0].booking).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      spaceName: 'Space A',
      areaName: 'Area A',
    });
    expect(body.pagination).toEqual({
      hasMore: true,
      nextCursor: 'txn-2',
    });
    expect(body.stats).toEqual({
      totalEarnedMinor: '25000',
      totalRefundedMinor: '1000',
      transactionCount: 3,
    });
  });

  it('returns 400 for invalid filters', async () => {
    vi.spyOn(walletServer, 'resolveAuthenticatedUserForWallet').mockResolvedValue({
      response: null,
      dbUser: {
        user_id: 44n,
        auth_user_id: 'partner-auth-id',
        role: 'partner',
      },
    });

    const response = await walletHandler(
      new MockNextRequest('http://localhost/api/v1/wallet?limit=0')
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      message: 'Invalid query parameters.',
    });
  });
});
