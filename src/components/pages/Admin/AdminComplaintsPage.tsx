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
import { toast } from 'sonner';

import {
  useAdminComplaintsQuery,
  useAdminResolveComplaintMutation,
  useAdminDismissComplaintMutation,
  type AdminComplaint
} from '@/hooks/api/useAdminComplaints';
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

const COMPLAINT_TABS = [
  {
    value: 'escalated',
    label: 'Escalated',
    description: 'Complaints escalated by partners for admin review.',
  },
  {
    value: 'resolved',
    label: 'Resolved',
    description: 'Complaints resolved by admins.',
  },
  {
    value: 'dismissed',
    label: 'Dismissed',
    description: 'Complaints dismissed by admins.',
  }
] as const;

type ComplaintTabValue = (typeof COMPLAINT_TABS)[number]['value'];

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

const formatDate = (value: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '—';
  return dateFormatter.format(date);
};

const truncate = (value: string, maxLength = 140) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
};

export function AdminComplaintsPage() {
  const [activeTab, setActiveTab] = useState<ComplaintTabValue>('escalated');
  const [pageSize, setPageSize] = useState<typeof PAGE_SIZE_OPTIONS[number]>(PAGE_SIZE_OPTIONS[1]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCursors, setPageCursors] = useState<(string | null)[]>([null]);
  const cursor = pageCursors[pageIndex] ?? null;
  const [dismissingComplaint, setDismissingComplaint] = useState<AdminComplaint | null>(null);
  const [dismissalNote, setDismissalNote] = useState('');

  const {
    data: page,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useAdminComplaintsQuery({
    status: activeTab,
    limit: pageSize,
    cursor,
  });

  const resolveMutation = useAdminResolveComplaintMutation();
  const dismissMutation = useAdminDismissComplaintMutation();
  const isSubmittingDismissal = dismissMutation.isPending;

  const complaints = useMemo(() => page?.data ?? [], [page?.data]);
  const nextCursor = page?.nextCursor ?? null;
  const pageRowCount = complaints.length;
  const currentTabInfo = COMPLAINT_TABS.find((tab) => tab.value === activeTab);

  useEffect(() => {
    if (!page) return;
    setPageCursors((previous) => {
      if (previous[pageIndex + 1] === page.nextCursor) return previous;
      const next = [...previous];
      next[pageIndex + 1] = page.nextCursor;
      return next;
    });
  }, [page, pageIndex]);

  const handleTabChange = (value: string) => {
    const nextTab = value as ComplaintTabValue;
    if (nextTab === activeTab) return;
    setActiveTab(nextTab);
    setPageIndex(0);
    setPageCursors([null]);
  };

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

  const handleResolve = async (complaint: AdminComplaint) => {
    try {
      await resolveMutation.mutateAsync({ complaintId: complaint.id, });
      toast.success('Complaint marked as resolved.');
    } catch (mutationError) {
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to resolve complaint.'
      );
    }
  };

  const openDismissDialog = (complaint: AdminComplaint) => {
    setDismissingComplaint(complaint);
    setDismissalNote('');
  };

  const handleConfirmDismiss = async () => {
    if (!dismissingComplaint) return;

    const normalizedNote = dismissalNote.trim();
    if (!normalizedNote) {
      toast.error('A dismissal note is required.');
      return;
    }

    try {
      await dismissMutation.mutateAsync({
        complaintId: dismissingComplaint.id,
        note: normalizedNote,
      });
      toast.success('Complaint dismissed.');
      setDismissingComplaint(null);
      setDismissalNote('');
    } catch (mutationError) {
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to dismiss complaint.'
      );
    }
  };

  const tableContent = (() => {
    if (isLoading) {
      return (
        <div className="rounded-md border border-border/70 bg-background/80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Space</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Escalation note</TableHead>
                <TableHead>Filed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              { Array.from({ length: 4, }).map((_, index) => (
                <TableRow key={ `complaint-skeleton-${index}` }>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="ml-auto h-8 w-28 rounded-md" /></TableCell>
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
            <CardTitle>No complaints found</CardTitle>
            <CardDescription>
              { currentTabInfo?.description ?? 'No complaints in this queue right now.' }
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
              <TableHead>Customer</TableHead>
              <TableHead>Space</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Escalation note</TableHead>
              <TableHead>Filed</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            { complaints.map((complaint) => (
              <TableRow key={ complaint.id }>
                <TableCell>
                  <div className="space-y-0.5">
                    <p className="font-medium text-foreground">{ complaint.customer.name }</p>
                    <p className="text-xs text-muted-foreground">@{ complaint.customer.handle }</p>
                  </div>
                </TableCell>
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
                <TableCell className="max-w-[280px]">
                  <p className="text-sm text-foreground">{ truncate(complaint.description) }</p>
                  { complaint.resolution_note ? (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Resolution: { truncate(complaint.resolution_note, 120) }
                    </p>
                  ) : null }
                </TableCell>
                <TableCell className="max-w-[200px]">
                  { complaint.escalation_note ? (
                    <p className="text-sm text-muted-foreground">{ truncate(complaint.escalation_note, 100) }</p>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) }
                </TableCell>
                <TableCell className="whitespace-nowrap">{ formatDate(complaint.created_at) }</TableCell>
                <TableCell>
                  <Badge variant={ mapStatusVariant(complaint.status) } className="gap-1.5">
                    { statusIcon(complaint.status) }
                    { COMPLAINT_STATUS_LABELS[complaint.status] }
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  { complaint.status === 'escalated' ? (
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 rounded-md"
                        disabled={ resolveMutation.isPending || dismissMutation.isPending }
                        onClick={ () => handleResolve(complaint) }
                      >
                        <FiCheckCircle className="size-4" aria-hidden="true" />
                        Resolve
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="gap-1.5 rounded-md"
                        disabled={ resolveMutation.isPending || dismissMutation.isPending }
                        onClick={ () => openDismissDialog(complaint) }
                      >
                        <FiXCircle className="size-4" aria-hidden="true" />
                        Dismiss
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground text-right block">
                      { complaint.processed_by ? `By ${complaint.processed_by.name}` : 'Processed' }
                    </span>
                  ) }
                </TableCell>
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
            Complaints
          </h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Review escalated complaints and take moderation actions.
          </p>
        </div>

        <div className="space-y-4">
          <Tabs value={ activeTab } onValueChange={ handleTabChange }>
            <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-md bg-muted/40 p-1.5 md:w-auto">
              { COMPLAINT_TABS.map((tab) => (
                <TabsTrigger
                  key={ tab.value }
                  value={ tab.value }
                  className="gap-2 rounded-md px-3 py-1.5"
                >
                  { tab.value === 'escalated' && <FiArrowUpRight className="size-4" aria-hidden="true" /> }
                  { tab.value === 'resolved' && <FiCheckCircle className="size-4" aria-hidden="true" /> }
                  { tab.value === 'dismissed' && <FiXCircle className="size-4" aria-hidden="true" /> }
                  { tab.label }
                </TabsTrigger>
              )) }
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <Label htmlFor="admin-complaints-page-size">Rows per page</Label>
            <Select
              value={ String(pageSize) }
              onValueChange={ handlePageSizeChange }
            >
              <SelectTrigger id="admin-complaints-page-size" className="h-8 w-28">
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

      <Dialog
        open={ Boolean(dismissingComplaint) }
        onOpenChange={ (open) => {
          if (!open) {
            if (isSubmittingDismissal) {
              return;
            }
            setDismissingComplaint(null);
            setDismissalNote('');
          }
        } }
      >
        <DialogContent
          className="sm:max-w-[520px]"
          dismissible={ !isSubmittingDismissal }
        >
          <DialogHeader>
            <DialogTitle>Dismiss complaint</DialogTitle>
            <DialogDescription>
              Add a note explaining why this complaint is being dismissed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="complaint-dismissal-note">Dismissal note</Label>
            <Textarea
              id="complaint-dismissal-note"
              value={ dismissalNote }
              onChange={ (event) => setDismissalNote(event.currentTarget.value) }
              aria-label="Dismissal note"
              className="min-h-24 rounded-md"
              maxLength={ 1000 }
              placeholder="Explain why no further action is needed."
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="hover:bg-sidebar rounded-md"
              onClick={ () => {
                setDismissingComplaint(null);
                setDismissalNote('');
              } }
              disabled={ isSubmittingDismissal }
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-md"
              onClick={ handleConfirmDismiss }
              disabled={ isSubmittingDismissal }
              loading={ isSubmittingDismissal }
              loadingText="Dismissing…"
            >
              Dismiss complaint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
