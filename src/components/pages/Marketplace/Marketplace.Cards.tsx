'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
MapPin,
Star
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import type { SpaceCard as SpaceCardData } from '@/lib/api/spaces';

const PLACEHOLDER_IMAGE = '/img/hero-featured-dark-1.png';

export function SkeletonGrid({ count = 6, }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:gap-4">
      { Array.from({ length: count, }).map((_, i) => (
        <Card key={ i } className="shadow-sm gap-0 py-0 overflow-hidden">
          <Skeleton className="h-28 w-full" />
          <CardContent className="px-3 py-3 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-7 w-28" />
          </CardContent>
        </Card>
      )) }
    </div>
  );
}

export function CardsGrid({ items, }: { items: SpaceCardData[] }) {
  if (items.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">No spaces found. Try adjusting filters.</div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:gap-4">
      { items.map((s) => (
        <SpaceCard key={ s.space_id } space={ s } />)
      ) }
    </div>
  );
}

export function SpaceCard({ space, }: { space: SpaceCardData }) {
  const location = [space.city, space.region].filter(Boolean).join(', ');
  const imageUrl = React.useMemo(() => {
    const urls = Array.isArray(space.images)
      ? space.images.filter((url) => typeof url === 'string' && url.trim().length > 0)
      : [];
    return urls.length > 0 ? urls[0]! : PLACEHOLDER_IMAGE;
  }, [space.images]);

  const priceText = React.useMemo(() => {
    const min = typeof space.price_min === 'number' ? Math.round(space.price_min) : null;
    const max = typeof space.price_max === 'number' ? Math.round(space.price_max) : null;
    if (min !== null && max !== null) {
      return min === max
        ? `₱${min.toLocaleString()}`
        : `₱${min.toLocaleString()}–₱${max.toLocaleString()}`;
    }
    if (min !== null) return `From ₱${min.toLocaleString()}`;
    if (max !== null) return `Up to ₱${max.toLocaleString()}`;
    return 'Pricing unavailable';
  }, [space.price_min, space.price_max]);

  const rating = typeof space.rating === 'number' ? space.rating : 4.5;
  const fullStars = Math.floor(rating);

  return (
    <Card className="rounded-2xl border border-border/70 bg-card text-card-foreground shadow-sm transition hover:shadow-md overflow-hidden p-0 py-0">
      { /* Image Section */ }
      <div className="relative w-full aspect-[4/3]">
        <Image
          src={ imageUrl }
          alt={ space.name }
          fill
          sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, 100vw"
          className="object-cover object-center rounded-t-2xl transition-transform duration-300"
        />
      </div>

      { /* Card Content */ }
      <CardContent className="p-4 pt-3">
        <Link
          href={ `/marketplace/${space.space_id}` }
          className="block group mb-1"
        >
          <div className="text-base font-semibold text-foreground group-hover:underline truncate">
            { space.name }
          </div>
        </Link>

        <div className="text-sm text-muted-foreground flex items-center gap-1 truncate">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          { location || 'N/A' }
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-primary">
            { priceText }
          </div>
          <div className="flex items-center gap-0.5 text-amber-500">
            { [...Array(5)].map((_, i) => (
              <Star
                key={ i }
                className={ `w-3.5 h-3.5 ${
                  i < fullStars ? 'fill-amber-500' : 'fill-gray-300'
                }` }
              />
            )) }
            <span className="ml-1 text-xs text-muted-foreground">{ rating.toFixed(1) }</span>
          </div>
        </div>

        <Link href={ `/marketplace/${space.space_id}` }>
          <Button className="mt-4 w-full" size="lg">
            Check Availability
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
