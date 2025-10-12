import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Sparkles } from 'lucide-react';

import SignInCard from '@/components/auth/SignInCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-background to-secondary/10 px-6 py-16 sm:px-10 lg:px-16">
      <div
        className="absolute -top-32 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-primary/25 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-36 right-16 h-72 w-72 rounded-full bg-secondary/20 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-12 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center lg:gap-16">
        <div className="space-y-8">
          <Badge variant="secondary" className="rounded-full bg-secondary/20 text-secondary-foreground backdrop-blur-sm">
            <Sparkles className="size-3.5 text-secondary-foreground" />
            Tailored for modern workspaces
          </Badge>

          <div className="space-y-6">
            <h1 className="font-instrument-serif text-4xl tracking-tight text-balance sm:text-5xl lg:text-[4.5rem]">
              Find the perfect space for meaningful work
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              UpSpace pairs flexible leasing with powerful management tools so teams, operators, and solo founders can make the most of every seat.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="shadow-lg">
              <Link href="/#features">
                Discover features
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-border/60 bg-background/70 backdrop-blur hover:bg-secondary hover:text-background"
            >
              <Link href="/signup?role=operator">
                List your space
              </Link>
            </Button>
          </div>

          <dl className="grid gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-5 backdrop-blur">
              <dt className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Workspaces
              </dt>
              <dd className="mt-2 text-2xl font-semibold text-foreground">1.2k+</dd>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-5 backdrop-blur">
              <dt className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Cities Served
              </dt>
              <dd className="mt-2 text-2xl font-semibold text-foreground">42</dd>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-5 backdrop-blur">
              <dt className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Teams Hosted
              </dt>
              <dd className="mt-2 text-2xl font-semibold text-foreground">8.5k</dd>
            </div>
          </dl>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div
            className="pointer-events-none absolute -inset-0.5 rounded-[22px] bg-gradient-to-br from-primary/40 via-transparent to-secondary/40 opacity-80 blur"
            aria-hidden="true"
          />
          <div className="relative rounded-[20px] border border-border/50 bg-card/90 shadow-2xl backdrop-blur">
            <div className="absolute -top-12 left-1/2 hidden h-24 w-24 -translate-x-1/2 items-center justify-center rounded-full border border-border/80 bg-background/80 shadow-lg backdrop-blur sm:flex">
              <Image
                src="/img/hero-featured-dark.png"
                alt="Illustration of a welcoming workspace."
                width={64}
                height={64}
                className="rounded-full object-cover"
              />
            </div>
            <div className="relative px-1 pb-1 pt-12 sm:pt-12">
              <SignInCard className="border-none bg-transparent shadow-none" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
