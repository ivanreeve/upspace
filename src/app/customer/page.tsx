import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Customer | UpSpace',
  description: 'Customer workspace management on UpSpace.',
};

export default function CustomerRootRedirect() {
  redirect('/marketplace');
}
