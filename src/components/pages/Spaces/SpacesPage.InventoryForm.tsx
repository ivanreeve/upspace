'use client';

import { useCallback, useMemo } from 'react';
import Link from 'next/link';
import { FiPlus } from 'react-icons/fi';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
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

const inventoryDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export function SpacesInventoryForm() {
  const {
    data: spaces,
    isLoading,
    isError,
    error,
  } = usePartnerSpacesQuery();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? null;
  const resolveImageSrc = useCallback((path?: string | null, publicUrl?: string | null) => {
    if (publicUrl) return publicUrl;
    if (supabaseUrl && path) {
      return `${supabaseUrl}/storage/v1/object/public/${path}`;
    }
    return null;
  }, [supabaseUrl]);

  const tableRows = useMemo(() => (spaces ?? []).map((space) => {
    const images = space.images ?? [];
    const featuredImage = images.find((image) => image.is_primary) ?? images[0] ?? null;
    const imageSrc = featuredImage ? resolveImageSrc(featuredImage.path, featuredImage.public_url) : null;
    const fallbackInitials = (space.name.trim().slice(0, 2).toUpperCase() || 'SP');

    return {
      id: space.id,
      name: space.name,
      location: `${space.city}, ${space.region}`,
      status: space.status,
      areas: space.areas.length,
      created_at: space.created_at,
      imageSrc,
      fallbackInitials,
    };
  }), [spaces, resolveImageSrc]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="rounded-md border border-border/70 bg-background/80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[96px]">Preview</TableHead>
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
                  <TableCell className="w-[96px]">
                    <Skeleton className="h-16 w-16 rounded-none" />
                  </TableCell>
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
      throw error instanceof Error ? error : new Error('Unable to load spaces.');
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
                <TableHead className="w-[96px]">Preview</TableHead>
                <TableHead>Space</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Areas</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              { tableRows.map((row) => (
                <TableRow key={ row.id } className="cursor-pointer transition hover:bg-muted/40">
                  <TableCell className="w-[96px]">
                    <Avatar
                      className="h-16 w-16 min-h-16 min-w-16 rounded-none border border-border/70 shadow-sm"
                    >
                      { row.imageSrc ? (
                        <AvatarImage
                          src={ row.imageSrc }
                          alt={ `Featured image for ${row.name}` }
                          className="h-full w-full rounded-none object-cover"
                        />
                      ) : (
                        <AvatarFallback className="rounded-none">
                          { row.fallbackInitials }
                        </AvatarFallback>
                      ) }
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{ row.name }</span>
                      <span className="text-xs text-muted-foreground">
                        Added { inventoryDateFormatter.format(new Date(row.created_at)) }
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{ row.location }</TableCell>
                  <TableCell>
                    <Badge variant={ row.status === 'Live' ? 'secondary' : 'outline' }>{ row.status }</Badge>
                  </TableCell>
                  <TableCell>{ row.areas }</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href={ `/spaces/${row.id}` }>Open</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              )) }
            </TableBody>
          </Table>
        </div>

        { /* Mobile Card View */ }
        <div className="space-y-3 md:hidden">
          { tableRows.map((row) => (
            <Card key={ row.id } className="border-border/70 bg-background/80">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <Avatar
                    className="h-16 w-16 min-h-16 min-w-16 rounded-none border border-border/70 shadow-sm"
                  >
                    { row.imageSrc ? (
                      <AvatarImage
                        src={ row.imageSrc }
                        alt={ `Featured image for ${row.name}` }
                        className="h-full w-full rounded-none object-cover"
                      />
                    ) : (
                      <AvatarFallback className="rounded-none">
                        { row.fallbackInitials }
                      </AvatarFallback>
                    ) }
                  </Avatar>
                  <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-lg leading-tight">{ row.name }</CardTitle>
                      <CardDescription className="mt-1 text-xs">
                        { row.location }
                      </CardDescription>
                    </div>
                    <Badge variant={ row.status === 'Live' ? 'secondary' : 'outline' } className="shrink-0">
                      { row.status }
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <div className="border-t border-border/50 px-6 py-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground">Areas</span>
                      <p className="font-medium">{ row.areas }</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Added</span>
                      <p className="font-medium">
                        { inventoryDateFormatter.format(new Date(row.created_at)) }
                      </p>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={ `/spaces/${row.id}` }>Open</Link>
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
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Your spaces</h2>
            <p className="text-sm text-muted-foreground md:text-base font-sf text-sm">
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
