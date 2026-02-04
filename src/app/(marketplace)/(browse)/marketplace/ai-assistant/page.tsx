import type { Metadata } from 'next';

import { AiAssistant } from '@/components/pages/Marketplace/AiAssistant';

export const metadata: Metadata = {
  title: 'AI Assistant | UpSpace',
  description: 'Get personalized help finding spaces, comparing options, planning your budget, and booking your ideal coworking workspace.',
};

export default function MarketplaceAiAssistantPage() {
  return <AiAssistant />;
}
