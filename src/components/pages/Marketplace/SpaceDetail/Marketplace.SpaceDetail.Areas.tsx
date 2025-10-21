import Image from 'next/image';

const FALLBACK_AREA_IMAGES = [
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1559139808-cca9d5ce3f1d?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1596496050233-5ff7c4d01874?auto=format&fit=crop&w=900&q=80'
] as const;

type Rate = { rate_id: bigint; time_unit: string; price: any };
type AreaImage = { image_id: bigint; url: string };
type Area = {
  area_id: bigint;
  name: string;
  capacity: bigint;
  image: AreaImage[];
  rate_rate_area_idToarea: Rate[];
};

function formatPrice(price: Rate['price']) {
  if (price == null) return 'N/A';
  if (typeof price === 'string') return price;
  if (typeof price === 'number') return price.toString();
  if (typeof (price as unknown as { toString?: () => string }).toString === 'function') {
    return (price as unknown as { toString: () => string }).toString();
  }
  return String(price);
}

export default function Areas({ areas, }: {
  areas: Area[];
}) {
  if (!areas || areas.length === 0) {
    return (
      <section className="space-y-4 border-b pb-6">
        <h2 className="text-2xl text-foreground">Spaces & Areas</h2>
        <p className="text-sm text-muted-foreground">No areas have been published yet.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6 border-b pb-10">
      <div className="space-y-2">
        <h2 className="text-2xl text-foreground">Spaces & Areas</h2>
        <p className="text-sm text-muted-foreground">
          Explore the individual areas available inside this space, including visual previews and current
          rates.
        </p>
      </div>

      <div className="space-y-10">
        { areas.map((area, index) => {
          const fallbackCycle = Array.from({ length: 4, }, (_, fallbackIndex) =>
            FALLBACK_AREA_IMAGES[(index + fallbackIndex) % FALLBACK_AREA_IMAGES.length]
          );
          const sourceImages =
            area.image && area.image.length > 0
              ? area.image.slice(0, 4).map((img) => img.url)
              : [];

          const displayImages = [...sourceImages, ...fallbackCycle].slice(0, 4);

          return (
            <article
              key={ area.area_id.toString() }
              className="space-y-6 rounded-3xl border bg-background/70 p-6 shadow-sm"
            >
              <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Area { index + 1 }
                  </span>
                  <h3 className="text-xl text-foreground">{ area.name }</h3>
                </div>
                <span className="inline-flex min-w-[140px] items-center justify-center rounded-full border px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Capacity { area.capacity.toString() }
                </span>
              </header>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                { displayImages.map((src, imageIndex) => (
                  <figure
                    key={ `${area.area_id.toString()}-${imageIndex}` }
                    className="overflow-hidden rounded-2xl"
                  >
                    <Image
                      src={ src }
                      alt={ `${area.name} preview ${imageIndex + 1}` }
                      width={ 600 }
                      height={ 400 }
                      className="h-40 w-full object-cover sm:h-48"
                      loading="lazy"
                    />
                  </figure>
                )) }
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground/80">Current Rates</h4>
                { area.rate_rate_area_idToarea.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No rates set for this area.</p>
                ) : (
                  <ul className="grid gap-2 text-sm text-foreground/80 md:grid-cols-2">
                    { area.rate_rate_area_idToarea.map((rate) => (
                      <li
                        key={ rate.rate_id.toString() }
                        className="flex items-center justify-between rounded-xl border px-4 py-3"
                      >
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">
                          { rate.time_unit }
                        </span>
                        <span className="font-medium text-foreground">{ formatPrice(rate.price) }</span>
                      </li>
                    )) }
                  </ul>
                ) }
              </div>
            </article>
          );
        }) }
      </div>
    </section>
  );
}
