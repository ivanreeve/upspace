'use client';

import * as React from 'react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'; // adjust if your path differs
import { IoSearch } from "react-icons/io5";
import { cn } from '@/lib/utils';

export type FaqItem = {
  id?: string;                 // stable id (optional). if absent, slugified from question
  question: string;
  answer: React.ReactNode;     // rich content allowed
  answerText?: string;         // plain text for JSON-LD (optional but recommended)
};

type FaqProps = {
  items: FaqItem[];
  className?: string;
  allowMultiple?: boolean;     // defaults to single
  defaultOpenIds?: string[];   // initial expanded panels
  collapsible?: boolean;       // allow closing the last open item (single mode)
  showSearch?: boolean;        // renders a search input to filter questions
  jsonLd?: boolean;            // outputs FAQPage JSON-LD for SEO
  onToggle?(id: string, open: boolean): void; // analytics hook
};

function toSlug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80);
}

export function Faq({
  items,
  className,
  allowMultiple = false,
  defaultOpenIds,
  collapsible = true,
  showSearch = true,
  jsonLd = true,
  onToggle,
}: FaqProps) {
  const [query, setQuery] = React.useState('');
  const normalized = React.useMemo(
    () =>
      items.map((it) => ({
        ...it,
        _id: it.id ?? toSlug(it.question),
      })),
    [items]
  );

  // Filter by question (fast path); extend to answerText if provided
  const filtered = React.useMemo(() => {
    if (!query.trim()) return normalized;
    const q = query.toLowerCase();
    return normalized.filter(
      (it) =>
        it.question.toLowerCase().includes(q) ||
        (it.answerText?.toLowerCase().includes(q) ?? false)
    );
  }, [normalized, query]);

  // Deep-link: open item if hash matches
  const [open, setOpen] = React.useState<string[] | string | undefined>(() => {
    if (defaultOpenIds?.length) {
      return allowMultiple ? defaultOpenIds : defaultOpenIds[0];
    }
    if (typeof window !== 'undefined' && window.location.hash) {
      const h = window.location.hash.replace('#', '');
      return allowMultiple ? [h] : h;
    }
    return allowMultiple ? [] : undefined;
  });

  React.useEffect(() => {
    const onHashChange = () => {
      const h = window.location.hash.replace('#', '');
      setOpen((prev) => {
        if (allowMultiple) {
          const set = new Set(Array.isArray(prev) ? prev : []);
          set.add(h);
          return Array.from(set);
        }
        return h;
      });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [allowMultiple]);

  const type = allowMultiple ? ('multiple' as const) : ('single' as const);

  function handleValueChange(next: string | string[]) {
    setOpen(next);
    // fire analytics hook
    if (onToggle) {
      const opened = new Set(Array.isArray(next) ? next : [next]);
      normalized.forEach((it) => onToggle(it._id, opened.has(it._id)));
    }
  }

  function copyAnchor(id: string) {
    const url = new URL(window.location.href);
    url.hash = id;
    navigator.clipboard?.writeText(url.toString());
    history.replaceState(null, '', `#${id}`);
  }

  // Build JSON-LD payload
  const jsonLdData =
    jsonLd &&
    normalized.some((it) => it.answerText) && {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: normalized.map((it) => ({
        '@type': 'Question',
        name: it.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: it.answerText ?? '',
        },
      })),
    };

  return (
    <section
      data-slot="faq"
      className={cn('w-full mt-16', className)}
      aria-label="Frequently Asked Questions"
    >
      {showSearch && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative w-full">
            <input
              type="search"
              placeholder="Search FAQs"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <IoSearch
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
          </div>

          {/* Expand/Collapse all only in multiple mode */}
          {allowMultiple && (
            <button
              type="button"
              onClick={() =>
                setOpen(
                  Array.isArray(open) && open.length === filtered.length
                    ? []
                    : filtered.map((f) => f._id)
                )
              }
              className="cursor-pointer whitespace-nowrap rounded-md border px-3 py-2 text-sm outline-none transition hover:underline focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {Array.isArray(open) && open.length === filtered.length
                ? 'Collapse all'
                : 'Expand all'}
            </button>
          )}
        </div>
      )}

      <Accordion
        type={type}
        value={open as any}
        onValueChange={handleValueChange as any}
        defaultValue={undefined}
        collapsible={collapsible}
        className="rounded-lg border"
      >
        {filtered.map((item) => (
          <AccordionItem key={item._id} value={item._id}>
            <AccordionTrigger className="text-base p-4 cursor-pointer">
              <span id={item._id} className="scroll-mt-24">
                {item.question}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pl-8 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {jsonLdData && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData) }}
        />
      )}
    </section>
  );
}

const faqs: FaqItem[] = [
  {
    question: 'How do I reset my password?',
    answer: <p>Use the “Forgot password” flow from the sign-in screen.</p>,
    answerText: 'Use the “Forgot password” flow from the sign-in screen.',
  },
  {
    question: 'What’s your SLA?',
    answer: (
      <p>
        99.9% monthly uptime. See <a href="/legal/sla" className="underline">SLA</a>.
      </p>
    ),
    answerText: '99.9% monthly uptime. See the SLA for specifics.',
  },
];

export function FAQs() {
  return (
    <div id='faqs' className="mx-auto max-w-3xl h-screen flex flex-col justify-center items-center">
      <h2 className="mb-2 text-[3rem] text-center font-semibold">Frequently Answered Questions</h2>
      <p className="mb-6 text-lg text-[1rem] text-muted-foreground text-center">
        Quick answers to operationally unblock users.
      </p>
      <Faq
        items={faqs}
        allowMultiple
        showSearch
        jsonLd
        onToggle={(id, open) => {
          // optional: route to your analytics
          // track('faq_toggle', { id, open });
        }}
      />
    </div>
  );
}
