'use client';

import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { useEnablePartnerProviderAccountMutation, usePartnerProviderAccountQuery, useRefreshPartnerProviderAccountMutation } from '@/hooks/api/usePartnerProviderAccount';
import { formatCurrencyMinor } from '@/lib/wallet';

const statusBadgeClassNames: Record<
  'not_enabled' | 'creating' | 'ready' | 'action_required' | 'error',
  string
> = {
  not_enabled: 'border-border/70 bg-background text-muted-foreground',
  creating: 'border-primary/20 bg-primary/10 text-primary',
  ready: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
  action_required: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
  error: 'border-destructive/30 bg-destructive/10 text-destructive',
};

function formatSyncTimestamp(value: string | null) {
  if (!value) {
    return 'Not synced yet';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not synced yet';
  }

  return date.toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function PartnerPayoutSetupCard() {
  const statusQuery = usePartnerProviderAccountQuery();
  const enableMutation = useEnablePartnerProviderAccountMutation();
  const refreshMutation = useRefreshPartnerProviderAccountMutation();

  const status = statusQuery.data;
  const isBusy = enableMutation.isPending || refreshMutation.isPending;

  const handleEnable = async () => {
    try {
      const payload = await enableMutation.mutateAsync();
      toast.success(
        payload.setupState === 'ready'
          ? 'Payouts enabled.'
          : 'Payout setup started. Refresh in a moment if the status is still pending.'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to enable payouts.';
      toast.error(message);
    }
  };

  const handleRefresh = async () => {
    try {
      await refreshMutation.mutateAsync();
      toast.success('Payout setup refreshed.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to refresh payout setup.';
      toast.error(message);
    }
  };

  return (
    <Card className="gap-4 overflow-hidden border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/60 bg-muted/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-xl">Payout setup</CardTitle>
            <CardDescription>
              Link your partner profile to the Xendit payout rail so future booking revenue and withdrawals can move through the provider instead of manual admin handling.
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={ status ? statusBadgeClassNames[status.setupState] : statusBadgeClassNames.not_enabled }
          >
            { status?.statusLabel ?? 'Loading' }
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        { statusQuery.isLoading ? (
          <div className="rounded-md border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Loading payout setup…
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-border/60 bg-background px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Provider
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  Xendit{ status?.accountType ? ` · ${status.accountType}` : '' }
                </p>
              </div>
              <div className="rounded-md border border-border/60 bg-background px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Account reference
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  { status?.providerAccountReference ?? 'Not created yet' }
                </p>
              </div>
              <div className="rounded-md border border-border/60 bg-background px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Provider balance
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  { status?.availableBalanceMinor && status.currency
                    ? formatCurrencyMinor(status.availableBalanceMinor, status.currency)
                    : 'Unavailable until provider sync completes' }
                </p>
              </div>
              <div className="rounded-md border border-border/60 bg-background px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Last synced
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  { formatSyncTimestamp(status?.lastSyncedAt ?? null) }
                </p>
              </div>
            </div>

            <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{ status?.statusMessage ?? 'Loading payout setup…' }</p>
              { status?.syncWarning ? (
                <p className="mt-2 text-sm text-amber-700">
                  Latest provider sync warning: { status.syncWarning }
                </p>
              ) : null }
            </div>

            <div className="flex flex-wrap gap-3">
              { status?.setupState === 'not_enabled' || status?.setupState === 'error' ? (
                <Button
                  type="button"
                  onClick={ handleEnable }
                  disabled={ isBusy }
                  aria-label="Enable payouts through Xendit"
                >
                  { enableMutation.isPending ? 'Enabling payouts…' : 'Enable payouts' }
                </Button>
              ) : null }
              <Button
                type="button"
                variant="outline"
                onClick={ handleRefresh }
                disabled={ isBusy || statusQuery.isLoading }
                aria-label="Refresh payout provider status"
              >
                { refreshMutation.isPending ? 'Refreshing…' : 'Refresh status' }
              </Button>
            </div>
          </>
        ) }
      </CardContent>
    </Card>
  );
}
