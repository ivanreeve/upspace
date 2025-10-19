const DEFAULT_IMAGES = [
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1507208773393-40d9fc670acf?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=900&q=80'
];

export default function ImageGallery({ images = DEFAULT_IMAGES, }: { images?: string[] }) {
  const primary = images[0];
  const secondary = images.slice(1, 5);

  return (
    <section className="rounded-3xl border bg-muted/20 p-3">
      <div className="grid gap-3 md:grid-cols-3">
        <figure className="overflow-hidden rounded-2xl md:col-span-2">
          <img
            src={ primary }
            alt="Primary view of the space"
            className="h-full w-full rounded-2xl object-cover"
            loading="lazy"
          />
        </figure>
        <div className="grid gap-3 md:grid-cols-2">
          { secondary.map((src, index) => (
            <figure key={ src } className="overflow-hidden rounded-2xl">
              <img
                src={ src }
                alt={ `Space gallery image ${ index + 2 }` }
                className="h-36 w-full rounded-2xl object-cover md:h-full"
                loading="lazy"
              />
            </figure>
          )) }
        </div>
      </div>
    </section>
  );
}
