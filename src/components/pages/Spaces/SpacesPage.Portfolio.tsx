import { Badge } from '@/components/ui/badge';

export function SpacesPortfolioTable() {
  return (
    <section id="portfolio" className="space-y-6 py-12">
      <div className="space-y-1">
        <h2 className="text-3xl font-semibold tracking-tight">Portfolio health</h2>
        <p className="text-base text-muted-foreground">Insights and automations are on the way.</p>
      </div>
      <div className="rounded-md border border-dashed border-border/70 bg-muted/30 px-8 py-16 text-center">
        <Badge variant="outline" className="mx-auto w-fit uppercase tracking-wide text-muted-foreground">
          Coming soon
        </Badge>
        <p className="mt-4 text-sm text-muted-foreground">
          We&apos;re building occupancy, approvals, and task insights for every partner space.
        </p>
      </div>
    </section>
  );
}
