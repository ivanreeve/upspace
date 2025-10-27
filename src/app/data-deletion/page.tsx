import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Data Deletion Instructions | UpSpace',
  description: 'Instructions for deleting your UpSpace account and associated data.',
};

export default function DataDeletionPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-16">
      <h1 className="text-3xl font-semibold">Data Deletion Instructions</h1>
      <p>
        To delete your UpSpace account and all related data, please email us at{ ' ' }
        <a
          className="text-primary underline"
          href="mailto:bsis4a.g5m.2025@gmail.com?subject=Delete%20My%20Data"
        >
          bsis4a.g5m.2025@gmail.com
        </a>{ ' ' }
        with the subject <i>Delete My Data</i>.
      </p>
    </main>
  );
}
