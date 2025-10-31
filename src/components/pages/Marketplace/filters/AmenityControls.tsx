'use client';

import React from 'react';
import { Plus, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type AmenityControlsProps = {
  amenities: string[];
  canAddAmenities: boolean;
  draftAmenity: string;
  onDraftChange: (value: string) => void;
  onDraftKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
  onCommitAmenity: () => void;
  onRemoveAmenity: (name: string) => void;
  placeholder?: string;
  showInput?: boolean;
  readOnly?: boolean;
  containerClassName?: string;
};

export function AmenityControls({
  amenities,
  canAddAmenities,
  draftAmenity,
  onDraftChange,
  onDraftKeyDown,
  onCommitAmenity,
  onRemoveAmenity,
  placeholder = 'Add an amenity and press Enter',
  showInput = true,
  readOnly = false,
  containerClassName,
}: AmenityControlsProps) {
  const hasAmenities = amenities.length > 0;
  const emptyStateText = showInput ? 'Add a tag and press Enter' : 'No amenities added yet';
  const isInteractive = !readOnly;
  const pillBase =
    'inline-flex items-center rounded-lg px-2.5 py-1 text-sm font-medium shadow-xs transition-colors';

  return (
    <div
      className={ cn(
        'flex w-full flex-wrap items-center gap-2',
        isInteractive && 'rounded-lg border border-border/50 bg-muted/20 px-3 py-3 shadow-sm',
        readOnly && 'px-1 py-1',
        containerClassName
      ) }
    >
      { hasAmenities ? (
        amenities.map((name) => (
          isInteractive ? (
            <button
              key={ name }
              type="button"
              onClick={ () => onRemoveAmenity(name) }
              aria-label={ `Remove amenity ${name}` }
              className={ cn(
                pillBase,
                'group gap-2 border border-[#0f5a62] bg-[#0f5a62] text-white hover:bg-[#0f5a62]/90 focus:outline-none focus:ring-2 focus:ring-[#0f5a62]/30 focus:ring-offset-0'
              ) }
            >
              <span>{ name }</span>
              <span className="flex size-5 items-center justify-center rounded-md bg-white/20 text-white shadow-xs transition group-hover:bg-white group-hover:text-[#0f5a62]">
                <X className="size-3.5" />
              </span>
            </button>
          ) : (
            <span
              key={ name }
              className={ cn(
                pillBase,
                'border border-[#0f5a62] bg-[#0f5a62] text-white dark:border-[#0f5a62] dark:bg-[#0f5a62] dark:text-white'
              ) }
            >
              { name }
            </span>
          )
        ))
      ) : (
        <span className="inline-flex items-center gap-2 rounded-lg border border-dashed border-[#0f5a62]/30 bg-[#0f5a62]/5 px-3 py-1.5 text-sm text-muted-foreground dark:border-[#0f5a62]/40 dark:bg-[#0f5a62]/20">
          { emptyStateText }
        </span>
      ) }

      { showInput && isInteractive && (
        <div className="relative flex min-w-[200px] flex-1">
          <Plus className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            value={ draftAmenity }
            onChange={ (e) => onDraftChange(e.target.value) }
            onKeyDown={ onDraftKeyDown }
            disabled={ !canAddAmenities }
            placeholder={ canAddAmenities ? placeholder : 'Amenity limit reached' }
            className="h-9 flex-1 rounded-md border border-dashed border-border/60 bg-background/80 pl-9 pr-3 text-sm text-foreground focus-visible:border-[#0f5a62] focus-visible:ring-2 focus-visible:ring-[#0f5a62]/20 disabled:cursor-not-allowed disabled:text-muted-foreground"
          />
        </div>
      ) }
    </div>
  );
}
