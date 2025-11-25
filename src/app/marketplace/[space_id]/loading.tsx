import { SpaceDetailSkeleton } from '@/components/pages/Marketplace/SpaceDetail/SpaceDetail.Skeleton';
import { SpaceDetailShell } from '@/components/pages/Marketplace/SpaceDetail/SpaceDetailShell';
import { Footer } from '@/components/ui/footer';

export default function LoadingSpaceDetailPage() {
  return (
    <SpaceDetailShell>
      <SpaceDetailSkeleton />
      <Footer />
    </SpaceDetailShell>
  );
}
