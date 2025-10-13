import type { Metadata } from 'next';

import SignInCard from '@/components/auth/SignInCard';

export const metadata: Metadata = {
  title: 'Sign In • Upspace',
  description: 'Access your Upspace account to manage bookings and spaces.',
};

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Welcome back
          </h1>
          <p className="text-muted-foreground text-sm">
            Use your work email to continue or sign in with Google.
          </p>
        </div>

        <SignInCard callbackUrl="/dashboard" className="w-full" />
      </div>
    </main>
  );
}
