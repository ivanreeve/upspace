const MAP_PLACEHOLDER =
  'https://images.unsplash.com/photo-1502920764203-b859c2384716?auto=format&fit=crop&w=1400&q=80';

export default function WhereYoullBe({
  city,
  region,
  country,
}: { city: string; region: string; country: string }) {
  const label = [city, region, country].filter(Boolean).join(', ') || 'Taguig City, Metro Manila';

  return (
    <section className="space-y-4 border-t pt-6">
      <h2 className="text-xl font-medium">Where you’ll be</h2>
      <p className="text-sm text-muted-foreground">
        { label } · Map coming soon
      </p>
      <figure className="overflow-hidden rounded-2xl border">
        <img
          src={ MAP_PLACEHOLDER }
          alt="Map preview of the surrounding area"
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </figure>
    </section>
  );
}
