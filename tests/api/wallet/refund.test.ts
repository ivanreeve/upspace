import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import * as paymongoModule from '@/lib/paymongo';
import * as paymongoPaymentEvents from '@/lib/paymongo-payment-events';
import * as prismaModule from '@/lib/prisma';
import * as walletServer from '@/lib/wallet-server';
import { POST as refundHandler } from '@/app/api/v1/wallet/refund/route';
import { MockNextRequest } from '../../utils/mock-next-server';

const bookingId = '11111111-1111-4111-8111-111111111111';

describe('wallet refund api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects refund requests for bookings the partner does not own', async () => {
    vi.spyOn(walletServer, 'resolveAuthenticatedUserForWallet').mockResolvedValue({
      response: null,
      dbUser: {
        user_id: 3n,
        auth_user_id: 'partner-auth-id',
        role: 'partner',
      },
    });

    vi.spyOn(walletServer, 'ensureWalletRow').mockResolvedValue({
      id: 'wallet-3',
      user_id: 3n,
      balance_minor: 40_000n,
      currency: 'PHP',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
    } as Awaited<ReturnType<typeof walletServer.ensureWalletRow>>);

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: bookingId,
          partner_auth_id: 'different-partner',
          price_minor: 1_500n,
        }),
      },
    } as unknown as typeof prismaModule.prisma);

    const response = await refundHandler(
      new MockNextRequest('http://localhost/api/v1/wallet/refund', {
        method: 'POST',
        body: JSON.stringify({
          bookingId,
          paymentId: 'pay_1',
          amount: 15,
        }),
        headers: { 'content-type': 'application/json', },
      })
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      message: 'Booking not found for this partner.',
    });
  });

  it('returns the existing refund when a duplicate request is submitted', async () => {
    vi.spyOn(walletServer, 'resolveAuthenticatedUserForWallet').mockResolvedValue({
      response: null,
      dbUser: {
        user_id: 3n,
        auth_user_id: 'partner-auth-id',
        role: 'partner',
      },
    });

    vi.spyOn(walletServer, 'ensureWalletRow').mockResolvedValue({
      id: 'wallet-3',
      user_id: 3n,
      balance_minor: 40_000n,
      currency: 'PHP',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
    } as Awaited<ReturnType<typeof walletServer.ensureWalletRow>>);

    vi.spyOn(paymongoPaymentEvents, 'isPaymongoPaymentLinkedToBooking').mockResolvedValue(true);

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: bookingId,
          partner_auth_id: 'partner-auth-id',
          price_minor: 1_500n,
        }),
      },
      wallet_transaction: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'refund-1',
          type: 'refund',
          status: 'pending',
          amount_minor: 1_500n,
          currency: 'PHP',
          external_reference: 're_1',
        }),
      },
    } as unknown as typeof prismaModule.prisma);

    const response = await refundHandler(
      new MockNextRequest('http://localhost/api/v1/wallet/refund', {
        method: 'POST',
        body: JSON.stringify({
          bookingId,
          paymentId: 'pay_1',
          amount: 15,
        }),
        headers: { 'content-type': 'application/json', },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      transaction: {
        id: 'refund-1',
        type: 'refund',
        status: 'pending',
        amountMinor: '1500',
        currency: 'PHP',
      },
      refundId: 're_1',
    });
  });

  it('creates and settles a refund, then decrements the wallet balance', async () => {
    vi.spyOn(walletServer, 'resolveAuthenticatedUserForWallet').mockResolvedValue({
      response: null,
      dbUser: {
        user_id: 3n,
        auth_user_id: 'partner-auth-id',
        role: 'partner',
      },
    });

    vi.spyOn(walletServer, 'ensureWalletRow').mockResolvedValue({
      id: 'wallet-3',
      user_id: 3n,
      balance_minor: 40_000n,
      currency: 'PHP',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
    } as Awaited<ReturnType<typeof walletServer.ensureWalletRow>>);

    vi.spyOn(paymongoPaymentEvents, 'isPaymongoPaymentLinkedToBooking').mockResolvedValue(true);
    vi.spyOn(paymongoModule, 'createPaymongoRefund').mockResolvedValue({
      data: {
        id: 're_success',
        attributes: {
          status: 'succeeded',
          amount: 1_500,
          currency: 'PHP',
          reason: 'other',
          payment_id: 'pay_1',
          livemode: false,
          created_at: 1_742_000_000,
          updated_at: 1_742_000_000,
        },
      },
    });

    const walletTransactionCreate = vi.fn().mockResolvedValue({ id: 'refund-intent', });
    const walletTransactionUpdate = vi.fn().mockResolvedValue({
      id: 'refund-intent',
      type: 'refund',
      status: 'succeeded',
      amount_minor: 1_500n,
      currency: 'PHP',
    });
    const walletUpdate = vi.fn().mockResolvedValue({});

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: bookingId,
          partner_auth_id: 'partner-auth-id',
          price_minor: 1_500n,
        }),
      },
      wallet_transaction: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: walletTransactionCreate,
        update: vi.fn(),
      },
      payment_transaction: {
        findFirst: vi.fn().mockResolvedValue({
          amount_minor: 1_500n,
          currency_iso3: 'PHP',
        }),
      },
      wallet: {
        update: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation(async (callback: (tx: {
        wallet_transaction: { update: typeof walletTransactionUpdate };
        wallet: { update: typeof walletUpdate };
      }) => Promise<unknown>) =>
        callback({
          wallet_transaction: { update: walletTransactionUpdate },
          wallet: { update: walletUpdate },
        })
      ),
    } as unknown as typeof prismaModule.prisma);

    const response = await refundHandler(
      new MockNextRequest('http://localhost/api/v1/wallet/refund', {
        method: 'POST',
        body: JSON.stringify({
          bookingId,
          paymentId: 'pay_1',
          amount: 15,
          reason: 'other',
          notes: 'Customer requested refund',
        }),
        headers: { 'content-type': 'application/json', },
      })
    );

    expect(response.status).toBe(200);
    expect(walletTransactionCreate).toHaveBeenCalled();
    expect(walletUpdate).toHaveBeenCalledWith({
      where: { id: 'wallet-3', },
      data: {
        balance_minor: { decrement: 1_500n, },
        updated_at: expect.any(Date),
      },
    });
    await expect(response.json()).resolves.toEqual({
      transaction: {
        id: 'refund-intent',
        type: 'refund',
        status: 'succeeded',
        amountMinor: '1500',
        currency: 'PHP',
      },
      refundId: 're_success',
    });
  });
});
