import type { NextRequest } from 'next/server';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import * as adminSessionModule from '@/lib/auth/require-admin-session';
import * as reconciliationModule from '@/lib/financial/reconciliation';
import { GET as getAdminReconciliationHandler, POST as runAdminReconciliationHandler } from '@/app/api/v1/admin/reconciliation/route';

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

describe('admin reconciliation api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists admin reconciliation data', async () => {
    vi.spyOn(adminSessionModule, 'requireAdminSession').mockResolvedValue({
      authUserId: 'admin-auth-id',
      userId: 99n,
    });
    vi.spyOn(reconciliationModule, 'listAdminReconciliationData').mockResolvedValue({
      rows: [
        {
          partnerUserId: '42',
          partnerHandle: 'paulapartner',
          partnerName: 'Paula Partner',
          localProviderAccountId: 'provider-local-1',
          remoteProviderAccountId: 'acct-remote-1',
          providerStatus: 'live',
          walletBalanceMinor: '100000',
          walletCurrency: 'PHP',
          providerAvailableBalanceMinor: '120000',
          providerCurrency: 'PHP',
          expectedWalletBalanceMinor: '100000',
          pendingPayoutReserveMinor: '20000',
          pendingRefundCount: 1,
          pendingProviderPayoutCount: 1,
          mismatchMinor: '0',
          lastSyncedAt: '2026-03-13T09:00:00.000Z',
          latestSnapshotFetchedAt: '2026-03-13T09:00:00.000Z',
          latestSnapshotStatus: 'synced',
          latestFailureReason: null,
          health: 'healthy',
        }
      ],
      summary: {
        totalAccounts: 1,
        liveAccounts: 1,
        staleAccounts: 0,
        failedAccounts: 0,
        mismatchedAccounts: 0,
        pendingProviderPayouts: 1,
        pendingRefunds: 1,
      },
    });

    const response = await getAdminReconciliationHandler(
      makeRequest({ url: 'http://localhost/api/v1/admin/reconciliation?limit=25', })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: expect.objectContaining({ summary: expect.objectContaining({ totalAccounts: 1, }), }), });
    expect(reconciliationModule.listAdminReconciliationData).toHaveBeenCalledWith(25);
  });

  it('runs provider reconciliation on demand for admins', async () => {
    vi.spyOn(adminSessionModule, 'requireAdminSession').mockResolvedValue({
      authUserId: 'admin-auth-id',
      userId: 99n,
    });
    vi.spyOn(reconciliationModule, 'runProviderReconciliation').mockResolvedValue({
      checkedAccounts: 4,
      syncedAccounts: 3,
      failedAccounts: 1,
      reconciledPayouts: 2,
      staleAccountsBeforeRun: 2,
    });

    const response = await runAdminReconciliationHandler(
      makeRequest({
        url: 'http://localhost/api/v1/admin/reconciliation',
        method: 'POST',
        body: { limit: 10, },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        checkedAccounts: 4,
        syncedAccounts: 3,
        failedAccounts: 1,
        reconciledPayouts: 2,
        staleAccountsBeforeRun: 2,
      },
    });
    expect(reconciliationModule.runProviderReconciliation).toHaveBeenCalledWith(10);
  });
});
