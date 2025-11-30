'use client';

import type { IconType } from 'react-icons';
import { FiList } from 'react-icons/fi';

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
import { AMENITY_ICON_MAPPINGS } from '@/lib/amenity/amenity_icon_mappings';
import type { SpaceAmenityDisplay } from '@/lib/queries/space';

type Feature = { name: string; available: boolean };
type AmenityWithIcon = SpaceAmenityDisplay & { Icon: IconType; };

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
  onAskHost,
}: {
  amenities: SpaceAmenityDisplay[];
  features: Feature[];
  onAskHost?: () => void;
}) {
  const normalizedAmenities = amenities.length > 0 ? amenities : FALLBACK_AMENITIES;
  const amenitiesWithIcons: AmenityWithIcon[] = normalizedAmenities.map((amenity) => ({
    ...amenity,
    Icon: getIconForAmenity(amenity.name),
  }));
  const visibleAmenities = amenitiesWithIcons.slice(0, MAX_VISIBLE_AMENITIES);
  const groupedAmenities = groupAmenitiesByCategory(amenitiesWithIcons);

  return (
    <section className="space-y-6 border-t pt-6">
      <h2 className="text-xl font-medium">What this place offers</h2>

      <div className="space-y-6">
        { features.length > 0 ? (
          <ul className="grid gap-3.5 text-sm text-foreground/80">
            { features.map((feature) => (
              <li
                key={ feature.name }
                className={ feature.available ? '' : 'line-through text-muted-foreground' }
              >
                { feature.name }
              </li>
            )) }
          </ul>
        ) : null }

        <ul className="grid gap-3.5 text-sm text-foreground/80">
          { visibleAmenities.map((amenity) => {
            const Icon = amenity.Icon;
            return (
              <li key={ amenity.id } className="flex items-center gap-3.5">
                <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>{ amenity.name }</span>
              </li>
            );
          }) }
        </ul>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" aria-label="Show all amenities">
              Show all amenities
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader className="space-y-1 mb-4">
              <DialogTitle>All amenities</DialogTitle>
              <DialogDescription>Grouped by category for this space.</DialogDescription>
            </DialogHeader>
            { groupedAmenities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No amenities listed yet.</p>
            ) : (
              <ScrollArea className="max-h-[60vh] pr-3">
                <div className="space-y-6 pr-2">
                  { groupedAmenities.map((group) => (
                    <section key={ group.key } className="space-y-2.5">
                      <div className="flex items-center gap-3">
                        <h3 className="text-sm font-semibold text-foreground">{ group.label }</h3>
                      </div>
                      <ul className="grid grid-cols-1 gap-3 text-sm text-foreground/80 sm:grid-cols-2">
                        { group.amenities.map((amenity) => (
                          <li
                            key={ amenity.id }
                            className="flex items-center gap-3 rounded-sm border border-border/60 bg-muted/40 px-3.5 py-3"
                          >
                            <amenity.Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                            <span>{ amenity.name }</span>
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

      <p className="text-sm text-muted-foreground">
        Do not see an amenity you are looking for?{ ' ' }
        <button
          type="button"
          className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
          onClick={ onAskHost }
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
  amenities: AmenityWithIcon[];
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

const groupAmenitiesByCategory = (amenityList: AmenityWithIcon[]): AmenityGroup[] => {
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
    existing.amenities.push(amenity);
    grouped.set(categoryKey, existing);
  }

  return Array.from(grouped.values())
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((group) => ({
      ...group,
      amenities: group.amenities
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
};

const getIconForAmenity = (name: string): IconType => {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (AMENITY_ICON_MAPPINGS[normalized] as IconType) ?? FiList;
};
