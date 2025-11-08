'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { SpaceDetailsPanel } from '@/components/pages/Spaces/SpaceDetailsPanel';
import { Button } from '@/components/ui/button';
import {
Card,
CardContent,
CardDescription,
CardHeader,
CardTitle
} from '@/components/ui/card';
import { useSpacesStore } from '@/stores/useSpacesStore';

export default function SpaceDetailRoute() {
  const params = useParams<{ spaceId: string }>();
  const spaceId = params?.spaceId ?? '';

  const spaceExists = useSpacesStore((state) => state.spaces.some((space) => space.id === spaceId));

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Space overview</p>
          <h1 className="text-3xl font-semibold tracking-tight">Manage space</h1>
          <p className="text-base text-muted-foreground">Review the stored attributes below, edit them, or add new areas.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/spaces">Back to spaces</Link>
        </Button>
      </div>

      { spaceExists ? (
        <SpaceDetailsPanel spaceId={ spaceId } className="mt-8" />
      ) : (
        <Card className="mt-8 border-border/70 bg-background/80">
          <CardHeader>
            <CardTitle>Space not found</CardTitle>
            <CardDescription>The requested space ID does not exist in the current session.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/spaces">Return to spaces</Link>
            </Button>
          </CardContent>
        </Card>
      ) }
    </div>
  );
}
