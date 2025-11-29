'use client';

import Link from 'next/link';
import { FiMessageSquare } from 'react-icons/fi';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePartnerChatRooms } from '@/hooks/api/useChat';
import { useChatRoomsSubscription } from '@/hooks/use-chat-subscription';
import { cn } from '@/lib/utils';

export function PartnerMessagesList() {
  const {
    data: rooms,
    isLoading: roomsLoading,
    error: roomsError,
  } = usePartnerChatRooms();

  useChatRoomsSubscription(rooms?.map((room) => room.id) ?? []);

  const renderConversations = () => {
    if (roomsLoading) {
      return <p className="text-sm text-muted-foreground">Loading conversations…</p>;
    }

    if (roomsError) {
      return <p className="text-sm text-destructive">Unable to load conversations.</p>;
    }

    if (!rooms?.length) {
      return (
        <p className="text-sm text-muted-foreground">
          No conversations yet. Customers will appear here once they message a space.
        </p>
      );
    }

    return (
      <ScrollArea className="h-[32rem] rounded-2xl border border-border/60 bg-background/60">
        <div className="space-y-2 p-3">
          { rooms.map((room) => {
            const lastMessageSnippet = room.lastMessage?.content ?? 'No messages yet.';
            const lastMessageTime = room.lastMessage?.createdAt
              ? new Date(room.lastMessage.createdAt).toLocaleString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : '';

            return (
              <Link
                key={ room.id }
                href={ `/spaces/messages/${room.id}` }
                className={ cn(
                  'block w-full rounded-2xl border p-3 text-left transition hover:border-primary/70 hover:bg-primary/5'
                ) }
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <FiMessageSquare className="size-4" aria-hidden="true" />
                      { room.customerName ?? room.customerHandle ?? 'Customer' }
                    </p>
                    <p className="text-xs text-muted-foreground">
                      { room.spaceName }
                      { room.spaceCity || room.spaceRegion
                        ? ` · ${room.spaceCity ?? ''}${room.spaceCity && room.spaceRegion ? ', ' : ''}${room.spaceRegion ?? ''}`
                        : '' }
                    </p>
                  </div>
                  { lastMessageTime ? (
                    <span className="text-[11px] text-muted-foreground">{ lastMessageTime }</span>
                  ) : null }
                </div>
                <p className="mt-2 text-[12px] text-muted-foreground line-clamp-2">
                  { lastMessageSnippet }
                </p>
              </Link>
            );
          }) }
        </div>
      </ScrollArea>
    );
  };

  return (
    <section className="space-y-6 py-6">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Messages</h1>
          <Badge variant="secondary">Realtime</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Pick a customer conversation to open a dedicated view and reply faster.
        </p>
      </header>
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base">Conversations</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Select a customer to view the message thread.
          </CardDescription>
        </CardHeader>
        <CardContent>{ renderConversations() }</CardContent>
      </Card>
    </section>
  );
}
