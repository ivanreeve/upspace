import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function HostInfo({
  hostName,
  avatarUrl,
}: {
  hostName?: string | null;
  avatarUrl?: string | null;
}) {
  const resolvedName = hostName?.trim() || 'Your host';
  const fallbackLabel = 'US';
  const avatarAlt = resolvedName === 'Your host' ? 'Host avatar' : `${resolvedName}'s avatar`;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border px-6 py-5 shadow-sm md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        <Avatar>
          { avatarUrl ? <AvatarImage src={ avatarUrl } alt={ avatarAlt } /> : null }
          <AvatarFallback>{ fallbackLabel }</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm text-muted-foreground">Hosted by</p>
          <p className="text-base font-medium text-foreground">{ resolvedName }</p>
        </div>
      </div>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
      >
        Message Host
      </button>
    </section>
  );
}
