import type { LucideIcon } from 'lucide-react';
import { Building2, Handshake, Sparkles } from 'lucide-react';

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

export function About() {
  return (
    <section id="about" className="py-48 sm:py-40">
      <div className="mx-auto max-w-6xl space-y-12 px-6 lg:px-8">
        <div className="space-y-8 text-center lg:text-left">
          <Badge variant="secondary" className="mx-auto w-fit uppercase tracking-wide lg:mx-0">
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
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          { HIGHLIGHTS.map(({
 title, description, icon: Icon, 
}) => (
            <div
              key={ title }
              className="flex h-full flex-col gap-4 rounded-sm border border-border/70 bg-card/80 p-6 shadow-lg shadow-secondary/5 backdrop-blur-sm"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary/15 text-secondary">
                <Icon className="h-5 w-5" strokeWidth={ 1.8 } />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">{ title }</h3>
                <p className="text-sm text-muted-foreground leading-relaxed font-sf">
                  { description }
                </p>
              </div>
            </div>
          )) }
        </div>
      </div>
    </section>
  );
}
