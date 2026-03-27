'use client';

import Link from 'next/link';
import {
  useCallback,
  useMemo,
  useReducer,
  useState,
  type ComponentType,
  type ReactNode
} from 'react';
import {
  FiActivity,
  FiArrowDownLeft,
  FiArrowUpRight,
  FiBarChart2,
  FiClock,
  FiInbox,
  FiLoader,
  FiPieChart,
  FiRotateCcw,
  FiSend,
  FiTrendingUp
} from 'react-icons/fi';
import { FaPesoSign } from 'react-icons/fa6';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  type WalletFilters,
  type WalletSnapshot,
  type WalletStats,
  type WalletTransactionRecord,
  type WalletTransactionStatus,
  type WalletTransactionType,
  useWallet,
  useWalletTransactions
} from '@/hooks/use-wallet';
import { usePayoutChannelsQuery } from '@/hooks/api/usePayoutChannels';
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';
import { useUserProfile } from '@/hooks/use-user-profile';
import type { PartnerProviderAccountView } from '@/lib/financial/provider-account-view';
import { formatCurrencyMinor, formatMinorToDisplay, parseDisplayAmountToMinor } from '@/lib/wallet';

const TRANSACTION_TYPE_LABELS: Record<WalletTransactionType, string> = {
  cash_in: 'Wallet credit',
  charge: 'Booking charge',
  refund: 'Refund',
  payout: 'Payout request',
};

const TRANSACTION_TYPE_DESCRIPTIONS: Record<WalletTransactionType, string> = {
  cash_in: 'A manual or provider-side wallet credit.',
  charge: 'Earnings credited from a customer booking payment.',
  refund: 'Funds returned to the customer for a booking.',
  payout: 'Your request to withdraw available wallet earnings.',
};

const TRANSACTION_TYPE_ICONS: Record<WalletTransactionType, ComponentType<{ className?: string }>> = {
  cash_in: FiArrowDownLeft,
  charge: FiArrowUpRight,
  refund: FiRotateCcw,
  payout: FiSend,
};

const STATUS_BADGE_VARIANTS: Record<WalletTransactionStatus, 'success' | 'secondary' | 'destructive'> = {
  succeeded: 'success',
  pending: 'secondary',
  failed: 'destructive',
};

const STATUS_LABELS: Record<WalletTransactionStatus, string> = {
  succeeded: 'Succeeded',
  pending: 'Pending',
  failed: 'Failed',
};

const STATUS_BAR_STYLES: Record<WalletTransactionStatus, string> = {
  succeeded: 'bg-emerald-500',
  pending: 'bg-amber-500',
  failed: 'bg-rose-500',
};

const LOCALE_OPTIONS = {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
} as const;

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('en-PH', LOCALE_OPTIONS);

const maskDestinationAccountNumber = (value: string) => {
  const normalized = value.trim();
  if (normalized.length <= 4) {
    return normalized;
  }

  return `${'*'.repeat(Math.max(0, normalized.length - 4))}${normalized.slice(-4)}`;
};

const getPayoutStatusSummary = (transaction: WalletTransactionRecord) => {
  if (transaction.type !== 'payout') {
    return null;
  }

  const workflowStage =
    transaction.metadata &&
    typeof transaction.metadata === 'object' &&
    'workflow_stage' in transaction.metadata &&
    typeof transaction.metadata.workflow_stage === 'string'
      ? transaction.metadata.workflow_stage
      : null;
  const payoutProviderStatus =
    transaction.metadata &&
    typeof transaction.metadata === 'object' &&
    'payout_provider' in transaction.metadata &&
    transaction.metadata.payout_provider &&
    typeof transaction.metadata.payout_provider === 'object' &&
    'status' in transaction.metadata.payout_provider &&
    typeof transaction.metadata.payout_provider.status === 'string'
      ? transaction.metadata.payout_provider.status
      : null;

  if (transaction.status === 'pending') {
    if (workflowStage === 'submitted_to_provider' || workflowStage === 'submitting_to_provider') {
      return payoutProviderStatus
        ? `Submitted to Xendit. Provider status: ${payoutProviderStatus}.`
        : 'Submitted to Xendit and awaiting the provider outcome.';
    }

    return 'Awaiting admin review.';
  }

  if (!transaction.processedAt) {
    return transaction.status === 'succeeded'
      ? 'Completed.'
      : 'Rejected and released back to your wallet.';
  }

  return transaction.status === 'succeeded'
    ? `Completed ${formatDateTime(transaction.processedAt)}`
    : `Rejected ${formatDateTime(transaction.processedAt)} and released back to your wallet.`;
};

type MonthSeriesItem = {
  key: string;
  label: string;
  valueMinor: number;
  value: string;
  positive: boolean;
};

type WalletAnalytics = {
  total: number;
  typeCounts: Record<WalletTransactionType, number>;
  statusCounts: Record<WalletTransactionStatus, number>;
  successfulRate: number;
  topType: string;
  averageCharge: string;
  monthSeries: MonthSeriesItem[];
  maxMonthMagnitude: number;
};

type WalletQuickNote = {
  badge: string;
  value: string;
  description: string;
  accentClassName: string;
};

const EMPTY_ANALYTICS: WalletAnalytics = {
  total: 0,
  typeCounts: {
    cash_in: 0,
    charge: 0,
    refund: 0,
    payout: 0,
  },
  statusCounts: {
    succeeded: 0,
    pending: 0,
    failed: 0,
  },
  successfulRate: 0,
  topType: 'No activity yet',
  averageCharge: '₱0.00',
  monthSeries: [],
  maxMonthMagnitude: 1,
};

type WalletFiltersAction =
  | {
    type: 'SET_TYPE';
    payload: string;
  }
  | {
    type: 'SET_STATUS';
    payload: string;
  };

function walletFiltersReducer(state: WalletFilters, action: WalletFiltersAction): WalletFilters {
  switch (action.type) {
    case 'SET_TYPE': {
      const nextType = action.payload === 'all'
        ? undefined
        : action.payload as WalletTransactionType;

      if (state.type === nextType) {
        return state;
      }

      return {
        ...state,
        type: nextType,
      };
    }
    case 'SET_STATUS': {
      const nextStatus = action.payload === 'all'
        ? undefined
        : action.payload as WalletTransactionStatus;

      if (state.status === nextStatus) {
        return state;
      }

      return {
        ...state,
        status: nextStatus,
      };
    }
    default:
      return state;
  }
}

function useWalletAnalytics(
  transactions: WalletTransactionRecord[],
  wallet: WalletSnapshot | undefined,
  stats: WalletStats | undefined
): WalletAnalytics {
  return useMemo(() => {
    if (!wallet || !stats) {
      return EMPTY_ANALYTICS;
    }

    const total = transactions.length;
    const currency = wallet.currency ?? 'PHP';
    const typeCounts: Record<WalletTransactionType, number> = {
      cash_in: 0,
      charge: 0,
      refund: 0,
      payout: 0,
    };
    const statusCounts: Record<WalletTransactionStatus, number> = {
      succeeded: 0,
      pending: 0,
      failed: 0,
    };
    const chargeAmountsMinor: number[] = [];
    const monthTotals = new Map<string, number>();
    const now = new Date();
    const monthKeys: string[] = [];

    for (let index = 5; index >= 0; index -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthKeys.push(key);
      monthTotals.set(key, 0);
    }

    for (const transaction of transactions) {
      typeCounts[transaction.type] += 1;
      statusCounts[transaction.status] += 1;

      const amountMinor = Number(transaction.amountMinor || 0);
      if (transaction.type === 'charge') {
        chargeAmountsMinor.push(amountMinor);
      }

      const timestamp = new Date(transaction.createdAt);
      const monthKey = `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}`;
      if (!monthTotals.has(monthKey)) continue;

      const signedMinor = transaction.type === 'charge' || transaction.type === 'cash_in'
        ? amountMinor
        : -amountMinor;
      monthTotals.set(monthKey, (monthTotals.get(monthKey) ?? 0) + signedMinor);
    }

    const monthSeries = monthKeys.map((key) => {
      const [yearString, monthString] = key.split('-');
      const monthDate = new Date(Number(yearString), Number(monthString) - 1, 1);
      const valueMinor = monthTotals.get(key) ?? 0;

      return {
        key,
        label: monthDate.toLocaleString('en-PH', { month: 'short', }),
        valueMinor,
        value: formatCurrencyMinor(String(Math.abs(valueMinor)), currency),
        positive: valueMinor >= 0,
      };
    });

    const maxMonthMagnitude = Math.max(
      1,
      ...monthSeries.map((item) => Math.abs(item.valueMinor))
    );

    const successfulRate = total > 0
      ? Math.round((statusCounts.succeeded / total) * 100)
      : 0;
    const topType = (Object.entries(typeCounts) as Array<[WalletTransactionType, number]>)
      .sort((a, b) => b[1] - a[1])[0];
    const averageChargeMinor = chargeAmountsMinor.length > 0
      ? Math.round(chargeAmountsMinor.reduce((sum, value) => sum + value, 0) / chargeAmountsMinor.length)
      : 0;

    return {
      total,
      typeCounts,
      statusCounts,
      successfulRate,
      topType: topType ? TRANSACTION_TYPE_LABELS[topType[0]] : 'No activity yet',
      averageCharge: formatCurrencyMinor(String(averageChargeMinor), currency),
      monthSeries,
      maxMonthMagnitude,
    };
  }, [transactions, wallet, stats]);
}

function WalletPageFrame({ children, }: { children: ReactNode }) {
  return (
    <div className="w-full px-4 pb-8 sm:px-6 lg:px-10">
      <section className="space-y-6 py-8 md:space-y-8 md:py-12">
        { children }
      </section>
    </div>
  );
}

function TransactionArticle({ transaction, }: { transaction: WalletTransactionRecord }) {
  const Icon = TRANSACTION_TYPE_ICONS[transaction.type] ?? FiArrowUpRight;
  const label = TRANSACTION_TYPE_LABELS[transaction.type] ?? 'Transaction';
  const description = TRANSACTION_TYPE_DESCRIPTIONS[transaction.type] ?? null;
  const badgeVariant = STATUS_BADGE_VARIANTS[transaction.status] ?? 'secondary';
  const amountLabel = formatCurrencyMinor(transaction.amountMinor, transaction.currency);
  const isCredit = transaction.type === 'charge' || transaction.type === 'cash_in';
  const payoutStatusSummary = getPayoutStatusSummary(transaction);

  return (
    <article className="group relative flex items-center justify-between gap-4 rounded-md border border-border/60 bg-background/95 px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-border hover:bg-accent/20 hover:shadow-md dark:bg-card">
      <div className="min-w-0 flex items-center gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/40 text-muted-foreground transition-colors group-hover:text-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex flex-col gap-0.5">
          <p className="truncate text-sm font-semibold text-foreground">
            { label }
          </p>
          { description && (
            <p className="truncate text-xs text-muted-foreground">
              { description }
            </p>
          ) }
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{ formatDateTime(transaction.createdAt) }</span>
            { transaction.bookingId && (
              <>
                <span>•</span>
                <span className="font-mono">{ transaction.bookingId.slice(0, 8) }</span>
              </>
            ) }
          </div>
          { payoutStatusSummary && (
            <p className="truncate text-xs text-muted-foreground">
              { payoutStatusSummary }
            </p>
          ) }
          { transaction.type === 'payout' && transaction.resolutionNote && (
            <p className="truncate text-xs text-muted-foreground">
              Note: { transaction.resolutionNote }
            </p>
          ) }
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <p className={ `text-sm font-bold tracking-tight ${isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}` }>
          { isCredit ? '+' : '-' }{ amountLabel }
        </p>
        <Badge
          variant={ badgeVariant }
          className="h-5 px-1.5 text-[10px] font-semibold uppercase tracking-wide"
        >
          { STATUS_LABELS[transaction.status] }
        </Badge>
      </div>
    </article>
  );
}

function WalletPageSkeleton() {
  const summaryCardSkeletonIds = ['summary-balance', 'summary-hold', 'summary-withdrawable'] as const;
  const transactionSkeletonIds = ['transaction-1', 'transaction-2', 'transaction-3', 'transaction-4'] as const;

  return (
    <WalletPageFrame>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24 rounded-md" />
        <Skeleton className="h-8 w-32 rounded-md" />
        <Skeleton className="h-4 w-80 rounded-md" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        { summaryCardSkeletonIds.map((skeletonId) => (
          <Card key={ skeletonId } className="rounded-md">
            <CardHeader className="space-y-2 px-5 py-2.5">
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-8 w-32 rounded-md" />
              <Skeleton className="h-3 w-40 rounded-md" />
            </CardHeader>
          </Card>
        )) }
      </div>

      <Card className="rounded-md">
        <CardHeader className="px-6 py-2.5">
          <Skeleton className="h-6 w-32 rounded-md" />
        </CardHeader>
        <CardContent className="space-y-3 p-6 pt-0">
          { transactionSkeletonIds.map((skeletonId) => (
            <Skeleton key={ skeletonId } className="h-20 rounded-md" />
          )) }
        </CardContent>
      </Card>
    </WalletPageFrame>
  );
}

function PartnerOnlyState() {
  return (
    <WalletPageFrame>
      <Card className="rounded-md border-dashed border-amber-300/60 bg-background/90 shadow-sm">
        <CardHeader className="p-8 text-center">
          <CardTitle className="text-xl">Wallet unavailable</CardTitle>
          <CardDescription className="mx-auto max-w-md pt-2 text-balance">
            This account does not have access to the earnings wallet view. Sign in with your partner account to review booking earnings, refunds, and payout requests.
          </CardDescription>
          <div className="pt-6">
            <Button asChild>
              <Link href="/marketplace">Return to marketplace</Link>
            </Button>
          </div>
        </CardHeader>
      </Card>
    </WalletPageFrame>
  );
}

function WalletErrorState({ onRetry, }: { onRetry: () => void }) {
  return (
    <WalletPageFrame>
      <Card className="rounded-md border-destructive/20 bg-destructive/5 shadow-sm">
        <CardHeader className="p-8 text-center">
          <CardTitle>Unable to load wallet</CardTitle>
          <CardDescription className="pt-2">
            Something went wrong while loading your partner wallet. Try again to refresh earnings, refunds, and payout requests.
          </CardDescription>
          <div className="pt-6">
            <Button variant="outline" onClick={ onRetry }>
              Try again
            </Button>
          </div>
        </CardHeader>
      </Card>
    </WalletPageFrame>
  );
}

function WalletBreadcrumbs() {
  return (
    <Breadcrumb className="mb-2">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/partner/spaces">Partner</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <span className="font-medium text-foreground">Wallet</span>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function WalletHeader() {
  return (
    <div className="overflow-hidden rounded-md border border-border/60 bg-[linear-gradient(135deg,rgba(255,248,235,0.95),rgba(255,255,255,0.98))] shadow-sm dark:bg-[linear-gradient(135deg,rgba(39,39,42,0.92),rgba(24,24,27,0.98))]">
      <div className="flex flex-col gap-4 px-6 py-6 md:flex-row md:items-end md:justify-between md:px-8">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700/80 dark:text-amber-300/80">
            Partner earnings wallet
          </p>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Wallet
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            Track booking earnings, customer refunds, payout requests, and provider-backed balance sync from one partner ledger.
          </p>
        </div>
        <div className="rounded-md border border-amber-200/70 bg-background/80 px-4 py-3 text-sm text-muted-foreground shadow-sm dark:border-amber-900/50 dark:bg-background/30">
          Customers pay through checkout. Your wallet records the earnings side of those bookings.
        </div>
      </div>
    </div>
  );
}

function WalletQuickNotes({ notes, }: {
  notes: WalletQuickNote[];
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      { notes.map((note) => (
        <Card
          key={ note.badge }
          className="rounded-md border border-border/60 bg-background/80 shadow-sm backdrop-blur"
        >
          <CardHeader className="space-y-1 px-5 py-4">
            <div className="flex items-center gap-3">
              <Badge
                variant="secondary"
                className="rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wide"
              >
                { note.badge }
              </Badge>
              <div className={ `h-2 w-2 rounded-full ${note.accentClassName}` } />
            </div>
            <CardTitle className="text-xl font-semibold tracking-tight">{ note.value }</CardTitle>
            <CardDescription className="text-xs leading-5">{ note.description }</CardDescription>
          </CardHeader>
        </Card>
      )) }
    </div>
  );
}

function WalletProviderStatusCard({
  walletCardClassName,
  providerAccount,
}: {
  walletCardClassName: string;
  providerAccount: PartnerProviderAccountView | null;
}) {
  const isReady = providerAccount?.setupState === 'ready';
  const badgeClassName = !providerAccount
    ? 'border-border/70 bg-background text-muted-foreground'
    : providerAccount.setupState === 'ready'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
      : providerAccount.setupState === 'creating'
        ? 'border-primary/20 bg-primary/10 text-primary'
        : providerAccount.setupState === 'error'
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-700';

  const syncedBalance = providerAccount?.availableBalanceMinor && providerAccount.currency
    ? formatCurrencyMinor(providerAccount.availableBalanceMinor, providerAccount.currency)
    : 'Unavailable';
  const syncedAt = providerAccount?.lastSyncedAt
    ? formatDateTime(providerAccount.lastSyncedAt)
    : 'Not synced yet';

  return (
    <Card className={ walletCardClassName }>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <FiActivity className="size-4" aria-hidden="true" />
              Xendit payout rail
            </div>
            <CardTitle className="text-base">Provider account status</CardTitle>
            <CardDescription className="max-w-2xl">
              { providerAccount?.statusMessage ?? 'Enable payouts in Partner Settings to create your Xendit payout account and start syncing provider-backed balances.' }
            </CardDescription>
          </div>
          <Badge variant="outline" className={ badgeClassName }>
            { providerAccount?.statusLabel ?? 'Not enabled' }
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border/60 bg-background px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Provider balance
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">{ syncedBalance }</p>
        </div>
        <div className="rounded-md border border-border/60 bg-background px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Account reference
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            { providerAccount?.providerAccountReference ?? 'Not created yet' }
          </p>
        </div>
        <div className="rounded-md border border-border/60 bg-background px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Last synced
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">{ syncedAt }</p>
        </div>
        { providerAccount?.syncWarning ? (
          <div className="sm:col-span-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
            Latest provider sync warning: { providerAccount.syncWarning }
          </div>
        ) : null }
        <div className="sm:col-span-3 flex flex-wrap gap-2">
          <Button asChild variant={ isReady ? 'outline' : 'default' }>
            <Link href="/partner/settings">
              { isReady ? 'Manage payout setup' : 'Enable payouts in settings' }
              <FiArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function WalletWithdrawalsCard({
  walletCardClassName,
  balanceMinor,
  currency,
  providerAccount,
  onPayoutSuccess,
}: {
  walletCardClassName: string;
  balanceMinor?: string;
  currency?: string;
  providerAccount: PartnerProviderAccountView | null;
  onPayoutSuccess?: () => void;
}) {
  const authFetch = useAuthenticatedFetch();
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutChannelCode, setPayoutChannelCode] = useState('');
  const [payoutAccountNumber, setPayoutAccountNumber] = useState('');
  const [payoutAccountHolderName, setPayoutAccountHolderName] = useState('');
  const [isPayoutPending, setIsPayoutPending] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);
  const balanceNum = Number(balanceMinor ?? '0');
  const canPayout = balanceNum >= 10000;
  const isProviderReady = providerAccount?.setupState === 'ready';
  const resolvedCurrency = currency ?? 'PHP';
  const {
    data: payoutChannels = [],
    isLoading: isPayoutChannelsLoading,
    error: payoutChannelsError,
  } = usePayoutChannelsQuery({ enabled: payoutDialogOpen && isProviderReady, });

  const parsedAmountMinor = useMemo(
    () => parseDisplayAmountToMinor(payoutAmount),
    [payoutAmount]
  );
  const selectedPayoutChannel = useMemo(
    () => payoutChannels.find((channel) => channel.channelCode === payoutChannelCode) ?? null,
    [payoutChannelCode, payoutChannels]
  );
  const payoutDestinationSummary = selectedPayoutChannel
    ? `${selectedPayoutChannel.channelName} · ${maskDestinationAccountNumber(payoutAccountNumber)}`
    : null;

  const handleReviewRequest = useCallback(() => {
    if (parsedAmountMinor === null || parsedAmountMinor < 10000) {
      toast.error('Minimum payout is ₱100.');
      return;
    }
    if (parsedAmountMinor > balanceNum) {
      toast.error('Payout amount exceeds available balance.');
      return;
    }
    if (!selectedPayoutChannel) {
      toast.error('Select a payout destination.');
      return;
    }
    if (!payoutAccountNumber.trim()) {
      toast.error('Account number is required.');
      return;
    }
    if (!payoutAccountHolderName.trim()) {
      toast.error('Account holder name is required.');
      return;
    }
    setConfirmStep(true);
  }, [balanceNum, parsedAmountMinor, payoutAccountHolderName, payoutAccountNumber, selectedPayoutChannel]);

  const handleConfirmPayout = useCallback(async () => {
    if (parsedAmountMinor === null || parsedAmountMinor < 10000 || !selectedPayoutChannel) {
      return;
    }

    setIsPayoutPending(true);
    try {
      const response = await authFetch('/api/v1/wallet/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          amountMinor: parsedAmountMinor,
          destination: {
            channelCode: selectedPayoutChannel.channelCode,
            accountNumber: payoutAccountNumber.trim(),
            accountHolderName: payoutAccountHolderName.trim(),
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Payout request failed.');
      }
      toast.success('Payout request submitted.');
      setPayoutDialogOpen(false);
      setPayoutAmount('');
      setPayoutChannelCode('');
      setPayoutAccountNumber('');
      setPayoutAccountHolderName('');
      setConfirmStep(false);
      onPayoutSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to request payout.');
    } finally {
      setIsPayoutPending(false);
    }
  }, [
    authFetch,
    onPayoutSuccess,
    parsedAmountMinor,
    payoutAccountHolderName,
    payoutAccountNumber,
    selectedPayoutChannel
  ]);

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setPayoutDialogOpen(open);
    if (!open) {
      setPayoutAmount('');
      setPayoutChannelCode('');
      setPayoutAccountNumber('');
      setPayoutAccountHolderName('');
      setConfirmStep(false);
    }
  }, []);

  return (
    <>
      <Card className={ walletCardClassName }>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <FaPesoSign className="size-4" aria-hidden="true" />
              Partner withdrawals
            </div>
            <CardTitle className="text-base">Payout requests</CardTitle>
            <CardDescription className="max-w-2xl">
              { providerAccount?.setupState === 'ready'
                ? 'Provider-backed balance sync is active. Submit a destination with each payout request, and the admin queue will review it before provider submission.'
                : 'Submit payout requests from your current UpSpace wallet balance. Enable payouts in Partner Settings to prepare for provider-backed withdrawals.' }
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="border-amber-300/70 bg-amber-50/70 hover:bg-amber-100/80 dark:border-amber-900/50 dark:bg-amber-950/20"
              onClick={ () => setPayoutDialogOpen(true) }
              disabled={ !canPayout || !isProviderReady }
            >
              <FiSend className="mr-2 size-4" aria-hidden="true" />
              Request payout
            </Button>
            <Button asChild className="dark:border dark:border-input dark:bg-background dark:text-foreground dark:hover:bg-input/50">
              <Link href="/partner/settings">
                Payout settings
                <FiArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Dialog open={ payoutDialogOpen } onOpenChange={ handleDialogOpenChange }>
        <DialogContent
          className="sm:max-w-md"
          dismissible={ !isPayoutPending }
        >
          { confirmStep && parsedAmountMinor !== null ? (
            <>
              <DialogHeader>
                <DialogTitle>Confirm payout request</DialogTitle>
                <DialogDescription>
                  Please review the details before submitting.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-md border border-border/70 bg-muted/20 p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Payout amount</span>
                    <span className="font-semibold text-foreground">
                      { formatCurrencyMinor(String(parsedAmountMinor), resolvedCurrency) }
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Balance after withdrawal</span>
                    <span className="font-semibold text-foreground">
                      { formatCurrencyMinor(String(balanceNum - parsedAmountMinor), resolvedCurrency) }
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Destination</span>
                    <span className="text-right font-semibold text-foreground">
                      { payoutDestinationSummary ?? '—' }
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Account holder</span>
                    <span className="text-right font-semibold text-foreground">
                      { payoutAccountHolderName.trim() || '—' }
                    </span>
                  </div>
                </div>
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={ () => setConfirmStep(false) } disabled={ isPayoutPending }>
                  Go back
                </Button>
                <Button
                  variant="default"
                  className="hover:text-white"
                  onClick={ () => { void handleConfirmPayout(); } }
                  disabled={ isPayoutPending }
                  loading={ isPayoutPending }
                  loadingText="Confirm and submit"
                >
                  <FiSend className="mr-2 size-4" aria-hidden="true" />
                  Confirm and submit
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Request payout</DialogTitle>
                <DialogDescription>
                  Available balance: { formatCurrencyMinor(balanceMinor ?? '0', resolvedCurrency) }. If another payout request is already pending, you will need to wait for it to be processed first.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="payout-amount">Amount (PHP)</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={ () => setPayoutAmount(formatMinorToDisplay(balanceNum)) }
                    >
                      Max
                    </Button>
                  </div>
                  <Input
                    id="payout-amount"
                    type="text"
                    inputMode="decimal"
                    placeholder="100.00"
                    value={ payoutAmount }
                    onChange={ (e) => setPayoutAmount(e.target.value) }
                    aria-label="Payout amount in PHP"
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum payout: ₱100
                    { !isProviderReady ? ' · Enable payouts in settings first.' : '' }
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payout-destination">Destination</Label>
                  <Select value={ payoutChannelCode } onValueChange={ setPayoutChannelCode }>
                    <SelectTrigger
                      id="payout-destination"
                      aria-label="Payout destination"
                      disabled={ isPayoutChannelsLoading || Boolean(payoutChannelsError) }
                    >
                      <SelectValue
                        placeholder={
                          isPayoutChannelsLoading
                            ? 'Loading destinations...'
                            : 'Select a bank or e-wallet'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      { payoutChannels.map((channel) => (
                        <SelectItem key={ channel.channelCode } value={ channel.channelCode }>
                          { channel.channelName } ({ channel.category === 'EWALLET' ? 'E-wallet' : 'Bank' })
                        </SelectItem>
                      )) }
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose where Xendit should send the payout after admin review.
                  </p>
                  { payoutChannelsError instanceof Error ? (
                    <p className="text-xs text-destructive">{ payoutChannelsError.message }</p>
                  ) : null }
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payout-account-number">
                    { selectedPayoutChannel?.category === 'EWALLET' ? 'Mobile number' : 'Account number' }
                  </Label>
                  <Input
                    id="payout-account-number"
                    type="text"
                    inputMode="numeric"
                    placeholder={ selectedPayoutChannel?.category === 'EWALLET' ? '09171234567' : 'Enter destination account number' }
                    value={ payoutAccountNumber }
                    onChange={ (event) => setPayoutAccountNumber(event.target.value) }
                    aria-label="Payout destination account number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payout-account-holder-name">Account holder name</Label>
                  <Input
                    id="payout-account-holder-name"
                    type="text"
                    placeholder="Juan Dela Cruz"
                    value={ payoutAccountHolderName }
                    onChange={ (event) => setPayoutAccountHolderName(event.target.value) }
                    aria-label="Payout destination account holder name"
                  />
                </div>
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={ () => setPayoutDialogOpen(false) }>
                  Cancel
                </Button>
                <Button
                  variant="default"
                  className="hover:text-white"
                  onClick={ handleReviewRequest }
                  disabled={
                    !payoutAmount ||
                    !payoutChannelCode ||
                    !payoutAccountNumber.trim() ||
                    !payoutAccountHolderName.trim() ||
                    isPayoutChannelsLoading ||
                    Boolean(payoutChannelsError)
                  }
                >
                  Review request
                </Button>
              </DialogFooter>
            </>
          ) }
        </DialogContent>
      </Dialog>
    </>
  );
}

function WalletSummaryCards({
  walletCardClassName,
  availableBalance,
  totalEarned,
  totalRefunded,
  pendingPayout,
  totalPaidOut,
}: {
  walletCardClassName: string;
  availableBalance: string;
  totalEarned: string;
  totalRefunded: string;
  pendingPayout: string | null;
  totalPaidOut: string | null;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className={ walletCardClassName }>
        <CardHeader className="space-y-1 px-5 py-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Available balance
            </p>
            <div className="rounded-md border border-emerald-200/70 bg-emerald-50/80 p-1.5 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
              <FaPesoSign className="size-4" aria-hidden="true" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">
            { availableBalance }
          </CardTitle>
          <CardDescription className="text-xs font-medium text-muted-foreground">
            Current partner wallet balance
          </CardDescription>
        </CardHeader>
      </Card>

      { pendingPayout && (
        <Card className={ walletCardClassName }>
          <CardHeader className="space-y-1 px-5 py-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                Pending payout
              </p>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-1.5 text-amber-600 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
                <FiClock className="size-4" aria-hidden="true" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">
              { pendingPayout }
            </CardTitle>
            <CardDescription className="text-xs font-medium text-muted-foreground">
              Awaiting admin review
            </CardDescription>
          </CardHeader>
        </Card>
      ) }

      <Card className={ walletCardClassName }>
        <CardHeader className="space-y-1 px-5 py-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Total earned
            </p>
            <div className="rounded-md border border-sky-200/70 bg-sky-50/80 p-1.5 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300">
              <FiTrendingUp className="size-4" aria-hidden="true" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">
            { totalEarned }
          </CardTitle>
          <CardDescription className="text-xs font-medium text-muted-foreground">
            Lifetime booking earnings credited
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className={ walletCardClassName }>
        <CardHeader className="space-y-1 px-5 py-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Total refunded
            </p>
            <div className="rounded-md border border-rose-200/70 bg-rose-50/80 p-1.5 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              <FiRotateCcw className="size-4" aria-hidden="true" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">
            { totalRefunded }
          </CardTitle>
          <CardDescription className="text-xs font-medium text-muted-foreground">
            Lifetime refunds returned to customers
          </CardDescription>
        </CardHeader>
      </Card>

      { totalPaidOut && (
        <Card className={ walletCardClassName }>
          <CardHeader className="space-y-1 px-5 py-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Total paid out
              </p>
              <div className="rounded-md border bg-muted/30 p-1.5 text-muted-foreground">
                <FiSend className="size-4" aria-hidden="true" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">
              { totalPaidOut }
            </CardTitle>
            <CardDescription className="text-xs font-medium text-muted-foreground">
              Lifetime completed payouts
            </CardDescription>
          </CardHeader>
        </Card>
      ) }
    </div>
  );
}

function WalletAnalyticsHighlights({
  walletCardClassName,
  analytics,
}: {
  walletCardClassName: string;
  analytics: WalletAnalytics;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className={ walletCardClassName }>
        <CardHeader className="space-y-1 px-5 py-4">
          <Badge variant="secondary" className="w-fit rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wide">
            Reliability
          </Badge>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Success rate
          </p>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FiActivity className="size-4 text-emerald-500" aria-hidden="true" />
            { analytics.successfulRate }%
          </CardTitle>
          <CardDescription className="text-xs font-medium text-muted-foreground">
            Share of loaded wallet activity with a succeeded status
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className={ walletCardClassName }>
        <CardHeader className="space-y-1 px-5 py-4">
          <Badge variant="secondary" className="w-fit rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wide">
            Pattern
          </Badge>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Most common type
          </p>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FiPieChart className="size-4 text-violet-500" aria-hidden="true" />
            { analytics.topType }
          </CardTitle>
          <CardDescription className="text-xs font-medium text-muted-foreground">
            The transaction type that appears most in the loaded activity list
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className={ walletCardClassName }>
        <CardHeader className="space-y-1 px-5 py-4">
          <Badge variant="secondary" className="w-fit rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wide">
            Benchmark
          </Badge>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Avg booking charge
          </p>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FiBarChart2 className="size-4 text-sky-600" aria-hidden="true" />
            { analytics.averageCharge }
          </CardTitle>
          <CardDescription className="text-xs font-medium text-muted-foreground">
            Mean amount across loaded booking charge transactions
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function StatusDistributionCard({
  walletCardClassName,
  analytics,
}: {
  walletCardClassName: string;
  analytics: WalletAnalytics;
}) {
  return (
    <Card className={ walletCardClassName }>
      <CardHeader className="px-5 py-4">
        <CardTitle className="text-sm font-semibold">Status distribution</CardTitle>
        <CardDescription className="text-xs">How loaded wallet transactions are resolving.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-5 pb-4 pt-0">
        { analytics.total === 0 && (
          <p className="text-xs text-muted-foreground">
            No activity yet. Status insights will appear after bookings, refunds, or payout requests are recorded.
          </p>
        ) }
        { (Object.entries(analytics.statusCounts) as Array<[WalletTransactionStatus, number]>).map(([status, count]) => {
          const percent = analytics.total > 0 ? Math.round((count / analytics.total) * 100) : 0;
          return (
            <div key={ status } className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{ STATUS_LABELS[status] }</span>
                <span className="text-muted-foreground">{ count } ({ percent }%)</span>
              </div>
              <div className="h-2 overflow-hidden rounded-md bg-muted">
                <div
                  className={ `h-full rounded-md ${STATUS_BAR_STYLES[status]}` }
                  style={ { width: `${percent}%`, } }
                />
              </div>
            </div>
          );
        }) }
      </CardContent>
    </Card>
  );
}

function TransactionMixCard({
  walletCardClassName,
  analytics,
}: {
  walletCardClassName: string;
  analytics: WalletAnalytics;
}) {
  return (
    <Card className={ walletCardClassName }>
      <CardHeader className="px-5 py-4">
        <CardTitle className="text-sm font-semibold">Transaction mix</CardTitle>
        <CardDescription className="text-xs">Share of loaded activity by partner wallet transaction type.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-5 pb-4 pt-0">
        { analytics.total === 0 && (
          <p className="text-xs text-muted-foreground">
            Booking earnings, refunds, and payout requests will be broken down here once activity starts coming in.
          </p>
        ) }
        { (Object.entries(analytics.typeCounts) as Array<[WalletTransactionType, number]>).map(([type, count]) => {
          const percent = analytics.total > 0 ? Math.round((count / analytics.total) * 100) : 0;
          return (
            <div key={ type } className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{ TRANSACTION_TYPE_LABELS[type] }</span>
                <span className="text-muted-foreground">{ count } ({ percent }%)</span>
              </div>
              <div className="h-2 overflow-hidden rounded-md bg-muted">
                <div
                  className="h-full rounded-md bg-primary"
                  style={ { width: `${percent}%`, } }
                />
              </div>
            </div>
          );
        }) }
      </CardContent>
    </Card>
  );
}

function NetFlowTrendCard({
  walletCardClassName,
  analytics,
}: {
  walletCardClassName: string;
  analytics: WalletAnalytics;
}) {
  return (
    <Card className={ walletCardClassName }>
      <CardHeader className="px-5 py-4">
        <CardTitle className="text-sm font-semibold">Net flow trend (last 6 months)</CardTitle>
        <CardDescription className="text-xs">Booking earnings and wallet credits minus refunds and payout requests.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 px-5 pb-4 pt-0 sm:grid-cols-3 lg:grid-cols-6">
        { analytics.monthSeries.map((month) => {
          const widthPercent = Math.max(
            6,
            Math.round((Math.abs(month.valueMinor) / analytics.maxMonthMagnitude) * 100)
          );

          return (
            <div key={ month.key } className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">{ month.label }</span>
                <span className={ month.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400' }>
                  { month.positive ? '+' : '-' }{ month.value }
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-md bg-muted">
                <div
                  className={ `h-full rounded-md ${month.positive ? 'bg-emerald-500' : 'bg-rose-500'}` }
                  style={ { width: `${widthPercent}%`, } }
                />
              </div>
            </div>
          );
        }) }
      </CardContent>
    </Card>
  );
}

function WalletAnalyticsSection({
  walletCardClassName,
  analytics,
}: {
  walletCardClassName: string;
  analytics: WalletAnalytics;
}) {
  return (
    <div className="space-y-4 rounded-md border border-border/60 bg-background/50 p-4 shadow-sm backdrop-blur-sm md:p-5">
      <div className="flex flex-col gap-1">
        <Badge variant="secondary" className="w-fit rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wide">
          Analytics
        </Badge>
        <h3 className="text-lg font-semibold tracking-tight">Wallet analytics</h3>
        <p className="text-xs text-muted-foreground">
          Based on currently loaded activity ({ analytics.total } transaction{ analytics.total === 1 ? '' : 's' }). These cards reflect the visible list below, not the entire lifetime ledger.
        </p>
      </div>

      <WalletAnalyticsHighlights walletCardClassName={ walletCardClassName } analytics={ analytics } />

      <div className="grid gap-4 lg:grid-cols-2">
        <StatusDistributionCard walletCardClassName={ walletCardClassName } analytics={ analytics } />
        <TransactionMixCard walletCardClassName={ walletCardClassName } analytics={ analytics } />
      </div>

      <NetFlowTrendCard walletCardClassName={ walletCardClassName } analytics={ analytics } />
    </div>
  );
}

function WalletActivityFilters({
  filters,
  onTypeChange,
  onStatusChange,
}: {
  filters: WalletFilters;
  onTypeChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Select
        value={ filters.type ?? 'all' }
        onValueChange={ onTypeChange }
      >
        <SelectTrigger size="sm" className="h-9 w-[140px]" aria-label="Filter by transaction type">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="charge">Booking charge</SelectItem>
          <SelectItem value="refund">Refund</SelectItem>
          <SelectItem value="payout">Payout request</SelectItem>
          <SelectItem value="cash_in">Wallet credit</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={ filters.status ?? 'all' }
        onValueChange={ onStatusChange }
      >
        <SelectTrigger size="sm" className="h-9 w-[140px]" aria-label="Filter by status">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="succeeded">Succeeded</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function WalletTransactionsCard({
  walletCardClassName,
  transactions,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  walletCardClassName: string;
  transactions: WalletTransactionRecord[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  return (
    <Card className={ `overflow-hidden ${walletCardClassName}` }>
      <CardContent className="p-0">
        { transactions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
            <div className="flex size-12 items-center justify-center rounded-full border border-border/60 bg-muted/30 text-muted-foreground/50">
              <FiInbox className="size-6" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                No partner wallet activity yet
              </p>
              <p className="max-w-[280px] text-xs text-muted-foreground">
                Booking earnings, customer refunds, and payout requests will appear here once your listings start generating wallet activity.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            <ScrollArea className="max-h-[700px]">
              <div className="flex flex-col gap-3 px-5 py-2.5">
                { transactions.map((transaction) => (
                  <TransactionArticle key={ transaction.id } transaction={ transaction } />
                )) }

                { hasNextPage && (
                  <div className="flex justify-center pt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={ isFetchingNextPage }
                      onClick={ onLoadMore }
                      className="text-muted-foreground hover:text-foreground"
                    >
                      { isFetchingNextPage ? (
                        <>
                          <FiLoader className="mr-2 size-3 animate-spin" aria-hidden="true" />
                          Loading more...
                        </>
                      ) : (
                        'Show more activity'
                      ) }
                    </Button>
                  </div>
                ) }
              </div>
            </ScrollArea>
          </div>
        ) }
      </CardContent>
      { transactions.length > 0 && (
        <div className="border-t border-border/40 bg-muted/10 px-6 py-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Showing { transactions.length } { transactions.length === 1 ? 'entry' : 'entries' } from the loaded partner wallet ledger
          </p>
        </div>
      ) }
    </Card>
  );
}

function WalletActivitySection({
  walletCardClassName,
  filters,
  transactions,
  hasNextPage,
  isFetchingNextPage,
  onTypeChange,
  onStatusChange,
  onLoadMore,
}: {
  walletCardClassName: string;
  filters: WalletFilters;
  transactions: WalletTransactionRecord[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onTypeChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onLoadMore: () => void;
}) {
  return (
    <div className="space-y-4 rounded-md border border-border/60 bg-background/50 p-4 shadow-sm backdrop-blur-sm md:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Badge variant="secondary" className="w-fit rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wide">
            Activity
          </Badge>
          <h3 className="text-lg font-semibold tracking-tight">Ledger activity</h3>
        </div>
        <WalletActivityFilters
          filters={ filters }
          onTypeChange={ onTypeChange }
          onStatusChange={ onStatusChange }
        />
      </div>

      <WalletTransactionsCard
        walletCardClassName={ walletCardClassName }
        transactions={ transactions }
        hasNextPage={ hasNextPage }
        isFetchingNextPage={ isFetchingNextPage }
        onLoadMore={ onLoadMore }
      />
    </div>
  );
}

export default function WalletPage() {
  const {
    data: userProfile,
    isLoading: isProfileLoading,
  } = useUserProfile();
  const isPartnerRole = userProfile?.role === 'partner';

  const [filters, dispatchFilters] = useReducer(walletFiltersReducer, {});

  const {
    data: walletSummary,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = useWallet({ enabled: isPartnerRole, });

  const {
    data: txPages,
    isLoading: isTxLoading,
    isError: isTxError,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch: refetchTx,
  } = useWalletTransactions({
    enabled: isPartnerRole,
    filters,
  });

  const transactions = useMemo(
    () => txPages?.pages.flatMap((page) => page.transactions) ?? [],
    [txPages?.pages]
  );

  const wallet = walletSummary?.wallet;
  const providerAccount = walletSummary?.providerAccount ?? null;
  const stats = walletSummary?.stats;
  const isLoading = isSummaryLoading || isTxLoading;
  const isError = isSummaryError || isTxError;
  const analytics = useWalletAnalytics(transactions, wallet, stats);

  if (isProfileLoading) {
    return <WalletPageSkeleton />;
  }

  if (!isPartnerRole) {
    return <PartnerOnlyState />;
  }

  if (isLoading) {
    return <WalletPageSkeleton />;
  }

  if (isError) {
    return (
      <WalletErrorState
        onRetry={ () => {
          void refetchSummary();
          void refetchTx();
        } }
      />
    );
  }

  const walletCurrency = wallet?.currency ?? 'PHP';
  const availableBalance = wallet
    ? formatCurrencyMinor(wallet.balanceMinor, wallet.currency)
    : '₱0.00';
  const totalEarned = stats
    ? formatCurrencyMinor(stats.totalEarnedMinor, walletCurrency)
    : '₱0.00';
  const totalRefunded = stats
    ? formatCurrencyMinor(stats.totalRefundedMinor, walletCurrency)
    : '₱0.00';
  const pendingPayoutMinor = Number(stats?.pendingPayoutMinor ?? '0');
  const pendingPayout = pendingPayoutMinor > 0
    ? formatCurrencyMinor(String(pendingPayoutMinor), walletCurrency)
    : null;
  const totalPaidOutMinor = Number(stats?.totalPaidOutMinor ?? '0');
  const totalPaidOut = totalPaidOutMinor > 0
    ? formatCurrencyMinor(String(totalPaidOutMinor), walletCurrency)
    : null;
  const walletCardClassName = 'rounded-md border border-border/60 bg-background/95 shadow-sm dark:bg-card';
  const quickNotes: WalletQuickNote[] = [
    {
      badge: 'Access',
      value: 'Partner only',
      description: 'This wallet reflects the earnings side of bookings for partners, not customer stored value.',
      accentClassName: 'bg-amber-500',
    },
    {
      badge: 'Money in',
      value: 'Booking charges',
      description: 'Customer booking payments become earnings entries when they are credited into the wallet ledger.',
      accentClassName: 'bg-sky-500',
    },
    {
      badge: 'Money out',
      value: 'Refunds + payout requests',
      description: 'Refunds send money back to customers, while payout requests begin the partner cash-out flow.',
      accentClassName: 'bg-rose-500',
    }
  ];

  return (
    <WalletPageFrame>
      <WalletBreadcrumbs />
      <WalletHeader />
      <WalletQuickNotes notes={ quickNotes } />

      <WalletProviderStatusCard
        walletCardClassName={ walletCardClassName }
        providerAccount={ providerAccount }
      />

      <WalletWithdrawalsCard
        walletCardClassName={ walletCardClassName }
        balanceMinor={ wallet?.balanceMinor }
        currency={ wallet?.currency }
        providerAccount={ providerAccount }
        onPayoutSuccess={ () => {
          void refetchSummary();
          void refetchTx();
        } }
      />

      <WalletSummaryCards
        walletCardClassName={ walletCardClassName }
        availableBalance={ availableBalance }
        totalEarned={ totalEarned }
        totalRefunded={ totalRefunded }
        pendingPayout={ pendingPayout }
        totalPaidOut={ totalPaidOut }
      />

      <WalletAnalyticsSection
        walletCardClassName={ walletCardClassName }
        analytics={ analytics }
      />

      <WalletActivitySection
        walletCardClassName={ walletCardClassName }
        filters={ filters }
        transactions={ transactions }
        hasNextPage={ Boolean(hasNextPage) }
        isFetchingNextPage={ isFetchingNextPage }
        onTypeChange={ (value) => dispatchFilters({
 type: 'SET_TYPE',
payload: value, 
}) }
        onStatusChange={ (value) => dispatchFilters({
 type: 'SET_STATUS',
payload: value, 
}) }
        onLoadMore={ () => {
          void fetchNextPage();
        } }
      />
    </WalletPageFrame>
  );
}
