import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { MarketplaceChrome } from '@/components/pages/Marketplace/MarketplaceChrome';
import { CustomerChatRoomView } from '@/components/pages/Marketplace/CustomerChatRoomView';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

type Params = { roomId: string };
type Props = { params: Promise<Params> };

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Conversation | UpSpace',
    description: 'Continue your chat with the host.',
  };
}

export default async function CustomerChatRoomPage({ params, }: Props) {
  const { roomId, } = await params;
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <MarketplaceChrome initialSidebarOpen={ initialSidebarOpen }>
      <div className="w-full px-2 pb-4 pt-4 sm:px-4 lg:px-6">
        <CustomerChatRoomView roomId={ roomId } />
      </div>
    </MarketplaceChrome>
  );
}
