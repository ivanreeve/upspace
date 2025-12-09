'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  type WalletTransactionStatus,
  type WalletTransactionType,
  useWallet,
  useWalletTopUp
} from '@/hooks/use-wallet';
import { formatCurrencyMinor } from '@/lib/wallet';

const TRANSACTION_TYPE_LABELS: Record<WalletTransactionType, string> = {
  cash_in: 'Top-up',
  charge: 'Booking charge',
  refund: 'Refund',
  payout: 'Payout',
};

const STATUS_BADGE_VARIANTS: Record<
  WalletTransactionStatus,
  'success' | 'secondary' | 'destructive'
> = {
  succeeded: 'success',
  pending: 'secondary',
  failed: 'destructive',
};

export default function WalletPage() {
  const {
 data, isError, isLoading, isFetching, 
} = useWallet();
  const topUpMutation = useWalletTopUp();
  const [amount, setAmount] = useState('');

  const transactions = useMemo(
    () => data?.transactions ?? [],
    [data?.transactions]
  );

  const availableBalance = data
    ? formatCurrencyMinor(data.wallet.balanceMinor, data.wallet.currency)
    : '₱0.00';

  const handleTopUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error('Enter a valid amount greater than zero.');
      return;
    }

    try {
      await topUpMutation.mutateAsync({ amount: parsedAmount, });
      toast.success('Wallet topped up.');
      setAmount('');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to top up your wallet right now.';
      toast.error(message);
    }
  };

  return (
  <div className="flex flex-col gap-6 px-4 py-2 sm:px-6">
    { /* Wallet Balance */ }
    <Card className="rounded-lg border border-[#FFFFFF] dark:border-neutral-600 bg-card p-4 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)] mt-8">
      <CardHeader className="p-0 mb-2">
        <CardTitle>Wallet balance</CardTitle>
        <CardDescription>
          Funds stay in your PayMongo wallet until you book.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0 space-y-2">
        <p className="text-4xl font-semibold">{ availableBalance }</p>
        <p className="text-sm text-muted-foreground">
          Top-ups are mirrored with PayMongo ledger entries so bookings can be charged instantly.
        </p>
      </CardContent>
    </Card>

    { /* Top Up Section */ }
    <Card className="rounded-lg border border-[#FFFFFF] dark:border-neutral-600 bg-card p-4 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)]
">
      <CardHeader className="p-0 mb-2">
        <CardTitle>Top up wallet</CardTitle>
        <CardDescription>
          Add funds using your linked PayMongo payment method.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        <form className="space-y-4" onSubmit={ handleTopUp }>
          <div className="space-y-1">
            <Label htmlFor="wallet-top-up-amount">Amount (PHP)</Label>
            <Input
              id="wallet-top-up-amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="500.00"
              value={ amount }
              onChange={ (event) => setAmount(event.target.value) }
              aria-describedby="wallet-top-up-help"
            />
            <p
              id="wallet-top-up-help"
              className="text-xs text-muted-foreground"
            >
              Amount will be charged via PayMongo.
            </p>
          </div>

          <Button
            type="submit"
            className="w-full rounded-md"
            disabled={ topUpMutation.isLoading }
          >
            { topUpMutation.isLoading ? 'Processing…' : 'Top up wallet' }
          </Button>
        </form>
      </CardContent>

      <CardFooter className="p-0 pt-3">
        <p className="text-xs text-muted-foreground">
          Update your default payment method in your PayMongo dashboard.
        </p>
      </CardFooter>
    </Card>

    { /* Recent Activity */ }
    <Card className="rounded-lg border border-[#FFFFFF] dark:border-neutral-600 bg-card p-4 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)]
">
      <CardHeader className="p-0 mb-2">
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>
          Synced with your PayMongo wallet ledger.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        { isError ? (
          <p className="text-sm text-muted-foreground">
            Unable to load transactions right now.
          </p>
        ) : isLoading || isFetching ? (
          <div className="space-y-2">
            <Skeleton className="h-12 rounded-md" />
            <Skeleton className="h-12 rounded-md" />
            <Skeleton className="h-12 rounded-md" />
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No wallet activity yet.
          </p>
        ) : (
          <ScrollArea className="max-h-[320px] rounded-md border border-border/50 p-1 bg-muted/20">
            <div className="space-y-3 p-2">
              { transactions.map((transaction) => {
                const timestamp = new Date(
                  transaction.createdAt
                ).toLocaleString('en-PH', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                });

                const label =
                  TRANSACTION_TYPE_LABELS[transaction.type] ||
                  'Transaction';
                const badgeVariant =
                  STATUS_BADGE_VARIANTS[transaction.status] ||
                  'secondary';
                const amountLabel = formatCurrencyMinor(
                  transaction.amountMinor,
                  transaction.currency
                );

                return (
                  <article
                    key={ transaction.id }
                    className="rounded-md border border-border/50 bg-card px-4 py-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-semibold">{ label }</p>
                        <p className="text-sm text-muted-foreground">
                          { timestamp }
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-semibold">
                          { amountLabel }
                        </p>
                        <Badge variant={ badgeVariant }>
                          { transaction.status }
                        </Badge>
                      </div>
                    </div>

                    { transaction.description && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        { transaction.description }
                      </p>
                    ) }
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