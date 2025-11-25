'use client';

import {
useCallback,
useEffect,
useMemo,
useState
} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CgSpinner } from 'react-icons/cg';
import { FiStar } from 'react-icons/fi';
import { FaHeart, FaRegHeart, FaStar } from 'react-icons/fa';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Space } from '@/lib/api/spaces';

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
          className="w-full group flex flex-col overflow-hidden text-card-foreground border-none bg-transparent shadow-none py-0 !gap-3"
        >
          <div className="relative aspect-[16/9] w-full overflow-hidden">
            <Skeleton className="absolute inset-0 h-full w-full rounded-md" />
            <Skeleton className="absolute right-3 top-3 h-9 w-9 rounded-full" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
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
  const [isSaved, setIsSaved] = useState(Boolean(space.isBookmarked));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsSaved(Boolean(space.isBookmarked));
  }, [space.isBookmarked]);

  const priceLabel = useMemo(() => {
    const hasMin = typeof space.min_rate_price === 'number';
    const hasMax = typeof space.max_rate_price === 'number';
    const unit = space.rate_time_unit ?? 'hour';

    if (hasMin && hasMax && space.max_rate_price !== space.min_rate_price) {
      return `${peso.format(space.min_rate_price ?? 0)} – ${peso.format(space.max_rate_price ?? 0)} / ${unit}`;
    }

    if (hasMin) {
      return `${peso.format(space.min_rate_price ?? 0)} / ${unit}`;
    }

    if (hasMax) {
      return `${peso.format(space.max_rate_price ?? 0)} / ${unit}`;
    }

    return 'Pricing coming soon';
  }, [space.max_rate_price, space.min_rate_price, space.rate_time_unit]);

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
    <Card className="w-full rounded-none group flex flex-col overflow-hidden text-card-foreground border-none bg-transparent shadow-none py-0 !gap-3">
      <div className="relative aspect-[16/9] w-full overflow-hidden">
        { space.image_url ? (
          <Image
            src={ space.image_url }
            alt={ space.name }
            fill
            sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 rounded-md"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/20" />
        ) }
        <button
          type="button"
          onClick={ handleToggleSave }
          disabled={ isSaving }
          aria-busy={ isSaving }
          aria-pressed={ isSaved }
          aria-label={ isSaved ? 'Remove from saved spaces' : 'Save this space' }
          className="absolute right-3 top-3 rounded-full bg-black/30 cursor-pointer backdrop-blur-2xl p-2 text-white shadow-md transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-70"
        >
          { isSaving ? (
            <CgSpinner className="size-5 animate-spin" aria-hidden="true" />
          ) : isSaved ? (
            <FaHeart aria-hidden="true" className="size-5 text-rose-500 fill-rose-500" />
          ) : (
            <FaRegHeart aria-hidden="true" className="size-5" />
          ) }
          <span className="sr-only">{ isSaved ? 'Remove from saved spaces' : 'Save this space' }</span>
        </button>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
      </div>

      <CardContent className="flex flex-1 flex-col gap-2 p-0">
        <Link href={ `/marketplace/${space.space_id}` } className="group inline-flex flex-col">
          <span className="text-base font-semibold leading-tight text-foreground">
            { space.name }
          </span>
          <span className="text-sm text-muted-foreground">{ priceLabel }</span>
        </Link>
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
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
          { (space.total_reviews ?? 0) > 0 && (
            <span className="text-[11px] text-muted-foreground">
              ({ space.total_reviews } review{ space.total_reviews === 1 ? '' : 's' })
            </span>
          ) }
        </div>
      </CardContent>
    </Card>
  );
}
