'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { FiChevronLeft } from 'react-icons/fi';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUserProfile } from '@/hooks/use-user-profile';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { DEACTIVATION_REASON_OPTIONS, type DeactivationReasonCategory } from '@/lib/deactivation-requests';

export default function AccountPage() {
  const { data: profile, } = useUserProfile();
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<DeactivationReasonCategory>('not_using');
  const [customReason, setCustomReason] = useState('');
  const [isDeactivating, setIsDeactivating] = useState(false);

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    const { error, } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign-out failed', error);
    }
    await router.push('/');
  };

  const handleDeactivateAccount = () => {
    setIsDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (isDeactivating) {
      return;
    }
    setIsDialogOpen(open);
  };

  const handleSubmitDeactivationRequest = async () => {
    if (!selectedReason) {
      toast.error('Please select a reason before submitting.');
      return;
    }

    if (selectedReason === 'other' && !customReason.trim()) {
      toast.error('Please share a bit more about your “Other” reason.');
      return;
    }

    setIsDeactivating(true);

    try {
      const response = await fetch('/api/v1/auth/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          reason_category: selectedReason,
          custom_reason: customReason.trim() || undefined,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message ?? 'Unable to send deactivation request right now.');
      }

      toast.success('Deactivation request submitted. We’ll notify you once it is processed.');
      setIsDialogOpen(false);
      setSelectedReason('not_using');
      setCustomReason('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to deactivate your account.';
      toast.error(message);
    } finally {
      setIsDeactivating(false);
    }
  };

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

          <section className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">Deactivate account</h2>
              <p className="text-sm text-muted-foreground">
                Disabling your account locks your profile and removes it from public search until you reactivate.
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
                    { isDeactivating ? 'Submitting request...' : 'Deactivate account' }
                  </Button>
            </div>
          </section>
        </div>
      </main>
      <Dialog open={ isDialogOpen } onOpenChange={ handleDialogOpenChange }>
        <DialogContent fullWidth>
          <DialogHeader>
            <DialogTitle>Request account deactivation</DialogTitle>
            <DialogDescription>
              Select the best reason so our team can prioritize your request.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-3">
            { DEACTIVATION_REASON_OPTIONS.map((option) => {
              const isSelected = selectedReason === option.value;
              return (
                <button
                  key={ option.value }
                  type="button"
                  onClick={ () => setSelectedReason(option.value) }
                  className={ cn(
                    'flex w-full flex-col gap-1 rounded-lg border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    isSelected
                      ? 'border-primary/80 bg-primary/5'
                      : 'border-border/60 hover:border-foreground/60 focus-visible:border-primary'
                  ) }
                >
                  <span className="text-sm font-semibold text-foreground">{ option.label }</span>
                  <span className="text-xs text-muted-foreground">{ option.description }</span>
                </button>
              );
            }) }
          </div>
          { selectedReason === 'other' && (
            <div className="mt-6 space-y-2">
              <Label htmlFor="deactivation-other-reason">Tell us more</Label>
              <Textarea
                id="deactivation-other-reason"
                value={ customReason }
                onChange={ (event) => setCustomReason(event.target.value) }
                placeholder="Describe why you want to deactivate your account."
                rows={ 4 }
                maxLength={ 350 }
                aria-label="Additional reason for deactivation"
              />
              <p className="text-xs text-muted-foreground">
                { customReason.length } / 350 characters
              </p>
            </div>
          ) }
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={ () => setIsDialogOpen(false) }
              disabled={ isDeactivating }
               className="hover:text-white"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={ handleSubmitDeactivationRequest }
              disabled={ isDeactivating }
            >
              { isDeactivating ? 'Submitting...' : 'Submit deactivation request' }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
