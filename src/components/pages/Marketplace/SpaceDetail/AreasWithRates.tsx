import type { SpaceAreaWithRates } from '@/lib/queries/space';

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});
const capacityFormatter = new Intl.NumberFormat('en-PH');

const formatCapacity = (area: SpaceAreaWithRates) => {
  if (area.maxCapacity && area.maxCapacity !== area.minCapacity) {
    return `${capacityFormatter.format(area.minCapacity)} – ${capacityFormatter.format(area.maxCapacity)} guests`;
  }
  return `${capacityFormatter.format(area.minCapacity)} guests`;
};

export default function AreasWithRates({ areas, }: { areas: SpaceAreaWithRates[] }) {
  if (areas.length === 0) return (
    <section className="space-y-4">
      <h2 className="text-xl font-medium">Areas & Rates</h2>
      <p className="text-muted-foreground">No areas available.</p>
    </section>
  );

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-medium">Areas & Rates</h2>
      <div className="space-y-4">
        { areas.map((area) => (
          <div key={ area.id } className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">{ area.name }</h3>
              <span className="text-sm text-muted-foreground">
                Capacity: { formatCapacity(area) }
              </span>
            </div>
            <div className="mt-2">
              { area.rates.length === 0 ? (
                <p className="text-muted-foreground">No rates set.</p>
              ) : (
                <ul className="list-disc pl-5 text-sm">
                  { area.rates.map((rate) => (
                    <li key={ rate.id }>
                      { rate.timeUnit }: { peso.format(rate.price) }
                    </li>
                  )) }
                </ul>
              ) }
            </div>
          </div>
        )) }
      </div>
    </section>
  );
}
