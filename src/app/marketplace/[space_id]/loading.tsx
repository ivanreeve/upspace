import { cookies } from 'next/headers';

import { SpaceDetailSkeleton } from '@/components/pages/Marketplace/SpaceDetail/SpaceDetail.Skeleton';
import { SpaceDetailShell } from '@/components/pages/Marketplace/SpaceDetail/SpaceDetailShell';
import { Footer } from '@/components/ui/footer';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

export default function LoadingSpaceDetailPage() {
  const sidebarCookie = cookies().get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <SpaceDetailShell initialSidebarOpen={ initialSidebarOpen }>
      <SpaceDetailSkeleton />
      <Footer />
    </SpaceDetailShell>
  );
}
