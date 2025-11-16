'use client';

import {
  useEffect,
  useRef,
  useState,
  useActionState
} from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CgSpinner } from 'react-icons/cg';

import type { LoginState } from '@/app/(auth)/signin/actions';
import { loginAction } from '@/app/(auth)/signin/actions';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const initialState: LoginState = {
  ok: false,
  redirectTo: undefined,
  supabaseSession: undefined,
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
      <span>{ pending ? 'Validating…' : 'Sign In' }</span>
    </Button>
  );
}

export default function EmailPasswordForm({
  callbackUrl = '/',
  forgotHref = '/forgot-password',
}: { callbackUrl?: string; forgotHref?: string }) {
  // Controlled inputs to mirror the form state locally.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [state, formAction] =
    useActionState<LoginState, FormData>(loginAction, initialState);

  const router = useRouter();
  const lastSyncedAccessTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!state.ok || !state.redirectTo) return;

    router.push(state.redirectTo);
  }, [state.ok, state.redirectTo, router]);

  useEffect(() => {
    const accessToken = state.supabaseSession?.access_token ?? null;
    const refreshToken = state.supabaseSession?.refresh_token ?? null;

    if (!accessToken || !refreshToken) {
      lastSyncedAccessTokenRef.current = null;
      return;
    }

    if (lastSyncedAccessTokenRef.current === accessToken) {
      return;
    }

    lastSyncedAccessTokenRef.current = accessToken;
    const supabase = getSupabaseBrowserClient();
    let isCurrent = true;

    supabase.auth
      .setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      .then(({ error, }) => {
        if (!isCurrent) return;
        if (error) {
          console.error('Failed to sync Supabase session on client', error);
          lastSyncedAccessTokenRef.current = null;
        }
      })
      .catch((error) => {
        console.error('Failed to sync Supabase session on client', error);
        lastSyncedAccessTokenRef.current = null;
      });

    return () => {
      isCurrent = false;
    };
  }, [state.supabaseSession]);

  useEffect(() => {
    if (state.ok) return;

    const fieldMessages = Object.values(state.errors ?? {})
      .flat()
      .map((message) => message?.trim())
      .filter((message): message is string => Boolean(message));

    const combinedMessages = [
      state.message?.trim() ?? '',
      ...fieldMessages
    ].filter(Boolean);

    if (!combinedMessages.length) return;

    const uniqueMessages = Array.from(new Set(combinedMessages));

    uniqueMessages.forEach((message) => {
      toast.error(message);
    });
  }, [state]);

  const fieldErr = (k: string) => state.errors?.[k]?.[0];

  return (
    <form action={ formAction } className="space-y-3">
      <input type="hidden" name="callbackUrl" value={ callbackUrl } />
      <div className="space-y-1.5">
        <Label htmlFor="email" className="font-sf text-sm text-muted-foreground">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={ email }
          onChange={ (e) => setEmail(e.target.value) }
          className={ [
            'w-full h-10 rounded-md px-3',
            'bg-muted/60 text-foreground border border-input',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          ].join(' ') }
          placeholder="Enter your email"
        />
        { fieldErr('email') && <p className="font-sf text-sm text-destructive">{ fieldErr('email') }</p> }
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-sm text-muted-foreground">Password</Label>
          <Link href={ forgotHref } className="text-sm text-primary dark:text-secondary hover:underline">Forgot password?</Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          value={ password }
          onChange={ (e) => setPassword(e.target.value) }
          className={ [
            'w-full h-10 rounded-md px-3',
            'bg-muted/60 text-foreground border border-input',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          ].join(' ') }
          placeholder="Password"
        />
        { fieldErr('password') && <p className="font-sf text-sm text-destructive">{ fieldErr('password') }</p> }
      </div>
      <SubmitButton />

      <span className='text-foreground text-sm'>
        Don’t have an account yet?&nbsp;
        <Link href="/signup" className="font-medium text-primary dark:text-secondary hover:underline">
          Sign Up
        </Link>
      </span>
    </form>
  );
}
