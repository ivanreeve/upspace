'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { FiPlus } from 'react-icons/fi';

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
import { useSpacesStore } from '@/stores/useSpacesStore';

export function SpacesInventoryForm() {
  const spaces = useSpacesStore((state) => state.spaces);

  const tableRows = useMemo(() => spaces.map((space) => ({
    id: space.id,
    name: space.name,
    location: `${space.city}, ${space.region}`,
    status: space.status,
    areas: space.areas.length,
    created_at: space.created_at,
  })), [spaces]);

  return (
    <section id="inventory-form" className="space-y-8 py-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Badge variant="secondary" className="uppercase tracking-wide">Spaces inventory</Badge>
          <div className="space-y-1">
            <h2 className="text-3xl font-semibold tracking-tight">Your spaces</h2>
            <p className="text-base text-muted-foreground">
              Review every listing in a single table. Use the plus button to open the dedicated space creation page.
            </p>
          </div>
        </div>
        <Button asChild className="inline-flex items-center gap-2">
          <Link href="/spaces/create" className="inline-flex items-center gap-2">
            <FiPlus className="size-4" aria-hidden="true" />
            Add space
          </Link>
        </Button>
      </div>

      { spaces.length === 0 ? (
        <Card className="border-dashed border-border/70 bg-background/60">
          <CardHeader>
            <CardTitle>No spaces yet</CardTitle>
            <CardDescription>Use “Add space” to create your first entry.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
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
      ) }

    </section>
  );
}
