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

const BOOKING_STATUS_VARIANTS: Record<
  CustomerTransactionBookingStatus,
  'secondary' | 'success' | 'destructive'
> = {
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

const BOOKING_STATUS_LABELS: Record<
  CustomerTransactionBookingStatus,
  string
> = {
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

type CustomerTransactionHistoryProps = {
  transactions: CustomerTransactionRecord[];
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export function CustomerTransactionHistory({ transactions, }: CustomerTransactionHistoryProps) {
  const hasTransactions = transactions.length > 0;

  return (
    <div className="flex flex-col gap-6 px-4 py-2 sm:px-6">
      <Card className="rounded-md border border-border bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle>Transaction history</CardTitle>
          <CardDescription>
            A record of every booking payment you completed through UpSpace.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="rounded-md border border-border bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle>Recent payments</CardTitle>
          <CardDescription>
            Showing the latest { transactions.length } transactions linked to
            your bookings.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          { !hasTransactions ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              You have no completed booking payments yet. Every paid booking
              appears here for your reference.
            </div>
          ) : (
            <ScrollArea className="max-h-[680px] rounded-b-md border-t border-border/70 bg-card/75">
              <div className="space-y-4 p-4">
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
                      className="rounded-md border border-border/60 bg-background/70 p-4 shadow-sm"
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
                          <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
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

                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
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
    </div>
  );
}
