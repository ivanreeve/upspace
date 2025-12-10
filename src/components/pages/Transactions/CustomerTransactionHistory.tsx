'use client';

import { formatCurrencyMinor } from '@/lib/wallet';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
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

const PAYMENT_METHOD_LABELS: Record<string, string> = { paymongo: 'PayMongo', };

const LOCALE_OPTIONS = {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
} as const;

type CustomerTransactionHistoryProps = {
  transactions: CustomerTransactionRecord[];
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('en-PH', LOCALE_OPTIONS);

export function CustomerTransactionHistory(props: CustomerTransactionHistoryProps) {
  const { transactions, } = props;
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">
              Recent payments
            </CardTitle>
            <span className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
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
            <ScrollArea className="max-h-[640px] rounded-b-md border-t border-border/60 bg-card/80">
              <div className="space-y-4 p-6">
                { transactions.map((transaction) => {
                  const amountLabel = formatCurrencyMinor(
                    transaction.amountMinor,
                    transaction.currency
                  );
                  const feeLabel =
                    transaction.feeMinor !== null
                      ? formatCurrencyMinor(
                        transaction.feeMinor,
                        transaction.currency
                      )
                      : null;
                  const paymentLabel =
                    PAYMENT_METHOD_LABELS[transaction.paymentMethod] ??
                    transaction.paymentMethod;

                  return (
                    <article
                      key={ transaction.id }
                      className="group rounded-2xl border border-border/60 bg-background/70 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-border/80"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-semibold text-foreground">
                            { transaction.spaceName } · { transaction.areaName }
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Booking ID { transaction.bookingId }
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 text-right">
                          <p className="text-lg font-semibold text-foreground">
                            { amountLabel }
                          </p>
                          <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                            { formatDateTime(transaction.transactionCreatedAt) }
                          </span>
                          <Badge
                            variant={
                              BOOKING_STATUS_VARIANTS[transaction.bookingStatus]
                            }
                          >
                            { BOOKING_STATUS_LABELS[transaction.bookingStatus] }
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>
                          Booking placed { formatDateTime(transaction.bookingCreatedAt) }
                        </span>
                        <span>
                          { transaction.bookingHours } hour
                          { transaction.bookingHours === 1 ? '' : 's' }
                        </span>
                        <span>{ transaction.isLive ? 'Live' : 'Test' } payment</span>
                        <span>Method { paymentLabel }</span>
                        { feeLabel && <span>Paymongo fee { feeLabel }</span> }
                      </div>
                    </article>
                  );
                }) }
              </div>
            </ScrollArea>
          ) }
        </CardContent>
      </Card>
    </section>
  );
}
