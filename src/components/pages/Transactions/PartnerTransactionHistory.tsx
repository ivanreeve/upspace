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
          Posted as double-entry journal lines for wallet cash, payouts, charges, and refunds.
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
                ? LEDGER_TYPE_CONFIG[latestTransaction.type].typeLabel
                : 'Awaiting first transaction' }
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border/70 bg-card/70">
        <CardHeader className="flex flex-col gap-1 px-6 py-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <CardTitle className="text-lg font-semibold text-foreground">
              Double-entry ledger
            </CardTitle>
            <span className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
              { transactions.length } transactions
            </span>
          </div>
          <CardDescription className="text-sm text-muted-foreground">
            Each transaction is shown as debit and credit journal lines. Running balance is tracked on the wallet account line.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          { isLoading ? (
            <div className="p-6">
              <Table>
                <TableHeader>
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
                    { ledgerRows.map((row) => (
                      <TableRow key={ row.id } className={ row.isContra ? 'bg-muted/25' : undefined }>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          { row.isContra ? '' : formatDateTime(row.postedAt) }
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          { row.reference }
                        </TableCell>
                        <TableCell>
                          { row.isContra ? (
                            <span className="text-xs text-muted-foreground">Contra</span>
                          ) : (
                            <Badge variant={ STATUS_VARIANTS[row.status] }>
                              { STATUS_LABELS[row.status] }
                            </Badge>
                          ) }
                        </TableCell>
                        <TableCell className={ row.isContra ? 'text-muted-foreground' : 'font-medium' }>
                          { row.account }
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          { row.details }
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          { formatLedgerAmount(row.debitMinor, row.currency) }
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          { formatLedgerAmount(row.creditMinor, row.currency) }
                        </TableCell>
                        <TableCell className="text-right font-semibold text-foreground">
                          { formatLedgerAmount(row.balanceAfterMinor, row.currency) }
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
