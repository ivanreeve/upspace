'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  FiAlertCircle,
  FiArrowUpRight,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiXCircle
} from 'react-icons/fi';

import { useCustomerComplaintsQuery, type CustomerComplaint } from '@/hooks/api/useComplaints';
import { COMPLAINT_CATEGORY_LABELS, COMPLAINT_STATUS_LABELS, type ComplaintStatus } from '@/lib/complaints/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { SystemErrorIllustration } from '@/components/pages/Marketplace/Marketplace.ErrorState';

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const mapStatusVariant = (status: ComplaintStatus) => {
  if (status === 'resolved') return 'success' as const;
  if (status === 'dismissed') return 'destructive' as const;
  if (status === 'escalated') return 'default' as const;
  return 'secondary' as const;
};

const statusIcon = (status: ComplaintStatus) => {
  if (status === 'resolved') return <FiCheckCircle className="size-3.5" aria-hidden="true" />;
  if (status === 'dismissed') return <FiXCircle className="size-3.5" aria-hidden="true" />;
  if (status === 'escalated') return <FiArrowUpRight className="size-3.5" aria-hidden="true" />;
  return <FiAlertCircle className="size-3.5" aria-hidden="true" />;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '—';
  return dateFormatter.format(date);
};

const truncate = (value: string, maxLength = 140) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
};

export function CustomerComplaintsPage() {
  const [pageSize, setPageSize] = useState<typeof PAGE_SIZE_OPTIONS[number]>(PAGE_SIZE_OPTIONS[1]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCursors, setPageCursors] = useState<(string | null)[]>([null]);
  const cursor = pageCursors[pageIndex] ?? null;

  const {
    data: page,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useCustomerComplaintsQuery({
    limit: pageSize,
    cursor,
  });

  const complaints = useMemo(() => page?.data ?? [], [page?.data]);
  const nextCursor = page?.nextCursor ?? null;
  const pageRowCount = complaints.length;

  useEffect(() => {
    if (!page) return;
    setPageCursors((previous) => {
      if (previous[pageIndex + 1] === page.nextCursor) return previous;
      const next = [...previous];
      next[pageIndex + 1] = page.nextCursor;
      return next;
    });
  }, [page, pageIndex]);

  const handlePageSizeChange = (value: string) => {
    const parsedNumber = Number(value);
    if (Number.isNaN(parsedNumber)) return;
    if (!PAGE_SIZE_OPTIONS.includes(parsedNumber as typeof PAGE_SIZE_OPTIONS[number])) return;
    setPageSize(parsedNumber as typeof PAGE_SIZE_OPTIONS[number]);
    setPageIndex(0);
    setPageCursors([null]);
  };

  const handlePrevPage = () => {
    setPageIndex((previous) => Math.max(previous - 1, 0));
  };

  const handleNextPage = () => {
    if (!nextCursor) return;
    setPageCursors((previous) => {
      if (previous[pageIndex + 1] === nextCursor) return previous;
      const next = [...previous];
      next[pageIndex + 1] = nextCursor;
      return next;
    });
    setPageIndex((previous) => previous + 1);
  };

  const tableContent = (() => {
    if (isLoading) {
      return (
        <div className="rounded-md border border-border/70 bg-background/80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Space</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Filed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              { Array.from({ length: 4, }).map((_, index) => (
                <TableRow key={ `complaint-skeleton-${index}` }>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
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
            <SystemErrorIllustration className="h-auto w-full max-w-[260px] md:max-w-[320px]" />
            <div className="space-y-3">
              <CardTitle className="text-xl text-muted-foreground">Unable to load complaints</CardTitle>
              <CardDescription className="text-sm">
                { error instanceof Error ? error.message : 'Something went wrong.' }
              </CardDescription>
            </div>
            <Button variant="outline" onClick={ () => refetch() }>
              Retry
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (!complaints.length) {
      return (
        <Card className="border-dashed border-border/70 bg-background/60">
          <CardHeader>
            <CardTitle>No complaints filed</CardTitle>
            <CardDescription>
              You haven&apos;t filed any complaints yet. If you experience an issue with a booking, you can file a complaint from your bookings page.
            </CardDescription>
          </CardHeader>
        </Card>
      );
    }

    return (
      <div className="overflow-hidden rounded-md border border-border/70 bg-muted/20">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Space</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Filed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            { complaints.map((complaint: CustomerComplaint) => (
              <TableRow key={ complaint.id }>
                <TableCell className="max-w-[200px]">
                  <div className="space-y-0.5">
                    <p className="truncate font-medium text-foreground">{ complaint.space_name }</p>
                    <p className="truncate text-xs text-muted-foreground">{ complaint.area_name }</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    { COMPLAINT_CATEGORY_LABELS[complaint.category] }
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[320px]">
                  <div className="space-y-0.5">
                    <p className="text-sm text-foreground">{ truncate(complaint.description) }</p>
                    { complaint.resolution_note ? (
                      <p className="text-xs text-muted-foreground">
                        Resolution: { truncate(complaint.resolution_note, 120) }
                      </p>
                    ) : null }
                    { complaint.escalation_note ? (
                      <p className="text-xs text-muted-foreground">
                        Escalation: { truncate(complaint.escalation_note, 120) }
                      </p>
                    ) : null }
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={ mapStatusVariant(complaint.status) } className="gap-1.5">
                    { statusIcon(complaint.status) }
                    { COMPLAINT_STATUS_LABELS[complaint.status] }
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">{ formatDate(complaint.created_at) }</TableCell>
              </TableRow>
            )) }
          </TableBody>
        </Table>
      </div>
    );
  })();

  return (
    <div className="w-full px-4 pb-8 sm:px-6 lg:px-8">
      <section className="space-y-6 py-8 md:space-y-8 md:py-12">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            My Complaints
          </h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Track the status of complaints you&apos;ve filed for your bookings.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="customer-complaints-page-size">Rows per page</Label>
            <Select
              value={ String(pageSize) }
              onValueChange={ handlePageSizeChange }
            >
              <SelectTrigger id="customer-complaints-page-size" className="h-8 w-28">
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

          { tableContent }

          <div className="flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
            <span>
              Page { pageIndex + 1 }
              { pageRowCount > 0 ? ` · ${pageRowCount} item${pageRowCount === 1 ? '' : 's'}` : '' }
              { isFetching ? ' · Refreshing…' : '' }
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-md"
                disabled={ pageIndex === 0 || isFetching }
                onClick={ handlePrevPage }
              >
                <FiChevronLeft className="size-4" aria-hidden="true" />
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-md"
                disabled={ !nextCursor || isFetching }
                onClick={ handleNextPage }
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
