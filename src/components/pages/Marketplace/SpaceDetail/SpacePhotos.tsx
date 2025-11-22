'use client';

import Image from 'next/image';
import { useMemo, useRef, useState } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { SpaceImageDisplay } from '@/lib/queries/space';

type SpacePhotosProps = {
  spaceName: string;
  heroImageUrl: string | null;
  galleryImages: SpaceImageDisplay[];
};

export default function SpacePhotos({
  spaceName,
  heroImageUrl,
  galleryImages,
}: SpacePhotosProps) {
  const [galleryOpen, setGalleryOpen] = useState(false);

  const normalizedGallery = useMemo(
    () => galleryImages.filter((image) => Boolean(image.url)),
    [galleryImages]
  );
  const primaryFromGallery = normalizedGallery[0]?.url ?? null;
  const primaryImageUrl = heroImageUrl ?? primaryFromGallery;
  const galleryWithoutPrimary = heroImageUrl
    ? normalizedGallery.filter((value) => value.url !== heroImageUrl)
    : normalizedGallery.slice(1);
  const hasImages = Boolean(primaryImageUrl || galleryWithoutPrimary.length > 0);
  const totalImages = normalizedGallery.length;
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const formatCategoryLabel = (category: string | null) => {
    if (!category) return 'Uncategorized';
    return category
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  const slugifyCategory = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') || 'category';

  const categoryGroups = useMemo(
    () => {
      if (!normalizedGallery.length) return [];

      const groups = new Map<string, SpaceImageDisplay[]>();

      normalizedGallery.forEach((image) => {
        const categoryKey = image.category?.trim() || 'Uncategorized';
        const existing = groups.get(categoryKey) ?? [];
        existing.push(image);
        groups.set(categoryKey, existing);
      });

      let index = 0;

      return Array.from(groups.entries()).map(([category, images]) => {
        const label = formatCategoryLabel(category);
        const anchor = `photo-category-${slugifyCategory(category || 'Uncategorized')}-${index++}`;
        return {
          category,
          label,
          anchor,
          images,
        };
      });
    },
    [normalizedGallery]
  );

  const handleCategoryClick = (anchor: string) => {
    const target = categoryRefs.current[anchor];
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  };

  return (
    <>
      <Card className="border-0 bg-background/80">
        <CardHeader className="flex flex-col gap-4 px-0 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-2xl">Uploaded photos</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          { hasImages ? (
            <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-[minmax(0,1fr)_460px] lg:items-start xl:grid-cols-[minmax(0,1fr)_512px]">
              <figure className="group relative h-96 flex-1 cursor-pointer overflow-hidden rounded-tl-lg rounded-bl-lg border border-border/60 bg-muted sm:h-[28rem] lg:h-[30rem] xl:h-[32rem]">
                { primaryImageUrl ? (
                  <Image
                    src={ primaryImageUrl }
                    alt={ `${spaceName} featured photo` }
                    fill
                    sizes="(min-width: 1280px) 55vw, (min-width: 1024px) 65vw, 100vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                    Missing public URL
                  </div>
                ) }
                <div className="pointer-events-none absolute inset-0 rounded-tl-lg rounded-bl-lg bg-black/25 opacity-0 transition duration-200 group-hover:opacity-100 lg:rounded-l-lg" />
              </figure>

              <div className="grid grid-cols-2 grid-rows-2 gap-2.5">
                { Array.from({ length: 4, }).map((_, index) => {
                  const imageSrc = galleryWithoutPrimary[index]?.url;
                  const isSeeMoreSlot = index === 3;
                  const isTopRightTile = index === 1;
                  const isBottomRightTile = index === 3;
                  const tileRoundingClass = isTopRightTile
                    ? 'rounded-tr-lg'
                    : isBottomRightTile
                      ? 'rounded-br-lg'
                      : '';

                  return (
                    <figure key={ `gallery-tile-${index}` }>
                      <div
                        className={ `group relative aspect-square w-full cursor-pointer overflow-hidden border border-border/60 bg-muted ${tileRoundingClass}` }
                      >
                        { imageSrc ? (
                          <Image
                            src={ imageSrc }
                            alt={ `${spaceName} gallery photo ${index + 1}` }
                            fill
                            sizes="(min-width: 1280px) 160px, (min-width: 1024px) 140px, 45vw"
                            className="object-cover"
                          />
                        ) : (
                          <div className="h-full w-full" aria-hidden="true" />
                        ) }
                        <div
                          className={ `pointer-events-none absolute inset-0 bg-black/25 opacity-0 transition duration-200 group-hover:opacity-100 ${tileRoundingClass}` }
                        />
                        { isSeeMoreSlot ? (
                          <button
                            type="button"
                            onClick={ () => setGalleryOpen(true) }
                            aria-label="Open full image gallery"
                            className={ `absolute inset-0 flex items-center justify-center ${tileRoundingClass || 'rounded-md'} bg-background/55 text-sm font-medium text-foreground backdrop-blur-md transition hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background` }
                          >
                            See all photos
                          </button>
                        ) : null }
                      </div>
                    </figure>
                  );
                }) }
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No photos uploaded yet.</p>
          ) }
        </CardContent>
      </Card>

      <Dialog open={ galleryOpen } onOpenChange={ setGalleryOpen }>
        <DialogContent className="flex h-[90vh] w-full max-w-[95vw] sm:max-w-[90vw] lg:max-w-6xl flex-col p-0">
          <DialogHeader className="border-b border-border/50 px-6 py-4">
            <DialogTitle>Photo Tour</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="space-y-8 px-6 py-6">
              { categoryGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">No photos uploaded yet.</p>
              ) : (
                <>
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                        Browse by category
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        { totalImages } photo{ totalImages === 1 ? '' : 's' }
                      </span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-1">
                      { categoryGroups.map((group) => {
                        const preview = group.images[0];
                        return (
                          <button
                            key={ group.anchor }
                            type="button"
                            onClick={ () => handleCategoryClick(group.anchor) }
                            aria-label={ `Jump to ${group.label} photos` }
                            className="relative inline-flex w-44 min-w-[176px] flex-col text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          >
                            <div className="relative h-28 w-full overflow-hidden bg-muted">
                              { preview ? (
                                <Image
                                  src={ preview.url }
                                  alt={ `${group.label} preview photo` }
                                  fill
                                  sizes="176px"
                                  className="object-cover"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                                  No preview
                                </div>
                              ) }
                              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                            </div>
                            <div className="flex items-center justify-between py-2">
                              <span className="truncate text-sm font-medium text-foreground">
                                { group.label }
                              </span>
                            </div>
                          </button>
                        );
                      }) }
                    </div>
                  </section>

                  { categoryGroups.map((group) => (
                    <section
                      key={ group.anchor }
                      ref={ (node) => {
                        categoryRefs.current[group.anchor] = node;
                      } }
                      className="space-y-3 scroll-m-16"
                      id={ group.anchor }
                    >
                      <div className="flex items-center gap-2 border-b border-border/30 pb-2">
                        <h3 className="font-semibold text-foreground">{ group.label }</h3>
                        <span className="text-xs text-muted-foreground">
                          { group.images.length } photo{ group.images.length === 1 ? '' : 's' }
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-6 pb-3 pt-3 sm:grid-cols-2 lg:grid-cols-3">
                        { group.images.map((image, index) => (
                          <div
                            key={ `dialog-gallery-${group.anchor}-${image.id}` }
                            className="relative aspect-[3/2] min-h-[220px] overflow-hidden rounded-lg border border-border/60 bg-muted shadow-sm"
                          >
                            <Image
                              src={ image.url }
                              alt={ `${spaceName} ${group.label} photo ${index + 1}` }
                              fill
                              sizes="(min-width: 1280px) 360px, (min-width: 1024px) 300px, 100vw"
                              className="object-cover transition-transform hover:scale-105"
                            />
                          </div>
                        )) }
                      </div>
                    </section>
                  )) }
                </>
              ) }
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
