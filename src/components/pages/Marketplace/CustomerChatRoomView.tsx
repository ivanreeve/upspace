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
import type { ChatMessage } from '@/types/chat';

type CustomerChatRoomViewProps = {
  roomId: string;
};

export function CustomerChatRoomView({ roomId, }: CustomerChatRoomViewProps) {
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const sendMessage = useSendChatMessage();
  const [draft, setDraft] = useState('');
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const maxDraftHeight = 96; // px, matches Tailwind max-h-24
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages([]);
  }, [activeRoom?.id]);

  const hostLabel = activeRoom?.partnerName ?? 'Host';
  const headerDisplayName = activeRoom?.spaceName ?? activeRoom?.partnerName ?? 'Conversation';
  const headerLocationLabel = activeRoom
    ? `${activeRoom.spaceCity ?? ''}${activeRoom.spaceCity && activeRoom.spaceRegion ? ', ' : ''}${activeRoom.spaceRegion ?? ''}` || 'Location unavailable'
    : 'Select a chat from your inbox.';
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

  useEffect(() => {
    if (messageRows) {
    setMessages(messageRows.map(normalizeMessage));
  }
  }, [messageRows, normalizeMessage]);

  const appendMessage = useCallback(
    (message: ChatMessage) => {
      setMessages((previous) => {
        if (previous.some((entry) => entry.id === message.id)) {
          return previous;
        }
        return [...previous, normalizeMessage(message)];
      });
    },
    [normalizeMessage]
  );

  useChatSubscription(activeRoom?.id ?? null, appendMessage);
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

  const ChatsListSkeleton = () => (
    <div className="space-y-3 py-4 px-2">
      <Skeleton className="h-10 w-full rounded-2xl" />
      <Skeleton className="h-10 w-full rounded-2xl" />
      <Skeleton className="h-10 w-3/4 rounded-2xl" />
    </div>
  );

  const renderList = () => {
    if (roomsLoading) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <ChatsListSkeleton />
        </div>
      );
    }

    if (roomsError) {
      return <p className="text-sm text-destructive">Unable to load conversations.</p>;
    }

    if (!filteredRooms.length) {
      return (
        <p className="text-sm text-muted-foreground">
          No conversations yet. Start a chat from a space listing to keep the conversation going.
        </p>
      );
    }

    return (
      <ScrollArea className="flex-1 h-full min-h-0">
        <div className="space-y-1 py-1">
          { filteredRooms.map((room) => {
            const lastMessageSnippet = room.lastMessage?.content ?? 'No messages yet.';
            const lastMessageTime = formatTimestamp(room.lastMessage?.createdAt);
            const isActive = room.id === activeRoom?.id;
            const hasNewMessage = room.lastMessage?.senderRole === 'partner';
            const location =
              room.spaceCity || room.spaceRegion
                ? [room.spaceCity, room.spaceRegion].filter(Boolean).join(', ')
                : null;
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
                href={ `/messages/${room.id}` }
                aria-current={ isActive ? 'true' : undefined }
                className={ cn(
                  'relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition',
                  isActive
                    ? 'bg-muted text-foreground'
                    : 'hover:bg-muted/70'
                ) }
                onClick={ handleConversationClick }
              >
                <Avatar className="h-10 w-10 border border-border/60">
                  { listAvatarUrl ? (
                    <AvatarImage src={ listAvatarUrl } alt={ room.spaceName ?? 'Space avatar' } />
                  ) : null }
                  <AvatarFallback>{ initials }</AvatarFallback>
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
                  <p className="truncate text-xs text-muted-foreground">
                    { location ?? 'Location unavailable' }
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
                { showUnread ? (
                  <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-destructive" aria-hidden="true" />
                ) : null }
              </Link>
            );
          }) }
        </div>
      </ScrollArea>
    );
  };

  const ConversationLoadingSkeleton = () => (
    <div className="flex h-full min-h-full flex-col justify-center space-y-3 px-4 py-6">
      <Skeleton className="h-4 w-32 rounded-full" />
      <div className="space-y-3">
        <Skeleton className="h-12 rounded-2xl" />
        <Skeleton className="h-12 rounded-2xl" />
        <Skeleton className="h-12 rounded-2xl" />
      </div>
    </div>
  );

  const ConversationPlaceholder = ({ children, }: { children: ReactNode }) => (
    <div className="flex h-full min-h-full flex-col items-center justify-center px-4 py-6 text-center">
      { children }
    </div>
  );

  const renderMessages = () => {
    let content: ReactNode;

    if (!activeRoom) {
      if (roomsLoading) {
        content = <ConversationLoadingSkeleton />;
      } else if (roomsError) {
        content = (
          <ConversationPlaceholder>
            <p className="text-sm text-destructive">Unable to load conversation.</p>
          </ConversationPlaceholder>
        );
      } else {
        content = (
          <ConversationPlaceholder>
            <p className="text-sm text-muted-foreground">
              Conversation not found. Go back to messages and pick another thread.
            </p>
          </ConversationPlaceholder>
        );
      }
    } else if (messagesLoading && messages.length === 0) {
      content = <ConversationLoadingSkeleton />;
    } else if (messages.length === 0) {
      content = (
        <ConversationPlaceholder>
          <p className="text-sm text-muted-foreground">
            No messages yet in this conversation. Send a quick note to get things moving.
          </p>
        </ConversationPlaceholder>
      );
    } else {
      content = (
        <div className="space-y-3 px-5 py-4 text-sm text-muted-foreground">
          { messages.map((message) => {
            const isCustomerMessage = message.senderRole === 'customer';
            const alignClass = isCustomerMessage ? 'items-end justify-end' : 'items-start justify-start';
            const bubbleClass = isCustomerMessage
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
                      isCustomerMessage && 'text-white'
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
            </div>
            );
          }) }
          <div ref={ scrollAnchorRef } />
        </div>
      );
    }

    return (
      <ScrollArea className="flex-1 h-full min-h-0">
        { content }
      </ScrollArea>
    );
  };

  const showListPane = !isMobile || !showThread;
  const showThreadPane = !isMobile || showThread;

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
              { renderList() }
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
                <Avatar className="h-11 w-11 border border-border/60 bg-card">
                  { headerAvatarUrl ? (
                    <AvatarImage src={ headerAvatarUrl } alt={ activeRoom?.spaceName ?? 'Space avatar' } />
                  ) : null }
                  <AvatarFallback>{ headerAvatarInitials }</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-2xl font-semibold tracking-tight text-foreground">
                    { headerDisplayName }
                  </span>
                  <span className="text-sm text-muted-foreground/90">
                    { headerLocationLabel }
                  </span>
                </div>
              </div>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col h-full overflow-hidden">
            { renderMessages() }
            { activeRoom ? (
              <form
                className="sticky bottom-0 z-10 border-t bg-card/80 px-3 py-3"
                onSubmit={ handleSend }
                noValidate
              >
                <div className="flex max-w-full items-end gap-3">
                  <Textarea
                    ref={ draftRef }
                    value={ draft }
                    onChange={ (event) => setDraft(event.target.value) }
                    placeholder="Type your message…"
                    aria-label="Message the host"
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
