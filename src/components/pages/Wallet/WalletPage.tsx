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
  const isDebit = transaction.type === 'payout' || transaction.type === 'refund'; // Refunds are also debits from partner's perspective if they were the ones paying? Wait, no, refunds to customers are debits from partner's wallet.
  
  // Actually, 'charge' is credit to partner, 'payout' is debit, 'refund' is debit (money going back to customer), 'cash_in' is credit.
  const isCredit = transaction.type === 'charge' || transaction.type === 'cash_in';

  return (
    <article className="group relative flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-background/50 p-4 transition-all hover:border-border hover:bg-muted/5">
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
              <CardHeader className="space-y-2 p-5">
                <Skeleton className="h-4 w-20 rounded-md" />
                <Skeleton className="h-8 w-32 rounded-md" />
                <Skeleton className="h-3 w-40 rounded-md" />
              </CardHeader>
            </Card>
          )) }
        </div>

        <Card className="border border-border/70 bg-background/80">
          <CardHeader className="px-6 py-5">
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
                <Button asChild variant="outline">
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

        { /* Stats cards */ }
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="relative overflow-hidden border border-border/70 bg-background/80">
            <CardHeader className="space-y-1 p-5">
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

          <Card className="relative overflow-hidden border border-border/70 bg-background/80">
            <CardHeader className="space-y-1 p-5">
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

          <Card className="relative overflow-hidden border border-border/70 bg-background/80">
            <CardHeader className="space-y-1 p-5">
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

        { /* Withdrawals info */ }
        <Card className="border border-border/70 bg-muted/30">
          <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Withdrawals</h3>
              <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                Payouts are managed through PayMongo. This balance represents funds collected 
                from bookings that PayMongo released to you. To move money out, initiate 
                payouts or withdrawals from your PayMongo dashboard.
              </p>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0 bg-background/50 hover:text-white">
              <a 
                href="https://dashboard.paymongo.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                Go to PayMongo
                <FiArrowUpRight className="size-3" />
              </a>
            </Button>
          </div>
        </Card>

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
                    <div className="flex flex-col gap-3 p-5">
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
              <div className="border-t border-border/40 bg-muted/10 px-6 py-3">
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
