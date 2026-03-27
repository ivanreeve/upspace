'use client';

import { useEffect } from 'react';
import {
FiRefreshCw,
FiShield,
FiAlertTriangle,
FiActivity
} from 'react-icons/fi';
import { toast } from 'sonner';

import { useAdminReconciliationQuery, useRunAdminReconciliationMutation } from '@/hooks/api/useAdminReconciliation';
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

const numberFormatter = new Intl.NumberFormat('en-US');

const HEALTH_VARIANTS = {
  healthy: 'success',
  stale: 'secondary',
  failed: 'destructive',
  action_required: 'outline',
} as const;

const HEALTH_LABELS = {
  healthy: 'Healthy',
  stale: 'Stale',
  failed: 'Failed',
  action_required: 'Action required',
} as const;

const formatCount = (value: number) => numberFormatter.format(value);

const formatMinor = (value: string | null, currency: string | null) =>
  value && currency ? formatCurrencyMinor(value, currency) : '-';

const TableSkeletonRows = () => (
  <>
    { Array.from({ length: 5, }).map((_, index) => (
      <TableRow key={ `reconciliation-skeleton-${index}` }>
        { Array.from({ length: 9, }).map((__, cellIndex) => (
          <TableCell key={ `reconciliation-skeleton-${index}-${cellIndex}` }>
            <Skeleton className="h-4 w-full" />
          </TableCell>
        )) }
      </TableRow>
    )) }
  </>
);

export function AdminReconciliationPage() {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useAdminReconciliationQuery();
  const runReconciliation = useRunAdminReconciliationMutation();

  useEffect(() => {
    if (isError) {
      toast.error(error instanceof Error ? error.message : 'Unable to load reconciliation data.');
    }
  }, [error, isError]);

  const handleRun = () => {
    runReconciliation.mutate(undefined, {
      onSuccess: (result) => {
        toast.success(
          `Reconciliation checked ${formatCount(result.checkedAccounts)} accounts and refreshed ${formatCount(result.syncedAccounts)}.`
        );
        void refetch();
      },
      onError: (mutationError) => {
        toast.error(mutationError.message);
      },
    });
  };

  if (isError && !data) {
    return (
      <div className="w-full px-4 pb-8 sm:px-6 lg:px-8">
        <section className="space-y-6 py-8 md:space-y-8 md:py-12">
          <div className="rounded-md border border-border/70 bg-background/80 px-6 py-12 text-center">
            <SystemErrorIllustration />
            <p className="mt-4 text-sm text-muted-foreground">
              { error instanceof Error ? error.message : 'Unable to load reconciliation data.' }
            </p>
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={ () => void refetch() }>
                Try again
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="w-full px-4 pb-8 sm:px-6 lg:px-8">
      <section className="space-y-6 py-8 md:space-y-8 md:py-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Provider Reconciliation
            </h1>
            <p className="text-sm text-muted-foreground md:text-base">
              Inspect provider-backed wallet health, stale syncs, mismatches, and pending financial actions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2 rounded-md"
              onClick={ handleRun }
              disabled={ runReconciliation.isPending }
            >
              <FiRefreshCw className="size-4" aria-hidden="true" />
              { runReconciliation.isPending ? 'Running...' : 'Run reconciliation' }
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-md">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <FiShield className="size-4" aria-hidden="true" />
                Healthy accounts
              </CardTitle>
              <CardDescription>Provider accounts with fresh synced balances and no wallet drift.</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              { isLoading ? <Skeleton className="h-8 w-20" /> : formatCount(data?.summary.liveAccounts ?? 0) }
            </CardContent>
          </Card>
          <Card className="rounded-md">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <FiAlertTriangle className="size-4" aria-hidden="true" />
                Stale or failed
              </CardTitle>
              <CardDescription>Accounts that need a sync refresh or provider-side review.</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              { isLoading ? <Skeleton className="h-8 w-20" /> : formatCount((data?.summary.staleAccounts ?? 0) + (data?.summary.failedAccounts ?? 0)) }
            </CardContent>
          </Card>
          <Card className="rounded-md">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <FiActivity className="size-4" aria-hidden="true" />
                Pending provider payouts
              </CardTitle>
              <CardDescription>Payouts already submitted to Xendit but not yet finalized locally.</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              { isLoading ? <Skeleton className="h-8 w-20" /> : formatCount(data?.summary.pendingProviderPayouts ?? 0) }
            </CardContent>
          </Card>
          <Card className="rounded-md">
            <CardHeader className="space-y-1">
              <CardTitle className="text-base">Wallet mismatches</CardTitle>
              <CardDescription>Accounts where local wallet balance does not match the latest provider snapshot.</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              { isLoading ? <Skeleton className="h-8 w-20" /> : formatCount(data?.summary.mismatchedAccounts ?? 0) }
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-md">
          <CardHeader className="space-y-1">
            <CardTitle>Account Health</CardTitle>
            <CardDescription>
              { isFetching ? 'Refreshing provider health...' : 'Latest provider-account reconciliation snapshot.' }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Mismatch</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Synced</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                { isLoading ? <TableSkeletonRows /> : null }
                { !isLoading && !data?.rows.length ? (
                  <TableRow>
                    <TableCell colSpan={ 9 } className="py-8 text-center text-sm text-muted-foreground">
                      No provider accounts found.
                    </TableCell>
                  </TableRow>
                ) : null }
                { data?.rows.map((row) => (
                  <TableRow key={ row.localProviderAccountId }>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{ row.partnerName ?? row.partnerHandle }</p>
                        <p className="text-xs text-muted-foreground">@{ row.partnerHandle }</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant={ HEALTH_VARIANTS[row.health] }>
                          { HEALTH_LABELS[row.health] }
                        </Badge>
                        <p className="text-xs text-muted-foreground">{ row.providerStatus }</p>
                      </div>
                    </TableCell>
                    <TableCell>{ formatMinor(row.walletBalanceMinor, row.walletCurrency) }</TableCell>
                    <TableCell>{ formatMinor(row.providerAvailableBalanceMinor, row.providerCurrency) }</TableCell>
                    <TableCell>{ formatMinor(row.expectedWalletBalanceMinor, row.walletCurrency) }</TableCell>
                    <TableCell>
                      { row.mismatchMinor === null
                        ? '-'
                        : formatMinor(row.mismatchMinor, row.walletCurrency) }
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      { row.pendingProviderPayoutCount } payouts / { row.pendingRefundCount } refunds
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      { row.latestSnapshotFetchedAt
                        ? new Date(row.latestSnapshotFetchedAt).toLocaleString()
                        : '-' }
                    </TableCell>
                    <TableCell className="max-w-[240px] text-sm text-muted-foreground">
                      { row.latestFailureReason ?? (row.remoteProviderAccountId ? row.remoteProviderAccountId : 'No remote account id') }
                    </TableCell>
                  </TableRow>
                )) }
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
