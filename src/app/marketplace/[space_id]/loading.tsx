import { SpaceDetailSkeleton } from '@/components/pages/Marketplace/SpaceDetail/SpaceDetail.Skeleton';
import { MarketplaceChrome } from '@/components/pages/Marketplace/MarketplaceChrome';
import { Footer } from '@/components/ui/footer';

export default function LoadingSpaceDetailPage() {
  return (
    <MarketplaceChrome>
      <SpaceDetailSkeleton />
      <Footer />
    </MarketplaceChrome>
  );
}
