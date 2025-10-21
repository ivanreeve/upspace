export default function Host({ hostName, }: {
  hostName: string;
}) {
  const initial = hostName.charAt(0).toUpperCase();

  return (
    <section className="flex flex-col gap-4 rounded-3xl border bg-background/70 px-6 py-5 shadow-sm md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-lg font-semibold text-foreground">
          { initial }
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Hosted by</p>
          <p className="text-base font-medium text-foreground">{ hostName }</p>
        </div>
      </div>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
      >
        Message Host
      </button>
    </section>
  );
}
