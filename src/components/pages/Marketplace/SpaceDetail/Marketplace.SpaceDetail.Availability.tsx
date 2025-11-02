import type { SpaceAvailability } from '@/lib/api/space';

const mondayFirstOrder = [1, 2, 3, 4, 5, 6, 0];

function formatTimeHHmm(value: Date | string) {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '–';
  const h = d.getUTCHours().toString().padStart(2, '0');
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export default function Availability({ items, }: {
  items: SpaceAvailability[];
}) {
  const rows = [...(items ?? [])].sort(
    (a, b) => {
      const aIdx = mondayFirstOrder.indexOf(a.day_index);
      const bIdx = mondayFirstOrder.indexOf(b.day_index);
      const normalizedA = aIdx === -1 ? mondayFirstOrder.length : aIdx;
      const normalizedB = bIdx === -1 ? mondayFirstOrder.length : bIdx;
      return normalizedA - normalizedB;
    }
  );

  if (rows.length === 0) {
    return (
      <section className="space-y-4 border-b pb-6">
        <h2 className="text-2xl text-foreground">Weekly Availability</h2>
        <p className="text-sm text-muted-foreground">
          Availability has not been published for this space yet. Reach out to the host for custom scheduling.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6 border-b pb-10">
      <div className="space-y-2">
        <h2 className="text-2xl text-foreground">Weekly Availability</h2>
        <p className="text-sm text-muted-foreground">
          Choose the best day to visit. Hours are shown in the space&apos;s local time.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        { rows.map((slot) => (
          <article
            key={ slot.availability_id ?? slot.day_label }
            className="space-y-3 rounded-2xl border bg-background/70 p-4 shadow-sm"
          >
            <header className="flex items-center justify-between">
              <h3 className="text-base text-foreground">{ slot.day_label }</h3>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
                { formatTimeHHmm(slot.opening) } - { formatTimeHHmm(slot.closing) }
              </span>
            </header>
            <p className="text-sm text-muted-foreground">
              Book within these hours to guarantee access to the workspace.
            </p>
          </article>
        )) }
      </div>
    </section>
  );
}
