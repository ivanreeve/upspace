'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AMENITY_CATEGORY_DISPLAY_MAP } from '@/lib/amenity/amenity_category_display_map';
import type { SpaceAmenityDisplay } from '@/lib/queries/space';

type Feature = { name: string; available: boolean };

const MAX_VISIBLE_AMENITIES = 10;

const FALLBACK_AMENITIES: SpaceAmenityDisplay[] = [
  {
    id: 'fallback-wifi',
    name: 'Wifi',
    category: 'connectivity',
  },
  {
    id: 'fallback-coffee',
    name: 'Coffee',
    category: 'food_beverage',
  },
  {
    id: 'fallback-ac',
    name: 'Central air conditioning',
    category: 'comfort_well_being',
  },
  {
    id: 'fallback-whiteboard',
    name: 'Whiteboard',
    category: 'meeting_collaboration',
  },
  {
    id: 'fallback-security',
    name: 'Security cameras on property',
    category: 'access_security',
  },
  {
    id: 'fallback-chairs',
    name: 'Chairs',
    category: 'seating_workspace_types',
  },
  {
    id: 'fallback-tables',
    name: 'Tables',
    category: 'seating_workspace_types',
  }
];

export default function AmenitiesList({
  amenities,
  features,
}: {
  amenities: SpaceAmenityDisplay[];
  features: Feature[];
}) {
  const normalizedAmenities = amenities.length > 0 ? amenities : FALLBACK_AMENITIES;
  const visibleAmenities = normalizedAmenities.slice(0, MAX_VISIBLE_AMENITIES);
  const groupedAmenities = groupAmenitiesByCategory(normalizedAmenities);

  return (
    <section className="space-y-6 border-t pt-6">
      <h2 className="text-xl font-medium">What this place offers</h2>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Features
          </h3>
          <ul className="grid gap-2 text-sm text-foreground/80">
            { features.map((feature) => (
              <li
                key={ feature.name }
                className={ feature.available ? '' : 'line-through text-muted-foreground' }
              >
                { feature.name }
              </li>
            )) }
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Amenities
          </h3>
          <ul className="grid gap-2 text-sm text-foreground/80">
            { visibleAmenities.map((amenity) => (
              <li key={ amenity.id }>{ amenity.name }</li>
            )) }
          </ul>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Show all amenities">
                Show all amenities
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader className="space-y-1">
                <DialogTitle>All amenities</DialogTitle>
                <DialogDescription>Grouped by category for this space.</DialogDescription>
              </DialogHeader>
              { groupedAmenities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No amenities listed yet.</p>
              ) : (
                <ScrollArea className="max-h-[60vh] pr-3">
                  <div className="space-y-6 pr-2">
                    { groupedAmenities.map((group) => (
                      <section key={ group.key } className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-sm font-semibold text-foreground">{ group.label }</h3>
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">
                            { group.amenities.length } item{ group.amenities.length === 1 ? '' : 's' }
                          </span>
                        </div>
                        <ul className="grid grid-cols-1 gap-2 text-sm text-foreground/80 sm:grid-cols-2">
                          { group.amenities.map((name, index) => (
                            <li
                              key={ `${group.key}-${index}` }
                              className="rounded-sm border border-border/60 bg-muted/40 px-3 py-2"
                            >
                              { name }
                            </li>
                          )) }
                        </ul>
                      </section>
                    )) }
                  </div>
                </ScrollArea>
              ) }
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Do not see an amenity you are looking for?{ ' ' }
        <button
          type="button"
          className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
        >
          Ask the host
        </button>
      </p>
    </section>
  );
}

type AmenityGroup = {
  key: string;
  label: string;
  amenities: string[];
};

const formatCategoryLabel = (category: string | null) => {
  if (!category) return 'Other amenities';
  if (category && AMENITY_CATEGORY_DISPLAY_MAP[category]) {
    return AMENITY_CATEGORY_DISPLAY_MAP[category];
  }
  return category
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const groupAmenitiesByCategory = (amenityList: SpaceAmenityDisplay[]): AmenityGroup[] => {
  const grouped = new Map<string, AmenityGroup>();

  for (const amenity of amenityList) {
    const categoryKey = amenity.category ?? 'uncategorized';
    const label = formatCategoryLabel(amenity.category);
    const existing =
      grouped.get(categoryKey) ??
      {
        key: categoryKey,
        label,
        amenities: [],
      };
    existing.amenities.push(amenity.name);
    grouped.set(categoryKey, existing);
  }

  return Array.from(grouped.values())
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((group) => ({
      ...group,
      amenities: group.amenities.slice().sort((a, b) => a.localeCompare(b)),
    }));
};
