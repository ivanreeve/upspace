'use client';

import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';
import { FiSend, FiX } from 'react-icons/fi';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useSession } from '@/components/auth/SessionProvider';
import { useCustomerChatRoom, useChatMessages, useSendChatMessage } from '@/hooks/api/useChat';
import { useChatSubscription } from '@/hooks/use-chat-subscription';
import { useUserProfile } from '@/hooks/use-user-profile';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types/chat';

type SpaceChatBubbleProps = {
  isOpen: boolean;
  spaceId: string;
  spaceName: string;
  hostName: string | null;
  hostAvatarUrl?: string | null;
  onClose: () => void;
};

type ConversationEmptyStateProps = {
  spaceName: string;
};

function ConversationLoadingSkeleton() {
  return (
    <div className="space-y-3 px-1">
      <Skeleton className="h-3 w-24 rounded-full" />
      <Skeleton className="h-3 w-32 rounded-full" />
      { [1, 2, 3].map((_, index) => (
        <Skeleton key={ `loading-${index}` } className="h-12 rounded-2xl" />
      )) }
    </div>
  );
}

function ConversationEmptyState(props: ConversationEmptyStateProps) {
  const { spaceName, } = props;
  return (
    <div className="space-y-2 px-1 text-sm text-muted-foreground">
      <p className="text-base font-semibold text-foreground">
        Start a message to { spaceName }
      </p>
      <p>
        Ask a quick question about availability, pricing, or on-site amenities.
        Hosts receive live notifications as soon as you hit send.
      </p>
    </div>
  );
}

export function SpaceChatBubble({
  isOpen,
  spaceId,
  spaceName,
  hostName,
  hostAvatarUrl,
  onClose,
}: SpaceChatBubbleProps) {
  const { session, } = useSession();
  const {
    data: userProfile,
    isLoading: isProfileLoading,
  } = useUserProfile();
  const isCustomer = userProfile?.role === 'customer';
  const [manualRoomId, setManualRoomId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const {
    data: roomData,
    isLoading: isRoomLoading,
    error: roomError,
  } = useCustomerChatRoom(spaceId);
  const currentRoomId = roomData?.id ?? manualRoomId;
  const {
 data: messageRows, isPending: messagesLoading, 
} = useChatMessages(currentRoomId);
  const sendMessage = useSendChatMessage();
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const maxDraftHeight = 96; // px, matches Tailwind max-h-24

  const normalizeMessage = useCallback(
    (message: ChatMessage) => {
      const isLocalSender = Boolean(userProfile?.userId && message.senderId === userProfile.userId);
      const fallbackName = message.senderRole === 'customer' ? 'You' : 'Host';
      const senderName = isLocalSender ? 'You' : message.senderName ?? fallbackName;
      return {
 ...message,
senderName, 
};
    },
    [userProfile?.userId]
  );

  useEffect(() => {
    if (!messageRows) {
      return;
    }
    setMessages(messageRows.map(normalizeMessage));
  }, [messageRows, normalizeMessage]);

  useEffect(() => {
    if (roomData?.id) {
      setManualRoomId(null);
    }
  }, [roomData?.id]);

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

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!messages.length) {
      return;
    }
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', });
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

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isCustomer) {
      return;
    }

    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }

    try {
      const result = await sendMessage.mutateAsync({
        spaceId,
        content: trimmed,
      });
      setManualRoomId(result.roomId);
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

  const renderConversation = () => {
    if (!isCustomer) {
      return (
        <p className="text-sm text-muted-foreground">
          Only customers can chat with hosts. Sign in or finish onboarding to continue.
        </p>
      );
    }

    if (roomError) {
      return (
        <p className="text-sm text-destructive">
          Unable to load the conversation. Please try again later.
        </p>
      );
    }

    const hasRoom = Boolean(roomData?.id);
    const isConversationLoading =
      (isRoomLoading && !hasRoom) || (hasRoom && messagesLoading && !messages.length);

    if (isConversationLoading) {
      return <ConversationLoadingSkeleton />;
    }

    if (!messages.length) {
      return <ConversationEmptyState spaceName={ spaceName } />;
    }

    return (
      <ScrollArea className="h-full">
        <div className="space-y-2 px-2 py-2">
          { messages.map((message) => {
            const isCustomerMessage = message.senderRole === 'customer';
            const alignClass = isCustomerMessage ? 'items-end justify-end' : 'items-start justify-start';
            const bubbleClass = isCustomerMessage
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground';

            const timestamp = new Date(message.createdAt).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
            });

            return (
              <div key={ message.id } className={ `flex ${alignClass}` }>
                <div className="max-w-full sm:max-w-[520px] space-y-1">
                  <div className={ `inline-block rounded-2xl px-4 py-2 text-sm shadow ${bubbleClass}` }>
                    <p
                      className={ cn(
                        'whitespace-pre-line break-all text-sm font-medium',
                        isCustomerMessage && 'text-white'
                      ) }
                    >
                      { message.content }
                    </p>
                  </div>
                  <p
                    className={ [
                      'text-[10px] text-muted-foreground',
                      isCustomerMessage ? 'text-right' : 'text-left'
                    ].join(' ') }
                  >
                    { timestamp }
                  </p>
                </div>
              </div>
            );
          }) }
          <div ref={ scrollRef } />
        </div>
      </ScrollArea>
    );
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[360px] rounded-xl border bg-background shadow-xl shadow-black/40 lg:bottom-8 lg:right-8">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Avatar className="size-8 border border-border/60">
            { hostAvatarUrl ? (
              <AvatarImage src={ hostAvatarUrl } alt={ `${spaceName} featured image` } />
            ) : (
              <AvatarFallback className="text-white">{ spaceName?.slice(0, 2)?.toUpperCase() ?? 'US' }</AvatarFallback>
            ) }
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">
              { spaceName || hostName || 'Conversation' }
            </span>
            <span className="text-[11px] text-muted-foreground">
              Chat with your host
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={ onClose }
          aria-label="Close conversation"
          className="hover:text-white"
        >
          <FiX className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <div className="flex h-96 min-h-0 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col px-3 py-2">
          { session ? (
            isProfileLoading ? (
              <p className="text-sm text-muted-foreground">Loading your profile…</p>
            ) : (
              renderConversation()
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              Sign in to chat with the host and coordinate visits.
            </p>
          ) }
        </div>
        { session && isCustomer ? (
          <form className="border-t px-3 py-2" onSubmit={ handleSend } noValidate>
            <div className="flex max-w-full items-end gap-2">
              <Textarea
                ref={ draftRef }
                value={ draft }
                onChange={ (event) => setDraft(event.target.value) }
                placeholder="Type your message…"
                aria-label="Message to host"
                rows={ 1 }
                disabled={ sendMessage.isPending }
                className="min-h-[40px] max-h-24 flex-1 min-w-0 resize-none overflow-y-auto text-sm leading-4"
                onKeyDown={ handleDraftKeyDown }
              />
              <Button
                type="submit"
                disabled={ sendMessage.isPending || !draft.trim() }
                className="inline-flex h-10 shrink-0 items-center gap-2"
              >
                <FiSend className="size-4" aria-hidden="true" />
                <span className="text-sm">{ sendMessage.isPending ? 'Sending…' : 'Send' }</span>
              </Button>
            </div>
          </form>
        ) : null }
      </div>
    </div>
  );
}
