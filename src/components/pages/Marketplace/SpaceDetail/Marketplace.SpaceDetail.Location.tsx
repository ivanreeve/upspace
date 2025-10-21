export default function Location({
  city,
  region,
  country,
}: {
  city: string;
  region: string;
  country: string;
}) {
  const mapQuery = 'Study Corner - San Marcelino';
  const label = [city, region, country].filter(Boolean).join(', ') || mapQuery;
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&t=&z=14&ie=UTF8&iwloc=&output=embed`;

  return (
    <section className="space-y-4 border-t pt-10">
      <h2 className="text-2xl text-foreground">Location</h2>
      <p className="text-sm text-muted-foreground">
        Explore the surrounding area near { label }. Map preview anchors to { mapQuery } as a placeholder.
      </p>
      <div className="overflow-hidden rounded-2xl border">
        <iframe
          title={ `Map of ${label}` }
          src={ mapSrc }
          loading="lazy"
          className="h-56 w-full border-0"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </section>
  );
}
