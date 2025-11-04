import { Badge } from '@/components/ui/badge';

type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status, }: StatusBadgeProps) {
  const normalized = status.toLowerCase();
  const variant =
    normalized === 'pending'
      ? 'secondary'
      : normalized === 'confirmed'
        ? 'default'
        : 'destructive';

  return (
    <Badge variant={ variant }>
      Status: { normalized.toUpperCase() }
    </Badge>
  );
}

