'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import Image from 'next/image';
import { ChevronDownIcon } from 'lucide-react';
import { CgSpinner } from 'react-icons/cg';
import { FaCheck } from 'react-icons/fa';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const roleOptions = [
  {
    value: 'partner',
    title: 'Partner',
    description: 'Manage spaces, onboard teammates, and keep your inventory visible to the community.',
    image: '/img/onboarding-partner-bg.jpeg',
  },
  {
    value: 'customer',
    title: 'Customer',
    description: 'Book ready-to-use rooms, see availability in one glance, and keep your projects on track.',
    image: '/img/onboarding-customer-bg.jpeg',
  }
] as const;

function formatBirthday(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type RoleOption = (typeof roleOptions)[number]['value'];

type FormState = {
  firstName: string;
  middleName: string;
  lastName: string;
};

type StatusState = {
  type: 'idle' | 'error' | 'success';
  message: string;
};

export default function OnboardingExperience() {
  const [formState, setFormState] = useState<FormState>({
    firstName: '',
    middleName: '',
    lastName: '',
  });
  const [selectedRole, setSelectedRole] = useState<RoleOption | ''>('');
  const [birthday, setBirthday] = useState<Date | undefined>(undefined);
  const [isBirthdayOpen, setBirthdayOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<StatusState>({
    type: 'idle',
    message: '',
  });

  const handleInputChange =
    (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement>) => {
      setFormState((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus({
      type: 'idle',
      message: '',
    });

    const trimmedFirst = formState.firstName.trim();
    const trimmedLast = formState.lastName.trim();

    if (!trimmedFirst || !trimmedLast) {
      setStatus({
        type: 'error',
        message: 'Please provide both your first and last names so we can address you properly.',
      });
      return;
    }

    if (!selectedRole) {
      setStatus({
        type: 'error',
        message: 'Select whether you are joining as a partner or a customer before we save your profile.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/onboarding/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          firstName: trimmedFirst,
          middleName: formState.middleName.trim(),
          lastName: trimmedLast,
          role: selectedRole,
          birthday: birthday ? formatBirthday(birthday) : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? 'Unable to persist your onboarding details at the moment.');
      }

      const successMessage = 'Nice! We saved your name and role.';
      toast.success(successMessage);
      setStatus({
        type: 'success',
        message: successMessage,
      });
    } catch (error) {
      console.error('Failed to save onboarding information', error);
      setStatus({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Something went wrong while saving your details. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 pb-10 sm:py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12">
        <header className="space-y-3 text-center sm:text-left">
          <h1 className="text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
            Are you joining Upspace as a partner or customer?
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Help us start your journey on the right foot. First we need your name and the role you expect to use
            Upspace for.
          </p>
        </header>

        <section className="space-y-10 rounded-2xl border border-border/60 bg-card/80 p-6 shadow-sm shadow-slate-900/5 sm:p-10">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Your details</h2>
            <p className="text-sm text-muted-foreground">
              Fill out the name fields below. You can add a middle name if you&apos;d like, but first and last are mandatory.
            </p>
          </div>

          <form onSubmit={ handleSubmit } className="space-y-8">
            <div className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <Label className="text-base">Select your primary role</Label>
                  <p className="text-sm text-muted-foreground">
                    Depending on your selection, we tailor the experience once onboarding is fully live.
                  </p>
                </div>
                <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Required</span>
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

            <div className="flex flex-col gap-2">
              <Button
                type="submit"
                className="w-full justify-center gap-2"
                disabled={ isSubmitting }
              >
                { isSubmitting && <CgSpinner className="h-4 w-4 animate-spin" aria-hidden="true" /> }
                <span>{ isSubmitting ? 'Saving...' : 'Save profile details' }</span>
              </Button>
              { status.message && (
                <p
                  aria-live="polite"
                  className={ cn(
                    'text-sm',
                    status.type === 'success'
                      ? 'text-success-green'
                      : status.type === 'error'
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                  ) }
                >
                  { status.message }
                </p>
              ) }
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
