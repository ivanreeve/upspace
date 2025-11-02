import type { SpaceAmenity } from '@/lib/api/space';

export default function Amenities({ amenities, }: {
  amenities: SpaceAmenity[];
}) {
  const amenityNames = amenities.length > 0 ? amenities.map((a) => a.name) : [
    'Wifi',
    'Coffee',
    'Central air conditioning',
    'Whiteboard',
    'Security cameras on property',
    'Chairs',
    'Tables'
  ];

  return (
    <section className="space-y-6 border-t pt-10">
      <h2 className="text-2xl text-foreground">Amenities</h2>

      <ul className="grid gap-3 text-sm text-foreground/80 sm:grid-cols-2 lg:grid-cols-3">
        { amenityNames.map((name) => (
          <li
            key={ name }
            className="rounded-2xl border bg-background/70 px-4 py-3 shadow-sm"
          >
            { name }
          </li>
        )) }
      </ul>

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
