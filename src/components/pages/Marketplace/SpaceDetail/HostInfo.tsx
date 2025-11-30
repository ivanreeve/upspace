import { FiMessageSquare } from 'react-icons/fi';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

export default function HostInfo({
  hostName,
  avatarUrl,
  onMessageHost,
  isMessagingDisabled,
}: {
  hostName?: string | null;
  avatarUrl?: string | null;
  onMessageHost?: () => void;
  isMessagingDisabled?: boolean;
}) {
  const resolvedName = hostName?.trim() || 'Your host';
  const fallbackLabel = 'US';
  const avatarAlt = resolvedName === 'Your host' ? 'Host avatar' : `${resolvedName}'s avatar`;
  const disabledReason = isMessagingDisabled ? 'Sign in to message the host' : undefined;

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-xs border px-6 py-5 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        <Avatar>
          { avatarUrl ? <AvatarImage src={ avatarUrl } alt={ avatarAlt } /> : null }
          <AvatarFallback className="text-white">{ fallbackLabel }</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm text-muted-foreground">Hosted by</p>
          <p className="text-base font-medium text-foreground">{ resolvedName }</p>
        </div>
      </div>
      <Button
        variant="default"
        type="button"
        onClick={ () => onMessageHost?.() }
        disabled={ isMessagingDisabled }
        title={ disabledReason }
        aria-label="Message host"
        className="inline-flex items-center justify-center gap-2 
                  shrink-0 rounded-xl
                  px-5 py-3 text-sm font-medium
                  bg-transparent border border-[#6E8F9A] text-[#034C53] 
                  hover:bg-[#034C53] hover:text-white
                  transition-colors"
      >
        <FiMessageSquare className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline"> Message Host</span>
      </Button>
    </section>
  );
}
