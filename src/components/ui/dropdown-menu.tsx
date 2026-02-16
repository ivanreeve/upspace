'use client';

import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';

import { cn } from '@/lib/utils';

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
const DropdownMenuSub = DropdownMenuPrimitive.Sub;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({
 className, align = 'end', sideOffset = 8, ...props 
}, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ ref }
      align={ align }
      sideOffset={ sideOffset }
      className={ cn(
        'z-50 min-w-[200px] overflow-hidden rounded-md border border-border bg-muted/20 text-foreground shadow-md animate-in data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
        className
      ) }
      { ...props }
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { inset?: boolean }
>(({
 className, inset, ...props 
}, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ ref }
    className={ cn(
      'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-2 text-sm font-medium text-foreground [&_svg:not([class*="text-"])]:text-muted-foreground outline-none transition-colors focus-visible:bg-accent focus-visible:text-primary focus-visible:[&_svg]:text-primary dark:focus-visible:text-accent-foreground dark:focus-visible:[&_svg]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-primary data-[highlighted]:[&_svg]:text-primary dark:data-[highlighted]:text-accent-foreground dark:data-[highlighted]:[&_svg]:text-accent-foreground',
      inset && 'pl-8',
      className
    ) }
    { ...props }
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & { inset?: boolean }
>(({
 className, inset, ...props 
}, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ ref }
    className={ cn(
      'px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground',
      inset && 'pl-8',
      className
    ) }
    { ...props }
  />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({
 className, ...props 
}, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ ref }
    className={ cn('my-1 h-px bg-border', className) }
    { ...props }
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuRadioGroup,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
};
