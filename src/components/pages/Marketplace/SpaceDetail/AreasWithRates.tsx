type Rate = { rate_id: bigint; time_unit: string; price: any };
type Area = { area_id: bigint; name: string; capacity: bigint; rate_rate_area_idToarea: Rate[] };

export default function AreasWithRates({ areas, }: { areas: Area[] }) {
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
        { areas.map((ar) => (
          <div key={ ar.area_id.toString() } className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">{ ar.name }</h3>
              <span className="text-sm text-muted-foreground">
                Capacity: { ar.capacity.toString() }
              </span>
            </div>
            <div className="mt-2">
              { ar.rate_rate_area_idToarea.length === 0 ? (
                <p className="text-muted-foreground">No rates set.</p>
              ) : (
                <ul className="list-disc pl-5 text-sm">
                  { ar.rate_rate_area_idToarea.map((r) => (
                    <li key={ r.rate_id.toString() }>
                      { r.time_unit }: { typeof r.price?.toString === 'function' ? r.price.toString() : String(r.price) }
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
