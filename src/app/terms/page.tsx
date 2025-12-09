import type { Metadata } from 'next';

import { Footer } from '@/components/ui/footer';

export const metadata: Metadata = {
  title: 'Terms of Service | UpSpace',
  description: 'Understand the terms that govern your use of the UpSpace platform.',
};

export default function TermsOfServicePage() {
  return (
    <>
      <main className="mx-auto flex max-w-3xl flex-col gap-12 px-4 py-16">
        <section className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>
          <p className="text-muted-foreground">
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of UpSpace. By creating an account or using the platform, you agree to be bound by these Terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">1. Eligibility &amp; Accounts</h2>
          <p className="text-muted-foreground">
            You must be at least 18 years old and capable of forming a binding contract to use UpSpace. You agree to provide accurate information when registering and to maintain the security of your account credentials.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">2. Platform Use</h2>
          <p className="text-muted-foreground">
            UpSpace connects workspace providers with members seeking flexible workspaces. You agree to use the platform only for lawful purposes and in accordance with these Terms and any applicable policies or guidelines.
          </p>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li>Do not misuse, interfere with, or attempt to access areas of the platform you are not authorized to use.</li>
            <li>Respect other users and workspace operators, and comply with all booking rules shared by hosts.</li>
            <li>Do not upload content that is unlawful, infringing, or harmful to others.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">3. Bookings &amp; Payments</h2>
          <p className="text-muted-foreground">
            Booking availability, pricing, and cancellation terms are set by workspace operators. When you confirm a booking, you authorize us or our payment partners to process the associated charges.
          </p>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li>Fees, taxes, and other charges will be displayed before you complete payment.</li>
            <li>Cancellations and refunds follow the policy communicated during booking or by the operator.</li>
            <li>You are responsible for any losses caused by damage or misuse of a workspace during your booking.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">4. Intellectual Property</h2>
          <p className="text-muted-foreground">
            UpSpace and its licensors retain all rights, title, and interest in the platform, including trademarks, software, and content. You may not copy, modify, or distribute any part of UpSpace without our prior written consent.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">5. Disclaimers &amp; Liability</h2>
          <p className="text-muted-foreground">
            UpSpace is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. We do not guarantee uninterrupted or error-free operation.
          </p>
          <p className="text-muted-foreground">
            To the fullest extent permitted by law, UpSpace and its affiliates shall not be liable for indirect, incidental, special, consequential, or punitive damages, or for loss of profits, data, or goodwill.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">6. Termination</h2>
          <p className="text-muted-foreground">
            We may suspend or terminate your access if you violate these Terms or if we suspect fraudulent or unlawful activity. You may delete your account at any time by contacting us. Termination does not relieve you of outstanding payment obligations.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">7. Governing Law</h2>
          <p className="text-muted-foreground">
            These Terms are governed by the laws of the Republic of the Philippines. If you are located in the European Union, mandatory consumer protections and dispute resolution rights remain unaffected.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">8. Changes to These Terms</h2>
          <p className="text-muted-foreground">
            We may update these Terms from time to time. Material changes will be communicated through the platform or by email. Continued use of UpSpace after updates constitutes acceptance of the revised Terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Contact</h2>
          <p className="text-muted-foreground">
            For questions about these Terms, reach out to us at{ ' ' }
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
