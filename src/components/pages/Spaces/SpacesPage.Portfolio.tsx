import { PARTNER_SPACES } from './SpacesPage.data';

import { Badge } from '@/components/ui/badge';

function getStatusVariant(status: string) {
  if (status === 'Live') return 'secondary';
  if (status === 'Pending') return 'outline';
  return 'outline';
}

export function SpacesPortfolioTable() {
  return (
    <section id="portfolio" className="space-y-6 py-12">
      <div className="space-y-1">
        <h2 className="text-3xl font-semibold tracking-tight">Portfolio health</h2>
        <p className="text-base text-muted-foreground">Monitor occupancy, approvals, and outstanding tasks per listing.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border/70 bg-background/80">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Space</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Occupancy</th>
              <th className="px-4 py-3">Next booking</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3 text-right">Alerts</th>
            </tr>
          </thead>
          <tbody>
            { PARTNER_SPACES.map((space) => (
              <tr key={ space.id } className="border-b border-border/50 last:border-b-0">
                <td className="px-4 py-4 font-semibold text-foreground">{ space.name }</td>
                <td className="px-4 py-4 text-muted-foreground">{ space.city }</td>
                <td className="px-4 py-4">
                  <Badge variant={ getStatusVariant(space.status) }>{ space.status }</Badge>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="relative h-2 w-28 rounded-full bg-muted">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-primary"
                        style={ { width: `${space.occupancy}%`, } }
                      />
                    </div>
                    <div className="text-sm font-medium">
                      { space.occupancy }%
                      <span className={ [
                        'ml-1 text-xs font-medium',
                        space.occupancyDelta >= 0 ? 'text-emerald-500' : 'text-amber-500'
                      ].join(' ') }>
                        { space.occupancyDelta >= 0 ? `+${space.occupancyDelta}` : space.occupancyDelta }%
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-muted-foreground">{ space.nextBooking }</td>
                <td className="px-4 py-4 text-muted-foreground">{ space.plan }</td>
                <td className="px-4 py-4 text-right text-sm font-semibold">
                  { space.unresolvedItems > 0 ? `${space.unresolvedItems} open` : 'Clear' }
                </td>
              </tr>
            )) }
          </tbody>
        </table>
      </div>
    </section>
  );
}
