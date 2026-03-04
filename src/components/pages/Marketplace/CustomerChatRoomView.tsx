'use client';

import Link from 'next/link';
import {
  KeyboardEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { FiArrowLeft, FiSend } from 'react-icons/fi';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCustomerChatRooms, useChatMessages, useSendChatMessage } from '@/hooks/api/useChat';
import { useChatRoomsSubscription, useChatSubscription } from '@/hooks/use-chat-subscription';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { CHAT_MESSAGE_MAX_LENGTH } from '@/lib/validations/chat';
import type { ChatMessage } from '@/types/chat';
import { ChatReportDialog } from '@/components/pages/Marketplace/ChatReportDialog';

type CustomerChatRoomViewProps = {
  roomId?: string;
};

function CustomerChatsListSkeleton() {
  return (
    <div className="space-y-1 py-1">
      { Array.from({ length: 6, }).map((_, index) => (
        <div
          key={ `chat-skeleton-${index}` }
          className="flex w-full items-center gap-3 rounded-md px-3 py-2"
        >
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-24 rounded-full" />
              <Skeleton className="h-3 w-12 rounded-full" />
            </div>
            <Skeleton className="h-3 w-full rounded-full" />
          </div>
        </div>
      )) }
    </div>
  );
}

function CustomerConversationLoadingSkeleton() {
  return (
    <div className="flex h-full min-h-full flex-col justify-center space-y-3 px-4 py-6">
      <Skeleton className="h-4 w-32 rounded-full" />
      <div className="space-y-3">
        <Skeleton className="h-12 rounded-2xl" />
        <Skeleton className="h-12 rounded-2xl" />
        <Skeleton className="h-12 rounded-2xl" />
      </div>
    </div>
  );
}

function CustomerConversationPlaceholder({ children, }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-full flex-col items-center justify-center px-4 py-6 text-center">
      { children }
    </div>
  );
}

export function CustomerChatRoomView({ roomId, }: CustomerChatRoomViewProps) {
  const maxMessageLength = CHAT_MESSAGE_MAX_LENGTH;
  const {
    data: rooms,
    isLoading: roomsLoading,
    error: roomsError,
  } = useCustomerChatRooms();
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
  const prevRoomIdRef = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const maxDraftHeight = 96; // px, matches Tailwind max-h-24
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const currentRoomId = activeRoom?.id ?? null;

  useEffect(() => {
    if (prevRoomIdRef.current !== null && prevRoomIdRef.current !== currentRoomId) {
      setDraft('');
      if (draftRef.current) {
        draftRef.current.style.height = '';
      }
    }
    prevRoomIdRef.current = currentRoomId;
  }, [currentRoomId]);

  const hostLabel = activeRoom?.partnerName ?? 'Host';
  const headerDisplayName = activeRoom?.spaceName ?? activeRoom?.partnerName ?? 'Conversation';
  const headerAvatarInitials = (
    (activeRoom?.spaceName ?? activeRoom?.partnerName ?? 'UpSpace')
      .split(' ')
      .filter((part) => part.length > 0)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('')
  ) || 'SP';
  const headerAvatarUrl = activeRoom?.spaceHeroImageUrl ?? activeRoom?.partnerAvatarUrl ?? null;

  const normalizeMessage = useCallback(
    (message: ChatMessage) => {
      const isCustomerMessage = message.senderRole === 'customer';
      const fallbackName = isCustomerMessage ? 'You' : hostLabel;
      const senderName = isCustomerMessage ? 'You' : message.senderName ?? fallbackName;
      return {
        ...message,
        senderName,
      };
    },
    [hostLabel]
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

  const otherRoomIds = useMemo(
    () => (rooms ?? []).map((room) => room.id).filter((id) => id !== currentRoomId),
    [rooms, currentRoomId]
  );

  useChatSubscription(currentRoomId, appendMessage);
  useChatRoomsSubscription(otherRoomIds);

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

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeRoom?.id) {
      return;
    }
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }
    if (trimmed.length > maxMessageLength) {
      toast.error(`Message must be ${maxMessageLength} characters or fewer.`);
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
      formRef.current?.requestSubmit();
    }
  };

  const formatTimestamp = (value?: string) =>
    value
      ? new Date(value).toLocaleString([], {
          hour: 'numeric',
          minute: '2-digit',
        })
      : '';

  const isMobile = useIsMobile();
  const [showThread, setShowThread] = useState(!isMobile);
  const [stayOnList, setStayOnList] = useState(false);

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
        room.spaceName,
        room.partnerName ?? '',
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
      <ScrollArea className="flex-1 h-full min-h-0">
        <CustomerChatsListSkeleton />
      </ScrollArea>
    );
  } else if (roomsError) {
    listContent = <p className="text-sm text-destructive">Unable to load conversations.</p>;
  } else if (!filteredRooms.length) {
    listContent = (
      <div className="p-4 text-center">
        <p className="text-sm text-muted-foreground">
          { rooms && rooms.length === 0 
            ? 'No conversations yet.' 
            : 'No conversations found.' }
        </p>
      </div>
    );
  } else {
    listContent = (
      <ScrollArea className="flex-1 h-full min-h-0">
        <div className="space-y-1 py-1">
          { filteredRooms.map((room) => {
            const lastMessageSnippet = room.lastMessage?.content ?? 'No messages yet.';
            const lastMessageTime = formatTimestamp(room.lastMessage?.createdAt);
            const isActive = room.id === activeRoom?.id;
            const hasNewMessage = room.lastMessage?.senderRole === 'partner';
            const initials = room.partnerName
              ? room.partnerName
                  .split(' ')
                  .filter((part) => part.length > 0)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join('')
              : room.spaceName
                  .split(' ')
                  .filter((part) => part.length > 0)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join('') || 'SP';

            const listAvatarUrl = room.spaceHeroImageUrl ?? room.partnerAvatarUrl;
            const showUnread = hasNewMessage && !isActive;

            return (
              <Link
                key={ room.id }
                href={ `/customer/messages/${room.id}` }
                aria-current={ isActive ? 'true' : undefined }
                className={ cn(
                  'relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition',
                  isActive
                    ? 'bg-card text-foreground dark:bg-muted'
                    : 'hover:bg-muted/70'
                ) }
                onClick={ handleConversationClick }
              >
                <Avatar className="h-10 w-10 border border-border/60">
                  { listAvatarUrl ? (
                    <AvatarImage src={ listAvatarUrl } alt={ room.spaceName ?? 'Space avatar' } />
                  ) : null }
                  <AvatarFallback className="text-white">{ initials }</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">
                      { room.spaceName }
                    </p>
                    { lastMessageTime ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        { lastMessageTime }
                      </span>
                    ) : null }
                  </div>
                  { hasNewMessage && !isActive ? (
                    <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-destructive" aria-label="New message" />
                  ) : null }
                  <p
                    className={ cn(
                      'truncate text-xs text-muted-foreground',
                      hasNewMessage && !isActive && 'font-semibold text-foreground'
                    ) }
                  >
                    { lastMessageSnippet }
                  </p>
                </div>
                { showUnread ? (
                  <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-destructive" aria-hidden="true" />
                ) : null }
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
      messagesContent = <CustomerConversationLoadingSkeleton />;
    } else if (roomsError) {
      messagesContent = (
        <CustomerConversationPlaceholder>
          <p className="text-sm text-destructive">Unable to load conversation.</p>
        </CustomerConversationPlaceholder>
      );
    } else if (rooms && rooms.length === 0) {
      messagesContent = (
        <div className="flex h-full min-h-full w-full flex-col items-center justify-center p-8 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-6">
            <svg
              className="h-10 w-10 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={ 2 }
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-2">
            No conversations yet
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mb-6">
            Start a chat from any space listing to keep the conversation going.
            Once someone replies, your inbox will show up here.
          </p>
          <Button asChild size="lg" className="text-white bg-primary hover:bg-primary/90 font-medium rounded-xl">
            <Link href="/marketplace">
              Browse spaces
            </Link>
          </Button>
        </div>
      );
    } else {
      messagesContent = (
        <CustomerConversationPlaceholder>
          <p className="text-sm text-muted-foreground">
            Select a chat from your inbox.
          </p>
        </CustomerConversationPlaceholder>
      );
    }
  } else if (messagesLoading && messages.length === 0) {
    messagesContent = <CustomerConversationLoadingSkeleton />;
  } else if (messages.length === 0) {
    messagesContent = (
      <CustomerConversationPlaceholder>
        <p className="text-sm text-muted-foreground">
          No messages yet in this conversation. Send a quick note to get things moving.
        </p>
      </CustomerConversationPlaceholder>
    );
  } else {
    messagesContent = (
      <div className="flex w-full flex-col gap-3 px-5 py-4 text-sm text-muted-foreground">
        { messages.map((message) => {
          const isCustomerMessage = message.senderRole === 'customer';
          const messageStackClass = isCustomerMessage ? 'self-end items-end' : 'self-start items-start';
          const bubbleClass = isCustomerMessage
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground';
          const timestamp = formatTimestamp(message.createdAt);

          return (
            <div
              key={ message.id }
              className={ cn(
                'flex w-fit max-w-full min-w-0 flex-col space-y-1 sm:max-w-[520px]',
                messageStackClass
              ) }
            >
              <div
                className={ cn('inline-block max-w-full min-w-0 rounded-[20px] px-4 py-2.5 text-[15px]', bubbleClass) }
              >
                <p
                  className={ cn(
                    'block whitespace-pre-wrap break-all text-foreground',
                    isCustomerMessage && 'text-white font-medium'
                  ) }
                >
                    { message.content }
                </p>
              </div>
              <p
                className={ cn(
                  'text-xs text-muted-foreground leading-tight',
                  isCustomerMessage ? 'text-right' : 'text-left'
                ) }
              >
                { timestamp }
              </p>
            </div>
          );
        }) }
        <div ref={ scrollAnchorRef } />
      </div>
    );
  }

  const showListPane = !isMobile || !showThread;
  const showThreadPane = !isMobile || showThread;

  return (
    <section className="flex h-full min-h-0 w-full flex-1 gap-0 overflow-hidden p-0">
      { /* Left sidebar: conversations */ }
      <aside
        className={ cn(
          'h-full min-h-0 flex-col gap-3 max-h-[100dvh] overflow-hidden',
          showListPane ? 'flex w-full bg-card p-4' : 'hidden',
          !isMobile && 'w-[400px]'
        ) }
      >
        { showListPane && (
          <>
            <div className="space-y-2">
              <span className="text-xl font-semibold tracking-tight text-foreground pb-1">
                Chats
              </span>
              <Input
                value={ searchValue }
                onChange={ (event) => setSearchValue(event.target.value) }
                placeholder="Search conversations"
                aria-label="Search conversations"
                className="mt-3 h-10 rounded-lg border-2 border-border/80 bg-background px-3 py-2 text-sm font-normal text-foreground shadow-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary focus-visible:ring-0"
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
            ? 'flex bg-card md:border-l-2 md:border-border/60'
            : 'hidden'
        ) }
      >
        <div className="flex min-h-0 flex-1 flex-col h-full overflow-hidden">
          { rooms && rooms.length > 0 ? (
            <header className="sticky top-0 z-10 flex items-center justify-between border-b px-6 py-4">
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
                  <Avatar className="h-11 w-11 border border-border/60 bg-card">
                    { headerAvatarUrl ? (
                      <AvatarImage src={ headerAvatarUrl } alt={ activeRoom?.spaceName ?? 'Space avatar' } />
                    ) : null }
                    <AvatarFallback className="text-white">{ headerAvatarInitials }</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-2xl font-semibold tracking-tight text-foreground">
                      { headerDisplayName }
                    </span>
                  </div>
                </div>
              </div>
              <ChatReportDialog
                roomId={ activeRoom?.id ?? null }
                targetLabel="host"
              />
            </header>
          ) : null }

          <div className="flex min-h-0 flex-1 flex-col h-full overflow-hidden">
            <ScrollArea className="flex-1 h-full min-h-0">
              { messagesContent }
            </ScrollArea>
            { activeRoom ? (
              <form
                ref={ formRef }
                className="sticky bottom-[calc(var(--safe-area-bottom)+3.25rem)] z-10 border-t px-4 py-4 md:bottom-0 bg-sidebar dark:bg-card"
                onSubmit={ handleSend }
                noValidate
              >
                <div className="flex max-w-full items-end gap-3 rounded-sm border bg-background p-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                  <Textarea
                    ref={ draftRef }
                    value={ draft }
                    onChange={ (event) => setDraft(event.target.value) }
                    placeholder="Type your message…"
                    aria-label="Message the host"
                    rows={ 1 }
                    maxLength={ maxMessageLength }
                    className="min-h-[40px] max-h-24 flex-1 min-w-0 resize-none overflow-y-auto text-[15px] border-0 focus-visible:ring-0 shadow-none bg-transparent"
                    disabled={ sendMessage.isPending }
                    onKeyDown={ handleDraftKeyDown }
                  />
                  <Button
                    type="submit"
                    disabled={ sendMessage.isPending || !draft.trim() }
                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-sm px-4"
                  >
                    <FiSend className="size-4" aria-hidden="true" />
                    <span className="sr-only sm:not-sr-only sm:ml-2">Send</span>
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
