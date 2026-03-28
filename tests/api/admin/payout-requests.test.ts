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
import { encryptPayoutDestination } from '@/lib/financial/payout-destination';
import * as providerAccountsModule from '@/lib/financial/provider-accounts';
import * as prismaModule from '@/lib/prisma';
import * as providerRegistryModule from '@/lib/providers/provider-registry';
import { GET as listPayoutRequestsHandler } from '@/app/api/v1/admin/payout-requests/route';
import { PATCH as updatePayoutRequestHandler } from '@/app/api/v1/admin/payout-requests/[request_id]/route';

const requestId = '11111111-1111-4111-8111-111111111111';
const secondRequestId = '22222222-2222-4222-8222-222222222222';
const originalFinancialDataEncryptionKey = process.env.FINANCIAL_DATA_ENCRYPTION_KEY;

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
    process.env.FINANCIAL_DATA_ENCRYPTION_KEY = originalFinancialDataEncryptionKey;
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
            metadata: {
              workflow_stage: 'awaiting_review',
              payout_destination: {
                channelCode: 'PH_GCASH',
                channelName: 'GCash',
                channelCategory: 'EWALLET',
                currency: 'PHP',
                accountHolderName: 'Paula Partner',
                accountNumberMasked: '*******4567',
              },
              provider_account_snapshot: {
                provider_account_reference: 'acct...5678',
                account_type: 'owned',
                status: 'live',
                setup_state: 'ready',
                available_balance_minor: '210000',
                last_synced_at: '2026-03-07T11:59:00.000Z',
              },
            },
            wallet: {
              balance_minor: 350000n,
              user: {
                user_id: 42n,
                first_name: 'Paula',
                last_name: 'Partner',
                handle: 'paulapartner',
                role: 'partner',
                provider_accounts: [
                  {
                    provider: 'xendit',
                    provider_account_id: 'accnt_12345678',
                    provider_account_type: 'owned',
                    status: 'live',
                    currency: 'PHP',
                    last_synced_at: new Date('2026-03-07T11:59:00.000Z'),
                    metadata: null,
                  }
                ],
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
            metadata: null,
            wallet: {
              balance_minor: 280000n,
              user: {
                user_id: 43n,
                first_name: 'Peter',
                last_name: 'Partner',
                handle: 'peterpartner',
                role: 'partner',
                provider_accounts: [],
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
        workflowStage: 'awaiting_review',
        payoutDestination: {
          channelCode: 'PH_GCASH',
          channelName: 'GCash',
          channelCategory: 'EWALLET',
          currency: 'PHP',
          accountHolderName: 'Paula Partner',
          accountNumberMasked: '*******4567',
        },
        partnerProviderAccount: {
          provider: 'xendit',
          accountReference: 'accn...5678',
          accountType: 'owned',
          status: 'live',
          currency: 'PHP',
          lastSyncedAt: '2026-03-07T11:59:00.000Z',
        },
        providerSnapshot: {
          provider: 'xendit',
          accountReference: 'acct...5678',
          accountType: 'owned',
          status: 'live',
          setupState: 'ready',
          availableBalanceMinor: '210000',
          lastSyncedAt: '2026-03-07T11:59:00.000Z',
        },
        providerPayout: null,
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

  it('loads payout destination details from encrypted or legacy metadata', async () => {
    process.env.FINANCIAL_DATA_ENCRYPTION_KEY = 'test-financial-encryption-key';

    vi.spyOn(adminSessionModule, 'requireAdminSession').mockResolvedValue({
      authUserId: 'admin-auth-id',
      userId: 99n,
    });

    const encryptedDestination = encryptPayoutDestination({
      channelCode: 'PH_BDO',
      channelName: 'BDO',
      channelCategory: 'BANK',
      currency: 'PHP',
      accountNumber: '123456789012',
      accountHolderName: 'Pat Partner',
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
            metadata: {
              workflow_stage: 'awaiting_review',
              payout_destination_encrypted: encryptedDestination,
            },
            wallet: {
              balance_minor: 350000n,
              user: {
                user_id: 42n,
                first_name: 'Pat',
                last_name: 'Partner',
                handle: 'patpartner',
                role: 'partner',
                provider_accounts: [],
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
            metadata: {
              workflow_stage: 'awaiting_review',
              payout_destination: {
                channel_code: 'PH_GCASH',
                channel_name: 'GCash',
                channel_category: 'EWALLET',
                currency: 'PHP',
                account_holder_name: 'Pat Partner',
                account_number_masked: '*******4567',
              },
            },
            wallet: {
              balance_minor: 280000n,
              user: {
                user_id: 43n,
                first_name: 'Pat',
                last_name: 'Partner',
                handle: 'patpartner2',
                role: 'partner',
                provider_accounts: [],
              },
            },
            processed_by: null,
          }
        ]),
        count,
      },
    } as unknown as typeof prismaModule.prisma);

    const response = await listPayoutRequestsHandler(
      makeRequest({ url: 'http://localhost/api/v1/admin/payout-requests?status=pending&limit=20', })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data[0].payoutDestination).toEqual({
      channelCode: 'PH_BDO',
      channelName: 'BDO',
      channelCategory: 'BANK',
      currency: 'PHP',
      accountHolderName: 'Pat Partner',
      accountNumberMasked: '********9012',
    });
    expect(body.data[1].payoutDestination).toEqual({
      channelCode: 'PH_GCASH',
      channelName: 'GCash',
      channelCategory: 'EWALLET',
      currency: 'PHP',
      accountHolderName: 'Pat Partner',
      accountNumberMasked: '*******4567',
    });
  });

  it('submits a payout request to Xendit without restoring wallet balance', async () => {
    process.env.FINANCIAL_DATA_ENCRYPTION_KEY = 'test-financial-encryption-key';

    vi.spyOn(adminSessionModule, 'requireAdminSession').mockResolvedValue({
      authUserId: 'admin-auth-id',
      userId: 99n,
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
      created_at: new Date('2026-03-07T10:00:00.000Z'),
      updated_at: new Date('2026-03-07T10:00:00.000Z'),
      last_synced_at: new Date('2026-03-07T10:00:00.000Z'),
    });
    vi.spyOn(providerRegistryModule, 'getFinancialProvider').mockReturnValue({
      name: 'xendit',
      createPartnerAccount: vi.fn(),
      getPartnerAccountStatus: vi.fn(),
      getPartnerBalance: vi.fn(),
      listPayoutChannels: vi.fn(),
      getPayout: vi.fn(),
      getPayoutsByReferenceId: vi.fn().mockResolvedValue([]),
      createPayout: vi.fn().mockResolvedValue({
        payoutId: 'po-123',
        referenceId: requestId,
        amountMinor: 200000n,
        currency: 'PHP',
        channelCode: 'PH_GCASH',
        status: 'ACCEPTED',
        estimatedArrivalTime: '2026-03-07T11:00:00.000Z',
        failureCode: null,
        raw: {},
      }),
    });

    const encryptedDestination = encryptPayoutDestination({
      channelCode: 'PH_GCASH',
      channelName: 'GCash',
      channelCategory: 'EWALLET',
      currency: 'PHP',
      accountNumber: '09171234567',
      accountHolderName: 'Paula Partner',
    });

    const lockTx = {
      wallet_transaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: requestId,
          wallet_id: 'wallet-1',
          type: 'payout',
          status: 'pending',
          amount_minor: 200000n,
          currency: 'PHP',
          description: 'Payout request',
          metadata: {
            workflow_stage: 'awaiting_review',
            payout_destination_encrypted: encryptedDestination,
            provider_account_snapshot: { provider_account_id: 'acct-test-1234', },
          },
          wallet: {
 user: {
 auth_user_id: 'partner-auth-id',
user_id: 42n, 
}, 
},
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1, }),
      },
    };

    const submitTx = {
      wallet_transaction: { updateMany: vi.fn().mockResolvedValue({ count: 1, }), },
      wallet: { update: vi.fn(), },
      app_notification: { create: vi.fn().mockResolvedValue({ id: 'notif-1', }), },
    };

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      $transaction: vi
        .fn()
        .mockImplementationOnce(async (callback: (transaction: typeof lockTx) => Promise<unknown>) =>
          callback(lockTx)
        )
        .mockImplementationOnce(async (callback: (transaction: typeof submitTx) => Promise<unknown>) =>
          callback(submitTx)
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
    await expect(response.json()).resolves.toEqual({
      status: 'pending',
      workflowStage: 'submitted_to_provider',
      providerStatus: 'ACCEPTED',
    });
    expect(submitTx.wallet.update).not.toHaveBeenCalled();
    expect(lockTx.wallet_transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: requestId,
          type: 'payout',
          status: 'pending',
        },
        data: expect.objectContaining({
          resolution_note: 'Settled through our payout rail.',
          processed_by_user_id: 99n,
        }),
      })
    );
    expect(submitTx.wallet_transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: requestId,
          type: 'payout',
          status: 'pending',
        },
        data: expect.objectContaining({
          external_reference: 'po-123',
          resolution_note: 'Settled through our payout rail.',
          processed_by_user_id: 99n,
        }),
      })
    );
    expect(submitTx.app_notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_auth_id: 'partner-auth-id',
          title: 'Payout submitted',
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
          metadata: { workflow_stage: 'awaiting_review', },
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
