export default function WhereYoullBe({
  city,
  region,
  country,
}: { city: string; region: string; country: string }) {
  const label = [city, region, country].filter(Boolean).join(', ') || 'Taguig City, Metro Manila';

  return (
    <section className="space-y-4 border-t pt-6">
      <h2 className="text-xl font-medium text-foreground">Where you will be</h2>
      <p className="text-sm text-muted-foreground">{ label }</p>
      <div className="overflow-hidden rounded-md border">
        <iframe
          title="Location map"
          src={ `https://www.google.com/maps?q=${ encodeURIComponent(label) }&output=embed` }
          loading="lazy"
          className="h-[420px] w-full border-0"
          allowFullScreen
        />
      </div>
    </section>
  );
}
