'use client';

import Image from 'next/image';
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  FiEdit,
  FiLayers,
  FiPlus,
  FiTrash2
} from 'react-icons/fi';
import { FaImages } from 'react-icons/fa6';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { useIsMobile } from '@/hooks/use-mobile';

import {
  AreaDialog,
  DescriptionEditor,
  areaRecordToFormValues,
  createAreaFormDefaults,
  spaceRecordToFormValues
} from './SpaceForms';
import { SPACE_DESCRIPTION_VIEWER_CLASSNAME } from './space-description-rich-text';

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
  const descriptionValue = descriptionForm.watch('description');
  const descriptionPlainTextLength = richTextPlainTextLength(sanitizeRichText(descriptionValue ?? ''));
  const descriptionError = descriptionForm.formState.errors.description?.message;
  const isDescriptionDirty = descriptionForm.formState.isDirty;
  const isDeletingArea = deleteAreaMutation.isPending;

  const imagesByCategory = useMemo(() => {
    const images = space?.images ?? [];

    if (images.length === 0) {
      return [];
    }

    const primaryImageId =
      images.find((image) => image.is_primary)?.id ?? images[0]?.id ?? null;
    const groups: Record<string, SpaceImageRecord[]> = {};

    for (const image of images) {
      if (primaryImageId && image.id === primaryImageId) {
        continue;
      }
      const category = image.category ?? 'Uncategorized';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(image);
    }

    return Object.entries(groups).sort(([, current], [, next]) => next.length - current.length);
  }, [space?.images]);

  useEffect(() => {
    setGalleryOpen(false);
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
    return renderStatusCard(
      'Unable to load space',
      error instanceof Error ? error.message : 'Please try again in a moment.',
      <Button variant="outline" onClick={ () => refetch() }>
        Retry
      </Button>
    );
  }

  if (!space) {
    return renderStatusCard('Space not found', 'The requested space does not exist.');
  }

  const primaryImage = space.images.find((image) => image.is_primary) ?? space.images[0] ?? null;
  const stackedImages = space.images.filter((image) => image.id !== primaryImage?.id);
  const featuredImageUrl = resolveImageSrc(primaryImage);

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
            ) : space.images.length === 1 ? (
              <figure className="group relative w-full cursor-pointer overflow-hidden rounded-lg border border-border/60 bg-muted h-96 sm:h-[28rem] lg:h-[30rem] xl:h-[32rem]">
                { featuredImageUrl ? (
                  <Image
                    src={ featuredImageUrl }
                    alt={ `${space.name} featured photo` }
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
                { primaryImage ? (
                  <button
                    type="button"
                    onClick={ () => setGalleryOpen(true) }
                    aria-label="Open featured photo"
                    className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <span className="sr-only">Open featured photo</span>
                  </button>
                ) : null }
              </figure>
            ) : space.images.length === 2 ? (
              <div className="grid gap-2.5 md:grid-cols-2">
                <figure className="group relative w-full cursor-pointer overflow-hidden rounded-lg border border-border/60 bg-muted h-96 sm:h-[28rem] lg:h-[30rem] xl:h-[32rem]">
                  { featuredImageUrl ? (
                    <Image
                      src={ featuredImageUrl }
                      alt={ `${space.name} featured photo` }
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
                  { primaryImage ? (
                    <button
                      type="button"
                      onClick={ () => setGalleryOpen(true) }
                      aria-label="Open featured photo"
                      className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <span className="sr-only">Open featured photo</span>
                    </button>
                  ) : null }
                </figure>
                <div className="group relative h-full w-full overflow-hidden rounded-lg border border-border/60 bg-muted min-h-[16rem]">
                  { resolveImageSrc(stackedImages[0]) ? (
                    <Image
                      src={ resolveImageSrc(stackedImages[0])! }
                      alt={ `${space.name} gallery photo 2` }
                      fill
                      sizes="(min-width: 1280px) 360px, (min-width: 1024px) 300px, 100vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      No preview
                    </div>
                  ) }
                  <div className="pointer-events-none absolute inset-0 bg-black/25 opacity-0 transition duration-200 group-hover:opacity-100" />
                  <button
                    type="button"
                    onClick={ () => setGalleryOpen(true) }
                    aria-label={ `${space.name} gallery photo 2` }
                    className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <span className="sr-only">{ `${space.name} gallery photo 2` }</span>
                  </button>
                </div>
              </div>
            ) : space.images.length === 3 ? (
              <div className="grid gap-2.5 md:grid-cols-2">
                <figure className="group relative w-full cursor-pointer overflow-hidden rounded-lg border border-border/60 bg-muted h-96 sm:h-[28rem] lg:h-[30rem] xl:h-[32rem]">
                  { featuredImageUrl ? (
                    <Image
                      src={ featuredImageUrl }
                      alt={ `${space.name} featured photo` }
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
                  { primaryImage ? (
                    <button
                      type="button"
                      onClick={ () => setGalleryOpen(true) }
                      aria-label="Open featured photo"
                      className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <span className="sr-only">Open featured photo</span>
                    </button>
                  ) : null }
                </figure>
                <div className="grid h-full min-h-[22rem] grid-rows-2 gap-2.5">
                  { [0, 1].map((index) => {
                    const image = stackedImages[index];
                    const imageSrc = resolveImageSrc(image);
                    return (
                      <div key={ index } className={ `group relative h-full w-full overflow-hidden border border-border/60 bg-muted ${index === 0 ? 'rounded-tr-lg' : 'rounded-br-lg'}` }>
                        { imageSrc ? (
                          <Image
                            src={ imageSrc }
                            alt={ `${space.name} gallery photo ${index + 2}` }
                            fill
                            sizes="(min-width: 1280px) 360px, (min-width: 1024px) 300px, 100vw"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                            No preview
                          </div>
                        ) }
                        <div className="pointer-events-none absolute inset-0 bg-black/25 opacity-0 transition duration-200 group-hover:opacity-100" />
                        <button
                          type="button"
                          onClick={ () => setGalleryOpen(true) }
                          aria-label={ `${space.name} gallery photo ${index + 2}` }
                          className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          <span className="sr-only">{ `${space.name} gallery photo ${index + 2}` }</span>
                        </button>
                      </div>
                    );
                  }) }
                </div>
              </div>
            ) : (
              <div className="grid gap-2.5 md:grid-cols-2">
                <figure className="group relative w-full cursor-pointer overflow-hidden rounded-lg border border-border/60 bg-muted h-96 sm:h-[28rem] lg:h-[30rem] xl:h-[32rem]">
                  { featuredImageUrl ? (
                    <Image
                      src={ featuredImageUrl }
                      alt={ `${space.name} featured photo` }
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
                  { primaryImage ? (
                    <button
                      type="button"
                      onClick={ () => setGalleryOpen(true) }
                      aria-label="Open featured photo"
                      className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <span className="sr-only">Open featured photo</span>
                    </button>
                  ) : null }
                </figure>
                <div className="grid h-full min-h-[24rem] grid-rows-[2fr_1fr_1fr] gap-2.5">
                  { [0, 1, 2].map((index) => {
                    const image = stackedImages[index];
                    const imageSrc = resolveImageSrc(image);
                    const isSeeMoreSlot = index === 2 && space.images.length >= 5;
                    return (
                      <div
                        key={ index }
                        className={ `group relative h-full w-full overflow-hidden border border-border/60 bg-muted ${
                          index === 0 ? 'rounded-tr-lg' : index === 2 ? 'rounded-br-lg' : ''
                        }` }
                      >
                        { imageSrc ? (
                          <Image
                            src={ imageSrc }
                            alt={ `${space.name} gallery photo ${index + 2}` }
                            fill
                            sizes="(min-width: 1280px) 360px, (min-width: 1024px) 300px, 100vw"
                            className={ `object-cover ${isSeeMoreSlot ? 'scale-105 blur-[2px] brightness-50' : ''}` }
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                            No preview
                          </div>
                        ) }
                        <div className="pointer-events-none absolute inset-0 bg-black/25 opacity-0 transition duration-200 group-hover:opacity-100" />
                        { isSeeMoreSlot ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-white backdrop-blur-md">
                            <span className="text-base font-semibold">See all photos</span>
                            <span className="text-xs text-white/80">{ space.images.length } photo{ space.images.length === 1 ? '' : 's' }</span>
                          </div>
                        ) : null }
                        <button
                          type="button"
                          onClick={ () => setGalleryOpen(true) }
                          aria-label={ isSeeMoreSlot ? 'Open full image gallery' : `${space.name} gallery photo ${index + 2}` }
                          className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          <span className="sr-only">{ isSeeMoreSlot ? 'Open full image gallery' : `${space.name} gallery photo ${index + 2}` }</span>
                        </button>
                      </div>
                    );
                  }) }
                </div>
              </div>
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
                  <CardDescription className="text-xs md:text-sm">Rendered rich text from <code>prisma.space.description</code>.</CardDescription>
                </div>
                { !isEditingDescription ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={ handleStartDescriptionEdit }
                    className="inline-flex w-full items-center gap-2 sm:w-auto md:size-auto"
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
                  <CardTitle className="text-xl md:text-2xl">{ space.name }</CardTitle>
                  <CardDescription className="text-xs md:text-sm">Values currently stored for <code>prisma.space</code>.</CardDescription>
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
                          Added { new Date(area.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          }) }
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
                          ${ area.rate_amount.toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2,
                          }) } / { area.rate_time_unit }
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
        <DialogContent className="flex h-[90vh] w-full max-w-[95vw] sm:max-w-[90vw] lg:max-w-6xl flex-col p-0">
          <DialogHeader className="border-b border-border/50 px-6 py-4">
            <DialogTitle>Image Gallery</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="space-y-8 px-6 py-6">
              
              { /* 1. Featured Image Section */ }
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold uppercase tracking-wide text-foreground">Featured</h3>
                </div>
                <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border/60 bg-muted">
                  { featuredImageUrl ? (
                    <Image
                      src={ featuredImageUrl }
                      alt="Featured space image"
                      fill
                      sizes="(min-width: 1024px) 80vw, 100vw"
                      className="object-cover"
                      priority
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      No featured image
                    </div>
                  ) }
                </div>
              </section>

              { /* 2. Category Sections (Horizontal Scroll) */ }
              { imagesByCategory.map(([category, images]) => (
                <section key={ category } className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-border/30 pb-2">
                    <h3 className="font-semibold text-foreground">{ category }</h3>
                    <span className="text-xs text-muted-foreground">({ images.length })</span>
                  </div>
                  
                  { /* Responsive Grid Container */ }
                  <div className="grid grid-cols-1 gap-6 pb-3 pt-3 sm:grid-cols-2 lg:grid-cols-3">
                    { images.map((img) => {
                      const src = resolveImageSrc(img);
                      return (
                        <div 
                          key={ img.id } 
                          className="relative aspect-[3/2] min-h-[220px] overflow-hidden rounded-lg border border-border/60 bg-muted shadow-sm"
                        >
                          { src ? (
                            <Image
                              src={ src }
                              alt={ img.category ?? 'Gallery image' }
                              fill
                              sizes="(min-width: 1280px) 360px, (min-width: 1024px) 300px, 100vw"
                              className="object-cover transition-transform hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                              No Image
                            </div>
                          ) }
                        </div>
                      );
                    }) }
                  </div>
                </section>
              )) }
            </div>
          </ScrollArea>
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
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:items-stretch xl:grid-cols-[minmax(0,1fr)_320px]">
            <Skeleton className="h-56 w-full rounded-md sm:h-64 lg:h-72 xl:h-[22rem]" />
            <div className="grid grid-cols-2 grid-rows-2 gap-4 lg:h-full">
              { Array.from({ length: 4, }).map((_, index) => (
                <Skeleton key={ `gallery-skeleton-${index}` } className="h-32 w-full rounded-md sm:h-36 lg:h-full" />
              )) }
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[3fr,2fr]">
        <div className="space-y-6">
          <Card className="border-border/70 bg-background/80">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-64" />
              </div>
              <Skeleton className="h-9 w-36" />
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
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              { Array.from({ length: 6, }).map((_, index) => (
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
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
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
