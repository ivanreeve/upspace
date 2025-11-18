import { type ReactNode } from 'react';
import { FiCheckCircle } from 'react-icons/fi';

import { cn } from '@/lib/utils';

export type AgreementChecklistItem = {
  id: string;
  content: ReactNode;
};

type AgreementChecklistProps = {
  items: AgreementChecklistItem[];
  title?: string;
  description?: string;
  className?: string;
};

export function AgreementChecklist({
  items,
  title = 'Checklist',
  description,
  className,
}: AgreementChecklistProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section
      aria-label={ title }
      className={ cn('rounded-lg border border-border/70 bg-background/80 p-4', className) }
    >
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-foreground">{ title }</p>
        { description && (
          <p className="text-xs text-muted-foreground">{ description }</p>
        ) }
      </div>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        { items.map((item) => (
          <li key={ item.id } className="flex items-start gap-2">
            <FiCheckCircle className="size-4 text-primary" aria-hidden="true" />
            <span className="leading-relaxed text-foreground">{ item.content }</span>
          </li>
        )) }
      </ul>
    </section>
  );
}
