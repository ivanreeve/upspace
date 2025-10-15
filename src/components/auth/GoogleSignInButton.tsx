'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { FcGoogle } from 'react-icons/fc';
import { CgSpinner } from 'react-icons/cg';

import { Button } from '@/components/ui/button';

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
          await signIn('google', { callbackUrl, });
        } finally {
          setLoading(false);
        }
      } }
      className={ [
        // Surface
        'w-full h-12 inline-flex items-center justify-center gap-2',
        'bg-primary text-primary-foreground',
        'rounded-md border border-border px-4 py-2',
        // Motion/feedback
        'transition-[transform,opacity] active:scale-[0.98]',
        'disabled:opacity-70',
        className ?? ''
      ].join(' ') }
      disabled={ loading }
    >
      { loading ? (
        <CgSpinner className="h-4 w-4 animate-spin" />
      ) : (
        <FcGoogle size={ 18 } />
      ) }
      <span>{ loading ? 'Redirecting…' : label }</span>
    </Button>
  );
}
