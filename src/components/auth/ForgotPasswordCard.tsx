'use client';

import {
  useActionState,
  useEffect,
  useMemo,
  useState
} from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { CgSpinner } from 'react-icons/cg';
import { toast } from 'sonner';
import { z } from 'zod';

import type { ForgotPasswordState, ResetPasswordResult } from '@/app/(auth)/forgot-password/actions';
import { requestPasswordResetAction, resetPasswordWithOtpAction, validateResetOtpAction } from '@/app/(auth)/forgot-password/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot
} from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const initialState: ForgotPasswordState = {
  ok: false,
  mode: undefined,
  email: undefined,
  otp: undefined,
  message: undefined,
  errors: undefined,
};

const passwordSchema = z
  .string()
  .min(8, 'Minimum 8 characters.')
  .regex(/[A-Z]/, 'Include at least one uppercase letter.')
  .regex(/[a-z]/, 'Include at least one lowercase letter.')
  .regex(/[0-9]/, 'Include at least one number.')
  .regex(/[^A-Za-z0-9]/, 'Include at least one symbol.');

const resetSchema = z
  .object({
    otp: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code we emailed to you.'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords must match.',
      });
    }
  });

type ResetErrors = Partial<Record<'otp' | 'password' | 'confirmPassword', string>>;

function maskEmail(value: string | null | undefined) {
  if (!value || !value.includes('@')) return value ?? '';
  const [localPart, domain] = value.split('@');
  if (localPart.length <= 2) return `${localPart[0] ?? ''}***@${domain}`;
  return `${localPart.slice(0, 2)}***@${domain}`;
}

function RequestSubmitButton({ label = 'Send code', }: { label?: string }) {
  const { pending, } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={ pending }
      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-primary px-4 py-2 text-primary-foreground transition-[transform,opacity] active:scale-[0.98] disabled:opacity-70"
    >
      { pending && <CgSpinner className="h-4 w-4 animate-spin" /> }
      { pending ? 'Sending…' : label }
    </Button>
  );
}

function ResendCodeButton({ disabled, }: { disabled?: boolean }) {
  const { pending, } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="ghost"
      disabled={ disabled || pending }
      className="h-auto p-0 text-sm font-medium text-primary underline-offset-4 transition hover:underline disabled:opacity-70"
    >
      { pending ? 'Sending…' : 'Resend code' }
    </Button>
  );
}

type ForgotPasswordCardProps = {
  className?: string;
};

export default function ForgotPasswordCard({ className, }: ForgotPasswordCardProps) {
  const [step, setStep] = useState<'request' | 'verify' | 'complete'>('request');
  const [email, setEmail] = useState('');
  const [requestedEmail, setRequestedEmail] = useState<string | null>(null);
  const [serverOtp, setServerOtp] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<string | null>(null);

  const [otpValue, setOtpValue] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetErrors, setResetErrors] = useState<ResetErrors>({});
  const [isResetting, setIsResetting] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [otpVerificationPending, setOtpVerificationPending] = useState(false);

  const maskedEmail = useMemo(
    () => maskEmail(requestedEmail ?? email),
    [requestedEmail, email]
  );

  const codeExpirationDate = useMemo(() => {
    if (!codeExpiresAt) return null;
    const date = new Date(codeExpiresAt);
    return Number.isNaN(date.getTime()) ? null : date;
  }, [codeExpiresAt]);

  const formattedCodeExpiration = useMemo(() => {
    if (!codeExpirationDate) return null;
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(codeExpirationDate);
  }, [codeExpirationDate]);

  const [state, formAction] =
    useActionState<ForgotPasswordState, FormData>(requestPasswordResetAction, initialState);

  useEffect(() => {
    if (!state.ok || state.mode !== 'sent') return;

    setRequestedEmail(state.email ?? null);
    setServerOtp(state.otp ?? null);
    setCodeExpiresAt(state.expiresAt ?? null);
    setStep('verify');
    setOtpValue('');
    setNewPassword('');
    setConfirmPassword('');
    setResetErrors({});
    setIsOtpVerified(false);

    toast.success(
      state.message ?? 'We sent a 6-digit verification code to your email address.'
    );
  }, [state]);

  useEffect(() => {
    if (state.ok) return;

    const fieldMessages = Object.values(state.errors ?? {})
      .flat()
      .map((message) => message?.trim())
      .filter((message): message is string => Boolean(message));

    const combinedMessages = [state.message?.trim() ?? '', ...fieldMessages].filter(Boolean);
    if (!combinedMessages.length) return;

    Array.from(new Set(combinedMessages)).forEach((message) => {
      toast.error(message);
    });
  }, [state]);

  useEffect(() => {
    setIsOtpVerified(false);

    if (!requestedEmail) {
      setOtpVerificationPending(false);
      return;
    }

    if (otpValue.length !== 6) {
      setOtpVerificationPending(false);
      setResetErrors((prev) => ({
        ...prev,
        otp: undefined,
      }));
      return;
    }

    const parsedOtp = z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'Enter the 6-digit code we emailed to you.')
      .safeParse(otpValue);

    if (!parsedOtp.success) {
      setOtpVerificationPending(false);
      return;
    }

    let isActive = true;

    const verifyOtp = async () => {
      setOtpVerificationPending(true);
      setResetErrors((prev) => ({
        ...prev,
        otp: undefined,
      }));

      try {
        const result = await validateResetOtpAction({
          email: requestedEmail,
          otp: parsedOtp.data,
        });

        if (!isActive) return;

        if (!result.ok) {
          const message = result.errors?.otp?.[0] ?? result.message ?? 'Invalid or expired code.';
          setIsOtpVerified(false);
          setResetErrors((prev) => ({
            ...prev,
            otp: message,
          }));
          if (message) {
            toast.error(message);
          }
          return;
        }

        setIsOtpVerified(true);
        setResetErrors((prev) => ({
          ...prev,
          otp: undefined,
        }));
        toast.success(result.message ?? 'Code verified. You can set a new password now.');
      } catch (error) {
        console.error('Failed to verify reset OTP', error);
        if (!isActive) return;
        setIsOtpVerified(false);
        toast.error('Unable to verify code. Please try again.');
      } finally {
        if (isActive) {
          setOtpVerificationPending(false);
        }
      }
    };

    verifyOtp();

    return () => {
      isActive = false;
    };
  }, [otpValue, requestedEmail]);

  const fieldErr = (key: string) => state.errors?.[key]?.[0];

  const handleResetSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setResetErrors({});

    if (!requestedEmail) {
      toast.error('Request a new code to continue.');
      setStep('request');
      setCodeExpiresAt(null);
      return;
    }

    const parsed = resetSchema.safeParse({
      otp: otpValue,
      password: newPassword,
      confirmPassword,
    });

    if (!parsed.success) {
      const errorMap = parsed.error.flatten().fieldErrors;
      const nextErrors: ResetErrors = Object.fromEntries(
        Object.entries(errorMap).map(([key, value]) => [key, value?.[0] ?? ''])
      ) as ResetErrors;

      setResetErrors(nextErrors);
      const firstError = Object.values(nextErrors).find(Boolean);
      if (firstError) {
        toast.error(firstError);
      }
      return;
    }

    if (!isOtpVerified) {
      const message = 'Enter the 6-digit code to verify before setting a new password.';
      setResetErrors((prev) => ({
        ...prev,
        otp: prev.otp ?? message,
      }));
      toast.error(message);
      return;
    }

    setIsResetting(true);
    try {
      const result: ResetPasswordResult = await resetPasswordWithOtpAction({
        email: requestedEmail,
        otp: parsed.data.otp,
        password: parsed.data.password,
      });

      if (!result.ok) {
        if (result.errors?.otp?.length) {
          setIsOtpVerified(false);
        }

        setResetErrors((prev) => ({
          ...prev,
          otp: result.errors?.otp?.[0] ?? prev.otp,
          password: result.errors?.password?.[0] ?? prev.password,
        }));

        if (result.message) {
          toast.error(result.message);
        }

        return;
      }

      toast.success('Your password has been reset. You can now sign in with your new password.');
      setStep('complete');
      setEmail('');
      setOtpValue('');
      setNewPassword('');
      setConfirmPassword('');
      setIsOtpVerified(false);
    } catch (error) {
      console.error('Password reset failed', error);
      toast.error('Unable to reset password. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Card className={ cn('bg-background', className) }>
      <CardContent className="space-y-6 pt-6">
        { step === 'request' && (
          <form action={ formAction } className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm text-muted-foreground">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={ email }
                onChange={ (event) => setEmail(event.target.value) }
                className="h-10 w-full rounded-md border border-input bg-muted/60 px-3 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Enter your email"
              />
              { fieldErr('email') && (
                <p className="text-sm text-destructive">{ fieldErr('email') }</p>
              ) }
            </div>

            <RequestSubmitButton />
          </form>
        ) }

        { step === 'verify' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Check your email</p>
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code we sent to { maskedEmail } and choose a new password.
              </p>
            </div>

            <form onSubmit={ handleResetSubmit } className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-otp" className="text-sm text-muted-foreground">
                  One-time verification code
                </Label>
                <InputOTP
                  id="reset-otp"
                  maxLength={ 6 }
                  value={ otpValue }
                  onChange={ (value) => setOtpValue(value.replace(/\D/g, '')) }
                  autoComplete="one-time-code"
                  className="justify-between"
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
                { resetErrors.otp && (
                  <p className="text-sm text-destructive">{ resetErrors.otp }</p>
                ) }
                { serverOtp && (
                  <p className="text-xs text-muted-foreground">
                    Demo note: use <span className="font-medium text-foreground">{ serverOtp }</span> to
                    continue.
                  </p>
                ) }
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  { isOtpVerified &&
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">Code verified</p>
                  }
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reset-password" className="text-sm text-muted-foreground">
                  New password
                </Label>
                <Input
                  id="reset-password"
                  type="password"
                  value={ newPassword }
                  onChange={ (event) => setNewPassword(event.target.value) }
                  autoComplete="new-password"
                  required
                  disabled={ !isOtpVerified || isResetting }
                  placeholder="Create a strong password"
                  className="h-10 rounded-md border border-input bg-muted/60 px-3 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                { resetErrors.password && (
                  <p className="text-sm text-destructive">{ resetErrors.password }</p>
                ) }
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reset-confirm" className="text-sm text-muted-foreground">
                  Confirm new password
                </Label>
                <Input
                  id="reset-confirm"
                  type="password"
                  value={ confirmPassword }
                  onChange={ (event) => setConfirmPassword(event.target.value) }
                  autoComplete="new-password"
                  required
                  disabled={ !isOtpVerified || isResetting }
                  placeholder="Repeat your new password"
                  className="h-10 rounded-md border border-input bg-muted/60 px-3 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                { resetErrors.confirmPassword && (
                  <p className="text-sm text-destructive">{ resetErrors.confirmPassword }</p>
                ) }
              </div>

              <Button
                type="submit"
                disabled={ isResetting || !isOtpVerified }
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-primary px-4 py-2 text-primary-foreground transition-[transform,opacity] active:scale-[0.98] disabled:opacity-70"
              >
                { isResetting && <CgSpinner className="h-4 w-4 animate-spin" /> }
                { isResetting ? 'Resetting…' : 'Reset password' }
              </Button>
            </form>

            <form action={ formAction } className="flex justify-center">
              <input type="hidden" name="email" value={ requestedEmail ?? '' } />
              <ResendCodeButton disabled={ isResetting } />
            </form>
          </div>
        ) }

        { step === 'complete' && (
          <div className="space-y-4 text-center">
            <div className="space-y-2">
              <p className="text-lg font-semibold text-foreground">Password reset</p>
              <p className="text-sm text-muted-foreground">
                Your password has been updated for { maskedEmail }. Sign in to continue.
              </p>
            </div>

            <Button asChild className="w-full">
              <Link href="/">Continue to sign in</Link>
            </Button>
          </div>
        ) }

        <p className="text-xs text-muted-foreground">
          We&apos;ll email you instructions to reset your password.
          { formattedCodeExpiration ? (
            <>
              { ' ' }
              The verification code is valid until { formattedCodeExpiration }.
            </>
          ) : (
            ' The code expires in 10 minutes.'
          ) }
        </p>
        <div className="text-sm text-center text-muted-foreground">
          Remembered your password?{ ' ' }
          <Link href="/" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
