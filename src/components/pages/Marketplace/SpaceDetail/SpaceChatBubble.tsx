'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';
import { FiSend, FiX } from 'react-icons/fi';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useSession } from '@/components/auth/SessionProvider';
import { useCustomerChatRoom, useChatMessages, useSendChatMessage } from '@/hooks/api/useChat';
import { useChatSubscription } from '@/hooks/use-chat-subscription';
import { useUserProfile } from '@/hooks/use-user-profile';
import type { ChatMessage } from '@/types/chat';

type SpaceChatBubbleProps = {
  isOpen: boolean;
  spaceId: string;
  hostName: string | null;
  hostAvatarUrl?: string | null;
  onClose: () => void;
};

export function SpaceChatBubble({
  isOpen,
  spaceId,
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

    if (messagesLoading && !messages.length) {
      return <p className="text-sm text-muted-foreground">Loading conversation…</p>;
    }

    if (!messages.length) {
      return (
        <p className="text-sm text-muted-foreground">
          Start the chat with a quick message. Hosts receive live notifications.
        </p>
      );
    }

    return (
      <ScrollArea className="max-h-60 rounded-3xl border border-border/20 bg-slate-950/70 px-2 py-2">
        <div className="space-y-3 px-2 py-1">
          { messages.map((message) => {
            const isCustomerMessage = message.senderRole === 'customer';
            const alignClass = isCustomerMessage ? 'justify-end' : 'justify-start';
            const bubbleClass = isCustomerMessage
              ? 'bg-blue-500 text-white'
              : 'bg-slate-900 text-white/90';

            const timestamp = new Date(message.createdAt).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
            });

            return (
              <div key={ message.id } className={ `flex ${alignClass}` }>
                <div
                  className={ `max-w-[80%] space-y-1 rounded-2xl px-4 py-3 text-[13px] shadow-lg ${bubbleClass}` }
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-white/80">
                    <span>{ message.senderName ?? (isCustomerMessage ? 'You' : 'Host') }</span>
                    <span>{ timestamp }</span>
                  </div>
                  <p className="whitespace-pre-line font-medium">{ message.content }</p>
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
    <div className="fixed bottom-6 right-6 z-50 flex w-[360px] flex-col gap-2 lg:bottom-8 lg:right-8">
      <Card className="w-full rounded-[28px] border border-border/60 bg-slate-950/95 shadow-2xl shadow-black/40">
        <CardHeader className="flex items-center justify-between gap-3 rounded-t-[28px] bg-gradient-to-r from-primary to-secondary px-4 py-3 text-white">
          <div className="flex items-center gap-3">
            <Avatar className="size-9 border border-white/60">
              { hostAvatarUrl ? (
                <AvatarImage src={ hostAvatarUrl } alt={ `${hostName ?? 'Host'} avatar` } />
              ) : (
                <AvatarFallback>{ hostName?.slice(0, 2)?.toUpperCase() ?? 'US' }</AvatarFallback>
              ) }
            </Avatar>
            <div>
              <CardTitle className="text-base text-white">
                { hostName ? hostName : 'Host' }
              </CardTitle>
              <p className="text-[11px] text-white/80">Active now · Messenger style</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={ onClose }
            aria-label="Close conversation"
          >
            <FiX className="size-4 text-white" aria-hidden="true" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 px-0 pb-3 pt-2">
          <div className="px-4">
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
            <form className="space-y-3 px-4" onSubmit={ handleSend } noValidate>
              <div className="flex items-center gap-2 rounded-3xl bg-slate-900/70 px-3 py-2 shadow-lg shadow-black/60">
                <Textarea
                  value={ draft }
                  onChange={ (event) => setDraft(event.target.value) }
                  placeholder="Write a message…"
                  aria-label="Message to host"
                  rows={ 1 }
                  disabled={ sendMessage.isPending }
                  className="bg-transparent px-2 py-1 text-sm text-white placeholder:text-white/60 [&[data-slot='textarea']]:min-h-[24px]"
                />
                <Button
                  type="submit"
                  disabled={ sendMessage.isPending || !draft.trim() }
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white p-0 text-primary transition hover:bg-neutral-100"
                >
                  <FiSend className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </form>
          ) : null }
        </CardContent>
      </Card>
      <div className="flex items-center gap-3 rounded-2xl bg-slate-900/80 px-4 py-2 text-xs text-white/80 shadow-lg shadow-black/50">
        <div className="h-2 w-2 rounded-full bg-emerald-400" />
        <p>Messages are private and delivered instantly.</p>
      </div>
    </div>
  );
}
