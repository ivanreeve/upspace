'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  FiChevronLeft,
  FiChevronRight,
  FiEye,
  FiFileText
} from 'react-icons/fi';

import { VerificationDetailDialog } from './AdminPage.VerificationDetailDialog';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePendingVerificationsQuery, type PendingVerification } from '@/hooks/api/useAdminVerifications';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

const VERIFICATION_TABS = [
  {
    label: 'Pending verifications',
    value: 'in_review',
    description: 'Spaces waiting for an admin to review the submitted documents.',
  },
  {
    label: 'Approved verifications',
    value: 'approved',
    description: 'Spaces that already have an approved verification.',
  },
  {
    label: 'Renewal required',
    value: 'expired',
    description: 'Verifications whose approvals have expired and require renewal.',
  }
] as const;

type VerificationTab = (typeof VERIFICATION_TABS)[number];
type VerificationStatus = VerificationTab['value'];

export function AdminVerificationsTable() {
  const [pageSize, setPageSize] = useState(20);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCursors, setPageCursors] = useState<(string | null)[]>([null]);
  const [activeTab, setActiveTab] = useState<VerificationStatus>('in_review');
  const cursor = pageCursors[pageIndex] ?? null;

  const {
    data: page,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = usePendingVerificationsQuery({
    limit: pageSize,
    cursor,
    status: activeTab,
  });
  const verifications = page?.data;
  const nextCursor = page?.nextCursor ?? null;

  const [selectedVerification, setSelectedVerification] = useState<PendingVerification | null>(null);

  const currentTabInfo = VERIFICATION_TABS.find((tab) => tab.value === activeTab);

  const tableRows = useMemo(() => (verifications ?? []).map((v) => ({
    id: v.id,
    spaceName: v.space.name,
    location: v.space.location,
    partnerName: v.space.partner.name,
    partnerHandle: v.space.partner.handle,
    submittedAt: v.submitted_at,
    documentsCount: v.documents.length,
  })), [verifications]);

  const handleViewDetails = (verification: PendingVerification) => {
    setSelectedVerification(verification);
  };

  const handleCloseDialog = () => {
    setSelectedVerification(null);
  };

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
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed === pageSize) {
      return;
    }
    setPageSize(parsed);
    setPageIndex(0);
    setPageCursors([null]);
  };

  const handleTabChange = (value: string) => {
    const nextTab = value as VerificationStatus;
    if (nextTab === activeTab) {
      return;
    }
    setActiveTab(nextTab);
    setPageIndex(0);
    setPageCursors([null]);
    setSelectedVerification(null);
  };

  const tableBody = (() => {
    if (isLoading) {
      return (
        <div className="rounded-md border border-border/70 bg-background/80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Space</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              { Array.from(Array(4)).map((_, index) => (
                <TableRow key={ `skeleton-${index}` }>
                  <TableCell>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-10 rounded-full" />
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
              <CardTitle className="text-xl text-muted-foreground">Unable to load verifications</CardTitle>
              <CardDescription className="text-sm">
                { error instanceof Error ? error.message : 'Something went wrong.' }
              </CardDescription>
            </div>
            <Button variant="outline" onClick={ () => refetch() }>Retry</Button>
          </CardContent>
        </Card>
      );
    }

    if (!verifications || verifications.length === 0) {
      return (
        <Card className="border-dashed border-border/70 bg-background/60">
          <CardHeader>
            <CardTitle>
              { activeTab === 'in_review' ? 'No pending verifications' : 'No verified spaces yet' }
            </CardTitle>
            <CardDescription>
              { activeTab === 'in_review'
                ? 'All verification requests have been processed.'
                : 'Approved verifications will show up here once the queue is reviewed.' }
            </CardDescription>
          </CardHeader>
        </Card>
      );
    }

    return (
      <>
        { /* Desktop Table View */ }
        <div className="hidden rounded-md border border-border/70 bg-background/80 md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Space</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              { tableRows.map((row) => {
                const verification = verifications?.find((v) => v.id === row.id);
                return (
                  <TableRow key={ row.id } className="cursor-pointer transition hover:bg-muted/40">
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{ row.spaceName }</span>
                        <span className="text-xs text-muted-foreground">{ row.location }</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex flex-col">
                        <span>{ row.partnerName }</span>
                        <span className="text-xs">@{ row.partnerHandle }</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      { dateFormatter.format(new Date(row.submittedAt)) }
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        <FiFileText className="size-3" aria-hidden="true" />
                        { row.documentsCount }
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={ () => verification && handleViewDetails(verification) }
                      >
                        <FiEye className="size-4" aria-hidden="true" />
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              }) }
            </TableBody>
          </Table>
        </div>

        { /* Mobile Card View */ }
        <div className="space-y-3 md:hidden">
          { verifications.map((verification) => (
            <Card key={ verification.id } className="border-border/70 bg-background/80">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg leading-tight">{ verification.space.name }</CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      { verification.space.location }
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="shrink-0 gap-1">
                    <FiFileText className="size-3" aria-hidden="true" />
                    { verification.documents.length }
                  </Badge>
                </div>
              </CardHeader>
              <div className="border-t border-border/50 px-6 py-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground">Partner</span>
                      <p className="font-medium">{ verification.space.partner.name }</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Submitted</span>
                      <p className="font-medium">
                        { dateFormatter.format(new Date(verification.submitted_at)) }
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={ () => handleViewDetails(verification) }
                  >
                    <FiEye className="size-4" aria-hidden="true" />
                    Review
                  </Button>
                </div>
              </div>
            </Card>
          )) }
        </div>
      </>
    );
  })();

  const pageRowCount = verifications?.length ?? 0;

  const paginationFooter = (
    <div className="mt-4 flex flex-col gap-2 rounded-md border border-border/70 bg-background/80 px-4 py-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2 font-medium text-foreground">
        <span>Page { pageIndex + 1 }</span>
        <span className="hidden md:inline">•</span>
        <span className="text-muted-foreground">
          { pageRowCount } entr{ pageRowCount === 1 ? 'y' : 'ies' } on this page (max { pageSize })
        </span>
        { isFetchingPage && (
          <span className="text-muted-foreground">Updating…</span>
        ) }
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
            htmlFor="verifications-per-page"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Per page
          </Label>
          <Select value={ String(pageSize) } onValueChange={ handlePageSizeChange }>
            <SelectTrigger
              id="verifications-per-page"
              className="w-24"
              aria-label="Entries per page"
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
    </div>
  );

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-1 flex-col gap-2">
          <Tabs value={ activeTab } onValueChange={ handleTabChange }>
            <TabsList>
              { VERIFICATION_TABS.map((tab) => (
                <TabsTrigger key={ tab.value } value={ tab.value }>
                  { tab.label }
                </TabsTrigger>
              )) }
            </TabsList>
          </Tabs>
          { currentTabInfo && (
            <p className="text-sm text-muted-foreground">
              { currentTabInfo.description }
            </p>
          ) }
        </div>
      </div>
      { paginationFooter }
      { tableBody }
      <VerificationDetailDialog
        verification={ selectedVerification }
        open={ Boolean(selectedVerification) }
        onClose={ handleCloseDialog }
      />
    </>
  );
}
