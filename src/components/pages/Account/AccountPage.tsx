'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { FiChevronLeft } from 'react-icons/fi';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useUserProfile } from '@/hooks/use-user-profile';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function AccountPage() {
  const { data: profile, } = useUserProfile();
  const router = useRouter();
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [deletionDeadline, setDeletionDeadline] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    const { error, } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign-out failed', error);
    }
    await router.push('/');
  };

  const handleDeactivateAccount = async () => {
    if (!window.confirm('Requesting deactivation will disable access to your account. You can reactivate anytime by logging back in. Proceed?')) {
      return;
    }

    setIsDeactivating(true);
    try {
      const response = await fetch('/api/v1/auth/deactivate', { method: 'POST', });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message ?? 'Unable to schedule deactivation right now.');
      }

      toast.success('Account deactivated. You can reactivate anytime by logging back in.');
      await handleSignOut();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to deactivate your account.';
      toast.error(message);
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Requesting deletion will permanently remove your data after 30 days unless you sign in again. Proceed?')) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch('/api/v1/auth/delete', { method: 'POST', });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message ?? 'Unable to schedule deletion right now.');
      }

      toast.success('Account deletion scheduled. Log in within 30 days to cancel the request.');
      setDeletionDeadline(payload?.reactivationDeadline ?? null);
      await handleSignOut();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete your account.';
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const formattedDeletionDeadline = deletionDeadline
    ? new Date(deletionDeadline).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const isAdminRole = profile?.role === 'admin';

  return (
    <>
      <main className="flex-1 overflow-y-auto bg-background px-4 pb-10 sm:py-12">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <header className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground md:hidden">
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <FiChevronLeft className="size-4" aria-hidden="true" />
                <span>Back to Home</span>
              </Link>
            </div>
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
                Account
              </h1>
            </div>
            <p className="text-sm text-muted-foreground sm:text-base">
              Manage your account access and data preferences.
            </p>
          </header>

          <Card className="border border-border/60 bg-card/80 shadow-sm shadow-slate-900/5">
            <CardContent className="p-6 sm:p-10 space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-foreground">Deactivate account</h2>
                <p className="text-sm text-muted-foreground">
                  Disabling your account locks your profile and removes it from public search until you reactivate.
                </p>
                <p className="text-xs text-muted-foreground">
                  This is different from deleting your account—deactivation is temporary and reversible, while deletion permanently removes your data.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full sm:w-auto"
                  onClick={ handleDeactivateAccount }
                  disabled={ isDeactivating }
                >
                  { isDeactivating ? 'Deactivating...' : 'Deactivate account' }
                </Button>
                <p className="text-xs text-muted-foreground">
                  Reactivate instantly by signing back in.
                </p>
              </div>
            </CardContent>
          </Card>
          { isAdminRole && (
            <Card className="border border-border/60 bg-card/80 shadow-sm shadow-slate-900/5">
              <CardContent className="p-6 sm:p-10 space-y-6">
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-foreground">Delete account</h2>
                  <p className="text-sm text-muted-foreground">
                    Deletion permanently removes your profile, bookings, and usage data. This cannot be undone.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Submitting a deletion request schedules permanent removal in 30 days unless you log back in.
                  </p>
                  { formattedDeletionDeadline ? (
                    <p className="text-xs text-muted-foreground">
                      Your deletion window ends on { formattedDeletionDeadline }.
                    </p>
                  ) : null }
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full sm:w-auto"
                    onClick={ handleDeleteAccount }
                    disabled={ isDeleting }
                  >
                    { isDeleting ? 'Scheduling deletion...' : 'Schedule deletion' }
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Need details? <Link href="/data-deletion" className="underline">Review the deletion guide</Link>.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) }
        </div>
      </main>
    </>
  );
}
