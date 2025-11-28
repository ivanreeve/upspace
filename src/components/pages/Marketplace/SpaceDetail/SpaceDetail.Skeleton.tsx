import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function SpaceDetailSkeleton() {
  return (
    <div className="bg-background">
      <div className="mx-auto max-w-[1100px] space-y-4 px-4 py-10">
        <Skeleton className="h-4 w-28" />

        <header className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-28 rounded-full" />
              <Skeleton className="h-10 w-24 rounded-full" />
            </div>
          </div>
        </header>

        <section className="space-y-3">
          <Card className="border-border/70 bg-background/80">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-64" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2.5 md:grid-cols-2">
                <div className="relative h-full overflow-hidden rounded-lg border border-border/60 bg-muted">
                  <Skeleton className="h-96 w-full rounded-l-lg sm:h-[28rem] lg:h-[30rem]" />
                </div>
                <div className="grid h-full min-h-[24rem] grid-rows-[1fr_3fr] gap-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="relative h-full overflow-hidden rounded-none border border-border/60 bg-muted">
                      <Skeleton className="h-full w-full rounded-none" />
                    </div>
                    <div className="relative h-full overflow-hidden rounded-tr-lg border border-border/60 bg-muted">
                      <Skeleton className="h-full w-full rounded-tr-lg" />
                    </div>
                  </div>
                  <div className="relative h-full overflow-hidden rounded-br-lg border border-border/60 bg-muted">
                    <Skeleton className="h-full w-full rounded-br-lg" />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)] lg:items-start">
          <div className="space-y-4">
            <section className="flex flex-wrap items-center justify-between gap-4 rounded-xs border px-6 py-5 shadow-sm md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </div>
              <Skeleton className="h-10 w-32 rounded-lg" />
            </section>

            <div className="lg:hidden">
              <div className="space-y-3 rounded-md border p-4 shadow-sm">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            </div>

            <section className="space-y-4 border-b pb-6">
              <Skeleton className="h-5 w-48" />
              <div className="space-y-2">
                { Array.from({ length: 6, }).map((_, index) => (
                  <Skeleton key={ index } className="h-4 w-full" />
                )) }
              </div>
              <div className="flex justify-center pt-1">
                <Skeleton className="h-10 w-32 rounded-lg" />
              </div>
            </section>
          </div>

          <div className="hidden lg:block">
            <div className="space-y-3 rounded-md border p-4 shadow-sm">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>
        </div>

        <section className="space-y-3">
          <Skeleton className="h-5 w-36" />
          <div className="overflow-hidden rounded-lg border">
            <div className="divide-y">
              { Array.from({ length: 4, }).map((_, index) => (
                <div key={ index } className="grid grid-cols-3 items-center gap-3 px-3 py-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                </div>
              )) }
            </div>
          </div>
        </section>

        <section className="space-y-4 border-b pb-6">
          <div className="grid gap-4 lg:grid-cols-2">
            { Array.from({ length: 2, }).map((_, index) => (
              <div key={ index } className="space-y-2 rounded-lg border p-4">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            )) }
          </div>
        </section>

        <section className="space-y-6 border-t pt-6">
          <Skeleton className="h-5 w-56" />
          <div className="grid gap-3 sm:grid-cols-2">
            { Array.from({ length: 6, }).map((_, index) => (
              <Skeleton key={ index } className="h-4 w-full" />
            )) }
          </div>
          <Skeleton className="h-9 w-44 rounded-md" />
          <Skeleton className="h-4 w-3/4" />
        </section>

        <section className="space-y-4">
          <Skeleton className="h-5 w-44" />
          <div className="space-y-3">
            { Array.from({ length: 2, }).map((_, index) => (
              <div key={ index } className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            )) }
          </div>
        </section>

        <section className="space-y-6 border-t pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-10 w-36 rounded-md" />
          </div>
          <div className="space-y-3 rounded-2xl border p-4">
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
        </section>

        <section className="space-y-4 border-t pt-6">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-[420px] w-full rounded-md border" />
        </section>
      </div>
    </div>
  );
}
