import { SkeletonGrid } from '@/components/pages/Marketplace/Marketplace.Cards';
import { Skeleton } from '@/components/ui/skeleton';

export default function LoadingMarketplacePage() {
  return (
    <section className="relative mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <SkeletonGrid count={ 12 } />
      </div>
    </section>
  );
}
