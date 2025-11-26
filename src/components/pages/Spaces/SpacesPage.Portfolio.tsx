import { Badge } from '@/components/ui/badge';

export function SpacesPortfolioTable() {
  return (
    <section id="portfolio" className="space-y-4 py-8 md:space-y-6 md:py-12">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Portfolio health</h2>
        <p className="text-sm text-muted-foreground md:text-base">Insights and automations are on the way.</p>
      </div>
      <div className="rounded-md border border-dashed border-border/70 bg-muted/30 px-6 py-12 text-center md:px-8 md:py-16">
        <Badge variant="outline" className="mx-auto w-fit text-[10px] uppercase tracking-wide text-muted-foreground md:text-xs">
          Coming soon
        </Badge>
        <p className="mt-3 text-xs text-muted-foreground md:mt-4 md:text-sm">
          We&apos;re building occupancy, approvals, and task insights for every partner space.
        </p>
      </div>
    </section>
  );
}
