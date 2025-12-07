'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiChevronLeft } from 'react-icons/fi';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUserProfile } from '@/hooks/use-user-profile';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { DEACTIVATION_REASON_OPTIONS, type DeactivationReasonCategory } from '@/lib/deactivation-requests';

const PROFILE_FIELD_MAX_LENGTH = 50;

export default function AccountPage() {
  const { data: profile, } = useUserProfile();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [isProfileSaving, setIsProfileSaving] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<DeactivationReasonCategory>('not_using');
  const [customReason, setCustomReason] = useState('');
  const [selectedDeleteReason, setSelectedDeleteReason] = useState<DeactivationReasonCategory>('not_using');
  const [customDeleteReason, setCustomDeleteReason] = useState('');
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!profile) {
      return;
    }

    setFirstName(profile.firstName ?? '');
    setMiddleName(profile.middleName ?? '');
    setLastName(profile.lastName ?? '');
    setBirthday(profile.birthday ?? '');
  }, [profile]);

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    const { error, } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign-out failed', error);
    }
    await router.push('/');
  };

  const handleDeactivateAccount = () => setIsDialogOpen(true);
  const handleDeleteAccount = () => setIsDeleteDialogOpen(true);

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
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          reason_category: selectedReason,
          custom_reason: customReason.trim() || undefined,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message ?? 'Unable to submit your deactivation request.');
      }

      toast.success('Deactivation request submitted. We’ll notify you once it is processed.');
      setIsDialogOpen(false);
      setSelectedReason('not_using');
      setCustomReason('');
      await handleSignOut();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to deactivate your account.';
      toast.error(message);
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleSubmitDeletionRequest = async () => {
    if (!selectedDeleteReason) {
      toast.error('Please select a reason before submitting.');
      return;
    }

    if (selectedDeleteReason === 'other' && !customDeleteReason.trim()) {
      toast.error('Please share a bit more about your “Other” reason.');
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch('/api/v1/auth/delete', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          reason_category: selectedDeleteReason,
          custom_reason: customDeleteReason.trim() || undefined,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message ?? 'Unable to request deletion right now.');
      }

      const statusMessage =
        payload?.status === 'requested'
          ? 'Deletion request submitted. We’ll notify you once it is reviewed.'
          : 'Deletion scheduled. You can cancel by signing in within 30 days.';

      toast.success(statusMessage);
      setIsDeleteDialogOpen(false);
      setSelectedDeleteReason('not_using');
      setCustomDeleteReason('');
      await handleSignOut();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete your account.';
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveProfile = async () => {
    const birthdayValue = birthday ? birthday.trim() : null;
    if (birthdayValue && !/^\d{4}-\d{2}-\d{2}$/.test(birthdayValue)) {
      toast.error('Birthday must be in YYYY-MM-DD format.');
      return;
    }

    setIsProfileSaving(true);

    try {
      const response = await fetch('/api/v1/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          firstName: firstName.trim() || null,
          middleName: middleName.trim() || null,
          lastName: lastName.trim() || null,
          birthday: birthdayValue ?? null,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message ?? 'Unable to save your profile.');
      }

      await queryClient.invalidateQueries({ queryKey: ['user-profile'], });
      toast.success('Profile updated.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save your profile right now.';
      toast.error(message);
    } finally {
      setIsProfileSaving(false);
    }
  };

  return (
    <>
      <main className="flex-1 overflow-y-auto bg-background px-4 pb-12 sm:py-12">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
          <header className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground md:hidden">
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <FiChevronLeft className="size-4" aria-hidden="true" />
                <span>Back to Home</span>
              </Link>
            </div>
            <div className="rounded-md border border-border/70 bg-gradient-to-br from-primary/10 via-background to-background px-4 py-5 shadow-sm sm:px-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
                    Account
                  </h1>
                  <p className="text-sm text-muted-foreground sm:text-base">
                    Tune your profile details and manage how your data is handled across UpSpace.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                    { profile?.role === 'partner' ? 'Partner profile' : profile?.role === 'admin' ? 'Admin' : 'Customer profile' }
                  </span>
                  { profile?.status ? (
                    <span className="rounded-md border border-border/60 px-3 py-1 text-xs font-medium text-muted-foreground">
                      Status: { profile.status.replace(/_/g, ' ') }
                    </span>
                  ) : null }
                </div>
              </div>
            </div>
          </header>

          <div className="grid gap-6 lg:grid-cols-[1.65fr,1fr]">
            <section className="space-y-4 rounded-md border border-border/70 bg-card/80 p-6 shadow-sm backdrop-blur">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Profile information</h2>
                  <p className="text-sm text-muted-foreground">
                    Keep your details current so bookings and receipts look right.
                  </p>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  Max { PROFILE_FIELD_MAX_LENGTH } characters per field
                </span>
              </div>

              <div className="flex flex-col gap-2 rounded-md border border-border/70 bg-background/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Handle</p>
                  <p className="text-xs text-muted-foreground">
                    Handles stay fixed after sign up to keep links stable.
                  </p>
                </div>
                <span className="rounded-md bg-muted px-3 py-2 text-sm font-semibold text-foreground">
                  @{ profile?.handle ?? 'not-set' }
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">First name</span>
                  <Input
                    value={ firstName }
                    onChange={ (event) => setFirstName(event.target.value) }
                    maxLength={ PROFILE_FIELD_MAX_LENGTH }
                    placeholder="Taylor"
                    aria-label="First name"
                  />
                </Label>
                <Label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">Middle name</span>
                  <Input
                    value={ middleName }
                    onChange={ (event) => setMiddleName(event.target.value) }
                    maxLength={ PROFILE_FIELD_MAX_LENGTH }
                    placeholder="A."
                    aria-label="Middle name"
                  />
                </Label>
                <Label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">Last name</span>
                  <Input
                    value={ lastName }
                    onChange={ (event) => setLastName(event.target.value) }
                    maxLength={ PROFILE_FIELD_MAX_LENGTH }
                    placeholder="Reeves"
                    aria-label="Last name"
                  />
                </Label>
                <Label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">Birthday</span>
                  <Input
                    type="date"
                    value={ birthday }
                    onChange={ (event) => setBirthday(event.target.value) }
                    aria-label="Birthday"
                  />
                  <span className="text-xs text-muted-foreground">
                    Optional. Used to personalize reminders and receipts.
                  </span>
                </Label>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={ handleSaveProfile }
                  disabled={ isProfileSaving }
                >
                  { isProfileSaving ? 'Saving...' : 'Save changes' }
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={ handleSignOut }
                >
                  Sign out
                </Button>
              </div>
            </section>

            <section className="space-y-4 rounded-md border border-border/70 bg-muted/30 p-6 shadow-sm">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-foreground">Profile health</h2>
                <p className="text-sm text-muted-foreground">
                  Make sure your partner storefront or bookings carry the right signature.
                </p>
              </div>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-3 rounded-md border border-border/60 bg-background/80 p-3">
                  <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-foreground">Live profile</p>
                    <p>
                      { profile?.role === 'partner'
                        ? 'Partners show their handle and contact on listings.'
                        : 'Customers use their name and handle for bookings and messaging.' }
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-md border border-border/60 bg-background/80 p-3">
                  <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-foreground">Data ownership</p>
                    <p>
                      You stay in control of your account with quick deactivation and deletion flows below.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-4 rounded-md border border-border/70 bg-card/80 p-6 shadow-sm">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-foreground">Deactivate account</h2>
                <p className="text-sm text-muted-foreground">
                  Disables sign-in, hides your profile, and pauses storefront visibility for partners.
                </p>
                <ul className="list-inside list-disc text-xs text-muted-foreground">
                  <li>Reactivation brings back all bookings and workspace history.</li>
                  <li>No data is deleted during deactivation.</li>
                </ul>
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

            <section className="space-y-4 rounded-md border border-border/70 bg-card/80 p-6 shadow-sm">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-foreground">Delete account</h2>
                <p className="text-sm text-muted-foreground">
                  { profile?.role === 'partner'
                    ? 'Submit a delete request for admin review. Approved requests enter a 30-day window.'
                    : 'Delete your account with a 30-day grace period. Signing in during that window cancels deletion.' }
                </p>
                <ul className="list-inside list-disc text-xs text-muted-foreground">
                  <li>Bookings and payouts tied to your account will stop.</li>
                  <li>You can cancel deletion at any time during the 30-day window.</li>
                </ul>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={ handleDeleteAccount }
                  disabled={ isDeleting }
                >
                  { isDeleting ? 'Submitting request...' : 'Delete account' }
                </Button>
              </div>
            </section>
          </div>
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
                    'flex w-full flex-col gap-1 rounded-md border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
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

      <Dialog open={ isDeleteDialogOpen } onOpenChange={ setIsDeleteDialogOpen }>
        <DialogContent fullWidth>
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
            <DialogDescription>
              Deletion enters a 30-day window. Signing in during that time cancels the deletion.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-3">
            { DEACTIVATION_REASON_OPTIONS.map((option) => {
              const isSelected = selectedDeleteReason === option.value;
              return (
                <button
                  key={ option.value }
                  type="button"
                  onClick={ () => setSelectedDeleteReason(option.value) }
                  className={ cn(
                    'flex w-full flex-col gap-1 rounded-md border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
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
          { selectedDeleteReason === 'other' && (
            <div className="mt-6 space-y-2">
              <Label htmlFor="deletion-other-reason">Tell us more</Label>
              <Textarea
                id="deletion-other-reason"
                value={ customDeleteReason }
                onChange={ (event) => setCustomDeleteReason(event.target.value) }
                placeholder="Describe why you want to delete your account."
                rows={ 4 }
                maxLength={ 350 }
                aria-label="Additional reason for deletion"
              />
              <p className="text-xs text-muted-foreground">
                { customDeleteReason.length } / 350 characters
              </p>
            </div>
          ) }
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={ () => setIsDeleteDialogOpen(false) }
              disabled={ isDeleting }
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={ handleSubmitDeletionRequest }
              disabled={ isDeleting }
            >
              { isDeleting ? 'Submitting...' : 'Request deletion' }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
