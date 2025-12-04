'use client';

import React from 'react';
import {
  FiLoader,
  FiMic,
  FiSend
} from 'react-icons/fi';
import { LuSparkles } from 'react-icons/lu';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function AiSearch() {
  const [query, setQuery] = React.useState('');
  const [submittedPrompt, setSubmittedPrompt] = React.useState<string | null>(null);
  const [isSending, setIsSending] = React.useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();

    if (!trimmed) {
      return;
    }

    setIsSending(true);
    window.setTimeout(() => {
      setSubmittedPrompt(trimmed);
      setIsSending(false);
    }, 300);
    setQuery('');
  };

  return (
    <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:py-14 md:py-16">
      <div className="pointer-events-none absolute inset-x-0 top-6 -z-10 h-48 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.08),_transparent_65%)]" />
      <Card className="border-none">
        <CardContent className="space-y-6 p-6 sm:p-8">
          <form onSubmit={ handleSubmit } className="flex flex-col gap-4">
            <label htmlFor="ai-search-input" className="sr-only">
              Ask anything about coworking spaces
            </label>
            <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-background/70 p-2 shadow-sm sm:flex-row sm:items-center sm:gap-3">
              <Input
                id="ai-search-input"
                value={ query }
                onChange={ (event) => setQuery(event.target.value) }
                placeholder="Find a quiet meeting room with whiteboards near BGC next Friday"
                aria-label="AI search query"
                className="border-none bg-transparent text-base focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Use voice input"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <FiMic className="size-5" aria-hidden="true" />
                </Button>
                <Button
                  type="submit"
                  size="icon"
                  aria-label="Send AI search"
                  disabled={ isSending || query.trim().length === 0 }
                  className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                >
                  { isSending ? (
                    <FiLoader className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <FiSend className="size-4" aria-hidden="true" />
                  ) }
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
