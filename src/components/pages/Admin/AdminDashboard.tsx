'use client';

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';
import { useAdminDashboardQuery, type AdminDashboardParams } from '@/hooks/api/useAdminDashboard';
import { formatCurrencyMinor } from '@/lib/wallet';

const RECENT_PAGE_SIZE = 5;
const AUDIT_PAGE_SIZE = 12;

const formatTimestamp = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';

const formatOutcome = (value?: string | null) =>
  value ? value.replace(/^"|"$/g, '') : 'unknown';

const formatStatusLabel = (value: string) => {
  const overrides: Record<string, string> = { new_last7days: 'Last 7 Days', };

  if (overrides[value]) {
    return overrides[value];
  }

  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/([a-z])([0-9]+)/gi, '$1 $2');
};

const TableSkeleton = () => (
  <div className="space-y-2">
    <Skeleton className="h-6 w-full" />
    <Skeleton className="h-6 w-[90%]" />
    <Skeleton className="h-6 w-[80%]" />
  </div>
);

function PaginationControls({
  page,
  pageSize,
  total,
  onPageChange,
  isLoading,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-xs text-muted-foreground">
        Page { page } of { totalPages } ({ total } total)
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={ !hasPrev || isLoading }
          onClick={ () => onPageChange(page - 1) }
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={ !hasNext || isLoading }
          onClick={ () => onPageChange(page + 1) }
          aria-label="Next page"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const [recentPage, setRecentPage] = React.useState(1);
  const [auditPage, setAuditPage] = React.useState(1);

  const params: AdminDashboardParams = {
    recentPage,
    recentSize: RECENT_PAGE_SIZE,
    auditPage,
    auditSize: AUDIT_PAGE_SIZE,
  };

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
  } = useAdminDashboardQuery(params, { placeholderData: (prev) => prev, });

  const metrics = data?.metrics;
  const isLoadingData = isLoading;

  const summaryCards = [
    {
      title: 'Bookings',
      description: 'Booking activity tied to the audit log.',
      value: metrics?.bookings.total,
      statuses: metrics?.bookings.statusCounts ?? [],
    },
    {
      title: 'Spaces',
      description: 'Coworking inventory across partners.',
      value: metrics?.spaces.total,
      statuses: [
        {
          status: 'published',
          count: metrics?.spaces.published,
        },
        {
          status: 'unpublished',
          count: metrics?.spaces.unpublished,
        }
      ],
    },
    {
      title: 'Customers',
      description: 'Customer registrations and lifecycle.',
      value: metrics?.clients.total,
      statuses: [
        {
          status: 'active',
          count: metrics?.clients.active,
        },
        {
          status: 'deactivated',
          count: metrics?.clients.deactivated,
        },
        {
          status: 'pending_deletion',
          count: metrics?.clients.pendingDeletion,
        },
        {
          status: 'deleted',
          count: metrics?.clients.deleted,
        },
        {
          status: 'new_last7days',
          count: metrics?.clients.newLast7Days,
        }
      ],
    },
    {
      title: 'Verifications',
      description: 'Partner business verification throughput.',
      value: metrics?.verifications.total,
      statuses: metrics?.verifications.statusCounts ?? [],
    },
    {
      title: 'Revenue',
      description: 'Total transaction volume.',
      value: metrics?.revenue.totalMinor
        ? formatCurrencyMinor(metrics.revenue.totalMinor, 'PHP')
        : '₱0',
      statuses: [
        {
          status: 'transactions',
          count: metrics?.revenue.transactionCount,
        }
      ],
    }
  ];

  const renderRecentBookings = () => {
    const bookings = data?.recent.bookings ?? [];
    if (isLoadingData) {
      return <TableSkeleton />;
    }
    if (!bookings.length) {
      return (
        <p className="text-sm text-muted-foreground">No recent bookings yet.</p>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[120px]">ID</TableHead>
            <TableHead className="min-w-[100px]">Space</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Expires</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          { bookings.map((booking) => (
            <TableRow key={ booking.id }>
              <TableCell>{ booking.id.slice(-6) }</TableCell>
              <TableCell>{ booking.space_id.slice(-6) }</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-[11px]">
                  { formatStatusLabel(booking.status) }
                </Badge>
              </TableCell>
              <TableCell>{ formatTimestamp(booking.created_at) }</TableCell>
              <TableCell>{ formatTimestamp(booking.expires_at) }</TableCell>
            </TableRow>
          )) }
        </TableBody>
      </Table>
    );
  };

  const renderRecentSpaces = () => {
    const spaces = data?.recent.spaces ?? [];
    if (isLoadingData) {
      return <TableSkeleton />;
    }
    if (!spaces.length) {
      return (
        <p className="text-sm text-muted-foreground">No recent spaces yet.</p>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Region</TableHead>
            <TableHead>City</TableHead>
            <TableHead>Published</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          { spaces.map((space) => (
            <TableRow key={ space.id }>
              <TableCell>{ space.name }</TableCell>
              <TableCell>{ space.region }</TableCell>
              <TableCell>{ space.city }</TableCell>
              <TableCell>
                <Badge variant={ space.is_published ? 'success' : 'destructive' }>
                  { space.is_published ? 'published' : 'hidden' }
                </Badge>
              </TableCell>
              <TableCell>{ formatTimestamp(space.updated_at) }</TableCell>
            </TableRow>
          )) }
        </TableBody>
      </Table>
    );
  };

  const renderRecentCustomers = () => {
    const customers = data?.recent.clients ?? [];
    if (isLoadingData) {
      return <TableSkeleton />;
    }
    if (!customers.length) {
      return (
        <p className="text-sm text-muted-foreground">
          No recent customer registrations yet.
        </p>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Handle</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Registered</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          { customers.map((customer) => (
            <TableRow key={ customer.user_id }>
              <TableCell>{ customer.handle }</TableCell>
              <TableCell>
                { customer.first_name || customer.last_name
                  ? `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim()
                  : customer.handle }
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    customer.status === 'active' ? 'success' : 'destructive'
                  }
                >
                  { customer.status }
                </Badge>
              </TableCell>
              <TableCell>{ formatTimestamp(customer.created_at) }</TableCell>
            </TableRow>
          )) }
        </TableBody>
      </Table>
    );
  };

  const renderRecentVerifications = () => {
    const verifications = data?.recent.verifications ?? [];
    if (isLoadingData) {
      return <TableSkeleton />;
    }
    if (!verifications.length) {
      return (
        <p className="text-sm text-muted-foreground">
          No recent partner verifications yet.
        </p>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Space</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Submitted</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          { verifications.map((verification) => (
            <TableRow key={ verification.id }>
              <TableCell>{ verification.id.slice(-6) }</TableCell>
              <TableCell>{ verification.space_id.slice(-6) }</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-[11px]">
                  { formatStatusLabel(verification.status) }
                </Badge>
              </TableCell>
              <TableCell>
                { formatTimestamp(verification.submitted_at) }
              </TableCell>
            </TableRow>
          )) }
        </TableBody>
      </Table>
    );
  };

  const renderAuditLog = () => {
    if (isLoadingData) {
      return <TableSkeleton />;
    }

    if (!data?.auditLog.length) {
      return (
        <p className="text-sm text-muted-foreground">
          No audit events recorded yet.
        </p>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Action</TableHead>
            <TableHead>Object</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>When</TableHead>
            <TableHead>Outcome</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          { data.auditLog.map((event) => {
            const outcome = formatOutcome(event.outcome);
            return (
              <TableRow key={ event.audit_id }>
                <TableCell className="capitalize">{ event.action }</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[11px]">
                    { event.object_table }
                  </Badge>
                  <div className="text-xs text-muted-foreground">
                    { event.object_pk.slice(-6) }
                  </div>
                </TableCell>
                <TableCell>
                  { event.actor_label ?? 'system' }
                  <div className="text-xs text-muted-foreground">
                    { event.actor_user_id ? `#${event.actor_user_id}` : '' }
                  </div>
                </TableCell>
                <TableCell>
                  { formatDistanceToNow(new Date(event.occured_at), { addSuffix: true, }) }
                </TableCell>
                <TableCell>
                  <Badge
                    variant={ outcome === 'success' ? 'success' : 'destructive' }
                  >
                    { outcome }
                  </Badge>
                </TableCell>
              </TableRow>
            );
          }) }
        </TableBody>
      </Table>
    );
  };

  const statusCountBadges = (card: (typeof summaryCards)[number]) => {
    const statuses =
      card.statuses?.filter((status) => status.count ?? 0 !== 0) ?? [];
    if (!statuses.length) {
      return (
        <p className="text-xs text-muted-foreground">Data not available yet.</p>
      );
    }

    return (
      <div className="flex flex-wrap gap-2">
        { statuses.map((status) => (
          <Badge key={ status.status } variant="outline" className="text-[11px]">
            <span className="capitalize">
              { formatStatusLabel(status.status) }
            </span>
            <span className="ml-1 text-[11px] font-normal">
              ({ status.count?.toLocaleString() ?? 0 })
            </span>
          </Badge>
        )) }
      </div>
    );
  };

  const activeRecentTab = React.useRef<string>('bookings');
  const getRecentTotal = () => {
    if (!data?.recentPagination) return 0;
    const totals = data.recentPagination.totals;
    const tab = activeRecentTab.current;
    if (tab === 'bookings') return totals.bookings;
    if (tab === 'spaces') return totals.spaces;
    if (tab === 'customers') return totals.clients;
    if (tab === 'verifications') return totals.verifications;
    return 0;
  };

  const summaryCardClasses =
    'rounded-md border border-border/50 bg-muted/20 shadow-none';
  const dataGridClass = 'grid gap-8 lg:grid-cols-[1.45fr,1fr]';
  const logCardContentClass = 'space-y-3';
  const scrollWrapperClass =
    'max-h-[400px] overflow-auto rounded-md border border-border/50 bg-muted/20 p-2';
  const valueTextClass = 'text-2xl font-semibold leading-tight tracking-tight';

  return (
    <div className="space-y-6">
      { isError && (
        <div className="rounded-md border border-destructive/70 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          { error instanceof Error
            ? error.message
            : 'Unable to load dashboard data.' }
        </div>
      ) }
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        { summaryCards.map((card) => (
          <Card className={ summaryCardClasses } key={ card.title }>
            <CardHeader className="space-y-1">
              <CardTitle className="text-base font-semibold">
                { card.title }
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                { card.description }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pt-2 pb-4">
              { isLoadingData ? (
                <Skeleton className="h-10 w-28" />
              ) : (
                <p className={ valueTextClass }>
                  { card.value !== undefined && card.value !== null
                    ? card.value.toLocaleString()
                    : '—' }
                </p>
              ) }
              { isLoadingData ? (
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-16" />
                </div>
              ) : (
                statusCountBadges(card)
              ) }
            </CardContent>
          </Card>
        )) }
      </div>

      <Separator />

      <div className={ dataGridClass }>
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold tracking-tight">Unified audit log</h3>
            <p className="text-sm text-muted-foreground">
              Tracks bookings, spaces, customers, and verifications with Prisma
              audit data.
            </p>
          </div>
          <div className={ logCardContentClass }>
            <div className={ scrollWrapperClass }>{ renderAuditLog() }</div>
            { data?.auditPagination && (
              <PaginationControls
                page={ data.auditPagination.page }
                pageSize={ data.auditPagination.pageSize }
                total={ data.auditPagination.total }
                onPageChange={ setAuditPage }
                isLoading={ isFetching }
              />
            ) }
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold tracking-tight">Recent Prisma records</h3>
            <p className="text-sm text-muted-foreground">
              Snapshots of the latest entries for each table in the schema.
            </p>
          </div>
          <div className="space-y-4">
            <Tabs
              defaultValue="bookings"
              onValueChange={ (val) => {
                activeRecentTab.current = val;
                setRecentPage(1);
              } }
            >
              <TabsList className="grid grid-cols-4 gap-1 rounded-md bg-muted p-1 text-[11px] font-semibold uppercase tracking-wide">
                <TabsTrigger value="bookings">Bookings</TabsTrigger>
                <TabsTrigger value="spaces">Spaces</TabsTrigger>
                <TabsTrigger value="customers">Customers</TabsTrigger>
                <TabsTrigger value="verifications">Verifications</TabsTrigger>
              </TabsList>
              <div className="pt-4">
                <TabsContent value="bookings" className="space-y-2">
                  <div className={ scrollWrapperClass }>
                    { renderRecentBookings() }
                  </div>
                </TabsContent>
                <TabsContent value="spaces" className="space-y-2">
                  <div className={ scrollWrapperClass }>
                    { renderRecentSpaces() }
                  </div>
                </TabsContent>
                <TabsContent value="customers" className="space-y-2">
                  <div className={ scrollWrapperClass }>
                    { renderRecentCustomers() }
                  </div>
                </TabsContent>
                <TabsContent value="verifications" className="space-y-2">
                  <div className={ scrollWrapperClass }>
                    { renderRecentVerifications() }
                  </div>
                </TabsContent>
              </div>
            </Tabs>
            { data?.recentPagination && (
              <PaginationControls
                page={ data.recentPagination.page }
                pageSize={ data.recentPagination.pageSize }
                total={ getRecentTotal() }
                onPageChange={ setRecentPage }
                isLoading={ isFetching }
              />
            ) }
          </div>
        </div>
      </div>
    </div>
  );
}
