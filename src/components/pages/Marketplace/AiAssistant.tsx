'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
FiAlertCircle,
FiMapPin,
FiDollarSign,
FiWifi,
FiCalendar,
FiClock,
FiUsers,
FiCheckCircle
} from 'react-icons/fi';
import { CiLocationArrow1 } from 'react-icons/ci';
import { IoStop } from 'react-icons/io5';
import { toast } from 'sonner';
import remarkGfm from 'remark-gfm';

const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: false, });

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SpaceCard } from '@/components/pages/Marketplace/Marketplace.Cards';
import type { Space } from '@/lib/api/spaces';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BottomGradientOverlay } from '@/components/ui/bottom-gradient-overlay';
import { useSidebar } from '@/components/ui/sidebar';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useGeolocation } from '@/hooks/use-geolocation';
import { cn } from '@/lib/utils';
import { getSpeechRecognitionErrorMessage, VOICE_UNSUPPORTED_MESSAGE } from '@/lib/voice';
import { useCreateCheckoutSessionMutation } from '@/hooks/api/useBookings';
import {
  useCreateAiConversationMutation,
  aiConversationKeys,
  type AiConversationDetail,
  type AiConversationMessage
} from '@/hooks/api/useAiConversations';
import { AiChatSidebar } from '@/components/pages/Marketplace/AiChatSidebar';
import { useSession } from '@/components/auth/SessionProvider';
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';

type BookingAction = {
  action: 'checkout';
  spaceId: string;
  areaId: string;
  bookingHours: number;
  price: number;
  startAt: string;
  guestCount: number;
  spaceName: string;
  areaName: string;
  priceCurrency: string;
  requiresHostApproval?: boolean;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  spaceResults?: Space[];
  bookingAction?: BookingAction;
};

const makeMessageId = (role: ChatMessage['role']) =>
  `${role}-${typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36)
  }`;

const mapConversationMessages = (
  source: AiConversationMessage[]
): ChatMessage[] =>
  source.map((msg) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    spaceResults: (msg.space_results as Space[] | null) ?? undefined,
    bookingAction: (msg.booking_action as BookingAction | null) ?? undefined,
  }));

const getFriendlyAiErrorMessage = (error: Error) => {
  const message = error.message ?? '';
  if (/can't reach database server/i.test(message)) {
    return 'Sorry, we cannot reach our workspace database right now. Please try again in a moment.';
  }
  if (/unable to reach openrouter/i.test(message)) {
    return 'OpenRouter is currently unavailable. Please try again in a few seconds.';
  }
  if (/unexpected response/i.test(message)) {
    return 'We received an unexpected response from OpenRouter. Please try again.';
  }

  return 'UpSpace could not complete that request right now. Please try again shortly.';
};

const shimmerTextStyle: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(120deg, var(--secondary) 0%, oklch(0.68 0.16 145) 50%, oklch(0.72 0.14 75) 100%)',
  backgroundSize: '250% 100%',
  animation: 'shimmerLoading 1.3s linear infinite',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
};

const SEARCHING_MESSAGES = [
  'Consulting the coworking oracle...',
  'Summoning your perfect workspace...',
  'Reading the coffee-fueled crystal ball...',
  'Interrogating our space database...',
  'Channeling productive vibes...',
  'Decoding the matrix of desks...'
];

const markdownComponents = {
  h1: ({ children, }: { children?: React.ReactNode }) => (
    <span className="font-semibold">{ children }</span>
  ),
  h2: ({ children, }: { children?: React.ReactNode }) => (
    <span className="font-semibold">{ children }</span>
  ),
  h3: ({ children, }: { children?: React.ReactNode }) => (
    <span className="font-semibold">{ children }</span>
  ),
  h4: ({ children, }: { children?: React.ReactNode }) => (
    <span className="font-medium">{ children }</span>
  ),
  h5: ({ children, }: { children?: React.ReactNode }) => (
    <span className="font-medium">{ children }</span>
  ),
  h6: ({ children, }: { children?: React.ReactNode }) => (
    <span className="font-medium">{ children }</span>
  ),
  p: ({ children, }: { children?: React.ReactNode }) => (
    <p className="mb-2 last:mb-0">{ children }</p>
  ),
  ul: ({ children, }: { children?: React.ReactNode }) => (
    <ul className="mb-2 ml-4 list-disc space-y-1">{ children }</ul>
  ),
  ol: ({ children, }: { children?: React.ReactNode }) => (
    <ol className="mb-2 ml-4 list-decimal space-y-1">{ children }</ol>
  ),
  li: ({ children, }: { children?: React.ReactNode }) => (
    <li className="text-sm">{ children }</li>
  ),
  strong: ({ children, }: { children?: React.ReactNode }) => (
    <strong className="font-semibold">{ children }</strong>
  ),
  em: ({ children, }: { children?: React.ReactNode }) => (
    <em className="italic">{ children }</em>
  ),
  code: ({ children, }: { children?: React.ReactNode }) => (
    <code className="rounded bg-muted px-1 py-0.5 text-sm font-mono">{ children }</code>
  ),
  pre: ({ children, }: { children?: React.ReactNode }) => (
    <pre className="mb-2 overflow-x-auto rounded bg-muted p-3">{ children }</pre>
  ),
  a: ({
 href, children, 
}: { href?: string; children?: React.ReactNode }) => (
    <a
      href={ href }
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline hover:text-primary/80"
    >
      { children }
    </a>
  ),
  blockquote: ({ children, }: { children?: React.ReactNode }) => (
    <blockquote className="mb-2 border-l-2 border-muted-foreground/30 pl-3 italic text-muted-foreground">
      { children }
    </blockquote>
  ),
};

interface GradientSparklesIconProps extends React.SVGProps<SVGSVGElement> {
  isThinking?: boolean;
}

function GradientSparklesIcon({
  className,
  isThinking = false,
  ...props
}: GradientSparklesIconProps) {
  const gradientId = React.useId();
  const motionBlurId = React.useId();
  const stroke = `url(#${gradientId})`;
  const blurAnimation = isThinking ? (
    <animate
      attributeName="stdDeviation"
      values="0;0;3;0"
      keyTimes="0;0.6;0.72;1"
      dur="1.5s"
      calcMode="spline"
      keySplines="0.35 0 0.65 0;0.2 0.8 0.4 1;0.6 0 0.8 0.2"
      repeatCount="indefinite"
    />
  ) : null;
  const rotationAnimation = isThinking ? (
    <animateTransform
      attributeName="transform"
      type="rotate"
      values="0 12 12;40 12 12;360 12 12"
      keyTimes="0;0.68;1"
      dur="1.5s"
      calcMode="spline"
      keySplines="0.55 0 0.85 0.2;0.15 0.85 0.3 1"
      repeatCount="indefinite"
    />
  ) : null;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={ 2 }
      strokeLinecap="round"
      strokeLinejoin="round"
      className={ cn('size-6', className) }
      aria-hidden={ props['aria-label'] ? undefined : 'true' }
      { ...props }
    >
      <defs>
        <linearGradient
          id={ gradientId }
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
          gradientTransform="rotate(120 0.5 0.5)"
        >
          <stop offset="0%" stopColor="var(--secondary)" />
          <stop offset="50%" stopColor="oklch(0.68 0.16 145)" />
          <stop offset="100%" stopColor="oklch(0.72 0.14 75)" />
        </linearGradient>
        <filter id={ motionBlurId } x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0">
            { blurAnimation }
          </feGaussianBlur>
        </filter>
      </defs>
      <g filter={ isThinking ? `url(#${motionBlurId})` : undefined }>
        { rotationAnimation }
        <path
          d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
          stroke={ stroke }
        />
        <path d="M20 3v4" stroke={ stroke } />
        <path d="M22 5h-4" stroke={ stroke } />
        <path d="M4 17v2" stroke={ stroke } />
        <path d="M5 18H3" stroke={ stroke } />
      </g>
    </svg>
  );
}

function MicGradientIcon({ className, }: { className?: string }) {
  const gradientId = React.useId();

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={ 2 }
      strokeLinecap="round"
      strokeLinejoin="round"
      className={ cn('size-5', className) }
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={ gradientId } x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--secondary)" />
          <stop offset="50%" stopColor="oklch(0.68 0.16 145)" />
          <stop offset="100%" stopColor="oklch(0.72 0.14 75)" />
        </linearGradient>
      </defs>
      <path
        d="M12 1a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z"
        stroke={ `url(#${gradientId})` }
      />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke={ `url(#${gradientId})` } />
      <line x1="12" y1="19" x2="12" y2="23" stroke={ `url(#${gradientId})` } />
      <line x1="8" y1="23" x2="16" y2="23" stroke={ `url(#${gradientId})` } />
    </svg>
  );
}

function BookingConfirmationCard({ bookingAction, }: {
  bookingAction: BookingAction;
}) {
  const checkoutMutation = useCreateCheckoutSessionMutation();

  const handleProceedToPayment = () => {
    checkoutMutation.mutate(
      {
        spaceId: bookingAction.spaceId,
        areaId: bookingAction.areaId,
        bookingHours: bookingAction.bookingHours,
        price: bookingAction.price,
        startAt: bookingAction.startAt,
        guestCount: bookingAction.guestCount,
      },
      {
        onSuccess: (data) => {
          window.location.href = data.checkoutUrl;
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to start checkout. Please try again.');
        },
      }
    );
  };

  const startDate = new Date(bookingAction.startAt);
  const formattedDate = startDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = startDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <Card className="w-full border-primary/20 bg-primary/[0.03] rounded-2xl overflow-hidden mt-2">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2.5">
          <FiCheckCircle className="size-5 text-primary" aria-hidden="true" />
          <span className="text-base font-semibold">Booking Summary</span>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Space</span>
            <span className="font-medium">{ bookingAction.spaceName }</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Area</span>
            <span className="font-medium">{ bookingAction.areaName }</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date</span>
            <span className="font-medium">{ formattedDate }</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Time</span>
            <span className="font-medium">{ formattedTime }</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              <FiClock className="mr-1 inline size-3.5" aria-hidden="true" />
              Duration
            </span>
            <span className="font-medium">
              { bookingAction.bookingHours } hour{ bookingAction.bookingHours > 1 ? 's' : '' }
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              <FiUsers className="mr-1 inline size-3.5" aria-hidden="true" />
              Guests
            </span>
            <span className="font-medium">{ bookingAction.guestCount }</span>
          </div>
          <hr className="border-border/50" />
          <div className="flex justify-between text-base">
            <span className="font-semibold">Total</span>
            <span className="font-semibold text-primary">
              { bookingAction.priceCurrency }{ ' ' }
              { bookingAction.price.toLocaleString('en-US', { minimumFractionDigits: 2, }) }
            </span>
          </div>
        </div>

        { bookingAction.requiresHostApproval ? (
          <p className="text-xs text-muted-foreground">
            <FiAlertCircle className="mr-1 inline size-3" aria-hidden="true" />
            This booking requires host approval after payment.
          </p>
        ) : null }

        <Button
          className="w-full"
          onClick={ handleProceedToPayment }
          disabled={ checkoutMutation.isPending }
          aria-label="Proceed to payment checkout"
        >
          { checkoutMutation.isPending ? 'Starting checkout...' : 'Proceed to Payment' }
        </Button>
      </CardContent>
    </Card>
  );
}

function MessageBubble({
  message,
  isThinking = false,
  iconRef,
}: {
  message: ChatMessage;
  isThinking?: boolean;
  iconRef?: (node: HTMLDivElement | null) => void;
}) {
  const [searchingMessageIndex, setSearchingMessageIndex] = React.useState(0);
  const isUser = message.role === 'user';
  const hasSpaceResults = Boolean(message.spaceResults?.length);
  const hasContent = message.content.trim().length > 0;
  const shouldShowBubble = isThinking || (!hasSpaceResults && hasContent);

  React.useEffect(() => {
    if (!isThinking) return;

    const interval = setInterval(() => {
      setSearchingMessageIndex((prev) => (prev + 1) % SEARCHING_MESSAGES.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [isThinking]);

  return (
    <div
      className={ cn(
        'flex gap-3',
        isUser ? 'justify-end' : 'justify-start items-start'
      ) }
    >
      { !isUser && (
        <div
          ref={ iconRef }
          className="relative z-10 mt-0.5 flex size-12 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-cyan-900 dark:bg-cyan-900/30 dark:text-cyan-100"
        >
          <GradientSparklesIcon isThinking={ isThinking } />
          <span className="sr-only">OpenRouter assistant</span>
        </div>
      ) }
      <div className={ cn('flex min-w-0 flex-col gap-3', isUser ? 'items-end' : 'items-start') }>
        { shouldShowBubble ? (
          <div
            className={ cn(
              'max-w-[720px] rounded-md border px-4 py-3 text-sm',
              isUser
                ? 'bg-primary/10 border-primary/30 text-foreground'
                : 'bg-muted/20 dark:bg-muted/60 border-border/60 text-foreground'
            ) }
          >
            { isThinking ? (
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <span style={ shimmerTextStyle }>
                  { SEARCHING_MESSAGES[searchingMessageIndex] }
                </span>
              </span>
            ) : (
              <div className="prose prose-sm max-w-none dark:prose-invert [&>*]:text-sm">
                <ReactMarkdown
                  remarkPlugins={ [remarkGfm] }
                  components={ isUser ? undefined : markdownComponents }
                >
                  { message.content }
                </ReactMarkdown>
              </div>
            ) }
          </div>
        ) : null }
        { hasSpaceResults ? (
          <div className="w-full max-w-[720px]">
            { (message.spaceResults?.length ?? 0) > 1 ? (
              <div className="relative">
                <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory touch-pan-x scrollbar-hide">
                  { message.spaceResults!.map((space) => (
                    <div
                      key={ space.space_id }
                      className="min-w-[320px] max-w-[360px] snap-start space-card-entrance"
                    >
                      <SpaceCard space={ space } />
                    </div>
                  )) }
                </div>
              </div>
            ) : (
              <div className="space-card-entrance">
                <SpaceCard space={ message.spaceResults![0] } />
              </div>
            ) }
          </div>
        ) : null }
        { message.bookingAction ? (
          <div className="w-full max-w-[720px]">
            <BookingConfirmationCard bookingAction={ message.bookingAction } />
          </div>
        ) : null }
      </div>
    </div>
  );
}

type AiMutationInput = {
  history: ChatMessage[];
  conversationId: string;
};

export function AiAssistant() {
  const [query, setQuery] = React.useState('');
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
  const {
    isSupported: isVoiceSupported,
    status: voiceStatus,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    errorMessage: voiceHookError,
  } = useSpeechRecognition();
  const scrollAnchorRef = React.useRef<HTMLDivElement | null>(null);
  const lineContainerRef = React.useRef<HTMLDivElement | null>(null);
  const iconRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const [linePosition, setLinePosition] = React.useState<{
    top: number;
    height: number;
  } | null>(null);
  const hasMessages = messages.length > 0;
  const { data: userProfile, } = useUserProfile();
  const {
    location: userLocation, error: locationError,
  } = useGeolocation();
  const {
    state, isMobile,
  } = useSidebar();
  const {
    session, isLoading: sessionLoading,
  } = useSession();
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();
  const createConversation = useCreateAiConversationMutation();
  const fetchConversationDetail = React.useCallback(
    async (id: string) => {
      const response = await authFetch(`/api/v1/ai/conversations/${id}`);
      if (!response.ok) {
        throw new Error('Unable to load that conversation right now.');
      }

      const payload = await response.json();
      return payload.conversation as AiConversationDetail;
    },
    [authFetch]
  );

  const handleSelectConversation = React.useCallback(
    async (id: string) => {
      setErrorMessage(null);
      setActiveConversationId(id);
      setMessages([]);

      try {
        const conversation = await queryClient.fetchQuery<AiConversationDetail>({
          queryKey: aiConversationKeys.detail(id),
          queryFn: () => fetchConversationDetail(id),
        });
        const loaded = conversation.messages ?? [];
        if (loaded.length === 0) {
          toast.info('This conversation has no saved messages. Starting fresh.');
          setActiveConversationId(null);
          setMessages([]);
        } else {
          setMessages(mapConversationMessages(loaded));
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Unable to load conversation history.'
        );
      }

    },
    [fetchConversationDetail, queryClient]
  );

  const greetingName = React.useMemo(() => {
    const firstName = userProfile?.firstName?.trim();
    if (firstName) {
      return firstName;
    }

    const handle = userProfile?.handle?.trim();
    if (handle) {
      return handle;
    }

    return 'UpSpace User';
  }, [userProfile]);

  const aiSearchMutation = useMutation<
    { reply: string; spaces?: Space[]; bookingAction?: BookingAction },
    Error,
    AiMutationInput
  >({
    mutationFn: async ({
 history, conversationId, 
}: AiMutationInput) => {
      if (!history.length) {
        throw new Error('Please enter a question.');
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch('/api/v1/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          messages: history.map(({
            role, content,
          }) => ({
            role,
            content: content.trim(),
          })),
          conversation_id: conversationId,
          ...(userLocation ? { location: userLocation, } : {}),
          ...(userProfile?.userId ? { user_id: userProfile.userId, } : {}),
        }),
        cache: 'no-store',
        signal: controller.signal,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const detail =
          data?.detail && typeof data.detail === 'string' ? data.detail : null;
        const message =
          data?.error && typeof data.error === 'string'
            ? data.error
            : 'Unable to reach OpenRouter right now.';
        const combined = detail ? `${message} (${detail})` : message;
        throw new Error(combined);
      }

      if (!data || typeof data.reply !== 'string') {
        throw new Error('Unexpected response from OpenRouter.');
      }

      const bookingAction: BookingAction | undefined =
        data.bookingAction?.action === 'checkout' ? data.bookingAction : undefined;

      return {
        reply: data.reply.trim(),
        spaces: Array.isArray(data.spaces) ? data.spaces : [],
        bookingAction,
      };
    },
    onSettled: () => {
      abortControllerRef.current = null;
    },
  });

  const setPromptInput = React.useCallback((prompt: string) => {
    setQuery(prompt.trim());
  }, []);

  const activeConversationIdRef = React.useRef(activeConversationId);
  activeConversationIdRef.current = activeConversationId;

  const submitPrompt = React.useCallback(
    async (rawPrompt: string) => {
      if (aiSearchMutation.isPending || createConversation.isPending) return;

      const trimmed = rawPrompt.trim();
      if (!trimmed) {
        return;
      }

      setQuery('');
      setErrorMessage(null);

      let conversationId = activeConversationIdRef.current;
      if (!conversationId) {
        try {
          const newConv = await createConversation.mutateAsync();
          conversationId = newConv.id;
          setActiveConversationId(conversationId);
        } catch {
          toast.error('Failed to create conversation. Please try again.');
          return;
        }
      }

      const userMessage: ChatMessage = {
        id: makeMessageId('user'),
        role: 'user',
        content: trimmed,
      };

      const finalConversationId = conversationId;

      setMessages((previous) => {
        const history = [...previous, userMessage];

        aiSearchMutation.mutate({
 history,
conversationId: finalConversationId, 
}, {
          onSuccess: (result) => {
            setMessages((prev) => [
              ...prev,
              {
                id: makeMessageId('assistant'),
                role: 'assistant',
                content: result.reply,
                spaceResults:
                  result.spaces && result.spaces.length > 0
                    ? result.spaces
                    : undefined,
                bookingAction: result.bookingAction,
              }
            ]);
            queryClient.invalidateQueries({ queryKey: aiConversationKeys.all, });
            if (finalConversationId) {
              queryClient.invalidateQueries({ queryKey: aiConversationKeys.detail(finalConversationId), });
            }
          },
          onError: (mutationError) => {
            if (mutationError.name === 'AbortError') {
              return;
            }
            const friendlyMessage = getFriendlyAiErrorMessage(mutationError);
            setErrorMessage(friendlyMessage);
            setMessages((prev) => [
              ...prev,
              {
                id: makeMessageId('assistant'),
                role: 'assistant',
                content: friendlyMessage,
              }
            ]);
          },
        });

        return history;
      });
    },
    [aiSearchMutation, createConversation, queryClient]
  );

  const stopAiSearch = React.useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    aiSearchMutation.reset();
    setErrorMessage(null);
  }, [aiSearchMutation]);

  const isThinking = aiSearchMutation.isPending;
  const isListening = voiceStatus === 'listening';
  const isVoiceActive = isListening;
  const bottomBarOffsets = React.useMemo<React.CSSProperties>(() => {
    if (isMobile) {
      return {
        left: 0,
        right: 0,
        paddingBottom: 'calc(1.5rem + var(--safe-area-bottom, 0px))',
      };
    }

    const sidebarOffset =
      state === 'collapsed'
        ? 'var(--sidebar-width-icon)'
        : 'var(--sidebar-width)';

    return {
      left: sidebarOffset,
      right: 0,
      paddingBottom: 'calc(2rem + var(--safe-area-bottom, 0px))',
    };
  }, [isMobile, state]);

  const assistantIds = React.useMemo(() => {
    const assistantMessageIds = messages
      .filter((message) => message.role === 'assistant')
      .map((message) => message.id);

    if (isThinking) {
      assistantMessageIds.push('assistant-thinking');
    }

    return assistantMessageIds;
  }, [isThinking, messages]);

  const registerIconRef = React.useCallback(
    (id: string) => (node: HTMLDivElement | null) => {
      if (node) {
        iconRefs.current[id] = node;
      } else {
        delete iconRefs.current[id];
      }
    },
    []
  );

  const measureLine = React.useCallback(() => {
    if (!assistantIds.length) {
      setLinePosition(null);
      return;
    }

    const container = lineContainerRef.current;

    if (!container) return;

    const firstIcon = assistantIds
      .map((id) => iconRefs.current[id])
      .find(Boolean);
    const lastIcon = [...assistantIds]
      .reverse()
      .map((id) => iconRefs.current[id])
      .find(Boolean);

    if (!firstIcon || !lastIcon) {
      setLinePosition(null);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const firstRect = firstIcon.getBoundingClientRect();
    const lastRect = lastIcon.getBoundingClientRect();

    const start = firstRect.top + firstRect.height / 2 - containerRect.top;
    const end = lastRect.top + lastRect.height / 2 - containerRect.top;

    setLinePosition({
      top: start,
      height: Math.max(end - start, 0),
    });
  }, [assistantIds]);

  React.useLayoutEffect(() => {
    const frame = requestAnimationFrame(measureLine);
    return () => cancelAnimationFrame(frame);
  }, [measureLine]);

  React.useEffect(() => {
    const handleResize = () => measureLine();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [measureLine]);

  React.useEffect(() => {
    if (!voiceHookError) return;

    const message =
      getSpeechRecognitionErrorMessage(voiceHookError) ??
      'Voice recognition error occurred. Please try again.';

    toast.error(message);
  }, [voiceHookError]);

  React.useEffect(() => {
    if (voiceStatus === 'unsupported') {
      toast.error(VOICE_UNSUPPORTED_MESSAGE);
    }
  }, [voiceStatus]);

  React.useEffect(() => {
    if (!transcript) return;
    setQuery(transcript);
  }, [transcript]);

  const scrollToBottom = React.useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      const anchor = scrollAnchorRef.current;
      if (!anchor) return;

      const scrollViewport = anchor.closest(
        '[data-slot="scroll-area-viewport"]'
      ) as HTMLElement | null;

      const performScroll = () => {
        if (scrollViewport) {
          const options: ScrollToOptions = { top: scrollViewport.scrollHeight, };
          if (behavior === 'smooth') {
            options.behavior = 'smooth';
          }
          scrollViewport.scrollTo(options);
        }

        anchor.scrollIntoView({
          behavior,
          block: 'end',
        });
      };

      requestAnimationFrame(performScroll);
      window.setTimeout(performScroll, 120);
    },
    []
  );

  React.useEffect(() => {
    scrollToBottom(hasMessages ? 'smooth' : 'auto');
  }, [messages, isThinking, hasMessages, scrollToBottom]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (aiSearchMutation.isPending) {
      stopAiSearch();
      return;
    }

    if (voiceStatus === 'listening') {
      stopListening();
    }

    void submitPrompt(query);
  };

  const handleNewConversation = React.useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
    setQuery('');
    setErrorMessage(null);
  }, []);

  const handleVoiceButtonClick = () => {
    if (aiSearchMutation.isPending) {
      return;
    }

    if (!isVoiceSupported) {
      toast.error(VOICE_UNSUPPORTED_MESSAGE);
      return;
    }

    if (voiceStatus === 'listening') {
      stopListening();
      if (transcript.trim()) {
        setQuery(transcript.trim());
      }
      return;
    }

    resetTranscript();
    startListening();
  };

  const renderPromptForm = (placement: 'fixed' | 'inline') => {
    const shouldShowPrebuiltPrompts = placement === 'inline' && !hasMessages;
    const prebuiltPrompts = (
      <div className="grid gap-3 sm:grid-cols-2 w-full max-w-2xl rounded-lg p-0">
        <Button
          type="button"
          variant="outline"
          className="h-auto grid grid-cols-[40px_1fr] items-center gap-3 rounded-2xl border-2 bg-card/50 px-4 py-3 text-left text-foreground shadow-none hover:text-foreground hover:bg-[oklch(0.955_0.02_204.6929)] dark:hover:bg-[oklch(0.24_0.02_204.6929)] hover:border-border border-border/50 transition-colors"
          onClick={ () => setPromptInput('Find coworking spaces near me with good Wi-Fi') }
          disabled={ aiSearchMutation.isPending }
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/8 text-primary">
            <FiMapPin className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">Find spaces near me</span>
            <span className="text-xs text-muted-foreground">Discover local coworking options</span>
          </div>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-auto grid grid-cols-[40px_1fr] items-center gap-3 rounded-2xl border-2 bg-card/50 px-4 py-3 text-left text-foreground shadow-none hover:text-foreground hover:bg-[oklch(0.955_0.02_204.6929)] dark:hover:bg-[oklch(0.24_0.02_204.6929)] hover:border-border border-border/50 transition-colors"
          onClick={ () => setPromptInput('What are the most affordable workspaces available?') }
          disabled={ aiSearchMutation.isPending }
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/8 text-primary">
            <FiDollarSign className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">Budget-friendly options</span>
            <span className="text-xs text-muted-foreground">Find affordable workspace deals</span>
          </div>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-auto grid grid-cols-[40px_1fr] items-center gap-3 rounded-2xl border-2 bg-card/50 px-4 py-3 text-left text-foreground shadow-none hover:text-foreground hover:bg-[oklch(0.955_0.02_204.6929)] dark:hover:bg-[oklch(0.24_0.02_204.6929)] hover:border-border border-border/50 transition-colors"
          onClick={ () => setPromptInput('Find spaces with high-speed Wi-Fi and quiet environment') }
          disabled={ aiSearchMutation.isPending }
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/8 text-primary">
            <FiWifi className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">Best amenities</span>
            <span className="text-xs text-muted-foreground">Fast Wi-Fi, meeting rooms, and more</span>
          </div>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-auto grid grid-cols-[40px_1fr] items-center gap-3 rounded-2xl border-2 bg-card/50 px-4 py-3 text-left text-foreground shadow-none hover:text-foreground hover:bg-[oklch(0.955_0.02_204.6929)] dark:hover:bg-[oklch(0.24_0.02_204.6929)] hover:border-border border-border/50 transition-colors"
          onClick={ () => setPromptInput('Help me book a workspace for tomorrow') }
          disabled={ aiSearchMutation.isPending }
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/8 text-primary">
            <FiCalendar className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">Book for tomorrow</span>
            <span className="text-xs text-muted-foreground">Quick booking assistance</span>
          </div>
        </Button>
      </div>
    );
    const form = (
      <form
        onSubmit={ handleSubmit }
        className={ cn(
          'mx-auto flex w-full max-w-4xl flex-row items-center gap-1 rounded-full border border-border/50 bg-muted/30 p-1 ring-1 ring-border/20 backdrop-blur dark:bg-background supports-[backdrop-filter]:dark:bg-background/90',
          placement === 'inline' ? 'mt-8 mb-8' : ''
        ) }
      >
        <label htmlFor="ai-assistant-input" className="sr-only">
          Ask anything about coworking spaces
        </label>
        <Input
          id="ai-assistant-input"
          value={ query }
          onChange={ (event) => setQuery(event.target.value) }
          placeholder="Ask me to find your perfect workspace..."
          aria-label="AI assistant query"
          disabled={ aiSearchMutation.isPending }
          className="h-14 flex-1 rounded-full border-none bg-background text-base focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent sm:text-lg"
        />
        <div className="flex items-center justify-end gap-2 pr-2 sm:justify-end">
          <Button
            type="button"
            aria-label="Use voice input"
            aria-pressed={ isVoiceActive }
            onClick={ handleVoiceButtonClick }
            disabled={ !isVoiceSupported || aiSearchMutation.isPending }
            variant="ghost"
            className={ cn(
              'relative h-10 w-10 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary',
              isVoiceActive && 'text-primary hover:text-primary hover:bg-primary/10'
            ) }
          >
            <span
              className={ cn(
                'flex h-full w-full items-center justify-center rounded-full'
              ) }
            >
              <MicGradientIcon
                className={ cn(isVoiceActive && 'animate-pulse') }
              />
              <span className="sr-only">
                { isVoiceActive ? 'Stop voice input' : 'Start voice input' }
              </span>
            </span>
          </Button>
          <Button
            type="submit"
            size="icon"
            aria-label={
              aiSearchMutation.isPending ? 'Stop AI response' : 'Send message to AI assistant'
            }
            disabled={ !aiSearchMutation.isPending && query.trim().length === 0 }
            className={ cn(
              'rounded-full size-10',
              aiSearchMutation.isPending
                ? 'bg-destructive/15 hover:bg-destructive/20 dark:bg-[oklch(0.24_0.04_19.81)] dark:hover:bg-[oklch(0.24_0.04_19.81)]'
                : 'bg-primary text-primary-foreground dark:bg-secondary dark:text-background dark:hover:bg-secondary/85'
            ) }
          >
            { aiSearchMutation.isPending ? (
              <IoStop className="size-5 text-destructive" aria-hidden="true" />
            ) : (
              <CiLocationArrow1 className="size-5 text-background" strokeWidth={ 2 } aria-hidden="true" />
            ) }
          </Button>
        </div>
      </form>
    );

    return (
      <div
        className={
          placement === 'fixed'
            ? 'fixed inset-x-0 bottom-0 z-30 px-4 flex justify-center'
            : 'w-full max-w-4xl px-4'
        }
        style={ placement === 'fixed' ? bottomBarOffsets : undefined }
      >
        <div className="w-full max-w-4xl">
          { form }
          { shouldShowPrebuiltPrompts ? (
            <div className="mx-auto mt-6 w-full max-w-3xl">
              { prebuiltPrompts }
            </div>
          ) : null }
          { locationError && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              { locationError }
            </p>
          ) }
        </div>
      </div>
    );
  };

  if (sessionLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center px-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="space-y-4 p-6">
            <GradientSparklesIcon className="mx-auto size-10" />
            <h2 className="text-lg font-semibold">Sign in to use the AI assistant</h2>
            <p className="text-sm text-muted-foreground">
              Create an account or sign in to chat with UpSpace AI, search for workspaces, and book your ideal spot.
            </p>
            <Button asChild className="w-full">
              <Link href="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-screen w-full">
      <div
        className={ cn(
          'relative mx-auto flex h-full min-h-full min-h-screen w-full max-w-4xl flex-1 flex-col gap-4 px-4 pb-32 sm:pb-36 md:pb-40',
          'overflow-hidden'
        ) }
      >
        <div className="relative z-10 flex items-center gap-2 pt-6">
          <AiChatSidebar
            activeConversationId={ activeConversationId }
            onSelectConversation={ handleSelectConversation }
            onNewConversation={ handleNewConversation }
          />
        </div>

      { !hasMessages ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center -mt-20 relative">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent blur-2xl opacity-50" />
          <div className="space-y-4">
            <h1 className="greeting-appear text-4xl font-instrument-serif font-semibold leading-tight bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent sm:text-5xl md:text-6xl lg:text-7xl">
              Hi, { greetingName }
            </h1>
            <p className="mx-auto max-w-2xl text-base text-muted-foreground">
              I can help you find spaces, compare options, estimate costs, and guide you through booking your ideal workspace.
            </p>
          </div>
          { renderPromptForm('inline') }
        </div>
      ) : (
        <>
          <div className="flex flex-1 flex-col gap-6 overflow-hidden max-w-4xl mx-auto w-full">
            <Card className="border-none h-full bg-transparent">
              <CardContent className="flex h-full flex-col space-y-6 p-0 sm:p-2">
                <div className="flex-1 overflow-hidden rounded-md border-none bg-transparent">
                  <ScrollArea className="h-full w-full">
                    <div
                      ref={ lineContainerRef }
                      className="relative space-y-6 px-1 py-4"
                    >
                      <div
                        className="pointer-events-none absolute left-[1.5rem] w-px border-l-2 border-dashed border-muted/50 z-0"
                        aria-hidden="true"
                        style={
                          linePosition
                            ? {
                              top: linePosition.top,
                              height: linePosition.height,
                            }
                            : { display: 'none', }
                        }
                      />
                      { messages.map((message) => (
                        <MessageBubble
                          key={ message.id }
                          message={ message }
                          iconRef={
                            message.role === 'assistant'
                              ? registerIconRef(message.id)
                              : undefined
                          }
                        />
                      )) }

                      { isThinking ? (
                        <MessageBubble
                          message={ {
                            id: 'assistant-thinking',
                            role: 'assistant',
                            content: 'Thinking…',
                          } }
                          isThinking
                          iconRef={ registerIconRef('assistant-thinking') }
                        />
                      ) : null }

                      <div ref={ scrollAnchorRef } />
                    </div>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </div>

          <BottomGradientOverlay heightClassName="h-[20vh]" className="z-20" />

          { renderPromptForm('fixed') }
        </>
      ) }
      </div>
    </div>
  );
}
