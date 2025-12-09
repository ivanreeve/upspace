'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiEye,
  FiX
} from 'react-icons/fi';
import { toast } from 'sonner';

import {
  useAdminUnpublishRequestsQuery,
  useApproveUnpublishRequestMutation,
  useRejectUnpublishRequestMutation,
  type UnpublishRequest
} from '@/hooks/api/useAdminUnpublishRequests';
import { useAdminSpaceVisibilityMutation } from '@/hooks/api/useAdminVerifications';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { SystemErrorIllustration } from '@/components/pages/Marketplace/Marketplace.ErrorState';

const REQUEST_TABS = [
  {
    label: 'Pending',
    value: 'pending',
    description: 'Awaiting admin review.',
  },
  {
    label: 'Approved',
    value: 'approved',
    description: 'Spaces already unpublished.',
  },
  {
    label: 'Rejected',
    value: 'rejected',
    description: 'Requests declined with feedback.',
  }
] as const;

type RequestTab = (typeof REQUEST_TABS)[number]['value'];

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const formatDate = (value: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '—';
  return dateFormatter.format(date);
};

const formatBadgeVariant = (status: UnpublishRequest['status']) => {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'destructive';
  return 'secondary';
};

export function AdminUnpublishRequestsPage() {
  const [activeTab, setActiveTab] = useState<RequestTab>('pending');
  const [pageSize, setPageSize] = useState<typeof PAGE_SIZE_OPTIONS[number]>(PAGE_SIZE_OPTIONS[1]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCursors, setPageCursors] = useState<(string | null)[]>([null]);
  const cursor = pageCursors[pageIndex] ?? null;
  const [rejectingRequest, setRejectingRequest] = useState<UnpublishRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const {
    data: page,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useAdminUnpublishRequestsQuery({
    status: activeTab,
    limit: pageSize,
    cursor,
  });

  const requests = useMemo(() => page?.data ?? [], [page?.data]);
  const nextCursor = page?.nextCursor ?? null;
  const pageRowCount = requests.length;
  const currentTabInfo = REQUEST_TABS.find((tab) => tab.value === activeTab);
  const approveMutation = useApproveUnpublishRequestMutation();
  const rejectMutation = useRejectUnpublishRequestMutation();
  const visibilityMutation = useAdminSpaceVisibilityMutation();
  const [republishingSpaceId, setRepublishingSpaceId] = useState<string | null>(null);

  const tableRows = useMemo(
    () =>
      requests.map((request) => ({
        id: request.id,
        spaceName: request.space.name,
        owner: request.space.owner_name,
        requester: request.requester.name,
        reason: request.reason,
        status: request.status,
        submittedAt: request.created_at,
        processedAt: request.processed_at,
      })),
    [requests]
  );

  const isFetchingPage = isFetching && !isLoading;

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

  const handleApprove = async (request: UnpublishRequest) => {
    try {
      await approveMutation.mutateAsync({ requestId: request.id, });
      toast.success('Request approved and space unpublished.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to approve request.');
    }
  };

  const handleReject = (request: UnpublishRequest) => {
    setRejectingRequest(request);
    setRejectionReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectingRequest) return;
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason.');
      return;
    }

    try {
      await rejectMutation.mutateAsync({
        requestId: rejectingRequest.id,
        reason: rejectionReason.trim(),
      });
      toast.success('Request rejected and requester notified.');
      setRejectingRequest(null);
      setRejectionReason('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to reject request.');
    }
  };

  const handleRepublish = async (request: UnpublishRequest) => {
    setRepublishingSpaceId(request.space.id);
    try {
      await visibilityMutation.mutateAsync({
        spaceId: request.space.id,
        action: 'show',
      });
      toast.success('Space republished to the marketplace.');
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to republish space.');
    } finally {
      setRepublishingSpaceId(null);
    }
  };

  const handleTabChange = (value: string) => {
    const nextTab = value as RequestTab;
    if (nextTab === activeTab) {
      return;
    }

    setActiveTab(nextTab);
    setPageIndex(0);
    setPageCursors([null]);
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
    setPageIndex(0);
    setPageCursors([null]);
  };

  const tableBody = (() => {
    if (isLoading) {
      return (
        <div className="rounded-md border border-border/70 bg-background/80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Space</TableHead>
                <TableHead>Requester</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              { Array.from({ length: 4, }).map((_, index) => (
                <TableRow key={ `skeleton-${index}` }>
                  <TableCell>
                    <Skeleton className="h-4 w-36" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-12 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-8 w-20 rounded-md" />
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
            <SystemErrorIllustration className="h-auto w-full max-w-[260px] md:max-w-[320px]" />
            <div className="space-y-3">
              <CardTitle className="text-xl text-muted-foreground">Unable to load requests</CardTitle>
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

    if (!requests.length) {
      return (
        <Card className="border-dashed border-border/70 bg-background/60">
          <CardHeader>
            <CardTitle>No requests yet</CardTitle>
            <CardDescription>
              { currentTabInfo?.description ?? 'The queue is empty for this status.' }
            </CardDescription>
          </CardHeader>
        </Card>
      );
    }

    return (
      <>
        <div className="hidden rounded-md border border-border/70 bg-background/80 md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Space</TableHead>
                <TableHead>Requester</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              { tableRows.map((row) => {
                const request = requests.find((item) => item.id === row.id);
                if (!request) return null;
                return (
                  <TableRow key={ row.id } className="transition hover:bg-muted/40">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{ row.spaceName }</span>
                        <span className="text-xs text-muted-foreground">Owner: { row.owner }</span>
                      </div>
                    </TableCell>
                    <TableCell>{ row.requester }</TableCell>
                    <TableCell className="max-w-xs truncate" title={ row.reason ?? undefined }>
                      { row.reason ?? '—' }
                    </TableCell>
                    <TableCell>
                      <Badge variant={ formatBadgeVariant(row.status) } className="gap-1">
                        { row.status === 'pending' && 'Pending review' }
                        { row.status === 'approved' && 'Approved' }
                        { row.status === 'rejected' && 'Rejected' }
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      { formatDate(row.submittedAt) }
                      { row.processedAt && (
                        <span className="block text-xs text-muted-foreground">
                          Processed: { formatDate(row.processedAt) }
                        </span>
                      ) }
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                    { row.status === 'pending' ? (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={ () => handleApprove(request) }
                          disabled={ approveMutation.isPending }
                        >
                          <FiCheck className="size-4" aria-hidden="true" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={ () => handleReject(request) }
                          disabled={ rejectMutation.isPending }
                        >
                          <FiX className="size-4" aria-hidden="true" />
                          Reject
                        </Button>
                      </>
                    ) : row.status === 'approved' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={ () => handleRepublish(request) }
                        disabled={
                          republishingSpaceId === request.space.id && visibilityMutation.isPending
                        }
                      >
                        <FiEye className="size-4" aria-hidden="true" />
                        { republishingSpaceId === request.space.id && visibilityMutation.isPending
                          ? 'Republishing…'
                          : 'Republish' }
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">No actions</span>
                    ) }
                    </TableCell>
                  </TableRow>
                );
              }) }
            </TableBody>
          </Table>
        </div>
        <div className="space-y-3 md:hidden">
          { requests.map((request) => (
            <Card key={ request.id } className="border-border/70 bg-background/80">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg leading-tight">{ request.space.name }</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Owner: { request.space.owner_name }
                    </CardDescription>
                  </div>
                  <Badge variant={ formatBadgeVariant(request.status) } className="shrink-0 gap-1">
                    { request.status === 'pending' && 'Pending review' }
                    { request.status === 'approved' && 'Approved' }
                    { request.status === 'rejected' && 'Rejected' }
                  </Badge>
                </div>
              </CardHeader>
              <div className="border-t border-border/50 px-6 py-3">
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Requester</p>
                    <p className="font-medium">{ request.requester.name }</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Reason</p>
                    <p>{ request.reason ?? '—' }</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Submitted</p>
                    <p>{ formatDate(request.created_at) }</p>
                  </div>
                  { request.processed_at && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Processed</p>
                      <p>{ formatDate(request.processed_at) }</p>
                    </div>
                  ) }
                </div>
                { request.status === 'pending' ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={ () => handleApprove(request) }
                      disabled={ approveMutation.isPending }
                    >
                      <FiCheck className="size-4" aria-hidden="true" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={ () => handleReject(request) }
                      disabled={ rejectMutation.isPending }
                    >
                      <FiX className="size-4" aria-hidden="true" />
                      Reject
                    </Button>
                  </div>
                ) : request.status === 'approved' ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={ () => handleRepublish(request) }
                      disabled={
                        republishingSpaceId === request.space.id && visibilityMutation.isPending
                      }
                    >
                      <FiEye className="size-4" aria-hidden="true" />
                      { republishingSpaceId === request.space.id && visibilityMutation.isPending
                        ? 'Republishing…'
                        : 'Republish' }
                    </Button>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">No actions</p>
                ) }
              </div>
            </Card>
          )) }
        </div>
      </>
    );
  })();

  const paginationFooter = (
    <div className="mt-4 flex flex-col gap-2 rounded-md border border-border/70 bg-background/80 px-4 py-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2 font-medium text-foreground">
        <span>Page { pageIndex + 1 }</span>
        <span className="hidden md:inline">•</span>
        <span>
          { pageRowCount } entr{ pageRowCount === 1 ? 'y' : 'ies' } on this page (max { pageSize })
        </span>
        { isFetchingPage && <span className="text-muted-foreground">Updating…</span> }
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={ handlePrevPage }
            disabled={ pageIndex === 0 || isLoading }
          >
            <FiChevronLeft className="size-4" aria-hidden="true" />
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={ handleNextPage }
            disabled={ !nextCursor || isLoading }
          >
            Next
            <FiChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Label
            htmlFor="unpublish-per-page"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Per page
          </Label>
          <Select value={ String(pageSize) } onValueChange={ handlePageSizeChange }>
            <SelectTrigger id="unpublish-per-page" className="w-24" aria-label="Entries per page">
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
          <Button variant="outline" size="sm" onClick={ () => refetch() } disabled={ isFetching }>
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full px-4 pb-8 sm:px-6 lg:px-8">
      <section className="space-y-6 py-8 md:space-y-8 md:py-12">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Unpublish requests</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Review partner requests to hide spaces from the marketplace.
          </p>
        </div>
        <div className="space-y-4">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-1 flex-col gap-2">
              <Tabs value={ activeTab } onValueChange={ handleTabChange }>
                <TabsList>
                  { REQUEST_TABS.map((tab) => (
                    <TabsTrigger key={ tab.value } value={ tab.value }>
                      { tab.label }
                    </TabsTrigger>
                  )) }
                </TabsList>
              </Tabs>
              { currentTabInfo && (
                <p className="text-sm text-muted-foreground">{ currentTabInfo.description }</p>
              ) }
            </div>
          </div>
          { paginationFooter }
          { tableBody }
        </div>
      </section>
      <Dialog
        open={ Boolean(rejectingRequest) }
        onOpenChange={ (open) => {
          if (!open) {
            setRejectingRequest(null);
            setRejectionReason('');
          }
        } }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject request</DialogTitle>
            <DialogDescription>
              Provide a short note that will be shown to the partner.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={ rejectionReason }
            onChange={ (event) => setRejectionReason(event.target.value) }
            maxLength={ 1000 }
            aria-label="Rejection reason"
            placeholder="Share why this space cannot be unpublished right now"
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={ () => setRejectingRequest(null) } disabled={ rejectMutation.isPending }>
              Cancel
            </Button>
            <Button onClick={ handleConfirmReject } disabled={ rejectMutation.isPending }>
              { rejectMutation.isPending ? 'Sending…' : 'Reject request' }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
