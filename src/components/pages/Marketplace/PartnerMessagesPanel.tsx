'use client';

import {
  FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { FiSend } from 'react-icons/fi';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useChatMessages, usePartnerChatRooms, useSendChatMessage } from '@/hooks/api/useChat';
import { useChatRoomsSubscription, useChatSubscription } from '@/hooks/use-chat-subscription';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types/chat';

function PartnerChatsListSkeleton() {
  return (
    <div className="space-y-3 py-4 px-2">
      <Skeleton className="h-12 w-full rounded-2xl" />
      <Skeleton className="h-12 w-full rounded-2xl" />
      <Skeleton className="h-12 w-3/4 rounded-2xl" />
    </div>
  );
}

function PartnerConversationLoadingSkeleton() {
  return (
    <div className="space-y-3 px-4 py-6">
      <Skeleton className="h-4 w-32 rounded-full" />
      <div className="space-y-3">
        <Skeleton className="h-12 rounded-2xl" />
        <Skeleton className="h-12 rounded-2xl" />
        <Skeleton className="h-12 rounded-2xl" />
      </div>
    </div>
  );
}

export function PartnerMessagesPanel() {
  const {
    data: rooms,
    isLoading: roomsLoading,
    error: roomsError,
  } = usePartnerChatRooms();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const activeRoom = useMemo(() => {
    if (!rooms?.length) {
      return null;
    }
    const match = rooms.find((room) => room.id === selectedRoomId);
    return match ?? rooms[0];
  }, [rooms, selectedRoomId]);
  const currentRoomId = activeRoom?.id ?? null;
  const {
    data: messageRows,
    isPending: messagesLoading,
  } = useChatMessages(currentRoomId);
  const [realtimeMessagesByRoom, setRealtimeMessagesByRoom] = useState<Record<string, ChatMessage[]>>({});
  const sendMessage = useSendChatMessage();
  const [draft, setDraft] = useState('');
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  const customerLabel = activeRoom?.customerName ?? activeRoom?.customerHandle ?? 'Customer';
  const partnerId = activeRoom?.partnerId ?? null;

  const normalizeMessage = useCallback(
    (message: ChatMessage) => {
      const isLocalSender = Boolean(partnerId && message.senderId === partnerId);
      const fallbackName = message.senderRole === 'customer' ? customerLabel : 'You';
      const senderName = isLocalSender ? 'You' : message.senderName ?? fallbackName;
      return {
        ...message,
        senderName,
      };
    },
    [customerLabel, partnerId]
  );
  const normalizedMessageRows = useMemo(
    () => (messageRows ?? []).map(normalizeMessage),
    [messageRows, normalizeMessage]
  );
  const realtimeMessages = useMemo(
    () => (currentRoomId ? realtimeMessagesByRoom[currentRoomId] ?? [] : []),
    [currentRoomId, realtimeMessagesByRoom]
  );
  const messages = useMemo(() => {
    if (!realtimeMessages.length) {
      return normalizedMessageRows;
    }
    const existingIds = new Set(normalizedMessageRows.map((message) => message.id));
    return [
      ...normalizedMessageRows,
      ...realtimeMessages.filter((message) => !existingIds.has(message.id))
    ];
  }, [normalizedMessageRows, realtimeMessages]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', });
  }, [messages.length]);

  const appendMessage = useCallback(
    (message: ChatMessage) => {
      const normalizedMessage = normalizeMessage(message);
      setRealtimeMessagesByRoom((previous) => {
        const roomMessages = previous[normalizedMessage.roomId] ?? [];
        if (roomMessages.some((entry) => entry.id === normalizedMessage.id)) {
          return previous;
        }
        return {
          ...previous,
          [normalizedMessage.roomId]: [...roomMessages, normalizedMessage],
        };
      });
    },
    [normalizeMessage]
  );

  useChatSubscription(currentRoomId, appendMessage);
  useChatRoomsSubscription(rooms?.map((room) => room.id) ?? []);

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentRoomId) {
      return;
    }
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }

    try {
      const result = await sendMessage.mutateAsync({
        roomId: currentRoomId,
        content: trimmed,
      });
      appendMessage(result.message);
      setDraft('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to send message.');
    }
  };

  const formatTimestamp = (value?: string) =>
    value
      ? new Date(value).toLocaleString([], {
          hour: 'numeric',
          minute: '2-digit',
        })
      : '';

  let messagesContent: ReactNode;
  if (!activeRoom) {
    messagesContent = roomsLoading
      ? <PartnerConversationLoadingSkeleton />
      : <p className="text-sm text-muted-foreground">Select a conversation to start replying.</p>;
  } else if (messagesLoading && messages.length === 0) {
    messagesContent = <PartnerConversationLoadingSkeleton />;
  } else if (messages.length === 0) {
    messagesContent = (
      <p className="text-sm text-muted-foreground">
        No messages yet for this conversation. Once a customer replies, the thread will appear here.
      </p>
    );
  } else {
    messagesContent = (
      <ScrollArea className="h-full min-h-0 rounded-2xl border border-border/60 bg-background/80">
        <div className="space-y-3 px-4 py-3">
          { messages.map((message) => {
            const isCustomerMessage = message.senderRole === 'customer';
            const alignClass = isCustomerMessage ? 'justify-start' : 'justify-end';
            const bubbleClass = isCustomerMessage
              ? 'rounded-2xl rounded-br-none border border-border/50 bg-muted text-foreground'
              : 'rounded-2xl rounded-bl-none bg-primary text-primary-foreground';
            const timestamp = formatTimestamp(message.createdAt);

            return (
              <div key={ message.id } className={ `flex ${alignClass}` }>
                <div className="max-w-full sm:max-w-[520px] space-y-1 rounded-2xl px-4 py-3 text-sm shadow">
                  <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>{ message.senderName ?? (isCustomerMessage ? 'Customer' : 'You') }</span>
                    <span>{ timestamp }</span>
                  </div>
                  <p className={ `whitespace-pre-line break-all ${bubbleClass} px-0 py-0 font-medium` }>
                    { message.content }
                  </p>
                </div>
              </div>
            );
          }) }
          <div ref={ scrollAnchorRef } />
        </div>
      </ScrollArea>
    );
  }

  let conversationsContent: ReactNode;
  if (roomsLoading) {
    conversationsContent = (
      <div className="flex flex-1 items-center justify-center">
        <PartnerChatsListSkeleton />
      </div>
    );
  } else if (roomsError) {
    conversationsContent = <p className="text-sm text-destructive">Unable to load conversations.</p>;
  } else if (!rooms?.length) {
    conversationsContent = (
      <p className="text-sm text-muted-foreground">
        No conversations yet. Customers will appear here once they message a space.
      </p>
    );
  } else {
    conversationsContent = (
      <ScrollArea className="h-[40vh] min-h-[32vh] sm:h-full sm:min-h-0 rounded-2xl border border-border/60 bg-background/60">
        <div className="space-y-2 p-3">
          { rooms.map((room) => {
            const isActive = room.id === activeRoom?.id;
            const lastMessageSnippet = room.lastMessage?.content ?? 'No messages yet.';
            const lastMessageTime = formatTimestamp(room.lastMessage?.createdAt);
            const initials =
              (room.customerName ?? room.customerHandle ?? 'Customer')
                .split(' ')
                .filter((part) => part.length > 0)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase())
                .join('') || 'CU';

            return (
              <button
                key={ room.id }
                type="button"
                onClick={ () => setSelectedRoomId(room.id) }
                aria-current={ isActive ? 'true' : undefined }
                className={ cn(
                  'w-full rounded-2xl border p-3 text-left transition',
                  isActive
                    ? 'border-primary bg-primary/10'
                    : 'border-border/30 bg-background hover:border-border'
                ) }
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-border/60">
                      { room.customerAvatarUrl ? (
                        <AvatarImage src={ room.customerAvatarUrl } alt={ room.customerName ?? room.customerHandle ?? 'Customer avatar' } />
                      ) : null }
                      <AvatarFallback>{ initials }</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        { room.customerName ?? room.customerHandle ?? 'Customer' }
                      </p>
                      <p className="text-xs text-muted-foreground">
                        { room.spaceName }
                        { room.spaceCity || room.spaceRegion
                          ? ` · ${room.spaceCity ?? ''}${room.spaceCity && room.spaceRegion ? ', ' : ''}${room.spaceRegion ?? ''}`
                          : '' }
                      </p>
                    </div>
                  </div>
                  { lastMessageTime ? (
                    <span className="text-[11px] text-muted-foreground">{ lastMessageTime }</span>
                  ) : null }
                </div>
                <p className="mt-2 text-[12px] text-muted-foreground line-clamp-2">
                  { lastMessageSnippet }
                </p>
              </button>
            );
          }) }
        </div>
      </ScrollArea>
    );
  }

  return (
    <section className="space-y-6 py-6 min-h-screen">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Messages</h1>
          <Badge variant="secondary">Realtime</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Reply to customers for every listed space. Messages sync instantly via Supabase Realtime.
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[320px,minmax(0,1fr)] grid-rows-[auto,1fr] h-auto lg:h-[calc(100vh-7rem)] lg:overflow-hidden">
        <Card className="flex min-h-0 flex-col lg:h-full">
          <CardHeader>
            <CardTitle className="text-base">Conversations</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Select a customer to view the message thread.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-hidden">{ conversationsContent }</CardContent>
        </Card>
        <Card className="flex min-h-0 flex-col lg:h-full">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Conversation</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Send updates, answer questions, and confirm details.
                </CardDescription>
              </div>
              <Badge variant="outline">Live</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
            <div className="flex-1 min-h-0">
              { messagesContent }
            </div>
          { activeRoom ? (
            <form className="space-y-3 mt-auto" onSubmit={ handleSend } noValidate>
              <Textarea
                value={ draft }
                  onChange={ (event) => setDraft(event.target.value) }
                  placeholder="Reply to the customer…"
                  aria-label="Reply to conversation"
                  rows={ 3 }
                  disabled={ sendMessage.isPending }
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={ sendMessage.isPending || !draft.trim() }
                    className="inline-flex items-center gap-2"
                  >
                    <FiSend className="size-4" aria-hidden="true" />
                    <span>{ sendMessage.isPending ? 'Sending…' : 'Send reply' }</span>
                  </Button>
                </div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground mt-auto">
              Start by selecting a conversation from the list.
            </p>
          ) }
        </CardContent>
        </Card>
      </div>
    </section>
  );
}
