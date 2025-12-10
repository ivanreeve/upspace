"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
import {
  FiAlertCircle,
  FiArrowUpRight,
  FiLoader,
  FiSearch,
} from "react-icons/fi";

import {
  useBulkUpdateBookingStatusMutation,
  usePartnerBookingsQuery,
} from "@/hooks/api/useBookings";
import type { BookingStatus } from "@/lib/bookings/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const bookingDateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
});

const bookingPriceFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const ACTIVE_BOOKING_STATUSES = new Set<BookingStatus>([
  "confirmed",
  "checkedin",
]);

const BULK_STATUS_OPTIONS: { label: string; status: BookingStatus }[] = [
  {
    label: "Mark as confirmed",
    status: "confirmed",
  },
  {
    label: "Mark as checked-in",
    status: "checkedin",
  },
  {
    label: "Mark as checked-out",
    status: "checkedout",
  },
  {
    label: "Mark as cancelled",
    status: "cancelled",
  },
  {
    label: "Mark as no-show",
    status: "noshow",
  },
];

const statusVariantMap: Record<
  BookingStatus,
  ComponentProps<typeof Badge>["variant"]
> = {
  confirmed: "default",
  pending: "secondary",
  cancelled: "destructive",
  rejected: "destructive",
  expired: "outline",
  checkedin: "success",
  checkedout: "secondary",
  completed: "outline",
  noshow: "destructive",
};

export function SpacesBookingsPage() {
  const {
    data: bookings = [],
    isLoading,
    isError,
    error,
  } = usePartnerBookingsQuery();
  const bulkUpdate = useBulkUpdateBookingStatusMutation();
  const headingId = useId();
  const descriptionId = useId();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const activeBookings = useMemo(
    () =>
      bookings.filter((booking) => ACTIVE_BOOKING_STATUSES.has(booking.status)),
    [bookings],
  );

  const sortedBookings = useMemo(
    () =>
      [...activeBookings].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [activeBookings],
  );

  const filteredBookings = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();
    if (!normalizedQuery) {
      return sortedBookings;
    }

    return sortedBookings.filter((booking) => {
      const handle = booking.customerHandle ? `@${booking.customerHandle}` : "";
      const fullName = booking.customerName ?? "";
      const searchable = [
        booking.areaName,
        booking.spaceName,
        booking.customerAuthId,
        handle,
        fullName,
        booking.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [searchTerm, sortedBookings]);

  useEffect(() => {
    setSelectedIds((current) => {
      const validIds = new Set(
        Array.from(current).filter((id) =>
          sortedBookings.some((booking) => booking.id === id),
        ),
      );
      return validIds.size === current.size ? current : validIds;
    });
  }, [sortedBookings]);

  const areaBookingCounts = useMemo(() => {
    const counts = new Map<string, number>();
    sortedBookings.forEach((booking) => {
      counts.set(booking.areaId, (counts.get(booking.areaId) ?? 0) + 1);
    });
    return counts;
  }, [sortedBookings]);

  const activeCount = sortedBookings.length;
  const visibleSelectedCount = filteredBookings.filter((booking) =>
    selectedIds.has(booking.id),
  ).length;
  const allVisibleSelected =
    filteredBookings.length > 0 &&
    visibleSelectedCount === filteredBookings.length;
  const selectionState: boolean | "indeterminate" = allVisibleSelected
    ? true
    : visibleSelectedCount > 0
      ? "indeterminate"
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

  const handleBulkStatusChange = (status: BookingStatus) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) {
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
      },
    );
  };

  const renderCapacity = (booking: (typeof bookings)[number]) => {
    const used = areaBookingCounts.get(booking.areaId) ?? 0;
    const maxCap = booking.areaMaxCapacity ?? null;
    const remaining =
      typeof maxCap === "number" ? Math.max(maxCap - used, 0) : null;
    const status =
      maxCap === null ? "unbounded" : remaining === 0 ? "full" : "available";

    return {
      used,
      maxCap,
      remaining,
      status,
      label:
        maxCap === null
          ? `${used} booking${used === 1 ? "" : "s"}`
          : `${used}/${maxCap}`,
      helper:
        maxCap === null
          ? "No capacity set"
          : remaining === 0
            ? "At capacity"
            : `${remaining} slot${remaining === 1 ? "" : "s"} remaining`,
    };
  };

  const renderBody = () => {
    if (isLoading) {
      return (
        <TableBody>
          {Array.from({ length: 4 }).map((_, index) => (
            <TableRow key={`skeleton-${index}`}>
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
          ))}
        </TableBody>
      );
    }

    if (isError) {
      return (
        <TableBody>
          <TableRow>
            <TableCell colSpan={8} className="text-sm text-destructive">
              {error instanceof Error
                ? error.message
                : "Unable to load bookings."}
            </TableCell>
          </TableRow>
        </TableBody>
      );
    }

    if (!bookings.length) {
      return (
        <TableBody>
          <TableRow>
            <TableCell colSpan={8}>
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
            <TableCell colSpan={8}>
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
            <TableCell colSpan={8}>
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
        {filteredBookings.map((booking) => {
          const capacity = renderCapacity(booking);
          const priceLabel =
            typeof booking.price === "number"
              ? bookingPriceFormatter.format(booking.price)
              : "—";
          const isSelected = selectedIds.has(booking.id);
          const userDisplayName = booking.customerName ?? "Guest";
          const userHandle =
            booking.customerHandle ?? booking.customerAuthId.slice(0, 8);

          return (
            <TableRow
              key={booking.id}
              data-state={isSelected ? "selected" : undefined}
            >
              <TableCell>
                <Checkbox
                  aria-label={`Select booking for ${booking.areaName}`}
                  checked={isSelected}
                  onCheckedChange={(checked) =>
                    handleSelectOne(booking.id, Boolean(checked))
                  }
                />
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-foreground">
                    {userDisplayName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {userHandle.startsWith("@") ? userHandle : `@${userHandle}`}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <Link
                    href={`/marketplace/${booking.spaceId}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-foreground hover:text-primary"
                  >
                    {booking.spaceName}
                    <FiArrowUpRight className="size-4" aria-hidden="true" />
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {booking.areaName}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Badge variant={statusVariantMap[booking.status]}>
                    {booking.status}
                  </Badge>
                  {!["cancelled", "rejected", "expired", "noshow"].includes(
                    booking.status,
                  ) ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        bulkUpdate.mutate({
                          ids: [booking.id],
                          status: "cancelled",
                        })
                      }
                      disabled={bulkUpdate.isPending}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                {booking.bookingHours} hr{booking.bookingHours === 1 ? "" : "s"}
              </TableCell>
              <TableCell>{priceLabel}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">
                    {capacity.label}
                  </span>
                  <span
                    className={cn(
                      "text-xs",
                      capacity.status === "full"
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {capacity.helper}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm text-foreground">
                  {bookingDateFormatter.format(new Date(booking.createdAt))}
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    );
  };

  return (
    <div className="space-y-6 px-4 pb-10 sm:px-6 lg:px-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground mt-8">
            Bookings
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitor who is currently booked and track how each area is filling
            up.
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">
          {activeCount} active
        </Badge>
      </div>

      <section
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
        className="space-y-4"
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2
              id={headingId}
              className="text-lg font-semibold text-foreground"
            >
              Area capacity overview
            </h2>
            <p id={descriptionId} className="text-sm text-muted-foreground">
              Live bookings with per-area capacity signals, search, and bulk
              edits.
            </p>
          </div>
          <Button
            type="button"
            asChild
            variant="outline"
            size="sm"
            className="gap-2"
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
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by user, space, area, or status"
                  aria-label="Search booked users"
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Filter the table and quickly locate people currently booked into
                your areas.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {filteredBookings.length} visible
              </Badge>
              <Badge
                variant={selectedIds.size ? "default" : "secondary"}
                className="text-xs"
              >
                {selectedIds.size} selected
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={selectedIds.size === 0 || bulkUpdate.isPending}
                  >
                    {bulkUpdate.isPending ? (
                      <>
                        <FiLoader
                          className="size-4 animate-spin"
                          aria-hidden="true"
                        />
                        Applying...
                      </>
                    ) : (
                      "Bulk edit"
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Change status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {BULK_STATUS_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.status}
                      onSelect={() => handleBulkStatusChange(option.status)}
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {selectedIds.size > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="text-muted-foreground"
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </div>

          {bulkUpdate.isError ? (
            <p className="text-xs text-destructive">
              {bulkUpdate.error instanceof Error
                ? bulkUpdate.error.message
                : "Unable to update bookings."}
            </p>
          ) : bulkUpdate.isSuccess ? (
            <p className="text-xs text-muted-foreground">
              Status updated for selected bookings.
            </p>
          ) : null}

          <Table aria-labelledby={headingId} aria-describedby={descriptionId}>
            <TableCaption className="sr-only">
              Area capacity overview data table with active bookings, search,
              and bulk actions
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Select all visible bookings"
                    checked={selectionState}
                    onCheckedChange={(checked) =>
                      handleSelectAll(Boolean(checked))
                    }
                  />
                </TableHead>
                <TableHead>User</TableHead>
                <TableHead>Space / Area</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Booked at</TableHead>
              </TableRow>
            </TableHeader>
            {renderBody()}
          </Table>
        </div>
      </section>
    </div>
  );
}
