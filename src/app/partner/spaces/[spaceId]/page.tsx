import { cookies } from 'next/headers';

import { SpaceDetailsPanel } from '@/components/pages/Spaces/SpaceDetailsPanel';
import { SpaceNameHeading } from '@/components/pages/Spaces/SpaceNameHeading';
import { SpaceStatusBadge } from '@/components/pages/Spaces/SpaceStatusBadge';
import { SpacesChrome } from '@/components/pages/Spaces/SpacesChrome';
import { SpacesBreadcrumbs } from '@/components/pages/Spaces/SpacesBreadcrumbs';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

type SpaceDetailRouteProps = {
  params: Promise<{ spaceId: string }>;
};

export default async function SpaceDetailRoute({ params, }: SpaceDetailRouteProps) {
  const { spaceId, } = await params;
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <SpacesChrome initialSidebarOpen={ initialSidebarOpen }>
      <div className="px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <SpacesBreadcrumbs
          currentPage="Manage space"
          className="mb-4 sm:mb-6"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="space-y-1">
            <SpaceStatusBadge spaceId={ spaceId } />
            <SpaceNameHeading spaceId={ spaceId } />
            <p className="text-sm text-muted-foreground md:text-base">
              Review the stored attributes below, edit them, or add new areas.
            </p>
          </div>
        </div>

        <SpaceDetailsPanel spaceId={ spaceId } className="mt-6 md:mt-8" />
      </div>
    </SpacesChrome>
  );
}
