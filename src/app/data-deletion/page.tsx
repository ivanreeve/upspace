import type { Metadata } from 'next';

import NavBar from '@/components/ui/navbar';
import { Footer } from '@/components/ui/footer';

export const metadata: Metadata = {
  title: 'Data Deletion Instructions | UpSpace',
  description: 'Instructions for deleting your UpSpace account and associated data.',
};

export default function DataDeletionPage() {
  return (
    <>
      <NavBar />
      <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-16">
        <section className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Data Deletion Instructions</h1>
          <p className="text-muted-foreground">
            If you’d like to have your UpSpace account and associated data removed, submit a request and we’ll walk you through each step of the process. Here’s what you can expect and how to prepare.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">What data is deleted</h2>
          <p className="text-muted-foreground">
            When we remove your account, we delete every record tied to your profile unless legal or regulatory requirements force us to keep it (in which case, it is anonymized and archived securely).
          </p>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li>Personal profile details (name, email, profile photo, preferences).</li>
            <li>Booking history, invoices, payment authorizations, and workspace usage logs.</li>
            <li>Messages, support tickets, and operator communications recorded in UpSpace.</li>
            <li>Uploaded documents, attachments, or media shared through the platform.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">How to request deletion</h2>
          <p className="text-muted-foreground">
            Email us the following details so we can verify the request and start deleting your data.
          </p>
          <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
            <li>Send a message to{ ' ' }
              <a
                className="font-medium text-primary underline"
                href="mailto:bsis4a.g5m.2025@gmail.com?subject=Delete%20My%20Data"
              >
                bsis4a.g5m.2025@gmail.com
              </a>
              { ' ' }with the subject <i>Delete My Data</i>.</li>
            <li>Include the email address associated with your UpSpace account.</li>
            <li>Let us know whether you want us to delete a single device or all registered devices, and if you plan to migrate bookings or receipts.</li>
          </ol>
          <p className="text-muted-foreground">
            We may also ask you to confirm your identity before processing the deletion. That request typically only takes a minute to fulfill.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">What happens next</h2>
          <p className="text-muted-foreground">
            After we receive your verified request, we begin the deletion process immediately. Typical timelines are listed below.
          </p>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li>We acknowledge receipt of your request within 48 hours.</li>
            <li>Account data is scheduled for permanent removal within 7 business days after verification.</li>
            <li>Copies of transactional records required for accounting or legal compliance are retained in anonymized form for up to 5 years.</li>
          </ul>
          <p className="text-muted-foreground">
            You will receive a confirmation email once the deletion is complete.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">After deletion</h2>
          <p className="text-muted-foreground">
            Once your data is deleted your account is permanently removed and you can no longer sign in using the same credentials. If you decide to come back, you will need to create a new account and provide fresh data.
          </p>
          <p className="text-muted-foreground">
            Any recurring bookings or subscriptions tied to the deleted account are automatically canceled, but you may need to contact workspace hosts directly if you had standing arrangements.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Need help?</h2>
          <p className="text-muted-foreground">
            If you have questions about the deletion process, turn to our support team at{ ' ' }
            <a className="font-medium text-primary underline" href="mailto:privacy@upspace.app">
              privacy@upspace.app
            </a>
            . Include the request timestamp or ticket number so we can reference the right case.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
