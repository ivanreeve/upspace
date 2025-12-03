'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDownIcon } from 'lucide-react';
import { CgSpinner } from 'react-icons/cg';
import { FiChevronLeft } from 'react-icons/fi';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useSession } from '@/components/auth/SessionProvider';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { ALLOWED_USER_ROLES, type AllowedUserRole } from '@/lib/user-roles';

type FormState = {
  firstName: string;
  middleName: string;
  lastName: string;
};

type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type SavePayload = {
  firstName: string;
  middleName: string;
  lastName: string;
  role: AllowedUserRole;
  birthday?: string;
};

function formatBirthday(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function AccountPage() {
  const {
    data: profile,
    isLoading,
  } = useUserProfile();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { session, } = useSession();
  const [initialBirthday, setInitialBirthday] = useState<string | null>(null);
  const [initialForm, setInitialForm] = useState<FormState>({
    firstName: '',
    middleName: '',
    lastName: '',
  });
  const [justSaved, setJustSaved] = useState(false);

  const [passwordForm, setPasswordForm] = useState<PasswordFormState>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [deletionDeadline, setDeletionDeadline] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formState, setFormState] = useState<FormState>({
    firstName: '',
    middleName: '',
    lastName: '',
  });
  const [birthday, setBirthday] = useState<Date | undefined>(undefined);
  const [isBirthdayOpen, setBirthdayOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasPasswordIdentity = Boolean(
    session?.user?.identities?.some((identity) => identity?.provider === 'email')
  );
  const handleSignOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { error, } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign-out failed', error);
    }
    await router.push('/');
  }, [router]);

  useEffect(() => {
    if (!profile) return;

    setFormState({
      firstName: profile.firstName ?? '',
      middleName: profile.middleName ?? '',
      lastName: profile.lastName ?? '',
    });
    setInitialForm({
      firstName: profile.firstName ?? '',
      middleName: profile.middleName ?? '',
      lastName: profile.lastName ?? '',
    });
    setInitialBirthday(profile.birthday ?? null);
    setBirthday(profile.birthday ? new Date(`${profile.birthday}T00:00:00Z`) : undefined);
  }, [profile]);

  const isSaveDisabled = useMemo(() => {
    const trimmedFirst = formState.firstName.trim();
    const trimmedLast = formState.lastName.trim();
    return !trimmedFirst || !trimmedLast || isSubmitting;
  }, [formState.firstName, formState.lastName, isSubmitting]);

  const handleInputChange =
    (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setFormState((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
  };

  const handleReset = () => {
    if (!profile) return;
    setFormState(initialForm);
    setBirthday(initialBirthday ? new Date(`${initialBirthday}T00:00:00Z`) : undefined);
    setJustSaved(false);
  };

  const passwordMismatch =
    Boolean(passwordForm.newPassword) &&
    Boolean(passwordForm.confirmPassword) &&
    passwordForm.newPassword !== passwordForm.confirmPassword;
  const isPasswordChangeDisabled =
    isPasswordSubmitting ||
    !passwordForm.currentPassword ||
    !passwordForm.newPassword ||
    !passwordForm.confirmPassword ||
    passwordMismatch;

  const handlePasswordInputChange =
    (field: keyof PasswordFormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setPasswordForm((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
    };

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (passwordMismatch) {
      toast.error('New passwords must match.');
      return;
    }

    setIsPasswordSubmitting(true);
    try {
      const response = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message ?? 'Unable to update your password right now.');
      }

      toast.success('Password updated.');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update your password.';
      toast.error(message);
    } finally {
      setIsPasswordSubmitting(false);
    }
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedFirst = formState.firstName.trim();
    const trimmedLast = formState.lastName.trim();

    if (!trimmedFirst || !trimmedLast) {
      toast.error('Please complete required fields before saving.');
      return;
    }

    if (!profile) {
      toast.error('Unable to update your profile right now.');
      return;
    }

    const validRole =
      ALLOWED_USER_ROLES.includes(profile.role as AllowedUserRole)
        ? (profile.role as AllowedUserRole)
        : 'customer';

    const payload: SavePayload = {
      firstName: trimmedFirst,
      middleName: formState.middleName.trim(),
      lastName: trimmedLast,
      role: validRole,
      birthday: birthday ? formatBirthday(birthday) : undefined,
    };

    void performSave(payload);
  };

  const performSave = async (payload: SavePayload) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/v1/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? 'Unable to update your profile right now.');
      }

      toast.success('Profile updated.');
      queryClient.invalidateQueries({
        queryKey: ['user-profile'],
        exact: true,
      }).catch(() => undefined);
      setJustSaved(true);
      void router.refresh();
      setTimeout(() => {
        setJustSaved(false);
      }, 1500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
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
              Update your personal details so bookings and verifications stay accurate.
            </p>
          </header>

          <Card className="border border-border/60 bg-card/80 shadow-sm shadow-slate-900/5">
            <CardContent className="p-6 sm:p-10 space-y-8">
              { isLoading ? (
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Skeleton className="h-40 rounded-xl" />
                    <Skeleton className="h-40 rounded-xl" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-4">
                    <Skeleton className="h-12 rounded-md" />
                    <Skeleton className="h-12 rounded-md" />
                    <Skeleton className="h-12 rounded-md" />
                    <Skeleton className="h-12 rounded-md" />
                  </div>
                  <Skeleton className="h-11 w-40 rounded-md" />
                </div>
              ) : (
                <form onSubmit={ handleSubmit } className="space-y-10">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h2 className="text-xl font-semibold text-foreground">Your details</h2>
                      <p className="text-sm text-muted-foreground">
                        Keep your personal information current.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First name</Label>
                        <Input
                          id="firstName"
                          name="firstName"
                          placeholder="First Name"
                          value={ formState.firstName }
                          onChange={ handleInputChange('firstName') }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="middleName">Middle name</Label>
                        <Input
                          id="middleName"
                          name="middleName"
                          placeholder="Middle Name"
                          value={ formState.middleName }
                          onChange={ handleInputChange('middleName') }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last name</Label>
                        <Input
                          id="lastName"
                          name="lastName"
                          placeholder="Surname"
                          value={ formState.lastName }
                          onChange={ handleInputChange('lastName') }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="birthday">Birthday</Label>
                        <Popover open={ isBirthdayOpen } onOpenChange={ setBirthdayOpen }>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              id="birthday"
                              aria-label="Select birthday"
                              className="w-full justify-between font-normal text-left"
                            >
                              { birthday ? birthday.toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              }) : 'Add birthday' }
                              <ChevronDownIcon className="size-4" aria-hidden="true" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={ birthday }
                              captionLayout="dropdown"
                              onSelect={ (date) => {
                                setBirthday(date ?? undefined);
                                setBirthdayOpen(false);
                              } }
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-muted-foreground">
                      Changes stay in sync wherever your Upspace account is used.
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={ handleReset }
                        disabled={ isSubmitting || isLoading }
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="w-full justify-center gap-2 sm:w-auto"
                        disabled={ isSaveDisabled }
                      >
                        { isSubmitting && <CgSpinner className="h-4 w-4 animate-spin" aria-hidden="true" /> }
                        <span>{ justSaved ? 'Saved' : isSubmitting ? 'Saving...' : 'Save changes' }</span>
                      </Button>
                    </div>
                  </div>
                </form>
              ) }
            </CardContent>
          </Card>
          <Card className="border border-border/60 bg-card/80 shadow-sm shadow-slate-900/5">
            <CardContent className="p-6 sm:p-10 space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-foreground">Security</h2>
                <p className="text-sm text-muted-foreground">
                  Update your password to keep your account secure across all devices.
                </p>
              </div>
              { hasPasswordIdentity ? (
                <form onSubmit={ handlePasswordSubmit } className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current password</Label>
                    <Input
                      id="currentPassword"
                      name="currentPassword"
                      type="password"
                      placeholder="Current password"
                      value={ passwordForm.currentPassword }
                      onChange={ handlePasswordInputChange('currentPassword') }
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New password</Label>
                    <Input
                      id="newPassword"
                      name="newPassword"
                      type="password"
                      placeholder="New password"
                      value={ passwordForm.newPassword }
                      onChange={ handlePasswordInputChange('newPassword') }
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm new password</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder="Confirm new password"
                      value={ passwordForm.confirmPassword }
                      onChange={ handlePasswordInputChange('confirmPassword') }
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-muted-foreground">
                      Minimum 8 characters, uppercase, lowercase, number, and symbol.
                    </p>
                    { passwordMismatch ? (
                      <p className="text-destructive">Passwords must match.</p>
                    ) : null }
                  </div>
                  <Button
                    type="submit"
                    className="w-full justify-center"
                    disabled={ isPasswordChangeDisabled }
                  >
                    { isPasswordSubmitting ? 'Updating password...' : 'Change password' }
                  </Button>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This account was created through an OAuth provider, so no password is stored locally.
                </p>
              ) }
            </CardContent>
          </Card>
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
