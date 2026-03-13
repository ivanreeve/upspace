import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import * as prismaModule from '@/lib/prisma';
import { handleWalletEvent } from '@/app/api/paymongo/webhook/handlers';

describe('PayMongo wallet webhook sync', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records a succeeded charge and increments the wallet balance', async () => {
    const walletCreate = vi.fn().mockResolvedValue({});
    const walletUpdate = vi.fn().mockResolvedValue({});

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      wallet: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'wallet-1',
          user_id: 10n,
          currency: 'PHP',
        }),
        update: walletUpdate,
      },
      wallet_transaction: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: walletCreate,
      },
      $transaction: vi.fn().mockImplementation(async (callback: (tx: {
        wallet_transaction: { create: typeof walletCreate };
        wallet: { update: typeof walletUpdate };
      }) => Promise<unknown>) =>
        callback({
          wallet_transaction: { create: walletCreate },
          wallet: { update: walletUpdate },
        })
      ),
    } as unknown as typeof prismaModule.prisma);

    const response = await handleWalletEvent({
      type: 'wallet.transaction.charge.succeeded',
      livemode: false,
      data: {
        object: {
          id: 'evt_charge_1',
          wallet_id: 'ext-wallet',
          type: 'charge',
          status: 'succeeded',
          amount_minor: 2_500,
          net_amount_minor: 2_500,
          currency: 'PHP',
          description: 'Booking charge',
          external_reference: null,
          metadata: {
            partner_internal_user_id: '10',
          },
          booking_id: '11111111-1111-4111-8111-111111111111',
          created_at: 1_742_000_000,
        },
      },
    });

    expect(response.status).toBe(200);
    expect(walletCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'charge',
        status: 'succeeded',
        amount_minor: 2_500n,
      }),
    }));
    expect(walletUpdate).toHaveBeenCalledWith({
      where: { id: 'wallet-1', },
      data: {
        balance_minor: { increment: 2_500n, },
        updated_at: expect.any(Date),
      },
    });
  });

  it('ignores wallet events without internal user metadata', async () => {
    const walletFindUnique = vi.fn();

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      wallet: {
        findUnique: walletFindUnique,
      },
      wallet_transaction: {
        findFirst: vi.fn(),
      },
    } as unknown as typeof prismaModule.prisma);

    const response = await handleWalletEvent({
      type: 'wallet.transaction.charge.succeeded',
      livemode: false,
      data: {
        object: {
          id: 'evt_charge_2',
          wallet_id: 'ext-wallet',
          type: 'charge',
          status: 'succeeded',
          amount_minor: 2_500,
          net_amount_minor: 2_500,
          currency: 'PHP',
          description: 'Booking charge',
          external_reference: null,
          metadata: null,
          booking_id: null,
          created_at: 1_742_000_000,
        },
      },
    });

    expect(response.status).toBe(200);
    expect(walletFindUnique).not.toHaveBeenCalled();
  });

  it('does not double-apply balance changes for an already-succeeded event', async () => {
    const walletUpdate = vi.fn();

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      wallet: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'wallet-1',
          user_id: 10n,
          currency: 'PHP',
        }),
        update: walletUpdate,
      },
      wallet_transaction: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'txn-1',
          status: 'succeeded',
          wallet_id: 'wallet-1',
        }),
        update: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    } as unknown as typeof prismaModule.prisma);

    const response = await handleWalletEvent({
      type: 'wallet.transaction.refund.failed',
      livemode: false,
      data: {
        object: {
          id: 'evt_refund_1',
          wallet_id: 'ext-wallet',
          type: 'refund',
          status: 'failed',
          amount_minor: 500,
          net_amount_minor: 500,
          currency: 'PHP',
          description: 'Refund failed',
          external_reference: null,
          metadata: {
            partner_internal_user_id: '10',
          },
          booking_id: '11111111-1111-4111-8111-111111111111',
          created_at: 1_742_000_000,
        },
      },
    });

    expect(response.status).toBe(200);
    expect(walletUpdate).not.toHaveBeenCalled();
  });
});
