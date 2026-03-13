import type { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import * as providerAccountsModule from '@/lib/financial/provider-accounts';
import * as prismaModule from '@/lib/prisma';
import * as providerRegistryModule from '@/lib/providers/provider-registry';
import * as rateLimitModule from '@/lib/rate-limit';
import * as walletServerModule from '@/lib/wallet-server';
import { POST as createPayoutRequestHandler } from '@/app/api/v1/wallet/payout/route';

const makeRequest = (body: unknown) =>
  ({ json: async () => body, } as unknown as NextRequest);
const originalFinancialDataEncryptionKey = process.env.FINANCIAL_DATA_ENCRYPTION_KEY;

const readyPayoutBody = {
  amountMinor: 15000,
  destination: {
    channelCode: 'PH_GCASH',
    accountNumber: '09171234567',
    accountHolderName: 'Paula Partner',
  },
};

describe('wallet payout api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.env.FINANCIAL_DATA_ENCRYPTION_KEY = originalFinancialDataEncryptionKey;
  });

  it('returns 429 when the payout request rate limit is exceeded', async () => {
    vi.spyOn(walletServerModule, 'resolveAuthenticatedUserForWallet').mockResolvedValue({
      response: null,
      dbUser: {
        user_id: 42n,
        auth_user_id: 'partner-auth-id',
        role: 'partner',
      },
    });

    vi.spyOn(rateLimitModule, 'enforceRateLimit').mockRejectedValue(
      new rateLimitModule.RateLimitExceededError('payout-request', 300)
    );

    const response = await createPayoutRequestHandler(makeRequest(readyPayoutBody));

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('300');
    await expect(response.json()).resolves.toEqual({ error: 'Too many requests. Please try again later.', });
    expect(rateLimitModule.enforceRateLimit).toHaveBeenCalledWith({
      scope: 'payout-request',
      identity: 'partner-auth-id',
    });
  });

  it('returns 409 when the payout transaction hits a serialization conflict', async () => {
    process.env.FINANCIAL_DATA_ENCRYPTION_KEY = 'test-financial-encryption-key';

    vi.spyOn(walletServerModule, 'resolveAuthenticatedUserForWallet').mockResolvedValue({
      response: null,
      dbUser: {
        user_id: 42n,
        auth_user_id: 'partner-auth-id',
        role: 'partner',
      },
    });
    vi.spyOn(rateLimitModule, 'enforceRateLimit').mockResolvedValue();
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
      availableBalanceMinor: '50000',
      lastSyncedAt: '2026-03-12T12:00:00.000Z',
      syncWarning: null,
    });
    vi.spyOn(providerAccountsModule, 'getPartnerProviderAccountRecord').mockResolvedValue({
      id: 'provider-account-1',
      partner_user_id: 42n,
      provider: 'xendit',
      provider_account_id: 'acct-test-1234',
      provider_account_type: 'owned',
      status: 'live',
      currency: 'PHP',
      metadata: null,
      created_at: new Date('2026-03-12T12:00:00.000Z'),
      updated_at: new Date('2026-03-12T12:00:00.000Z'),
      last_synced_at: new Date('2026-03-12T12:00:00.000Z'),
    });
    vi.spyOn(providerRegistryModule, 'getFinancialProvider').mockReturnValue({
      name: 'xendit',
      createPartnerAccount: vi.fn(),
      getPartnerAccountStatus: vi.fn(),
      getPartnerBalance: vi.fn(),
      createPayout: vi.fn(),
      getPayout: vi.fn(),
      getPayoutsByReferenceId: vi.fn(),
      listPayoutChannels: vi.fn().mockResolvedValue([
        {
          channelCode: 'PH_GCASH',
          channelName: 'GCash',
          category: 'EWALLET',
          currency: 'PHP',
          country: 'PH',
          minimumAmountMinor: 10000n,
          maximumAmountMinor: null,
          raw: {},
        }
      ]),
    });
    vi.spyOn(walletServerModule, 'ensureWalletRow').mockResolvedValue({
      id: 'wallet-1',
      user_id: 42n,
      balance_minor: 50000n,
      currency: 'PHP',
      created_at: new Date('2026-03-12T12:00:00.000Z'),
      updated_at: new Date('2026-03-12T12:00:00.000Z'),
    });

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      $transaction: vi.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('serialization conflict', {
          code: 'P2034',
          clientVersion: 'test',
        })
      ),
    } as unknown as typeof prismaModule.prisma);

    const response = await createPayoutRequestHandler(makeRequest(readyPayoutBody));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'A conflict occurred. Please try again.', });
  });

  it('requires a ready provider-backed payout account before accepting a payout request', async () => {
    vi.spyOn(walletServerModule, 'resolveAuthenticatedUserForWallet').mockResolvedValue({
      response: null,
      dbUser: {
        user_id: 42n,
        auth_user_id: 'partner-auth-id',
        role: 'partner',
      },
    });
    vi.spyOn(rateLimitModule, 'enforceRateLimit').mockResolvedValue();
    vi.spyOn(walletServerModule, 'ensureWalletRow').mockResolvedValue({
      id: 'wallet-1',
      user_id: 42n,
      balance_minor: 50000n,
      currency: 'PHP',
      created_at: new Date('2026-03-12T12:00:00.000Z'),
      updated_at: new Date('2026-03-12T12:00:00.000Z'),
    });
    vi.spyOn(providerAccountsModule, 'getPartnerProviderAccountView').mockResolvedValue({
      configured: false,
      provider: 'xendit',
      providerAccountReference: null,
      accountType: null,
      status: null,
      setupState: 'not_enabled',
      statusLabel: 'Not enabled',
      statusMessage: 'Enable payouts first.',
      currency: null,
      availableBalanceMinor: null,
      lastSyncedAt: null,
      syncWarning: null,
    });
    vi.spyOn(providerAccountsModule, 'getPartnerProviderAccountRecord').mockResolvedValue(null);

    const response = await createPayoutRequestHandler(makeRequest(readyPayoutBody));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'Enable payouts in Partner Settings and wait for the Xendit account to be ready before requesting a payout.', });
  });

  it('returns 503 when the synced provider balance is unavailable', async () => {
    vi.spyOn(walletServerModule, 'resolveAuthenticatedUserForWallet').mockResolvedValue({
      response: null,
      dbUser: {
        user_id: 42n,
        auth_user_id: 'partner-auth-id',
        role: 'partner',
      },
    });
    vi.spyOn(rateLimitModule, 'enforceRateLimit').mockResolvedValue();
    vi.spyOn(walletServerModule, 'ensureWalletRow').mockResolvedValue({
      id: 'wallet-1',
      user_id: 42n,
      balance_minor: 50000n,
      currency: 'PHP',
      created_at: new Date('2026-03-12T12:00:00.000Z'),
      updated_at: new Date('2026-03-12T12:00:00.000Z'),
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
      availableBalanceMinor: null,
      lastSyncedAt: '2026-03-12T12:00:00.000Z',
      syncWarning: 'Timed out while fetching the provider balance.',
    });
    vi.spyOn(providerAccountsModule, 'getPartnerProviderAccountRecord').mockResolvedValue({
      id: 'provider-account-1',
      partner_user_id: 42n,
      provider: 'xendit',
      provider_account_id: 'acct-test-1234',
      provider_account_type: 'owned',
      status: 'live',
      currency: 'PHP',
      metadata: null,
      created_at: new Date('2026-03-12T12:00:00.000Z'),
      updated_at: new Date('2026-03-12T12:00:00.000Z'),
      last_synced_at: new Date('2026-03-12T12:00:00.000Z'),
    });

    const response = await createPayoutRequestHandler(makeRequest(readyPayoutBody));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'Your Xendit balance is temporarily unavailable. Refresh the wallet and try again.', });
  });

  it('returns 409 when the requested amount exceeds the synced provider balance', async () => {
    vi.spyOn(walletServerModule, 'resolveAuthenticatedUserForWallet').mockResolvedValue({
      response: null,
      dbUser: {
        user_id: 42n,
        auth_user_id: 'partner-auth-id',
        role: 'partner',
      },
    });
    vi.spyOn(rateLimitModule, 'enforceRateLimit').mockResolvedValue();
    vi.spyOn(walletServerModule, 'ensureWalletRow').mockResolvedValue({
      id: 'wallet-1',
      user_id: 42n,
      balance_minor: 50000n,
      currency: 'PHP',
      created_at: new Date('2026-03-12T12:00:00.000Z'),
      updated_at: new Date('2026-03-12T12:00:00.000Z'),
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
      availableBalanceMinor: '14000',
      lastSyncedAt: '2026-03-12T12:00:00.000Z',
      syncWarning: null,
    });
    vi.spyOn(providerAccountsModule, 'getPartnerProviderAccountRecord').mockResolvedValue({
      id: 'provider-account-1',
      partner_user_id: 42n,
      provider: 'xendit',
      provider_account_id: 'acct-test-1234',
      provider_account_type: 'owned',
      status: 'live',
      currency: 'PHP',
      metadata: null,
      created_at: new Date('2026-03-12T12:00:00.000Z'),
      updated_at: new Date('2026-03-12T12:00:00.000Z'),
      last_synced_at: new Date('2026-03-12T12:00:00.000Z'),
    });

    const response = await createPayoutRequestHandler(makeRequest(readyPayoutBody));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'Requested payout exceeds your synced Xendit available balance.', });
  });
});
