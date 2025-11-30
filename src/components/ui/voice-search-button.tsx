'use client';

import * as React from 'react';
import { FiMic } from 'react-icons/fi';

import { cn } from '@/lib/utils';

type VoiceSearchButtonProps = {
  onClick: () => void;
  disabled?: boolean;
};

export function VoiceSearchButton({
  onClick,
  disabled,
}: VoiceSearchButtonProps) {
  return (
    <button
      type="button"
      aria-label="Open voice search"
      title="Open voice search"
      onClick={ onClick }
      disabled={ disabled }
      className={ cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 p-1 text-muted-foreground transition hover:border-border hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50',
        disabled && 'cursor-not-allowed opacity-50'
      ) }
    >
      <FiMic className="size-4" aria-hidden="true" />
    </button>
  );
}
