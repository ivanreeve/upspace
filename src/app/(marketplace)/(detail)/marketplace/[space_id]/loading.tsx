import { SpaceDetailSkeleton } from '@/components/pages/Marketplace/SpaceDetail/SpaceDetail.Skeleton';
import { SpaceDetailShell } from '@/components/pages/Marketplace/SpaceDetail/SpaceDetailShell';

export default function LoadingSpaceDetailPage() {
  return (
    <SpaceDetailShell>
      <SpaceDetailSkeleton />
    </SpaceDetailShell>
  );
}
