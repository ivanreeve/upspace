"use client";

import React from "react";
import { useMutation } from "@tanstack/react-query";
import { FiAlertCircle, FiLoader, FiMic, FiSend } from "react-icons/fi";

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

function GradientSparklesIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  const gradientId = React.useId();
  const stroke = `url(#${gradientId})`;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4", className)}
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
      </defs>
      <path
        d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
        stroke={stroke}
      />
      <path d="M20 3v4" stroke={stroke} />
      <path d="M22 5h-4" stroke={stroke} />
      <path d="M4 17v2" stroke={stroke} />
      <path d="M5 18H3" stroke={stroke} />
    </svg>
  );
}

function MessageBubble({
  message,
  isThinking = false,
}: {
  message: ChatMessage;
  isThinking?: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="mt-0.5 flex size-10 items-center justify-center rounded-full bg-cyan-100 text-cyan-900 dark:bg-cyan-900/30 dark:text-cyan-100">
          <GradientSparklesIcon />
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
            <FiLoader className="size-4 animate-spin" aria-hidden="true" />
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
  const scrollAnchorRef = React.useRef<HTMLDivElement | null>(null);
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

  return (
    <div
      className={cn(
        "relative mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-10 pb-6 sm:pt-14 sm:pb-8 md:pt-16 md:pb-10",
        "min-h-[calc(100vh-6rem)]",
      )}
    >
      {!hasMessages && (
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
            Hi, {greetingName}
          </h1>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-6">
        {hasMessages && (
          <Card className="border-none">
            <CardContent className="space-y-6 p-6 sm:p-8">
              {errorMessage && (
                <div className="inline-flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <FiAlertCircle className="size-4" aria-hidden="true" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="rounded-md border-none bg-background/60">
                <ScrollArea className="h-[360px] max-h-[50vh] w-full sm:max-h-[60vh]">
                  <div className="space-y-4 px-3 py-4">
                    {messages.map((message) => (
                      <MessageBubble key={message.id} message={message} />
                    ))}

                    {isThinking ? (
                      <MessageBubble
                        message={{
                          id: "assistant-thinking",
                          role: "assistant",
                          content: "Thinking…",
                        }}
                        isThinking
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
        className="sticky bottom-[calc(0.75rem+var(--safe-area-bottom,0px))] z-20 mt-auto flex flex-col gap-4 sm:bottom-[calc(1rem+var(--safe-area-bottom,0px))]"
      >
        <label htmlFor="ai-search-input" className="sr-only">
          Ask anything about coworking spaces
        </label>
        <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/90 p-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:flex-row sm:items-center sm:gap-3">
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
              className="text-muted-foreground hover:text-foreground"
              disabled
            >
              <FiMic className="size-5" aria-hidden="true" />
            </Button>
            <Button
              type="submit"
              size="icon"
              aria-label="Send AI search"
              disabled={aiSearchMutation.isPending || query.trim().length === 0}
              className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
            >
              {aiSearchMutation.isPending ? (
                <FiLoader className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <FiSend className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
