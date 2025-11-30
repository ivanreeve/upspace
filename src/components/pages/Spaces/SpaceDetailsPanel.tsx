'use client';

import Image from 'next/image';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  FiChevronLeft,
  FiChevronRight,
  FiEdit,
  FiLayers,
  FiPlus,
  FiTrash2,
  FiX
} from 'react-icons/fi';
import { FaImages } from 'react-icons/fa6';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';


import {
  AreaDialog,
  DescriptionEditor,
  areaRecordToFormValues,
  createAreaFormDefaults,
  spaceRecordToFormValues
} from './SpaceForms';
import { SPACE_DESCRIPTION_VIEWER_CLASSNAME } from './space-description-rich-text';

import { SystemErrorIllustration } from '@/components/pages/Marketplace/Marketplace.ErrorState';
import { useIsMobile } from '@/hooks/use-mobile';
import { AreaRecord, SpaceImageRecord } from '@/data/spaces';
import {
  useCreateAreaMutation,
  usePartnerSpaceQuery,
  useDeleteAreaMutation,
  useUpdateAreaMutation,
  useUpdatePartnerSpaceMutation
} from '@/hooks/api/usePartnerSpaces';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { richTextPlainTextLength, sanitizeRichText } from '@/lib/rich-text';
import { cn } from '@/lib/utils';
import type { AreaFormValues } from '@/lib/validations/spaces';


type SpaceDetailsPanelProps = {
  spaceId: string | null;
  className?: string;
};

type SpaceDetailsSkeletonProps = {
  className?: string;
};

const DESCRIPTION_MIN_CHARACTERS = 20;

const areaCreatedDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const rateAmountFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const descriptionSchema = z.object({
  description: z
    .string()
    .superRefine((value, ctx) => {
      const sanitized = sanitizeRichText(value ?? '');
      const plainTextLength = richTextPlainTextLength(sanitized);

      if (plainTextLength < DESCRIPTION_MIN_CHARACTERS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Add at least ${DESCRIPTION_MIN_CHARACTERS} characters.`,
        });
      }
    })
    .transform((value) => sanitizeRichText(value ?? '')),
});

type DescriptionFormValues = z.infer<typeof descriptionSchema>;

export function SpaceDetailsPanel({
  spaceId,
  className,
}: SpaceDetailsPanelProps) {
  const normalizedSpaceId = spaceId ?? '';
  const isMobile = useIsMobile();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? null;
  const getPublicImageUrl = (path?: string | null) => (supabaseUrl && path ? `${supabaseUrl}/storage/v1/object/public/${path}` : null);
  const resolveImageSrc = (image?: SpaceImageRecord | null) => {
    if (!image) return null;
    return image.public_url ?? getPublicImageUrl(image.path);
  };
  const {
    data: space,
    isLoading,
    isError,
    error,
    refetch,
  } = usePartnerSpaceQuery(normalizedSpaceId || null);
  const updateSpaceMutation = useUpdatePartnerSpaceMutation(normalizedSpaceId);
  const createAreaMutation = useCreateAreaMutation(normalizedSpaceId);
  const updateAreaMutation = useUpdateAreaMutation(normalizedSpaceId);
  const deleteAreaMutation = useDeleteAreaMutation(normalizedSpaceId);

  const descriptionForm = useForm<DescriptionFormValues>({
    resolver: zodResolver(descriptionSchema),
    defaultValues: { description: '', },
  });
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [areaDialogValues, setAreaDialogValues] = useState<AreaFormValues>(createAreaFormDefaults());
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [areaPendingDelete, setAreaPendingDelete] = useState<AreaRecord | null>(null);
  
  // Controls the full-screen gallery modal
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [carouselOpen, setCarouselOpen] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState<number | null>(null);
  const categoryRefs = useRef<Record<string, HTMLElement | null>>({});
  const descriptionValue = descriptionForm.watch('description');
  const descriptionPlainTextLength = richTextPlainTextLength(sanitizeRichText(descriptionValue ?? ''));
  const descriptionError = descriptionForm.formState.errors.description?.message;
  const isDescriptionDirty = descriptionForm.formState.isDirty;
  const isDeletingArea = deleteAreaMutation.isPending;

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
      const images = space?.images ?? [];
      if (!images.length) return [];

      const groups = new Map<string, SpaceImageRecord[]>();

      images.forEach((image) => {
        const categoryKey = image.category?.trim() || 'Uncategorized';
        const existing = groups.get(categoryKey) ?? [];
        existing.push(image);
        groups.set(categoryKey, existing);
      });

      let index = 0;

      return Array.from(groups.entries()).map(([category, imgs]) => {
        const label = formatCategoryLabel(category);
        const anchor = `photo-category-${slugifyCategory(category || 'Uncategorized')}-${index++}`;
        return {
          category,
          label,
          anchor,
          images: imgs,
        };
      });
    },
    [space?.images]
  );

  const totalImages = space?.images?.length ?? 0;

  const activeCarouselIndex = useMemo(
    () => {
      const images = space?.images ?? [];
      if (images.length === 0) return null;
      if (carouselIndex === null) return null;
      return Math.min(Math.max(carouselIndex, 0), images.length - 1);
    },
    [carouselIndex, space?.images]
  );

  const activeCarouselImage = activeCarouselIndex === null
    ? null
    : (space?.images ?? [])[activeCarouselIndex];

  const activeCarouselCategoryLabel = activeCarouselImage
    ? formatCategoryLabel(activeCarouselImage.category ?? null)
    : 'photo';

  const openCarouselFromImage = (image?: SpaceImageRecord | null) => {
    if (!image) return;
    const images = space?.images ?? [];
    const index = images.findIndex(
      (item) => item.id === image.id
    );
    if (index < 0) return;
    setCarouselIndex(index);
    setCarouselOpen(true);
  };

  const isCarouselOpen = carouselOpen && activeCarouselIndex !== null && (space?.images?.length ?? 0) > 0;

  const closeCarousel = () => {
    setCarouselOpen(false);
    setCarouselIndex(null);
  };

  const handleCarouselNavigate = (direction: 'prev' | 'next') => {
    const images = space?.images ?? [];
    setCarouselIndex((previous) => {
      if (previous === null || images.length === 0) return previous;
      const total = images.length;
      const currentIndex = Math.min(Math.max(previous, 0), total - 1);
      const offset = direction === 'next' ? 1 : -1;
      const nextIndex = (currentIndex + offset + total) % total;
      return nextIndex;
    });
  };

  const handleCategoryClick = (anchor: string) => {
    const target = categoryRefs.current[anchor];
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  };

  useEffect(() => {
    setGalleryOpen(false);
    setCarouselOpen(false);
    setCarouselIndex(null);
  }, [space?.id]);

  useEffect(() => {
    if (!space || isEditingDescription) {
      return;
    }
    descriptionForm.reset({ description: sanitizeRichText(space.description ?? ''), });
  }, [space, descriptionForm, isEditingDescription]);

  const handleStartDescriptionEdit = () => {
    if (!space) return;
    setIsEditingDescription(true);
    descriptionForm.reset({ description: sanitizeRichText(space.description ?? ''), });
    descriptionForm.clearErrors();
  };

  const handleCancelDescriptionEdit = () => {
    if (!space) return;
    setIsEditingDescription(false);
    descriptionForm.reset({ description: sanitizeRichText(space.description ?? ''), });
    descriptionForm.clearErrors();
  };

  const handleDescriptionSubmit = async (values: DescriptionFormValues) => {
    if (!space) return;
    try {
      await updateSpaceMutation.mutateAsync({
        ...spaceRecordToFormValues(space),
        description: values.description,
      });
      toast.success('Description updated.');
      setIsEditingDescription(false);
    } catch (mutationError) {
      toast.error(mutationError instanceof Error ? mutationError.message : 'Unable to update description.');
    }
  };

  const handleAddArea = () => {
    if (!space) return;
    setEditingAreaId(null);
    setAreaDialogValues(createAreaFormDefaults());
    setAreaDialogOpen(true);
  };

  const handleEditArea = (area: AreaRecord) => {
    if (!space) return;
    setEditingAreaId(area.id);
    setAreaDialogValues(areaRecordToFormValues(area));
    setAreaDialogOpen(true);
  };

  const handleAreaDialogOpenChange = (open: boolean) => {
    setAreaDialogOpen(open);
    if (!open) {
      setEditingAreaId(null);
      setAreaDialogValues(createAreaFormDefaults());
    }
  };

  const handleAreaSubmit = async (values: AreaFormValues) => {
    if (!space) return;
    try {
      if (editingAreaId) {
        await updateAreaMutation.mutateAsync({
          areaId: editingAreaId,
          payload: values,
        });
        toast.success(`${values.name} updated.`);
      } else {
        await createAreaMutation.mutateAsync(values);
        toast.success(`${values.name} added.`);
      }
      handleAreaDialogOpenChange(false);
    } catch (mutationError) {
      toast.error(mutationError instanceof Error ? mutationError.message : 'Unable to save area.');
    }
  };

  const handleRequestDeleteArea = (area: AreaRecord) => {
    setAreaPendingDelete(area);
  };

  const handleDeleteDialogOpenChange = (open: boolean) => {
    if (!open) {
      setAreaPendingDelete(null);
    }
  };

  const handleConfirmAreaDelete = async () => {
    if (!areaPendingDelete) {
      return;
    }

    try {
      await deleteAreaMutation.mutateAsync(areaPendingDelete.id);
      toast.success(`${areaPendingDelete.name} removed.`);
      setAreaPendingDelete(null);
    } catch (mutationError) {
      toast.error(mutationError instanceof Error ? mutationError.message : 'Unable to delete area.');
    }
  };

  const renderStatusCard = (title: string, description: string, action?: ReactNode) => (
    <Card className={ cn('border-border/70 bg-background/80', className) }>
      <CardHeader>
        <CardTitle>{ title }</CardTitle>
        <CardDescription>{ description }</CardDescription>
      </CardHeader>
      { action ? <CardContent>{ action }</CardContent> : null }
    </Card>
  );

  if (!normalizedSpaceId) {
    return renderStatusCard('Space not found', 'Select a valid listing to continue.');
  }

  if (isLoading) {
    return <SpaceDetailsSkeleton className={ className } />;
  }

  if (isError) {
    return (
      <Card className={ cn('border-none bg-transparent shadow-none', className) }>
        <CardContent className="flex flex-col items-center gap-6 px-6 py-10 text-center">
          <SystemErrorIllustration className="h-auto w-full max-w-[260px] md:max-w-[320px]" />
          <div className="space-y-2">
            <CardTitle className="text-xl text-muted-foreground md:text-2xl">Unable to load space</CardTitle>
            <CardDescription className="text-sm">
              { error instanceof Error ? error.message : 'Please try again in a moment.' }
            </CardDescription>
          </div>
          <Button variant="outline" onClick={ () => refetch() }>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!space) {
    return renderStatusCard('Space not found', 'The requested space does not exist.');
  }

  const primaryImage = space.images.find((image) => image.is_primary) ?? space.images[0] ?? null;
  const stackedImages = space.images.filter((image) => image.id !== primaryImage?.id);
  const featuredImageUrl = resolveImageSrc(primaryImage);
  const remainingCount = Math.max(totalImages - 1, 0);

  const renderPrimaryFigure = (
    overlay?: React.ReactNode,
    additionalFigureClass?: string
  ) => {
    const isMultiDesktop = !isMobile && totalImages > 1;
    const figureRoundedClass = isMultiDesktop ? 'rounded-l-lg' : 'rounded-lg';
    const figureRoundedStyle = isMultiDesktop
      ? { borderRadius: 'var(--radius-lg) 0 0 var(--radius-lg)', }
      : { borderRadius: 'var(--radius-lg)', };

    return (
      <figure
        className={ `group relative w-full cursor-pointer overflow-hidden ${figureRoundedClass} border border-border/60 bg-muted h-96 sm:h-[28rem] lg:h-[30rem] xl:h-[32rem] ${additionalFigureClass ?? ''}` }
        style={ figureRoundedStyle }
      >
        { featuredImageUrl ? (
          <Image
            src={ featuredImageUrl }
            alt={ `${space.name} featured photo` }
            fill
            sizes="(min-width: 1280px) 55vw, (min-width: 1024px) 65vw, 100vw"
            className={ `object-cover ${figureRoundedClass}` }
            style={ figureRoundedStyle }
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            Missing public URL
          </div>
        ) }
        <div
          className={ `pointer-events-none absolute inset-0 ${figureRoundedClass} bg-black/25 opacity-0 transition duration-200 group-hover:opacity-100` }
          style={ figureRoundedStyle }
        />
        { overlay }
        { primaryImage ? (
          <button
            type="button"
            onClick={ () => setGalleryOpen(true) }
            aria-label="Open featured photo"
            className={ `absolute inset-0 z-10 cursor-pointer ${figureRoundedClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background` }
            style={ figureRoundedStyle }
          >
            <span className="sr-only">Open featured photo</span>
          </button>
        ) : null }
      </figure>
    );
  };

  const renderPhotoTile = (
    image: SpaceImageRecord | null | undefined,
    alt: string,
    tileClass?: string,
    overlay?: React.ReactNode,
    blurBackground = false
  ) => {
    const imageSrc = resolveImageSrc(image);
    return (
      <div
        className={ `group relative h-full w-full overflow-hidden border border-border/60 bg-muted ${tileClass ?? ''}` }
      >
        { imageSrc ? (
          <Image
            src={ imageSrc }
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
          onClick={ () => setGalleryOpen(true) }
          aria-label={ alt }
          className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="sr-only">{ alt }</span>
        </button>
      </div>
    );
  };

  const renderSeeMoreTile = (previewImage: SpaceImageRecord | null | undefined) => {
    return renderPhotoTile(
      previewImage,
      'Open full image gallery',
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

  const photoLayout = (() => {
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
      const secondary = stackedImages[0] ?? null;
      return (
        <div className="grid gap-2.5 md:grid-cols-2">
          { primaryFigure }
          { renderPhotoTile(
            secondary,
            `${space.name} gallery photo 2`,
            'rounded-r-lg min-h-[16rem]'
          ) }
        </div>
      );
    }

    if (totalImages === 3) {
      const [topTile, bottomTile] = stackedImages;
      return (
        <div className="grid gap-2.5 md:grid-cols-2">
          { primaryFigure }
          <div className="grid h-full min-h-[22rem] grid-rows-2 gap-2.5">
            { renderPhotoTile(
              topTile,
              `${space.name} gallery photo 2`,
              'rounded-tr-lg'
            ) }
            { renderPhotoTile(
              bottomTile,
              `${space.name} gallery photo 3`,
              'rounded-br-lg'
            ) }
          </div>
        </div>
      );
    }

    const topLeftTile = stackedImages[0] ?? null;
    const topRightTile = stackedImages[1] ?? null;
    const previewTile = stackedImages[2] ?? topLeftTile ?? topRightTile ?? primaryImage;

    return (
      <div className="grid gap-2.5 md:grid-cols-2">
        { primaryFigure }
        <div className="grid h-full min-h-[24rem] grid-rows-[1fr_3fr] gap-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            { renderPhotoTile(
              topLeftTile,
              `${space.name} gallery photo 2`,
              'rounded-none'
            ) }
            { renderPhotoTile(
              topRightTile,
              `${space.name} gallery photo 3`,
              'rounded-tr-lg'
            ) }
          </div>
          { renderSeeMoreTile(previewTile) }
        </div>
      </div>
    );
  })();

  return (
    <>
      <div className={ cn('space-y-6', className) }>
        <Card className="border-border/70 bg-background/80">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl md:text-2xl">Uploaded photos</CardTitle>
              <CardDescription className="text-xs md:text-sm">Images stored for this listing.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            { space.images.length === 0 ? (
              <p className="text-sm text-muted-foreground">No photos uploaded yet.</p>
            ) : (
              photoLayout
            ) }
          </CardContent>
        </Card>

        { /* Details and Areas Cards */ }
        <div className="grid gap-4 md:gap-6 lg:grid-cols-[3fr,2fr]">
          <div className="space-y-4 md:space-y-6">
            <Card className="border-border/70 bg-background/80">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between md:gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-xl md:text-2xl">Description</CardTitle>
                </div>
                { !isEditingDescription ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={ handleStartDescriptionEdit }
                    className="inline-flex w-full items-center gap-2 sm:w-auto md:size-auto py-2"
                  >
                    <FiEdit className="size-4" aria-hidden="true" />
                    <span className="md:inline">Edit description</span>
                  </Button>
                ) : null }
              </CardHeader>
              <CardContent>
                { isEditingDescription ? (
                  <form className="space-y-4" onSubmit={ descriptionForm.handleSubmit(handleDescriptionSubmit) }>
                    <Controller
                      control={ descriptionForm.control }
                      name="description"
                      render={ ({ field, }) => (
                        <DescriptionEditor field={ field } />
                      ) }
                    />
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-muted-foreground">
                        { descriptionPlainTextLength } characters
                      </p>
                      { descriptionError ? (
                        <p className="text-sm text-destructive">{ descriptionError }</p>
                      ) : null }
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={ handleCancelDescriptionEdit }
                        disabled={ updateSpaceMutation.isPending }
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={ updateSpaceMutation.isPending || !isDescriptionDirty }
                      >
                        { updateSpaceMutation.isPending ? 'Saving...' : 'Save description' }
                      </Button>
                    </div>
                  </form>
                ) : space.description ? (
                  <div
                    className={ SPACE_DESCRIPTION_VIEWER_CLASSNAME }
                    dangerouslySetInnerHTML={ { __html: sanitizeRichText(space.description), } }
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No description yet.</p>
                ) }
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-background/80">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between md:gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-xl md:text-2xl">{ space.name }&apos;s Address</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 md:gap-6">
                { renderField('Unit / suite', space.unit_number) }
                { renderField('Address subunit', space.address_subunit) }
                { renderField('Street', space.street) }
                { renderField('City', space.city) }
                { renderField('Region / state', space.region) }
                { renderField('Postal code', space.postal_code) }
                { renderField('Country', space.country_code) }
                { renderField('Latitude', space.lat.toString()) }
                { renderField('Longitude', space.long.toString()) }
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/70 bg-background/80">
            <CardHeader className="flex flex-col gap-3 md:gap-4">
              <div className="space-y-1">
                <CardTitle className="text-xl md:text-2xl">Rentable areas</CardTitle>
                <CardDescription className="text-xs md:text-sm">Every row maps to <code>prisma.area</code> + <code>price_rate</code>.</CardDescription>
              </div>
              <Button type="button" onClick={ handleAddArea } className="inline-flex w-full items-center gap-2 sm:w-auto">
                <FiPlus className="size-4" aria-hidden="true" />
                Add area
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 md:space-y-4">
              { space.areas.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground md:p-4 md:text-sm">
                  No areas yet. Use &quot;Add area&quot; to create one.
                </div>
              ) : (
                space.areas.map((area) => (
                  <div key={ area.id } className="rounded-md border border-border/60 p-3 md:p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold md:text-base">{ area.name }</h4>
                        <p className="text-[10px] text-muted-foreground md:text-xs">
                          Added { areaCreatedDateFormatter.format(new Date(area.created_at)) }
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={ () => handleEditArea(area) }
                          className="text-xs"
                        >
                          <FiEdit className="size-3" aria-hidden="true" />
                          <span className="hidden sm:inline">Edit</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={ () => handleRequestDeleteArea(area) }
                          className="text-xs text-destructive hover:text-destructive"
                        >
                          <FiTrash2 className="size-3" aria-hidden="true" />
                          <span className="hidden sm:inline">Delete</span>
                        </Button>
                      </div>
                    </div>
                    <dl className="mt-3 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2 md:text-sm">
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide md:text-xs">Capacity range</dt>
                        <dd className="text-sm text-foreground md:text-base">{ area.min_capacity } to { area.max_capacity } seats</dd>
                        <div className="mt-2">
                          <Badge variant="secondary" className="flex w-fit items-center gap-1 text-[10px] md:text-xs">
                            <FiLayers className="size-3" aria-hidden="true" />
                            { area.min_capacity }-{ area.max_capacity } pax
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide md:text-xs">Base rate</dt>
                        <dd className="text-sm text-foreground md:text-base">
                          ${ rateAmountFormatter.format(area.rate_amount) } / { area.rate_time_unit }
                        </dd>
                      </div>
                    </dl>
                  </div>
                ))
              ) }
            </CardContent>
          </Card>
        </div>
      </div>

      { /* Area Form */ }
      <AreaDialog
        open={ areaDialogOpen }
        mode={ editingAreaId ? 'edit' : 'create' }
        initialValues={ areaDialogValues }
        onOpenChange={ handleAreaDialogOpenChange }
        onSubmit={ handleAreaSubmit }
        isSubmitting={ editingAreaId ? updateAreaMutation.isPending : createAreaMutation.isPending }
      />

      <Dialog open={ Boolean(areaPendingDelete) } onOpenChange={ handleDeleteDialogOpenChange }>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete area</DialogTitle>
            <DialogDescription>
              This will permanently remove { areaPendingDelete?.name ? `"${areaPendingDelete.name}"` : 'this area' } and its pricing details.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={ () => handleDeleteDialogOpenChange(false) } disabled={ isDeletingArea }>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={ handleConfirmAreaDelete } disabled={ isDeletingArea }>
              { isDeletingArea ? 'Deleting...' : 'Delete area' }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      { /* Full Gallery Dialog */ }
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
                        const previewSrc = resolveImageSrc(preview);
                        return (
                          <button
                            key={ group.anchor }
                            type="button"
                            onClick={ () => handleCategoryClick(group.anchor) }
                            aria-label={ `Jump to ${group.label} photos` }
                            className="group relative inline-flex w-44 min-w-[176px] flex-col text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          >
                            <div className="relative h-28 w-full overflow-hidden bg-muted">
                              { previewSrc ? (
                                <Image
                                  src={ previewSrc }
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
                        { group.images.map((image, index) => {
                          const src = resolveImageSrc(image);
                          return (
                            <button
                              key={ `dialog-gallery-${group.anchor}-${image.id}` }
                              type="button"
                              onClick={ () => openCarouselFromImage(image) }
                              aria-label={ `Open carousel for ${group.label} photo ${index + 1}` }
                              className="group relative block w-full cursor-pointer overflow-hidden border border-border/60 bg-muted shadow-sm aspect-[3/2] min-h-[220px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                              { src ? (
                                <Image
                                  src={ src }
                                  alt={ `${space.name} ${group.label} photo ${index + 1}` }
                                  fill
                                  sizes="(min-width: 1280px) 360px, (min-width: 1024px) 300px, 100vw"
                                  className="object-cover transition-transform cursor-pointer"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                                  No Image
                                </div>
                              ) }
                              <div className="pointer-events-none absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                            </button>
                          );
                        }) }
                      </div>
                    </section>
                  )) }
                </>
              ) }
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      { /* Carousel Dialog */ }
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
                  src={ resolveImageSrc(activeCarouselImage) ?? '' }
                  alt={ `${space.name} ${activeCarouselCategoryLabel} ${(activeCarouselIndex ?? 0) + 1}` }
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

function renderField(label: string, value: string) {
  return (
    <div className="space-y-1 rounded-md border border-border/50 bg-muted/20 p-3">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        { label }
      </span>
      <p className="text-base font-semibold text-foreground">{ value || '—' }</p>
    </div>
  );
}

function SpaceDetailsSkeleton({ className, }: SpaceDetailsSkeletonProps) {
  return (
    <div className={ cn('space-y-6', className) }>
      <Card className="border-border/70 bg-background/80">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2.5 md:grid-cols-2">
            <div className="relative h-full overflow-hidden rounded-l-lg border border-border/60 bg-muted">
              <Skeleton className="h-96 w-full rounded-l-lg sm:h-[28rem] lg:h-[30rem]" />
            </div>
            <div className="grid h-full min-h-[24rem] grid-rows-[1fr_3fr] gap-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="relative h-full overflow-hidden rounded-none border border-border/60 bg-muted">
                  <Skeleton className="h-full w-full rounded-none" />
                </div>
                <div className="relative h-full overflow-hidden rounded-tr-lg border border-border/60 bg-muted">
                  <Skeleton className="h-full w-full rounded-tr-lg" />
                </div>
              </div>
              <div className="relative h-full overflow-hidden rounded-br-lg border border-border/60 bg-muted">
                <Skeleton className="h-full w-full rounded-br-lg" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-[3fr,2fr]">
        <div className="space-y-4 md:space-y-6">
          <Card className="border-border/70 bg-background/80">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-6 w-44" />
              </div>
              <Skeleton className="h-9 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/80">
            <CardHeader className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-52" />
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              { Array.from({ length: 9, }).map((_, index) => (
                <div key={ `field-skeleton-${index}` } className="space-y-2 rounded-md border border-border/50 bg-muted/20 p-3">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-28" />
                </div>
              )) }
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/70 bg-background/80">
          <CardHeader className="flex flex-col gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-52" />
            </div>
            <Skeleton className="h-10 w-full sm:w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            { Array.from({ length: 2, }).map((_, index) => (
              <div key={ `area-skeleton-${index}` } className="space-y-3 rounded-md border border-border/60 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
                <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </div>
            )) }
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
