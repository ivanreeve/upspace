import { Skeleton } from '@/components/ui/skeleton';

export function SpaceDetailSkeleton() {
  return (
    <main className="bg-background">
      <div className="mx-auto max-w-[1100px] space-y-8 px-4 py-10">
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-72" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Skeleton className="h-[320px] rounded-2xl" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            { Array.from({ length: 4, }).map((_, index) => (
              <Skeleton key={ index } className="h-[155px] rounded-2xl" />
            )) }
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>

            <div className="space-y-3">
              <Skeleton className="h-5 w-48" />
              { Array.from({ length: 4, }).map((_, index) => (
                <Skeleton key={ index } className="h-4 w-full" />
              )) }
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border p-4 shadow-sm">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <div className="space-y-2">
              { Array.from({ length: 3, }).map((_, index) => (
                <div key={ index } className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16" />
                </div>
              )) }
            </div>
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        </div>

        <div className="space-y-4">
          <Skeleton className="h-5 w-48" />
          <div className="grid gap-3 md:grid-cols-2">
            { Array.from({ length: 3, }).map((_, index) => (
              <div key={ index } className="space-y-3 rounded-2xl border p-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            )) }
          </div>
        </div>

        <div className="space-y-4">
          <Skeleton className="h-5 w-40" />
          <div className="space-y-2 rounded-2xl border p-4">
            { Array.from({ length: 5, }).map((_, index) => (
              <Skeleton key={ index } className="h-4 w-full" />
            )) }
          </div>
        </div>

        <div className="space-y-4">
          <Skeleton className="h-5 w-32" />
          <div className="space-y-3">
            { Array.from({ length: 2, }).map((_, index) => (
              <div key={ index } className="space-y-3 rounded-2xl border p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            )) }
          </div>
        </div>

        <div className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-52 w-full rounded-2xl" />
        </div>
      </div>
    </main>
  );
}
