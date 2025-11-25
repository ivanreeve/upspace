import { SpaceDetailSkeleton } from '@/components/pages/Marketplace/SpaceDetail/SpaceDetail.Skeleton';
import { Footer } from '@/components/ui/footer';

export default function LoadingSpaceDetailPage() {
  return (
    <>
      <SpaceDetailSkeleton />
      <Footer />
    </>
  );
}
