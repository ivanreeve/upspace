import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import * as reconciliationModule from '@/lib/financial/reconciliation';
import { GET as providerSyncHandler } from '@/app/api/internal/cron/provider-sync/route';

const originalCronSecret = process.env.CRON_SECRET;

const makeRequest = (headers?: HeadersInit) =>
  ({ headers: new Headers(headers), } as Request);

describe('provider sync cron api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.env.CRON_SECRET = originalCronSecret;
  });

  it('rejects requests without the cron secret when configured', async () => {
    process.env.CRON_SECRET = 'cron-secret';

    const response = await providerSyncHandler(makeRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: 'Unauthorized', });
  });

  it('runs provider reconciliation when authorized', async () => {
    process.env.CRON_SECRET = 'cron-secret';
    vi.spyOn(reconciliationModule, 'runProviderReconciliation').mockResolvedValue({
      checkedAccounts: 5,
      syncedAccounts: 4,
      failedAccounts: 1,
      reconciledPayouts: 2,
      staleAccountsBeforeRun: 3,
    });

    const response = await providerSyncHandler(
      makeRequest({ 'x-cron-secret': 'cron-secret', })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        checkedAccounts: 5,
        syncedAccounts: 4,
        failedAccounts: 1,
        reconciledPayouts: 2,
        staleAccountsBeforeRun: 3,
      },
    });
  });

  it('accepts bearer authorization for scheduled runs', async () => {
    process.env.CRON_SECRET = 'cron-secret';
    vi.spyOn(reconciliationModule, 'runProviderReconciliation').mockResolvedValue({
      checkedAccounts: 1,
      syncedAccounts: 1,
      failedAccounts: 0,
      reconciledPayouts: 0,
      staleAccountsBeforeRun: 0,
    });

    const response = await providerSyncHandler(
      makeRequest({ authorization: 'Bearer cron-secret', })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        checkedAccounts: 1,
        syncedAccounts: 1,
        failedAccounts: 0,
        reconciledPayouts: 0,
        staleAccountsBeforeRun: 0,
      },
    });
  });
});
