'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { toast } from 'sonner';

import {
  useAdminDeactivationRequestsQuery,
  useApproveDeactivationRequestMutation,
  useRejectDeactivationRequestMutation,
  type DeactivationRequest
} from '@/hooks/api/useAdminDeactivationRequests';
import { DEACTIVATION_REASON_LABELS } from '@/lib/deactivation-requests';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { SystemErrorIllustration } from '@/components/pages/Marketplace/Marketplace.ErrorState';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

const REQUEST_TABS = [
  {
    label: 'Pending requests',
    value: 'pending',
    description: 'Accounts waiting for a final review.',
  },
  {
    label: 'Approved requests',
    value: 'approved',
    description: 'Deactivation requests that have been completed.',
  },
  {
    label: 'Rejected requests',
    value: 'rejected',
    description: 'Requests we could not process and notified the member.',
  }
] as const;

type RequestTab = (typeof REQUEST_TABS)[number];
type RequestFilterValue = RequestTab['value'];

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const formatDate = (value: string) => dateFormatter.format(new Date(value));

const getStatusVariant = (status: DeactivationRequest['status']) => {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'destructive';
  return 'secondary';
};

const getStatusLabel = (status: DeactivationRequest['status']) => {
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  return 'Pending review';
};

export function AdminDeactivationRequestsPage() {
  const [activeTab, setActiveTab] = useState<RequestFilterValue>('pending');
  const [pageSize, setPageSize] = useState<typeof PAGE_SIZE_OPTIONS[number]>(PAGE_SIZE_OPTIONS[1]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCursors, setPageCursors] = useState<(string | null)[]>([null]);
  const cursor = pageCursors[pageIndex] ?? null;
  const [rejectingRequest, setRejectingRequest] = useState<DeactivationRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const {
    data: page,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useAdminDeactivationRequestsQuery({
    status: activeTab,
    limit: pageSize,
    cursor,
  });

  const requests = useMemo(() => page?.data ?? [], [page?.data]);
  const nextCursor = page?.nextCursor ?? null;
  const pageRowCount = requests.length;
  const currentTabInfo = REQUEST_TABS.find((tab) => tab.value === activeTab);
  const approveMutation = useApproveDeactivationRequestMutation();
  const rejectMutation = useRejectDeactivationRequestMutation();

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

  const handleApprove = async (request: DeactivationRequest) => {
    try {
      await approveMutation.mutateAsync({ requestId: request.id, });
      toast.success('Deactivation request approved. Account is disabled.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to approve request.';
      toast.error(message);
    }
  };

  const handleReject = (request: DeactivationRequest) => {
    setRejectingRequest(request);
    setRejectionReason('');
    setIsRejectDialogOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectingRequest) {
      return;
    }
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason.');
      return;
    }

    setIsRejecting(true);
    try {
      await rejectMutation.mutateAsync({
        requestId: rejectingRequest.id,
        reason: rejectionReason.trim(),
      });
      toast.success('Rejection sent and email delivered.');
      setIsRejectDialogOpen(false);
      setRejectingRequest(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to reject request.';
      toast.error(message);
    } finally {
      setIsRejecting(false);
    }
  };

  const handleTabChange = (value: string) => {
    const nextTab = value as RequestFilterValue;
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
        <div className="rounded-md border border-border/60 bg-background/80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requester</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              { Array.from({ length: 4, }).map((_, index) => (
                <TableRow key={ `skeleton-${index}` }>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-12 rounded-full" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-8 w-24 rounded-md" />
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
            <CardTitle>No requests found</CardTitle>
            <CardDescription>{ currentTabInfo?.description }</CardDescription>
          </CardHeader>
        </Card>
      );
    }

    return (
      <>
        <div className="hidden rounded-md border border-border/60 bg-background/80 md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requester</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              { requests.map((request) => (
                <TableRow key={ request.id } className="transition hover:bg-muted/40">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{ request.user.name }</span>
                      <span className="text-xs text-muted-foreground">@{ request.user.handle }</span>
                      <span className="text-xs text-muted-foreground">{ request.email }</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-semibold">
                        { DEACTIVATION_REASON_LABELS[request.reason_category] }
                      </span>
                      { request.custom_reason ? (
                        <span className="text-xs text-muted-foreground line-clamp-2">
                          { request.custom_reason }
                        </span>
                      ) : null }
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    { formatDate(request.created_at) }
                    { request.processed_by ? (
                      <span className="block text-xs text-muted-foreground">
                        Processed by { request.processed_by.name }
                      </span>
                    ) : null }
                  </TableCell>
                  <TableCell>
                    <Badge variant={ getStatusVariant(request.status) } className="gap-1">
                      { getStatusLabel(request.status) }
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    { request.status === 'pending' ? (
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={ () => handleReject(request) }
                          disabled={ isRejecting }
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={ () => handleApprove(request) }
                          disabled={ approveMutation.status === 'pending' }
                        >
                          Approve
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        { request.processed_at
                          ? `Processed ${formatDate(request.processed_at)}`
                          : 'Processed' }
                      </p>
                    ) }
                  </TableCell>
                </TableRow>
              )) }
            </TableBody>
          </Table>
        </div>
        <div className="space-y-3 md:hidden">
          { requests.map((request) => (
            <Card key={ request.id } className="border-border/70 bg-background/80">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg leading-tight">{ request.user.name }</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      @{ request.user.handle }
                    </CardDescription>
                  </div>
                  <Badge variant={ getStatusVariant(request.status) } className="shrink-0 gap-1">
                    { getStatusLabel(request.status) }
                  </Badge>
                </div>
              </CardHeader>
              <div className="border-t border-border/50 px-6 py-3">
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Reason</p>
                    <p className="font-semibold">{ DEACTIVATION_REASON_LABELS[request.reason_category] }</p>
                    { request.custom_reason ? (
                      <span className="text-xs text-muted-foreground line-clamp-2 block">
                        { request.custom_reason }
                      </span>
                    ) : null }
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Submitted</p>
                    <p>{ formatDate(request.created_at) }</p>
                  </div>
                  { request.processed_by ? (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Processed by</p>
                      <p>{ request.processed_by.name }</p>
                    </div>
                  ) : null }
                </div>
                { request.status === 'pending' ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={ () => handleReject(request) }
                      disabled={ isRejecting }
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={ () => handleApprove(request) }
                       disabled={ approveMutation.status === 'pending' }
                    >
                      Approve
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

  const isFetchingPage = isFetching && !isLoading;

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
          <Button size="sm" variant="outline" onClick={ handlePrevPage } disabled={ pageIndex === 0 || isLoading }>
            <FiChevronLeft className="size-4" aria-hidden="true" />
            Previous
          </Button>
          <Button size="sm" variant="outline" onClick={ handleNextPage } disabled={ !nextCursor || isLoading }>
            Next
            <FiChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="deactivation-per-page" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Per page
          </Label>
          <Select value={ String(pageSize) } onValueChange={ handlePageSizeChange }>
            <SelectTrigger id="deactivation-per-page" className="w-24" aria-label="Entries per page">
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
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Deactivation requests</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Review and resolve user requests to deactivate their accounts.
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
        open={ isRejectDialogOpen }
        onOpenChange={ (open) => {
          if (isRejecting) {
            return;
          }
          setIsRejectDialogOpen(open);
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
              Add a brief reason that will be emailed to the member.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={ rejectionReason }
            onChange={ (event) => setRejectionReason(event.target.value) }
            placeholder="Explain why this request cannot be processed."
            rows={ 4 }
            maxLength={ 400 }
          />
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={ () => setIsRejectDialogOpen(false) } disabled={ isRejecting }>
              Cancel
            </Button>
            <Button variant="destructive" onClick={ handleConfirmReject } disabled={ isRejecting }>
              { isRejecting ? 'Rejecting…' : 'Send rejection' }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
