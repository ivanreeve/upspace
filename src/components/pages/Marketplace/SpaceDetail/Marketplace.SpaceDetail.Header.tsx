type Rating = { score: number; count: number };

export default function Header({
  name,
  rating,
  location,
}: { name: string; rating: Rating; location: string }) {
  return (
    <header className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">{ name }</h1>
          <p className="text-sm text-muted-foreground">
            * { rating.score.toFixed(1) } - { rating.count } reviews - { location }
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-foreground">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 hover:bg-accent"
          >
            Share
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 hover:bg-accent"
          >
            Save
          </button>
        </div>
      </div>
    </header>
  );
}
