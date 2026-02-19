'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { FiArrowLeft, FiSend } from 'react-icons/fi';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { usePartnerChatRooms, useChatMessages, useSendChatMessage } from '@/hooks/api/useChat';
import { useChatRoomsSubscription, useChatSubscription } from '@/hooks/use-chat-subscription';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import type { ChatMessage } from '@/types/chat';

type PartnerChatRoomViewProps = {
  roomId: string;
};

function PartnerChatsListSkeleton() {
  const skeletonIds = ['room-skeleton-1', 'room-skeleton-2', 'room-skeleton-3'] as const;

  return (
    <div className="space-y-3 py-4 px-2">
      { skeletonIds.map((skeletonId) => (
        <div
          key={ skeletonId }
          className="flex items-start gap-3 rounded-2xl border border-border/40 bg-background/60 px-3 py-2"
        >
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3 w-32 rounded-full" />
              <Skeleton className="h-2 w-12 rounded-full" />
            </div>
            <Skeleton className="h-2 w-36 rounded-full" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        </div>
      )) }
    </div>
  );
}

function PartnerMessageBubbleSkeleton({ align, }: { align: 'start' | 'end' }) {
  return (
    <div className={ `flex ${align === 'end' ? 'justify-end' : 'justify-start'}` }>
      <div className="max-w-full sm:max-w-[520px] space-y-2">
        <Skeleton className="h-9 w-32 rounded-2xl" />
        <Skeleton className="h-3 w-24 rounded-full" />
      </div>
    </div>
  );
}

function PartnerConversationLoadingSkeleton() {
  return (
    <div className="flex h-full min-h-full flex-col">
      <div className="flex items-center gap-3 border-b px-3 py-3">
        <Skeleton className="h-11 w-11 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32 rounded-full" />
          <Skeleton className="h-3 w-48 rounded-full" />
        </div>
      </div>
      <div className="flex flex-1 flex-col overflow-hidden px-5 py-4">
        <div className="flex h-full flex-col justify-center gap-4">
          <PartnerMessageBubbleSkeleton align="start" />
          <PartnerMessageBubbleSkeleton align="end" />
          <PartnerMessageBubbleSkeleton align="start" />
          <PartnerMessageBubbleSkeleton align="end" />
        </div>
      </div>
      <div className="border-t px-3 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 flex-1 rounded-2xl" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function PartnerChatRoomView({ roomId, }: PartnerChatRoomViewProps) {
  const router = useRouter();
  const {
    data: rooms,
    isLoading: roomsLoading,
    error: roomsError,
  } = usePartnerChatRooms();
  const [searchValue, setSearchValue] = useState('');
  const activeRoom = useMemo(
    () => rooms?.find((room) => room.id === roomId) ?? null,
    [rooms, roomId]
  );
  const {
    data: messageRows,
    isPending: messagesLoading,
  } = useChatMessages(activeRoom?.id ?? null);
  const [realtimeMessagesByRoom, setRealtimeMessagesByRoom] = useState<Record<string, ChatMessage[]>>({});
  const sendMessage = useSendChatMessage();
  const [draft, setDraft] = useState('');
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const maxDraftHeight = 96; // px, matches Tailwind max-h-24
  const isMobile = useIsMobile();
  const [showThread, setShowThread] = useState(!isMobile);
  const [stayOnList, setStayOnList] = useState(false);
  const currentRoomId = activeRoom?.id ?? null;

  const customerLabel = activeRoom?.customerName ?? activeRoom?.customerHandle ?? 'Customer';

  const normalizeMessage = useCallback(
    (message: ChatMessage) => {
      const isPartnerMessage = message.senderRole === 'partner';
      const fallbackName = isPartnerMessage ? 'You' : customerLabel;
      const senderName = isPartnerMessage ? 'You' : message.senderName ?? fallbackName;
      return {
        ...message,
        senderName,
      };
    },
    [customerLabel]
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

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', });
  }, [messages.length]);

  const resizeDraft = useCallback(() => {
    const element = draftRef.current;
    if (!element) {
      return;
    }
    element.style.height = 'auto';
    const nextHeight = Math.min(element.scrollHeight, maxDraftHeight);
    element.style.height = `${nextHeight}px`;
  }, [maxDraftHeight]);

  useEffect(() => {
    const element = draftRef.current;
    if (!element) {
      return;
    }

    if (!draft) {
      element.style.height = '';
      return;
    }

    resizeDraft();
  }, [draft, resizeDraft]);

  useEffect(() => {
    setShowThread(!isMobile);
    if (!isMobile) {
      setStayOnList(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (isMobile && activeRoom && !stayOnList) {
      setShowThread(true);
    }
  }, [activeRoom, isMobile, stayOnList]);

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeRoom?.id) {
      return;
    }
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }

    try {
      const result = await sendMessage.mutateAsync({
        roomId: activeRoom.id,
        content: trimmed,
      });
      appendMessage(result.message);
      setDraft('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to send message.');
    }
  };

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
    }
  };

  const formatTimestamp = (value?: string) =>
    value
      ? new Date(value).toLocaleString([], {
          hour: 'numeric',
          minute: '2-digit',
        })
      : '';

  const normalizedQuery = searchValue.trim().toLowerCase();

  const sortedRooms = useMemo(() => {
    if (!rooms) {
      return [];
    }
    return [...rooms].sort((a, b) => {
      const aKey = a.lastMessage?.createdAt ?? a.createdAt;
      const bKey = b.lastMessage?.createdAt ?? b.createdAt;
      if (aKey === bKey) {
        return 0;
      }
      return aKey > bKey ? -1 : 1;
    });
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    if (!sortedRooms.length) {
      return [];
    }
    if (!normalizedQuery) {
      return sortedRooms;
    }
    return sortedRooms.filter((room) => {
      const haystack = [
        room.customerName ?? '',
        room.customerHandle ?? '',
        room.spaceName,
        room.spaceCity ?? '',
        room.spaceRegion ?? ''
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, sortedRooms]);

  let listContent: ReactNode;
  if (roomsLoading) {
    listContent = (
      <div className="flex flex-1 items-center justify-center">
        <PartnerChatsListSkeleton />
      </div>
    );
  } else if (roomsError) {
    listContent = <p className="text-sm text-destructive">Unable to load conversations.</p>;
  } else if (!filteredRooms.length) {
    listContent = (
      <p className="text-sm text-muted-foreground">
        No conversations yet. Customers will appear here once they message a space.
      </p>
    );
  } else {
    listContent = (
      <ScrollArea className="flex-1 h-full min-h-0">
        <div className="space-y-1 py-1">
          { filteredRooms.map((room) => {
            const lastMessageSnippet = room.lastMessage?.content ?? 'No messages yet.';
            const lastMessageTime = formatTimestamp(room.lastMessage?.createdAt);
            const isActive = room.id === activeRoom?.id;
            const hasNewMessage = room.lastMessage?.senderRole === 'customer';
            const location =
              room.spaceCity || room.spaceRegion
                ? [room.spaceCity, room.spaceRegion].filter(Boolean).join(', ')
                : null;
            const initials =
              (room.customerName ?? room.customerHandle ?? 'Customer')
                .split(' ')
                .filter((part) => part.length > 0)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase())
                .join('') || 'CU';

            return (
              <Link
                key={ room.id }
                href={ `/partner/messages/${room.id}` }
                aria-current={ isActive ? 'true' : undefined }
                className={ cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition',
                  isActive
                    ? 'bg-muted text-foreground'
                    : 'hover:bg-muted/70'
                ) }
                onClick={ handleConversationClick }
              >
                <Avatar className="h-10 w-10 border border-border/60">
                  { room.customerAvatarUrl ? (
                    <AvatarImage src={ room.customerAvatarUrl } alt={ room.customerName ?? room.customerHandle ?? 'Customer avatar' } />
                  ) : null }
                  <AvatarFallback>{ initials }</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">
                      { room.customerName ?? room.customerHandle ?? 'Customer' }
                    </p>
                    { lastMessageTime ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        { lastMessageTime }
                      </span>
                    ) : null }
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    { location ?? room.spaceName }
                  </p>
                  <p
                    className={ cn(
                      'truncate text-xs text-muted-foreground',
                      hasNewMessage && !isActive && 'font-semibold text-foreground'
                    ) }
                  >
                    { lastMessageSnippet }
                  </p>
                </div>
              </Link>
            );
          }) }
        </div>
      </ScrollArea>
    );
  }

  let messagesContent: ReactNode;
  if (!activeRoom) {
    if (roomsLoading) {
      messagesContent = <PartnerConversationLoadingSkeleton />;
    } else if (roomsError) {
      messagesContent = <p className="text-sm text-destructive">Unable to load conversation.</p>;
    } else {
      messagesContent = (
        <p className="text-sm text-muted-foreground">
          Conversation not found. Go back to messages and pick another thread.
        </p>
      );
    }
  } else if (messagesLoading && messages.length === 0) {
    messagesContent = <PartnerConversationLoadingSkeleton />;
  } else if (messages.length === 0) {
    messagesContent = (
      <p className="text-sm text-muted-foreground">
        No messages yet in this conversation. Send a quick reply to keep the thread active.
      </p>
    );
  } else {
    messagesContent = (
      <ScrollArea className="flex-1 h-full min-h-0 overflow-y-auto">
        <div className="space-y-3 px-5 py-4 text-sm text-muted-foreground">
          { messages.map((message) => {
            const isPartnerMessage = message.senderRole === 'partner';
            const alignClass = isPartnerMessage ? 'items-end justify-end' : 'items-start justify-start';
            const bubbleClass = isPartnerMessage
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground';
            const timestamp = formatTimestamp(message.createdAt);

            return (
              <div key={ message.id } className={ `flex ${alignClass}` }>
                <div className="max-w-full sm:max-w-[520px] space-y-1">
                  <div
                    className={ cn('inline-block rounded-2xl px-4 py-2 text-base shadow', bubbleClass) }
                  >
                    <p
                      className={ cn(
                        'whitespace-pre-line break-all font-semibold text-base',
                        isPartnerMessage && 'text-white'
                      ) }
                    >
                      { message.content }
                    </p>
                  </div>
                  <p
                    className={ cn(
                      'text-xs text-muted-foreground leading-tight',
                      isPartnerMessage ? 'text-right' : 'text-left'
                    ) }
                  >
                    { timestamp }
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

  const handleBackToList = useCallback(() => {
    if (isMobile) {
      setShowThread(false);
      setStayOnList(true);
    }
  }, [isMobile]);

  const handleConversationClick = useCallback(() => {
    if (isMobile) {
      setShowThread(true);
      setStayOnList(false);
    }
  }, [isMobile]);

  const showListPane = !isMobile || !showThread;
  const showThreadPane = !isMobile || showThread;
  const headerName = activeRoom
    ? (activeRoom.customerName ?? activeRoom.customerHandle ?? 'Customer')
    : 'Conversation';
  const headerAvatarInitials =
    (activeRoom?.customerName ?? activeRoom?.customerHandle ?? 'Customer')
      .split(' ')
      .filter((part) => part.length > 0)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'CU';

  return (
    <section className="flex h-full min-h-0 flex-1 w-full gap-3 overflow-hidden p-0 md:p-3">
      { /* Left sidebar: conversations */ }
      <aside
        className={ cn(
          'h-full min-h-0 flex-col gap-3 max-h-[100dvh] overflow-hidden',
          showListPane ? 'flex w-full rounded-2xl bg-card/80 p-3 shadow-sm md:border md:border-border/60' : 'hidden',
          !isMobile && 'w-[420px]'
        ) }
      >
        { showListPane && (
          <>
            <div className="space-y-1">
              <span className="text-xl font-semibold tracking-tight text-foreground pb-1">
                Chats
              </span>
              <Input
                value={ searchValue }
                onChange={ (event) => setSearchValue(event.target.value) }
                placeholder="Search conversations"
                aria-label="Search conversations"
                className="h-10 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-normal text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              { listContent }
            </div>
          </>
        ) }
      </aside>

      { /* Right pane: active thread */ }
      <div
        className={ cn(
          'flex min-w-0 min-h-0 flex-1 flex-col h-full',
          showThreadPane
            ? 'flex rounded-2xl md:border md:border-border/60'
            : 'hidden'
        ) }
      >
        <div className="flex min-h-0 flex-1 flex-col h-full rounded-2xl bg-card/80 shadow-sm overflow-hidden">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-card/80 px-3 py-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={ handleBackToList }
                className={ cn(
                  'inline-flex items-center text-xs text-muted-foreground hover:text-foreground md:hidden',
                  showThreadPane ? 'flex' : 'hidden'
                ) }
              >
                <FiArrowLeft className="size-4" aria-hidden="true" />
                <span className="sr-only">Back</span>
              </button>
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 border border-border/60">
                  { activeRoom?.customerAvatarUrl ? (
                    <AvatarImage
                      src={ activeRoom.customerAvatarUrl }
                      alt={ headerName }
                    />
                  ) : null }
                  <AvatarFallback>{ headerAvatarInitials }</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-2xl font-semibold tracking-tight text-foreground">
                    { headerName }
                  </span>
                  { !activeRoom ? (
                    <span className="text-sm text-muted-foreground/90">
                      Select a chat from your inbox.
                    </span>
                  ) : null }
                </div>
              </div>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col h-full overflow-hidden">
            { messagesContent }
            { activeRoom ? (
              <form
                className="sticky bottom-[calc(var(--safe-area-bottom)+3.25rem)] z-10 border-t bg-card/80 px-3 py-3 md:bottom-0"
                onSubmit={ handleSend }
                noValidate
              >
                <div className="flex max-w-full items-end gap-3">
                  <Textarea
                    ref={ draftRef }
                    value={ draft }
                    onChange={ (event) => setDraft(event.target.value) }
                    placeholder="Reply to the customer…"
                    aria-label="Reply to conversation"
                    rows={ 1 }
                    className="min-h-[40px] max-h-24 flex-1 min-w-0 resize-none overflow-y-auto text-sm leading-4"
                    disabled={ sendMessage.isPending }
                    onKeyDown={ handleDraftKeyDown }
                  />
                  <Button
                    type="submit"
                    disabled={ sendMessage.isPending || !draft.trim() }
                    className="inline-flex h-10 shrink-0 items-center gap-2 px-4"
                  >
                    <FiSend className="size-4" aria-hidden="true" />
                    <span>{ sendMessage.isPending ? 'Sending…' : 'Send' }</span>
                  </Button>
                </div>
              </form>
            ) : null }
          </div>
        </div>
      </div>
    </section>
  );
}
