import type { ComponentType } from 'react';
import Link from 'next/link';
import { FiCalendar, FiDollarSign, FiUploadCloud } from 'react-icons/fi';

import { ACTION_CARDS } from './SpacesPage.data';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  'new-listing': FiUploadCloud,
  calendar: FiCalendar,
  payouts: FiDollarSign,
};

export function SpacesActionCenter() {
  return (
    <section id="actions" className="space-y-6 py-12">
      <div className="space-y-2">
        <Badge variant="secondary" className="uppercase tracking-wide">Action center</Badge>
        <div className="space-y-1">
          <h2 className="text-3xl font-semibold tracking-tight">Keep inventory fresh.</h2>
          <p className="text-base text-muted-foreground">Resolve the top items below to stay discoverable and bookable.</p>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        { ACTION_CARDS.map((card) => {
          const Icon = ICON_MAP[card.id] ?? FiUploadCloud;
          return (
            <Card key={ card.id } className="h-full border-border/70 bg-background/80">
              <CardHeader className="space-y-3">
                <div className="inline-flex size-10 items-center justify-center rounded-full border border-border/60 bg-muted/30">
                  <Icon className="size-4 text-primary" aria-hidden="true" />
                </div>
                <CardTitle className="text-2xl">{ card.title }</CardTitle>
                <CardDescription>{ card.description }</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{ card.helper }</p>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full">
                  <Link href={ card.href }>{ card.ctaLabel }</Link>
                </Button>
              </CardFooter>
            </Card>
          );
        }) }
      </div>
    </section>
  );
}
