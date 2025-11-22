'use client';

import Link from 'next/link';
import Image from 'next/image';
import { FiBookmark } from 'react-icons/fi';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Space } from '@/lib/api/spaces';

export function SkeletonGrid({ count = 6, }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      { Array.from({ length: count, }).map((_, i) => (
        <Card key={ i }>
          <Skeleton className="h-44 w-full rounded-t-lg" />
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-5 w-3/4" />
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
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      { items.map((space) => (
        <SpaceCard key={ space.space_id } space={ space } />
      )) }
    </div>
  );
}

export function SpaceCard({ space, }: { space: Space }) {
  return (
    <Card className="group flex flex-col overflow-hidden text-card-foreground border-none">
      <div className="relative aspect-[16/9] w-full overflow-hidden">
        { space.image_url ? (
          <Image
            src={ space.image_url }
            alt={ space.name }
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 rounded-md"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/20" />
        ) }
        <div className="absolute right-3 top-3 rounded-full bg-black/30 cursor-pointer backdrop-blur-2xl p-2 text-white shadow-md transition-colors group-hover:bg-black/70">
          <FiBookmark aria-hidden="true" className="size-5" />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
      </div>

      <CardContent className="flex flex-1 flex-col gap-3 p-0">
        <Link href={ `/marketplace/${space.space_id}` } className="group inline-flex flex-col">
          <span className="text-base font-semibold leading-tight text-foreground group-hover:text-primary group-hover:underline">
            { space.name }
          </span>
        </Link>
      </CardContent>
    </Card>
  );
}
