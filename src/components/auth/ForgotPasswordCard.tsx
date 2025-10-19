'use client';

import { useEffect, useState, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { toast } from 'sonner';
import { CgSpinner } from 'react-icons/cg';

import type { ForgotPasswordState } from '@/app/(auth)/forgot-password/actions';
import { requestPasswordResetAction } from '@/app/(auth)/forgot-password/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const initialState: ForgotPasswordState = {
  ok: false,
  message: undefined,
  errors: undefined,
};

function SubmitButton() {
  const { pending, } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={ pending }
      className={ [
        'w-full h-10 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2',
        'bg-primary text-primary-foreground border border-border',
        'transition-[transform,opacity] active:scale-[0.98] disabled:opacity-70'
      ].join(' ') }
    >
      { pending && <CgSpinner className="h-4 w-4 animate-spin" /> }
      <span>{ pending ? 'Sending…' : 'Send reset link' }</span>
    </Button>
  );
}

type ForgotPasswordCardProps = {
  className?: string;
};

export default function ForgotPasswordCard({ className, }: ForgotPasswordCardProps) {
  const [email, setEmail] = useState('');

  const [state, formAction] =
    useActionState<ForgotPasswordState, FormData>(requestPasswordResetAction, initialState);

  useEffect(() => {
    if (!state.ok) return;

    setEmail('');
    toast.success(
      state.message ??
        'If that email is registered with Upspace, you will receive password reset instructions shortly.'
    );
  }, [state.ok, state.message]);

  useEffect(() => {
    if (state.ok) return;

    const fieldMessages = Object.values(state.errors ?? {})
      .flat()
      .map((message) => message?.trim())
      .filter((message): message is string => Boolean(message));

    const combinedMessages = [state.message?.trim() ?? '', ...fieldMessages].filter(Boolean);

    if (!combinedMessages.length) return;

    const uniqueMessages = Array.from(new Set(combinedMessages));
    uniqueMessages.forEach((message) => {
      toast.error(message);
    });
  }, [state]);

  const fieldErr = (key: string) => state.errors?.[key]?.[0];

  return (
    <Card className={ cn('bg-background', className) }>
      <CardContent className="space-y-4 pt-6">
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
              className={ [
                'w-full h-10 rounded-md px-3',
                'bg-muted/60 text-foreground border border-input',
                'placeholder:text-muted-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              ].join(' ') }
              placeholder="Enter your email"
            />
            { fieldErr('email') && (
              <p className="text-sm text-destructive">{ fieldErr('email') }</p>
            ) }
          </div>
          <SubmitButton />
        </form>
        <p className="text-xs text-muted-foreground">
          We&apos;ll email you instructions to reset your password. This link expires in 24 hours.
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
