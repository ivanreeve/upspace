'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Star } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import type { Space } from '@/lib/api/spaces';

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

export function CardsGrid({ items, }: { items: Space[] }) {
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

export function SpaceCard({ space }: { space: Space }) {
  const location = [space.city, space.region].filter(Boolean).join(', ');
  const priceText = '₱500–₱700'; // placeholder
  const rating = 4.0; // placeholder

  return (
    <Card className="rounded-2xl shadow-sm overflow-hidden bg-[#fff6ec] text-sm transition hover:shadow-md p-0">
      {/* Image Section */}
      <div className="relative w-full aspect-[4/3]">
        {space.image_url ? (
          <Image
            src={space.image_url}
            alt={space.name}
            fill
            priority
            sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, 100vw"
            className="object-cover object-center rounded-t-2xl"
          />
        ) : (
          <Skeleton className="h-full w-full rounded-none" />
        )}

        {/* Carousel dots */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {[...Array(3)].map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${
                i === 1 ? 'bg-white/80' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Card Content */}
      <CardContent className="p-4 pt-3">
        <Link
          href={`/marketplace/${space.space_id}`}
          className="block group mb-1"
        >
          <div className="text-base font-semibold text-[#00473E] group-hover:underline truncate">
            {space.name}
          </div>
        </Link>

        <div className="text-sm text-gray-500 flex items-center gap-1 truncate">
          <MapPin className="w-4 h-4 text-gray-500" />
          {location || 'N/A'}
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div className="text-[#0c7b46] font-semibold text-[0.9rem]">
            {priceText}
          </div>
          <div className="flex items-center gap-0.5 text-amber-500">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-3.5 h-3.5 ${
                  i < Math.floor(rating) ? 'fill-amber-500' : 'fill-gray-300'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="mt-4">
          <Link href={`/marketplace/${space.space_id}`}>
            <Button className="bg-[#0f5a62] hover:bg-[#0f5a62]/90 w-full h-9 text-sm font-medium rounded-lg">
              Check Availability
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}