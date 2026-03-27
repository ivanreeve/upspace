'use client';

import Link from 'next/link';
import {
  useEffect,
  useId,
  useMemo,
  useState,
  type ComponentProps
} from 'react';
import {
  FiAlertCircle,
  FiArrowUpRight,
  FiCheck,
  FiLoader,
  FiLogIn,
  FiLogOut,
  FiMoreHorizontal,
  FiSearch
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { toast } from 'sonner';

import { SpacesBreadcrumbs } from './SpacesBreadcrumbs';

import { useBulkUpdateBookingStatusMutation, usePartnerBookingsQuery } from '@/hooks/api/useBookings';
import { usePartnerStuckBookingsQuery, type StuckBookingsSummary } from '@/hooks/api/usePartnerStuckBookings';
import type { BookingRecord, BookingStatus } from '@/lib/bookings/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
  TableCaption,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const bookingDateFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const bookingPriceFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

const ACTIVE_BOOKING_STATUSES = new Set<BookingStatus>([
  'confirmed',
  'checkedin',
  'pending'
]);

const CANCELLATION_REASON_MIN_LENGTH = 5;

const BULK_STATUS_OPTIONS: { label: string; status: BookingStatus }[] = [
  {
    label: 'Mark as confirmed',
    status: 'confirmed',
  },
  {
    label: 'Mark as checked-in',
    status: 'checkedin',
  },
  {
    label: 'Mark as checked-out',
    status: 'checkedout',
  },
  {
    label: 'Mark as cancelled',
    status: 'cancelled',
  },
  {
    label: 'Mark as no-show',
    status: 'noshow',
  }
];

const bookingStatusMeta: Record<
  BookingStatus,
  {
    label: string;
    helper: string;
    helperClassName?: string;
    variant: ComponentProps<typeof Badge>['variant'];
  }
> = {
  pending: {
    label: 'Pending',
    helper: 'Needs confirmation',
    helperClassName: 'text-amber-700 dark:text-amber-300',
    variant: 'secondary',
  },
  confirmed: {
    label: 'Confirmed',
    helper: 'Ready for check-in',
    helperClassName: 'text-primary',
    variant: 'default',
  },
  checkedin: {
    label: 'Checked in',
    helper: 'Guest is currently on site',
    helperClassName: 'text-emerald-700 dark:text-emerald-300',
    variant: 'success',
  },
  checkedout: {
    label: 'Checked out',
    helper: 'Visit has ended',
    variant: 'secondary',
  },
  completed: {
    label: 'Completed',
    helper: 'Booking is fully closed',
    variant: 'outline',
  },
  cancelled: {
    label: 'Cancelled',
    helper: 'Booking was cancelled',
    variant: 'destructive',
  },
  rejected: {
    label: 'Rejected',
    helper: 'Booking was declined',
    variant: 'destructive',
  },
  expired: {
    label: 'Expired',
    helper: 'Booking timed out',
    variant: 'outline',
  },
  noshow: {
    label: 'No show',
    helper: 'Guest never checked in',
    variant: 'destructive',
  },
};

const bookingPrimaryActionMap: Partial<
  Record<
    BookingStatus,
    {
      icon: IconType;
      label: string;
      nextStatus: BookingStatus;
      variant: ComponentProps<typeof Button>['variant'];
    }
  >
> = {
  pending: {
    icon: FiCheck,
    label: 'Confirm',
    nextStatus: 'confirmed',
    variant: 'default',
  },
  confirmed: {
    icon: FiLogIn,
    label: 'Check in',
    nextStatus: 'checkedin',
    variant: 'outline',
  },
  checkedin: {
    icon: FiLogOut,
    label: 'Check out',
    nextStatus: 'checkedout',
    variant: 'outline',
  },
};

export function SpacesBookingsPage({
  initialBookings,
  initialStuckData,
}: {
  initialBookings?: BookingRecord[];
  initialStuckData?: StuckBookingsSummary;
} = {}) {
  const {
    data: bookings = [],
    isLoading,
    isError,
    error,
  } = usePartnerBookingsQuery(initialBookings ? { initialData: initialBookings, } : undefined);
  const {
    data: stuckData,
    isLoading: isStuckLoading,
  } = usePartnerStuckBookingsQuery(initialStuckData ? { initialData: initialStuckData, } : undefined);
  const bulkUpdate = useBulkUpdateBookingStatusMutation();
  const headingId = useId();
  const descriptionId = useId();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelTargetIds, setCancelTargetIds] = useState<string[]>([]);
  const cancellationReasonFieldId = useId();
  const trimmedCancelReason = cancelReason.trim();
  const isCancellationReasonValid =
    trimmedCancelReason.length >= CANCELLATION_REASON_MIN_LENGTH;

  const activeBookings = useMemo(
    () =>
      bookings.filter((booking) => ACTIVE_BOOKING_STATUSES.has(booking.status)),
    [bookings]
  );

  const sortedBookings = useMemo(
    () =>
      [...activeBookings].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [activeBookings]
  );

  const uniqueAreas = useMemo(() => {
    const map = new Map<string, string>();
    sortedBookings.forEach((b) => map.set(b.areaId, b.areaName));
    return Array.from(map.entries()).map(([id, name]) => ({
 id,
name, 
}));
  }, [sortedBookings]);

  const filteredBookings = useMemo(() => {
    let result = sortedBookings;

    if (statusFilter !== 'all') {
      result = result.filter((booking) => booking.status === statusFilter);
    }

    if (areaFilter !== 'all') {
      result = result.filter((booking) => booking.areaId === areaFilter);
    }

    const normalizedQuery = searchTerm.trim().toLowerCase();
    if (normalizedQuery) {
      result = result.filter((booking) => {
        const handle = booking.customerHandle ? `@${booking.customerHandle}` : '';
        const fullName = booking.customerName ?? '';
        const searchable = [
          booking.areaName,
          booking.spaceName,
          booking.customerAuthId,
          handle,
          fullName,
          booking.status
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchable.includes(normalizedQuery);
      });
    }

    return result;
  }, [areaFilter, searchTerm, sortedBookings, statusFilter]);

  useEffect(() => {
    setSelectedIds((current) => {
      const validIds = new Set(
        Array.from(current).filter((id) =>
          sortedBookings.some((booking) => booking.id === id)
        )
      );
      return validIds.size === current.size ? current : validIds;
    });
  }, [sortedBookings]);

  const areaGuestCounts = useMemo(() => {
    const counts = new Map<string, number>();
    sortedBookings.forEach((booking) => {
      if (booking.status !== 'checkedin') {
        return;
      }
      const guests = booking.guestCount ?? 1;
      counts.set(booking.areaId, (counts.get(booking.areaId) ?? 0) + guests);
    });
    return counts;
  }, [sortedBookings]);

  const activeCount = sortedBookings.length;
  const visibleSelectedCount = filteredBookings.filter((booking) =>
    selectedIds.has(booking.id)
  ).length;
  const allVisibleSelected =
    filteredBookings.length > 0 &&
    visibleSelectedCount === filteredBookings.length;
  const selectionState: boolean | 'indeterminate' = allVisibleSelected
    ? true
    : visibleSelectedCount > 0
      ? 'indeterminate'
      : false;

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        filteredBookings.forEach((booking) => next.add(booking.id));
      } else {
        filteredBookings.forEach((booking) => next.delete(booking.id));
      }
      return next;
    });
  };

  const handleSelectOne = (bookingId: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(bookingId);
      } else {
        next.delete(bookingId);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const openCancelDialog = (ids: string[]) => {
    if (!ids.length) {
      return;
    }
    setCancelTargetIds(ids);
    setCancelReason('');
    setIsCancelDialogOpen(true);
  };

  const closeCancelDialog = () => {
    if (bulkUpdate.isPending) {
      return;
    }
    setIsCancelDialogOpen(false);
    setCancelReason('');
    setCancelTargetIds([]);
  };

  const submitCancellation = () => {
    if (!cancelTargetIds.length) {
      toast.error('Select at least one booking to cancel.');
      return;
    }

    if (!isCancellationReasonValid) {
      toast.error(
        `Cancellation reason must be at least ${CANCELLATION_REASON_MIN_LENGTH} characters.`
      );
      return;
    }

    bulkUpdate.mutate(
      {
        ids: cancelTargetIds,
        status: 'cancelled',
        cancellationReason: trimmedCancelReason,
      },
      {
        onSuccess: () => {
          setSelectedIds((current) => {
            const next = new Set(current);
            cancelTargetIds.forEach((id) => next.delete(id));
            return next;
          });
          closeCancelDialog();
        },
      }
    );
  };

  const handleBulkStatusChange = (status: BookingStatus) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) {
      return;
    }

    if (status === 'cancelled') {
      openCancelDialog(ids);
      return;
    }

    bulkUpdate.mutate(
      {
        ids,
        status,
      },
      {
        onSuccess: () => {
          setSelectedIds(new Set());
        },
      }
    );
  };

  const renderCapacity = (booking: (typeof bookings)[number]) => {
    const used = areaGuestCounts.get(booking.areaId) ?? 0;
    const maxCap = booking.areaMaxCapacity ?? null;
    const remaining =
      typeof maxCap === 'number' ? Math.max(maxCap - used, 0) : null;
    const status =
      maxCap === null ? 'unbounded' : remaining === 0 ? 'full' : 'available';

    return {
      used,
      maxCap,
      remaining,
      status,
      label:
        maxCap === null
          ? `${used} guest${used === 1 ? '' : 's'}`
          : `${used}/${maxCap}`,
      helper:
        maxCap === null
          ? 'No capacity set'
          : remaining === 0
            ? 'At capacity'
            : `${remaining} slot${remaining === 1 ? '' : 's'} remaining`,
    };
  };

  const renderBody = () => {
    if (isLoading) {
      return (
        <TableBody>
          { Array.from({ length: 4, }).map((_, index) => (
            <TableRow key={ `skeleton-${index}` }>
              <TableCell className="w-10">
                <Skeleton className="size-4" />
              </TableCell>
              <TableCell className="w-44">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mt-2 h-3 w-20" />
              </TableCell>
              <TableCell className="w-1/4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-3 w-24" />
              </TableCell>
              <TableCell className="w-24">
                <Skeleton className="h-5 w-16" />
              </TableCell>
              <TableCell className="w-36">
                <Skeleton className="h-8 w-28 rounded-md" />
              </TableCell>
              <TableCell className="w-24">
                <Skeleton className="h-4 w-14" />
              </TableCell>
              <TableCell className="w-28">
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell className="w-40">
                <Skeleton className="h-4 w-28" />
              </TableCell>
              <TableCell className="w-32">
                <Skeleton className="h-4 w-24" />
              </TableCell>
            </TableRow>
          )) }
        </TableBody>
      );
    }

    if (isError) {
      return (
        <TableBody>
          <TableRow>
            <TableCell colSpan={ 10 } className="text-sm text-destructive">
              { error instanceof Error
                ? error.message
                : 'Unable to load bookings.' }
            </TableCell>
          </TableRow>
        </TableBody>
      );
    }

    if (!bookings.length) {
      return (
        <TableBody>
          <TableRow>
            <TableCell colSpan={ 10 }>
              <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
                <FiAlertCircle className="size-5" aria-hidden="true" />
                <p>
                  No bookings yet. Once guests book an area, you will see them
                  here.
                </p>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      );
    }

    if (!sortedBookings.length) {
      return (
        <TableBody>
          <TableRow>
            <TableCell colSpan={ 10 }>
              <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
                <FiAlertCircle className="size-5" aria-hidden="true" />
                <p>No active bookings are filling your areas right now.</p>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      );
    }

    if (!filteredBookings.length) {
      return (
        <TableBody>
          <TableRow>
            <TableCell colSpan={ 10 }>
              <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
                <FiAlertCircle className="size-5" aria-hidden="true" />
                <p>No results match your search.</p>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      );
    }

    return (
      <TableBody>
        { filteredBookings.map((booking) => {
          const capacity = renderCapacity(booking);
          const priceLabel =
            typeof booking.price === 'number'
              ? bookingPriceFormatter.format(booking.price)
              : '—';
          const isSelected = selectedIds.has(booking.id);
          const userDisplayName = booking.customerName ?? 'Guest';
          const userHandle =
            booking.customerHandle ?? booking.customerAuthId.slice(0, 8);
          const statusMeta = bookingStatusMeta[booking.status];
          const rawPrimaryAction = bookingPrimaryActionMap[booking.status] ?? null;
          const isCheckinAction = booking.status === 'confirmed';
          const bookingDate = booking.startAt.slice(0, 10);
          const todayDate = new Date().toISOString().slice(0, 10);
          const isCheckinDisabled = isCheckinAction && bookingDate !== todayDate;
          const primaryAction = rawPrimaryAction;
          const canCancel = ACTIVE_BOOKING_STATUSES.has(booking.status);

          return (
            <TableRow
              key={ booking.id }
              data-state={ isSelected ? 'selected' : undefined }
            >
              <TableCell>
                <Checkbox
                  aria-label={ `Select booking for ${booking.areaName}` }
                  checked={ isSelected }
                  onCheckedChange={ (checked) =>
                    handleSelectOne(booking.id, Boolean(checked))
                  }
                />
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-foreground">
                    { userDisplayName }
                  </p>
                  <p className="text-xs text-muted-foreground">
                    { userHandle.startsWith('@') ? userHandle : `@${userHandle}` }
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <Link
                    href={ `/marketplace/${booking.spaceId}` }
                    className="inline-flex items-center gap-1 text-sm font-semibold text-foreground hover:text-primary"
                  >
                    { booking.spaceName }
                    <FiArrowUpRight className="size-4" aria-hidden="true" />
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    { booking.areaName }
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <Badge
                    variant={ statusMeta.variant }
                    className="rounded-md"
                  >
                    { statusMeta.label }
                  </Badge>
                  <p
                    className={ cn(
                      'text-xs text-muted-foreground',
                      statusMeta.helperClassName
                    ) }
                  >
                    { statusMeta.helper }
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  { primaryAction ? (
                    <Button
                      size="sm"
                      variant={ primaryAction.variant }
                      className="h-8 gap-1.5 rounded-md px-3 text-xs"
                      onClick={ () =>
                        bulkUpdate.mutate({
                          ids: [booking.id],
                          status: primaryAction.nextStatus,
                        })
                      }
                      disabled={ bulkUpdate.isPending || isCheckinDisabled }
                      title={ isCheckinDisabled ? `Check-in available on ${bookingDate}` : undefined }
                      aria-label={ `${primaryAction.label} ${userDisplayName}` }
                    >
                      <primaryAction.icon className="size-3.5" aria-hidden="true" />
                      { primaryAction.label }
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">No step</span>
                  ) }
                  { canCancel ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-8 rounded-md border-border/70 bg-background shadow-none"
                          disabled={ bulkUpdate.isPending }
                          aria-label={ `Open actions for ${userDisplayName}` }
                        >
                          <FiMoreHorizontal className="size-4" aria-hidden="true" />
                          <span className="sr-only">Open booking actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        sideOffset={ 6 }
                        className="min-w-[180px] rounded-md bg-popover px-1 py-1 shadow-lg"
                      >
                        <DropdownMenuItem
                          onSelect={ () => openCancelDialog([booking.id]) }
                          className="text-destructive focus-visible:bg-destructive/10 focus-visible:text-destructive focus-visible:[&_svg]:text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
                        >
                          <FiAlertCircle className="size-4 text-destructive" aria-hidden="true" />
                          Cancel booking
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null }
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm text-foreground">
                  { bookingDateFormatter.format(new Date(booking.startAt)) }
                </span>
              </TableCell>
              <TableCell>
                { booking.bookingHours } hr{ booking.bookingHours === 1 ? '' : 's' }
              </TableCell>
              <TableCell>{ priceLabel }</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">
                    { capacity.label }
                  </span>
                  <span
                    className={ cn(
                      'text-xs',
                      capacity.status === 'full'
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    ) }
                  >
                    { capacity.helper }
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm text-foreground">
                  { bookingDateFormatter.format(new Date(booking.createdAt)) }
                </span>
              </TableCell>
            </TableRow>
          );
        }) }
      </TableBody>
    );
  };

  return (
    <div className="space-y-6 px-4 pb-10 sm:px-6 lg:px-10">
      <SpacesBreadcrumbs currentPage="Bookings" className="mt-6" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">
            Bookings
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitor who is currently booked and track how each area is filling
            up.
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">
          { activeCount } active
        </Badge>
      </div>

      <div className="space-y-2">
        <Badge
          variant="outline"
          className="bg-muted/20 text-sidebar-accent-foreground dark:bg-muted/70 dark:text-muted-foreground text-xs"
        >
          { isStuckLoading
            ? 'Checking paid-but-pending bookings...'
            : `${stuckData?.pendingPaid ?? 0} paid bookings need review` }
        </Badge>
        { stuckData && stuckData.pendingPaid > 0 ? (
          <div className="rounded-md border border-amber-500/60 bg-muted px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
            Some bookings were paid but are still pending. Open the table below to resolve them.
          </div>
        ) : null }
      </div>

      <section
        aria-labelledby={ headingId }
        aria-describedby={ descriptionId }
        className="space-y-4"
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2
              id={ headingId }
              className="text-lg font-semibold text-foreground"
            >
              Area capacity overview
            </h2>
            <p id={ descriptionId } className="text-sm text-muted-foreground">
              Live bookings with per-area capacity signals, search, and bulk
              edits.
            </p>
          </div>
          <Button
            type="button"
            asChild
            variant="default"
            size="sm"
            className="gap-2 dark:bg-background dark:text-foreground dark:hover:bg-background"
          >
            <Link
              href="/partner/spaces/dashboard"
              className="hover:!text-white"
            >
              View analytics
              <FiArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="w-full space-y-1.5 md:max-w-md">
              <label htmlFor="area-capacity-search" className="sr-only">
                Search booked users
              </label>
              <div className="relative">
                <FiSearch
                  className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="area-capacity-search"
                  value={ searchTerm }
                  onChange={ (event) => setSearchTerm(event.target.value) }
                  placeholder="Search by user, space, area, or status"
                  aria-label="Search booked users"
                  className="pl-9 !bg-white !border-slate-300 hover:!bg-white focus:!bg-white dark:!bg-input/30 dark:!border-input"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Filter the table and quickly locate people currently booked into
                your areas.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={ statusFilter }
                onValueChange={ (value) => setStatusFilter(value as BookingStatus | 'all') }
              >
                <SelectTrigger className="w-[140px]" aria-label="Filter by status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="checkedin">Checked in</SelectItem>
                </SelectContent>
              </Select>
              { uniqueAreas.length > 1 ? (
                <Select
                  value={ areaFilter }
                  onValueChange={ setAreaFilter }
                >
                  <SelectTrigger className="w-[160px]" aria-label="Filter by area">
                    <SelectValue placeholder="Area" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All areas</SelectItem>
                    { uniqueAreas.map((area) => (
                      <SelectItem key={ area.id } value={ area.id }>{ area.name }</SelectItem>
                    )) }
                  </SelectContent>
                </Select>
              ) : null }
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                { filteredBookings.length } visible
              </Badge>
              <Badge
                variant={ selectedIds.size ? 'default' : 'secondary' }
                className="text-xs"
              >
                { selectedIds.size } selected
              </Badge>
              { selectedIds.size > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={ bulkUpdate.isPending }
                    >
                      { bulkUpdate.isPending ? (
                        <>
                          <FiLoader
                            className="size-4 animate-spin"
                            aria-hidden="true"
                          />
                          Applying...
                        </>
                      ) : (
                        'Bulk edit'
                      ) }
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Change status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    { BULK_STATUS_OPTIONS.map((option) => (
                      <DropdownMenuItem
                        key={ option.status }
                        onSelect={ () => handleBulkStatusChange(option.status) }
                      >
                        { option.label }
                      </DropdownMenuItem>
                    )) }
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null }
              { selectedIds.size > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={ clearSelection }
                  className="text-muted-foreground"
                >
                  Clear
                </Button>
              ) : null }
            </div>
          </div>

          { bulkUpdate.isError ? (
            <p className="text-xs text-destructive">
              { bulkUpdate.error instanceof Error
                ? bulkUpdate.error.message
                : 'Unable to update bookings.' }
            </p>
          ) : bulkUpdate.isSuccess ? (
            <p className="text-xs text-muted-foreground">
              Status updated for selected bookings.
            </p>
          ) : null }

          <Table aria-labelledby={ headingId } aria-describedby={ descriptionId }>
            <TableCaption className="sr-only">
              Area capacity overview data table with active bookings, search,
              and bulk actions
            </TableCaption>
            <TableHeader className="bg-primary dark:bg-transparent">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 text-white dark:text-foreground">
                  <Checkbox
                    aria-label="Select all visible bookings"
                    checked={ selectionState }
                    onCheckedChange={ (checked) =>
                      handleSelectAll(Boolean(checked))
                    }
                  />
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-white dark:text-foreground">User</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-white dark:text-foreground">Space / Area</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-white dark:text-foreground">Status</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-white dark:text-foreground">Next step</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-white dark:text-foreground">Scheduled</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-white dark:text-foreground">Duration</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-white dark:text-foreground">Price</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-white dark:text-foreground">Capacity</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-white dark:text-foreground">Booked at</TableHead>
              </TableRow>
            </TableHeader>
            { renderBody() }
          </Table>
        </div>
      </section>

      <Dialog
        open={ isCancelDialogOpen }
        onOpenChange={ (open) => {
          if (!open) {
            closeCancelDialog();
          } else {
            setIsCancelDialogOpen(true);
          }
        } }
      >
        <DialogContent dismissible={ !bulkUpdate.isPending }>
          <DialogHeader>
            <DialogTitle>Cancel booking</DialogTitle>
            <DialogDescription>
              Enter a reason that will be sent to the customer in the in-app
              conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label
              htmlFor={ cancellationReasonFieldId }
              className="text-sm font-medium text-foreground"
            >
              Cancellation reason
            </label>
            <Textarea
              id={ cancellationReasonFieldId }
              value={ cancelReason }
              onChange={ (event) => setCancelReason(event.target.value) }
              placeholder="Explain why the booking is being cancelled."
              aria-label="Cancellation reason"
              rows={ 4 }
            />
            <p className="text-xs text-muted-foreground">
              { trimmedCancelReason.length }/{ CANCELLATION_REASON_MIN_LENGTH } minimum characters
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={ closeCancelDialog }
              disabled={ bulkUpdate.isPending }
            >
              Keep booking
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={ submitCancellation }
              disabled={ bulkUpdate.isPending || !isCancellationReasonValid }
              loading={ bulkUpdate.isPending }
              loadingText="Cancelling..."
            >
              Cancel booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
