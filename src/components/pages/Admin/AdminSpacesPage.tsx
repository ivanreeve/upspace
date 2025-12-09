'use client';

import { useEffect, useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import { AdminRowActions } from './AdminRowActions';

import { useAdminSpacesQuery, adminSpacesKeys } from '@/hooks/api/useAdminSpaces';
import { useAdminSpaceVisibilityMutation } from '@/hooks/api/useAdminVerifications';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [pageSize, setPageSize] = useState<typeof PAGE_SIZE_OPTIONS[number]>(PAGE_SIZE_OPTIONS[1]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCursors, setPageCursors] = useState<(string | null)[]>([null]);
  const cursor = pageCursors[pageIndex] ?? null;
  const trimmedSearch = searchValue.trim();
  const searchParam = trimmedSearch.length ? trimmedSearch : undefined;

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
  const [processingSpaceId, setProcessingSpaceId] = useState<{
    spaceId: string;
    action: 'hide' | 'show';
  } | null>(null);

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
    const parsedNumber = Number(value);
    if (Number.isNaN(parsedNumber)) {
      return;
    }

    if (!PAGE_SIZE_OPTIONS.includes(parsedNumber as typeof PAGE_SIZE_OPTIONS[number])) {
      return;
    }

    const parsed = parsedNumber as typeof PAGE_SIZE_OPTIONS[number];
    if (parsed === pageSize) {
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

  const handleToggleVisibility = async (spaceId: string, action: 'hide' | 'show') => {
    setProcessingSpaceId({
      spaceId,
      action,
    });
    try {
      await visibilityMutation.mutateAsync({
        spaceId,
        action,
        reason: action === 'hide' ? 'Hidden from admin spaces table.' : 'Shown from admin spaces table.',
      });
      await queryClient.invalidateQueries({ queryKey: adminSpacesKeys.all, });
      toast.success(action === 'hide' ? 'Space hidden from marketplace.' : 'Space visible in marketplace.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to update space visibility.';
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
                          <Skeleton className="h-9 w-9 rounded-full" />
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
                          { (() => {
                            const isProcessingSpace = processingSpaceId?.spaceId === space.id;
                            const currentAction = isProcessingSpace ? processingSpaceId?.action : space.isPublished ? 'hide' : 'show';
                            const actionLabel = space.isPublished ? 'Hide space' : 'Show space';
                            const processingLabel = currentAction === 'hide' ? 'Hiding…' : 'Showing…';
                            return (
                              <AdminRowActions disabled={ visibilityMutation.status === 'pending' && isProcessingSpace }>
                                <DropdownMenuItem
                                  onSelect={ () => handleToggleVisibility(space.id, space.isPublished ? 'hide' : 'show') }
                                  disabled={ isProcessingSpace }
                                >
                                  { isProcessingSpace ? processingLabel : actionLabel }
                                </DropdownMenuItem>
                              </AdminRowActions>
                            );
                          })() }
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
