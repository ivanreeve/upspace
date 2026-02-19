'use client';

import Link from 'next/link';
import {
  useMemo,
  useReducer,
  type ComponentType,
  type ReactNode
} from 'react';
import {
  FiActivity,
  FiArrowDownLeft,
  FiArrowUpRight,
  FiBarChart2,
  FiDollarSign,
  FiInbox,
  FiLoader,
  FiPieChart,
  FiRotateCcw,
  FiSend,
  FiTrendingUp
} from 'react-icons/fi';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { useUserProfile } from '@/hooks/use-user-profile';
import { formatCurrencyMinor } from '@/lib/wallet';

const TRANSACTION_TYPE_LABELS: Record<WalletTransactionType, string> = {
  cash_in: 'Top-up',
  charge: 'Booking charge',
  refund: 'Refund',
  payout: 'Payout',
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
  topType: 'None',
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
      topType: topType ? TRANSACTION_TYPE_LABELS[topType[0]] : 'None',
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
  const badgeVariant = STATUS_BADGE_VARIANTS[transaction.status] ?? 'secondary';
  const amountLabel = formatCurrencyMinor(transaction.amountMinor, transaction.currency);
  const isCredit = transaction.type === 'charge' || transaction.type === 'cash_in';

  return (
    <article className="group relative flex items-center justify-between gap-4 rounded-md border bg-sidebar px-4 py-3 transition-colors hover:bg-accent/20 dark:bg-card">
      <div className="min-w-0 flex items-center gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted/30 text-muted-foreground transition-colors group-hover:text-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex flex-col gap-0.5">
          <p className="truncate text-sm font-semibold text-foreground">
            { label }
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{ formatDateTime(transaction.createdAt) }</span>
            { transaction.bookingId && (
              <>
                <span>•</span>
                <span className="font-mono">{ transaction.bookingId.slice(0, 8) }</span>
              </>
            ) }
          </div>
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
      <Card className="rounded-md border-dashed">
        <CardHeader className="p-8 text-center">
          <CardTitle className="text-xl">Partner wallet only</CardTitle>
          <CardDescription className="mx-auto max-w-md pt-2 text-balance">
            Wallets are reserved for partners. Customers pay through the booking
            checkout, and funds are credited directly to the partner&apos;s wallet.
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
      <Card className="rounded-md border-destructive/20 bg-destructive/5">
        <CardHeader className="p-8 text-center">
          <CardTitle>Unable to load wallet</CardTitle>
          <CardDescription className="pt-2">
            Something went wrong while loading your wallet data.
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
    <div className="space-y-1">
      <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
        Wallet
      </h2>
      <p className="text-sm text-muted-foreground md:text-base">
        Track your earnings, refunds, and payouts from UpSpace bookings.
      </p>
    </div>
  );
}

function WalletWithdrawalsCard({ walletCardClassName, }: { walletCardClassName: string }) {
  return (
    <Card className={ walletCardClassName }>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <FiDollarSign className="size-4" aria-hidden="true" />
            PayMongo withdrawals
          </div>
          <CardTitle className="text-base">Withdrawals</CardTitle>
          <CardDescription className="max-w-2xl">
            Payouts are managed through PayMongo. This balance represents funds collected
            from bookings that PayMongo released to you.
          </CardDescription>
        </div>
        <Button
          asChild
          className="dark:border dark:border-input dark:bg-background dark:text-foreground dark:hover:bg-input/50"
        >
          <a
            href="https://dashboard.paymongo.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open PayMongo dashboard
            <FiArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        </Button>
      </CardHeader>
    </Card>
  );
}

function WalletSummaryCards({
  walletCardClassName,
  availableBalance,
  totalEarned,
  totalRefunded,
}: {
  walletCardClassName: string;
  availableBalance: string;
  totalEarned: string;
  totalRefunded: string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className={ walletCardClassName }>
        <CardHeader className="space-y-1 px-5 py-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Available balance
            </p>
            <div className="rounded-md border bg-muted/30 p-1.5 text-muted-foreground">
              <FiDollarSign className="size-4" aria-hidden="true" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">
            { availableBalance }
          </CardTitle>
          <CardDescription className="text-xs font-medium text-muted-foreground">
            Settled from bookings
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className={ walletCardClassName }>
        <CardHeader className="space-y-1 px-5 py-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Total earned
            </p>
            <div className="rounded-md border bg-muted/30 p-1.5 text-muted-foreground">
              <FiTrendingUp className="size-4" aria-hidden="true" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">
            { totalEarned }
          </CardTitle>
          <CardDescription className="text-xs font-medium text-muted-foreground">
            Lifetime booking charges
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className={ walletCardClassName }>
        <CardHeader className="space-y-1 px-5 py-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Total refunded
            </p>
            <div className="rounded-md border bg-muted/30 p-1.5 text-muted-foreground">
              <FiRotateCcw className="size-4" aria-hidden="true" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">
            { totalRefunded }
          </CardTitle>
          <CardDescription className="text-xs font-medium text-muted-foreground">
            Lifetime refunds issued
          </CardDescription>
        </CardHeader>
      </Card>
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
        <CardHeader className="space-y-1 px-5 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Success rate
          </p>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FiActivity className="size-4 text-emerald-500" aria-hidden="true" />
            { analytics.successfulRate }%
          </CardTitle>
          <CardDescription className="text-xs font-medium text-muted-foreground">
            Succeeded transaction ratio
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className={ walletCardClassName }>
        <CardHeader className="space-y-1 px-5 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Most common type
          </p>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FiPieChart className="size-4 text-violet-500" aria-hidden="true" />
            { analytics.topType }
          </CardTitle>
          <CardDescription className="text-xs font-medium text-muted-foreground">
            Highest count in current activity list
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className={ walletCardClassName }>
        <CardHeader className="space-y-1 px-5 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Avg booking charge
          </p>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FiBarChart2 className="size-4 text-sky-600" aria-hidden="true" />
            { analytics.averageCharge }
          </CardTitle>
          <CardDescription className="text-xs font-medium text-muted-foreground">
            Mean amount from charge transactions
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
      <CardHeader className="px-5 py-2.5">
        <CardTitle className="text-sm font-semibold">Status distribution</CardTitle>
        <CardDescription className="text-xs">How your transactions are resolving.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-5 pb-4 pt-0">
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
      <CardHeader className="px-5 py-2.5">
        <CardTitle className="text-sm font-semibold">Transaction mix</CardTitle>
        <CardDescription className="text-xs">Share by wallet transaction type.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-5 pb-4 pt-0">
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
      <CardHeader className="px-5 py-2.5">
        <CardTitle className="text-sm font-semibold">Net flow trend (last 6 months)</CardTitle>
        <CardDescription className="text-xs">Charges/top-ups minus payouts/refunds.</CardDescription>
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
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold tracking-tight">Wallet analytics</h3>
        <p className="text-xs text-muted-foreground">
          Based on currently loaded activity ({ analytics.total } transaction{ analytics.total === 1 ? '' : 's' }).
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
          <SelectItem value="payout">Payout</SelectItem>
          <SelectItem value="cash_in">Top-up</SelectItem>
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
            <div className="flex size-12 items-center justify-center rounded-full bg-muted/30 text-muted-foreground/50">
              <FiInbox className="size-6" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                No wallet activity yet
              </p>
              <p className="max-w-[240px] text-xs text-muted-foreground">
                Transactions will appear here once bookings start generating revenue.
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
            Showing { transactions.length } { transactions.length === 1 ? 'entry' : 'entries' } • Synced with PayMongo
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
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold tracking-tight">Activity</h3>
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

  const availableBalance = wallet
    ? formatCurrencyMinor(wallet.balanceMinor, wallet.currency)
    : '₱0.00';
  const totalEarned = stats
    ? formatCurrencyMinor(stats.totalEarnedMinor, wallet?.currency ?? 'PHP')
    : '₱0.00';
  const totalRefunded = stats
    ? formatCurrencyMinor(stats.totalRefundedMinor, wallet?.currency ?? 'PHP')
    : '₱0.00';
  const walletCardClassName = 'rounded-md bg-sidebar dark:bg-card';

  return (
    <WalletPageFrame>
      <WalletBreadcrumbs />
      <WalletHeader />

      <WalletWithdrawalsCard walletCardClassName={ walletCardClassName } />

      <WalletSummaryCards
        walletCardClassName={ walletCardClassName }
        availableBalance={ availableBalance }
        totalEarned={ totalEarned }
        totalRefunded={ totalRefunded }
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
