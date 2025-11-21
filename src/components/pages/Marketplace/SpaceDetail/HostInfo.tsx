export default function HostInfo({ hostName, }: { hostName?: string | null }) {
  const resolvedName = hostName?.trim() || 'Your host';
  const initial = resolvedName.charAt(0).toUpperCase();

  return (
    <section className="flex flex-col gap-4 rounded-2xl border px-6 py-5 shadow-sm md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-lg font-semibold text-foreground">
          { initial }
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Hosted by</p>
          <p className="text-base font-medium text-foreground">{ resolvedName }</p>
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
