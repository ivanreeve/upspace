import type { Metadata } from 'next';

import { Footer } from '@/components/ui/footer';

export const metadata: Metadata = {
  title: 'Terms & Conditions | UpSpace',
  description:
    'Read UpSpace’s Terms & Conditions to understand the rules, responsibilities, and guarantees that apply to members and workspace providers.',
};

export default function TermsAndConditionsPage() {
  return (
    <>
      <main className="mx-auto flex max-w-3xl flex-col gap-12 px-4 py-16">
        <section className="space-y-4">
          <p className="text-sm uppercase tracking-[0.3em] text-primary">Legal</p>
          <h1 className="text-4xl font-bold tracking-tight">Terms &amp; Conditions</h1>
          <p className="text-muted-foreground">
            These Terms &amp; Conditions (&ldquo;Terms&rdquo;) govern your access to UpSpace, including all bookings, listings, and
            communications made through the platform. By creating an account, booking a workspace, or using any part of the service,
            you agree to comply with these Terms.
          </p>
        </section>

        <section className="space-y-3" aria-label="Agreement">
          <h2 className="text-2xl font-semibold">Agreement to Terms</h2>
          <p className="text-muted-foreground">
            You must be at least 18 years old and capable of forming a legal agreement to register for and use UpSpace. You are
            responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account.
          </p>
        </section>

        <section className="space-y-3" aria-label="Eligibility and account security">
          <h2 className="text-2xl font-semibold">Eligibility &amp; Account Management</h2>
          <p className="text-muted-foreground">
            Provide accurate information at sign-up and update your profile when changes occur. You may not transfer your account
            without our written consent, and you must immediately notify us if you suspect unauthorized activity.
          </p>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li>Do not create multiple accounts or impersonate others.</li>
            <li>Keep your contact and billing information current.</li>
            <li>Protect your authentication factors and enable multi-factor authentication when available.</li>
          </ul>
        </section>

        <section className="space-y-3" aria-label="Bookings">
          <h2 className="text-2xl font-semibold">Workspace Listings &amp; Bookings</h2>
          <p className="text-muted-foreground">
            Workspace operators set availability, pricing, and house rules for their listings. When you submit a booking request, you
            acknowledge these terms and agree to honor the operator’s policies within the booked space.
          </p>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li>Bookings are subject to operator approval, and we may refuse or cancel requests that violate policy.</li>
            <li>Report issues or misrepresentations through the in-app messaging tools so we can assist with resolution.</li>
            <li>Respect physical spaces, staff, and other guests while on-site.</li>
          </ul>
        </section>

        <section className="space-y-3" aria-label="Payments">
          <h2 className="text-2xl font-semibold">Payments, Fees &amp; Refunds</h2>
          <p className="text-muted-foreground">
            You authorize UpSpace and our payment partners to charge the payment method you designate for any confirmed bookings,
            including applicable fees, taxes, or security deposits.
          </p>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li>
              All fees are clearly displayed before checkout. You are responsible for additional charges (cleaning, damages, etc.) if
              the operator levies them.
            </li>
            <li>Refunds are issued per the cancellation terms presented by the operator when you book.</li>
            <li>A failed payment may suspend or cancel the related booking until a valid payment method is provided.</li>
          </ul>
        </section>

        <section className="space-y-3" aria-label="Cancellations">
          <h2 className="text-2xl font-semibold">Cancellations &amp; No-Shows</h2>
          <p className="text-muted-foreground">
            Cancellation rights differ per operator. Review the cancellation policy on the listing detail before confirming your
            reservation. Repeated no-shows or late cancellations may result in suspension from the platform.
          </p>
        </section>

        <section className="space-y-3" aria-label="Conduct">
          <h2 className="text-2xl font-semibold">Conduct &amp; Prohibited Uses</h2>
          <p className="text-muted-foreground">
            Use UpSpace responsibly and do not engage in activities that are unlawful, fraudulent, harassing, or harmful to others.
          </p>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li>Do not attempt to bypass billing, security controls, or listing requirements.</li>
            <li>Do not submit defamatory, infringing, or abusive content.</li>
            <li>Respect intellectual property rights, privacy, and applicable laws.</li>
          </ul>
        </section>

        <section className="space-y-3" aria-label="Intellectual property">
          <h2 className="text-2xl font-semibold">Intellectual Property</h2>
          <p className="text-muted-foreground">
            UpSpace, including all software, documentation, trademarks, and logos, is owned by UpSpace or its licensors. You receive
            a limited, revocable, non-exclusive license to use the platform for personal or internal business purposes only.
          </p>
        </section>

        <section className="space-y-3" aria-label="Liability">
          <h2 className="text-2xl font-semibold">Disclaimers &amp; Limitation of Liability</h2>
          <p className="text-muted-foreground">
            The platform is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind. We cannot
            guarantee uninterrupted or error-free operation.
          </p>
          <p className="text-muted-foreground">
            To the fullest extent permitted by law, UpSpace and its affiliates are not liable for indirect, incidental,
            consequential, or punitive damages, including lost profits, data, or goodwill.
          </p>
        </section>

        <section className="space-y-3" aria-label="Indemnification">
          <h2 className="text-2xl font-semibold">Indemnification</h2>
          <p className="text-muted-foreground">
            You agree to indemnify and hold harmless UpSpace, its affiliates, employees, and agents from third-party claims arising
            from your use of the platform, violation of these Terms, or infringement of any rights.
          </p>
        </section>

        <section className="space-y-3" aria-label="Termination">
          <h2 className="text-2xl font-semibold">Termination &amp; Suspension</h2>
          <p className="text-muted-foreground">
            We may suspend or terminate your account for policy violations, fraudulent activity, or upon request. Termination does not
            relieve you of payment obligations incurred prior to the termination date.
          </p>
        </section>

        <section className="space-y-3" aria-label="Governing law">
          <h2 className="text-2xl font-semibold">Governing Law &amp; Dispute Resolution</h2>
          <p className="text-muted-foreground">
            These Terms are governed by the laws of the Republic of the Philippines without regard to conflict-of-law rules. If you
            reside in a jurisdiction that provides mandatory consumer protections, those protections remain in effect.
          </p>
        </section>

        <section className="space-y-3" aria-label="Changes to terms">
          <h2 className="text-2xl font-semibold">Changes to These Terms</h2>
          <p className="text-muted-foreground">
            We may update these Terms periodically. When we make material changes, we will notify you through the platform or email.
            Continued use of UpSpace after notice indicates your consent to the updated Terms.
          </p>
        </section>

        <section className="space-y-3" aria-label="Contact">
          <h2 className="text-2xl font-semibold">Contact</h2>
          <p className="text-muted-foreground">
            Questions about these Terms can be directed to{ ' ' }
            <a className="font-medium text-primary underline" href="mailto:support@upspace.app">
              support@upspace.app
            </a>
            .
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
