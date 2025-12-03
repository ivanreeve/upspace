'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CgSpinner } from 'react-icons/cg';
import { FiStar } from 'react-icons/fi';
import { FaHeart, FaRegHeart, FaStar } from 'react-icons/fa';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Space } from '@/lib/api/spaces';
import { cn } from '@/lib/utils';
import { useSession } from '@/components/auth/SessionProvider';

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

export function SkeletonGrid({ count = 12, }: { count?: number }) {
  return (
    <div className="grid w-full justify-items-stretch grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      { Array.from({ length: count, }).map((_, i) => (
        <Card
          key={ i }
          className="w-full rounded-sm group flex flex-col overflow-hidden text-card-foreground border-none bg-transparent shadow-none py-0 !gap-3"
        >
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-sm">
            <Skeleton className="absolute inset-0 h-full w-full rounded-sm" />
            <Skeleton className="absolute right-3 top-3 h-9 w-9 rounded-full" />
            <div className="pointer-events-none absolute inset-0 rounded-sm bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
          </div>
          <CardContent className="flex flex-1 flex-col gap-2 p-0">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
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
    <div className="grid w-full justify-items-stretch grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      { items.map((space) => (
        <SpaceCard key={ space.space_id } space={ space } />
      )) }
    </div>
  );
}

export function SpaceCard({ space, }: { space: Space }) {
  const { session, } = useSession();
  const isGuest = !session;
  const [isSaved, setIsSaved] = useState(Boolean(space.isBookmarked));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsSaved(Boolean(space.isBookmarked));
  }, [space.isBookmarked]);

  const priceLabel = 'Pricing via rules';

  const handleToggleSave = useCallback(async () => {
    if (isSaving) {
      return;
    }

    const shouldRemove = isSaved;
    setIsSaving(true);
    try {
      const response = await fetch('/api/v1/bookmarks', {
        method: shouldRemove ? 'DELETE' : 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify({ space_id: space.space_id, }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.error ??
            data?.message ??
            'Unable to save the space. Please try again.'
        );
      }

      setIsSaved(!shouldRemove);
      toast.success(shouldRemove ? 'Removed from your bookmarks.' : 'Saved to your bookmarks.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save right now.');
    } finally {
      setIsSaving(false);
    }
  }, [isSaved, isSaving, space.space_id]);

  return (
    <Card className="w-full rounded-sm group flex flex-col overflow-hidden text-card-foreground border-none bg-transparent shadow-none py-0 !gap-3">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-sm">
        { space.image_url ? (
          <Image
            src={ space.image_url }
            alt={ space.name }
            fill
            sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 rounded-sm"
          />
        ) : (
          <div className="h-full w-full rounded-sm bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/20" />
        ) }
        { !isGuest && (
          <button
            type="button"
            onClick={ handleToggleSave }
            disabled={ isSaving }
            aria-busy={ isSaving }
            aria-pressed={ isSaved }
            aria-label={ isSaved ? 'Remove from saved spaces' : 'Save this space' }
            className={ cn(
              'absolute right-3 top-3 rounded-full cursor-pointer backdrop-blur-2xl p-2 shadow-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-70',
              isSaved
                ? 'bg-white text-rose-600 ring-offset-black/30'
                : 'bg-black/30 text-white hover:bg-black/70'
            ) }
          >
            { isSaving ? (
              <CgSpinner className="size-5 animate-spin" aria-hidden="true" />
            ) : isSaved ? (
              <FaHeart aria-hidden="true" className="size-5 text-rose-600 fill-rose-600" />
            ) : (
              <FaRegHeart aria-hidden="true" className="size-5" />
            ) }
            <span className="sr-only">{ isSaved ? 'Remove from saved spaces' : 'Save this space' }</span>
          </button>
        ) }
        <div className="pointer-events-none absolute inset-0 rounded-sm bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
      </div>

      <CardContent className="flex flex-1 flex-col gap-1 p-0">
        <Link href={ `/marketplace/${space.space_id}` } className="group inline-flex flex-col gap-0.5">
          <span className="text-base font-semibold leading-tight text-foreground line-clamp-1">
            { space.name }
          </span>
          <span className="text-sm text-muted-foreground line-clamp-1">
            { space.city || space.province ? `${space.city ? space.city : ''}${space.city && space.province ? ', ' : ''}${space.province ? space.province : ''}` : 'Location TBA' }
          </span>
        </Link>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-medium text-foreground">{ priceLabel }</span>
          <span className="text-muted-foreground">•</span>
          <div className="flex items-center gap-1">
            <FaStar
              className={ `size-3 ${
                (space.total_reviews ?? 0) > 0 ? 'text-yellow-400' : 'text-muted-foreground'
              }` }
              aria-hidden="true"
            />
            <span className="font-medium text-foreground">
              { (space.total_reviews ?? 0) > 0
                ? (space.average_rating ?? 0).toFixed(1)
                : 'New' }
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
