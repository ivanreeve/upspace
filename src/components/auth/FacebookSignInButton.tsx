'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { FaFacebookF } from 'react-icons/fa';
import { CgSpinner } from 'react-icons/cg';

import { Button } from '@/components/ui/button';

type Props = {
  callbackUrl?: string;
  label?: string;
  className?: string;
};

export default function FacebookSignInButton({
  callbackUrl = '/',
  label = 'Continue with Facebook',
  className,
}: Props) {
  const [loading, setLoading] = useState(false);

  return (
    <Button
      type="button"
      aria-label="Sign in with Facebook"
      onClick={ async () => {
        setLoading(true);
        try {
          await signIn('facebook', { callbackUrl, });
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
        <FaFacebookF size={ 18 } />
      ) }
      <span>{ loading ? 'Redirecting…' : label }</span>
    </Button>
  );
}
