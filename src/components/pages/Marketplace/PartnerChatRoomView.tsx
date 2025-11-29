'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
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
import { Textarea } from '@/components/ui/textarea';
import { usePartnerChatRooms, useChatMessages, useSendChatMessage } from '@/hooks/api/useChat';
import { useChatSubscription } from '@/hooks/use-chat-subscription';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import type { ChatMessage } from '@/types/chat';

type PartnerChatRoomViewProps = {
  roomId: string;
};

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const sendMessage = useSendChatMessage();
  const [draft, setDraft] = useState('');
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile();
  const [showThread, setShowThread] = useState(!isMobile);

  useEffect(() => {
    setMessages([]);
  }, [activeRoom?.id]);

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

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', });
  }, [messages.length]);

  useEffect(() => {
    setShowThread(!isMobile);
  }, [isMobile]);

  useEffect(() => {
    if (isMobile && activeRoom) {
      setShowThread(true);
    }
  }, [activeRoom, isMobile]);

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

  const formatTimestamp = (value?: string) =>
    value
      ? new Date(value).toLocaleString([], {
          hour: 'numeric',
          minute: '2-digit',
        })
      : '';

  const normalizedQuery = searchValue.trim().toLowerCase();

  const filteredRooms = useMemo(() => {
    if (!rooms) {
      return [];
    }
    if (!normalizedQuery) {
      return rooms;
    }
    return rooms.filter((room) => {
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
  }, [normalizedQuery, rooms]);

  const renderList = () => {
    if (roomsLoading) {
      return <p className="text-sm text-muted-foreground">Loading conversations…</p>;
    }

    if (roomsError) {
      return <p className="text-sm text-destructive">Unable to load conversations.</p>;
    }

    if (!filteredRooms.length) {
      return (
        <p className="text-sm text-muted-foreground">
          No conversations yet. Customers will appear here once they message a space.
        </p>
      );
    }

    return (
      <ScrollArea className="flex-1 h-full">
        <div className="space-y-1 py-1">
          { filteredRooms.map((room) => {
            const lastMessageSnippet = room.lastMessage?.content ?? 'No messages yet.';
            const lastMessageTime = formatTimestamp(room.lastMessage?.createdAt);
            const isActive = room.id === activeRoom?.id;
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
                href={ `/spaces/messages/${room.id}` }
                aria-current={ isActive ? 'true' : undefined }
                className={ cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition',
                  isActive
                    ? 'bg-muted text-foreground'
                    : 'hover:bg-muted/70'
                ) }
                onClick={ handleConversationClick }
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/80 text-sm font-semibold text-primary-foreground">
                  { initials }
                </div>
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
                  <p className="truncate text-xs text-muted-foreground/90">
                    { lastMessageSnippet }
                  </p>
                </div>
              </Link>
            );
          }) }
        </div>
      </ScrollArea>
    );
  };

  const renderMessages = () => {
    if (!activeRoom) {
      if (roomsLoading) {
        return <p className="text-sm text-muted-foreground">Loading conversation…</p>;
      }
      if (roomsError) {
        return <p className="text-sm text-destructive">Unable to load conversation.</p>;
      }
      return (
        <p className="text-sm text-muted-foreground">
          Conversation not found. Go back to messages and pick another thread.
        </p>
      );
    }

    if (messagesLoading && messages.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">Loading conversation…</p>
      );
    }

    if (messages.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          No messages yet in this conversation. Send a quick reply to keep the thread active.
        </p>
      );
    }

    return (
      <ScrollArea className="flex-1 h-full overflow-y-auto">
        <div className="space-y-3 px-5 py-4 text-sm text-muted-foreground/80">
          { messages.map((message) => {
            const isPartnerMessage = message.senderRole === 'partner';
            const alignClass = isPartnerMessage ? 'items-end justify-end' : 'items-start justify-start';
            const bubbleClass = isPartnerMessage
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground';
            const timestamp = formatTimestamp(message.createdAt);

            return (
              <div key={ message.id } className={ `flex ${alignClass}` }>
                <div className="max-w-[80%] space-y-1">
                  <div
                    className={ cn('inline-block rounded-2xl px-4 py-2 text-base shadow', bubbleClass) }
                  >
                    <p className="whitespace-pre-line font-semibold text-base text-foreground">
                      { message.content }
                    </p>
                  </div>
                  <p
                    className={ cn(
                      'text-xs text-muted-foreground/80 leading-tight',
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
  };

  const handleBackToList = useCallback(() => {
    if (isMobile) {
      setShowThread(false);
      router.push('/spaces/messages');
    }
  }, [isMobile, router]);

  const handleConversationClick = useCallback(() => {
    if (isMobile) {
      setShowThread(true);
    }
  }, [isMobile]);

  const showListPane = !isMobile || !showThread;
  const showThreadPane = !isMobile || showThread;

  return (
    <section className="flex min-h-[100svh] flex-1 w-full gap-3 overflow-hidden p-0 md:h-auto md:min-h-0 md:p-4">
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
              <span className="text-xl font-semibold tracking-tight text-foreground">
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
          'flex min-w-0 flex-1 flex-col h-full',
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
                  'inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground md:hidden',
                  showThreadPane ? 'flex' : 'hidden'
                ) }
              >
                <FiArrowLeft className="size-4" aria-hidden="true" />
                Back
              </button>
              <div className="flex flex-col">
                <span className="text-2xl font-semibold tracking-tight text-foreground">
                  { activeRoom ? (activeRoom.customerName ?? activeRoom.customerHandle ?? 'Conversation') : 'Conversation' }
                </span>
                <span className="text-sm text-muted-foreground/90">
                  { activeRoom
                    ? `${activeRoom.spaceName}${activeRoom.spaceCity || activeRoom.spaceRegion ? ` · ${activeRoom.spaceCity ?? ''}${activeRoom.spaceCity && activeRoom.spaceRegion ? ', ' : ''}${activeRoom.spaceRegion ?? ''}` : ''}`
                    : 'Select a chat from your inbox.' }
                </span>
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
                    value={ draft }
                    onChange={ (event) => setDraft(event.target.value) }
                    placeholder="Reply to the customer…"
                    aria-label="Reply to conversation"
                    rows={ 1 }
                    className="h-10 flex-1 min-w-0 resize-none text-sm leading-4"
                    disabled={ sendMessage.isPending }
                  />
                  <Button
                    type="submit"
                    disabled={ sendMessage.isPending || !draft.trim() }
                    className="inline-flex h-10 shrink-0 items-center gap-2 px-4"
                  >
                    <FiSend className="size-4" aria-hidden="true" />
                    <span>{ sendMessage.isPending ? 'Sending…' : 'Send reply' }</span>
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
