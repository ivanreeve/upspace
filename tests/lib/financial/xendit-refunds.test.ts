import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

const { prismaMock, } = vi.hoisted(() => ({
  prismaMock: {
  partner_provider_account: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  wallet_transaction: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock, }));
vi.mock('@/lib/providers/provider-registry', () => ({ getFinancialProvider: vi.fn(), }));
vi.mock('@/lib/financial/wallet-snapshots', () => ({ recordPartnerWalletSnapshot: vi.fn(), }));

import { submitXenditRefund } from '@/lib/financial/xendit-refunds';

describe('submitXenditRefund', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks the refund intent failed when refund context validation fails', async () => {
    prismaMock.partner_provider_account.findFirst.mockResolvedValue(null);
    prismaMock.wallet_transaction.findUnique.mockResolvedValue({ metadata: null, });
    prismaMock.wallet_transaction.update.mockResolvedValue({
      id: 'refund-intent-1',
      status: 'failed',
    });

    await expect(
      submitXenditRefund({
        walletTransactionId: 'refund-intent-1',
        partnerUserId: 42n,
        bookingId: 'booking-1',
        paymentTransaction: {
          id: 'payment-tx-1',
          provider_object_id: 'py-1',
          amount_minor: 150000n,
          currency_iso3: 'PHP',
          raw_gateway_json: null,
        },
        amountMinor: 150000n,
        reason: 'other',
        requestedByAuthUserId: 'partner-auth-id',
        providedPaymentReference: 'py-1',
      })
    ).rejects.toThrow('The partner payout account is not ready for Xendit refunds.');

    expect(prismaMock.wallet_transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'refund-intent-1', },
        data: expect.objectContaining({
          status: 'failed',
          metadata: expect.objectContaining({
            provider: 'xendit',
            payment_transaction_id: 'payment-tx-1',
            payment_provider_object_id: 'py-1',
            failure_reason: 'The partner payout account is not ready for Xendit refunds.',
          }),
        }),
      })
    );
  });
});
