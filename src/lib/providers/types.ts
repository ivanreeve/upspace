export type ProviderName = 'xendit';

export type ProviderAccountType = 'owned' | 'managed';

export type ProviderAccountStatus =
  | 'creating'
  | 'invited'
  | 'registered'
  | 'awaiting_docs'
  | 'pending_verification'
  | 'live'
  | 'suspended'
  | 'error';

export type CreatePartnerProviderAccountInput = {
  partnerUserId: bigint;
  partnerAuthUserId: string;
  email: string;
  displayName: string;
};

export type PartnerProviderAccountResult = {
  provider: ProviderName;
  providerAccountId: string;
  accountType: ProviderAccountType;
  status: Exclude<ProviderAccountStatus, 'creating' | 'error'>;
  currency: string;
  raw: Record<string, unknown>;
};

export type PartnerProviderAccountStatusResult = {
  providerAccountId: string;
  accountType: ProviderAccountType;
  status: Exclude<ProviderAccountStatus, 'creating' | 'error'>;
  currency: string;
  raw: Record<string, unknown>;
};

export type PartnerProviderBalanceResult = {
  availableMinor: bigint;
  currency: string;
  fetchedAt: Date;
  raw: Record<string, unknown>;
};

export type CreateProviderBookingPaymentInput = {
  partnerProviderAccountId: string;
  referenceId: string;
  amountMinor: bigint;
  currency: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | null;
  metadata: Record<string, string>;
};

export type ProviderBookingPaymentResult = {
  paymentId: string;
  paymentRequestId: string | null;
  referenceId: string;
  amountMinor: bigint;
  currency: string;
  checkoutUrl: string;
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
  expiresAt: string | null;
  isLive: boolean;
  raw: Record<string, unknown>;
};

export type ProviderPayoutChannelCategory = 'BANK' | 'EWALLET' | 'OTC';

export type ProviderPayoutChannel = {
  channelCode: string;
  channelName: string;
  category: ProviderPayoutChannelCategory;
  currency: string;
  country: string | null;
  minimumAmountMinor: bigint | null;
  maximumAmountMinor: bigint | null;
  raw: Record<string, unknown>;
};

export type ProviderPayoutStatus =
  | 'ACCEPTED'
  | 'REQUESTED'
  | 'FAILED'
  | 'SUCCEEDED'
  | 'CANCELLED'
  | 'REVERSED';

export type ProviderPaymentResult = {
  paymentId: string;
  paymentRequestId: string;
  status: string;
  currency: string;
  amountMinor: bigint | null;
  raw: Record<string, unknown>;
};

export type ProviderRefundStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export type CreateProviderRefundInput = {
  partnerProviderAccountId: string;
  referenceId: string;
  paymentRequestId: string;
  amountMinor?: bigint;
  currency?: string;
  reason: 'DUPLICATE' | 'FRAUDULENT' | 'REQUESTED_BY_CUSTOMER' | 'CANCELLATION' | 'OTHERS';
  metadata?: Record<string, string>;
};

export type ProviderRefundResult = {
  refundId: string;
  referenceId: string;
  paymentId: string | null;
  paymentRequestId: string;
  amountMinor: bigint | null;
  currency: string | null;
  status: ProviderRefundStatus;
  failureReason: string | null;
  raw: Record<string, unknown>;
};

export type CreateProviderPayoutInput = {
  partnerProviderAccountId: string;
  referenceId: string;
  amountMinor: bigint;
  currency: string;
  description: string;
  destination: {
    channelCode: string;
    accountNumber: string;
    accountHolderName: string;
  };
  metadata?: Record<string, string>;
};

export type ProviderPayoutResult = {
  payoutId: string;
  referenceId: string;
  amountMinor: bigint;
  currency: string;
  channelCode: string;
  status: ProviderPayoutStatus;
  estimatedArrivalTime: string | null;
  failureCode: string | null;
  raw: Record<string, unknown>;
};

export interface FinancialProvider {
  readonly name: ProviderName;
  createPartnerAccount(
    input: CreatePartnerProviderAccountInput
  ): Promise<PartnerProviderAccountResult>;
  getPartnerAccountStatus(accountId: string): Promise<PartnerProviderAccountStatusResult>;
  getPartnerBalance(accountId: string): Promise<PartnerProviderBalanceResult>;
  createBookingPayment(
    input: CreateProviderBookingPaymentInput
  ): Promise<ProviderBookingPaymentResult>;
  getPayment(
    paymentId: string,
    partnerProviderAccountId: string
  ): Promise<ProviderPaymentResult>;
  listPayoutChannels(currency: string): Promise<ProviderPayoutChannel[]>;
  createRefund(input: CreateProviderRefundInput): Promise<ProviderRefundResult>;
  createPayout(input: CreateProviderPayoutInput): Promise<ProviderPayoutResult>;
  getPayout(payoutId: string, partnerProviderAccountId: string): Promise<ProviderPayoutResult>;
  getPayoutsByReferenceId(
    referenceId: string,
    partnerProviderAccountId: string
  ): Promise<ProviderPayoutResult[]>;
}
