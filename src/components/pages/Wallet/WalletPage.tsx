'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
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

const TRANSACTION_TYPE_ICONS: Record<WalletTransactionType, React.ComponentType<{ className?: string }>> = {
  cash_in: FiArrowDownLeft,
  charge: FiArrowUpRight,
  refund: FiRotateCcw,
  payout: FiSend,
};

const TRANSACTION_CARD_STYLES: Record<WalletTransactionType, string> = {
  cash_in: 'border-sky-200/80 bg-sky-50/70 hover:bg-sky-50 dark:border-sky-900/50 dark:bg-sky-950/20 dark:hover:bg-sky-950/30',
  charge: 'border-emerald-200/80 bg-emerald-50/70 hover:bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30',
  refund: 'border-rose-200/80 bg-rose-50/70 hover:bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/20 dark:hover:bg-rose-950/30',
  payout: 'border-violet-200/80 bg-violet-50/70 hover:bg-violet-50 dark:border-violet-900/50 dark:bg-violet-950/20 dark:hover:bg-violet-950/30',
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

function TransactionArticle({ transaction, }: { transaction: WalletTransactionRecord }) {
  const Icon = TRANSACTION_TYPE_ICONS[transaction.type] ?? FiArrowUpRight;
  const label = TRANSACTION_TYPE_LABELS[transaction.type] ?? 'Transaction';
  const badgeVariant = STATUS_BADGE_VARIANTS[transaction.status] ?? 'secondary';
  const amountLabel = formatCurrencyMinor(transaction.amountMinor, transaction.currency);
  const transactionTone = TRANSACTION_CARD_STYLES[transaction.type] ?? 'border-border/50 bg-background/50 hover:bg-muted/5';
  const isDebit = transaction.type === 'payout' || transaction.type === 'refund'; // Refunds are also debits from partner's perspective if they were the ones paying? Wait, no, refunds to customers are debits from partner's wallet.
  
  // Actually, 'charge' is credit to partner, 'payout' is debit, 'refund' is debit (money going back to customer), 'cash_in' is credit.
  const isCredit = transaction.type === 'charge' || transaction.type === 'cash_in';

  return (
    <article className={ `group relative flex items-center justify-between gap-4 rounded-xl border px-4 py-2 transition-colors ${transactionTone}` }>
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted/40 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-foreground truncate">
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
      
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <p className={ `text-sm font-bold tracking-tight ${isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}` }>
          { isCredit ? '+' : '-' }{ amountLabel }
        </p>
        <Badge 
          variant={ badgeVariant } 
          className="h-5 px-1.5 text-[10px] font-bold uppercase tracking-wider"
        >
          { STATUS_LABELS[transaction.status] }
        </Badge>
      </div>
    </article>
  );
}

function WalletPageSkeleton() {
  return (
    <div className="w-full px-4 pb-8 sm:px-6 lg:px-10">
      <section className="space-y-6 py-8 md:space-y-8 md:py-12">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-8 w-32 rounded-md" />
          <Skeleton className="h-4 w-80 rounded-md" />
        </div>
        
        <div className="grid gap-4 md:grid-cols-3">
          { [1, 2, 3].map((i) => (
            <Card key={ i } className="border border-border/70 bg-background/80">
              <CardHeader className="space-y-2 px-5 py-2.5">
                <Skeleton className="h-4 w-20 rounded-md" />
                <Skeleton className="h-8 w-32 rounded-md" />
                <Skeleton className="h-3 w-40 rounded-md" />
              </CardHeader>
            </Card>
          )) }
        </div>

        <Card className="border border-border/70 bg-background/80">
          <CardHeader className="px-6 py-2.5">
            <Skeleton className="h-6 w-32 rounded-md" />
          </CardHeader>
          <CardContent className="space-y-3 p-6 pt-0">
            { [1, 2, 3, 4].map((i) => (
              <Skeleton key={ i } className="h-20 rounded-xl" />
            )) }
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export default function WalletPage() {
  const {
 data: userProfile, isLoading: isProfileLoading, 
} = useUserProfile();
  const isPartnerRole = userProfile?.role === 'partner';

  const [filters, setFilters] = useState<WalletFilters>({});

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

  const analytics = useMemo(() => {
    if (!wallet || !stats) {
      return {
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
        maxMonthMagnitude: 0,
      };
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

  if (isProfileLoading) {
    return <WalletPageSkeleton />;
  }

  if (!isPartnerRole) {
    return (
      <div className="w-full px-4 pb-8 sm:px-6 lg:px-10">
        <section className="space-y-6 py-8 md:space-y-8 md:py-12">
          <Card className="border-dashed border-border/70 bg-background/60">
            <CardHeader className="p-8 text-center">
              <CardTitle className="text-xl">Partner wallet only</CardTitle>
              <CardDescription className="mx-auto max-w-md text-balance pt-2">
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
        </section>
      </div>
    );
  }

  if (isLoading) {
    return <WalletPageSkeleton />;
  }

  if (isError) {
    return (
      <div className="w-full px-4 pb-8 sm:px-6 lg:px-10">
        <section className="space-y-6 py-8 md:space-y-8 md:py-12">
          <Card className="border-destructive/20 bg-destructive/5">
            <CardHeader className="p-8 text-center">
              <CardTitle>Unable to load wallet</CardTitle>
              <CardDescription className="pt-2">
                Something went wrong while loading your wallet data.
              </CardDescription>
              <div className="pt-6">
                <Button
                  variant="outline"
                  onClick={ () => { refetchSummary(); refetchTx(); } }
                >
                  Try again
                </Button>
              </div>
            </CardHeader>
          </Card>
        </section>
      </div>
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
  const filteredCount = stats?.transactionCount ?? 0;

  return (
    <div className="w-full px-4 pb-8 sm:px-6 lg:px-10">
      <section className="space-y-6 py-8 md:space-y-8 md:py-12">
        { /* Breadcrumbs */ }
        <Breadcrumb className="mb-2">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/partner/spaces">Partner</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <span className="text-foreground font-medium">Wallet</span>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        { /* Page header */ }
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Wallet
          </h2>
          <p className="text-sm text-muted-foreground md:text-base font-sf">
            Track your earnings, refunds, and payouts from UpSpace bookings.
          </p>
        </div>

        { /* Withdrawals info */ }
        <section className="relative overflow-hidden rounded-md border border-sky-300/70 bg-gradient-to-br from-sky-100/80 via-cyan-100/40 to-background dark:border-sky-900/70 dark:from-sky-950/30 dark:via-cyan-950/15 dark:to-background">
          <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-sky-300/30 blur-2xl dark:bg-sky-500/20" />
          <div className="pointer-events-none absolute -bottom-12 left-8 size-28 rounded-full bg-cyan-300/25 blur-2xl dark:bg-cyan-500/15" />
          <div className="relative flex flex-col gap-4 px-5 py-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-md border border-sky-300/70 bg-background/70 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
                <FiDollarSign className="size-4" aria-hidden="true" />
                PayMongo withdrawals
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Withdrawals</h3>
                <p className="max-w-2xl text-xs leading-relaxed text-foreground/80 dark:text-muted-foreground">
                  Payouts are managed through PayMongo. This balance represents funds collected
                  from bookings that PayMongo released to you. To move money out, initiate
                  payouts or withdrawals from your PayMongo dashboard.
                </p>
              </div>
            </div>
            <a
              href="https://dashboard.paymongo.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#0A5057] underline underline-offset-4 transition-colors hover:text-[#083f44] dark:text-sky-300 dark:hover:text-sky-200"
            >
              Open PayMongo dashboard
              <FiArrowUpRight className="size-4" aria-hidden="true" />
            </a>
          </div>
        </section>

        { /* Stats cards */ }
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="relative overflow-hidden border border-primary/30 bg-primary/10">
            <CardHeader className="space-y-1 px-5 py-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  Available balance
                </p>
                <div className="rounded-full bg-primary/10 p-1.5 text-primary">
                  <FiDollarSign className="size-4" />
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

          <Card className="relative overflow-hidden border border-emerald-300/60 bg-emerald-100/40 dark:border-emerald-900/60 dark:bg-emerald-950/20">
            <CardHeader className="space-y-1 px-5 py-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  Total earned
                </p>
                <div className="rounded-full bg-emerald-500/10 p-1.5 text-emerald-600 dark:text-emerald-400">
                  <FiTrendingUp className="size-4" />
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

          <Card className="relative overflow-hidden border border-rose-300/60 bg-rose-100/40 dark:border-rose-900/60 dark:bg-rose-950/20">
            <CardHeader className="space-y-1 px-5 py-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  Total refunded
                </p>
                <div className="rounded-full bg-destructive/10 p-1.5 text-destructive">
                  <FiRotateCcw className="size-4" />
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

        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold tracking-tight">Wallet analytics</h3>
            <p className="text-xs text-muted-foreground">
              Based on currently loaded activity ({ analytics.total } transaction{ analytics.total === 1 ? '' : 's' }).
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border border-border/70 bg-background/80">
              <CardHeader className="space-y-1 px-5 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  Success rate
                </p>
                <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                  <FiActivity className="size-5 text-emerald-500" aria-hidden="true" />
                  { analytics.successfulRate }%
                </CardTitle>
                <CardDescription className="text-xs font-medium text-muted-foreground">
                  Succeeded transaction ratio
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border border-border/70 bg-background/80">
              <CardHeader className="space-y-1 px-5 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  Most common type
                </p>
                <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                  <FiPieChart className="size-5 text-violet-500" aria-hidden="true" />
                  { analytics.topType }
                </CardTitle>
                <CardDescription className="text-xs font-medium text-muted-foreground">
                  Highest count in current activity list
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border border-border/70 bg-background/80">
              <CardHeader className="space-y-1 px-5 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  Avg booking charge
                </p>
                <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                  <FiBarChart2 className="size-5 text-sky-600" aria-hidden="true" />
                  { analytics.averageCharge }
                </CardTitle>
                <CardDescription className="text-xs font-medium text-muted-foreground">
                  Mean amount from charge transactions
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border border-border/70 bg-background/80">
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

            <Card className="border border-border/70 bg-background/80">
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
          </div>

          <Card className="border border-border/70 bg-background/80">
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
        </div>

        { /* Transaction list */ }
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold tracking-tight">Activity</h3>
            
            <div className="flex items-center gap-2">
              <Select
                value={ filters.type ?? 'all' }
                onValueChange={ (value) =>
                  setFilters((prev) => ({
                    ...prev,
                    type: value === 'all' ? undefined : value as WalletTransactionType,
                  }))
                }
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
                onValueChange={ (value) =>
                  setFilters((prev) => ({
                    ...prev,
                    status: value === 'all' ? undefined : value as WalletTransactionStatus,
                  }))
                }
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
          </div>

          <Card className="overflow-hidden border border-border/70 bg-background/80">
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
                    <p className="text-xs text-muted-foreground max-w-[240px]">
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
                            onClick={ () => fetchNextPage() }
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
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
                  Showing { transactions.length } { transactions.length === 1 ? 'entry' : 'entries' } • Synced with PayMongo
                </p>
              </div>
            ) }
          </Card>
        </div>
      </section>
    </div>
  );
}
