'use client';

import { useEffect, useMemo, useReducer } from 'react';
import {
  FiChevronLeft,
  FiChevronRight,
  FiEye,
  FiFileText
} from 'react-icons/fi';
import { useQueryClient } from '@tanstack/react-query';

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
import { adminVerificationKeys, usePendingVerificationsQuery, type PendingVerification } from '@/hooks/api/useAdminVerifications';

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

type VerificationsTableState = {
  pageSize: number;
  pageIndex: number;
  pageCursors: (string | null)[];
  activeTab: VerificationStatus;
  selectedVerification: PendingVerification | null;
};

const INITIAL_STATE: VerificationsTableState = {
  pageSize: 20,
  pageIndex: 0,
  pageCursors: [null],
  activeTab: 'in_review',
  selectedVerification: null,
};

type VerificationsTableAction =
  | {
    type: 'SET_NEXT_CURSOR_FOR_CURRENT_PAGE';
    payload: string | null;
  }
  | {
    type: 'GO_TO_PREVIOUS_PAGE';
  }
  | {
    type: 'GO_TO_NEXT_PAGE';
    payload: string | null;
  }
  | {
    type: 'SET_PAGE_SIZE';
    payload: number;
  }
  | {
    type: 'SET_ACTIVE_TAB';
    payload: VerificationStatus;
  }
  | {
    type: 'SET_SELECTED_VERIFICATION';
    payload: PendingVerification | null;
  };

function verificationsTableReducer(
  state: VerificationsTableState,
  action: VerificationsTableAction
): VerificationsTableState {
  switch (action.type) {
    case 'SET_NEXT_CURSOR_FOR_CURRENT_PAGE': {
      const targetIndex = state.pageIndex + 1;
      if (state.pageCursors[targetIndex] === action.payload) {
        return state;
      }

      const nextCursors = [...state.pageCursors];
      nextCursors[targetIndex] = action.payload;

      return {
        ...state,
        pageCursors: nextCursors,
      };
    }
    case 'GO_TO_PREVIOUS_PAGE':
      return {
        ...state,
        pageIndex: Math.max(state.pageIndex - 1, 0),
      };
    case 'GO_TO_NEXT_PAGE': {
      if (!action.payload) {
        return state;
      }

      const targetIndex = state.pageIndex + 1;
      const nextCursors = [...state.pageCursors];
      if (nextCursors[targetIndex] !== action.payload) {
        nextCursors[targetIndex] = action.payload;
      }

      return {
        ...state,
        pageIndex: targetIndex,
        pageCursors: nextCursors,
      };
    }
    case 'SET_PAGE_SIZE':
      if (action.payload === state.pageSize) {
        return state;
      }

      return {
        ...state,
        pageSize: action.payload,
        pageIndex: 0,
        pageCursors: [null],
      };
    case 'SET_ACTIVE_TAB':
      if (action.payload === state.activeTab) {
        return state;
      }

      return {
        ...state,
        activeTab: action.payload,
        pageIndex: 0,
        pageCursors: [null],
        selectedVerification: null,
      };
    case 'SET_SELECTED_VERIFICATION':
      return {
        ...state,
        selectedVerification: action.payload,
      };
    default:
      return state;
  }
}

type VerificationRow = {
  id: string;
  spaceName: string;
  location: string;
  partnerName: string;
  partnerHandle: string;
  submittedAt: string;
  documentsCount: number;
  verification: PendingVerification;
};

function LoadingTable() {
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

function ErrorState({
 error, onRetry, 
}: { error: unknown; onRetry: () => void }) {
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
        <Button variant="outline" onClick={ onRetry }>Retry</Button>
      </CardContent>
    </Card>
  );
}

function EmptyState({ activeTab, }: { activeTab: VerificationStatus }) {
  const emptyState =
    activeTab === 'in_review'
      ? {
        title: 'No pending verifications',
        description: 'All verification requests have been processed.',
      }
      : activeTab === 'expired'
        ? {
          title: 'No renewals required',
          description: 'Renewal-required spaces will appear here when an approval expires.',
        }
        : {
          title: 'No approved verifications',
          description: 'Approved verifications will show up here once the queue is reviewed.',
        };

  return (
    <Card className="border-dashed border-border/70 bg-background/60">
      <CardHeader>
        <CardTitle>{ emptyState.title }</CardTitle>
        <CardDescription>{ emptyState.description }</CardDescription>
      </CardHeader>
    </Card>
  );
}

function DesktopTable({
  rows,
  onViewDetails,
}: {
  rows: VerificationRow[];
  onViewDetails: (verification: PendingVerification) => void;
}) {
  return (
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
          { rows.map((row) => (
            <TableRow key={ row.id } className="cursor-pointer transition hover:bg-muted/20">
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
                  onClick={ () => onViewDetails(row.verification) }
                >
                  <FiEye className="size-4" aria-hidden="true" />
                  Review
                </Button>
              </TableCell>
            </TableRow>
          )) }
        </TableBody>
      </Table>
    </div>
  );
}

function MobileCards({
  verifications,
  onViewDetails,
}: {
  verifications: PendingVerification[];
  onViewDetails: (verification: PendingVerification) => void;
}) {
  return (
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
                onClick={ () => onViewDetails(verification) }
              >
                <FiEye className="size-4" aria-hidden="true" />
                Review
              </Button>
            </div>
          </div>
        </Card>
      )) }
    </div>
  );
}

function TableContent({
  isLoading,
  isError,
  error,
  refetch,
  activeTab,
  verifications,
  rows,
  onViewDetails,
}: {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
  activeTab: VerificationStatus;
  verifications: PendingVerification[];
  rows: VerificationRow[];
  onViewDetails: (verification: PendingVerification) => void;
}) {
  if (isLoading) {
    return <LoadingTable />;
  }

  if (isError) {
    return <ErrorState error={ error } onRetry={ refetch } />;
  }

  if (verifications.length === 0) {
    return <EmptyState activeTab={ activeTab } />;
  }

  return (
    <>
      <DesktopTable rows={ rows } onViewDetails={ onViewDetails } />
      <MobileCards verifications={ verifications } onViewDetails={ onViewDetails } />
    </>
  );
}

function PaginationFooter({
  pageIndex,
  pageSize,
  pageRowCount,
  isLoading,
  isFetchingPage,
  hasNextPage,
  onPrevPage,
  onNextPage,
  onPageSizeChange,
}: {
  pageIndex: number;
  pageSize: number;
  pageRowCount: number;
  isLoading: boolean;
  isFetchingPage: boolean;
  hasNextPage: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
  onPageSizeChange: (value: string) => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-2 rounded-md border border-border/70 bg-background/80 px-4 py-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2 font-medium text-foreground">
        <span>Page { pageIndex + 1 }</span>
        <span className="hidden md:inline">•</span>
        <span className="text-muted-foreground">
          { pageRowCount } entr{ pageRowCount === 1 ? 'y' : 'ies' } on this page (max { pageSize })
        </span>
        { isFetchingPage && <span className="text-muted-foreground">Updating…</span> }
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={ onPrevPage }
            disabled={ pageIndex === 0 || isLoading }
          >
            <FiChevronLeft className="size-4" aria-hidden="true" />
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={ onNextPage }
            disabled={ !hasNextPage || isLoading }
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
          <Select value={ String(pageSize) } onValueChange={ onPageSizeChange }>
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
}

export function AdminVerificationsTable() {
  const [state, dispatch] = useReducer(verificationsTableReducer, INITIAL_STATE);
  const cursor = state.pageCursors[state.pageIndex] ?? null;

  const queryClient = useQueryClient();
  const {
    data: page,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = usePendingVerificationsQuery({
    limit: state.pageSize,
    cursor,
    status: state.activeTab,
  });

  const verifications = useMemo(() => page?.data ?? [], [page?.data]);
  const nextCursor = page?.nextCursor ?? null;
  const currentTabInfo = VERIFICATION_TABS.find((tab) => tab.value === state.activeTab);

  const tableRows = useMemo(
    () =>
      verifications.map((verification) => ({
        id: verification.id,
        spaceName: verification.space.name,
        location: verification.space.location,
        partnerName: verification.space.partner.name,
        partnerHandle: verification.space.partner.handle,
        submittedAt: verification.submitted_at,
        documentsCount: verification.documents.length,
        verification,
      })),
    [verifications]
  );

  const isFetchingPage = isFetching && !isLoading;

  useEffect(() => {
    if (!page) {
      return;
    }

    dispatch({
      type: 'SET_NEXT_CURSOR_FOR_CURRENT_PAGE',
      payload: page.nextCursor ?? null,
    });
  }, [page, state.pageIndex]);

  const handleViewDetails = (verification: PendingVerification) => {
    dispatch({
 type: 'SET_SELECTED_VERIFICATION',
payload: verification, 
});
  };

  const handleCloseDialog = () => {
    dispatch({
 type: 'SET_SELECTED_VERIFICATION',
payload: null, 
});
  };

  const handlePrevPage = () => {
    dispatch({ type: 'GO_TO_PREVIOUS_PAGE', });
  };

  const handleNextPage = () => {
    dispatch({
 type: 'GO_TO_NEXT_PAGE',
payload: nextCursor, 
});
  };

  const handlePageSizeChange = (value: string) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed === state.pageSize) {
      return;
    }

    dispatch({
 type: 'SET_PAGE_SIZE',
payload: parsed, 
});
  };

  const handleTabChange = (value: string) => {
    const nextTab = value as VerificationStatus;
    if (nextTab === state.activeTab) {
      return;
    }

    dispatch({
 type: 'SET_ACTIVE_TAB',
payload: nextTab, 
});
    queryClient.invalidateQueries({ queryKey: adminVerificationKeys.list(nextTab, state.pageSize, null), });
  };

  const pageRowCount = verifications.length;

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-1 flex-col gap-2">
          <Tabs value={ state.activeTab } onValueChange={ handleTabChange }>
            <TabsList>
              { VERIFICATION_TABS.map((tab) => (
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

      <PaginationFooter
        pageIndex={ state.pageIndex }
        pageSize={ state.pageSize }
        pageRowCount={ pageRowCount }
        isLoading={ isLoading }
        isFetchingPage={ isFetchingPage }
        hasNextPage={ Boolean(nextCursor) }
        onPrevPage={ handlePrevPage }
        onNextPage={ handleNextPage }
        onPageSizeChange={ handlePageSizeChange }
      />

      <TableContent
        isLoading={ isLoading }
        isError={ isError }
        error={ error }
        refetch={ refetch }
        activeTab={ state.activeTab }
        verifications={ verifications }
        rows={ tableRows }
        onViewDetails={ handleViewDetails }
      />

      <VerificationDetailDialog
        key={ state.selectedVerification?.id ?? 'verification-dialog-empty' }
        verification={ state.selectedVerification }
        open={ Boolean(state.selectedVerification) }
        onClose={ handleCloseDialog }
      />
    </>
  );
}
