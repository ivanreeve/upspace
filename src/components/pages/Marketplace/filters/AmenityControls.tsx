'use client';

import React from 'react';
import { Plus, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type AmenityControlsProps = {
  amenities: string[];
  isPopoverOpen: boolean;
  canAddAmenities: boolean;
  draftAmenity: string;
  onDraftChange: (value: string) => void;
  onDraftKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
  onCommitAmenity: () => void;
  onRemoveAmenity: (name: string) => void;
  onPopoverOpenChange: (open: boolean) => void;
};

export function AmenityControls({
  amenities,
  isPopoverOpen,
  canAddAmenities,
  draftAmenity,
  onDraftChange,
  onDraftKeyDown,
  onCommitAmenity,
  onRemoveAmenity,
  onPopoverOpenChange,
}: AmenityControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      { amenities.length === 0 && (
        <Badge variant="secondary" className="bg-muted/40 text-muted-foreground">
          No amenities added yet
        </Badge>
      ) }
      { amenities.map((name) => (
        <span
          key={ name }
          className="inline-flex items-center gap-2 rounded-full bg-secondary/25 px-3 py-1.5 text-sm font-medium text-[#0f5a62]"
        >
          { name }
          <button
            type="button"
            onClick={ () => onRemoveAmenity(name) }
            aria-label={ `Remove ${name}` }
            className="text-[#0f5a62]/80 transition hover:text-[#0f5a62]"
          >
            <X className="size-4" />
          </button>
        </span>
      )) }

      <AddAmenityPopover
        isOpen={ canAddAmenities ? isPopoverOpen : false }
        canAddAmenities={ canAddAmenities }
        draftAmenity={ draftAmenity }
        onDraftChange={ onDraftChange }
        onDraftKeyDown={ onDraftKeyDown }
        onCommitAmenity={ onCommitAmenity }
        onOpenChange={ onPopoverOpenChange }
      />
    </div>
  );
}

type AddAmenityPopoverProps = {
  isOpen: boolean;
  canAddAmenities: boolean;
  draftAmenity: string;
  onDraftChange: (value: string) => void;
  onDraftKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
  onCommitAmenity: () => void;
  onOpenChange: (open: boolean) => void;
};

function AddAmenityPopover({
  isOpen,
  canAddAmenities,
  draftAmenity,
  onDraftChange,
  onDraftKeyDown,
  onCommitAmenity,
  onOpenChange,
}: AddAmenityPopoverProps) {
  return (
    <Popover open={ isOpen } onOpenChange={ onOpenChange }>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={ !canAddAmenities }
          className="h-9 rounded-full border-dashed border-[#0f5a62]/50 bg-transparent px-3 text-sm font-semibold text-[#0f5a62] hover:bg-secondary/20 disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground"
        >
          <Plus className="size-4" />
          { canAddAmenities ? 'Add amenity' : 'Limit reached' }
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 rounded-2xl border border-[#0f5a62]/30 bg-background/95 shadow-lg backdrop-blur-sm">
        <form
          className="flex flex-col gap-3"
          onSubmit={ (e) => {
            e.preventDefault();
            onCommitAmenity();
          } }
        >
          <div className="text-sm font-semibold text-[#0f5a62]">Add an amenity</div>
          <Input
            autoFocus
            value={ draftAmenity }
            onChange={ (e) => onDraftChange(e.target.value) }
            onKeyDown={ onDraftKeyDown }
            placeholder="Ex: Free WiFi"
            className="h-9 border border-[#0f5a62]/30 bg-muted/20 text-sm placeholder:text-muted-foreground focus-visible:ring-0"
          />
          <Button
            type="submit"
            disabled={ !canAddAmenities }
            className="h-9 rounded-full bg-[#0f5a62] text-sm font-semibold hover:bg-[#0f5a62]/90"
          >
            Add filter
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
