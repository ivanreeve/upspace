'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { FiAlertTriangle, FiBookmark, FiRefreshCw } from 'react-icons/fi';

import { SkeletonGrid, SpaceCard } from '@/components/pages/Marketplace/Marketplace.Cards';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
import { listSpaces, type Space } from '@/lib/api/spaces';
import { cn } from '@/lib/utils';

type BookmarksProps = {
  bookmarkUserId: string;
};

export function Bookmarks({ bookmarkUserId, }: BookmarksProps) {
  const isMobile = useIsMobile();
  const {
    data,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['bookmarks', bookmarkUserId],
    queryFn: () => listSpaces({
      limit: 60,
      bookmark_user_id: bookmarkUserId,
      include_pending: false,
    }),
    enabled: Boolean(bookmarkUserId),
    staleTime: 1000 * 60 * 5,
  });

  const [visibleSpaces, setVisibleSpaces] = React.useState<Space[]>([]);

  React.useEffect(() => {
    setVisibleSpaces(data?.data ?? []);
  }, [data]);

  const handleBookmarkChange = React.useCallback((spaceId: string, nextIsBookmarked: boolean) => {
    if (!nextIsBookmarked) {
      setVisibleSpaces((prev) => prev.filter((space) => space.space_id !== spaceId));
      return;
    }

    void refetch();
  }, [refetch]);

  const hasBookmarks = visibleSpaces.length > 0;

  const heading = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Bookmarks
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          All your saved spaces in one place—jump back in to compare, inquire, or book when you’re ready.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={ () => { void refetch(); } }
          disabled={ isFetching }
          className="gap-2 hover:text-white"
        >
          <FiRefreshCw className={ cn('size-4', isFetching && 'animate-spin') } aria-hidden="true" />
          Refresh
        </Button>
        <Button asChild variant="secondary" className="text-white hover:bg-[#0A5057]">
          <Link href="/marketplace">Browse spaces</Link>
        </Button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <section className="relative mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
        { heading }
        <div className="mt-8">
          <SkeletonGrid count={ isMobile ? 6 : 12 } />
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="relative mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
        { heading }
        <Card className="mt-8 border border-destructive/40 bg-destructive/5">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-destructive/15 p-2">
                <FiAlertTriangle className="size-5 text-destructive" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">Unable to load bookmarks</h2>
                <p className="text-sm text-muted-foreground">
                  We ran into a problem fetching your saved spaces. Please retry.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={ () => { void refetch(); } }
              >
                Try again
              </Button>
              <Button asChild variant="outline">
                <Link href="/marketplace">Back to marketplace</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (!hasBookmarks) {
    return (
      <section className="relative mx-auto flex min-h-[60vh] w-full max-w-[1440px] flex-col justify-center px-4 py-10 sm:px-6 lg:px-10">
        { heading }
        <div className="mt-10 flex flex-col items-center justify-center gap-4 rounded-2xl border border-border/60 bg-muted/20 px-6 py-10 text-center sm:px-10">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FiBookmark className="size-7" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">No bookmarks yet</h2>
            <p className="text-sm text-muted-foreground">
              Tap the heart on any space to save it here. We&apos;ll keep everything synced across your devices.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="default">
              <Link href="/marketplace">Find a space</Link>
            </Button>
            <Button type="button" variant="ghost" className="hover:text-white" onClick={ () => { void refetch(); } }>
              Refresh list
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
      { heading }
      <div className="mt-6 flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{ visibleSpaces.length } saved { visibleSpaces.length === 1 ? 'space' : 'spaces' }</span>
        { isFetching && <span className="text-xs">Updating…</span> }
      </div>
      <div className="mt-6">
        <div className="grid w-full justify-items-stretch grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          { visibleSpaces.map((space) => (
            <SpaceCard
              key={ space.space_id }
              space={ space }
              onBookmarkChange={ handleBookmarkChange }
            />
          )) }
        </div>
      </div>
    </section>
  );
}
