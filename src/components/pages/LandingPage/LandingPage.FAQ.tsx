'use client';

import * as React from 'react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent
} from '@/components/ui/accordion';
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
      className={cn('w-full mt-16', className)}
      aria-label="Frequently Asked Questions"
    >
      <Accordion
        type={type}
        value={open as any}
        onValueChange={handleValueChange as any}
        defaultValue={undefined}
        {...(!allowMultiple && { collapsible })}
        className="rounded-lg border"
      >
        {normalized.map((item) => (
          <AccordionItem key={item._id} value={item._id}>
            <AccordionTrigger className="text-base p-4 cursor-pointer">
              <span id={item._id} className="scroll-mt-24">
                {item.question}
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-8 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {jsonLdData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData) }}
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
  },
];

export function FAQs() {
  return (
    <div
      id="faqs"
      className="mx-auto max-w-3xl min-h-screen flex flex-col justify-center items-center py-16"
    >
      <h2 className="mb-2 text-[3rem] text-center font-semibold">
        Frequently Answered Questions
      </h2>
      <p className="text-lg text-[1rem] text-muted-foreground text-center">
        Quick answers to common questions.
      </p>
      <Faq
        items={faqs}
        allowMultiple
        jsonLd
        onToggle={(id, open) => {
          // track analytics if needed
        }}
      />
    </div>
  );
}
