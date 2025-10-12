import type { LucideIcon } from 'lucide-react';
import {
Building2,
Clock3,
Handshake,
Sparkles
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';

type Highlight = {
  title: string;
  description: string;
  icon: LucideIcon;
};

const HIGHLIGHTS: Highlight[] = [
  {
    title: 'Curated inventory across cities',
    description: 'Every workspace on UpSpace passes a quality review so you browse only trusted, high-performing locations.',
    icon: Building2,
  },
  {
    title: 'Smarter matching for teams',
    description: 'Our discovery engine learns your preferences and surfaces options with the amenities, vibe, and flexibility you care about.',
    icon: Sparkles,
  },
  {
    title: 'Partner-first management tools',
    description: 'Space owners track occupancy, manage approvals, and automate billing without leaving the UpSpace dashboard.',
    icon: Handshake,
  }
];

const STATS = [
  {
 value: '3.5k+',
label: 'Desks & suites ready to book', 
},
  {
 value: '92%',
label: 'Bookings confirmed on first request', 
},
  {
 value: '<24h',
label: 'Average partner response time', 
}
];

export function About() {
  return (
    <section id="about" className="py-24 sm:py-32">
      <div className="grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-8">
          <Badge variant="secondary" className="uppercase tracking-wide">
            About UpSpace
          </Badge>
          <div className="space-y-4">
            <h2 className="text-4xl sm:text-5xl font-instrument-serif leading-tight tracking-tight">
              Workspace discovery built for momentum.
            </h2>
            <p className="text-lg text-muted-foreground">
              UpSpace connects ambitious teams and independent creators with flexible workplaces they genuinely love.
              From curated collections and instant bookings to analytics that keep your operations sharp, we&rsquo;re
              shaping the future of where work happens.
            </p>
          </div>

          <div className="space-y-6">
            { HIGHLIGHTS.map(({
 title, description, icon: Icon, 
}) => (
              <div key={ title } className="flex items-start gap-4">
                <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-full bg-secondary/15 text-secondary">
                  <Icon className="h-5 w-5" strokeWidth={ 1.8 } />
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-medium">{ title }</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    { description }
                  </p>
                </div>
              </div>
            )) }
          </div>
        </div>

        <div className="relative">
          <div className="absolute -top-24 right-0 h-56 w-56 rounded-full bg-secondary/25 blur-3xl" aria-hidden="true" />
          <div className="relative rounded-3xl border bg-card/90 p-10 shadow-lg shadow-secondary/10 ring-1 ring-border/60 backdrop-blur">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Clock3 className="h-5 w-5" strokeWidth={ 1.8 } />
                </div>
                <div>
                  <p className="text-sm font-medium tracking-wide text-muted-foreground">Our mission</p>
                  <p className="text-base font-semibold">
                    Help teams focus on the work that matters, not the logistics.
                  </p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">
                We obsess over the experience end-to-end: verified listings, transparent pricing, and partner tooling
                that keeps every booking moving. When people feel confident in their workspace, they create their best
                work.
              </p>

              <div className="grid gap-4 sm:grid-cols-3">
                { STATS.map((stat) => (
                  <div
                    key={ stat.label }
                    className="rounded-2xl border border-border/60 bg-muted/30 px-5 py-6 text-center shadow-sm"
                  >
                    <span className="block text-3xl font-instrument-serif tracking-tight text-foreground">{ stat.value }</span>
                    <span className="mt-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      { stat.label }
                    </span>
                  </div>
                )) }
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
