'use client';

import { ReactNode } from 'react';
import { FiMoreHorizontal } from 'react-icons/fi';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type AdminRowActionsProps = {
  children: ReactNode;
  disabled?: boolean;
};

export function AdminRowActions({
 children, disabled, 
}: AdminRowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-full"
          disabled={ disabled }
          aria-label="Actions"
        >
          <FiMoreHorizontal className="size-4" aria-hidden="true" />
          <span aria-hidden="true" className="text-xs font-semibold leading-none">
            …
          </span>
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={ 6 }>
        { children }
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
