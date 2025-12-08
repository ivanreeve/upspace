'use client';

import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { FiAlertCircle, FiSend } from 'react-icons/fi';
import { IoStop } from 'react-icons/io5';
import { toast } from 'sonner';

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

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  spaceResults?: Space[];
};

const makeMessageId = (role: ChatMessage['role']) =>
  `${role}-${
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Date.now().toString(36)
  }`;

const shimmerTextStyle: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(120deg, var(--secondary) 0%, #28a745 35%, #ffc107 60%, #ff8c00 85%, #ff6f00 100%)',
  backgroundSize: '250% 100%',
  animation: 'shimmerLoading 1.3s linear infinite',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
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
          <stop offset="35%" stopColor="#28a745" />
          <stop offset="60%" stopColor="#ffc107" />
          <stop offset="85%" stopColor="#ff8c00" />
          <stop offset="100%" stopColor="#ff6f00" />
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
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#f59e0b" />
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

function MessageBubble({
  message,
  isThinking = false,
  iconRef,
}: {
  message: ChatMessage;
  isThinking?: boolean;
  iconRef?: (node: HTMLDivElement | null) => void;
}) {
  const isUser = message.role === 'user';
  const hasSpaceResults = Boolean(message.spaceResults?.length);
  const hasContent = message.content.trim().length > 0;
  const shouldShowBubble = isThinking || (!hasSpaceResults && hasContent);

  return (
    <div
      className={ cn(
        'flex gap-3 items-center',
        isUser ? 'justify-end' : 'justify-start'
      ) }
    >
      { !isUser && (
        <div
          ref={ iconRef }
          className="relative z-10 mt-0.5 flex size-12 items-center justify-center rounded-full bg-cyan-100 text-cyan-900 dark:bg-cyan-900/30 dark:text-cyan-100"
        >
          <GradientSparklesIcon isThinking={ isThinking } />
          <span className="sr-only">Gemini</span>
        </div>
      ) }
      { shouldShowBubble ? (
        <div
          className={ cn(
            'max-w-[720px] rounded-md border px-4 py-3 text-sm shadow-sm',
            isUser
              ? 'bg-primary/10 border-primary/30 text-foreground'
              : 'bg-muted/60 border-border/60 text-foreground'
          ) }
        >
          { isThinking ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <span style={ shimmerTextStyle }>UpSpace is searching...</span>
            </span>
          ) : (
            <span className="whitespace-pre-wrap">{ message.content }</span>
          ) }
        </div>
      ) : null }
      { hasSpaceResults ? (
        <div className="mt-3 w-full max-w-[720px]">
          { (message.spaceResults?.length ?? 0) > 1 ? (
            <div className="relative">
              <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory touch-pan-x">
                { message.spaceResults!.map((space) => (
                  <div
                    key={ space.space_id }
                    className="min-w-[320px] max-w-[360px] snap-start"
                  >
                    <SpaceCard space={ space } />
                  </div>
                )) }
              </div>
            </div>
          ) : (
            <SpaceCard space={ message.spaceResults![0] } />
          ) }
        </div>
      ) : null }
    </div>
  );
}

export function AiSearch() {
  const [query, setQuery] = React.useState('');
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
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
    { reply: string; spaces?: Space[] },
    Error,
    ChatMessage[]
  >({
    mutationFn: async (history: ChatMessage[]) => {
      if (!history.length) {
        throw new Error('Please enter a question.');
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch('/api/v1/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          messages: history.map(({
 role, content, 
}) => ({
            role,
            content: content.trim(),
          })),
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
            : 'Unable to reach Gemini right now.';
        const combined = detail ? `${message} (${detail})` : message;
        throw new Error(combined);
      }

      if (!data || typeof data.reply !== 'string') {
        throw new Error('Unexpected response from Gemini.');
      }

      return {
        reply: data.reply.trim(),
        spaces: Array.isArray(data.spaces) ? data.spaces : [],
      };
    },
    onSettled: () => {
      abortControllerRef.current = null;
    },
  });

  const submitPrompt = React.useCallback(
    (rawPrompt: string) => {
      if (aiSearchMutation.isPending) return;

      const trimmed = rawPrompt.trim();
      if (!trimmed) {
        return;
      }

      const userMessage: ChatMessage = {
        id: makeMessageId('user'),
        role: 'user',
        content: trimmed,
      };

      setQuery('');
      setErrorMessage(null);

      setMessages((previous) => {
        const history = [...previous, userMessage];

        aiSearchMutation.mutate(history, {
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
              }
            ]);
          },
          onError: (mutationError) => {
            if (mutationError.name === 'AbortError') {
              return;
            }
            const fallback =
              mutationError.message || 'UpSpace could not reply.';
            setErrorMessage(fallback);
            setMessages((prev) => [
              ...prev,
              {
                id: makeMessageId('assistant'),
                role: 'assistant',
                content: `Sorry, I could not complete that request: ${fallback}`,
              }
            ]);
          },
        });

        return history;
      });
    },
    [aiSearchMutation]
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
  const containerTopPadding = 'pt-0 sm:pt-0 md:pt-0';
  const bottomBarOffsets = React.useMemo<React.CSSProperties>(() => {
    if (isMobile) {
      return {
        left: 0,
        right: 0,
        paddingBottom: 'calc(0.75rem + var(--safe-area-bottom, 0px))',
      };
    }

    const sidebarOffset =
      state === 'collapsed'
        ? 'var(--sidebar-width-icon)'
        : 'var(--sidebar-width)';

    return {
      left: sidebarOffset,
      right: 0,
      paddingBottom: 'calc(1rem + var(--safe-area-bottom, 0px))',
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

    submitPrompt(query);
  };

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
    const form = (
      <form
        onSubmit={ handleSubmit }
        className={ cn(
          'mx-auto flex w-full max-w-4xl flex-col gap-2 rounded-md border border-border/50 bg-background/95 p-2 ring-1 ring-border/40 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:flex-row sm:items-center sm:gap-3',
          placement === 'inline' && 'mt-6 bg-background/80'
        ) }
      >
        <label htmlFor="ai-search-input" className="sr-only">
          Ask anything about coworking spaces
        </label>
        <Input
          id="ai-search-input"
          value={ query }
          onChange={ (event) => setQuery(event.target.value) }
          placeholder="Ask Anything"
          aria-label="AI search query"
          disabled={ aiSearchMutation.isPending }
          className="h-16 border-none bg-transparent text-sm focus-visible:ring-0 focus-visible:ring-offset-0 sm:h-12 sm:text-base"
        />
        <div className="flex items-center justify-end gap-2 sm:justify-end">
          <Button
            type="button"
            aria-label="Use voice input"
            aria-pressed={ isVoiceActive }
            onClick={ handleVoiceButtonClick }
            disabled={ !isVoiceSupported || aiSearchMutation.isPending }
            className={ cn(
              'relative h-10 w-10 rounded-full p-[2px] text-muted-foreground transition-shadow hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary',
              isVoiceActive
                ? 'bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-400'
                : 'bg-muted'
            ) }
          >
            <span
              className={ cn(
                'flex h-full w-full items-center justify-center rounded-full bg-muted',
                isVoiceActive && 'bg-background text-foreground'
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
              aiSearchMutation.isPending ? 'Stop AI response' : 'Send AI search'
            }
            disabled={ !aiSearchMutation.isPending && query.trim().length === 0 }
            className="dark:bg-cyan-400 text-background dark:hover:bg-cyan-300 bg-primary"
          >
            { aiSearchMutation.isPending ? (
              <IoStop className="size-4 text-background" aria-hidden="true" />
            ) : (
              <FiSend className="size-4 text-background" aria-hidden="true" />
            ) }
          </Button>
        </div>
      </form>
    );

    return (
      <div
        className={
          placement === 'fixed'
            ? 'fixed inset-x-0 bottom-0 z-30 px-4'
            : 'w-full max-w-4xl px-4'
        }
        style={ placement === 'fixed' ? bottomBarOffsets : undefined }
      >
        { form }
        { locationError && (
          <p className="mt-1 text-center text-xs text-muted-foreground">
            { locationError }
          </p>
        ) }
      </div>
    );
  };

  return (
    <div
      className={ cn(
        'relative mx-auto flex h-full min-h-full min-h-screen w-full max-w-5xl flex-col gap-6 px-4 pb-32 sm:pb-36 md:pb-40',
        containerTopPadding,
        'overflow-hidden'
      ) }
    >
      { !hasMessages ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <h1 className="greeting-appear text-3xl font-semibold leading-tight bg-gradient-to-t from-primary dark:from-gray-400 to-white bg-clip-text text-transparent sm:text-4xl md:text-6xl lg:text-7xl">
            Hi, { greetingName }
          </h1>
          { renderPromptForm('inline') }
        </div>
      ) : (
        <>
          <div className="flex flex-1 flex-col gap-6 overflow-hidden">
            <Card className="border-none h-full">
              <CardContent className="flex h-full flex-col space-y-6 p-6 sm:p-8">
                <div className="flex-1 overflow-hidden rounded-md border-none bg-background/60">
                  <ScrollArea className="h-full w-full">
                    <div
                      ref={ lineContainerRef }
                      className="relative space-y-4 px-3 py-4"
                    >
                      <div
                        className="pointer-events-none absolute left-[2.15rem] border-l-2 border-dotted border-muted opacity-80 z-0"
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

          <BottomGradientOverlay className="z-20" />

          { renderPromptForm('fixed') }
        </>
      ) }
    </div>
  );
}
