'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { FiPlus } from 'react-icons/fi';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { usePartnerSpacesQuery } from '@/hooks/api/usePartnerSpaces';
import { cn } from '@/lib/utils';

export function SpacesInventoryForm() {
  const {
    data: spaces,
    isLoading,
    isError,
    error,
    refetch,
  } = usePartnerSpacesQuery();

  const tableRows = useMemo(() => (spaces ?? []).map((space) => ({
    id: space.id,
    name: space.name,
    location: `${space.city}, ${space.region}`,
    status: space.status,
    areas: space.areas.length,
    created_at: space.created_at,
  })), [spaces]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="rounded-md border border-border/70 bg-background/80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Space</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Areas</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              { Array.from({ length: 4, }).map((_, index) => (
                <TableRow key={ `space-skeleton-${index}` }>
                  <TableCell>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-10" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-8 w-16 rounded-md" />
                  </TableCell>
                </TableRow>
              )) }
            </TableBody>
          </Table>
        </div>
      );
    }

    if (isError) {
      return (
        <Card className="border-none bg-transparent">
          <CardContent className="flex flex-col items-center gap-6 px-6 py-10 text-center">
            <SystemErrorIllustration className="h-auto w-full max-w-[320px] md:max-w-[420px]" />
            <div className="space-y-3">
              <CardTitle className="text-xl text-muted-foreground md:text-2xl">Unable to load spaces</CardTitle>
              <CardDescription className="text-sm">
                { error instanceof Error ? error.message : 'Something went a little bleep-bloop. Please try again in a moment.' }
              </CardDescription>
            </div>
            <Button variant="outline" onClick={ () => refetch() }>
              Retry
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (!spaces || spaces.length === 0) {
      return (
        <Card className="border-dashed border-border/70 bg-background/60">
          <CardHeader>
            <CardTitle>No spaces yet</CardTitle>
            <CardDescription>Use “Add space” to create your first entry.</CardDescription>
          </CardHeader>
        </Card>
      );
    }

    return (
      <>
        { /* Desktop Table View */ }
        <div className="hidden rounded-md border border-border/70 bg-background/80 md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Space</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Areas</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              { tableRows.map((space) => (
                <TableRow key={ space.id } className="cursor-pointer transition hover:bg-muted/40">
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{ space.name }</span>
                      <span className="text-xs text-muted-foreground">
                        Added { new Date(space.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        }) }
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{ space.location }</TableCell>
                  <TableCell>
                    <Badge variant={ space.status === 'Live' ? 'secondary' : 'outline' }>{ space.status }</Badge>
                  </TableCell>
                  <TableCell>{ space.areas }</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href={ `/spaces/${space.id}` }>Open</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              )) }
            </TableBody>
          </Table>
        </div>

        { /* Mobile Card View */ }
        <div className="space-y-3 md:hidden">
          { tableRows.map((space) => (
            <Card key={ space.id } className="border-border/70 bg-background/80">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg leading-tight">{ space.name }</CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      { space.location }
                    </CardDescription>
                  </div>
                  <Badge variant={ space.status === 'Live' ? 'secondary' : 'outline' } className="shrink-0">
                    { space.status }
                  </Badge>
                </div>
              </CardHeader>
              <div className="border-t border-border/50 px-6 py-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground">Areas</span>
                      <p className="font-medium">{ space.areas }</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Added</span>
                      <p className="font-medium">
                        { new Date(space.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        }) }
                      </p>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={ `/spaces/${space.id}` }>Open</Link>
                  </Button>
                </div>
              </div>
            </Card>
          )) }
        </div>
      </>
    );
  };

  return (
    <section id="inventory-form" className="space-y-6 py-8 md:space-y-8 md:py-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide md:text-xs">Spaces inventory</Badge>
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Your spaces</h2>
            <p className="text-sm text-muted-foreground md:text-base">
              Review every listing in a single table. Use the plus button to open the dedicated space creation page.
            </p>
          </div>
        </div>
        <Button asChild className="inline-flex w-full items-center gap-2 md:w-auto">
          <Link href="/spaces/create" className="inline-flex items-center gap-2">
            <FiPlus className="size-4" aria-hidden="true" />
            Add space
          </Link>
        </Button>
      </div>

      { renderContent() }

    </section>
  );
}

type SystemErrorIllustrationProps = {
  className?: string;
};

function SystemErrorIllustration({ className, }: SystemErrorIllustrationProps) {
  return (
    <div className={ cn('w-full', className) } aria-hidden="true">
      <svg
        viewBox="0 0 400 300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
      >
        <circle cx="200" cy="150" r="120" fill="hsl(var(--muted))" />

        <g className="error-robot-body">
          <ellipse cx="200" cy="240" rx="40" ry="6" fill="#000" opacity="0.3" />

          <rect x="150" y="140" width="100" height="80" rx="20" fill="hsl(var(--muted-foreground) / 0.3)" />
          <rect x="150" y="140" width="100" height="76" rx="20" fill="hsl(var(--muted-foreground) / 0.3)" />

          <rect x="170" y="160" width="60" height="40" rx="4" fill="hsl(var(--muted-foreground) / 0.8)" />
          <path
            d="M175 180 H190 L195 170 L205 190 L210 180 H225"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <rect x="190" y="130" width="20" height="10" fill="hsl(var(--muted-foreground) / 0.3)" />

          <rect x="140" y="60" width="120" height="70" rx="16" fill="hsl(var(--muted-foreground) / 0.3)" />
          <rect x="140" y="60" width="120" height="66" rx="16" fill="hsl(var(--muted-foreground) / 0.3)" />

          <rect x="155" y="75" width="90" height="40" rx="4" fill="hsl(var(--muted-foreground) / 0.8)" />

          <path
            d="M170 85 L180 95 M180 85 L170 95"
            stroke="hsl(var(--primary))"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M220 85 L230 95 M230 85 L220 95"
            stroke="hsl(var(--primary))"
            strokeWidth="3"
            strokeLinecap="round"
          />

          <path d="M200 60 V 40" stroke="hsl(var(--muted-foreground) / 0.3)" strokeWidth="4" />
          <circle cx="200" cy="35" r="5" fill="hsl(var(--primary))" />

          <path
            d="M150 160 C 130 160, 130 200, 140 210"
            stroke="hsl(var(--muted-foreground) / 0.3)"
            strokeWidth="12"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M250 160 C 270 160, 270 190, 260 200"
            stroke="hsl(var(--muted-foreground) / 0.3)"
            strokeWidth="12"
            strokeLinecap="round"
            fill="none"
          />
        </g>

      </svg>

      <style jsx>{ `
        @keyframes error-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .error-robot-body { animation: error-float 4s ease-in-out infinite; }
      ` }</style>
    </div>
  );
}
