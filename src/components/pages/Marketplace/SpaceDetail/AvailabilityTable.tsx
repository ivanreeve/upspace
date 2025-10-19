const mondayFirstDays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
] as const;

type Availability = {
  availability_id: bigint;
  day_of_week: string;
  opening_time: Date | string;
  closing_time: Date | string;
};

function formatTimeHHmm(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const h = d.getUTCHours().toString().padStart(2, '0');
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export default function AvailabilityTable({ items, }: { items: Availability[] }) {
  const rows = [...items].sort(
    (a, b) =>
      mondayFirstDays.indexOf(a.day_of_week as typeof mondayFirstDays[number]) -
      mondayFirstDays.indexOf(b.day_of_week as typeof mondayFirstDays[number])
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
            { rows.map((s) => (
              <tr key={ s.availability_id.toString() } className="border-t">
                <td className="px-3 py-2">{ s.day_of_week }</td>
                <td className="px-3 py-2">{ formatTimeHHmm(s.opening_time) }</td>
                <td className="px-3 py-2">{ formatTimeHHmm(s.closing_time) }</td>
              </tr>
            )) }
          </tbody>
        </table>
      </div>
    </section>
  );
}
