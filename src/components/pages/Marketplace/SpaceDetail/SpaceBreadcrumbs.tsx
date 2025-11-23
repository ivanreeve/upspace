'use client';

import type React from 'react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb';

type SpaceBreadcrumbsProps = {
  spaceName: string;
};

export default function SpaceBreadcrumbs({ spaceName, }: SpaceBreadcrumbsProps) {
  const [useHistoryNavigation, setUseHistoryNavigation] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hasHistory = window.history.length > 1;
    const referrer = document.referrer;

    let fromMarketplace = false;
    if (referrer) {
      try {
        const refUrl = new URL(referrer);
        fromMarketplace =
          refUrl.origin === window.location.origin && refUrl.pathname.startsWith('/marketplace');
      } catch {
        fromMarketplace = false;
      }
    }

    setUseHistoryNavigation(hasHistory && fromMarketplace);
  }, []);

  const handleNavigate = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (!useHistoryNavigation) return;

      event.preventDefault();
      window.history.back();
    },
    [useHistoryNavigation]
  );

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link
              href="/marketplace"
              prefetch
              aria-label="Back to Marketplace"
              onClick={ handleNavigate }
            >
              Marketplace
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="max-w-[min(70vw,480px)] truncate" title={ spaceName }>
            { spaceName }
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
