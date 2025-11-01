'use client';

import { useState } from 'react';
import { FaGoogle } from 'react-icons/fa6';
import { CgSpinner } from 'react-icons/cg';

import { Button } from '@/components/ui/button';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type Props = {
  callbackUrl?: string;
  label?: string;
  className?: string;
};

export default function GoogleSignInButton({
  callbackUrl = '/',
  label = 'Continue with Google',
  className,
}: Props) {
  const [loading, setLoading] = useState(false);

  return (
    <Button
      type="button"
      aria-label="Sign in with Google"
      onClick={ async () => {
        setLoading(true);
        try {
          const supabase = getSupabaseBrowserClient();
          const redirectTo =
            callbackUrl.startsWith('http')
              ? callbackUrl
              : `${window.location.origin}${
                callbackUrl.startsWith('/') ? callbackUrl : `/${callbackUrl}`
              }`;

          const { error, } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo, },
          });

          if (error) {
            console.error('Supabase Google sign-in failed', error);
          }
        } finally {
          setLoading(false);
        }
      } }
      className={ [
        // Surface
        'w-full min-w-[200px] h-12 flex items-center justify-center gap-2',
        'bg-primary text-primary-foreground',
        'rounded-md border border-border px-4 py-2',
        // Motion/feedback
        'transition-[transform,opacity]',
        'disabled:opacity-70',
        className ?? ''
      ].join(' ') }
      disabled={ loading }
    >
      { loading ? (
        <CgSpinner className="h-4 w-4 animate-spin" />
      ) : (
        <FaGoogle size={ 18 } />
      ) }
      <span>{ loading ? 'Redirecting…' : label }</span>
    </Button>
  );
}
