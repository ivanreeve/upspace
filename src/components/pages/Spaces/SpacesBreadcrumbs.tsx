'use client';

import Link from 'next/link';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb';
import { cn } from '@/lib/utils';

type SpacesBreadcrumbsProps = {
  currentPage: string;
  className?: string;
};

export function SpacesBreadcrumbs({
  currentPage,
  className,
}: SpacesBreadcrumbsProps) {
  return (
    <Breadcrumb className={ cn('w-full', className) }>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/partner/spaces" aria-label="Back to spaces">
              Spaces
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="text-sm font-medium">{ currentPage }</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
