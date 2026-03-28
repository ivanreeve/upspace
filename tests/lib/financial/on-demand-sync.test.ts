import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import * as providerRegistryModule from '@/lib/providers/provider-registry';
import * as prismaModule from '@/lib/prisma';
import * as xenditPayoutsModule from '@/lib/financial/xendit-payouts';
import { reconcilePendingPayouts } from '@/lib/financial/on-demand-sync';

describe('reconcilePendingPayouts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reconciles pending provider payouts even when provider account sync is fresh', async () => {
    const getPayout = vi.fn().mockResolvedValue({
      payoutId: 'po-123',
      referenceId: 'payout-request-1',
      status: 'SUCCEEDED',
      estimatedArrivalTime: null,
      failureCode: null,
    });
    const applyStatus = vi.spyOn(xenditPayoutsModule, 'applyXenditPayoutStatus').mockResolvedValue({
 changed: true,
providerAccountIdToSync: 'acct-remote-1', 
});
    const syncWallet = vi.spyOn(xenditPayoutsModule, 'syncPartnerWalletFromRemoteAccountId').mockResolvedValue();

    vi.spyOn(providerRegistryModule, 'getFinancialProvider').mockReturnValue({ getPayout, } as unknown as ReturnType<typeof providerRegistryModule.getFinancialProvider>);

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      partner_provider_account: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'provider-record-1',
          provider_account_id: 'acct-remote-1',
          last_synced_at: new Date('2026-03-28T09:59:00.000Z'),
          partner: { wallet: { id: 'wallet-1', }, },
        }),
      },
      wallet_transaction: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'payout-request-1',
            external_reference: 'po-123',
          }
        ]),
      },
    } as unknown as typeof prismaModule.prisma);

    await reconcilePendingPayouts(42n);

    expect(getPayout).toHaveBeenCalledWith('po-123', 'acct-remote-1');
    expect(applyStatus).toHaveBeenCalledWith({
          payoutId: 'po-123',
          referenceId: 'payout-request-1',
          status: 'SUCCEEDED',
          estimatedArrivalTime: null,
          failureCode: null,
        });
    expect(syncWallet).toHaveBeenCalledWith('acct-remote-1');
  });

  it('skips provider calls when there are no pending provider payouts', async () => {
    const getPayout = vi.fn();

    vi.spyOn(providerRegistryModule, 'getFinancialProvider').mockReturnValue({ getPayout, } as unknown as ReturnType<typeof providerRegistryModule.getFinancialProvider>);
    vi.spyOn(xenditPayoutsModule, 'applyXenditPayoutStatus').mockResolvedValue({
 changed: false,
providerAccountIdToSync: null, 
});

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      partner_provider_account: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'provider-record-1',
          provider_account_id: 'acct-remote-1',
          last_synced_at: new Date('2026-03-28T09:59:00.000Z'),
          partner: { wallet: { id: 'wallet-1', }, },
        }),
      },
      wallet_transaction: { findMany: vi.fn().mockResolvedValue([]), },
    } as unknown as typeof prismaModule.prisma);

    await reconcilePendingPayouts(42n);

    expect(getPayout).not.toHaveBeenCalled();
  });
});
