'use client';

import { useEffect, useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { toast } from 'sonner';

import { AdminRowActions } from './AdminRowActions';

import { useAdminDisableUserMutation, useAdminUsersQuery } from '@/hooks/api/useAdminUsers';
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

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const mapStatusVariant = (status: string) => {
  if (status === 'active') {
    return 'success';
  }
  if (status === 'deactivated' || status === 'deleted') {
    return 'destructive';
  }
  return 'secondary';
};

const mapStatusLabel = (status: string) => {
  if (status === 'active') return 'Active';
  if (status === 'deactivated') return 'Deactivated';
  if (status === 'pending_deletion') return 'Pending deletion';
  if (status === 'deleted') return 'Deleted';
  return 'Unknown';
};

export function AdminUsersPage() {
  const [searchValue, setSearchValue] = useState('');
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[1]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCursors, setPageCursors] = useState<(string | null)[]>([null]);
  const cursor = pageCursors[pageIndex] ?? null;
  const normalizedSearch = searchValue.trim();
  const searchParam = normalizedSearch.length ? normalizedSearch : undefined;
  const {
    data: page,
    isLoading,
    isError,
    error,
    isFetching,
  } = useAdminUsersQuery({
    limit: pageSize,
    cursor,
    search: searchParam,
  });
  const users = page?.data ?? [];
  const nextCursor = page?.nextCursor ?? null;
  const disableMutation = useAdminDisableUserMutation();
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);

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

  const handleDisable = async (userId: string) => {
    setProcessingUserId(userId);
    try {
      await disableMutation.mutateAsync({
        userId,
        reason: 'Disabled via admin users table.',
      });
      toast.success('User disabled.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to disable user.';
      toast.error(message);
    } finally {
      setProcessingUserId(null);
    }
  };

  const isLoadingPage = isLoading && !users.length;

  return (
    <div className="w-full px-4 pb-8 sm:px-6 lg:px-8">
      <section className="space-y-6 py-8 md:space-y-8 md:py-12">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Users
          </h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Search, review, and disable platform members from a single table.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Search users by handle or name"
              aria-label="Search users"
              value={ searchValue }
              onChange={ (event) => setSearchValue(event.currentTarget.value) }
              className="max-w-md"
            />
            <div className="flex items-center gap-2">
              <Label htmlFor="admin-users-page-size">Rows per page</Label>
              <Select
                value={ String(pageSize) }
                onValueChange={ handlePageSizeChange }
              >
                <SelectTrigger id="admin-users-page-size" className="h-8 w-28">
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
                      <TableHead>Handle</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
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
                          <Skeleton className="h-4 w-40" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-28" />
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
                  { error instanceof Error ? error.message : 'Unable to load users right now.' }
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Handle</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  { users.map((user) => (
                    <TableRow key={ user.id }>
                      <TableCell className="font-medium text-foreground">@{ user.handle }</TableCell>
                      <TableCell>{ user.name }</TableCell>
                      <TableCell>{ user.role }</TableCell>
                      <TableCell>
                        <Badge variant={ mapStatusVariant(user.status) }>
                          { mapStatusLabel(user.status) }
                        </Badge>
                      </TableCell>
                      <TableCell>
                        { dateFormatter.format(new Date(user.created_at)) }
                      </TableCell>
                      <TableCell className="text-right">
                        <AdminRowActions disabled={ disableMutation.isLoading && processingUserId === user.id }>
                          <DropdownMenuItem
                            onSelect={ () => handleDisable(user.id) }
                            disabled={ user.status !== 'active' || processingUserId === user.id }
                          >
                            Disable account
                          </DropdownMenuItem>
                        </AdminRowActions>
                      </TableCell>
                    </TableRow>
                  )) }
                  { users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={ 6 } className="py-8 text-center text-sm text-muted-foreground">
                        No users matched your search.
                      </TableCell>
                    </TableRow>
                  ) }
                </TableBody>
              </Table>
            ) }
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{ isFetching ? 'Updating…' : `${users.length} user${users.length === 1 ? '' : 's'}` }</span>
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
