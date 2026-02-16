'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
FiArrowDownLeft,
FiArrowUpRight,
FiDollarSign,
FiInbox,
FiLoader,
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
  const isDebit = transaction.type === 'payout';

  return (
    <article className="group rounded-2xl border border-border/60 bg-background/70 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-border/80">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted/60">
            <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-foreground">
              { label }
            </p>
            { transaction.description && (
              <p className="text-xs text-muted-foreground truncate max-w-[280px]">
                { transaction.description }
              </p>
            ) }
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <p className={ `text-lg font-semibold ${isDebit ? 'text-destructive' : 'text-foreground'}` }>
            { isDebit ? '-' : '+' }{ amountLabel }
          </p>
          <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            { formatDateTime(transaction.createdAt) }
          </span>
          <Badge variant={ badgeVariant }>
            { STATUS_LABELS[transaction.status] }
          </Badge>
        </div>
      </div>

      { transaction.bookingId && (
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>Booking { transaction.bookingId.slice(0, 8) }</span>
          { transaction.metadata && 'testing_mode' in transaction.metadata && (
            <span>Test payment</span>
          ) }
        </div>
      ) }
    </article>
  );
}

function WalletPageSkeleton() {
  return (
    <section className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <Skeleton className="h-3 w-16 rounded-md" />
        <Skeleton className="h-8 w-32 rounded-md" />
        <Skeleton className="h-4 w-64 rounded-md" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        { [1, 2, 3].map((i) => (
          <Card key={ i } className="border border-border bg-card/70">
            <CardHeader className="space-y-1 p-4">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-3 w-40 rounded-md" />
            </CardHeader>
            <CardContent className="p-4">
              <Skeleton className="h-7 w-28 rounded-md" />
              <Skeleton className="mt-1 h-4 w-20 rounded-md" />
            </CardContent>
          </Card>
        )) }
      </div>
      <Card className="border border-border bg-card/70">
        <CardHeader className="px-6 py-4">
          <Skeleton className="h-5 w-40 rounded-md" />
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          { [1, 2, 3].map((i) => (
            <Skeleton key={ i } className="h-20 rounded-2xl" />
          )) }
        </CardContent>
      </Card>
    </section>
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

  if (isProfileLoading) {
    return <WalletPageSkeleton />;
  }

  if (!isPartnerRole) {
    return (
      <section className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <Card className="border border-border bg-card/70">
          <CardHeader className="p-6">
            <CardTitle>Partner wallet only</CardTitle>
            <CardDescription>
              Wallets are reserved for partners. Customers pay through the booking
              checkout, and funds are credited directly to the partner&apos;s wallet.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <p className="text-sm text-muted-foreground">
              Need help or think you should have access? Contact support to review your role.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (isLoading) {
    return <WalletPageSkeleton />;
  }

  if (isError) {
    return (
      <section className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <Card className="border border-border bg-card/70">
          <CardHeader className="p-6">
            <CardTitle>Unable to load wallet</CardTitle>
            <CardDescription>
              Something went wrong while loading your wallet data.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <Button
              variant="outline"
              onClick={ () => { refetchSummary(); refetchTx(); } }
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      </section>
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
    <section className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      { /* Breadcrumbs */ }
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/partner/wallet">Partner</Link>
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
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Partner
        </p>
        <h1 className="text-3xl font-semibold text-foreground">Wallet</h1>
        <p className="text-sm text-muted-foreground">
          Track your earnings, refunds, and payouts from UpSpace bookings.
        </p>
      </div>

      { /* Stats cards */ }
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="relative overflow-hidden border border-border bg-card/70">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Available balance
                </p>
                <p className="text-3xl font-bold tracking-tight text-foreground">
                  { availableBalance }
                </p>
                <p className="text-xs text-muted-foreground">
                  Settled from bookings
                </p>
              </div>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <FiDollarSign className="size-5 text-primary" aria-hidden="true" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border border-border bg-card/70">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Total earned
                </p>
                <p className="text-3xl font-bold tracking-tight text-foreground">
                  { totalEarned }
                </p>
                <p className="text-xs text-muted-foreground">
                  Lifetime booking charges
                </p>
              </div>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                <FiTrendingUp className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border border-border bg-card/70">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Total refunded
                </p>
                <p className="text-3xl font-bold tracking-tight text-foreground">
                  { totalRefunded }
                </p>
                <p className="text-xs text-muted-foreground">
                  Lifetime refunds issued
                </p>
              </div>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
                <FiRotateCcw className="size-5 text-destructive" aria-hidden="true" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      { /* Withdrawals info */ }
      <Card className="border border-border bg-card/70">
        <CardHeader className="space-y-1 p-4">
          <CardTitle className="text-base font-semibold text-foreground">
            Withdrawals
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Payouts are managed through PayMongo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 p-4 pt-0">
          <p className="text-sm text-muted-foreground">
            This balance represents funds collected from bookings that PayMongo
            released to you. To move money out, initiate payouts or withdrawals
            from your PayMongo dashboard.
          </p>
        </CardContent>
      </Card>

      { /* Transaction list */ }
      <Card className="border border-border bg-card/70">
        <CardHeader className="flex flex-col gap-3 px-6 py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">
              Activity
            </CardTitle>
            <span className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              { filteredCount > 0 ? `${filteredCount} entries` : 'Empty' }
            </span>
          </div>
          <CardDescription className="text-sm text-muted-foreground">
            Synced with your PayMongo partner wallet ledger.
          </CardDescription>
          <div className="flex flex-wrap gap-2">
            <Select
              value={ filters.type ?? 'all' }
              onValueChange={ (value) =>
                setFilters((prev) => ({
                  ...prev,
                  type: value === 'all' ? undefined : value as WalletTransactionType,
                }))
              }
            >
              <SelectTrigger size="sm" className="w-[160px]" aria-label="Filter by transaction type">
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
              <SelectTrigger size="sm" className="w-[160px]" aria-label="Filter by status">
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
        </CardHeader>

        <CardContent className="p-0">
          { transactions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <FiInbox className="size-8 text-muted-foreground/50" aria-hidden="true" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  No wallet activity yet
                </p>
                <p className="text-xs text-muted-foreground/80">
                  Transactions will appear here once bookings start generating revenue.
                </p>
              </div>
            </div>
          ) : (
            <ScrollArea className="max-h-[640px] rounded-b-md border-t border-border/60 bg-card/80">
              <div className="space-y-4 p-6">
                { transactions.map((transaction) => (
                  <TransactionArticle key={ transaction.id } transaction={ transaction } />
                )) }

                { hasNextPage && (
                  <div className="flex justify-center pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={ isFetchingNextPage }
                      onClick={ () => fetchNextPage() }
                    >
                      { isFetchingNextPage ? (
                        <>
                          <FiLoader className="size-4 animate-spin" aria-hidden="true" />
                          Loading
                        </>
                      ) : (
                        'Load more'
                      ) }
                    </Button>
                  </div>
                ) }
              </div>
            </ScrollArea>
          ) }
        </CardContent>
      </Card>
    </section>
  );
}
