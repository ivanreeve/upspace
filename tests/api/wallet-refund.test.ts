import type { NextRequest } from 'next/server';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import * as xenditRefundsModule from '@/lib/financial/xendit-refunds';
import * as notificationsModule from '@/lib/notifications/booking';
import * as prismaModule from '@/lib/prisma';
import * as walletServerModule from '@/lib/wallet-server';
import { POST as walletRefundHandler } from '@/app/api/v1/wallet/refund/route';

const makeRequest = (payload: Record<string, unknown>) =>
  ({ json: async () => payload, } as NextRequest);

describe('wallet refund api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('submits Xendit-backed refunds through the provider helper', async () => {
    const notifyCustomerRefundUpdate = vi
      .spyOn(notificationsModule, 'notifyCustomerRefundUpdate')
      .mockResolvedValue();
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
      balance_minor: 150000n,
      currency: 'PHP',
      created_at: new Date('2026-03-13T09:00:00.000Z'),
      updated_at: new Date('2026-03-13T09:00:00.000Z'),
    });

    const submitXenditRefund = vi.spyOn(xenditRefundsModule, 'submitXenditRefund').mockResolvedValue({
      context: {
        localPartnerProviderAccountId: 'provider-local-1',
        remotePartnerProviderAccountId: 'acct-remote-1',
        paymentId: 'py-1',
        paymentRequestId: 'pr-1',
      },
      providerRefund: {
        refundId: 'rf-1',
        referenceId: 'refund-intent-1',
        paymentId: 'py-1',
        paymentRequestId: 'pr-1',
        amountMinor: 150000n,
        currency: 'PHP',
        status: 'PENDING',
        failureReason: null,
        raw: {},
      },
      transaction: {
        id: 'refund-intent-1',
        type: 'refund',
        status: 'pending',
        amount_minor: 150000n,
        currency: 'PHP',
        external_reference: 'rf-1',
      },
    } as never);

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      $transaction: vi.fn(async (callback) =>
        callback({
          wallet_transaction: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: 'refund-intent-1',
              type: 'refund',
              status: 'pending',
              amount_minor: 150000n,
              currency: 'PHP',
              external_reference: null,
            }),
          },
        })
      ),
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-1',
          partner_auth_id: 'partner-auth-id',
          price_minor: 150000n,
          currency: 'PHP',
          space_id: 'space-1',
          space_name: 'Space One',
          area_id: 'area-1',
          area_name: 'Open Desk',
          user_auth_id: 'customer-auth-id',
        }),
      },
      payment_transaction: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'payment-tx-1',
          provider: 'xendit',
          provider_object_id: 'inv-1',
          amount_minor: 150000n,
          currency_iso3: 'PHP',
          raw_gateway_json: {
            payment_id: 'py-1',
            partner_provider_account_id: 'provider-local-1',
          },
        }),
      },
      wallet_transaction: {},
    } as unknown as typeof prismaModule.prisma);

    const response = await walletRefundHandler(
      makeRequest({
        bookingId: '11111111-1111-4111-8111-111111111111',
        paymentId: 'py-1',
        amount: 1500,
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      transaction: {
        id: 'refund-intent-1',
        type: 'refund',
        status: 'pending',
        amountMinor: '150000',
        currency: 'PHP',
      },
      refundId: 'rf-1',
    });
    expect(submitXenditRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        walletTransactionId: 'refund-intent-1',
        partnerUserId: 42n,
        bookingId: 'booking-1',
      })
    );
    expect(notifyCustomerRefundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'booking-1', }),
      expect.objectContaining({
        state: 'processing',
        amountMinor: '150000',
        currency: 'PHP',
      })
    );
  });
});
