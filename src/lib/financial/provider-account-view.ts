export type ProviderAccountViewStatus =
  | 'creating'
  | 'invited'
  | 'registered'
  | 'awaiting_docs'
  | 'pending_verification'
  | 'live'
  | 'suspended'
  | 'error'
  | null;

export type ProviderAccountSetupState =
  | 'not_enabled'
  | 'creating'
  | 'ready'
  | 'action_required'
  | 'error';

export type PartnerProviderAccountView = {
  configured: boolean;
  provider: 'xendit';
  providerAccountReference: string | null;
  accountType: 'owned' | 'managed' | null;
  status: ProviderAccountViewStatus;
  setupState: ProviderAccountSetupState;
  statusLabel: string;
  statusMessage: string;
  currency: string | null;
  availableBalanceMinor: string | null;
  lastSyncedAt: string | null;
  syncWarning: string | null;
};

export function maskProviderAccountReference(value: string | null) {
  if (!value) {
    return null;
  }

  if (value.length <= 8) {
    return value;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
