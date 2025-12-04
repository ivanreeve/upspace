import type { RefObject } from 'react';
import { FiMessageSquare } from 'react-icons/fi';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

type HostInfoProps = {
  hostName?: string | null;
  avatarUrl?: string | null;
  spaceName?: string | null;
  onMessageHost?: () => void;
  isMessagingDisabled?: boolean;
  messagingDisabledReason?: string;
};

export default function HostInfo({
  hostName,
  avatarUrl,
  spaceName,
  onMessageHost,
  isMessagingDisabled,
  messageButtonRef,
  messagingDisabledReason,
}: {
  hostName?: string | null;
  avatarUrl?: string | null;
  spaceName?: string | null;
  onMessageHost?: () => void;
  isMessagingDisabled?: boolean;
  messageButtonRef?: RefObject<HTMLButtonElement>;
  messagingDisabledReason?: string;
}) {
  const resolvedName = spaceName?.trim() || hostName?.trim() || 'Your host';
  const fallbackLabel = (spaceName ?? hostName ?? 'US').slice(0, 2).toUpperCase();
  const avatarAlt = spaceName?.trim()
    ? `${spaceName.trim()} featured image`
    : hostName?.trim()
      ? `${hostName.trim()}'s avatar`
      : 'Host avatar';
  const disabledReason = isMessagingDisabled
    ? messagingDisabledReason ?? 'Sign in to message the host'
    : undefined;

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-xs border px-6 py-5 shadow-sm md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        <Avatar>
          { avatarUrl ? <AvatarImage src={ avatarUrl } alt={ avatarAlt } /> : null }
          <AvatarFallback>{ fallbackLabel }</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm text-muted-foreground">Message This Space</p>
          <p className="text-base font-medium text-foreground">{ resolvedName }</p>
        </div>
      </div>
      <Button
        ref={ messageButtonRef }
        variant="default"
        type="button"
        onClick={ () => onMessageHost?.() }
        disabled={ isMessagingDisabled }
        title={ disabledReason }
        aria-label="Message host"
        className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground shrink-0"
      >
        <FiMessageSquare className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">Message Now</span>
      </Button>
      { disabledReason ? (
        <p className="w-full text-xs text-muted-foreground sm:w-auto sm:text-right">
          { disabledReason }
        </p>
      ) : null }
    </section>
  );
}
