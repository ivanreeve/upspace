'use client';

import { useMemo, useState } from 'react';
import { FiCheck, FiX } from 'react-icons/fi';
import { toast } from 'sonner';

import {
  useAdminUnpublishRequestsQuery,
  useApproveUnpublishRequestMutation,
  useRejectUnpublishRequestMutation,
  type UnpublishRequest
} from '@/hooks/api/useAdminUnpublishRequests';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

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

const formatDate = (value: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

export function AdminUnpublishRequestsPage() {
  const [activeTab, setActiveTab] = useState<RequestTab>('pending');
  const [rejectingRequest, setRejectingRequest] = useState<UnpublishRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const {
 data, isLoading, isError, error, refetch, isFetching, 
} = useAdminUnpublishRequestsQuery({
 status: activeTab,
limit: 20, 
});
  const approveMutation = useApproveUnpublishRequestMutation();
  const rejectMutation = useRejectUnpublishRequestMutation();

  const rows = useMemo(() => data?.data ?? [], [data?.data]);

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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Unpublish requests</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
          <div className="mt-4 space-y-2">
            { Array.from({ length: 4, }).map((_, idx) => (
              <Skeleton key={ idx } className="h-12 w-full" />
            )) }
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    throw error instanceof Error ? error : new Error('Unable to load unpublish requests.');
  }

  return (
    <Card className="border-border/70">
      <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle>Unpublish requests</CardTitle>
          <CardDescription>Review partner requests to hide spaces from the marketplace.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={ () => refetch() } disabled={ isFetching }>
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={ activeTab } onValueChange={ (value) => setActiveTab(value as RequestTab) }>
          <TabsList className="flex flex-wrap">
            { REQUEST_TABS.map((tab) => (
              <TabsTrigger key={ tab.value } value={ tab.value }>
                { tab.label }
              </TabsTrigger>
            )) }
          </TabsList>
        </Tabs>

        { rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No requests in this state.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border/70">
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
                { rows.map((request) => (
                  <TableRow key={ request.id }>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{ request.space.name }</span>
                        <span className="text-xs text-muted-foreground">Owner: { request.space.owner_name }</span>
                      </div>
                    </TableCell>
                    <TableCell>{ request.requester.name }</TableCell>
                    <TableCell className="max-w-xs truncate" title={ request.reason ?? undefined }>
                      { request.reason ?? '—' }
                    </TableCell>
                    <TableCell>
                      <Badge variant={ request.status === 'pending' ? 'secondary' : request.status === 'approved' ? 'success' : 'destructive' }>
                        { request.status }
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs text-muted-foreground">
                        <span>Submitted: { formatDate(request.created_at) }</span>
                        { request.processed_at && <span>Processed: { formatDate(request.processed_at) }</span> }
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      { request.status === 'pending' ? (
                        <>
                          <Button size="sm" variant="success" onClick={ () => handleApprove(request) } disabled={ approveMutation.isPending }>
                            <FiCheck className="size-4" aria-hidden="true" />
                            Approve
                          </Button>
                          <Button size="sm" variant="ghost" onClick={ () => handleReject(request) } disabled={ rejectMutation.isPending }>
                            <FiX className="size-4" aria-hidden="true" />
                            Reject
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">No actions</span>
                      ) }
                    </TableCell>
                  </TableRow>
                )) }
              </TableBody>
            </Table>
          </div>
        ) }
      </CardContent>

      <Dialog open={ Boolean(rejectingRequest) } onOpenChange={ (open) => (!open ? setRejectingRequest(null) : undefined) }>
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
    </Card>
  );
}
