'use client';

import Image from 'next/image';
import { useState, type ReactNode } from 'react';
import { FiEdit, FiLayers, FiPlus } from 'react-icons/fi';
import { toast } from 'sonner';

import {
  AreaDialog,
  SchemaReference,
  SpaceDialog,
  areaRecordToFormValues,
  createAreaFormDefaults,
  createSpaceFormDefaults,
  spaceRecordToFormValues
} from './SpaceForms';

import { AreaRecord } from '@/data/spaces';
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? '';
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
                <Skeleton className="h-40 w-full rounded-lg" />
                <Skeleton className="h-3 w-24" />
              </div>
            )) }
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[3fr,2fr]">
          <Card className="border-border/70 bg-background/80">
            <CardHeader className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              { Array.from({ length: 8, }).map((_, index) => (
                <div key={ `space-field-skeleton-${index}` } className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-full" />
                </div>
              )) }
            </CardContent>
            <CardFooter>
              <Skeleton className="h-24 w-full" />
            </CardFooter>
          </Card>
          <Card className="border-border/70 bg-background/80">
            <CardHeader className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-10 w-full" />
            </CardHeader>
            <CardContent className="space-y-4">
              { Array.from({ length: 3, }).map((_, index) => (
                <div key={ `area-skeleton-${index}` } className="space-y-3 rounded-lg border border-border/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                  <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </div>
              )) }
            </CardContent>
          </Card>
        </div>
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                { space.images.map((image) => {
                  const src = supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/${image.path}` : null;
                  return (
                    <figure key={ image.id } className="space-y-2">
                      { src ? (
                        <div className="relative aspect-video overflow-hidden rounded-lg border border-border/60 bg-muted">
                          <Image
                            src={ src }
                            alt={ image.category ?? `${space.name} photo` }
                            fill
                            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground">
                          Missing public URL
                        </div>
                      ) }
                      <figcaption className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{ image.category ?? 'Uncategorized' }</span>
                        { image.is_primary ? <Badge variant="secondary">Primary</Badge> : null }
                      </figcaption>
                    </figure>
                  );
                }) }
              </div>
            ) }
          </CardContent>
        </Card>

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
              { renderField('Unit / suite', space.unit_number, 'space', 'unit_number') }
              { renderField('Address subunit', space.address_subunit, 'space', 'address_subunit') }
              { renderField('Street', space.street, 'space', 'street') }
              { renderField('City', space.city, 'space', 'city') }
              { renderField('Region / state', space.region, 'space', 'region') }
              { renderField('Postal code', space.postal_code, 'space', 'postal_code') }
              { renderField('Country', space.country_code, 'space', 'country_code') }
              { renderField('Latitude', space.lat.toString(), 'space', 'lat') }
              { renderField('Longitude', space.long.toString(), 'space', 'long') }
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
                  <div key={ area.id } className="rounded-lg border border-border/60 p-4">
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
    </>
  );
}

function renderField(label: string, value: string, table: 'space' | 'area' | 'price_rate', column: string) {
  return (
    <div className="space-y-1 rounded-lg border border-border/50 bg-muted/20 p-3">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
        <span>{ label }</span>
        <SchemaReference table={ table } column={ column } />
      </div>
      <p className="text-base font-semibold text-foreground">{ value || '—' }</p>
    </div>
  );
}
