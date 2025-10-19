type Amenity = { amenity_id: bigint; name: string };
type Feature = { name: string; available: boolean };

export default function AmenitiesList({
  amenities,
  features,
}: {
  amenities: Amenity[];
  features: Feature[];
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
            { amenityNames.map((name) => (
              <li key={ name }>{ name }</li>
            )) }
          </ul>
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
