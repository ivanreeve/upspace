'use client';

import React from 'react';
import { ChevronDown, Filter } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';

type FilterActionsProps = {
  hasActiveFilters: boolean;
  onClear: () => void;
  canAddAmenities: boolean;
  isModalOpen: boolean;
  onModalOpenChange: (open: boolean) => void;
  onApply: () => void;
  modalContent: React.ReactNode;
};

export function FilterActions({
  hasActiveFilters,
  onClear,
  canAddAmenities,
  isModalOpen,
  onModalOpenChange,
  onApply,
  modalContent,
}: FilterActionsProps) {
  return (
    <Dialog open={ isModalOpen } onOpenChange={ onModalOpenChange }>
      <div className="flex items-center gap-2">
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-10 rounded-lg bg-transparent px-1 text-sm font-semibold text-[#0f5a62] hover:bg-transparent hover:text-[#0c4349]"
          >
            <Filter className="size-4" />
            <span>Filters</span>
            <ChevronDown className="size-4" />
          </Button>
        </DialogTrigger>
        <span className="h-5 w-px bg-border/70" aria-hidden />
      </div>

      <DialogContent className="max-w-3xl rounded-2xl border border-border/50 px-8 py-6 shadow-xl sm:px-10">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="text-2xl font-semibold text-[#0f5a62]">
            Refine your results
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Adjust pricing and ratings to find the perfect space for your needs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          { modalContent }
        </div>

        <DialogFooter className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={ onClear }
            disabled={ !hasActiveFilters }
            className="h-10 px-4 text-sm font-semibold text-[#0f5a62] hover:bg-[#0f5a62]/10 disabled:opacity-40"
          >
            Clear all filters
          </Button>
          <DialogClose asChild>
            <Button
              type="button"
              className="h-10 rounded-xl bg-[#0f5a62] px-6 text-sm font-semibold text-white hover:bg-[#0f5a62]/90"
              onClick={ onApply }
            >
              Apply filters
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
