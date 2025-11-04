import type { ReactNode } from 'react';

type SummaryRowProps = {
  label: string;
  children: ReactNode;
};

export function SummaryRow({
 label, children, 
}: SummaryRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{ label }</span>
      <span className="text-right font-medium text-foreground">{ children }</span>
    </div>
  );
}

