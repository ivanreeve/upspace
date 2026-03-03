'use client';

import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import {
FiLoader,
FiCreditCard,
FiActivity,
FiClock,
FiFileText
} from 'react-icons/fi';
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
import type { CustomerTransactionBookingStatus, CustomerTransactionRecord } from '@/types/transactions';

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

const safeBigInt = (value: string | null | undefined) => {
  if (!value) {
    return 0n;
  }

  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

const formatLedgerAmount = (amountMinor: bigint | null, currency: string) =>
  amountMinor === null
    ? '-'
    : formatCurrencyMinor(amountMinor.toString(), currency);

type CustomerLedgerRow = {
  id: string;
  transactionId: string;
  postedAt: string;
  reference: string;
  bookingStatus: CustomerTransactionBookingStatus;
  account: string;
  details: string;
  debitMinor: bigint | null;
  creditMinor: bigint | null;
  cumulativeSpendMinor: bigint | null;
  bookingId: string | null;
  currency: string;
  isContra: boolean;
};

function buildCustomerLedgerRows(
  transactions: CustomerTransactionRecord[]
): CustomerLedgerRow[] {
  const chronologicalTransactions = [...transactions].sort(
    (left, right) =>
      new Date(left.transactionCreatedAt).getTime() -
      new Date(right.transactionCreatedAt).getTime()
  );

  let cumulativeSpendMinor = 0n;
  const cumulativeByTransactionId = new Map<string, bigint>();

  for (const transaction of chronologicalTransactions) {
    cumulativeSpendMinor += safeBigInt(transaction.amountMinor);
    cumulativeByTransactionId.set(transaction.id, cumulativeSpendMinor);
  }

  return transactions.flatMap((transaction) => {
    const amountMinor = safeBigInt(transaction.amountMinor);
    const reference = transaction.id.slice(0, 8).toUpperCase();
    const workspaceLabel = `${transaction.spaceName} - ${transaction.areaName}`;
    const cumulativeMinor = cumulativeByTransactionId.get(transaction.id) ?? null;

    const debitRow: CustomerLedgerRow = {
      id: `${transaction.id}-expense`,
      transactionId: transaction.id,
      postedAt: transaction.transactionCreatedAt,
      reference,
      bookingStatus: transaction.bookingStatus,
      account: 'Booking Expense',
      details: `${workspaceLabel} | ${transaction.paymentMethod}`,
      debitMinor: amountMinor,
      creditMinor: null,
      cumulativeSpendMinor: cumulativeMinor,
      bookingId: transaction.bookingId,
      currency: transaction.currency,
      isContra: false,
    };

    const creditRow: CustomerLedgerRow = {
      id: `${transaction.id}-cash`,
      transactionId: transaction.id,
      postedAt: transaction.transactionCreatedAt,
      reference,
      bookingStatus: transaction.bookingStatus,
      account: 'Cash and Cash Equivalents',
      details: `Counter-entry | ${workspaceLabel}`,
      debitMinor: null,
      creditMinor: amountMinor,
      cumulativeSpendMinor: null,
      bookingId: null,
      currency: transaction.currency,
      isContra: true,
    };

    return [debitRow, creditRow];
  });
}

const TableSkeletonRows = ({ rows, }: { rows: number }) => (
  <>
    { Array.from({ length: rows, }).map((_, index) => (
      <TableRow key={ `skeleton-${index}` }>
        { Array.from({ length: 8, }).map((__, cellIndex) => (
          <TableCell key={ `skeleton-${index}-${cellIndex}` }>
            <Skeleton className="h-4 w-full" />
          </TableCell>
        )) }
      </TableRow>
    )) }
  </>
);

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

  const ledgerRows = useMemo(
    () => buildCustomerLedgerRows(transactions),
    [transactions]
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
      <section className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          { Array.from({ length: 3, }).map((_, i) => (
            <Card key={ i } className="border border-border bg-card/70">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="size-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-3 w-40" />
              </CardContent>
            </Card>
          )) }
        </div>
        <Card className="border border-border bg-card/70 shadow-sm">
          <CardHeader className="px-6 py-5">
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Ref</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Cumulative spend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableSkeletonRows rows={ 8 } />
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <FiFileText className="size-3" aria-hidden="true" /> Customer
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Transaction history
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Posted as double-entry journal lines so each booking payment is traceable from expense to cash settlement.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-border/60 bg-card/40 shadow-sm transition-all hover:bg-card/60 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total spend
            </CardTitle>
            <FiCreditCard className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              { formatCurrencyMinor(totalAmountMinor, lastTransaction?.currency ?? 'PHP') }
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across { transactions.length } payment{ transactions.length === 1 ? '' : 's' } shown
            </p>
          </CardContent>
        </Card>
        
        <Card className="border border-border/60 bg-card/40 shadow-sm transition-all hover:bg-card/60 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Latest payment
            </CardTitle>
            <FiActivity className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground truncate">
              { lastTransaction ? formatDateTime(lastTransaction.transactionCreatedAt).split(',')[0] : 'None' }
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              { lastTransaction ? lastTransaction.spaceName : 'Awaiting first booking' }
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/60 bg-card/40 shadow-sm transition-all hover:bg-card/60 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Booking hours
            </CardTitle>
            <FiClock className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              { totalHours }
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total time covered by these entries
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border border-border/60 bg-card shadow-sm">
        <CardHeader className="border-b border-border/40 bg-muted/10 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                Double-entry ledger
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Every payment posts an expense debit and a matching cash credit.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs font-medium uppercase tracking-wider bg-background/50">
              { hasTransactions ? `${ transactions.length } transactions` : 'Empty' }
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          { !hasTransactions ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="rounded-full bg-muted/50 p-4 mb-4">
                <FiFileText className="size-8 text-muted-foreground/50" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-foreground">No transactions found</p>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                You have not completed any paid bookings yet. Every settled booking payment will appear here as ledger entries.
              </p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-b-border/60">
                    <TableHead className="font-medium text-muted-foreground">Date</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Ref</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Status</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Account</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Details</TableHead>
                    <TableHead className="text-right font-medium text-muted-foreground">Debit</TableHead>
                    <TableHead className="text-right font-medium text-muted-foreground">Credit</TableHead>
                    <TableHead className="text-right font-medium text-muted-foreground">Cumulative spend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  { ledgerRows.map((row) => (
                    <TableRow 
                      key={ row.id } 
                      className={ `
                        group transition-colors
                        ${row.isContra ? 'bg-muted/10 border-b border-border/60' : 'border-none'} 
                        hover:bg-muted/30
                      ` }
                    >
                      <TableCell className="whitespace-nowrap py-3 text-xs text-muted-foreground">
                        { row.isContra ? (
                          <div className="pl-4 border-l-2 border-muted-foreground/20 h-full py-1"></div>
                        ) : (
                          formatDateTime(row.postedAt)
                        ) }
                      </TableCell>
                      <TableCell className="py-3 font-mono text-[11px] text-muted-foreground">
                        { row.isContra ? '' : row.reference }
                      </TableCell>
                      <TableCell className="py-3">
                        { row.isContra ? (
                          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60 pl-2">Contra entry</span>
                        ) : (
                          <Badge
                            variant={ BOOKING_STATUS_VARIANTS[row.bookingStatus] }
                            className="text-[10px] uppercase font-semibold"
                          >
                            { BOOKING_STATUS_LABELS[row.bookingStatus] }
                          </Badge>
                        ) }
                      </TableCell>
                      <TableCell className={ `py-3 ${row.isContra ? 'text-muted-foreground text-sm' : 'font-medium text-sm text-foreground'}` }>
                        { row.account }
                      </TableCell>
                      <TableCell className="py-3 text-xs text-muted-foreground">
                        <div className="flex flex-col gap-1">
                          <span>{ row.details }</span>
                          { !row.isContra && row.bookingId ? (
                            <Link
                              href={ `/customer/bookings/${row.bookingId}` }
                              className="text-[11px] font-medium text-primary/80 hover:text-primary hover:underline w-fit"
                            >
                              View booking { row.bookingId.slice(0, 8) } →
                            </Link>
                          ) : null }
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-right font-medium text-sm text-foreground/80">
                        { formatLedgerAmount(row.debitMinor, row.currency) }
                      </TableCell>
                      <TableCell className="py-3 text-right font-medium text-sm text-foreground/80">
                        { formatLedgerAmount(row.creditMinor, row.currency) }
                      </TableCell>
                      <TableCell className="py-3 text-right font-semibold text-sm text-foreground">
                        { formatLedgerAmount(row.cumulativeSpendMinor, row.currency) }
                      </TableCell>
                    </TableRow>
                  )) }
                </TableBody>
              </Table>
              { hasNextPage && (
                <div className="flex justify-center border-t border-border/60 bg-muted/5 px-6 py-4">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full sm:w-auto min-w-[140px]"
                    onClick={ () => { void fetchNextPage(); } }
                    disabled={ isFetchingNextPage }
                  >
                    { isFetchingNextPage ? (
                      <FiLoader className="mr-2 size-4 animate-spin" aria-hidden="true" />
                    ) : null }
                    { isFetchingNextPage ? 'Loading...' : 'Load older transactions' }
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
