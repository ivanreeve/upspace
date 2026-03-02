'use client';

import { useEffect, useMemo } from 'react';
import { FiLoader } from 'react-icons/fi';
import { toast } from 'sonner';

import { useWalletTransactions, type WalletTransactionRecord } from '@/hooks/use-wallet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { SystemErrorIllustration } from '@/components/pages/Marketplace/Marketplace.ErrorState';
import { formatCurrencyMinor } from '@/lib/wallet';

const STATUS_LABELS: Record<WalletTransactionRecord['status'], string> = {
  pending: 'Pending',
  succeeded: 'Succeeded',
  failed: 'Failed',
};

const STATUS_VARIANTS: Record<WalletTransactionRecord['status'], 'secondary' | 'success' | 'destructive'> = {
  pending: 'secondary',
  succeeded: 'success',
  failed: 'destructive',
};

const TYPE_LABELS: Record<WalletTransactionRecord['type'], string> = {
  cash_in: 'Cash in',
  charge: 'Charge',
  refund: 'Refund',
  payout: 'Payout',
};

const dateFormatter = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const formatDateTime = (value: string) =>
  dateFormatter.format(new Date(value));

const safeBigInt = (value: string | null | undefined) => {
  if (!value) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

const TableSkeletonRows = ({ rows, }: { rows: number }) => (
  <>
    { Array.from({ length: rows, }).map((_, index) => (
      <TableRow key={ `skeleton-${index}` }>
        { Array.from({ length: 6, }).map((__, cellIndex) => (
          <TableCell key={ `skeleton-${index}-${cellIndex}` }>
            <Skeleton className="h-4 w-full" />
          </TableCell>
        )) }
      </TableRow>
    )) }
  </>
);

export function PartnerTransactionHistory() {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
  } = useWalletTransactions({ limit: 25, });

  const transactions = useMemo(
    () => data?.pages.flatMap((page) => page.transactions) ?? [],
    [data]
  );
  const stats = data?.pages[0]?.stats;
  const totalEarnedMinor = stats?.totalEarnedMinor ?? null;
  const totalRefundedMinor = stats?.totalRefundedMinor ?? null;
  const totalEarnedValue = safeBigInt(totalEarnedMinor);
  const totalRefundedValue = safeBigInt(totalRefundedMinor);
  const netEarningsMinor = (totalEarnedValue - totalRefundedValue).toString();
  const totalTransactions = stats?.transactionCount ?? transactions.length;
  const latestTransaction = transactions[0] ?? null;

  const errorMessage = error instanceof Error
    ? error.message
    : 'Unable to load transactions.';

  useEffect(() => {
    if (isError) {
      toast.error(errorMessage);
    }
  }, [isError, errorMessage]);

  return (
    <section className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Partner
        </p>
        <h1 className="text-3xl font-semibold text-foreground">
          Transaction history
        </h1>
        <p className="text-sm text-muted-foreground">
          Track payouts, charges, and refunds tied to your listings.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-border/70 bg-card/70">
          <CardHeader className="space-y-1 p-4">
            <CardTitle className="text-base font-semibold text-foreground">
              Total earned
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Charges recorded to your wallet
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold text-foreground">
              { totalEarnedMinor
                ? formatCurrencyMinor(totalEarnedMinor, transactions[0]?.currency ?? 'PHP')
                : formatCurrencyMinor(0, transactions[0]?.currency ?? 'PHP') }
            </p>
            <p className="text-sm text-muted-foreground">
              Refunded { totalRefundedMinor
                ? formatCurrencyMinor(totalRefundedMinor, transactions[0]?.currency ?? 'PHP')
                : formatCurrencyMinor(0, transactions[0]?.currency ?? 'PHP') }
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/70 bg-card/70">
          <CardHeader className="space-y-1 p-4">
            <CardTitle className="text-base font-semibold text-foreground">
              Net earnings
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              After refunds in this wallet
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold text-foreground">
              { formatCurrencyMinor(netEarningsMinor, transactions[0]?.currency ?? 'PHP') }
            </p>
            <p className="text-sm text-muted-foreground">
              { totalTransactions } transaction{ totalTransactions === 1 ? '' : 's' }
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/70 bg-card/70">
          <CardHeader className="space-y-1 p-4">
            <CardTitle className="text-base font-semibold text-foreground">
              Latest activity
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Most recent wallet event
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <p className="text-base font-semibold text-foreground">
              { latestTransaction
                ? formatDateTime(latestTransaction.createdAt)
                : 'No activity yet' }
            </p>
            <p className="text-sm text-muted-foreground">
              { latestTransaction
                ? TYPE_LABELS[latestTransaction.type]
                : 'Awaiting first transaction' }
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border/70 bg-card/70">
        <CardHeader className="flex flex-col gap-1 px-6 py-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <CardTitle className="text-lg font-semibold text-foreground">
              Recent transactions
            </CardTitle>
            <span className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
              { transactions.length } entries
            </span>
          </div>
          <CardDescription className="text-sm text-muted-foreground">
            Synced from PayMongo wallet events and payouts.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          { isLoading ? (
            <div className="p-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Booking</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableSkeletonRows rows={ 6 } />
                </TableBody>
              </Table>
            </div>
          ) : isError ? (
            <div className="px-6 py-12 text-center">
              <SystemErrorIllustration />
              <p className="mt-4 text-sm text-muted-foreground">
                { errorMessage }
              </p>
              <div className="mt-4 flex justify-center">
                <Button variant="outline" size="sm" onClick={ () => { void refetch(); } }>
                  Retry
                </Button>
              </div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="px-6 py-12 text-sm text-muted-foreground">
              No wallet transactions yet.
            </div>
          ) : (
            <div className="rounded-b-md border-t border-border/60 bg-card/80">
              <div className="overflow-hidden rounded-md border border-border/70 bg-background/80 shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead>Booking</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    { transactions.map((transaction) => (
                      <TableRow key={ transaction.id }>
                        <TableCell className="whitespace-nowrap">
                          { formatDateTime(transaction.createdAt) }
                        </TableCell>
                        <TableCell>{ TYPE_LABELS[transaction.type] }</TableCell>
                        <TableCell>
                          <Badge variant={ STATUS_VARIANTS[transaction.status] }>
                            { STATUS_LABELS[transaction.status] }
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          { formatCurrencyMinor(transaction.amountMinor, transaction.currency) }
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          { transaction.netAmountMinor
                            ? formatCurrencyMinor(transaction.netAmountMinor, transaction.currency)
                            : '-' }
                        </TableCell>
                      <TableCell className="text-muted-foreground">
                        { transaction.booking
                          ? `${transaction.booking.spaceName} - ${transaction.booking.areaName}`
                          : transaction.bookingId ?? '-' }
                      </TableCell>
                      </TableRow>
                    )) }
                  </TableBody>
                </Table>
              </div>
            </div>
          ) }
        </CardContent>
      </Card>

      { hasNextPage && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={ () => { void fetchNextPage(); } }
            disabled={ isFetchingNextPage }
          >
            { isFetchingNextPage ? (
              <FiLoader className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : null }
            Load more
          </Button>
        </div>
      ) }
      { isFetching && !isFetchingNextPage && (
        <p className="text-center text-xs text-muted-foreground">
          Updating...
        </p>
      ) }
    </section>
  );
}
