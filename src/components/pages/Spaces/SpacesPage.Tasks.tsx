import { TASKS } from './SpacesPage.data';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

function severityBadgeVariant(severity: string) {
  if (severity === 'high') return 'destructive';
  if (severity === 'medium') return 'secondary';
  return 'outline';
}

export function SpacesTaskList() {
  return (
    <section id="tasks" className="space-y-6 py-12">
      <div className="space-y-1">
        <h2 className="text-3xl font-semibold tracking-tight">Operational tasks</h2>
        <p className="text-base text-muted-foreground">Stay compliant and keep your listings surfaced in enterprise search.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        { TASKS.map((task) => (
          <Card key={ task.id } className="h-full border-border/70 bg-background/80">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg leading-snug">{ task.title }</CardTitle>
                <Badge variant={ severityBadgeVariant(task.severity) }>{ task.severity }</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{ task.description }</p>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-semibold text-primary">{ task.due }</p>
            </CardContent>
          </Card>
        )) }
      </div>
    </section>
  );
}
