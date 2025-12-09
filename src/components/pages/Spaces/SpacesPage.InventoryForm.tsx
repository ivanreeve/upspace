'use client';

import {
useCallback,
useEffect,
useMemo,
useState
} from 'react';
import Link from 'next/link';
import {
  FiChevronLeft,
  FiChevronRight,
  FiEdit3,
  FiFileText,
  FiPlus,
  FiTrash2
} from 'react-icons/fi';
import { toast } from 'sonner';

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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { usePartnerSpacesQuery } from '@/hooks/api/usePartnerSpaces';
import { clearSpaceFormDraft, useSpaceDraftSummary } from '@/hooks/useSpaceFormPersistence';
import { clearStoredPhotoState } from '@/hooks/usePersistentSpaceImages';
import type { SpaceStatus } from '@/data/spaces';

const inventoryDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const draftSavedFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;
const SPACE_STATUS_VALUES: SpaceStatus[] = [
  'Live',
  'Pending',
  'Draft',
  'Unpublished'
];
type StatusFilterValue = SpaceStatus | 'all';
type StatusFilterOption = {
  value: StatusFilterValue;
  label: string;
};
const STATUS_FILTER_OPTIONS: StatusFilterOption[] = [
  {
    value: 'all',
    label: 'All statuses',
  },
  ...SPACE_STATUS_VALUES.map((status) => ({
    value: status,
    label: status,
  }))
];

export function SpacesInventoryForm() {
  const [pageSize, setPageSize] = useState<number>(10);
  const [pageIndex, setPageIndex] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');
  const {
 data: spaces, isLoading, isError, error, 
} = usePartnerSpacesQuery();
  const {
 summary: draftSummary, refresh: refreshDraftSummary, 
} =
    useSpaceDraftSummary();

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? null;
  const resolveImageSrc = useCallback(
    (path?: string | null, publicUrl?: string | null) => {
      if (publicUrl) return publicUrl;
      if (supabaseUrl && path) {
        return `${supabaseUrl}/storage/v1/object/public/${path}`;
      }
      return null;
    },
    [supabaseUrl]
  );

  const filteredSpaces = useMemo(() => {
    if (!spaces) {
      return [];
    }

    if (statusFilter === 'all') {
      return spaces;
    }

    return spaces.filter((space) => space.status === statusFilter);
  }, [spaces, statusFilter]);

  const tableRows = useMemo(
    () =>
      filteredSpaces.map((space) => {
        const images = space.images ?? [];
        const featuredImage =
          images.find((image) => image.is_primary) ?? images[0] ?? null;
        const imageSrc = featuredImage
          ? resolveImageSrc(featuredImage.path, featuredImage.public_url)
          : null;
        const fallbackInitials =
          space.name.trim().slice(0, 2).toUpperCase() || 'SP';

        return {
          id: space.id,
          name: space.name,
          location: `${space.city}, ${space.region}`,
          status: space.status,
          pendingUnpublish: space.pending_unpublish_request,
          areas: space.areas.length,
          created_at: space.created_at,
          imageSrc,
          fallbackInitials,
        };
      }),
    [filteredSpaces, resolveImageSrc]
  );

  useEffect(() => {
    setPageIndex((prev) => {
      const lastPageIndex = Math.max(
        Math.ceil(tableRows.length / pageSize) - 1,
        0
      );
      return Math.min(prev, lastPageIndex);
    });
  }, [tableRows.length, pageSize]);

  const totalPages = Math.max(Math.ceil(tableRows.length / pageSize), 1);
  const paginatedRows = useMemo(() => {
    const start = pageIndex * pageSize;
    return tableRows.slice(start, start + pageSize);
  }, [tableRows, pageIndex, pageSize]);
  const pageRowCount = paginatedRows.length;

  const handlePrevPage = useCallback(() => {
    setPageIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleNextPage = useCallback(() => {
    setPageIndex((prev) => {
      const lastPageIndex = Math.max(totalPages - 1, 0);
      return Math.min(prev + 1, lastPageIndex);
    });
  }, [totalPages]);

  const handlePageSizeChange = useCallback(
    (value: string) => {
      const parsed = Number(value);
      if (Number.isNaN(parsed) || parsed === pageSize) {
        return;
      }
      setPageSize(parsed);
      setPageIndex(0);
    },
    [pageSize]
  );
  const handleStatusFilterChange = (value: StatusFilterValue) => {
    setStatusFilter(value);
    setPageIndex(0);
  };

  const handleDiscardDraft = useCallback(() => {
    clearSpaceFormDraft();
    clearStoredPhotoState();
    refreshDraftSummary();
    toast.success('Draft cleared.');
  }, [refreshDraftSummary]);

  const renderDraftCard = () => {
    if (!draftSummary) {
      return null;
    }

    const savedAt = (() => {
      const parsedDate = draftSummary.savedAt
        ? new Date(draftSummary.savedAt)
        : null;
      return parsedDate && !Number.isNaN(parsedDate.valueOf())
        ? draftSavedFormatter.format(parsedDate)
        : 'just now';
    })();
    const location = [draftSummary.city, draftSummary.region]
      .filter(Boolean)
      .join(', ');

    return (
      <Card className="border-dashed border-primary/40 bg-primary/5">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-primary/10 text-primary">
              <FiFileText className="size-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-base leading-tight">
                { draftSummary.name }
              </CardTitle>
              <CardDescription className="text-sm">
                Saved { savedAt }
                { location ? ` · ${location}` : '' }
                { draftSummary.step ? ` · Step ${draftSummary.step}` : '' }
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline">Draft</Badge>
        </CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-6 py-3">
          <p className="text-xs text-muted-foreground">
            Drafts stay on this device until you submit a space.
          </p>
          <div className="flex items-center gap-2">
            <Button asChild size="sm">
              <Link href="/spaces/create">
                <FiEdit3 className="size-4" aria-hidden="true" />
                Resume draft
              </Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={ handleDiscardDraft }>
              <FiTrash2 className="size-4" aria-hidden="true" />
              Discard
            </Button>
          </div>
        </div>
      </Card>
    );
  };

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
      throw error instanceof Error
        ? error
        : new Error('Unable to load spaces.');
    }

    if (!spaces || spaces.length === 0) {
      return (
        <Card className="border-dashed border-border/70 bg-background/60">
          <CardHeader>
            <CardTitle>No spaces yet</CardTitle>
            <CardDescription>
              Use “Add space” to create your first entry.
            </CardDescription>
          </CardHeader>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-2 rounded-md border border-border/70 bg-background/80 px-4 py-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2 font-medium text-foreground">
            <span>
              Page { pageIndex + 1 } of { totalPages }
            </span>
            <span className="hidden md:inline text-muted-foreground">•</span>
            <span className="text-muted-foreground">
              Showing { pageRowCount } of { tableRows.length } (max { pageSize } per
              page)
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="spaces-status-filter"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Status
                </Label>
                <Select
                  value={ statusFilter }
                  onValueChange={ handleStatusFilterChange }
                >
                  <SelectTrigger
                    id="spaces-status-filter"
                    className="w-36"
                    aria-label="Filter spaces by status"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    { STATUS_FILTER_OPTIONS.map((option) => (
                      <SelectItem key={ option.value } value={ option.value }>
                        { option.label }
                      </SelectItem>
                    )) }
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="spaces-per-page"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Per page
                </Label>
                <Select
                  value={ String(pageSize) }
                  onValueChange={ handlePageSizeChange }
                >
                  <SelectTrigger
                    id="spaces-per-page"
                    className="w-24"
                    aria-label="Spaces per page"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    { PAGE_SIZE_OPTIONS.map((option) => (
                      <SelectItem key={ option } value={ String(option) }>
                        { option }
                      </SelectItem>
                    )) }
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={ handlePrevPage }
                disabled={ pageIndex === 0 }
              >
                <FiChevronLeft className="size-4" aria-hidden="true" />
                <span className="sr-only">Previous page</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={ handleNextPage }
                disabled={ pageIndex >= totalPages - 1 || pageRowCount === 0 }
              >
                <FiChevronRight className="size-4" aria-hidden="true" />
                <span className="sr-only">Next page</span>
              </Button>
            </div>
          </div>
        </div>
        { /* Desktop Table View */ }
        <div className="hidden rounded-md border border-border/70 bg-background/80 md:block">
          <Table>
            <TableHeader>
              <TableRow  className="hover:bg-transparent">
                <TableHead className="w-[96px]">Preview</TableHead>
                <TableHead>Space</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Areas</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              { paginatedRows.map((row) => (
                <TableRow
                  key={ row.id }
                  className="cursor-pointer transition hover:bg-muted/40"
                >
                  <TableCell className="w-[96px]">
                    <Avatar className="h-16 w-16 min-h-16 min-w-16 rounded-none border border-border/70 shadow-sm">
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
                        Added{ ' ' }
                        { inventoryDateFormatter.format(
                          new Date(row.created_at)
                        ) }
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    { row.location }
                  </TableCell>
                  <TableCell className="space-y-1">
                    <Badge
                      variant={
                        row.status === 'Live'
                          ? 'success'
                          : row.status === 'Unpublished'
                            ? 'destructive'
                            : 'outline'
                      }
                    >
                      { row.status }
                    </Badge>
                    { row.pendingUnpublish && (
                      <p className="text-[11px] font-medium text-amber-600">
                        Unpublish request pending
                      </p>
                    ) }
                  </TableCell>
                  <TableCell>{ row.areas }</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline" className="hover:text-white">
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
          { paginatedRows.map((row) => (
            <Card key={ row.id } className="border-border/70 bg-background/80">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-16 w-16 min-h-16 min-w-16 rounded-none border border-border/70 shadow-sm">
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
                      <CardTitle className="text-lg leading-tight">
                        { row.name }
                      </CardTitle>
                      <CardDescription className="mt-1 text-xs">
                        { row.location }
                      </CardDescription>
                    </div>
                    <Badge
                      variant={
                        row.status === 'Live'
                          ? 'success'
                          : row.status === 'Unpublished'
                            ? 'destructive'
                            : 'outline'
                      }
                      className="shrink-0"
                    >
                      { row.status }
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <div className="border-t border-border/50 px-6 py-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground">
                        Areas
                      </span>
                      <p className="font-medium">{ row.areas }</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">
                        Added
                      </span>
                      <p className="font-medium">
                        { inventoryDateFormatter.format(
                          new Date(row.created_at)
                        ) }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={ `/spaces/${row.id}` }>Open</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )) }
        </div>
      </div>
    );
  };

  return (
    <section
      id="inventory-form"
      className="space-y-6 py-8 md:space-y-8 md:py-12"
    >
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Your spaces
        </h2>
        <p className="text-sm text-muted-foreground md:text-base font-sf text-sm">
          Review every listing in a single table. Use the plus button to open
          the dedicated space creation page.
        </p>
      </div>

      { renderDraftCard() }

      { renderContent() }

      <div className="w-full">
      <Button
        asChild
        variant="outline"
        className="inline-flex w-full items-center justify-center gap-2 hover:text-white"
      >
        <Link
          href="/spaces/create"
          className="inline-flex items-center gap-2"
        >
          <FiPlus className="size-4" aria-hidden="true" />
          Add space
        </Link>
      </Button>
    </div>

    </section>
  );
}
