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
import * as rateLimitModule from '@/lib/rate-limit';
import * as supabaseServerModule from '@/lib/supabase/server';
import * as walletServerModule from '@/lib/wallet-server';
import { POST as cancelBookingHandler } from '@/app/api/v1/bookings/[booking_id]/cancel/route';

describe('booking cancel api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('cancels paid Xendit bookings and submits a provider refund', async () => {
    vi.spyOn(rateLimitModule, 'enforceRateLimit').mockResolvedValue();
    vi.spyOn(notificationsModule, 'notifyBookingEvent').mockResolvedValue();
    vi.spyOn(supabaseServerModule, 'createSupabaseServerClient').mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'customer-auth-id', }, },
          error: null,
        }),
        admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { email: 'partner@example.com', }, }, }), },
      },
    } as never);

    vi.spyOn(walletServerModule, 'ensureWalletRow').mockResolvedValue({
      id: 'wallet-1',
      user_id: 21n,
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
      },
    } as never);

    const findFirstUser = vi.fn()
      .mockResolvedValueOnce({ role: 'customer', })
      .mockResolvedValueOnce({ user_id: 21n, });

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      user: {
        findFirst: findFirstUser,
        findMany: vi.fn().mockResolvedValue([]),
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
        findMany: vi.fn().mockResolvedValue([{
          booking_id: 'booking-1',
          status: 'succeeded',
          amount_minor: 150000n,
          currency_iso3: 'PHP',
          provider: 'xendit',
        }]),
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
          status: 'confirmed',
          created_at: new Date('2026-03-13T09:00:00.000Z'),
          user_auth_id: 'customer-auth-id',
          partner_auth_id: 'partner-auth-id',
          area_max_capacity: 10n,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1, }),
        findMany: vi.fn().mockResolvedValue([{
          id: 'booking-1',
          space_id: 'space-1',
          space_name: 'Space One',
          area_id: 'area-1',
          area_name: 'Open Desk',
          booking_hours: 2n,
          price_minor: 150000n,
          currency: 'PHP',
          status: 'cancelled',
          created_at: new Date('2026-03-13T09:00:00.000Z'),
          user_auth_id: 'customer-auth-id',
          partner_auth_id: 'partner-auth-id',
          area_max_capacity: 10n,
        }]),
      },
      wallet_transaction: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'refund-intent-1', }),
        update: vi.fn().mockResolvedValue({ id: 'refund-intent-1', }),
        findMany: vi.fn().mockResolvedValue([{
          booking_id: 'booking-1',
          status: 'pending',
          amount_minor: 150000n,
          currency: 'PHP',
          created_at: new Date('2026-03-13T09:01:00.000Z'),
          updated_at: new Date('2026-03-13T09:01:00.000Z'),
          processed_at: null,
        }]),
      },
      app_notification: { create: vi.fn().mockResolvedValue({ id: 'notif-1', }), },
    } as unknown as typeof prismaModule.prisma);

    const response = await cancelBookingHandler(
      {} as NextRequest,
      { params: Promise.resolve({ booking_id: 'booking-1', }), }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ message: 'Booking cancelled. Refund processing has started.', })
    );
    expect(submitXenditRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        walletTransactionId: 'refund-intent-1',
        bookingId: 'booking-1',
        partnerUserId: 21n,
      })
    );
  });
});
