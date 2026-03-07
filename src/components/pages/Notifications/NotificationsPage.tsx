'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  FiBell,
  FiCheck,
  FiClock,
  FiInbox,
  FiLoader,
  FiTrash2
} from 'react-icons/fi';
import { toast } from 'sonner';
import type { InfiniteData } from '@tanstack/react-query';

import { useSession } from '@/components/auth/SessionProvider';
import {
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationsQuery,
  type NotificationsPage as NotificationsPageData
} from '@/hooks/api/useNotifications';
import { useNotificationSubscription } from '@/hooks/use-notification-subscription';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const FILTER_OPTIONS = [
  {
 label: 'All',
value: undefined, 
},
  {
 label: 'Bookings',
value: 'booking_confirmed', 
},
  {
 label: 'System',
value: 'system', 
}
] as const;

type FilterValue = (typeof FILTER_OPTIONS)[number]['value'];

const notificationDateFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function NotificationsPage({ initialData, }: { initialData?: InfiniteData<NotificationsPageData, string | undefined> } = {}) {
  const { session, } = useSession();
  const [activeFilter, setActiveFilter] = useState<FilterValue>(undefined);

  useNotificationSubscription(session?.user?.id ?? null);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotificationsQuery({
 type: activeFilter,
initialData: !activeFilter ? initialData : undefined, 
});
  const markNotificationRead = useMarkNotificationRead();
  const markAllNotificationsRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();

  const notifications = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data]
  );

  const sortedNotifications = useMemo(
    () =>
      [...notifications].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [notifications]
  );
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const handleClick = (notificationId: string, isRead: boolean) => {
    markNotificationRead.mutate(
      {
        notificationId,
        read: isRead,
      },
      {
        onError: (mutationError) => {
          const message = mutationError instanceof Error
            ? mutationError.message
            : 'Unable to update notification.';
          toast.error(message);
        },
      }
    );
  };

  const handleDelete = (event: React.MouseEvent, notificationId: string) => {
    event.preventDefault();
    event.stopPropagation();
    deleteNotification.mutate(
      { notificationId, },
      {
        onError: (mutationError) => {
          const message = mutationError instanceof Error
            ? mutationError.message
            : 'Unable to delete notification.';
          toast.error(message);
        },
      }
    );
  };

  const handleMarkAllRead = () => {
    markAllNotificationsRead.mutate(undefined, {
      onError: (mutationError) => {
        const message = mutationError instanceof Error
          ? mutationError.message
          : 'Unable to mark all notifications read.';
        toast.error(message);
      },
    });
  };
  const hasUnread = unreadCount > 0;
  const isMarkingAll = markAllNotificationsRead.isPending;

  return (
    <div className="mt-6 space-y-6 px-4 pb-10 sm:mt-8 sm:px-6 lg:px-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/marketplace">Marketplace</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="text-sm font-medium">Notifications</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Booking updates and partner alerts appear here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="hover:text-white"
            onClick={ handleMarkAllRead }
            disabled={ !hasUnread || isMarkingAll || isLoading || isError }
            aria-disabled={ !hasUnread || isMarkingAll || isLoading || isError }
          >
            { isMarkingAll ? (
              <FiLoader className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FiCheck className="mr-2 size-4" aria-hidden="true" />
            ) }
            <span className="text-xs font-medium">Mark all as read</span>
          </Button>
        </div>
      </div>

      <div className="flex gap-2" role="tablist" aria-label="Filter notifications">
        { FILTER_OPTIONS.map((option) => (
          <Button
            key={ option.label }
            type="button"
            size="sm"
            variant={ activeFilter === option.value ? 'default' : 'outline' }
            role="tab"
            aria-selected={ activeFilter === option.value }
            onClick={ () => setActiveFilter(option.value) }
          >
            { option.label }
          </Button>
        )) }
      </div>

      <div className="space-y-3" aria-live="polite">
        { isLoading ? (
          <div className="space-y-2">
            { Array.from({ length: 4, }).map((_, index) => (
              <Skeleton key={ `notification-skeleton-${index}` } className="h-14 w-full rounded-md" />
            )) }
          </div>
        ) : isError ? (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <FiBell className="size-4" aria-hidden="true" />
            <span className="flex-1 min-w-[220px]">
              { error instanceof Error ? error.message : 'Failed to load notifications.' }
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={ () => { void refetch(); } }
            >
              Retry
            </Button>
          </div>
        ) : sortedNotifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
            <FiInbox className="size-5" aria-hidden="true" />
            <p>
              { activeFilter
                ? 'No notifications match this filter.'
                : 'No notifications yet. Confirmed bookings will appear here.' }
            </p>
          </div>
        ) : (
          <>
            <ul className="space-y-2">
              { sortedNotifications.map((notification) => (
                <li key={ notification.id }>
                  <Link
                    href={ notification.href }
                    onClick={ () => handleClick(notification.id, true) }
                    className={ cn(
                      'flex items-start justify-between gap-3 rounded-md border px-4 py-3 transition-colors hover:border-primary',
                      notification.read ? 'bg-muted/40 text-muted-foreground' : 'bg-background text-foreground'
                    ) }
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold leading-tight">{ notification.title }</p>
                      <p className="text-sm text-muted-foreground">{ notification.body }</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <FiClock className="size-3.5" aria-hidden="true" />
                        <span>{ notificationDateFormatter.format(new Date(notification.createdAt)) }</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      { notification.read ? null : (
                        <Badge variant="default" className="mt-1 text-[10px] uppercase tracking-wide dark:text-white">
                          New
                        </Badge>
                      ) }
                      <button
                        type="button"
                        onClick={ (event) => handleDelete(event, notification.id) }
                        className="mt-1 rounded-md p-1 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Delete notification"
                      >
                        <FiTrash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </Link>
                </li>
              )) }
            </ul>
            { hasNextPage && (
              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={ () => { void fetchNextPage(); } }
                  disabled={ isFetchingNextPage }
                >
                  { isFetchingNextPage ? (
                    <FiLoader className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  ) : null }
                  Load more
                </Button>
              </div>
            ) }
          </>
        ) }
      </div>
    </div>
  );
}
