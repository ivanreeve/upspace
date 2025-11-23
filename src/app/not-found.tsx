import Link from 'next/link';

import { Footer } from '@/components/ui/footer';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <>
      <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-24 text-center">
        <div className="flex max-w-xl flex-col items-center gap-6">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            404
          </span>
          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              We can&apos;t find that page
            </h1>
            <p className="text-balance text-muted-foreground">
              The page you&apos;re looking for doesn&apos;t exist or may have been moved.
              Try heading back to the homepage or reach out if you need help.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link href="/">
                Back to home
              </Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
