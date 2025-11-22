'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CgSpinner } from 'react-icons/cg';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import { toast } from 'sonner';

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
  const [isSaved, setIsSaved] = useState(Boolean(space.isBookmarked));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsSaved(Boolean(space.isBookmarked));
  }, [space.isBookmarked]);

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
            <FaHeart aria-hidden="true" className="size-5" />
          ) : (
            <FaRegHeart aria-hidden="true" className="size-5" />
          ) }
          <span className="sr-only">{ isSaved ? 'Remove from saved spaces' : 'Save this space' }</span>
        </button>
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
