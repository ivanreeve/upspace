'use client';

import * as React from 'react';

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type FaqItem = {
  id?: string;
  question: string;
  answer: React.ReactNode;
  answerText?: string;
};

type FaqProps = {
  items: FaqItem[];
  className?: string;
  allowMultiple?: boolean;
  defaultOpenIds?: string[];
  collapsible?: boolean;
  jsonLd?: boolean;
  onToggle?(id: string, open: boolean): void;
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
  jsonLd = true,
  onToggle,
}: FaqProps) {
  const normalized = React.useMemo(
    () =>
      items.map((it) => ({
        ...it,
        _id: it.id ?? toSlug(it.question),
      })),
    [items]
  );

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
    if (onToggle) {
      const opened = new Set(Array.isArray(next) ? next : [next]);
      normalized.forEach((it) => onToggle(it._id, opened.has(it._id)));
    }
  }

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
      className={cn('w-full', className)}
      aria-label="Frequently Asked Questions"
    >
      <Accordion
        type={type}
        value={open as any}
        onValueChange={handleValueChange as any}
        defaultValue={undefined}
        {...(!allowMultiple && { collapsible, })}
        className="rounded-md border border-border/60 bg-background backdrop-blur"
      >
        {normalized.map((item) => (
          <AccordionItem
            key={item._id}
            value={item._id}
            className="border-b border-border/40 last:border-b-0 first:rounded-t-md last:rounded-b-md overflow-hidden"
          >
            <AccordionTrigger className="group flex items-start gap-4 px-6 py-6 text-left text-base font-medium transition hover:text-foreground hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-lg">
              <span id={item._id} className="scroll-mt-24">
                {item.question}
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6 text-base text-left leading-relaxed text-muted-foreground [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:ml-5 [&_ul]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {jsonLdData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData), }}
        />
      )}
    </section>
  );
}

const faqs: FaqItem[] = [
  {
    question: 'How do I find and book a coworking space?',
    answer: <p>Browse available spaces using filters like location, pricing, and amenities. Once you find the right space, complete the booking through the app.</p>,
    answerText: 'Browse, filter, and book coworking spaces directly within the app.',
  },
  {
    question: 'Can I save spaces I’m interested in?',
    answer: <p>Yes. You can bookmark spaces to revisit them later from your “Shortlisted” tab.</p>,
    answerText: 'Bookmark coworking spaces to review and compare them later.',
  },
  {
    question: 'What payment methods do you support?',
    answer: <p>We support all major credit cards, debit cards, and digital wallets. Payments are processed securely through our integrated gateway.</p>,
    answerText: 'Supports credit, debit, and digital wallet payments via secure gateway.',
  },
  {
    question: 'How can partners list their coworking spaces?',
    answer: <p>Partners can register and verify their business through the Partner Portal, then use the “Listing Management” dashboard to add or update spaces.</p>,
    answerText: 'Partners list and manage their spaces via the Partner Portal after verification.',
  },
  {
    question: 'Do partners receive payouts automatically?',
    answer: <p>Yes. Payouts are automatically processed after the booking is confirmed and the stay period completes, per the agreed terms.</p>,
    answerText: 'Partner payouts are automated post-booking completion.',
  },
  {
    question: 'How is user data protected?',
    answer: <p>All data is encrypted and handled in compliance with industry privacy standards. Access controls ensure only authorized users manage data.</p>,
    answerText: 'User data is encrypted and secured per privacy best practices.',
  },
  {
    question: 'Is there map-based search?',
    answer: <p>Yes. The app integrates with Maps so you can search, view, and navigate to coworking spaces near your location.</p>,
    answerText: 'Map-based search helps locate coworking spaces nearby.',
  }
];

export function FAQs() {
  return (
    <section
      id="faqs"
      className="relative py-24 sm:py-32"
    >
      <div className="mx-auto max-w-4xl space-y-10 text-center">
        <div className="space-y-5">
          <Badge variant="secondary" className="mx-auto w-fit uppercase tracking-wide">
            Frequently Answered Questions
          </Badge>
          <h2 className="text-4xl font-instrument-serif tracking-tight text-balance sm:text-[2.75rem]">
            Answers to keep your bookings moving.
          </h2>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
            Everything you need to know about finding your next workspace and partnering with UpSpace, in one place.
          </p>
        </div>
        <Faq
          items={faqs}
          allowMultiple
          jsonLd
          onToggle={(id, open) => {
            // track analytics if needed
          }}
          className="mx-auto max-w-3xl"
        />
      </div>
    </section>
  );
}
