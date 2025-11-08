'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CgSpinner } from 'react-icons/cg';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot
} from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';

const credentialsSchema = z
  .object({
    email: z.string().email('Provide a valid email.'),
    password: z
      .string()
      .min(8, 'Minimum 8 characters.')
      .regex(/[A-Z]/, 'Include at least one uppercase letter.')
      .regex(/[a-z]/, 'Include at least one lowercase letter.')
      .regex(/[0-9]/, 'Include at least one number.')
      .regex(/[^A-Za-z0-9]/, 'Include at least one symbol.'),
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        path: ['confirmPassword'],
        code: z.ZodIssueCode.custom,
        message: 'Passwords must match.',
      });
    }
  });

const otpSchema = z.object({
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code we emailed to you.'),
});

type FormErrors = Partial<Record<'email' | 'password' | 'confirmPassword', string>>;

export function SignUpFormCard() {
  const router = useRouter();

  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const otpFormRef = useRef<HTMLFormElement>(null);
  const [formValues, setFormValues] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [otpValue, setOtpValue] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const maskedEmail = useMemo(() => {
    if (!formValues.email.includes('@')) return formValues.email;
    const [user, domain] = formValues.email.split('@');
    if (user.length <= 2) return formValues.email;
    return `${user.slice(0, 2)}***@${domain}`;
  }, [formValues.email]);

  const resetErrors = () => {
    setFieldErrors({});
    setOtpError(null);
  };

  const handleCredentialsSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    resetErrors();

    const parsed = credentialsSchema.safeParse(formValues);
    if (!parsed.success) {
      const nextErrors = Object.fromEntries(
        Object.entries(parsed.error.format()).flatMap(([key, value]) => {
          if (key === '_errors') return [];
          const message = Array.isArray(value?._errors) ? value?._errors[0] : undefined;
          return message ? [[key, message] as const] : [];
        })
      ) as FormErrors;

      setFieldErrors(nextErrors);
      toast.error('Fix the highlighted fields before continuing.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/auth/signup/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ email: parsed.data.email, }),
      });

      if (res.status === 409) {
        const data = await res.json().catch(() => ({ message: 'User already exists', }));
        const message = data.message ?? 'User already exists';
        setFieldErrors((prev) => ({
          ...prev,
          email: message,
        }));
        toast.error(message);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: 'Unable to verify email.', }));
        toast.error(data.message ?? 'Unable to verify email.');
        return;
      }

      const otpRes = await fetch('/api/v1/auth/signup/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ email: parsed.data.email, }),
      });

      if (!otpRes.ok) {
        const data = await otpRes.json().catch(() => null);
        toast.error(data?.message ?? 'Unable to send verification code.');
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 700));
      setOtpValue('');
      setStep('otp');
      toast.success(`A verification code was sent to ${parsed.data.email}.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    resetErrors();

    const parsed = otpSchema.safeParse({ otp: otpValue, });
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? 'Enter a valid code.';
      setOtpError(firstError);
      toast.error(firstError);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          email: formValues.email,
          password: formValues.password,
          handle: formValues.email.split('@')[0],
          otp: parsed.data.otp,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = data?.message ?? 'Unable to create user.';
        if (res.status === 400) {
          setOtpError(message);
        }
        toast.error(message);
        return;
      }

      toast.success('Account created.');
      router.push('/onboarding');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendCode = async () => {
    if (step !== 'otp') return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/auth/signup/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ email: formValues.email, }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message ?? 'Unable to resend verification code.');
        return;
      }

      setOtpValue('');
      setOtpError(null);
      toast.success('We sent you a new verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl">
          { step === 'credentials' ? 'Let’s get you set up' : 'Enter your verification code' }
        </CardTitle>
        <CardDescription>
          { step === 'credentials'
            ? 'Create your credentials so we can secure your workspace access.'
            : `Check ${ maskedEmail } for the 6-digit code. It expires in 10 minutes.` }
        </CardDescription>
      </CardHeader>

      <CardContent>
        { step === 'credentials' ? (
          <form onSubmit={ handleCredentialsSubmit } className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sign-up-email" className="text-muted-foreground text-sm">
                Work email
              </Label>
              <Input
                id="sign-up-email"
                type="email"
                name="email"
                value={ formValues.email }
                onChange={ (event) => setFormValues((prev) => ({
                  ...prev,
                  email: event.target.value,
                })) }
                autoComplete="email"
                required
                className="h-10 rounded-md border border-input bg-muted/60 px-3 placeholder:text-muted-foreground"
                placeholder="you@company.com"
              />
              { fieldErrors.email && (
                <p className="text-sm text-destructive">{ fieldErrors.email }</p>
              ) }
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sign-up-password" className="text-muted-foreground text-sm">
                Password
              </Label>
              <Input
                id="sign-up-password"
                type="password"
                name="password"
                value={ formValues.password }
                onChange={ (event) => setFormValues((prev) => ({
                  ...prev,
                  password: event.target.value,
                })) }
                autoComplete="new-password"
                required
                className="h-10 rounded-md border border-input bg-muted/60 px-3 placeholder:text-muted-foreground"
                placeholder="Create a strong password"
              />
              { fieldErrors.password && (
                <p className="text-sm text-destructive">{ fieldErrors.password }</p>
              ) }
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sign-up-confirm" className="text-muted-foreground text-sm">
                Confirm password
              </Label>
              <Input
                id="sign-up-confirm"
                type="password"
                name="confirmPassword"
                value={ formValues.confirmPassword }
                onChange={ (event) => setFormValues((prev) => ({
                  ...prev,
                  confirmPassword: event.target.value,
                })) }
                autoComplete="new-password"
                required
                className="h-10 rounded-md border border-input bg-muted/60 px-3 placeholder:text-muted-foreground"
                placeholder="Repeat your password"
              />
              { fieldErrors.confirmPassword && (
                <p className="text-sm text-destructive">{ fieldErrors.confirmPassword }</p>
              ) }
            </div>

            <Button
              type="submit"
              disabled={ isSubmitting }
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-primary px-4 py-2 text-primary-foreground transition-[transform,opacity] active:scale-[0.98] disabled:opacity-70"
            >
              { isSubmitting && <CgSpinner className="h-4 w-4 animate-spin" /> }
              { isSubmitting ? 'Creating account…' : 'Continue' }
            </Button>
          </form>
        ) : (
          <form ref={ otpFormRef } onSubmit={ handleOtpSubmit } className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sign-up-otp" className="text-muted-foreground text-sm">
                One-time verification code
              </Label>
              <InputOTP
                id="sign-up-otp"
                maxLength={ 6 }
                value={ otpValue }
                onChange={ (value) => setOtpValue(value.replace(/\D/g, '').slice(0, 6)) }
                onComplete={ () => {
                  if (!isSubmitting) {
                    otpFormRef.current?.requestSubmit();
                  }
                } }
                inputMode="numeric"
                autoComplete="one-time-code"
                containerClassName="justify-between"
              >
                <InputOTPGroup>
                  <InputOTPSlot index={ 0 } />
                  <InputOTPSlot index={ 1 } />
                  <InputOTPSlot index={ 2 } />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={ 3 } />
                  <InputOTPSlot index={ 4 } />
                  <InputOTPSlot index={ 5 } />
                </InputOTPGroup>
              </InputOTP>
              { otpError && <p className="text-sm text-destructive">{ otpError }</p> }
            </div>

            <Button
              type="submit"
              disabled={ isSubmitting }
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-primary px-4 py-2 text-primary-foreground transition-[transform,opacity] active:scale-[0.98] disabled:opacity-70"
            >
              { isSubmitting && <CgSpinner className="h-4 w-4 animate-spin" /> }
              { isSubmitting ? 'Verifying…' : 'Verify & continue' }
            </Button>

            <button
              type="button"
              onClick={ resendCode }
              disabled={ isSubmitting }
              className="text-sm font-medium text-primary underline-offset-4 transition hover:underline disabled:opacity-70"
            >
              Resend code
            </button>
          </form>
        ) }
      </CardContent>
    </Card>
  );
}
