type Rating = { score: number; count: number };
type Highlight = { label: string; value: number };
type Testimonial = { author: string; date: string; content: string; color: string; rating: number };

const STAR_FILLED = String.fromCharCode(9733);
const STAR_EMPTY = String.fromCharCode(9734);

export default function Reviews({
  rating,
  highlights,
  testimonials,
}: {
  rating: Rating;
  highlights: Highlight[];
  testimonials: Testimonial[];
}) {
  const midpoint = Math.ceil(highlights.length / 2);
  const leftHighlights = highlights.slice(0, midpoint);
  const rightHighlights = highlights.slice(midpoint);

  return (
    <section className="space-y-6 border-t pt-10">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl text-foreground">
          * { rating.score.toFixed(1) } - { rating.count } reviews
        </h2>
        <button
          type="button"
          className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-primary"
        >
          Show more
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <dl className="grid gap-4 sm:grid-cols-2">
          { [leftHighlights, rightHighlights]
            .filter((group) => group.length > 0)
            .map((group, index) => (
              <div key={ index } className="space-y-4">
                { group.map((item) => (
                  <div key={ item.label } className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-foreground/80">
                      <dt>{ item.label }</dt>
                      <dd className="font-medium">{ item.value.toFixed(1) }</dd>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground"
                        style={ { width: `${(item.value / 5) * 100}%`, } }
                      />
                    </div>
                  </div>
                )) }
              </div>
            )) }
        </dl>

        <div className="grid gap-4">
          { testimonials.map((review) => (
            <article key={ review.author } className="space-y-3 rounded-2xl border p-4 shadow-sm">
              <header className="mb-3 flex items-center gap-3 text-sm">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                  style={ { backgroundColor: review.color, } }
                >
                  { review.author.charAt(0).toUpperCase() }
                </span>
                <div>
                  <p className="font-medium text-foreground">{ review.author }</p>
                  <p className="text-muted-foreground">{ review.date }</p>
                </div>
              </header>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-base">
                  { Array.from({ length: 5, }, (_, starIndex) => (
                    <span
                      key={ `${review.author}-star-${starIndex}` }
                      className={ starIndex < review.rating ? 'text-yellow-500' : 'text-muted-foreground' }
                    >
                      { starIndex < review.rating ? STAR_FILLED : STAR_EMPTY }
                    </span>
                  )) }
                </div>
                <span className="text-xs text-muted-foreground">{ review.rating }/5</span>
              </div>
              <p className="text-sm leading-relaxed text-foreground/80">{ review.content }</p>
            </article>
          )) }
        </div>
      </div>
    </section>
  );
}
