import type { NextRequest } from 'next/server';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import * as partnerSessionModule from '@/lib/auth/require-partner-session';
import * as providerAccountsModule from '@/lib/financial/provider-accounts';
import { FinancialProviderError } from '@/lib/providers/errors';
import { GET as getProviderAccountStatusHandler } from '@/app/api/v1/financial/provider-account/status/route';
import { POST as createProviderAccountHandler } from '@/app/api/v1/financial/provider-account/route';

const makeRequest = (url: string) =>
  ({
    nextUrl: new URL(url),
    headers: new Headers(),
  } as unknown as NextRequest);

describe('partner provider account api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a provider-backed payout account for a partner', async () => {
    vi.spyOn(partnerSessionModule, 'requirePartnerSession').mockResolvedValue({
      authUserId: 'partner-auth-id',
      userId: 42n,
      email: 'partner@example.com',
    });
    vi.spyOn(providerAccountsModule, 'ensurePartnerProviderAccount').mockResolvedValue({
      configured: true,
      provider: 'xendit',
      providerAccountReference: 'acct...1234',
      accountType: 'owned',
      status: 'live',
      setupState: 'ready',
      statusLabel: 'Ready',
      statusMessage: 'Ready for routing.',
      currency: 'PHP',
      availableBalanceMinor: null,
      lastSyncedAt: '2026-03-13T10:00:00.000Z',
      syncWarning: null,
    });

    const response = await createProviderAccountHandler();

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      configured: true,
      provider: 'xendit',
      providerAccountReference: 'acct...1234',
      accountType: 'owned',
      status: 'live',
      setupState: 'ready',
      statusLabel: 'Ready',
      statusMessage: 'Ready for routing.',
      currency: 'PHP',
      availableBalanceMinor: null,
      lastSyncedAt: '2026-03-13T10:00:00.000Z',
      syncWarning: null,
    });
    expect(providerAccountsModule.ensurePartnerProviderAccount).toHaveBeenCalledWith({
      partnerUserId: 42n,
      partnerAuthUserId: 'partner-auth-id',
      email: 'partner@example.com',
    });
  });

  it('returns a refreshed provider-backed payout status', async () => {
    vi.spyOn(partnerSessionModule, 'requirePartnerSession').mockResolvedValue({
      authUserId: 'partner-auth-id',
      userId: 42n,
      email: 'partner@example.com',
    });
    vi.spyOn(providerAccountsModule, 'getPartnerProviderAccountView').mockResolvedValue({
      configured: true,
      provider: 'xendit',
      providerAccountReference: 'acct...1234',
      accountType: 'owned',
      status: 'live',
      setupState: 'ready',
      statusLabel: 'Ready',
      statusMessage: 'Ready for routing.',
      currency: 'PHP',
      availableBalanceMinor: '150000',
      lastSyncedAt: '2026-03-13T10:00:00.000Z',
      syncWarning: null,
    });

    const response = await getProviderAccountStatusHandler(
      makeRequest('http://localhost/api/v1/financial/provider-account/status?refresh=1')
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      configured: true,
      provider: 'xendit',
      providerAccountReference: 'acct...1234',
      accountType: 'owned',
      status: 'live',
      setupState: 'ready',
      statusLabel: 'Ready',
      statusMessage: 'Ready for routing.',
      currency: 'PHP',
      availableBalanceMinor: '150000',
      lastSyncedAt: '2026-03-13T10:00:00.000Z',
      syncWarning: null,
    });
    expect(providerAccountsModule.getPartnerProviderAccountView).toHaveBeenCalledWith({
      partnerUserId: 42n,
      forceRefresh: true,
    });
  });

  it('surfaces provider validation errors cleanly', async () => {
    vi.spyOn(partnerSessionModule, 'requirePartnerSession').mockResolvedValue({
      authUserId: 'partner-auth-id',
      userId: 42n,
      email: null,
    });
    vi.spyOn(providerAccountsModule, 'ensurePartnerProviderAccount').mockRejectedValue(
      new FinancialProviderError('Add an email address to your account before enabling payouts.', { status: 400, })
    );

    const response = await createProviderAccountHandler();

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: 'Add an email address to your account before enabling payouts.', });
  });
});
