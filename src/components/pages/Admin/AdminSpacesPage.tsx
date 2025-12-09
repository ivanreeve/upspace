'use client';

import { useEffect, useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AdminRowActions } from './AdminRowActions';

import { useAdminSpacesQuery, adminSpacesKeys } from '@/hooks/api/useAdminSpaces';
import { useAdminSpaceVisibilityMutation } from '@/hooks/api/useAdminVerifications';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { SystemErrorIllustration } from '@/components/pages/Marketplace/Marketplace.ErrorState';

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const mapPublishedVariant = (isPublished: boolean) =>
  isPublished ? 'success' : 'destructive';

export function AdminSpacesPage() {
  const queryClient = useQueryClient();
  const [searchValue, setSearchValue] = useState('');
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[1]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCursors, setPageCursors] = useState<(string | null)[]>([null]);
  const cursor = pageCursors[pageIndex] ?? null;
  const trimmedSearch = searchValue.trim();
  const searchParam = trimmedSearch.length ? trimmedSearch : undefined;
  const testingModeKey = ['admin', 'testing-mode'] as const;

  const testingModeQuery = useQuery({
    queryKey: testingModeKey,
    queryFn: async () => {
      const response = await fetch('/api/v1/admin/testing-mode', { cache: 'no-store', });
      if (!response.ok) {
        throw new Error('Unable to load testing mode.');
      }
      const data = await response.json();
      return Boolean(data?.enabled);
    },
  });

  const testingModeMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await fetch('/api/v1/admin/testing-mode', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ enabled, }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
          typeof payload?.error === 'string'
            ? payload.error
            : 'Unable to update testing mode.';
        throw new Error(message);
      }
      const payload = await response.json();
      return Boolean(payload?.enabled);
    },
    onSuccess: (enabled) => {
      queryClient.setQueryData(testingModeKey, enabled);
      toast.success(enabled ? 'Testing mode enabled.' : 'Testing mode disabled.');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Unable to update testing mode.';
      toast.error(message);
    },
  });

  const {
    data: page,
    isLoading,
    isError,
    error,
    isFetching,
  } = useAdminSpacesQuery({
    limit: pageSize,
    cursor,
    search: searchParam,
  });
  const spaces = page?.data ?? [];
  const nextCursor = page?.nextCursor ?? null;
  const visibilityMutation = useAdminSpaceVisibilityMutation();
  const [processingSpaceId, setProcessingSpaceId] = useState<string | null>(null);

  useEffect(() => {
    if (!page) {
      return;
    }
    setPageCursors((prev) => {
      if (prev[pageIndex + 1] === page.nextCursor) {
        return prev;
      }
      const next = [...prev];
      next[pageIndex + 1] = page.nextCursor;
      return next;
    });
  }, [page, pageIndex]);

  useEffect(() => {
    setPageIndex(0);
    setPageCursors([null]);
  }, [pageSize, searchParam]);

  const handlePageSizeChange = (value: string) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed === pageSize) {
      return;
    }
    setPageSize(parsed);
  };

  const handlePrevPage = () => {
    setPageIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleNextPage = () => {
    if (!nextCursor) {
      return;
    }
    setPageCursors((prev) => {
      if (prev[pageIndex + 1] === nextCursor) {
        return prev;
      }
      const next = [...prev];
      next[pageIndex + 1] = nextCursor;
      return next;
    });
    setPageIndex((prev) => prev + 1);
  };

  const handleUnpublish = async (spaceId: string) => {
    setProcessingSpaceId(spaceId);
    try {
      await visibilityMutation.mutateAsync({
        spaceId,
        action: 'hide',
        reason: 'Hidden from admin spaces table.',
      });
      await queryClient.invalidateQueries({ queryKey: adminSpacesKeys.all, });
      toast.success('Space unpublished.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to unpublish space.';
      toast.error(message);
    } finally {
      setProcessingSpaceId(null);
    }
  };

  const isLoadingPage = isLoading && !spaces.length;

  return (
    <div className="w-full px-4 pb-8 sm:px-6 lg:px-8">
      <section className="space-y-6 py-8 md:space-y-8 md:py-12">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Spaces
          </h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Find spaces, review their owners, and hide listings directly from this table.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Search spaces by name or location"
              aria-label="Search spaces"
              value={ searchValue }
              onChange={ (event) => setSearchValue(event.currentTarget.value) }
              className="max-w-md"
            />
            <div className="flex items-center gap-3 rounded-md border border-border/60 bg-background/80 px-3 py-2 shadow-sm">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">
                  Testing mode
                </span>
                <span className="text-xs text-muted-foreground">
                  Auto-accept bookings (skip PayMongo)
                </span>
              </div>
              <Switch
                id="admin-testing-mode"
                aria-label="Toggle testing mode"
                checked={ testingModeQuery.data ?? false }
                disabled={ testingModeQuery.isLoading || testingModeMutation.isPending }
                onCheckedChange={ (checked) => testingModeMutation.mutate(checked) }
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="admin-spaces-page-size">Rows per page</Label>
              <Select
                value={ String(pageSize) }
                onValueChange={ handlePageSizeChange }
              >
                <SelectTrigger id="admin-spaces-page-size" className="h-8 w-28">
                  <SelectValue placeholder="Rows" />
                </SelectTrigger>
                <SelectContent>
                  { PAGE_SIZE_OPTIONS.map((value) => (
                    <SelectItem key={ value } value={ String(value) }>
                      { value }
                    </SelectItem>
                  )) }
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-border/70 bg-background/80 shadow-sm">
            { isLoadingPage ? (
              <div className="rounded-md border border-border/70 bg-background/80">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Space</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    { Array.from(Array(4)).map((_, index) => (
                      <TableRow key={ `skeleton-${index}` }>
                        <TableCell>
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-28" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Skeleton className="h-8 w-8" />
                        </TableCell>
                      </TableRow>
                    )) }
                  </TableBody>
                </Table>
              </div>
            ) : isError ? (
              <div className="px-6 py-12">
                <SystemErrorIllustration />
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  { error instanceof Error ? error.message : 'Unable to load spaces right now.' }
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Space</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  { spaces.map((space) => {
                    const location = [space.city, space.region].filter(Boolean).join(', ');
                    return (
                      <TableRow key={ space.id }>
                        <TableCell className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">{ space.name }</p>
                        </TableCell>
                        <TableCell>{ space.ownerName }</TableCell>
                        <TableCell>{ location || 'Unspecified' }</TableCell>
                        <TableCell>
                          <Badge variant={ mapPublishedVariant(space.isPublished) }>
                            { space.isPublished ? 'Published' : 'Hidden' }
                          </Badge>
                        </TableCell>
                        <TableCell>
                          { space.updatedAt ? dateFormatter.format(new Date(space.updatedAt)) : '—' }
                        </TableCell>
                        <TableCell className="text-right">
                          <AdminRowActions disabled={ visibilityMutation.isLoading && processingSpaceId === space.id }>
                            <DropdownMenuItem
                              onSelect={ () => handleUnpublish(space.id) }
                              disabled={ !space.isPublished || processingSpaceId === space.id }
                            >
                              Unpublish space
                            </DropdownMenuItem>
                          </AdminRowActions>
                        </TableCell>
                      </TableRow>
                    );
                  }) }
                  { spaces.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={ 6 } className="py-8 text-center text-sm text-muted-foreground">
                        No spaces matched your search.
                      </TableCell>
                    </TableRow>
                  ) }
                </TableBody>
              </Table>
            ) }
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{ isFetching ? 'Updating…' : `${spaces.length} space${spaces.length === 1 ? '' : 's'}` }</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={ handlePrevPage }
                disabled={ pageIndex === 0 }
              >
                <FiChevronLeft className="size-4" aria-hidden="true" />
                Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={ handleNextPage }
                disabled={ !nextCursor }
              >
                Next
                <FiChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
