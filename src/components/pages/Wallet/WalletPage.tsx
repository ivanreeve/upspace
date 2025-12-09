'use client';

import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  type WalletTransactionStatus,
  type WalletTransactionType,
  useWallet
} from '@/hooks/use-wallet';
import { formatCurrencyMinor } from '@/lib/wallet';
import { useUserProfile } from '@/hooks/use-user-profile';

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
    data: userProfile,
    isLoading: isProfileLoading,
  } = useUserProfile();
  const isPartnerRole = userProfile?.role === 'partner';
  const {
    data,
    isError,
    isLoading,
    isFetching,
  } = useWallet({ enabled: isPartnerRole, });
  const transactions = useMemo(
    () => data?.transactions ?? [],
    [data?.transactions]
  );

  const availableBalance = data
    ? formatCurrencyMinor(data.wallet.balanceMinor, data.wallet.currency)
    : '₱0.00';

  if (isProfileLoading) {
    return (
      <div className="flex flex-col gap-6 px-4 py-2 sm:px-6">
        <Card className="rounded-lg border border-[#FFFFFF] dark:border-neutral-600 bg-card p-4 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)] mt-8">
          <CardHeader className="p-0 mb-2">
            <CardTitle>Checking wallet access</CardTitle>
            <CardDescription>
              Verifying your partner role before showing your PayMongo wallet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-6 rounded-md" />
            <Skeleton className="h-6 rounded-md w-3/4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isPartnerRole) {
    return (
      <div className="flex flex-col gap-6 px-4 py-2 sm:px-6">
        <Card className="rounded-lg border border-[#FFFFFF] dark:border-neutral-600 bg-card p-4 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)] mt-8">
          <CardHeader className="p-0 mb-2">
            <CardTitle>Partner wallet only</CardTitle>
            <CardDescription>
              Wallets are reserved for partners. Customers pay through the booking checkout, and funds are credited directly to the partner’s PayMongo balance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Need help or think you should have access? Contact your workspace admin or support to review your role.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-2 sm:px-6">
    { /* Wallet Balance */ }
    <Card className="rounded-lg border border-[#FFFFFF] dark:border-neutral-600 bg-card p-4 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)] mt-8">
      <CardHeader className="p-0 mb-2">
        <CardTitle>Partner wallet balance</CardTitle>
        <CardDescription>
          Funds stay in your PayMongo partner wallet until bookings settle.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0 space-y-2">
        <p className="text-4xl font-semibold">{ availableBalance }</p>
        <p className="text-sm text-muted-foreground">
          Top-ups and booking charges are tracked through PayMongo ledger entries so your partner balance stays in sync.
        </p>
      </CardContent>
    </Card>
      <Card className="rounded-lg border border-[#FFFFFF] dark:border-neutral-600 bg-card shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
        <CardHeader>
          <CardTitle>Withdrawals handled in PayMongo</CardTitle>
          <CardDescription>
            Booking payouts land directly in your partner wallet automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Top-ups are disabled—this balance represents funds collected from bookings that PayMongo released to you. To move money out, initiate payouts or withdrawals from the PayMongo dashboard you linked during onboarding.
          </p>
          <p className="text-sm text-muted-foreground">
            If you need help withdrawing, contact PayMongo support or reach out to our team so we can guide you through the process.
          </p>
        </CardContent>
      </Card>

    { /* Recent Activity */ }
    <Card className="rounded-lg border border-[#FFFFFF] dark:border-neutral-600 bg-card p-4 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
      <CardHeader className="p-0 mb-2">
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>
          Synced with your PayMongo partner wallet ledger.
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
