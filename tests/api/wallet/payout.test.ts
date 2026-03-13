import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import * as prismaModule from '@/lib/prisma';
import * as walletServer from '@/lib/wallet-server';
import { POST as payoutHandler } from '@/app/api/v1/wallet/payout/route';
import { MockNextRequest } from '../../utils/mock-next-server';

describe('wallet payout api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects payout amounts below the minimum', async () => {
    vi.spyOn(walletServer, 'resolveAuthenticatedUserForWallet').mockResolvedValue({
      response: null,
      dbUser: {
        user_id: 5n,
        auth_user_id: 'partner-auth-id',
        role: 'partner',
      },
    });

    const response = await payoutHandler(
      new MockNextRequest('http://localhost/api/v1/wallet/payout', {
        method: 'POST',
        body: JSON.stringify({ amountMinor: 9_999, }),
        headers: { 'content-type': 'application/json', },
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Minimum payout is ₱100.',
    });
  });

  it('rejects payout when there is already a pending request', async () => {
    vi.spyOn(walletServer, 'resolveAuthenticatedUserForWallet').mockResolvedValue({
      response: null,
      dbUser: {
        user_id: 5n,
        auth_user_id: 'partner-auth-id',
        role: 'partner',
      },
    });

    vi.spyOn(walletServer, 'ensureWalletRow').mockResolvedValue({
      id: 'wallet-5',
      user_id: 5n,
      balance_minor: 50_000n,
      currency: 'PHP',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
    } as Awaited<ReturnType<typeof walletServer.ensureWalletRow>>);

    const txMock = {
      wallet: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'wallet-5',
          balance_minor: 50_000n,
          currency: 'PHP',
        }),
        updateMany: vi.fn(),
      },
      wallet_transaction: {
        findFirst: vi.fn().mockResolvedValue({ id: 'pending-payout', }),
        create: vi.fn(),
      },
    };

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      $transaction: vi.fn().mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) =>
        callback(txMock)
      ),
    } as unknown as typeof prismaModule.prisma);

    const response = await payoutHandler(
      new MockNextRequest('http://localhost/api/v1/wallet/payout', {
        method: 'POST',
        body: JSON.stringify({ amountMinor: 10_000, }),
        headers: { 'content-type': 'application/json', },
      })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'A payout is already pending. Please wait for it to complete.',
    });
  });

  it('creates a pending payout request and deducts the balance', async () => {
    vi.spyOn(walletServer, 'resolveAuthenticatedUserForWallet').mockResolvedValue({
      response: null,
      dbUser: {
        user_id: 5n,
        auth_user_id: 'partner-auth-id',
        role: 'partner',
      },
    });

    vi.spyOn(walletServer, 'ensureWalletRow').mockResolvedValue({
      id: 'wallet-5',
      user_id: 5n,
      balance_minor: 50_000n,
      currency: 'PHP',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
    } as Awaited<ReturnType<typeof walletServer.ensureWalletRow>>);

    const updateMany = vi.fn().mockResolvedValue({ count: 1, });
    const create = vi.fn().mockResolvedValue({
      id: 'payout-1',
      amount_minor: 15_000n,
      currency: 'PHP',
      status: 'pending',
    });
    const txMock = {
      wallet: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'wallet-5',
          balance_minor: 50_000n,
          currency: 'PHP',
        }),
        updateMany,
      },
      wallet_transaction: {
        findFirst: vi.fn().mockResolvedValue(null),
        create,
      },
    };

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      $transaction: vi.fn().mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) =>
        callback(txMock)
      ),
    } as unknown as typeof prismaModule.prisma);

    const response = await payoutHandler(
      new MockNextRequest('http://localhost/api/v1/wallet/payout', {
        method: 'POST',
        body: JSON.stringify({ amountMinor: 15_000, }),
        headers: { 'content-type': 'application/json', },
      })
    );

    expect(response.status).toBe(201);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'wallet-5',
        balance_minor: { gte: 15_000n, },
      },
    }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        wallet_id: 'wallet-5',
        type: 'payout',
        status: 'pending',
        amount_minor: 15_000n,
      }),
    }));
    await expect(response.json()).resolves.toEqual({
      data: {
        transactionId: 'payout-1',
        amountMinor: '15000',
        currency: 'PHP',
        status: 'pending',
      },
    });
  });
});
