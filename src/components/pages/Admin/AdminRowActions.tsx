'use client';

import { ReactNode } from 'react';
import { MdMoreHoriz } from 'react-icons/md';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type AdminRowActionsProps = {
  children: ReactNode;
  disabled?: boolean;
};

export function AdminRowActions({
  children,
  disabled,
}: AdminRowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="rounded-full border-border/70"
          disabled={ disabled }
          aria-label="Actions"
        >
          <MdMoreHoriz className="size-4" aria-hidden="true" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={ 6 }>
        { children }
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
