import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { CgSpinner } from 'react-icons/cg';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-[color,background-color,border-color,box-shadow,opacity] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 dark:text-foreground',
        destructive:
          'bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border bg-background shadow-xs hover:bg-accent hover:text-white dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary:
          'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
        ghost:
          'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-sm gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-sm px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  children,
  loading = false,
  loadingIndicator,
  loadingText,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean,
    loadingIndicator?: React.ReactNode,
    loadingText?: React.ReactNode,
  }) {
  const Comp = asChild ? Slot : 'button';
  const shouldRenderLoadingLayout =
    loading || loadingText !== undefined || loadingIndicator !== undefined;
  const resolvedLoadingIndicator = loadingIndicator ?? (
    <CgSpinner className="size-4 animate-spin" aria-hidden="true" />
  );
  const content = shouldRenderLoadingLayout
    ? (
      <span className="grid place-items-center">
        <span
          className={ cn(
            'col-start-1 row-start-1 inline-flex items-center gap-2',
            loading && 'invisible'
          ) }
        >
          { children }
        </span>
        <span
          className={ cn(
            'col-start-1 row-start-1 inline-flex items-center gap-2',
            !loading && 'invisible'
          ) }
        >
          { resolvedLoadingIndicator }
          { loadingText ?? children }
        </span>
      </span>
    )
    : children;

  return (
    <Comp
      data-slot="button"
      aria-busy={ loading || undefined }
      className={ cn(buttonVariants({
        variant,
        size,
        className,
      })) }
      { ...props }
    >
      { content }
    </Comp>
  );
}

export { Button, buttonVariants };
