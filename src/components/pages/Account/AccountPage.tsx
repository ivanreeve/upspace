'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDownIcon } from 'lucide-react';
import { CgSpinner } from 'react-icons/cg';
import { FaCheck } from 'react-icons/fa';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserProfile } from '@/hooks/use-user-profile';
import { cn } from '@/lib/utils';
import { ALLOWED_USER_ROLES, ROLE_DETAILS, type AllowedUserRole } from '@/lib/user-roles';

type FormState = {
  firstName: string;
  middleName: string;
  lastName: string;
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

const roleOptions = ALLOWED_USER_ROLES.map((value) => ({
  value,
  ...ROLE_DETAILS[value],
}));

export default function AccountPage() {
  const {
 data: profile, isLoading, 
} = useUserProfile();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [initialRole, setInitialRole] = useState<AllowedUserRole | 'admin' | ''>('');
  const [initialBirthday, setInitialBirthday] = useState<string | null>(null);
  const [initialForm, setInitialForm] = useState<FormState>({
    firstName: '',
    middleName: '',
    lastName: '',
  });
  const [justSaved, setJustSaved] = useState(false);

  const [formState, setFormState] = useState<FormState>({
    firstName: '',
    middleName: '',
    lastName: '',
  });
  const [selectedRole, setSelectedRole] = useState<AllowedUserRole | ''>('');
  const [birthday, setBirthday] = useState<Date | undefined>(undefined);
  const [isBirthdayOpen, setBirthdayOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState<SavePayload | null>(null);

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
    setInitialRole(profile.role);
    setSelectedRole(profile.role === 'admin' ? '' : profile.role);
    setBirthday(profile.birthday ? new Date(`${profile.birthday}T00:00:00Z`) : undefined);
  }, [profile]);

  const isSaveDisabled = useMemo(() => {
    const trimmedFirst = formState.firstName.trim();
    const trimmedLast = formState.lastName.trim();
    return !trimmedFirst || !trimmedLast || !selectedRole || isSubmitting;
  }, [formState.firstName, formState.lastName, isSubmitting, selectedRole]);

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
    setSelectedRole(initialRole === 'admin' ? '' : initialRole);
    setBirthday(initialBirthday ? new Date(`${initialBirthday}T00:00:00Z`) : undefined);
    setConfirmOpen(false);
    setPendingSave(null);
    setJustSaved(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedFirst = formState.firstName.trim();
    const trimmedLast = formState.lastName.trim();

    if (!trimmedFirst || !trimmedLast || !selectedRole) {
      toast.error('Please complete required fields before saving.');
      return;
    }

    const payload: SavePayload = {
      firstName: trimmedFirst,
      middleName: formState.middleName.trim(),
      lastName: trimmedLast,
      role: selectedRole,
      birthday: birthday ? formatBirthday(birthday) : undefined,
    };

    if (initialRole === 'partner' && selectedRole === 'customer') {
      setPendingSave(payload);
      setConfirmOpen(true);
      return;
    }

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
      setTimeout(() => {
        setJustSaved(false);
        router.replace('/marketplace');
      }, 500);
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
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
                Account
              </h1>
              <Button asChild variant="link" className="px-0 text-muted-foreground hover:text-foreground">
                <Link href="/marketplace">Back to Home</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground sm:text-base">
              Update your basic details and primary role. These keep your Upspace experience tailored whether you book spaces or manage them.
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
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <Label className="text-base">Select your primary role</Label>
                        <p className="text-sm text-muted-foreground">
                          Choose how you use Upspace. You can switch between partner and customer as needed.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      { roleOptions.map((option) => {
                        const active = selectedRole === option.value;
                        return (
                          <button
                            key={ option.value }
                            type="button"
                            aria-pressed={ active }
                            onClick={ () => setSelectedRole(option.value) }
                            className={ cn(
                              'relative cursor-pointer flex h-full w-full flex-col justify-between overflow-hidden border-2 p-5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                              active
                                ? 'border-secondary role-card-selected'
                                : 'border-border hover:border-secondary'
                            ) }
                            style={ { minHeight: '14rem', } }
                          >
                            <Image
                              src={ option.image }
                              alt=""
                              fill
                              sizes="(max-width: 640px) 100vw, 50vw"
                              className="pointer-events-none object-cover"
                              aria-hidden="true"
                            />
                            <div
                              className="pointer-events-none backdrop-blur-xs absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.7)_0%,rgba(0,0,0,0.7)_40%,rgba(0,0,0,0.7)_80%)]"
                              aria-hidden="true"
                            />
                            <div className="relative z-10 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-lg font-semibold text-white font-sf">{ option.title }</p>
                              </div>
                              <span
                                className={ cn(
                                  'flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold bg-background/80',
                                  active ? 'border-secondary bg-secondary text-primary-foreground' : 'border-border text-muted-foreground'
                                ) }
                              >
                                { active ? <FaCheck className="size-3" aria-hidden="true" /> : null }
                              </span>
                            </div>
                            <p className="relative z-10 mt-4 font-sf text-sm leading-relaxed text-white/90">{ option.description }</p>
                          </button>
                        );
                      }) }
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h2 className="text-xl font-semibold text-foreground">Your details</h2>
                      <p className="text-sm text-muted-foreground">
                        Keep your name and birthday up to date so bookings and verifications stay accurate.
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
                    Changes apply to both customer and partner experiences tied to this account.
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
        </div>
      </main>

      <Dialog open={ confirmOpen } onOpenChange={ setConfirmOpen }>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch to a customer account?</DialogTitle>
            <DialogDescription>
              You will temporarily lose access to partner tools and space management until you switch back to partner.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={ () => {
                setConfirmOpen(false);
                setPendingSave(null);
              } }
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={ () => {
                if (pendingSave) {
                  setConfirmOpen(false);
                  setPendingSave(null);
                  void performSave(pendingSave);
                }
              } }
            >
              Yes, switch to customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
