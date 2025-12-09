import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Partner | UpSpace',
  description: 'Partner dashboard for managing UpSpace listings.',
};

export default function PartnerRootRedirect() {
  redirect('/partner/spaces');
}
