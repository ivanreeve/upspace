'use client';

import React from 'react';

import { AmenityControls } from './AmenityControls';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';

type AmenityModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amenities: string[];
  canAddAmenities: boolean;
  draftAmenity: string;
  remaining: number;
  onDraftChange: (value: string) => void;
  onDraftKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
  onCommitAmenity: () => void;
  onRemoveAmenity: (name: string) => void;
  onClearAmenities: () => void;
};

export function AmenityModal({
  open,
  onOpenChange,
  amenities,
  canAddAmenities,
  draftAmenity,
  remaining,
  onDraftChange,
  onDraftKeyDown,
  onCommitAmenity,
  onRemoveAmenity,
  onClearAmenities,
}: AmenityModalProps) {
  const hasAmenities = amenities.length > 0;
  const statusText = canAddAmenities
    ? `You can add ${remaining} more amenity${remaining === 1 ? '' : 'ies'}.`
    : 'Amenity limit reached. Remove one to add another.';

  return (
    <Dialog open={ open } onOpenChange={ onOpenChange }>
      <DialogContent className="max-w-2xl rounded-3xl border border-border/40 px-6 py-6 shadow-xl sm:px-8">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="text-2xl font-semibold text-[#0f5a62]">
            Manage amenities
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Add or remove amenities to fine-tune your workspace results.
          </DialogDescription>
        </DialogHeader>

        <p className="text-xs font-medium text-muted-foreground">{ statusText }</p>

        <AmenityControls
          amenities={ amenities }
          canAddAmenities={ canAddAmenities }
          draftAmenity={ draftAmenity }
          onDraftChange={ onDraftChange }
          onDraftKeyDown={ onDraftKeyDown }
          onCommitAmenity={ onCommitAmenity }
          onRemoveAmenity={ onRemoveAmenity }
        />

        <DialogFooter className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={ onClearAmenities }
            disabled={ !hasAmenities }
            className="h-10 px-4 text-sm font-semibold text-[#0f5a62] hover:bg-[#0f5a62]/10 disabled:opacity-40"
          >
            Clear amenities
          </Button>
          <DialogClose asChild>
            <Button
              type="button"
              className="h-10 rounded-xl bg-[#0f5a62] px-6 text-sm font-semibold text-white hover:bg-[#0f5a62]/90"
            >
              Done
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
