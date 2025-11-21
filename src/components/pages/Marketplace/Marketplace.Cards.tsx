'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FiClock, FiMapPin } from 'react-icons/fi';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Space } from '@/lib/api/spaces';

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

const DAY_ABBREVIATIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const priceUnit = (unit?: string | null) => {
  if (!unit) return '';
  return `/ ${unit.replace(/_/g, ' ')}`;
};

const formatPriceRange = (space: Space) => {
  const hasMin = typeof space.min_rate_price === 'number' && !Number.isNaN(space.min_rate_price);
  const hasMax = typeof space.max_rate_price === 'number' && !Number.isNaN(space.max_rate_price);

  if (hasMin && hasMax) {
    if (space.min_rate_price === space.max_rate_price) {
      return `${peso.format(space.min_rate_price!)} ${priceUnit(space.rate_time_unit)}`;
    }
    return `${peso.format(space.min_rate_price!)} – ${peso.format(space.max_rate_price!)} ${priceUnit(space.rate_time_unit)}`;
  }

  if (hasMin) {
    return `From ${peso.format(space.min_rate_price!)} ${priceUnit(space.rate_time_unit)}`;
  }

  return 'Pricing coming soon';
};

const LOCATION_SECTIONS: Array<keyof Space> = ['street', 'barangay', 'city', 'region'];
const formatLocation = (space: Space) => {
  const resolved = LOCATION_SECTIONS.map((key) => space[key])
    .filter((value): value is string => Boolean(value))
    .join(', ');
  return resolved || 'Location coming soon';
};

const formatAvailability = (availability?: Space['availability']) => {
  if (!availability?.length) {
    return 'Availability pending';
  }
  const dayIndexes = Array.from(new Set(availability.map((slot) => slot.day_of_week))).sort((a, b) => a - b);
  const dayLabel = (() => {
    if (dayIndexes.length === 7) return 'Open daily';
    if (dayIndexes.length >= 3) {
      const first = DAY_ABBREVIATIONS[dayIndexes[0]] ?? '';
      const last = DAY_ABBREVIATIONS[dayIndexes[dayIndexes.length - 1]] ?? '';
      return first && last ? `${first}–${last}` : 'Selected days';
    }
    return dayIndexes.map((idx) => DAY_ABBREVIATIONS[idx] ?? '').filter(Boolean).join(', ') || 'Selected days';
  })();

  const earliest = availability.reduce((acc, slot) => (slot.opens_at < acc ? slot.opens_at : acc), availability[0].opens_at);
  const latest = availability.reduce((acc, slot) => (slot.closes_at > acc ? slot.closes_at : acc), availability[0].closes_at);

  return `${dayLabel} · ${earliest}–${latest}`;
};

const statusVariant = (status?: Space['status']): 'secondary' | 'outline' => {
  if (status === 'Live') return 'secondary';
  return 'outline';
};

export function SkeletonGrid({ count = 6, }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      { Array.from({ length: count, }).map((_, i) => (
        <Card key={ i } className="border-border/60">
          <Skeleton className="h-44 w-full rounded-t-lg" />
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-10 w-full rounded-md" />
          </CardContent>
        </Card>
      )) }
    </div>
  );
}

export function CardsGrid({ items, }: { items: Space[] }) {
  if (items.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">No spaces found. Try adjusting filters.</div>
    );
  }
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      { items.map((space) => (
        <SpaceCard key={ space.space_id } space={ space } />
      )) }
    </div>
  );
}

export function SpaceCard({ space, }: { space: Space }) {
  const priceText = formatPriceRange(space);
  const location = formatLocation(space);
  const availability = formatAvailability(space.availability);

  return (
    <Card className="group flex flex-col overflow-hidden border-border/60 bg-card text-card-foreground">
      <div className="relative aspect-[16/9] w-full overflow-hidden">
        { space.image_url ? (
          <Image
            src={ space.image_url }
            alt={ space.name }
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/20" />
        ) }
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
        { space.status && (
          <Badge className="absolute left-4 top-4 shadow-sm" variant={ statusVariant(space.status) }>
            { space.status }
          </Badge>
        ) }
      </div>

      <CardContent className="flex flex-1 flex-col gap-4 p-4">
        <div className="space-y-2">
          <Link href={ `/marketplace/${space.space_id}` } className="group inline-flex flex-col">
            <span className="text-base font-semibold leading-tight text-foreground group-hover:text-primary group-hover:underline">
              { space.name }
            </span>
          </Link>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <FiMapPin aria-hidden="true" className="mt-0.5 size-4 flex-none text-primary" />
            <span>{ location }</span>
          </p>
        </div>

        <div className="space-y-1 text-sm">
          <div className="font-semibold text-emerald-700 dark:text-emerald-400">{ priceText }</div>
          <div className="flex items-start gap-2 text-muted-foreground">
            <FiClock aria-hidden="true" className="mt-0.5 size-4 flex-none text-secondary" />
            <span>{ availability }</span>
          </div>
        </div>

        <div className="mt-auto pt-2">
          <Button asChild className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            <Link href={ `/marketplace/${space.space_id}` }>Check availability</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
