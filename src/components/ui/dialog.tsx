'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { XIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" { ...props } />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" { ...props } />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" { ...props } />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" { ...props } />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={ cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-40 bg-black/50',
        className
      ) }
      { ...props }
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  position = 'center',
  style,
  mobileFullScreen = false,
  fullWidth = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  position?: 'center' | 'top',
  mobileFullScreen?: boolean,
  fullWidth?: boolean,
}) {
  const isTopPosition = position === 'top';
  const topPositionPadding: React.CSSProperties | undefined = mobileFullScreen
    ? {
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }
    : isTopPosition
      ? { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 90px)', }
      : undefined;
  const containerPaddingClass = mobileFullScreen
    ? 'px-0 sm:px-0'
    : fullWidth
      ? 'px-0 sm:px-0'
      : 'px-4 sm:px-0';
  const containerStyle = fullWidth
    ? {
        ...(topPositionPadding ?? {}),
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }
    : topPositionPadding;
  const widthClasses = fullWidth
    ? 'w-full max-w-full lg:max-w-[900px]'
    : 'w-full max-w-[calc(100%-2rem)] sm:max-w-lg';

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <div
        className={ cn(
          'fixed inset-0 z-[60] flex justify-center pointer-events-none',
          containerPaddingClass,
          isTopPosition ? 'items-start' : 'items-center'
        ) }
        style={ containerStyle }
      >
        <DialogPrimitive.Content
          data-slot="dialog-content"
          className={ cn(
            'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 gap-4 rounded-lg border p-6 shadow-lg duration-200 pointer-events-auto',
            widthClasses,
            isTopPosition && !mobileFullScreen && 'mt-3 sm:mt-4',
            mobileFullScreen && 'h-full max-h-full w-full max-w-full rounded-none border-0 shadow-none',
            className
          ) }
          style={ style }
          { ...props }
        >
          { children }
          { showCloseButton && (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          ) }
        </DialogPrimitive.Content>
      </div>
    </DialogPortal>
  );
}

function DialogHeader({
 className, ...props 
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={ cn('flex flex-col gap-2 text-center sm:text-left', className) }
      { ...props }
    />
  );
}

function DialogFooter({
 className, ...props 
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={ cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        className
      ) }
      { ...props }
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={ cn('text-lg leading-none font-semibold', className) }
      { ...props }
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={ cn('text-muted-foreground text-sm', className) }
      { ...props }
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger
};
