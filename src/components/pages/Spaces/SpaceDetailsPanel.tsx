'use client';

import Image from 'next/image';
import {
useEffect,
useMemo,
useRef,
useReducer,
type MutableRefObject,
type ReactNode
} from 'react';
import { Controller, useForm, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import {
  FiChevronLeft,
  FiChevronRight,
  FiEdit,
  FiPlus,
  FiTrash2,
  FiX,
  FiEyeOff
} from 'react-icons/fi';
import { FaImages } from 'react-icons/fa6';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import {
  AreaDialog,
  areaRecordToFormValues,
  createAreaFormDefaults,
  spaceRecordToFormValues
} from './SpaceForms';
import { DescriptionEditorDynamic as DescriptionEditor } from './DescriptionEditorDynamic';
import { SPACE_DESCRIPTION_VIEWER_CLASSNAME } from './space-description-rich-text';

import { SystemErrorIllustration } from '@/components/pages/Marketplace/Marketplace.ErrorState';
import { useIsMobile } from '@/hooks/use-mobile';
import { AreaRecord, SpaceImageRecord, type SpaceRecord } from '@/data/spaces';
import {
  useCreateAreaMutation,
  usePartnerSpaceQuery,
  useDeleteAreaMutation,
  useUpdateAreaMutation,
  useUpdatePartnerSpaceMutation,
  useRequestUnpublishSpaceMutation
} from '@/hooks/api/usePartnerSpaces';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { richTextPlainTextLength, richTextToPlainText, sanitizeRichText } from '@/lib/rich-text';
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

type PhotoCategoryGroup = {
  category: string;
  label: string;
  anchor: string;
  images: SpaceImageRecord[];
};

type SpaceDetailsUiState = {
  isEditingDescription: boolean;
  areaDialogOpen: boolean;
  areaDialogValues: AreaFormValues;
  editingAreaId: string | null;
  areaPendingDelete: AreaRecord | null;
  unpublishDialogOpen: boolean;
  unpublishReason: string;
  galleryOpen: boolean;
  carouselOpen: boolean;
  carouselIndex: number | null;
};

type SpaceDetailsUiAction =
  | {
      type: 'setEditingDescription';
      value: boolean;
    }
  | {
      type: 'openAreaDialog';
      areaId: string | null;
      values: AreaFormValues;
    }
  | {
      type: 'setAreaDialogOpen';
      value: boolean;
    }
  | {
      type: 'resetAreaDialog';
      values: AreaFormValues;
    }
  | {
      type: 'setAreaPendingDelete';
      value: AreaRecord | null;
    }
  | {
      type: 'setUnpublishDialogOpen';
      value: boolean;
    }
  | {
      type: 'setUnpublishReason';
      value: string;
    }
  | {
      type: 'setGalleryOpen';
      value: boolean;
    }
  | {
      type: 'openCarousel';
      index: number;
    }
  | {
      type: 'closeCarousel';
    }
  | {
      type: 'navigateCarousel';
      direction: 'prev' | 'next';
      total: number;
    }
  | {
      type: 'setCarouselOpen';
      value: boolean;
    };

const createInitialSpaceDetailsUiState = (): SpaceDetailsUiState => ({
  isEditingDescription: false,
  areaDialogOpen: false,
  areaDialogValues: createAreaFormDefaults(),
  editingAreaId: null,
  areaPendingDelete: null,
  unpublishDialogOpen: false,
  unpublishReason: '',
  galleryOpen: false,
  carouselOpen: false,
  carouselIndex: null,
});

const spaceDetailsUiReducer = (
  state: SpaceDetailsUiState,
  action: SpaceDetailsUiAction
): SpaceDetailsUiState => {
  switch (action.type) {
    case 'setEditingDescription':
      return {
        ...state,
        isEditingDescription: action.value,
      };
    case 'openAreaDialog':
      return {
        ...state,
        areaDialogOpen: true,
        editingAreaId: action.areaId,
        areaDialogValues: action.values,
      };
    case 'setAreaDialogOpen':
      return {
        ...state,
        areaDialogOpen: action.value,
      };
    case 'resetAreaDialog':
      return {
        ...state,
        areaDialogOpen: false,
        editingAreaId: null,
        areaDialogValues: action.values,
      };
    case 'setAreaPendingDelete':
      return {
        ...state,
        areaPendingDelete: action.value,
      };
    case 'setUnpublishDialogOpen':
      return {
        ...state,
        unpublishDialogOpen: action.value,
      };
    case 'setUnpublishReason':
      return {
        ...state,
        unpublishReason: action.value,
      };
    case 'setGalleryOpen':
      return {
        ...state,
        galleryOpen: action.value,
      };
    case 'openCarousel':
      return {
        ...state,
        carouselOpen: true,
        carouselIndex: action.index,
      };
    case 'closeCarousel':
      return {
        ...state,
        carouselOpen: false,
        carouselIndex: null,
      };
    case 'navigateCarousel':
      if (state.carouselIndex === null || action.total === 0) {
        return state;
      }
      const current = Math.min(Math.max(state.carouselIndex, 0), action.total - 1);
      const offset = action.direction === 'next' ? 1 : -1;
      return {
        ...state,
        carouselIndex: (current + offset + action.total) % action.total,
      };
    case 'setCarouselOpen':
      return {
        ...state,
        carouselOpen: action.value,
      };
    default:
      return state;
  }
};

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

const renderSpaceDetailsStatusCard = (
  title: string,
  description: string,
  className?: string,
  action?: ReactNode
) => (
  <Card className={ cn('border-border/70 bg-background/80', className) }>
    <CardHeader>
      <CardTitle>{ title }</CardTitle>
      <CardDescription>{ description }</CardDescription>
    </CardHeader>
    { action ? <CardContent>{ action }</CardContent> : null }
  </Card>
);

type SpacePhotoLayoutProps = {
  space: SpaceRecord;
  totalImages: number;
  isMobile: boolean;
  resolveImageSrc: (image?: SpaceImageRecord | null) => string | null;
  onOpenGallery: () => void;
};

function SpacePhotoLayout({
  space,
  totalImages,
  isMobile,
  resolveImageSrc,
  onOpenGallery,
}: SpacePhotoLayoutProps) {
  const primaryImage =
    space.images.find((image) => image.is_primary) ?? space.images[0] ?? null;
  const stackedImages = space.images.filter(
    (image) => image.id !== primaryImage?.id
  );
  const featuredImageUrl = resolveImageSrc(primaryImage);
  const remainingCount = Math.max(totalImages - 1, 0);

  const renderPrimaryFigure = (
    overlay?: ReactNode,
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
            onClick={ onOpenGallery }
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

  const primaryFigure = renderPrimaryFigure();

  if (isMobile) {
    if (totalImages >= 2) {
      const overlay = (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-4">
          <button
            type="button"
            onClick={ onOpenGallery }
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
        <PhotoTile
          image={ secondary }
          resolveImageSrc={ resolveImageSrc }
          onOpenGallery={ onOpenGallery }
          alt={ `${space.name} gallery photo 2` }
          tileClass="rounded-r-lg min-h-[16rem]"
        />
      </div>
    );
  }

  if (totalImages === 3) {
    const [topTile, bottomTile] = stackedImages;
    return (
      <div className="grid gap-2.5 md:grid-cols-2">
        { primaryFigure }
        <div className="grid h-full min-h-[22rem] grid-rows-2 gap-2.5">
          <PhotoTile
            image={ topTile }
            resolveImageSrc={ resolveImageSrc }
            onOpenGallery={ onOpenGallery }
            alt={ `${space.name} gallery photo 2` }
            tileClass="rounded-tr-lg"
          />
          <PhotoTile
            image={ bottomTile }
            resolveImageSrc={ resolveImageSrc }
            onOpenGallery={ onOpenGallery }
            alt={ `${space.name} gallery photo 3` }
            tileClass="rounded-br-lg"
          />
        </div>
      </div>
    );
  }

  const topLeftTile = stackedImages[0] ?? null;
  const topRightTile = stackedImages[1] ?? null;
  const previewTile =
    stackedImages[2] ?? topLeftTile ?? topRightTile ?? primaryImage;

  return (
    <div className="grid gap-2.5 md:grid-cols-2">
      { primaryFigure }
      <div className="grid h-full min-h-[24rem] grid-rows-[1fr_3fr] gap-2.5">
        <div className="grid grid-cols-2 gap-2.5">
          <PhotoTile
            image={ topLeftTile }
            resolveImageSrc={ resolveImageSrc }
            onOpenGallery={ onOpenGallery }
            alt={ `${space.name} gallery photo 2` }
            tileClass="rounded-none"
          />
          <PhotoTile
            image={ topRightTile }
            resolveImageSrc={ resolveImageSrc }
            onOpenGallery={ onOpenGallery }
            alt={ `${space.name} gallery photo 3` }
            tileClass="rounded-tr-lg"
          />
        </div>
        <SeeMorePhotoTile
          previewImage={ previewTile }
          resolveImageSrc={ resolveImageSrc }
          onOpenGallery={ onOpenGallery }
          totalImages={ totalImages }
        />
      </div>
    </div>
  );
}

type SpaceDetailsMainSectionProps = {
  className?: string;
  space: SpaceRecord;
  photoLayout: ReactNode;
  isEditingDescription: boolean;
  descriptionForm: UseFormReturn<DescriptionFormValues>;
  descriptionPlainTextLength: number;
  descriptionError: string | undefined;
  isDescriptionDirty: boolean;
  isDescriptionSaving: boolean;
  onStartDescriptionEdit: () => void;
  onCancelDescriptionEdit: () => void;
  onDescriptionSubmit: (values: DescriptionFormValues) => Promise<void>;
  onEditArea: (area: AreaRecord) => void;
  onRequestDeleteArea: (area: AreaRecord) => void;
  onAddArea: () => void;
};

function SpaceDetailsMainSection({
  className,
  space,
  photoLayout,
  isEditingDescription,
  descriptionForm,
  descriptionPlainTextLength,
  descriptionError,
  isDescriptionDirty,
  isDescriptionSaving,
  onStartDescriptionEdit,
  onCancelDescriptionEdit,
  onDescriptionSubmit,
  onEditArea,
  onRequestDeleteArea,
  onAddArea,
}: SpaceDetailsMainSectionProps) {
  return (
    <div className={ cn('space-y-6', className) }>
      <Card className="border-border/70 bg-background/80">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl md:text-2xl">
              Uploaded photos
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">
              Images stored for this listing.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          { space.images.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No photos uploaded yet.
            </p>
          ) : (
            photoLayout
          ) }
        </CardContent>
      </Card>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-[3fr,2fr]">
        <div className="space-y-4 md:space-y-6">
          <Card className="border-border/70 bg-background/80">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between md:gap-4">
              <div className="space-y-1">
                <CardTitle className="text-xl md:text-2xl">
                  Description
                </CardTitle>
              </div>
              { !isEditingDescription ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={ onStartDescriptionEdit }
                  className="inline-flex w-full items-center gap-2 sm:w-auto md:size-auto py-2"
                >
                  <FiEdit className="size-4" aria-hidden="true" />
                  <span className="md:inline">Edit description</span>
                </Button>
              ) : null }
            </CardHeader>
            <CardContent>
              { isEditingDescription ? (
                <form
                  className="space-y-4"
                  onSubmit={ descriptionForm.handleSubmit(onDescriptionSubmit) }
                >
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
                      <p className="text-sm text-destructive">
                        { descriptionError }
                      </p>
                    ) : null }
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={ onCancelDescriptionEdit }
                      disabled={ isDescriptionSaving }
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={ isDescriptionSaving || !isDescriptionDirty }
                    >
                      { isDescriptionSaving
                        ? 'Saving...'
                        : 'Save description' }
                    </Button>
                  </div>
                </form>
              ) : space.description ? (
                <div
                  className={ cn(
                    SPACE_DESCRIPTION_VIEWER_CLASSNAME,
                    'whitespace-pre-wrap'
                  ) }
                >
                  { richTextToPlainText(space.description) }
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No description yet.
                </p>
              ) }
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/80">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between md:gap-4">
              <div className="space-y-1">
                <CardTitle className="text-xl md:text-2xl">
                  { space.name }&apos;s Address
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 md:gap-6">
              <DetailField label="Unit / suite" value={ space.unit_number } />
              <DetailField label="Address subunit" value={ space.address_subunit } />
              <DetailField label="Street" value={ space.street } />
              <DetailField label="City" value={ space.city } />
              <DetailField label="Region / state" value={ space.region } />
              <DetailField label="Postal code" value={ space.postal_code } />
              <DetailField label="Country" value={ space.country_code } />
              <DetailField label="Latitude" value={ space.lat.toString() } />
              <DetailField label="Longitude" value={ space.long.toString() } />
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/70 bg-background/80">
          <CardHeader className="flex flex-col gap-3 md:gap-4">
            <div className="space-y-1">
              <CardTitle className="text-xl md:text-2xl">Areas</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Add a new area to capture pricing, capacity, and amenities for
                this listing.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 md:space-y-4">
            { space.areas.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground md:p-4 md:text-sm">
                No areas yet. Use &quot;Add area&quot; to create one.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Area</TableHead>
                      <TableHead className="whitespace-nowrap">
                        Capacity
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        Pricing
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    { space.areas.map((area) => (
                      <TableRow key={ area.id }>
                        <TableCell className="align-top">
                          <div className="space-y-1">
                            <div className="text-sm font-semibold md:text-base">
                              { area.name }
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Added{ ' ' }
                              { areaCreatedDateFormatter.format(
                                new Date(area.created_at)
                              ) }
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="align-top text-sm text-foreground">
                          Up to { area.max_capacity } people
                        </TableCell>
                        <TableCell className="align-top text-sm text-foreground">
                          { area.price_rule ? (
                            <Badge variant="outline" className="text-xs">
                              { area.price_rule.name }
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">
                              Pricing rule not set
                            </span>
                          ) }
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={ () => onEditArea(area) }
                              className="h-8 px-2"
                            >
                              <FiEdit className="size-4" aria-hidden="true" />
                              <span className="sr-only">
                                Edit { area.name }
                              </span>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={ () => onRequestDeleteArea(area) }
                              className="h-8 px-2 text-destructive hover:text-destructive"
                            >
                              <FiTrash2
                                className="size-4"
                                aria-hidden="true"
                              />
                              <span className="sr-only">
                                Delete { area.name }
                              </span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )) }
                  </TableBody>
                </Table>
              </div>
            ) }
          </CardContent>
          <CardFooter className="flex justify-end">
            <div>
              <Button
                type="button"
                size="sm"
                variant="default"
                className="inline-flex items-center justify-center gap-2"
                onClick={ onAddArea }
              >
                <FiPlus className="size-4" aria-hidden="true" />
                Add area
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

type SpaceDetailsDialogsSectionProps = {
  space: SpaceRecord;
  areaDialogOpen: boolean;
  editingAreaId: string | null;
  areaDialogValues: AreaFormValues;
  onAreaDialogOpenChange: (open: boolean) => void;
  onAreaSubmit: (values: AreaFormValues) => Promise<void>;
  isAreaSubmitting: boolean;
  areaPendingDelete: AreaRecord | null;
  onDeleteDialogOpenChange: (open: boolean) => void;
  onConfirmAreaDelete: () => Promise<void>;
  isDeletingArea: boolean;
  galleryOpen: boolean;
  onGalleryOpenChange: (open: boolean) => void;
  categoryGroups: PhotoCategoryGroup[];
  categoryRefs: MutableRefObject<Record<string, HTMLElement | null>>;
  onCategoryClick: (anchor: string) => void;
  totalImages: number;
  resolveImageSrc: (image?: SpaceImageRecord | null) => string | null;
  onOpenCarouselFromImage: (image?: SpaceImageRecord | null) => void;
  isCarouselOpen: boolean;
  onCarouselDialogOpenChange: (open: boolean) => void;
  onCloseCarousel: () => void;
  activeCarouselImage: SpaceImageRecord | null;
  activeCarouselCategoryLabel: string;
  activeCarouselIndex: number | null;
  onCarouselNavigate: (direction: 'prev' | 'next') => void;
  isUnpublishDisabled: boolean;
  isRequestUnpublishPending: boolean;
  onOpenUnpublishDialog: () => void;
  unpublishDialogOpen: boolean;
  onUnpublishDialogOpenChange: (open: boolean) => void;
  unpublishReason: string;
  onUnpublishReasonChange: (value: string) => void;
  onSubmitUnpublish: () => Promise<void>;
};

function SpaceDetailsDialogsSection({
  space,
  areaDialogOpen,
  editingAreaId,
  areaDialogValues,
  onAreaDialogOpenChange,
  onAreaSubmit,
  isAreaSubmitting,
  areaPendingDelete,
  onDeleteDialogOpenChange,
  onConfirmAreaDelete,
  isDeletingArea,
  galleryOpen,
  onGalleryOpenChange,
  categoryGroups,
  categoryRefs,
  onCategoryClick,
  totalImages,
  resolveImageSrc,
  onOpenCarouselFromImage,
  isCarouselOpen,
  onCarouselDialogOpenChange,
  onCloseCarousel,
  activeCarouselImage,
  activeCarouselCategoryLabel,
  activeCarouselIndex,
  onCarouselNavigate,
  isUnpublishDisabled,
  isRequestUnpublishPending,
  onOpenUnpublishDialog,
  unpublishDialogOpen,
  onUnpublishDialogOpenChange,
  unpublishReason,
  onUnpublishReasonChange,
  onSubmitUnpublish,
}: SpaceDetailsDialogsSectionProps) {
  return (
    <>
      <AreaDialogsSection
        space={ space }
        areaDialogOpen={ areaDialogOpen }
        editingAreaId={ editingAreaId }
        areaDialogValues={ areaDialogValues }
        onAreaDialogOpenChange={ onAreaDialogOpenChange }
        onAreaSubmit={ onAreaSubmit }
        isAreaSubmitting={ isAreaSubmitting }
        areaPendingDelete={ areaPendingDelete }
        onDeleteDialogOpenChange={ onDeleteDialogOpenChange }
        onConfirmAreaDelete={ onConfirmAreaDelete }
        isDeletingArea={ isDeletingArea }
      />
      <PhotoDialogsSection
        space={ space }
        galleryOpen={ galleryOpen }
        onGalleryOpenChange={ onGalleryOpenChange }
        categoryGroups={ categoryGroups }
        categoryRefs={ categoryRefs }
        onCategoryClick={ onCategoryClick }
        totalImages={ totalImages }
        resolveImageSrc={ resolveImageSrc }
        onOpenCarouselFromImage={ onOpenCarouselFromImage }
        isCarouselOpen={ isCarouselOpen }
        onCarouselDialogOpenChange={ onCarouselDialogOpenChange }
        onCloseCarousel={ onCloseCarousel }
        activeCarouselImage={ activeCarouselImage }
        activeCarouselCategoryLabel={ activeCarouselCategoryLabel }
        activeCarouselIndex={ activeCarouselIndex }
        onCarouselNavigate={ onCarouselNavigate }
      />
      <UnpublishDialogsSection
        space={ space }
        isUnpublishDisabled={ isUnpublishDisabled }
        isRequestUnpublishPending={ isRequestUnpublishPending }
        onOpenUnpublishDialog={ onOpenUnpublishDialog }
        unpublishDialogOpen={ unpublishDialogOpen }
        onUnpublishDialogOpenChange={ onUnpublishDialogOpenChange }
        unpublishReason={ unpublishReason }
        onUnpublishReasonChange={ onUnpublishReasonChange }
        onSubmitUnpublish={ onSubmitUnpublish }
      />
    </>
  );
}

type AreaDialogsSectionProps = Pick<
  SpaceDetailsDialogsSectionProps,
  | 'space'
  | 'areaDialogOpen'
  | 'editingAreaId'
  | 'areaDialogValues'
  | 'onAreaDialogOpenChange'
  | 'onAreaSubmit'
  | 'isAreaSubmitting'
  | 'areaPendingDelete'
  | 'onDeleteDialogOpenChange'
  | 'onConfirmAreaDelete'
  | 'isDeletingArea'
>;

function AreaDialogsSection({
  space,
  areaDialogOpen,
  editingAreaId,
  areaDialogValues,
  onAreaDialogOpenChange,
  onAreaSubmit,
  isAreaSubmitting,
  areaPendingDelete,
  onDeleteDialogOpenChange,
  onConfirmAreaDelete,
  isDeletingArea,
}: AreaDialogsSectionProps) {
  return (
    <>
      <AreaDialog
        open={ areaDialogOpen }
        mode={ editingAreaId ? 'edit' : 'create' }
        initialValues={ areaDialogValues }
        onOpenChange={ onAreaDialogOpenChange }
        onSubmit={ onAreaSubmit }
        isSubmitting={ isAreaSubmitting }
        pricingRules={ space.pricing_rules ?? [] }
      />

      <Dialog
        open={ Boolean(areaPendingDelete) }
        onOpenChange={ onDeleteDialogOpenChange }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete area</DialogTitle>
            <DialogDescription>
              This will permanently remove{ ' ' }
              { areaPendingDelete?.name
                ? `"${areaPendingDelete.name}"`
                : 'this area' }{ ' ' }
              and its pricing details. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={ () => onDeleteDialogOpenChange(false) }
              disabled={ isDeletingArea }
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={ onConfirmAreaDelete }
              disabled={ isDeletingArea }
            >
              { isDeletingArea ? 'Deleting...' : 'Delete area' }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type PhotoDialogsSectionProps = Pick<
  SpaceDetailsDialogsSectionProps,
  | 'space'
  | 'galleryOpen'
  | 'onGalleryOpenChange'
  | 'categoryGroups'
  | 'categoryRefs'
  | 'onCategoryClick'
  | 'totalImages'
  | 'resolveImageSrc'
  | 'onOpenCarouselFromImage'
  | 'isCarouselOpen'
  | 'onCarouselDialogOpenChange'
  | 'onCloseCarousel'
  | 'activeCarouselImage'
  | 'activeCarouselCategoryLabel'
  | 'activeCarouselIndex'
  | 'onCarouselNavigate'
>;

function PhotoDialogsSection({
  space,
  galleryOpen,
  onGalleryOpenChange,
  categoryGroups,
  categoryRefs,
  onCategoryClick,
  totalImages,
  resolveImageSrc,
  onOpenCarouselFromImage,
  isCarouselOpen,
  onCarouselDialogOpenChange,
  onCloseCarousel,
  activeCarouselImage,
  activeCarouselCategoryLabel,
  activeCarouselIndex,
  onCarouselNavigate,
}: PhotoDialogsSectionProps) {
  return (
    <>
      <Dialog open={ galleryOpen } onOpenChange={ onGalleryOpenChange }>
        <DialogContent className="flex h-screen w-screen max-w-[100vw] flex-col p-0 sm:max-w-[100vw]">
          <DialogHeader className="border-b border-border/50 px-6 py-4">
            <DialogTitle>Photo Tour</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="space-y-8 px-6 py-6">
              { categoryGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No photos uploaded yet.
                </p>
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
                            onClick={ () => onCategoryClick(group.anchor) }
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
                        <h3 className="font-semibold text-foreground">
                          { group.label }
                        </h3>
                        <span className="text-xs text-muted-foreground">
                          { group.images.length } photo
                          { group.images.length === 1 ? '' : 's' }
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-6 pb-3 pt-3 sm:grid-cols-2 lg:grid-cols-3">
                        { group.images.map((image, index) => {
                          const src = resolveImageSrc(image);
                          return (
                            <button
                              key={ `dialog-gallery-${group.anchor}-${image.id}` }
                              type="button"
                              onClick={ () => onOpenCarouselFromImage(image) }
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

      <Dialog
        open={ isCarouselOpen }
        onOpenChange={ onCarouselDialogOpenChange }
      >
        <DialogContent
          showCloseButton={ false }
          className="flex h-screen w-screen max-w-[100vw] flex-col gap-0 border-none bg-black p-0 text-white sm:max-w-[100vw] sm:rounded-none"
        >
          <DialogHeader className="flex flex-row items-center justify-between border-b border-white/10 px-4 py-3">
            <DialogTitle className="text-sm font-semibold text-white">
              { activeCarouselImage
                ? `${activeCarouselCategoryLabel} photos`
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
                onClick={ onCloseCarousel }
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
                  onClick={ () => onCarouselNavigate('prev') }
                  aria-label="Previous photo"
                  className="absolute left-4 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  <FiChevronLeft className="size-6" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={ () => onCarouselNavigate('next') }
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

type UnpublishDialogsSectionProps = Pick<
  SpaceDetailsDialogsSectionProps,
  | 'space'
  | 'isUnpublishDisabled'
  | 'isRequestUnpublishPending'
  | 'onOpenUnpublishDialog'
  | 'unpublishDialogOpen'
  | 'onUnpublishDialogOpenChange'
  | 'unpublishReason'
  | 'onUnpublishReasonChange'
  | 'onSubmitUnpublish'
>;

function UnpublishDialogsSection({
  space,
  isUnpublishDisabled,
  isRequestUnpublishPending,
  onOpenUnpublishDialog,
  unpublishDialogOpen,
  onUnpublishDialogOpenChange,
  unpublishReason,
  onUnpublishReasonChange,
  onSubmitUnpublish,
}: UnpublishDialogsSectionProps) {
  return (
    <>
      <Card className="border-border/70 bg-background/80">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">Unpublish this listing</CardTitle>
          <CardDescription>
            Hide the space from the marketplace. An admin must approve before
            it becomes invisible to guests.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="destructive"
            className="w-full sm:w-auto"
            disabled={ isUnpublishDisabled || isRequestUnpublishPending }
            onClick={ onOpenUnpublishDialog }
          >
            <FiEyeOff className="size-4" aria-hidden="true" />
            { space.pending_unpublish_request
              ? 'Request sent'
              : 'Request unpublish' }
          </Button>
        </CardFooter>
      </Card>

      <Dialog
        open={ unpublishDialogOpen }
        onOpenChange={ onUnpublishDialogOpenChange }
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Request to unpublish</DialogTitle>
            <DialogDescription>
              An admin will review your request before the listing is hidden
              from the marketplace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Reason (optional)</p>
            <Textarea
              value={ unpublishReason }
              onChange={ (event) => onUnpublishReasonChange(event.target.value) }
              maxLength={ 500 }
              aria-label="Reason for unpublishing"
              placeholder="Share context for the reviewer"
            />
            <p className="text-xs text-muted-foreground">
              { unpublishReason.length } / 500
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={ () => onUnpublishDialogOpenChange(false) }
              disabled={ isRequestUnpublishPending }
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={ onSubmitUnpublish }
              disabled={ isRequestUnpublishPending }
            >
              { isRequestUnpublishPending ? 'Sending…' : 'Send request' }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function useSpaceDetailsPanelController(spaceId: string | null) {
  const normalizedSpaceId = spaceId ?? '';
  const isMobile = useIsMobile();
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? null;
  const getPublicImageUrl = (path?: string | null) =>
    supabaseUrl && path
      ? `${supabaseUrl}/storage/v1/object/public/${path}`
      : null;
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
  const requestUnpublishMutation =
    useRequestUnpublishSpaceMutation(normalizedSpaceId);
  const descriptionForm = useForm<DescriptionFormValues>({
    resolver: zodResolver(descriptionSchema),
    defaultValues: { description: '', },
  });
  const [uiState, dispatchUiState] = useReducer(
    spaceDetailsUiReducer,
    undefined,
    createInitialSpaceDetailsUiState
  );

  const {
    isEditingDescription,
    areaDialogOpen,
    areaDialogValues,
    editingAreaId,
    areaPendingDelete,
    unpublishDialogOpen,
    unpublishReason,
    galleryOpen,
    carouselOpen,
    carouselIndex,
  } = uiState;

  const getDefaultAreaFormValues = () =>
    createAreaFormDefaults(space?.pricing_rules?.[0]?.id ?? null);

  const categoryRefs = useRef<Record<string, HTMLElement | null>>({});
  const descriptionValue = descriptionForm.watch('description');
  const descriptionPlainTextLength = richTextPlainTextLength(
    sanitizeRichText(descriptionValue ?? '')
  );
  const descriptionError = descriptionForm.formState.errors.description?.message;
  const isDescriptionDirty = descriptionForm.formState.isDirty;
  const isDeletingArea = deleteAreaMutation.isPending;
  const isUnpublishDisabled =
    !space || space.status === 'Unpublished' || space.pending_unpublish_request;

  const categoryGroups = useMemo<PhotoCategoryGroup[]>(() => {
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
  }, [space?.images]);

  const totalImages = space?.images?.length ?? 0;

  const activeCarouselIndex = useMemo(() => {
    const images = space?.images ?? [];
    if (images.length === 0) return null;
    if (carouselIndex === null) return null;
    return Math.min(Math.max(carouselIndex, 0), images.length - 1);
  }, [carouselIndex, space?.images]);

  const activeCarouselImage =
    activeCarouselIndex === null
      ? null
      : (space?.images ?? [])[activeCarouselIndex];
  const activeCarouselCategoryLabel = activeCarouselImage
    ? formatCategoryLabel(activeCarouselImage.category ?? null)
    : 'photo';
  const isCarouselOpen =
    carouselOpen &&
    activeCarouselIndex !== null &&
    (space?.images?.length ?? 0) > 0;

  const closeCarousel = () => {
    dispatchUiState({ type: 'closeCarousel', });
  };

  const openCarouselFromImage = (image?: SpaceImageRecord | null) => {
    if (!image) return;
    const images = space?.images ?? [];
    const index = images.findIndex((item) => item.id === image.id);
    if (index < 0) return;
    dispatchUiState({
      type: 'openCarousel',
      index,
    });
  };

  const handleCarouselNavigate = (direction: 'prev' | 'next') => {
    dispatchUiState({
      type: 'navigateCarousel',
      direction,
      total: space?.images?.length ?? 0,
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

  const setGalleryOpen = (open: boolean) => {
    dispatchUiState({
      type: 'setGalleryOpen',
      value: open,
    });
  };

  const setCarouselDialogOpen = (open: boolean) => {
    if (open) {
      dispatchUiState({
        type: 'setCarouselOpen',
        value: true,
      });
      return;
    }
    closeCarousel();
  };

  const openUnpublishDialog = () => {
    dispatchUiState({
      type: 'setUnpublishDialogOpen',
      value: true,
    });
  };

  const setUnpublishDialogOpen = (open: boolean) => {
    dispatchUiState({
      type: 'setUnpublishDialogOpen',
      value: open,
    });
  };

  const setUnpublishReason = (value: string) => {
    dispatchUiState({
      type: 'setUnpublishReason',
      value,
    });
  };

  useEffect(() => {
    if (!space || isEditingDescription) {
      return;
    }
    descriptionForm.reset({ description: sanitizeRichText(space.description ?? ''), });
  }, [descriptionForm, isEditingDescription, space]);

  const handleStartDescriptionEdit = () => {
    if (!space) return;
    dispatchUiState({
      type: 'setEditingDescription',
      value: true,
    });
    descriptionForm.reset({ description: sanitizeRichText(space.description ?? ''), });
    descriptionForm.clearErrors();
  };

  const handleCancelDescriptionEdit = () => {
    if (!space) return;
    dispatchUiState({
      type: 'setEditingDescription',
      value: false,
    });
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
      dispatchUiState({
        type: 'setEditingDescription',
        value: false,
      });
    } catch (mutationError) {
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to update description.'
      );
    }
  };

  const handleAddArea = () => {
    if (!space) return;
    dispatchUiState({
      type: 'openAreaDialog',
      areaId: null,
      values: getDefaultAreaFormValues(),
    });
  };

  const handleEditArea = (area: AreaRecord) => {
    if (!space) return;
    dispatchUiState({
      type: 'openAreaDialog',
      areaId: area.id,
      values: areaRecordToFormValues(area),
    });
  };

  const handleAreaDialogOpenChange = (open: boolean) => {
    if (open) {
      dispatchUiState({
        type: 'setAreaDialogOpen',
        value: true,
      });
      return;
    }
    dispatchUiState({
      type: 'resetAreaDialog',
      values: getDefaultAreaFormValues(),
    });
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
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to save area.'
      );
    }
  };

  const handleRequestDeleteArea = (area: AreaRecord) => {
    dispatchUiState({
      type: 'setAreaPendingDelete',
      value: area,
    });
  };

  const handleDeleteDialogOpenChange = (open: boolean) => {
    if (!open) {
      dispatchUiState({
        type: 'setAreaPendingDelete',
        value: null,
      });
    }
  };

  const handleConfirmAreaDelete = async () => {
    if (!areaPendingDelete) {
      return;
    }

    try {
      await deleteAreaMutation.mutateAsync(areaPendingDelete.id);
      toast.success(`${areaPendingDelete.name} removed.`);
      dispatchUiState({
        type: 'setAreaPendingDelete',
        value: null,
      });
    } catch (mutationError) {
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to delete area.'
      );
    }
  };

  const handleSubmitUnpublish = async () => {
    if (!space) return;
    try {
      await requestUnpublishMutation.mutateAsync({ reason: unpublishReason.trim() || undefined, });
      toast.success('Unpublish request sent for admin review.');
      dispatchUiState({
        type: 'setUnpublishDialogOpen',
        value: false,
      });
      dispatchUiState({
        type: 'setUnpublishReason',
        value: '',
      });
      await refetch();
    } catch (mutationError) {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to submit request.';
      toast.error(message);
    }
  };

  return {
    normalizedSpaceId,
    isMobile,
    space,
    isLoading,
    isError,
    error,
    refetch,
    descriptionForm,
    isEditingDescription,
    descriptionPlainTextLength,
    descriptionError,
    isDescriptionDirty,
    isDescriptionSaving: updateSpaceMutation.isPending,
    handleStartDescriptionEdit,
    handleCancelDescriptionEdit,
    handleDescriptionSubmit,
    handleEditArea,
    handleRequestDeleteArea,
    handleAddArea,
    areaDialogOpen,
    editingAreaId,
    areaDialogValues,
    handleAreaDialogOpenChange,
    handleAreaSubmit,
    isAreaSubmitting:
      editingAreaId
        ? updateAreaMutation.isPending
        : createAreaMutation.isPending,
    areaPendingDelete,
    handleDeleteDialogOpenChange,
    handleConfirmAreaDelete,
    isDeletingArea,
    galleryOpen,
    setGalleryOpen,
    categoryGroups,
    categoryRefs,
    handleCategoryClick,
    totalImages,
    resolveImageSrc,
    openCarouselFromImage,
    isCarouselOpen,
    setCarouselDialogOpen,
    closeCarousel,
    activeCarouselImage,
    activeCarouselCategoryLabel,
    activeCarouselIndex,
    handleCarouselNavigate,
    isUnpublishDisabled,
    isRequestUnpublishPending: requestUnpublishMutation.isPending,
    openUnpublishDialog,
    unpublishDialogOpen,
    setUnpublishDialogOpen,
    unpublishReason,
    setUnpublishReason,
    handleSubmitUnpublish,
  };
}

type SpaceDetailsPanelController = ReturnType<
  typeof useSpaceDetailsPanelController
>;

type SpaceDetailsLoadedViewProps = {
  className?: string;
  controller: SpaceDetailsPanelController;
};

function SpaceDetailsLoadedView({
  className,
  controller,
}: SpaceDetailsLoadedViewProps) {
  const { space, } = controller;
  if (!space) return null;

  const photoLayout = (
    <SpacePhotoLayout
      space={ space }
      totalImages={ controller.totalImages }
      isMobile={ controller.isMobile }
      resolveImageSrc={ controller.resolveImageSrc }
      onOpenGallery={ () => controller.setGalleryOpen(true) }
    />
  );

  return (
    <>
      <SpaceDetailsMainSection
        className={ className }
        space={ space }
        photoLayout={ photoLayout }
        isEditingDescription={ controller.isEditingDescription }
        descriptionForm={ controller.descriptionForm }
        descriptionPlainTextLength={ controller.descriptionPlainTextLength }
        descriptionError={ controller.descriptionError }
        isDescriptionDirty={ controller.isDescriptionDirty }
        isDescriptionSaving={ controller.isDescriptionSaving }
        onStartDescriptionEdit={ controller.handleStartDescriptionEdit }
        onCancelDescriptionEdit={ controller.handleCancelDescriptionEdit }
        onDescriptionSubmit={ controller.handleDescriptionSubmit }
        onEditArea={ controller.handleEditArea }
        onRequestDeleteArea={ controller.handleRequestDeleteArea }
        onAddArea={ controller.handleAddArea }
      />
      <SpaceDetailsDialogsSection
        space={ space }
        areaDialogOpen={ controller.areaDialogOpen }
        editingAreaId={ controller.editingAreaId }
        areaDialogValues={ controller.areaDialogValues }
        onAreaDialogOpenChange={ controller.handleAreaDialogOpenChange }
        onAreaSubmit={ controller.handleAreaSubmit }
        isAreaSubmitting={ controller.isAreaSubmitting }
        areaPendingDelete={ controller.areaPendingDelete }
        onDeleteDialogOpenChange={ controller.handleDeleteDialogOpenChange }
        onConfirmAreaDelete={ controller.handleConfirmAreaDelete }
        isDeletingArea={ controller.isDeletingArea }
        galleryOpen={ controller.galleryOpen }
        onGalleryOpenChange={ controller.setGalleryOpen }
        categoryGroups={ controller.categoryGroups }
        categoryRefs={ controller.categoryRefs }
        onCategoryClick={ controller.handleCategoryClick }
        totalImages={ controller.totalImages }
        resolveImageSrc={ controller.resolveImageSrc }
        onOpenCarouselFromImage={ controller.openCarouselFromImage }
        isCarouselOpen={ controller.isCarouselOpen }
        onCarouselDialogOpenChange={ controller.setCarouselDialogOpen }
        onCloseCarousel={ controller.closeCarousel }
        activeCarouselImage={ controller.activeCarouselImage }
        activeCarouselCategoryLabel={ controller.activeCarouselCategoryLabel }
        activeCarouselIndex={ controller.activeCarouselIndex }
        onCarouselNavigate={ controller.handleCarouselNavigate }
        isUnpublishDisabled={ controller.isUnpublishDisabled }
        isRequestUnpublishPending={ controller.isRequestUnpublishPending }
        onOpenUnpublishDialog={ controller.openUnpublishDialog }
        unpublishDialogOpen={ controller.unpublishDialogOpen }
        onUnpublishDialogOpenChange={ controller.setUnpublishDialogOpen }
        unpublishReason={ controller.unpublishReason }
        onUnpublishReasonChange={ controller.setUnpublishReason }
        onSubmitUnpublish={ controller.handleSubmitUnpublish }
      />
    </>
  );
}

export function SpaceDetailsPanel({
  spaceId,
  className,
}: SpaceDetailsPanelProps) {
  const controller = useSpaceDetailsPanelController(spaceId);

  if (!controller.normalizedSpaceId) {
    return renderSpaceDetailsStatusCard(
      'Space not found',
      'Select a valid listing to continue.',
      className
    );
  }

  if (controller.isLoading) {
    return <SpaceDetailsSkeleton className={ className } />;
  }

  if (controller.isError) {
    return (
      <Card className={ cn('border-none bg-transparent shadow-none', className) }>
        <CardContent className="flex flex-col items-center gap-6 px-6 py-10 text-center">
          <SystemErrorIllustration className="h-auto w-full max-w-[260px] md:max-w-[320px]" />
          <div className="space-y-2">
            <CardTitle className="text-xl text-muted-foreground md:text-2xl">
              Unable to load space
            </CardTitle>
            <CardDescription className="text-sm">
              { controller.error instanceof Error
                ? controller.error.message
                : 'Please try again in a moment.' }
            </CardDescription>
          </div>
          <Button variant="outline" onClick={ () => controller.refetch() }>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!controller.space) {
    return renderSpaceDetailsStatusCard(
      'Space not found',
      'The requested space does not exist.',
      className
    );
  }

  return <SpaceDetailsLoadedView className={ className } controller={ controller } />;
}

type PhotoTileProps = {
  alt: string;
  image: SpaceImageRecord | null | undefined;
  resolveImageSrc: (image?: SpaceImageRecord | null) => string | null;
  onOpenGallery: () => void;
  tileClass?: string;
  overlay?: ReactNode;
  blurBackground?: boolean;
};

function PhotoTile({
  alt,
  image,
  resolveImageSrc,
  onOpenGallery,
  tileClass,
  overlay,
  blurBackground = false,
}: PhotoTileProps) {
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
        onClick={ onOpenGallery }
        aria-label={ alt }
        className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="sr-only">{ alt }</span>
      </button>
    </div>
  );
}

type SeeMorePhotoTileProps = {
  previewImage: SpaceImageRecord | null | undefined;
  resolveImageSrc: (image?: SpaceImageRecord | null) => string | null;
  onOpenGallery: () => void;
  totalImages: number;
};

function SeeMorePhotoTile({
  previewImage,
  resolveImageSrc,
  onOpenGallery,
  totalImages,
}: SeeMorePhotoTileProps) {
  return (
    <PhotoTile
      image={ previewImage }
      resolveImageSrc={ resolveImageSrc }
      onOpenGallery={ onOpenGallery }
      alt="Open full image gallery"
      tileClass="rounded-br-lg"
      blurBackground
      overlay={ (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-white backdrop-blur-md">
          <span className="text-base font-semibold">See all photos</span>
          <span className="text-xs text-white/80">
            { totalImages } photo{ totalImages === 1 ? '' : 's' }
          </span>
        </div>
      ) }
    />
  );
}

function DetailField({
 label, value, 
}: { label: string; value: string }) {
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
                <div
                  key={ `field-skeleton-${index}` }
                  className="space-y-2 rounded-md border border-border/50 bg-muted/20 p-3"
                >
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
              <div
                key={ `area-skeleton-${index}` }
                className="space-y-3 rounded-md border border-border/60 p-4"
              >
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
