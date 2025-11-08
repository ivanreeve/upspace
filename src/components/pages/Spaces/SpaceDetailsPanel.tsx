'use client';

import { useState } from 'react';
import { FiEdit, FiLayers, FiPlus } from 'react-icons/fi';
import { toast } from 'sonner';

import {
  AreaDialog,
  AreaFormValues,
  SchemaReference,
  SpaceDialog,
  SpaceFormValues,
  createAreaFormDefaults,
  createSpaceFormDefaults,
  spaceRecordToFormValues
} from './SpaceForms';

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
import { cn } from '@/lib/utils';
import { useSpacesStore } from '@/stores/useSpacesStore';


type SpaceDetailsPanelProps = {
  spaceId: string | null;
  className?: string;
};

export function SpaceDetailsPanel({
  spaceId,
  className,
}: SpaceDetailsPanelProps) {
  const space = useSpacesStore((state) => state.spaces.find((entry) => entry.id === spaceId));
  const updateSpace = useSpacesStore((state) => state.updateSpace);
  const createArea = useSpacesStore((state) => state.createArea);

  const [spaceDialogOpen, setSpaceDialogOpen] = useState(false);
  const [spaceDialogValues, setSpaceDialogValues] = useState<SpaceFormValues>(createSpaceFormDefaults());
  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [areaDialogValues, setAreaDialogValues] = useState<AreaFormValues>(createAreaFormDefaults());

  const handleEditSpace = () => {
    if (!space) return;
    setSpaceDialogValues(spaceRecordToFormValues(space));
    setSpaceDialogOpen(true);
  };

  const handleSpaceSubmit = (values: SpaceFormValues) => {
    if (!space) return;
    updateSpace(space.id, values);
    toast.success(`${values.name} updated.`);
    setSpaceDialogOpen(false);
  };

  const handleAddArea = () => {
    if (!space) return;
    setAreaDialogValues(createAreaFormDefaults());
    setAreaDialogOpen(true);
  };

  const handleAreaSubmit = (values: AreaFormValues) => {
    if (!space) return;
    createArea(space.id, values);
    toast.success(`${values.name} added.`);
    setAreaDialogOpen(false);
  };

  if (!space) {
    return (
      <Card className={ cn('border-border/70 bg-background/80', className) }>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Select a space from the table to view details.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className={ cn('grid gap-6 lg:grid-cols-[3fr,2fr]', className) }>
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
            <p className="text-sm text-muted-foreground">{ space.description }</p>
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
                  <div className="flex items-center justify-between">
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
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <FiLayers className="size-3" aria-hidden="true" />
                      { area.min_capacity }-{ area.max_capacity } pax
                    </Badge>
                  </div>
                  <dl className="mt-3 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                    <div>
                      <dt className="uppercase tracking-wide">Capacity range</dt>
                      <dd className="text-foreground">{ area.min_capacity } to { area.max_capacity } seats</dd>
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

      <SpaceDialog
        open={ spaceDialogOpen }
        mode="edit"
        initialValues={ spaceDialogValues }
        onOpenChange={ setSpaceDialogOpen }
        onSubmit={ handleSpaceSubmit }
      />

      <AreaDialog
        open={ areaDialogOpen }
        initialValues={ areaDialogValues }
        onOpenChange={ setAreaDialogOpen }
        onSubmit={ handleAreaSubmit }
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
