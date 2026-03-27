import type { NextRequest } from 'next/server';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import * as providerAccountsModule from '@/lib/financial/provider-accounts';
import * as prismaModule from '@/lib/prisma';
import * as walletServerModule from '@/lib/wallet-server';
import { GET as walletRouteHandler } from '@/app/api/v1/wallet/route';

const makeRequest = (url: string) =>
  ({ nextUrl: new URL(url), } as unknown as NextRequest);

describe('wallet route', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('includes provider-backed payout setup in wallet summary reads', async () => {
    vi.spyOn(walletServerModule, 'resolveAuthenticatedUserForWallet').mockResolvedValue({
      response: null,
      dbUser: {
        user_id: 42n,
        auth_user_id: 'partner-auth-id',
        role: 'partner',
      },
    });
    vi.spyOn(walletServerModule, 'ensureWalletRow').mockResolvedValue({
      id: 'wallet-1',
      user_id: 42n,
      balance_minor: 250000n,
      currency: 'PHP',
      created_at: new Date('2026-03-13T10:00:00.000Z'),
      updated_at: new Date('2026-03-13T10:05:00.000Z'),
    });
    vi.spyOn(providerAccountsModule, 'getPartnerProviderAccountView').mockResolvedValue({
      configured: true,
      provider: 'xendit',
      providerAccountReference: 'acct...1234',
      accountType: 'owned',
      status: 'live',
      setupState: 'ready',
      statusLabel: 'Ready',
      statusMessage: 'Provider sync active.',
      currency: 'PHP',
      availableBalanceMinor: '300000',
      lastSyncedAt: '2026-03-13T10:05:30.000Z',
      syncWarning: null,
    });

    const aggregate = vi.fn()
      .mockResolvedValueOnce({ _sum: { amount_minor: 500000n, }, })
      .mockResolvedValueOnce({ _sum: { amount_minor: 10000n, }, })
      .mockResolvedValueOnce({ _sum: { amount_minor: 20000n, }, })
      .mockResolvedValueOnce({ _sum: { amount_minor: 50000n, }, });

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      wallet: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'wallet-1',
          user_id: 42n,
          balance_minor: 300000n,
          currency: 'PHP',
          created_at: new Date('2026-03-13T10:00:00.000Z'),
          updated_at: new Date('2026-03-13T10:05:30.000Z'),
        }),
      },
      wallet_transaction: {
        findMany: vi.fn().mockResolvedValue([]),
        aggregate,
        count: vi.fn().mockResolvedValue(0),
      },
    } as unknown as typeof prismaModule.prisma);

    const response = await walletRouteHandler(
      makeRequest('http://localhost/api/v1/wallet?limit=1')
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.providerAccount).toEqual({
      configured: true,
      provider: 'xendit',
      providerAccountReference: 'acct...1234',
      accountType: 'owned',
      status: 'live',
      setupState: 'ready',
      statusLabel: 'Ready',
      statusMessage: 'Provider sync active.',
      currency: 'PHP',
      availableBalanceMinor: '300000',
      lastSyncedAt: '2026-03-13T10:05:30.000Z',
      syncWarning: null,
    });
    expect(body.wallet.balanceMinor).toBe('300000');
    expect(providerAccountsModule.getPartnerProviderAccountView).toHaveBeenCalledWith({ partnerUserId: 42n, });
  });

  it('skips provider sync when includeProvider=0 for transaction pagination', async () => {
    vi.spyOn(walletServerModule, 'resolveAuthenticatedUserForWallet').mockResolvedValue({
      response: null,
      dbUser: {
        user_id: 42n,
        auth_user_id: 'partner-auth-id',
        role: 'partner',
      },
    });
    vi.spyOn(walletServerModule, 'ensureWalletRow').mockResolvedValue({
      id: 'wallet-1',
      user_id: 42n,
      balance_minor: 250000n,
      currency: 'PHP',
      created_at: new Date('2026-03-13T10:00:00.000Z'),
      updated_at: new Date('2026-03-13T10:05:00.000Z'),
    });
    const providerSpy = vi.spyOn(providerAccountsModule, 'getPartnerProviderAccountView');

    const aggregate = vi.fn()
      .mockResolvedValueOnce({ _sum: { amount_minor: 500000n, }, })
      .mockResolvedValueOnce({ _sum: { amount_minor: 10000n, }, })
      .mockResolvedValueOnce({ _sum: { amount_minor: 20000n, }, })
      .mockResolvedValueOnce({ _sum: { amount_minor: 50000n, }, });

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      wallet_transaction: {
        findMany: vi.fn().mockResolvedValue([]),
        aggregate,
        count: vi.fn().mockResolvedValue(0),
      },
    } as unknown as typeof prismaModule.prisma);

    const response = await walletRouteHandler(
      makeRequest('http://localhost/api/v1/wallet?limit=25&includeProvider=0')
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.providerAccount).toBeNull();
    expect(providerSpy).not.toHaveBeenCalled();
  });
});
