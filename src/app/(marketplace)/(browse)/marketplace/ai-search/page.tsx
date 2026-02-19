import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'AI Search Redirect | UpSpace',
  description: 'Redirects to the AI assistant experience for guided workspace discovery.',
};

export default function AiSearchRedirect() {
  redirect('/marketplace/ai-assistant');
}
