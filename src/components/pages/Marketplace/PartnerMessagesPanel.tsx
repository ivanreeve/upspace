'use client';

import {
  FormEvent,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useChatMessages, usePartnerChatRooms, useSendChatMessage } from '@/hooks/api/useChat';
import { useChatSubscription } from '@/hooks/use-chat-subscription';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types/chat';

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const sendMessage = useSendChatMessage();
  const [draft, setDraft] = useState('');
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!rooms?.length) {
      setSelectedRoomId(null);
      return;
    }
    if (!selectedRoomId || rooms.every((room) => room.id !== selectedRoomId)) {
      setSelectedRoomId(rooms[0].id);
    }
  }, [rooms, selectedRoomId]);

  useEffect(() => {
    setMessages([]);
  }, [currentRoomId]);

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

  useEffect(() => {
    if (messageRows) {
      setMessages(messageRows.map(normalizeMessage));
    }
  }, [messageRows, normalizeMessage]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', });
  }, [messages.length]);

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

  useChatSubscription(currentRoomId, appendMessage);

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

  const renderMessages = () => {
    if (!activeRoom) {
      return (
        <p className="text-sm text-muted-foreground">Select a conversation to start replying.</p>
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
          No messages yet for this conversation. Once a customer replies, the thread will appear here.
        </p>
      );
    }

    return (
      <ScrollArea className="h-72 rounded-2xl border border-border/60 bg-background/80">
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
                <div className={ `max-w-[80%] space-y-1 rounded-2xl px-4 py-3 text-sm shadow` }>
                  <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>{ message.senderName ?? (isCustomerMessage ? 'Customer' : 'You') }</span>
                    <span>{ timestamp }</span>
                  </div>
                  <p className={ `whitespace-pre-line ${bubbleClass} px-0 py-0 font-medium` }>
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
  };

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
            const isActive = room.id === activeRoom?.id;
            const lastMessageSnippet = room.lastMessage?.content ?? 'No messages yet.';
            const lastMessageTime = formatTimestamp(room.lastMessage?.createdAt);

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
  };

  return (
    <section className="space-y-6 py-6">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Messages</h1>
          <Badge variant="secondary">Realtime</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Reply to customers for every listed space. Messages sync instantly via Supabase Realtime.
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-base">Conversations</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Select a customer to view the message thread.
            </CardDescription>
          </CardHeader>
          <CardContent>{ renderConversations() }</CardContent>
        </Card>
        <Card className="h-full">
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
          <CardContent className="space-y-4">
            { renderMessages() }
            { activeRoom ? (
              <form className="space-y-3" onSubmit={ handleSend } noValidate>
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
              <p className="text-sm text-muted-foreground">
                Start by selecting a conversation from the list.
              </p>
            ) }
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
