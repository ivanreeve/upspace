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
    <MarketplaceChrome
      initialSidebarOpen={ initialSidebarOpen }
      insetClassName="!px-0 !md:px-0 !py-0"
      insetStyle={ {
        height: '100svh',
        overflow: 'hidden',
        marginTop: 0,
        marginBottom: 0,
        paddingBottom: 'var(--safe-area-bottom)',
      } }
    >
      <div className="flex h-full w-full flex-col overflow-hidden p-0">
        <CustomerChatRoomView roomId={ roomId } />
      </div>
    </MarketplaceChrome>
  );
}
