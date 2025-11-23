import type { Metadata } from 'next';

import { Footer } from '@/components/ui/footer';

export const metadata: Metadata = {
  title: 'Privacy Policy | UpSpace',
  description:
    'Learn how UpSpace collects, stores, and uses data, and how to contact us about privacy-related requests.',
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <main className="mx-auto flex max-w-3xl flex-col gap-12 px-4 py-16">
        <section className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-muted-foreground">
            UpSpace is committed to protecting your privacy. This policy explains what data we collect, how we use it, and the choices you have.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Types of data we collect</h2>
          <p className="text-muted-foreground">
            We collect information that helps us deliver and improve UpSpace:
          </p>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Account details</span> such as your name, email address, and password you provide during sign up.
            </li>
            <li>
              <span className="font-medium text-foreground">Workspace and booking details</span> including preferences, transaction history, schedules, and communications with operators.
            </li>
            <li>
              <span className="font-medium text-foreground">Usage and device data</span> like application logs, browser information, and IP address gathered when you use the platform.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">How we store and use your data</h2>
          <p className="text-muted-foreground">
            Your information is processed to operate the platform, fulfill bookings, personalize recommendations, and keep the service secure.
          </p>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li>Data is stored in secure databases with access limited to trained personnel.</li>
            <li>We use encryption in transit, role-based access controls, and regular reviews of our security practices.</li>
            <li>We retain data only as long as necessary for legal, accounting, or operational purposes.</li>
            <li>We never sell personal information and only share it with partners who help deliver the UpSpace experience under appropriate safeguards.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Contact us</h2>
          <p className="text-muted-foreground">
            If you have questions, requests, or complaints about your personal data, reach us at{ ' ' }
            <a className="font-medium text-primary underline" href="mailto:privacy@upspace.app">
              privacy@upspace.app
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Compliance</h2>
          <p className="text-muted-foreground">
            UpSpace processes personal data in accordance with applicable laws, including the EU General Data Protection Regulation (GDPR) and the Philippine Data Privacy Act (DPA), where relevant.
          </p>
          <p className="text-muted-foreground">
            You have the right to access, correct, or delete your information and to lodge a complaint with your local data protection authority. We will respond to requests within the timelines required by law.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
