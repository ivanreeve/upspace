'use client';

import Image from 'next/image';
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import {
FiEdit,
FiLayers,
FiPlus,
FiX
} from 'react-icons/fi';
import { toast } from 'sonner';

import {
  AreaDialog,
  SpaceDialog,
  areaRecordToFormValues,
  createAreaFormDefaults,
  createSpaceFormDefaults,
  spaceRecordToFormValues
} from './SpaceForms';

import { AreaRecord, SpaceImageRecord } from '@/data/spaces';
import {
  useCreateAreaMutation,
  usePartnerSpaceQuery,
  useUpdateAreaMutation,
  useUpdatePartnerSpaceMutation
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
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { sanitizeRichText } from '@/lib/rich-text';
import { cn } from '@/lib/utils';
import type { AreaFormValues, SpaceFormValues } from '@/lib/validations/spaces';


type SpaceDetailsPanelProps = {
  spaceId: string | null;
  className?: string;
};

export function SpaceDetailsPanel({
  spaceId,
  className,
}: SpaceDetailsPanelProps) {
  const normalizedSpaceId = spaceId ?? '';
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

  const [spaceDialogOpen, setSpaceDialogOpen] = useState(false);
  const [spaceDialogValues, setSpaceDialogValues] = useState<SpaceFormValues>(createSpaceFormDefaults());
  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [areaDialogValues, setAreaDialogValues] = useState<AreaFormValues>(createAreaFormDefaults());
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  
  // Controls the full-screen gallery modal
  const [galleryOpen, setGalleryOpen] = useState(false);

  const imagesByCategory = useMemo(() => {
    const images = space?.images ?? [];

    if (images.length === 0) {
      return [];
    }

    const groups: Record<string, SpaceImageRecord[]> = {};

    for (const image of images) {
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

  const handleEditSpace = () => {
    if (!space) return;
    setSpaceDialogValues(spaceRecordToFormValues(space));
    setSpaceDialogOpen(true);
  };

  const handleSpaceSubmit = async (values: SpaceFormValues) => {
    if (!space) return;
    try {
      await updateSpaceMutation.mutateAsync(values);
      toast.success(`${values.name} updated.`);
      setSpaceDialogOpen(false);
    } catch (mutationError) {
      toast.error(mutationError instanceof Error ? mutationError.message : 'Unable to update space.');
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
    return (
      // ... existing skeleton code ...
      <div className={ cn('space-y-6', className) }>
        <Card className="border-border/70 bg-background/80">
          <CardHeader className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            { Array.from({ length: 3, }).map((_, index) => (
              <div key={ `photo-skeleton-${index}` } className="space-y-2">
                <Skeleton className="h-40 w-full rounded-md" />
                <Skeleton className="h-3 w-24" />
              </div>
            )) }
          </CardContent>
        </Card>
        { /* ... rest of skeleton ... */ }
      </div>
    );
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
              <Badge variant="outline" className="font-mono text-xs uppercase tracking-wide">photos</Badge>
              <CardTitle className="text-2xl">Uploaded photos</CardTitle>
              <CardDescription>Images stored for this listing.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            { space.images.length === 0 ? (
              <p className="text-sm text-muted-foreground">No photos uploaded yet.</p>
            ) : (
              <div className="flex flex-col gap-4 lg:flex-row">
                { /* Main Featured Image Preview */ }
                <figure className="relative h-56 flex-1 overflow-hidden rounded-md border border-border/60 bg-muted sm:h-64 lg:h-72 xl:h-[22rem]">
                  { featuredImageUrl ? (
                    <Image
                      src={ featuredImageUrl }
                      alt={ primaryImage?.category ?? `${space.name} featured photo` }
                      fill
                      sizes="(min-width: 1280px) 55vw, (min-width: 1024px) 65vw, 100vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      Missing public URL
                    </div>
                  ) }
                  <figcaption className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-2 border-t border-border/50 bg-gradient-to-t from-background/90 to-transparent px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">
                    <span>{ primaryImage?.category ?? 'Featured' }</span>
                    { primaryImage?.is_primary ? <Badge variant="secondary">Primary</Badge> : null }
                  </figcaption>
                </figure>
                
                { /* Small Grid Images */ }
                <div className="grid grid-cols-2 grid-rows-2 gap-4 lg:w-[260px] xl:w-[320px]">
                  { Array.from({ length: 4, }).map((_, index) => {
                    const image = stackedImages[index];
                    const imageSrc = resolveImageSrc(image);
                    const isSeeMoreSlot = index === 3;

                    return (
                      <figure key={ `window-photo-${index}` }>
                        <div className="relative aspect-square w-full overflow-hidden rounded-md border border-border/60 bg-muted">
                          { imageSrc ? (
                            <Image
                              src={ imageSrc }
                              alt={ image.category ?? `${space.name} photo` }
                              fill
                              sizes="(min-width: 1280px) 160px, (min-width: 1024px) 140px, 45vw"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
                              No image
                            </div>
                          ) }
                          { isSeeMoreSlot ? (
                            <button
                              type="button"
                              onClick={ () => setGalleryOpen(true) }
                              aria-label="Open full image gallery"
                              className="absolute inset-0 flex items-center justify-center rounded-md bg-background/55 text-sm font-medium text-foreground backdrop-blur-md transition hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
            ) }
          </CardContent>
        </Card>

        { /* Details and Areas Cards */ }
        <div className="grid gap-6 lg:grid-cols-[3fr,2fr]">
          <Card className="border-border/70 bg-background/80">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <Badge variant="outline" className="font-mono text-xs uppercase tracking-wide">space</Badge>
                <CardTitle className="text-2xl">{ space.name }</CardTitle>
                <CardDescription>Values currently stored for <code>prisma.space</code>.</CardDescription>
              </div>
              <Button type="button" variant="secondary" onClick={ handleEditSpace } className="inline-flex items-center gap-2">
                <FiEdit className="size-4" aria-hidden="true" />
                Edit space
              </Button>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
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
            <CardFooter>
              { space.description ? (
                <div
                  className="text-sm text-muted-foreground leading-relaxed"
                  dangerouslySetInnerHTML={ { __html: sanitizeRichText(space.description), } }
                />
              ) : (
                <p className="text-sm text-muted-foreground">No description yet.</p>
              ) }
            </CardFooter>
          </Card>

          <Card className="border-border/70 bg-background/80">
            <CardHeader className="flex flex-col gap-4">
              <div className="space-y-1">
                <Badge variant="outline" className="font-mono text-xs uppercase tracking-wide">areas</Badge>
                <CardTitle className="text-2xl">Rentable areas</CardTitle>
                <CardDescription>Every row maps to <code>prisma.area</code> + <code>price_rate</code>.</CardDescription>
              </div>
              <Button type="button" onClick={ handleAddArea } className="inline-flex w-full items-center gap-2 sm:w-auto">
                <FiPlus className="size-4" aria-hidden="true" />
                Add area
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              { space.areas.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                  No areas yet. Use “Add area” to create one.
                </div>
              ) : (
                space.areas.map((area) => (
                  <div key={ area.id } className="rounded-md border border-border/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-base font-semibold">{ area.name }</h4>
                        <p className="text-xs text-muted-foreground">
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
                          Edit
                        </Button>
                      </div>
                    </div>
                    <dl className="mt-3 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                      <div>
                        <dt className="uppercase tracking-wide">Capacity range</dt>
                        <dd className="text-foreground">{ area.min_capacity } to { area.max_capacity } seats</dd>
                        <div className="mt-2">
                          <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                            <FiLayers className="size-3" aria-hidden="true" />
                            { area.min_capacity }-{ area.max_capacity } pax
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <dt className="uppercase tracking-wide">Base rate</dt>
                        <dd className="text-foreground">
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

      { /* Edit Forms */ }
      <SpaceDialog
        open={ spaceDialogOpen }
        mode="edit"
        initialValues={ spaceDialogValues }
        onOpenChange={ setSpaceDialogOpen }
        onSubmit={ handleSpaceSubmit }
        isSubmitting={ updateSpaceMutation.isPending }
      />

      <AreaDialog
        open={ areaDialogOpen }
        mode={ editingAreaId ? 'edit' : 'create' }
        initialValues={ areaDialogValues }
        onOpenChange={ handleAreaDialogOpenChange }
        onSubmit={ handleAreaSubmit }
        isSubmitting={ editingAreaId ? updateAreaMutation.isPending : createAreaMutation.isPending }
      />

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
                  { primaryImage?.is_primary && <Badge variant="secondary">Primary</Badge> }
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
                  <div className="grid grid-cols-2 gap-4 pb-2 pt-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    { images.map((img) => {
                      const src = resolveImageSrc(img);
                      return (
                        <div 
                          key={ img.id } 
                          className="relative aspect-[4/3] overflow-hidden rounded-md border border-border/60 bg-muted"
                        >
                          { src ? (
                            <Image
                              src={ src }
                              alt={ img.category ?? 'Gallery image' }
                              fill
                              sizes="(min-width: 1280px) 240px, (min-width: 1024px) 200px, 45vw"
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
