'use client';

import { useEffect, useMemo } from 'react';
import {
FiLoader,
FiDollarSign,
FiTrendingUp,
FiActivity,
FiBriefcase,
FiFileText
} from 'react-icons/fi';
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

type LedgerDirection = 'debit' | 'credit';

type LedgerTypeConfig = {
  typeLabel: string;
  counterpartyAccount: string;
  walletDirection: LedgerDirection;
};

const LEDGER_TYPE_CONFIG: Record<WalletTransactionRecord['type'], LedgerTypeConfig> = {
  cash_in: {
    typeLabel: 'Cash in',
    counterpartyAccount: 'External funding',
    walletDirection: 'debit',
  },
  charge: {
    typeLabel: 'Charge',
    counterpartyAccount: 'Booking revenue',
    walletDirection: 'debit',
  },
  refund: {
    typeLabel: 'Refund',
    counterpartyAccount: 'Refund expense',
    walletDirection: 'credit',
  },
  payout: {
    typeLabel: 'Payout',
    counterpartyAccount: 'Partner payout payable',
    walletDirection: 'credit',
  },
};

const WALLET_ACCOUNT_NAME = 'Wallet Cash';

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

const getWalletEffectMinor = (transaction: WalletTransactionRecord) => {
  if (transaction.status !== 'succeeded') {
    return 0n;
  }

  const config = LEDGER_TYPE_CONFIG[transaction.type];
  const amountMinor = safeBigInt(transaction.amountMinor);

  return config.walletDirection === 'debit'
    ? amountMinor
    : -amountMinor;
};

type PartnerLedgerRow = {
  id: string;
  postedAt: string;
  reference: string;
  status: WalletTransactionRecord['status'];
  account: string;
  details: string;
  debitMinor: bigint | null;
  creditMinor: bigint | null;
  balanceAfterMinor: bigint | null;
  currency: string;
  isContra: boolean;
};

function buildPartnerLedgerRows(
  transactions: WalletTransactionRecord[],
  currentWalletBalanceMinor: bigint
): PartnerLedgerRow[] {
  let effectFromNewerPostedEntries = 0n;

  return transactions.flatMap((transaction) => {
    const config = LEDGER_TYPE_CONFIG[transaction.type];
    const amountMinor = safeBigInt(transaction.amountMinor);
    const isPosted = transaction.status === 'succeeded';
    const walletBalanceAfterEntry = isPosted
      ? currentWalletBalanceMinor - effectFromNewerPostedEntries
      : null;

    const bookingLabel = transaction.booking
      ? `${transaction.booking.spaceName} - ${transaction.booking.areaName}`
      : (transaction.bookingId ?? 'No booking reference');
    const narrative = transaction.description?.trim() || bookingLabel;
    const reference = transaction.id.slice(0, 8).toUpperCase();

    const walletDebit =
      isPosted && config.walletDirection === 'debit'
        ? amountMinor
        : null;
    const walletCredit =
      isPosted && config.walletDirection === 'credit'
        ? amountMinor
        : null;

    const contraDebit =
      isPosted && config.walletDirection === 'credit'
        ? amountMinor
        : null;
    const contraCredit =
      isPosted && config.walletDirection === 'debit'
        ? amountMinor
        : null;

    if (isPosted) {
      effectFromNewerPostedEntries += getWalletEffectMinor(transaction);
    }

    const walletRow: PartnerLedgerRow = {
      id: `${transaction.id}-wallet`,
      postedAt: transaction.createdAt,
      reference,
      status: transaction.status,
      account: WALLET_ACCOUNT_NAME,
      details: `${config.typeLabel} | ${narrative}`,
      debitMinor: walletDebit,
      creditMinor: walletCredit,
      balanceAfterMinor: walletBalanceAfterEntry,
      currency: transaction.currency,
      isContra: false,
    };

    const contraRow: PartnerLedgerRow = {
      id: `${transaction.id}-contra`,
      postedAt: transaction.createdAt,
      reference,
      status: transaction.status,
      account: config.counterpartyAccount,
      details: `Counter-entry | ${narrative}`,
      debitMinor: contraDebit,
      creditMinor: contraCredit,
      balanceAfterMinor: null,
      currency: transaction.currency,
      isContra: true,
    };

    return [walletRow, contraRow];
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

  const currentWalletBalanceMinor = safeBigInt(data?.pages[0]?.wallet.balanceMinor);

  const ledgerRows = useMemo(
    () => buildPartnerLedgerRows(transactions, currentWalletBalanceMinor),
    [transactions, currentWalletBalanceMinor]
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
                  <TableHead className="text-right">Wallet balance</TableHead>
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
            <FiBriefcase className="size-3" aria-hidden="true" /> Partner
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Transaction history
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Posted as double-entry journal lines for wallet cash, payouts, charges, and refunds.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-border/60 bg-card/40 shadow-sm transition-all hover:bg-card/60 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total earned
            </CardTitle>
            <FiDollarSign className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              { totalEarnedMinor
                ? formatCurrencyMinor(totalEarnedMinor, transactions[0]?.currency ?? 'PHP')
                : formatCurrencyMinor(0, transactions[0]?.currency ?? 'PHP') }
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Refunded { totalRefundedMinor
                ? formatCurrencyMinor(totalRefundedMinor, transactions[0]?.currency ?? 'PHP')
                : formatCurrencyMinor(0, transactions[0]?.currency ?? 'PHP') }
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/60 bg-card/40 shadow-sm transition-all hover:bg-card/60 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Net earnings
            </CardTitle>
            <FiTrendingUp className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              { formatCurrencyMinor(netEarningsMinor, transactions[0]?.currency ?? 'PHP') }
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              { totalTransactions } transaction{ totalTransactions === 1 ? '' : 's' }
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/60 bg-card/40 shadow-sm transition-all hover:bg-card/60 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Latest activity
            </CardTitle>
            <FiActivity className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground truncate">
              { latestTransaction
                ? formatDateTime(latestTransaction.createdAt).split(',')[0]
                : 'None' }
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              { latestTransaction
                ? LEDGER_TYPE_CONFIG[latestTransaction.type].typeLabel
                : 'Awaiting first transaction' }
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
                Each transaction is shown as debit and credit journal lines. Running balance is tracked on the wallet account line.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs font-medium uppercase tracking-wider bg-background/50">
              { transactions.length } transactions
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          { isError ? (
            <div className="px-6 py-16 text-center flex flex-col items-center justify-center">
              <SystemErrorIllustration />
              <p className="mt-4 text-sm font-medium text-foreground">
                { errorMessage }
              </p>
              <div className="mt-4">
                <Button variant="secondary" size="sm" onClick={ () => { void refetch(); } }>
                  Try again
                </Button>
              </div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="rounded-full bg-muted/50 p-4 mb-4">
                <FiFileText className="size-8 text-muted-foreground/50" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-foreground">No wallet transactions found</p>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                Your wallet has not processed any transactions yet. New payouts and charges will be recorded here.
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
                    <TableHead className="text-right font-medium text-muted-foreground">Wallet balance</TableHead>
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
                            variant={ STATUS_VARIANTS[row.status] }
                            className="text-[10px] uppercase font-semibold"
                          >
                            { STATUS_LABELS[row.status] }
                          </Badge>
                        ) }
                      </TableCell>
                      <TableCell className={ `py-3 ${row.isContra ? 'text-muted-foreground text-sm' : 'font-medium text-sm text-foreground'}` }>
                        { row.account }
                      </TableCell>
                      <TableCell className="py-3 text-xs text-muted-foreground">
                        { row.details }
                      </TableCell>
                      <TableCell className="py-3 text-right font-medium text-sm text-foreground/80">
                        { formatLedgerAmount(row.debitMinor, row.currency) }
                      </TableCell>
                      <TableCell className="py-3 text-right font-medium text-sm text-foreground/80">
                        { formatLedgerAmount(row.creditMinor, row.currency) }
                      </TableCell>
                      <TableCell className="py-3 text-right font-semibold text-sm text-foreground">
                        { formatLedgerAmount(row.balanceAfterMinor, row.currency) }
                      </TableCell>
                    </TableRow>
                  )) }
                </TableBody>
              </Table>
              
              { (hasNextPage || isFetching) && (
                <div className="flex flex-col items-center gap-2 border-t border-border/60 bg-muted/5 px-6 py-4">
                  { hasNextPage && (
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
                  ) }
                  { isFetching && !isFetchingNextPage && (
                    <p className="text-xs text-muted-foreground animate-pulse">
                      Syncing latest transactions...
                    </p>
                  ) }
                </div>
              ) }
            </div>
          ) }
        </CardContent>
      </Card>
    </section>
  );
}
