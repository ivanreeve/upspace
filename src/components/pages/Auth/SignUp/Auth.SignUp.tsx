import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { SignUpFormCard } from './Auth.SignUp.FormCard';
import { SignUpIntro } from './Auth.SignUp.Intro';

import NavBar from '@/components/ui/navbar';

export default function AuthSignUp() {
  return (
    <>
      <NavBar variant="logo-only" />
      <main className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto flex w-full flex-col gap-10 lg:flex-row lg:items-start lg:justify-center">
          <div className="flex w-full max-w-2xl flex-col gap-8">
            <div className="flex w-full justify-start">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/">Go back</Link>
              </Button>
            </div>
            <SignUpIntro />
            <SignUpFormCard />
          </div>
        </div>
      </main>
    </>
  );
}
