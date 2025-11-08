import { WORKFLOW_STEPS } from './SpacesPage.data';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

function statusBadge(status: string) {
  if (status === 'Complete') return 'secondary';
  if (status === 'In progress') return 'default';
  return 'outline';
}

export function SpacesWorkflow() {
  return (
    <section id="workflow" className="space-y-6 py-12">
      <div className="space-y-1">
        <h2 className="text-3xl font-semibold tracking-tight">Rollout workflow</h2>
        <p className="text-base text-muted-foreground">Track every stage for onboarding new buildings or campaigns.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        { WORKFLOW_STEPS.map((step) => (
          <Card key={ step.id } className="h-full border-border/70 bg-background/80">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Step { step.id }</span>
                <Badge variant={ statusBadge(step.status) }>{ step.status }</Badge>
              </div>
              <CardTitle className="text-xl">{ step.title }</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>{ step.description }</p>
              <p className="font-semibold text-foreground">Owner: { step.owner }</p>
            </CardContent>
          </Card>
        )) }
      </div>
    </section>
  );
}
