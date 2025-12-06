'use client';

import React from 'react';
import { useMutation } from '@tanstack/react-query';
import {
FiAlertCircle,
FiLoader,
FiMic,
FiSend
} from 'react-icons/fi';
import { LuSparkles } from 'react-icons/lu';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const makeMessageId = (role: ChatMessage['role']) =>
  `${role}-${
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Date.now().toString(36)
  }`;

function MessageBubble({
  message,
  isThinking = false,
}: {
  message: ChatMessage;
  isThinking?: boolean;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={ cn('flex gap-3', isUser ? 'justify-end' : 'justify-start') }>
      { !isUser && (
        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-cyan-100 text-cyan-900 dark:bg-cyan-900/30 dark:text-cyan-100">
          <LuSparkles className="size-4" aria-hidden="true" />
          <span className="sr-only">Gemini</span>
        </div>
      ) }
      <div
        className={ cn(
          'max-w-[720px] whitespace-pre-wrap rounded-md border px-4 py-3 text-sm shadow-sm',
          isUser
            ? 'bg-primary/10 border-primary/30 text-foreground'
            : 'bg-muted/60 border-border/60 text-foreground'
        ) }
      >
        { isThinking ? (
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <FiLoader className="size-4 animate-spin" aria-hidden="true" />
            <span>Gemini is thinking...</span>
          </span>
        ) : (
          message.content
        ) }
      </div>
    </div>
  );
}

export function AiSearch() {
  const [query, setQuery] = React.useState('');
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const aiSearchMutation = useMutation<string, Error, string>({
    mutationFn: async (prompt: string) => {
      const response = await fetch('/api/v1/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ query: prompt, }),
        cache: 'no-store',
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

      return data.reply.trim();
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (aiSearchMutation.isPending) return;

    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    const userMessage: ChatMessage = {
      id: makeMessageId('user'),
      role: 'user',
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setQuery('');
    setErrorMessage(null);

    aiSearchMutation.mutate(trimmed, {
      onSuccess: (reply) => {
        setMessages((prev) => [
          ...prev,
          {
            id: makeMessageId('assistant'),
            role: 'assistant',
            content: reply,
          }
        ]);
      },
      onError: (mutationError) => {
        const fallback = mutationError.message || 'Gemini could not reply.';
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
  };

  return (
    <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:py-14 md:py-16">
      <div className="pointer-events-none absolute inset-x-0 top-6 -z-10 h-48 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.08),_transparent_65%)]" />

      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge variant="secondary" className="rounded-md">
            <LuSparkles className="mr-1 size-4" aria-hidden="true" />
            Gemini
          </Badge>
          <Badge variant="outline" className="rounded-md text-muted-foreground">
            Beta
          </Badge>
        </div>
        <h1 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
          AI Search for coworking spaces
        </h1>
      </div>

      <Card className="border-none">
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div
            ref={ scrollRef }
            className="flex max-h-[520px] flex-col gap-4 overflow-y-auto rounded-md border border-border/70 bg-background/60 p-4"
            aria-live="polite"
          >
            { messages.map((message) => (
              <MessageBubble key={ message.id } message={ message } />
            )) }

            { aiSearchMutation.isPending && (
              <MessageBubble
                message={ {
                  id: 'assistant-thinking',
                  role: 'assistant',
                  content: 'Thinking...',
                } }
                isThinking
              />
            ) }
          </div>

          { errorMessage && (
            <div className="inline-flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <FiAlertCircle className="size-4" aria-hidden="true" />
              <span>{ errorMessage }</span>
            </div>
          ) }

          <form onSubmit={ handleSubmit } className="flex flex-col gap-4">
            <label htmlFor="ai-search-input" className="sr-only">
              Ask anything about coworking spaces
            </label>
            <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/70 p-2 shadow-sm sm:flex-row sm:items-center sm:gap-3">
              <Input
                id="ai-search-input"
                value={ query }
                onChange={ (event) => setQuery(event.target.value) }
                placeholder="Find a quiet meeting room with whiteboards near BGC next Friday"
                aria-label="AI search query"
                disabled={ aiSearchMutation.isPending }
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
                  disabled={
                    aiSearchMutation.isPending || query.trim().length === 0
                  }
                  className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                >
                  { aiSearchMutation.isPending ? (
                    <FiLoader
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <FiSend className="size-4" aria-hidden="true" />
                  ) }
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              AI responses may be inaccurate. Please verify details before
              booking.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
