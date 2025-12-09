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
       <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-border shadow-sm">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-[#023347] text-white dark:bg-muted/50 dark:text-foreground">
            <tr>
             <th className="px-4 py-3 font-semibold text-left">Day</th>
              <th className="px-4 py-3 font-semibold text-left">Open</th>
              <th className="px-4 py-3 font-semibold text-left">Close</th>
            </tr>
          </thead>
          <tbody>
             { rows.map((slot, idx) => (
              <tr
                key={ slot.id }
                className={ `border-t border-gray-200 dark:border-border ${
                  idx % 2 === 0 
                    ? 'bg-[#FFFFFF] dark:bg-card'
                    : 'bg-[#fafafa] dark:bg-muted/30'
                }` }
              >
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-foreground">{ slot.dayLabel }</td>
                <td className="px-4 py-3 text-gray-700 dark:text-muted-foreground">{ slot.opensAt }</td>
                <td className="px-4 py-3 text-gray-700 dark:text-muted-foreground">{ slot.closesAt }</td>
              </tr>
            )) }
          </tbody>
        </table>
      </div>
    </section>
  );
}
