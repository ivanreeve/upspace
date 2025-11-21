import type { SpaceAvailabilityDisplay } from '@/lib/queries/space';

const mondayFirstDays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
] as const;

const dayIndex = mondayFirstDays.reduce<Record<string, number>>((acc, day, idx) => {
  acc[day] = idx;
  return acc;
}, {});

export default function AvailabilityTable({ items, }: { items: SpaceAvailabilityDisplay[] }) {
  const rows = [...items].sort(
    (a, b) =>
      (dayIndex[a.dayLabel] ?? Number.POSITIVE_INFINITY) -
      (dayIndex[b.dayLabel] ?? Number.POSITIVE_INFINITY)
  );

  if (rows.length === 0) return (
    <section className="space-y-3">
      <h2 className="text-xl font-medium">Availability</h2>
      <p className="text-muted-foreground">No availability published.</p>
    </section>
  );

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-medium">Availability</h2>
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Day</th>
              <th className="px-3 py-2 font-medium">Open</th>
              <th className="px-3 py-2 font-medium">Close</th>
            </tr>
          </thead>
          <tbody>
            { rows.map((slot) => (
              <tr key={ slot.id } className="border-t">
                <td className="px-3 py-2">{ slot.dayLabel }</td>
                <td className="px-3 py-2">{ slot.opensAt }</td>
                <td className="px-3 py-2">{ slot.closesAt }</td>
              </tr>
            )) }
          </tbody>
        </table>
      </div>
    </section>
  );
}
