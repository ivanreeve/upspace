'use client';

import { formatDistanceToNow } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import {
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiLoader,
  FiXCircle
} from 'react-icons/fi';
import { toast } from 'sonner';

import {
  useAdminPayoutRequestsQuery,
  useCompleteAdminPayoutRequestMutation,
  useRejectAdminPayoutRequestMutation,
  type AdminPayoutRequest
} from '@/hooks/api/useAdminPayoutRequests';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { SystemErrorIllustration } from '@/components/pages/Marketplace/Marketplace.ErrorState';
import { formatCurrencyMinor } from '@/lib/wallet';

const REQUEST_TABS = [
  {
    value: 'pending',
    label: 'Pending',
    description: 'Requests waiting for payout completion or rejection.',
  },
  {
    value: 'succeeded',
    label: 'Completed',
    description: 'Requests marked as completed after settlement.',
  },
  {
    value: 'failed',
    label: 'Rejected',
    description: 'Requests declined and returned to the partner wallet.',
  }
] as const;

type RequestTabValue = (typeof REQUEST_TABS)[number]['value'];

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const formatDate = (value: string | null) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return '—';
  }

  return dateFormatter.format(date);
};

const getStatusVariant = (status: AdminPayoutRequest['status']) => {
  if (status === 'succeeded') {
    return 'success' as const;
  }

  if (status === 'failed') {
    return 'destructive' as const;
  }

  return 'secondary' as const;
};

const getStatusLabel = (status: AdminPayoutRequest['status']) => {
  if (status === 'succeeded') {
    return 'Completed';
  }

  if (status === 'failed') {
    return 'Rejected';
  }

  return 'Pending review';
};

const getRelativeAge = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return '—';
  }

  return formatDistanceToNow(date, { addSuffix: true, });
};

export function AdminPayoutRequestsPage() {
  const [activeTab, setActiveTab] = useState<RequestTabValue>('pending');
  const [pageSize, setPageSize] = useState<typeof PAGE_SIZE_OPTIONS[number]>(PAGE_SIZE_OPTIONS[1]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCursors, setPageCursors] = useState<(string | null)[]>([null]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const cursor = pageCursors[pageIndex] ?? null;

  const {
    data: page,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useAdminPayoutRequestsQuery({
    status: activeTab,
    limit: pageSize,
    cursor,
  });

  const completeMutation = useCompleteAdminPayoutRequestMutation();
  const rejectMutation = useRejectAdminPayoutRequestMutation();
  const requests = useMemo(() => page?.data ?? [], [page?.data]);
  const selectedRequest = useMemo(
    () => requests.find((r) => r.id === selectedRequestId) ?? null,
    [requests, selectedRequestId]
  );
  const nextCursor = page?.nextCursor ?? null;
  const totalCount = page?.totalCount ?? 0;
  const pendingCount = page?.pendingCount ?? 0;
  const currentTabInfo = REQUEST_TABS.find((tab) => tab.value === activeTab);
  const isSubmittingAction =
    completeMutation.isPending || rejectMutation.isPending;
  const queueCardDescription = activeTab === 'pending'
    ? 'Oldest requests appear first so the queue stays moving.'
    : 'Newest decisions appear first so recent payout activity is easy to review.';

  useEffect(() => {
    if (!page) {
      return;
    }

    setPageCursors((previous) => {
      if (previous[pageIndex + 1] === page.nextCursor) {
        return previous;
      }

      const next = [...previous];
      next[pageIndex + 1] = page.nextCursor;
      return next;
    });
  }, [page, pageIndex]);

  useEffect(() => {
    if (!selectedRequestId || selectedRequest || isFetching) {
      return;
    }

    setSelectedRequestId(null);
    setResolutionNote('');
  }, [isFetching, selectedRequest, selectedRequestId]);

  const handleTabChange = (value: string) => {
    const nextTab = value as RequestTabValue;
    if (nextTab === activeTab) {
      return;
    }

    setActiveTab(nextTab);
    setPageIndex(0);
    setPageCursors([null]);
  };

  const handlePageSizeChange = (value: string) => {
    const parsed = Number(value);
    if (!PAGE_SIZE_OPTIONS.includes(parsed as typeof PAGE_SIZE_OPTIONS[number])) {
      return;
    }

    const nextPageSize = parsed as typeof PAGE_SIZE_OPTIONS[number];
    if (nextPageSize === pageSize) {
      return;
    }

    setPageSize(nextPageSize);
    setPageIndex(0);
    setPageCursors([null]);
  };

  const handlePrevPage = () => {
    setPageIndex((previous) => Math.max(previous - 1, 0));
  };

  const handleNextPage = () => {
    if (!nextCursor) {
      return;
    }

    setPageCursors((previous) => {
      if (previous[pageIndex + 1] === nextCursor) {
        return previous;
      }

      const next = [...previous];
      next[pageIndex + 1] = nextCursor;
      return next;
    });
    setPageIndex((previous) => previous + 1);
  };

  const openRequestDialog = (request: AdminPayoutRequest) => {
    setSelectedRequestId(request.id);
    setResolutionNote(request.resolutionNote ?? '');
  };

  const closeRequestDialog = () => {
    if (isSubmittingAction) {
      return;
    }

    setSelectedRequestId(null);
    setResolutionNote('');
  };

  const handleComplete = async () => {
    if (!selectedRequest) {
      return;
    }

    try {
      await completeMutation.mutateAsync({
        requestId: selectedRequest.id,
        resolutionNote: resolutionNote.trim() || undefined,
      });
      toast.success('Payout marked as completed.');
      closeRequestDialog();
    } catch (mutationError) {
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to complete payout request.'
      );
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) {
      return;
    }

    const normalizedNote = resolutionNote.trim();
    if (!normalizedNote) {
      toast.error('A rejection reason is required.');
      return;
    }

    try {
      await rejectMutation.mutateAsync({
        requestId: selectedRequest.id,
        resolutionNote: normalizedNote,
      });
      toast.success('Payout request rejected and wallet balance restored.');
      closeRequestDialog();
    } catch (mutationError) {
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to reject payout request.'
      );
    }
  };

  const errorMessage = error instanceof Error
    ? error.message
    : 'Unable to load payout requests.';

  const tableBody = (() => {
    if (isLoading) {
      return (
        <TableBody>
          { Array.from({ length: 5, }).map((_, index) => (
            <TableRow key={ `payout-skeleton-${index}` }>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell className="text-right"><Skeleton className="ml-auto h-8 w-20" /></TableCell>
            </TableRow>
          )) }
        </TableBody>
      );
    }

    if (requests.length === 0) {
      return (
        <TableBody>
          <TableRow>
            <TableCell colSpan={ 6 } className="py-12 text-center text-sm text-muted-foreground">
              No payout requests found for this filter.
            </TableCell>
          </TableRow>
        </TableBody>
      );
    }

    return (
      <TableBody>
        { requests.map((request) => (
          <TableRow key={ request.id }>
            <TableCell className="align-top">
              <div className="space-y-1">
                <p className="font-medium text-foreground">{ request.partner.name }</p>
                <p className="text-xs text-muted-foreground">@{ request.partner.handle }</p>
                <p className="text-xs text-muted-foreground">
                  Available balance: { formatCurrencyMinor(request.partner.currentBalanceMinor, request.currency) }
                </p>
              </div>
            </TableCell>
            <TableCell className="align-top font-medium">
              { formatCurrencyMinor(request.amountMinor, request.currency) }
            </TableCell>
            <TableCell className="align-top">
              <div className="space-y-1 text-sm">
                <p>{ formatDate(request.createdAt) }</p>
                <p className="text-xs text-muted-foreground">{ getRelativeAge(request.createdAt) }</p>
              </div>
            </TableCell>
            <TableCell className="align-top">
              <Badge variant={ getStatusVariant(request.status) }>
                { getStatusLabel(request.status) }
              </Badge>
            </TableCell>
            <TableCell className="align-top">
              <div className="space-y-1 text-sm">
                <p>{ formatDate(request.processedAt) }</p>
                { request.processedBy && (
                  <p className="text-xs text-muted-foreground">
                    by { request.processedBy.name }
                  </p>
                ) }
              </div>
            </TableCell>
            <TableCell className="align-top text-right">
              <Button
                variant="outline"
                size="sm"
                onClick={ () => openRequestDialog(request) }
              >
                { request.status === 'pending' ? 'Review' : 'View' }
              </Button>
            </TableCell>
          </TableRow>
        )) }
      </TableBody>
    );
  })();

  return (
    <>
      <div className="w-full px-4 pb-8 sm:px-6 lg:px-8">
        <section className="space-y-6 py-8 md:space-y-8 md:py-12">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Payout Requests
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
              Review partner withdrawal requests, mark them complete after settlement,
              or reject them to release the held funds back to the wallet.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FiClock className="size-4" aria-hidden="true" />
              <span>{ currentTabInfo?.description }</span>
              { isFetching && <span>Updating...</span> }
            </div>
          </div>

          { isError ? (
            <div className="rounded-md border border-border/70 bg-background/80 px-6 py-12 text-center">
              <SystemErrorIllustration />
              <p className="mt-4 text-sm text-muted-foreground">
                { errorMessage }
              </p>
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={ () => {
                    void refetch();
                  } }
                >
                  Retry
                </Button>
              </div>
            </div>
          ) : (
            <Card className="rounded-md border border-border/70 bg-muted/20 shadow-none">
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <CardTitle>Review queue</CardTitle>
                    <CardDescription>
                      { queueCardDescription }
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Tabs value={ activeTab } onValueChange={ handleTabChange }>
                      <TabsList>
                        { REQUEST_TABS.map((tab) => (
                          <TabsTrigger key={ tab.value } value={ tab.value }>
                            { tab.value === 'succeeded' && (
                              <FiCheckCircle className="mr-1 size-3.5" aria-hidden="true" />
                            ) }
                            { tab.value === 'failed' && (
                              <FiXCircle className="mr-1 size-3.5" aria-hidden="true" />
                            ) }
                            { tab.label }
                            { tab.value === 'pending' && pendingCount > 0 && (
                              <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 px-1.5 text-[10px] font-bold">
                                { pendingCount }
                              </Badge>
                            ) }
                          </TabsTrigger>
                        )) }
                      </TabsList>
                    </Tabs>

                    <div className="flex items-center gap-2">
                      <Label htmlFor="admin-payout-page-size">Rows per page</Label>
                      <Select
                        value={ String(pageSize) }
                        onValueChange={ handlePageSizeChange }
                      >
                        <SelectTrigger
                          id="admin-payout-page-size"
                          className="h-9 w-24 rounded-md"
                          aria-label="Select payout request page size"
                        >
                          <SelectValue placeholder="Rows" />
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
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="overflow-hidden rounded-md border border-border/70 bg-background/80">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Partner</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Requested</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Processed</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    { tableBody }
                  </Table>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-muted-foreground">
                    Page { pageIndex + 1 } · { totalCount } total
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={ handlePrevPage }
                      disabled={ pageIndex === 0 }
                    >
                      <FiChevronLeft className="mr-1 size-4" aria-hidden="true" />
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={ handleNextPage }
                      disabled={ !nextCursor }
                    >
                      Next
                      <FiChevronRight className="ml-1 size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) }
        </section>
      </div>

      <Dialog open={ Boolean(selectedRequest) } onOpenChange={ (open) => !open && closeRequestDialog() }>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              { selectedRequest?.status === 'pending'
                ? 'Review payout request'
                : 'Payout request details' }
            </DialogTitle>
            <DialogDescription>
              { selectedRequest?.status === 'pending'
                ? 'Complete the payout after settlement, or reject it to return the held funds to the partner wallet.'
                : 'Review the request details, timing, and final outcome.' }
            </DialogDescription>
          </DialogHeader>

          { selectedRequest && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-md border border-border/70 bg-muted/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Partner
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    { selectedRequest.partner.name }
                  </p>
                  <p className="text-sm text-muted-foreground">
                    @{ selectedRequest.partner.handle }
                  </p>
                </div>
                <div className="rounded-md border border-border/70 bg-muted/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Request amount
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    { formatCurrencyMinor(selectedRequest.amountMinor, selectedRequest.currency) }
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Wallet balance now:{ ' ' }
                    { formatCurrencyMinor(
                      selectedRequest.partner.currentBalanceMinor,
                      selectedRequest.currency
                    ) }
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Submitted
                  </p>
                  <p className="text-sm text-foreground">{ formatDate(selectedRequest.createdAt) }</p>
                  <p className="text-xs text-muted-foreground">
                    { getRelativeAge(selectedRequest.createdAt) }
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Status
                  </p>
                  <Badge variant={ getStatusVariant(selectedRequest.status) }>
                    { getStatusLabel(selectedRequest.status) }
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Processed at
                  </p>
                  <p className="text-sm text-foreground">{ formatDate(selectedRequest.processedAt) }</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Processed by
                  </p>
                  <p className="text-sm text-foreground">
                    { selectedRequest.processedBy?.name ?? '—' }
                  </p>
                </div>
              </div>

              { selectedRequest.status === 'pending' ? (
                <div className="space-y-2">
                  <Label htmlFor="payout-resolution-note">Admin note</Label>
                  <Textarea
                    id="payout-resolution-note"
                    value={ resolutionNote }
                    onChange={ (event) => setResolutionNote(event.target.value) }
                    placeholder="Optional note for completion. Required if you reject this payout request."
                    aria-label="Payout resolution note"
                    rows={ 4 }
                  />
                  <p className="text-xs text-muted-foreground">
                    Rejections require a clear reason so the partner understands why the request was declined.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Resolution note
                  </p>
                  <div className="rounded-md border border-border/70 bg-muted/20 p-4 text-sm text-foreground">
                    { selectedRequest.resolutionNote || 'No internal note recorded.' }
                  </div>
                </div>
              ) }
            </div>
          ) }

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={ closeRequestDialog }
              disabled={ isSubmittingAction }
            >
              Close
            </Button>
            { selectedRequest?.status === 'pending' && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={ () => {
                    void handleReject();
                  } }
                  disabled={ isSubmittingAction }
                >
                  { rejectMutation.isPending && (
                    <FiLoader className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  ) }
                  Reject request
                </Button>
                <Button
                  type="button"
                  onClick={ () => {
                    void handleComplete();
                  } }
                  disabled={ isSubmittingAction }
                >
                  { completeMutation.isPending && (
                    <FiLoader className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  ) }
                  Mark completed
                </Button>
              </div>
            ) }
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
