"use client";

import React from "react";
import { useMutation } from "@tanstack/react-query";
import { FiAlertCircle, FiLoader, FiSend } from "react-icons/fi";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUserProfile } from "@/hooks/use-user-profile";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type SpeechRecognitionErrorCode =
  | "no-speech"
  | "aborted"
  | "audio-capture"
  | "network"
  | "not-allowed"
  | "service-not-allowed"
  | "bad-grammar"
  | "language-not-supported"
  | string;

type SpeechRecognitionAlternative = {
  transcript: string;
  confidence: number;
};

type SpeechRecognitionResult = {
  0: SpeechRecognitionAlternative;
  length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
};

type SpeechRecognitionResultList = {
  0: SpeechRecognitionResult;
  length: number;
  [index: number]: SpeechRecognitionResult;
};

type SpeechRecognitionErrorEvent = Event & {
  error: SpeechRecognitionErrorCode;
  message?: string;
};

type SpeechRecognitionEvent = Event & {
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionWithWebkit = {
  new (): {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onstart: ((event: Event) => void) | null;
    onend: ((event: Event) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
  };
};

type WindowWithSpeechRecognition = Window &
  typeof globalThis & {
    webkitSpeechRecognition?: SpeechRecognitionWithWebkit;
    SpeechRecognition?: SpeechRecognitionWithWebkit;
  };

const makeMessageId = (role: ChatMessage["role"]) =>
  `${role}-${
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Date.now().toString(36)
  }`;

const shimmerTextStyle: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(120deg, var(--secondary) 0%, #28a745 35%, #ffc107 60%, #ff8c00 85%, #ff6f00 100%)",
  backgroundSize: "250% 100%",
  animation: "shimmerLoading 1.3s linear infinite",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
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
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-6", className)}
      aria-hidden={props["aria-label"] ? undefined : "true"}
      {...props}
    >
      <defs>
        <linearGradient
          id={gradientId}
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
        <filter id={motionBlurId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0">
            {blurAnimation}
          </feGaussianBlur>
        </filter>
      </defs>
      <g filter={isThinking ? `url(#${motionBlurId})` : undefined}>
        {rotationAnimation}
        <path
          d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
          stroke={stroke}
        />
        <path d="M20 3v4" stroke={stroke} />
        <path d="M22 5h-4" stroke={stroke} />
        <path d="M4 17v2" stroke={stroke} />
        <path d="M5 18H3" stroke={stroke} />
      </g>
    </svg>
  );
}

function MicGradientIcon({ className }: { className?: string }) {
  const gradientId = React.useId();

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-5", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <path
        d="M12 1a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z"
        stroke={`url(#${gradientId})`}
      />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke={`url(#${gradientId})`} />
      <line x1="12" y1="19" x2="12" y2="23" stroke={`url(#${gradientId})`} />
      <line x1="8" y1="23" x2="16" y2="23" stroke={`url(#${gradientId})`} />
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
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 items-center",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser && (
        <div
          ref={iconRef}
          className="relative z-10 mt-0.5 flex size-12 items-center justify-center rounded-full bg-cyan-100 text-cyan-900 dark:bg-cyan-900/30 dark:text-cyan-100"
        >
          <GradientSparklesIcon isThinking={isThinking} />
          <span className="sr-only">Gemini</span>
        </div>
      )}
      <div
        className={cn(
          "max-w-[720px] whitespace-pre-wrap rounded-md border px-4 py-3 text-sm shadow-sm",
          isUser
            ? "bg-primary/10 border-primary/30 text-foreground"
            : "bg-muted/60 border-border/60 text-foreground",
        )}
      >
        {isThinking ? (
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <span style={shimmerTextStyle}>Gemini is thinking...</span>
          </span>
        ) : (
          message.content
        )}
      </div>
    </div>
  );
}

export function AiSearch() {
  const [query, setQuery] = React.useState("");
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [voiceError, setVoiceError] = React.useState<string | null>(null);
  const [isListening, setIsListening] = React.useState(false);
  const [isVoiceSupported, setIsVoiceSupported] = React.useState(false);
  const scrollAnchorRef = React.useRef<HTMLDivElement | null>(null);
  const recognitionRef =
    React.useRef<InstanceType<SpeechRecognitionWithWebkit> | null>(null);
  const lineContainerRef = React.useRef<HTMLDivElement | null>(null);
  const iconRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const [linePosition, setLinePosition] = React.useState<{
    top: number;
    height: number;
  } | null>(null);
  const hasMessages = messages.length > 0;
  const { data: userProfile } = useUserProfile();

  const greetingName = React.useMemo(() => {
    const firstName = userProfile?.firstName?.trim();
    if (firstName) {
      return firstName;
    }

    const handle = userProfile?.handle?.trim();
    if (handle) {
      return handle;
    }

    return "UpSpace User";
  }, [userProfile]);

  const aiSearchMutation = useMutation<string, Error, string>({
    mutationFn: async (prompt: string) => {
      const response = await fetch("/api/v1/ai-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: prompt }),
        cache: "no-store",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const detail =
          data?.detail && typeof data.detail === "string" ? data.detail : null;
        const message =
          data?.error && typeof data.error === "string"
            ? data.error
            : "Unable to reach Gemini right now.";
        const combined = detail ? `${message} (${detail})` : message;
        throw new Error(combined);
      }

      if (!data || typeof data.reply !== "string") {
        throw new Error("Unexpected response from Gemini.");
      }

      return data.reply.trim();
    },
  });

  const isThinking = aiSearchMutation.isPending;

  React.useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, isThinking]);

  const assistantIds = React.useMemo(() => {
    const assistantMessageIds = messages
      .filter((message) => message.role === "assistant")
      .map((message) => message.id);

    if (isThinking) {
      assistantMessageIds.push("assistant-thinking");
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
    [],
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
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [measureLine]);

  React.useEffect(() => {
    const ctor: SpeechRecognitionWithWebkit | null =
      typeof window === "undefined"
        ? null
        : ((window as WindowWithSpeechRecognition).SpeechRecognition ??
          (window as WindowWithSpeechRecognition).webkitSpeechRecognition ??
          null);

    if (!ctor) {
      setIsVoiceSupported(false);
      return;
    }

    setIsVoiceSupported(true);
    const recognition = new ctor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event) => {
      setIsListening(false);
      const message =
        event.error === "no-speech"
          ? "No speech detected. Try again."
          : event.error === "not-allowed" ||
              event.error === "service-not-allowed"
            ? "Microphone access is blocked. Please allow mic permissions."
            : "Voice input could not start. Please try again.";
      setVoiceError(message);
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (!transcript) return;
      setVoiceError(null);
      setQuery((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (aiSearchMutation.isPending) return;

    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    const userMessage: ChatMessage = {
      id: makeMessageId("user"),
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setQuery("");
    setErrorMessage(null);

    aiSearchMutation.mutate(trimmed, {
      onSuccess: (reply) => {
        setMessages((prev) => [
          ...prev,
          {
            id: makeMessageId("assistant"),
            role: "assistant",
            content: reply,
          },
        ]);
      },
      onError: (mutationError) => {
        const fallback = mutationError.message || "Gemini could not reply.";
        setErrorMessage(fallback);
        setMessages((prev) => [
          ...prev,
          {
            id: makeMessageId("assistant"),
            role: "assistant",
            content: `Sorry, I could not complete that request: ${fallback}`,
          },
        ]);
      },
    });
  };

  const handleToggleVoice = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setVoiceError("Voice input is not supported in this browser.");
      return;
    }

    if (aiSearchMutation.isPending) {
      return;
    }

    setVoiceError(null);

    try {
      if (isListening) {
        recognition.stop();
      } else {
        recognition.start();
      }
    } catch (startError) {
      setIsListening(false);
      setVoiceError("Voice input could not start. Please try again.");
    }
  };

  return (
    <div
      className={cn(
        "relative mx-auto flex h-full min-h-full w-full max-w-5xl flex-col gap-6 px-4 pt-8 pb-4 sm:pt-12 sm:pb-6 md:pt-14 md:pb-8",
        "overflow-hidden",
      )}
    >
      {!hasMessages && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <h1 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
            Hi, {greetingName}
          </h1>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-6 overflow-hidden">
        {hasMessages && (
          <Card className="border-none h-full">
            <CardContent className="flex h-full flex-col space-y-6 p-6 sm:p-8">
              {errorMessage && (
                <div className="inline-flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <FiAlertCircle className="size-4" aria-hidden="true" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="flex-1 overflow-hidden rounded-md border-none bg-background/60">
                <ScrollArea className="h-full w-full">
                  <div
                    ref={lineContainerRef}
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
                          : { display: "none" }
                      }
                    />
                    {messages.map((message) => (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        iconRef={
                          message.role === "assistant"
                            ? registerIconRef(message.id)
                            : undefined
                        }
                      />
                    ))}

                    {isThinking ? (
                      <MessageBubble
                        message={{
                          id: "assistant-thinking",
                          role: "assistant",
                          content: "Thinking…",
                        }}
                        isThinking
                        iconRef={registerIconRef("assistant-thinking")}
                      />
                    ) : null}

                    <div ref={scrollAnchorRef} />
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="sticky bottom-[calc(0.75rem+var(--safe-area-bottom,0px))] z-30 mt-auto flex w-full justify-center sm:bottom-[calc(1rem+var(--safe-area-bottom,0px))]"
      >
        <label htmlFor="ai-search-input" className="sr-only">
          Ask anything about coworking spaces
        </label>
        <div className="flex w-full max-w-4xl flex-col gap-2 rounded-md border border-border/50 bg-background/95 p-2 shadow-2xl ring-1 ring-border/40 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:flex-row sm:items-center sm:gap-3">
          <Input
            id="ai-search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a quiet meeting room with whiteboards near BGC next Friday"
            aria-label="AI search query"
            disabled={aiSearchMutation.isPending}
            className="h-16 border-none bg-transparent text-sm focus-visible:ring-0 focus-visible:ring-offset-0 sm:h-12 sm:text-base"
          />
          <div className="flex items-center justify-end gap-2 sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Use voice input"
              aria-pressed={isListening}
              onClick={handleToggleVoice}
              disabled={!isVoiceSupported}
              className={cn(
                "relative bg-muted text-muted-foreground transition-shadow hover:text-foreground",
                isListening &&
                  "ring-2 ring-cyan-400/60 bg-cyan-50 text-foreground dark:bg-cyan-900/30",
              )}
            >
              <MicGradientIcon className={cn(isListening && "animate-pulse")} />
            </Button>
            <Button
              type="submit"
              size="icon"
              aria-label="Send AI search"
              disabled={aiSearchMutation.isPending || query.trim().length === 0}
              className="dark:bg-cyan-400 text-background dark:hover:bg-cyan-300 bg-primary"
            >
              {aiSearchMutation.isPending ? (
                <FiLoader className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <FiSend className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>
        {voiceError && (
          <p className="text-center text-xs text-destructive">{voiceError}</p>
        )}
      </form>
    </div>
  );
}
