import type { Metadata } from 'next';

import ForgotPasswordCard from '@/components/auth/ForgotPasswordCard';
import NavBar from '@/components/ui/navbar';

export const metadata: Metadata = {
  title: 'Forgot Password • Upspace',
  description:
    'Reset your Upspace password by requesting a secure link to your registered email address.',
};

export default function ForgotPasswordPage() {
  return (
    <>
      <NavBar variant="logo-only" />
      <main className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Reset your password
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter the email associated with your account and we&apos;ll send instructions to help you
              get back in.
            </p>
          </div>

          <ForgotPasswordCard className="w-full" />
        </div>
      </main>
    </>
  );
}
