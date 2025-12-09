import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { SignUpFormCard } from './Auth.SignUp.FormCard';

import { Button } from '@/components/ui/button';

export default function AuthSignUp() {
  return (
    <>
      <main className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto flex w-full flex-col gap-10 lg:flex-row lg:items-start lg:justify-center">
          <div className="flex w-full max-w-2xl flex-col gap-8">
            <div className="flex w-full justify-start">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/" className="flex items-center gap-2 hover:!text-white">
                  <ArrowLeft className="size-4" />
                  Go back
                </Link>
              </Button>
            </div>
            <SignUpFormCard />
          </div>
        </div>
      </main>
    </>
  );
}
