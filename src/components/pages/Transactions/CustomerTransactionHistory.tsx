'use client';

import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { FiLoader } from 'react-icons/fi';
import { toast } from 'sonner';

import { useCustomerTransactionsQuery } from '@/hooks/api/useCustomerTransactions';
import { formatCurrencyMinor } from '@/lib/wallet';
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
import type { CustomerTransactionBookingStatus } from '@/types/transactions';

const BOOKING_STATUS_VARIANTS: Record<CustomerTransactionBookingStatus, 'secondary' | 'success' | 'destructive'> = {
  pending: 'secondary',
  confirmed: 'success',
  completed: 'success',
  checkedin: 'success',
  checkedout: 'success',
  rejected: 'destructive',
  expired: 'destructive',
  cancelled: 'destructive',
  noshow: 'destructive',
};

const BOOKING_STATUS_LABELS: Record<CustomerTransactionBookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  checkedin: 'Checked in',
  checkedout: 'Checked out',
  rejected: 'Rejected',
  expired: 'Expired',
  cancelled: 'Cancelled',
  noshow: 'No show',
};

const LOCALE_OPTIONS = {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
} as const;

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('en-PH', LOCALE_OPTIONS);

export function CustomerTransactionHistory() {
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useCustomerTransactionsQuery();

  const errorMessage = error instanceof Error
    ? error.message
    : 'Unable to load transactions.';

  useEffect(() => {
    if (isError) {
      toast.error(errorMessage);
    }
  }, [isError, errorMessage]);

  const transactions = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data]
  );
  const hasTransactions = transactions.length > 0;
  const totalAmountMinor = transactions.reduce((sum, transaction) => {
    const minor = Number(transaction.amountMinor ?? '0');
    return Number.isFinite(minor) ? sum + minor : sum;
  }, 0);
  const totalHours = transactions.reduce(
    (sum, transaction) => sum + transaction.bookingHours,
    0
  );
  const lastTransaction = transactions[0];

  if (isLoading) {
    return (
      <section className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-1">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          { Array.from({ length: 3, }).map((_, i) => (
            <Card key={ i } className="border border-border bg-card/70">
              <CardHeader className="space-y-1 p-4"><Skeleton className="h-5 w-24" /></CardHeader>
              <CardContent className="p-4"><Skeleton className="h-8 w-32" /></CardContent>
            </Card>
          )) }
        </div>
        <Card className="border border-border bg-card/70">
          <CardHeader className="px-6 py-4"><Skeleton className="h-6 w-40" /></CardHeader>
          <CardContent className="space-y-4 p-6">
            { Array.from({ length: 3, }).map((_, i) => (
              <Skeleton key={ i } className="h-28 w-full rounded-2xl" />
            )) }
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Customer
        </p>
        <h1 className="text-3xl font-semibold text-foreground">
          Transaction history
        </h1>
        <p className="text-sm text-muted-foreground">
          A clear, chronological record of every booking payment and payout we
          routed through UpSpace.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-border bg-card/70">
          <CardHeader className="space-y-1 p-4">
            <CardTitle className="text-base font-semibold text-foreground">
              Total spend
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Across all bookings shown here
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold text-foreground">
              { formatCurrencyMinor(totalAmountMinor, lastTransaction?.currency ?? 'PHP') }
            </p>
            <p className="text-sm text-muted-foreground">
              { transactions.length } payment
              { transactions.length === 1 ? '' : 's' }
            </p>
          </CardContent>
        </Card>
        <Card className="border border-border bg-card/70">
          <CardHeader className="space-y-1 p-4">
            <CardTitle className="text-base font-semibold text-foreground">
              Latest payment
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Most recent settlement captured
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <p className="text-base font-semibold text-foreground">
              { lastTransaction
                ? formatDateTime(lastTransaction.transactionCreatedAt)
                : 'No payments yet' }
            </p>
            <p className="text-sm text-muted-foreground">
              { lastTransaction ? lastTransaction.spaceName : 'Awaiting first booking' }
            </p>
          </CardContent>
        </Card>
        <Card className="border border-border bg-card/70">
          <CardHeader className="space-y-1 p-4">
            <CardTitle className="text-base font-semibold text-foreground">
              Booking hours
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Total time covered by these entries
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold text-foreground">
              { totalHours }
            </p>
            <p className="text-sm text-muted-foreground">
              { totalHours === 1 ? 'hour booked' : 'hours booked' }
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border bg-card/70">
        <CardHeader className="flex flex-col gap-1 px-6 py-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <CardTitle className="text-lg font-semibold text-foreground">
              Recent payments
            </CardTitle>
            <span className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
              { hasTransactions ? `${ transactions.length } entries` : 'Empty' }
            </span>
          </div>
          <CardDescription className="text-sm text-muted-foreground">
            Everything is synced with PayMongo. Tap a booking to revisit the confirmation
            email or follow up with support.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          { !hasTransactions ? (
            <div className="px-6 py-10 text-sm text-muted-foreground">
              You have not completed any paid bookings yet.
              Every settled booking payment will appear here for easy reference.
            </div>
          ) : (
            <div className="rounded-b-md border-t border-border/60 bg-card/80">
              <div className="overflow-hidden rounded-md border border-border/70 bg-background/80 shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Workspace</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead>Booking</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  { transactions.map((transaction) => {
                    const amountLabel = formatCurrencyMinor(
                      transaction.amountMinor,
                      transaction.currency
                    );

                      return (
                        <TableRow key={ transaction.id }>
                          <TableCell className="whitespace-nowrap">
                            { formatDateTime(transaction.transactionCreatedAt) }
                          </TableCell>
                          <TableCell className="font-medium">
                            { transaction.spaceName } - { transaction.areaName }
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                BOOKING_STATUS_VARIANTS[transaction.bookingStatus]
                              }
                            >
                              { BOOKING_STATUS_LABELS[transaction.bookingStatus] }
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            { amountLabel }
                          </TableCell>
                          <TableCell className="text-right">
                            { transaction.bookingHours }
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <Link
                              href={ `/customer/bookings/${transaction.bookingId}` }
                              className="text-xs hover:underline"
                            >
                              { transaction.bookingId }
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    }) }
                  </TableBody>
                </Table>
              </div>
              { hasNextPage && (
                <div className="flex justify-center border-t border-border/60 px-6 py-4">
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
            </div>
          ) }
        </CardContent>
      </Card>
    </section>
  );
}
