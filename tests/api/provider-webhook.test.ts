import type { NextRequest } from 'next/server';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import * as bookingFinalizationModule from '@/lib/bookings/payment-finalization';
import * as emailModule from '@/lib/email';
import * as notificationsModule from '@/lib/notifications/booking';
import * as prismaModule from '@/lib/prisma';
import * as providerRegistryModule from '@/lib/providers/provider-registry';
import * as supabaseAdminModule from '@/lib/supabase/admin';
import * as walletSnapshotsModule from '@/lib/financial/wallet-snapshots';
import * as walletServerModule from '@/lib/wallet-server';
import { POST as xenditWebhookHandler } from '@/app/api/provider/webhook/route';

const originalWebhookToken = process.env.XENDIT_WEBHOOK_VERIFICATION_TOKEN;

const makeRequest = (payload: unknown, token = 'test-callback-token') =>
  ({
    headers: new Headers({ 'x-callback-token': token, }),
    json: async () => payload,
  } as unknown as NextRequest);

describe('provider webhook api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.env.XENDIT_WEBHOOK_VERIFICATION_TOKEN = originalWebhookToken;
  });

  it('marks payout requests as succeeded from Xendit callbacks', async () => {
    process.env.XENDIT_WEBHOOK_VERIFICATION_TOKEN = 'test-callback-token';

    const tx = {
      wallet_transaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: '11111111-1111-4111-8111-111111111111',
          wallet_id: 'wallet-1',
          type: 'payout',
          status: 'pending',
          amount_minor: 150000n,
          currency: 'PHP',
          metadata: {
            workflow_stage: 'submitted_to_provider',
            payout_provider: {
              payout_id: 'po-123',
              status: 'ACCEPTED',
            },
          },
          wallet: { user: { auth_user_id: 'partner-auth-id', }, },
        }),
        update: vi.fn().mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111', }),
      },
      wallet: { update: vi.fn(), },
      app_notification: { create: vi.fn().mockResolvedValue({ id: 'notif-1', }), },
    };

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx)
      ),
    } as unknown as typeof prismaModule.prisma);

    const response = await xenditWebhookHandler(
      makeRequest({
        id: 'po-123',
        reference_id: '11111111-1111-4111-8111-111111111111',
        amount: 1500,
        currency: 'PHP',
        channel_code: 'PH_GCASH',
        status: 'SUCCEEDED',
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, });
    expect(tx.wallet_transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: '11111111-1111-4111-8111-111111111111', },
        data: expect.objectContaining({ status: 'succeeded', }),
      })
    );
    expect(tx.wallet.update).not.toHaveBeenCalled();
    expect(tx.app_notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_auth_id: 'partner-auth-id',
          title: 'Payout completed',
        }),
      })
    );
  });

  it('marks payout requests as failed and restores wallet balance on Xendit failure callbacks', async () => {
    process.env.XENDIT_WEBHOOK_VERIFICATION_TOKEN = 'test-callback-token';

    const tx = {
      wallet_transaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: '11111111-1111-4111-8111-111111111111',
          wallet_id: 'wallet-1',
          type: 'payout',
          status: 'pending',
          amount_minor: 150000n,
          currency: 'PHP',
          metadata: {
            workflow_stage: 'submitted_to_provider',
            payout_provider: {
              payout_id: 'po-123',
              status: 'ACCEPTED',
            },
          },
          wallet: { user: { auth_user_id: 'partner-auth-id', }, },
        }),
        update: vi.fn().mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111', }),
      },
      wallet: { update: vi.fn().mockResolvedValue({ id: 'wallet-1', }), },
      app_notification: { create: vi.fn().mockResolvedValue({ id: 'notif-2', }), },
    };

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx)
      ),
    } as unknown as typeof prismaModule.prisma);

    const response = await xenditWebhookHandler(
      makeRequest({
        id: 'po-123',
        reference_id: '11111111-1111-4111-8111-111111111111',
        amount: 1500,
        currency: 'PHP',
        channel_code: 'PH_GCASH',
        status: 'FAILED',
        failure_code: 'INSUFFICIENT_BALANCE',
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, });
    expect(tx.wallet_transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: '11111111-1111-4111-8111-111111111111', },
        data: expect.objectContaining({ status: 'failed', }),
      })
    );
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1', },
      data: expect.objectContaining({ balance_minor: { increment: 150000n, }, }),
    });
    expect(tx.app_notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_auth_id: 'partner-auth-id',
          title: 'Payout failed',
        }),
      })
    );
  });

  it('records paid Xendit invoices, finalizes the booking, and syncs the partner wallet snapshot', async () => {
    process.env.XENDIT_WEBHOOK_VERIFICATION_TOKEN = 'test-callback-token';

    vi.spyOn(bookingFinalizationModule, 'finalizeSuccessfulBookingPayment').mockResolvedValue();
    vi.spyOn(walletSnapshotsModule, 'recordPartnerWalletSnapshot').mockResolvedValue({
      snapshot: { id: 'snapshot-1', },
      pendingReserveMinor: 0n,
      derivedWalletBalanceMinor: 150000n,
    } as never);
    vi.spyOn(walletServerModule, 'ensureWalletRow').mockResolvedValue({
      id: 'wallet-1',
      user_id: 42n,
      balance_minor: 0n,
      currency: 'PHP',
      created_at: new Date('2026-03-13T09:00:00.000Z'),
      updated_at: new Date('2026-03-13T09:00:00.000Z'),
    });

    const getPartnerBalance = vi.fn().mockResolvedValue({
      availableMinor: 150000n,
      currency: 'PHP',
      fetchedAt: new Date('2026-03-13T11:05:00.000Z'),
      raw: {},
    });

    vi.spyOn(providerRegistryModule, 'getFinancialProvider').mockReturnValue({ getPartnerBalance, } as unknown as ReturnType<typeof providerRegistryModule.getFinancialProvider>);

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      payment_event: {
        create: vi.fn().mockResolvedValue({ id: 'payment-event-1', }),
        update: vi.fn().mockResolvedValue({ id: 'payment-event-1', }),
      },
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-1',
          space_id: 'space-1',
          space_name: 'Space One',
          area_id: 'area-1',
          area_name: 'Open Desk',
          booking_hours: 2n,
          price_minor: 150000n,
          currency: 'PHP',
          status: 'pending',
          created_at: new Date('2026-03-13T09:00:00.000Z'),
          user_auth_id: 'customer-auth-id',
          partner_auth_id: 'partner-auth-id',
          area_max_capacity: 10n,
          guest_count: 1,
          start_at: new Date('2026-03-14T09:00:00.000Z'),
          expires_at: new Date('2026-03-14T11:00:00.000Z'),
        }),
      },
      payment_transaction: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'payment-tx-1',
          raw_gateway_json: { partner_provider_account_id: 'provider-record-1', },
        }),
        upsert: vi.fn().mockResolvedValue({ id: 'payment-tx-1', }),
      },
      wallet_transaction: { create: vi.fn().mockResolvedValue({ id: 'wallet-tx-1', }), },
      partner_provider_account: {
        findUnique: vi.fn().mockResolvedValue({ provider_account_id: 'acct-remote-1', }),
        findFirst: vi.fn().mockResolvedValue({
          id: 'provider-record-1',
          partner_user_id: 42n,
        }),
      },
    } as unknown as typeof prismaModule.prisma);

    const response = await xenditWebhookHandler(
      makeRequest({
        id: 'inv-1',
        external_id: 'booking-1',
        status: 'PAID',
        amount: 1500,
        currency: 'PHP',
        invoice_url: 'https://checkout.xendit.test/inv-1',
        paid_at: '2026-03-13T11:00:00.000Z',
        metadata: {
          booking_id: 'booking-1',
          requires_host_approval: 'false',
          partner_internal_user_id: '42',
          partner_provider_account_id: 'provider-record-1',
        },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, });
    expect(bookingFinalizationModule.finalizeSuccessfulBookingPayment).toHaveBeenCalledWith(
      expect.objectContaining({ requiresHostApproval: false, })
    );
    expect(getPartnerBalance).toHaveBeenCalledWith('acct-remote-1');
    expect(walletSnapshotsModule.recordPartnerWalletSnapshot).toHaveBeenCalledWith({
      partnerUserId: 42n,
      partnerProviderAccountId: 'provider-record-1',
      availableBalanceMinor: 150000n,
      currency: 'PHP',
      fetchedAt: new Date('2026-03-13T11:05:00.000Z'),
    });
  });

  it('accepts paid invoice webhook payloads without invoice_url', async () => {
    process.env.XENDIT_WEBHOOK_VERIFICATION_TOKEN = 'test-callback-token';

    vi.spyOn(bookingFinalizationModule, 'finalizeSuccessfulBookingPayment').mockResolvedValue();
    vi.spyOn(walletSnapshotsModule, 'recordPartnerWalletSnapshot').mockResolvedValue({
      snapshot: { id: 'snapshot-1', },
      pendingReserveMinor: 0n,
      derivedWalletBalanceMinor: 150000n,
    } as never);
    vi.spyOn(walletServerModule, 'ensureWalletRow').mockResolvedValue({
      id: 'wallet-1',
      user_id: 42n,
      balance_minor: 0n,
      currency: 'PHP',
      created_at: new Date('2026-03-13T09:00:00.000Z'),
      updated_at: new Date('2026-03-13T09:00:00.000Z'),
    });

    const getPartnerBalance = vi.fn().mockResolvedValue({
      availableMinor: 150000n,
      currency: 'PHP',
      fetchedAt: new Date('2026-03-13T11:05:00.000Z'),
      raw: {},
    });

    vi.spyOn(providerRegistryModule, 'getFinancialProvider').mockReturnValue({ getPartnerBalance, } as unknown as ReturnType<typeof providerRegistryModule.getFinancialProvider>);

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      payment_event: {
        create: vi.fn().mockResolvedValue({ id: 'payment-event-1', }),
        update: vi.fn().mockResolvedValue({ id: 'payment-event-1', }),
      },
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-1',
          space_id: 'space-1',
          space_name: 'Space One',
          area_id: 'area-1',
          area_name: 'Open Desk',
          booking_hours: 2n,
          price_minor: 150000n,
          currency: 'PHP',
          status: 'pending',
          created_at: new Date('2026-03-13T09:00:00.000Z'),
          user_auth_id: 'customer-auth-id',
          partner_auth_id: 'partner-auth-id',
          area_max_capacity: 10n,
          guest_count: 1,
          start_at: new Date('2026-03-14T09:00:00.000Z'),
          expires_at: new Date('2026-03-14T11:00:00.000Z'),
        }),
      },
      payment_transaction: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'payment-tx-1',
          raw_gateway_json: { partner_provider_account_id: 'provider-record-1', },
        }),
        upsert: vi.fn().mockResolvedValue({ id: 'payment-tx-1', }),
      },
      wallet_transaction: { create: vi.fn().mockResolvedValue({ id: 'wallet-tx-1', }), },
      partner_provider_account: {
        findUnique: vi.fn().mockResolvedValue({ provider_account_id: 'acct-remote-1', }),
        findFirst: vi.fn().mockResolvedValue({
          id: 'provider-record-1',
          partner_user_id: 42n,
        }),
      },
    } as unknown as typeof prismaModule.prisma);

    const response = await xenditWebhookHandler(
      makeRequest({
        id: 'inv-1',
        external_id: 'booking-1',
        status: 'PAID',
        amount: 1500,
        currency: 'PHP',
        paid_at: '2026-03-13T11:00:00.000Z',
        metadata: {
          booking_id: 'booking-1',
          requires_host_approval: 'false',
          partner_internal_user_id: '42',
          partner_provider_account_id: 'provider-record-1',
        },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, });
    expect(bookingFinalizationModule.finalizeSuccessfulBookingPayment).toHaveBeenCalledWith(
      expect.objectContaining({ requiresHostApproval: false, })
    );
    expect(getPartnerBalance).toHaveBeenCalledWith('acct-remote-1');
    expect(walletSnapshotsModule.recordPartnerWalletSnapshot).toHaveBeenCalledWith({
      partnerUserId: 42n,
      partnerProviderAccountId: 'provider-record-1',
      availableBalanceMinor: 150000n,
      currency: 'PHP',
      fetchedAt: new Date('2026-03-13T11:05:00.000Z'),
    });
  });

  it('marks refunds as succeeded from Xendit callbacks and syncs the provider balance', async () => {
    process.env.XENDIT_WEBHOOK_VERIFICATION_TOKEN = 'test-callback-token';

    vi.spyOn(notificationsModule, 'notifyBookingEvent').mockResolvedValue();
    vi.spyOn(emailModule, 'sendRefundNotificationEmail').mockResolvedValue();
    vi.spyOn(supabaseAdminModule, 'getSupabaseAdminClient').mockReturnValue({ auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { email: 'customer@example.com', }, }, }), }, }, } as never);
    vi.spyOn(walletSnapshotsModule, 'recordPartnerWalletSnapshot').mockResolvedValue({
      snapshot: { id: 'snapshot-1', },
      pendingReserveMinor: 0n,
      derivedWalletBalanceMinor: 0n,
    } as never);

    const getPartnerBalance = vi.fn().mockResolvedValue({
      availableMinor: 0n,
      currency: 'PHP',
      fetchedAt: new Date('2026-03-13T12:00:00.000Z'),
      raw: {},
    });

    vi.spyOn(providerRegistryModule, 'getFinancialProvider').mockReturnValue({ getPartnerBalance, } as unknown as ReturnType<typeof providerRegistryModule.getFinancialProvider>);

    const tx = {
      wallet_transaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'refund-intent-1',
          type: 'refund',
          status: 'pending',
          amount_minor: 150000n,
          currency: 'PHP',
          booking_id: 'booking-1',
          metadata: {
            payment_transaction_id: 'payment-tx-1',
            remote_partner_provider_account_id: 'acct-remote-1',
          },
        }),
        update: vi.fn().mockResolvedValue({ id: 'refund-intent-1', }),
      },
      payment_transaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'payment-tx-1',
          amount_minor: 150000n,
          raw_gateway_json: {},
        }),
        update: vi.fn().mockResolvedValue({ id: 'payment-tx-1', }),
      },
    };

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      payment_event: {
        create: vi.fn().mockResolvedValue({ id: 'payment-event-2', }),
        update: vi.fn().mockResolvedValue({ id: 'payment-event-2', }),
      },
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx)
      ),
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-1',
          area_id: 'area-1',
          area_name: 'Open Desk',
          space_id: 'space-1',
          space_name: 'Space One',
          user_auth_id: 'customer-auth-id',
          partner_auth_id: 'partner-auth-id',
        }),
      },
      partner_provider_account: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'provider-record-1',
          partner_user_id: 42n,
        }),
      },
    } as unknown as typeof prismaModule.prisma);

    const response = await xenditWebhookHandler(
      makeRequest({
        refundSucceeded: {
          data: {
            id: 'rf-1',
            reference_id: 'refund-intent-1',
            payment_id: 'py-1',
            payment_request_id: 'pr-1',
            amount: 1500,
            currency: 'PHP',
            status: 'SUCCEEDED',
            failure_reason: null,
          },
        },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, });
    expect(tx.wallet_transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'refund-intent-1', },
        data: expect.objectContaining({ status: 'succeeded', }),
      })
    );
    expect(tx.payment_transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'payment-tx-1', },
        data: expect.objectContaining({ status: 'refunded', }),
      })
    );
    expect(getPartnerBalance).toHaveBeenCalledWith('acct-remote-1');
    expect(notificationsModule.notifyBookingEvent).toHaveBeenCalled();
    expect(emailModule.sendRefundNotificationEmail).toHaveBeenCalled();
  });
});
