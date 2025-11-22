'use client';

import Image from 'next/image';
import { useState } from 'react';

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

type SpacePhotosProps = {
  spaceName: string;
  heroImageUrl: string | null;
  galleryImageUrls: string[];
};

export default function SpacePhotos({
  spaceName,
  heroImageUrl,
  galleryImageUrls,
}: SpacePhotosProps) {
  const [galleryOpen, setGalleryOpen] = useState(false);

  const normalizedGallery = galleryImageUrls.filter(Boolean);
  const primaryFromGallery = normalizedGallery[0] ?? null;
  const primaryImageUrl = heroImageUrl ?? primaryFromGallery;
  const galleryWithoutPrimary = heroImageUrl
    ? normalizedGallery.filter((value) => value !== heroImageUrl)
    : normalizedGallery.slice(1);
  const hasImages = Boolean(primaryImageUrl || galleryWithoutPrimary.length > 0);
  const totalImages = galleryImageUrls.length;

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
            <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start xl:grid-cols-[minmax(0,1fr)_480px]">
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
                  const imageSrc = galleryWithoutPrimary[index];
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
                            alt={ `${spaceName} photo ${index + 2}` }
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
            <DialogTitle>Image Gallery</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="space-y-8 px-6 py-6">
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold uppercase tracking-wide text-foreground">Featured</h3>
                </div>
                <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border/60 bg-muted">
                  { primaryImageUrl ? (
                    <Image
                      src={ primaryImageUrl }
                      alt={ `${spaceName} featured photo` }
                      fill
                      sizes="(min-width: 1024px) 80vw, 100vw"
                      className="object-cover"
                      priority
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      No featured image
                    </div>
                  ) }
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center gap-2 border-b border-border/30 pb-2">
                  <h3 className="font-semibold text-foreground">Gallery</h3>
                  <span className="text-xs text-muted-foreground">
                    { totalImages } photo{ totalImages === 1 ? '' : 's' }
                  </span>
                </div>
                { galleryWithoutPrimary.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No additional photos uploaded yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-6 pb-3 pt-3 sm:grid-cols-2 lg:grid-cols-3">
                    { galleryWithoutPrimary.map((src, index) => (
                      <div
                        key={ `dialog-gallery-${index}-${src}` }
                        className="relative aspect-[3/2] min-h-[220px] overflow-hidden rounded-lg border border-border/60 bg-muted shadow-sm"
                      >
                        <Image
                          src={ src }
                          alt={ `${spaceName} gallery image ${index + 1}` }
                          fill
                          sizes="(min-width: 1280px) 360px, (min-width: 1024px) 300px, 100vw"
                          className="object-cover transition-transform hover:scale-105"
                        />
                      </div>
                    )) }
                  </div>
                ) }
              </section>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
