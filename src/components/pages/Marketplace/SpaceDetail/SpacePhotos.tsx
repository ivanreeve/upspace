'use client';

import Image from 'next/image';
import { useMemo, useRef, useState } from 'react';
import { FaImages } from 'react-icons/fa6';
import { FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi';

import {
  Card,
  CardContent,
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
import { useIsMobile } from '@/hooks/use-mobile';

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
  const [carouselOpen, setCarouselOpen] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState<number | null>(null);
  const isMobile = useIsMobile();

  const normalizedGallery = useMemo(
    () => galleryImages.filter((image) => Boolean(image.url)),
    [galleryImages]
  );
  const primaryFromGallery = normalizedGallery[0]?.url ?? null;
  const primaryImageUrl = heroImageUrl ?? primaryFromGallery;
  const primaryImage = useMemo(
    () => normalizedGallery.find((image) => image.url === primaryImageUrl) ?? null,
    [normalizedGallery, primaryImageUrl]
  );
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

  const activeCarouselIndex = useMemo(
    () => {
      if (normalizedGallery.length === 0) return null;
      if (carouselIndex === null) return null;
      return Math.min(Math.max(carouselIndex, 0), normalizedGallery.length - 1);
    },
    [carouselIndex, normalizedGallery.length]
  );

  const activeCarouselImage = activeCarouselIndex === null
    ? null
    : normalizedGallery[activeCarouselIndex];

  const activeCarouselCategoryLabel = activeCarouselImage
    ? formatCategoryLabel(activeCarouselImage.category ?? null)
    : 'photo';

  const openCarouselFromImage = (image?: SpaceImageDisplay | null) => {
    if (!image) return;
    const index = normalizedGallery.findIndex(
      (item) => item.id === image.id || (!!image.url && item.url === image.url)
    );
    if (index < 0) return;
    setCarouselIndex(index);
    setCarouselOpen(true);
  };

  const isCarouselOpen = carouselOpen && activeCarouselIndex !== null && normalizedGallery.length > 0;

  const closeCarousel = () => {
    setCarouselOpen(false);
    setCarouselIndex(null);
  };

  const handleCarouselNavigate = (direction: 'prev' | 'next') => {
    setCarouselIndex((previous) => {
      if (previous === null || normalizedGallery.length === 0) return previous;
      const total = normalizedGallery.length;
      const currentIndex = Math.min(Math.max(previous, 0), total - 1);
      const offset = direction === 'next' ? 1 : -1;
      const nextIndex = (currentIndex + offset + total) % total;
      return nextIndex;
    });
  };

  const renderPrimaryFigure = (
    overlay?: React.ReactNode,
    additionalFigureClass?: string
  ) => (
    <figure className={ `group relative w-full cursor-pointer overflow-hidden rounded-lg border border-border/60 bg-muted h-96 sm:h-[28rem] lg:h-[30rem] xl:h-[32rem] ${additionalFigureClass ?? ''}` }>
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
      <div className="pointer-events-none absolute inset-0 rounded-lg bg-black/25 opacity-0 transition duration-200 group-hover:opacity-100" />
      { overlay }
      { primaryImage ? (
        <button
          type="button"
          onClick={ () => openCarouselFromImage(primaryImage) }
          aria-label="Open featured photo carousel"
          className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="sr-only">Open featured photo carousel</span>
        </button>
      ) : null }
    </figure>
  );

  const renderPhotoTile = (
    image: SpaceImageDisplay | null | undefined,
    alt: string,
    onClick: () => void,
    className?: string,
    overlay?: React.ReactNode,
    blurBackground = false
  ) => {
    return (
      <div
        className={ `group relative h-full w-full overflow-hidden border border-border/60 bg-muted ${className ?? ''}` }
      >
        { image ? (
          <Image
            src={ image.url }
            alt={ alt }
            fill
            sizes="(min-width: 1280px) 360px, (min-width: 1024px) 300px, 100vw"
            className={ `object-cover ${blurBackground ? 'scale-105 blur-[2px] brightness-50' : ''}` }
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            No preview
          </div>
        ) }
        <div className="pointer-events-none absolute inset-0 bg-black/25 opacity-0 transition duration-200 group-hover:opacity-100" />
        { overlay }
        <button
          type="button"
          onClick={ onClick }
          aria-label={ alt }
          className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="sr-only">{ alt }</span>
        </button>
      </div>
    );
  };

  const renderSeeMoreTile = (previewImage: SpaceImageDisplay | null | undefined) => {
    return renderPhotoTile(
      previewImage,
      'Open full image gallery',
      () => setGalleryOpen(true),
      'rounded-br-lg',
      (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-white backdrop-blur-md">
          <span className="text-base font-semibold">See all photos</span>
          <span className="text-xs text-white/80">{ totalImages } photo{ totalImages === 1 ? '' : 's' }</span>
        </div>
      ),
      true
    );
  };

  const primaryFigure = renderPrimaryFigure();
  const remainingCount = Math.max(totalImages - 1, 0);

  const layout = (() => {
    if (isMobile) {
      if (totalImages >= 2) {
        const overlay = (
          <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-4">
            <button
              type="button"
              onClick={ () => setGalleryOpen(true) }
              aria-label={ `View ${remainingCount} more photo${remainingCount === 1 ? '' : 's'}` }
              className="pointer-events-auto flex items-center gap-1 rounded-sm border border-white/10 bg-black/80 px-4 py-2 text-sm font-semibold text-white backdrop-blur-lg min-w-[72px] whitespace-nowrap"
            >
              +{ remainingCount } <FaImages className="size-4" />
            </button>
          </div>
        );
        return renderPrimaryFigure(overlay, 'h-[320px]');
      }

      return primaryFigure;
    }

    if (totalImages === 1) {
      return primaryFigure;
    }

    if (totalImages === 2) {
      const secondary = galleryWithoutPrimary[0] ?? null;
      return (
        <div className="grid gap-2.5 lg:grid-cols-2">
          { primaryFigure }
          { renderPhotoTile(
            secondary,
            `${spaceName} gallery photo 2`,
            () => openCarouselFromImage(secondary),
            'rounded-lg min-h-[16rem]'
          ) }
        </div>
      );
    }

    if (totalImages === 3) {
      const [topTile, bottomTile] = galleryWithoutPrimary;
      return (
        <div className="grid gap-2.5 lg:grid-cols-2">
          { primaryFigure }
          <div className="grid h-full min-h-[22rem] grid-rows-2 gap-2.5">
            { renderPhotoTile(
              topTile,
              `${spaceName} gallery photo 2`,
              () => openCarouselFromImage(topTile),
              'rounded-tr-lg'
            ) }
            { renderPhotoTile(
              bottomTile,
              `${spaceName} gallery photo 3`,
              () => openCarouselFromImage(bottomTile),
              'rounded-br-lg'
            ) }
          </div>
        </div>
      );
    }

    const topTile = galleryWithoutPrimary[0] ?? null;
    const middleTile = galleryWithoutPrimary[1] ?? null;
    const bottomTile = galleryWithoutPrimary[2] ?? null;
    const isFiveOrMore = totalImages >= 5;

    return (
      <div className="grid gap-2.5 lg:grid-cols-2">
        { primaryFigure }
        <div className="grid h-full min-h-[24rem] grid-rows-[2fr_1fr_1fr] gap-2.5">
          { renderPhotoTile(
            topTile,
            `${spaceName} gallery photo 2`,
            () => openCarouselFromImage(topTile),
            'rounded-tr-lg'
          ) }
          { renderPhotoTile(
            middleTile,
            `${spaceName} gallery photo 3`,
            () => openCarouselFromImage(middleTile)
          ) }
          { isFiveOrMore
            ? renderSeeMoreTile(bottomTile ?? topTile ?? middleTile ?? primaryImage)
            : renderPhotoTile(
                bottomTile,
                `${spaceName} gallery photo 4`,
                () => openCarouselFromImage(bottomTile),
                'rounded-br-lg'
              ) }
        </div>
      </div>
    );
  })();

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
            layout
          ) : (
            <p className="text-sm text-muted-foreground">No photos uploaded yet.</p>
          ) }
        </CardContent>
      </Card>

      <Dialog open={ galleryOpen } onOpenChange={ setGalleryOpen }>
        <DialogContent className="flex h-screen w-screen max-w-[100vw] flex-col p-0 sm:max-w-[100vw]">
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
                            className="group relative inline-flex w-44 min-w-[176px] flex-col text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
                              <div className="pointer-events-none absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
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
                          <button
                            key={ `dialog-gallery-${group.anchor}-${image.id}` }
                            type="button"
                            onClick={ () => openCarouselFromImage(image) }
                            aria-label={ `Open carousel for ${group.label} photo ${index + 1}` }
                            className="group relative block w-full cursor-pointer overflow-hidden border border-border/60 bg-muted shadow-sm aspect-[3/2] min-h-[220px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          >
                            <Image
                              src={ image.url }
                              alt={ `${spaceName} ${group.label} photo ${index + 1}` }
                              fill
                              sizes="(min-width: 1280px) 360px, (min-width: 1024px) 300px, 100vw"
                              className="object-cover transition-transform cursor-pointer"
                            />
                            <div className="pointer-events-none absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                          </button>
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

      <Dialog open={ isCarouselOpen } onOpenChange={ (open) => (open ? setCarouselOpen(true) : closeCarousel()) }>
        <DialogContent
          showCloseButton={ false }
          className="flex h-screen w-screen max-w-[100vw] flex-col gap-0 border-none bg-black p-0 text-white sm:max-w-[100vw] sm:rounded-none"
        >
          <DialogHeader className="flex flex-row items-center justify-between border-b border-white/10 px-4 py-3">
            <DialogTitle className="text-sm font-semibold text-white">
              { activeCarouselImage
                ? `${formatCategoryLabel(activeCarouselImage.category ?? null)} photos`
                : 'Photo carousel' }
            </DialogTitle>
            <div className="flex items-center gap-3 text-xs text-white/70">
              { activeCarouselIndex !== null ? (
                <span className="tabular-nums">
                  { activeCarouselIndex + 1 } / { totalImages }
                </span>
              ) : null }
              <button
                type="button"
                onClick={ closeCarousel }
                aria-label="Close carousel"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                <FiX className="size-5" aria-hidden="true" />
              </button>
            </div>
          </DialogHeader>
          <div className="relative flex flex-1 items-center justify-center overflow-hidden">
            { activeCarouselImage ? (
              <div className="relative h-full w-full max-h-[85vh] max-w-6xl">
                <Image
                  src={ activeCarouselImage.url }
                  alt={ `${spaceName} ${activeCarouselCategoryLabel} ${activeCarouselIndex + 1}` }
                  fill
                  sizes="100vw"
                  className="object-contain"
                />
              </div>
            ) : (
              <p className="text-sm text-white/70">No image selected.</p>
            ) }

            { totalImages > 1 ? (
              <>
                <button
                  type="button"
                  onClick={ () => handleCarouselNavigate('prev') }
                  aria-label="Previous photo"
                  className="absolute left-4 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  <FiChevronLeft className="size-6" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={ () => handleCarouselNavigate('next') }
                  aria-label="Next photo"
                  className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  <FiChevronRight className="size-6" aria-hidden="true" />
                </button>
              </>
            ) : null }
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
