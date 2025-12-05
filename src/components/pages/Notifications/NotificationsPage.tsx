'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import {
  FiBell,
  FiCheck,
  FiClock,
  FiInbox,
  FiLoader
} from 'react-icons/fi';

import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotificationsQuery } from '@/hooks/api/useNotifications';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const notificationDateFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function NotificationsPage() {
  const {
    data: notifications = [],
    isLoading,
    isError,
    error,
  } = useNotificationsQuery();
  const markNotificationRead = useMarkNotificationRead();
  const markAllNotificationsRead = useMarkAllNotificationsRead();

  const sortedNotifications = useMemo(
    () =>
      [...notifications].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [notifications]
  );
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  const handleClick = (notificationId: string, isRead: boolean) => {
    markNotificationRead.mutate({
      notificationId,
      read: isRead,
    });
  };

  const handleMarkAllRead = () => {
    markAllNotificationsRead.mutate();
  };
  const hasUnread = unreadCount > 0;
  const isMarkingAll = markAllNotificationsRead.isPending;

  return (
    <div className="space-y-6 px-4 pb-10 sm:px-6 lg:px-10">
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
            onClick={ handleMarkAllRead }
            disabled={ !hasUnread || isMarkingAll || isLoading }
            aria-disabled={ !hasUnread || isMarkingAll || isLoading }
          >
            { isMarkingAll ? (
              <FiLoader className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FiCheck className="mr-2 size-4" aria-hidden="true" />
            ) }
            <span className="text-xs font-medium">Mark all as read</span>
          </Button>
          <Badge variant="secondary" className="text-xs">
            { unreadCount } unread
          </Badge>
        </div>
      </div>

      <div className="space-y-3">
        { isLoading ? (
          <div className="space-y-2">
            { Array.from({ length: 4, }).map((_, index) => (
              <Skeleton key={ `notification-skeleton-${index}` } className="h-14 w-full rounded-2xl" />
            )) }
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <FiBell className="size-4" aria-hidden="true" />
            <span>{ error instanceof Error ? error.message : 'Failed to load notifications.' }</span>
          </div>
        ) : sortedNotifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
            <FiInbox className="size-5" aria-hidden="true" />
            <p>No notifications yet. Confirmed bookings will appear here.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            { sortedNotifications.map((notification) => (
              <li key={ notification.id }>
                <Link
                  href={ notification.href }
                  onClick={ () => handleClick(notification.id, true) }
                  className={ cn(
                    'flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 transition-colors hover:border-primary',
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
                  { notification.read ? null : (
                    <Badge variant="default" className="mt-1 text-[10px] uppercase tracking-wide">
                      New
                    </Badge>
                  ) }
                </Link>
              </li>
            )) }
          </ul>
        ) }
      </div>
    </div>
  );
}
