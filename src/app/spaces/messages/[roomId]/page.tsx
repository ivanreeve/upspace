import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { PartnerChatRoomView } from '@/components/pages/Marketplace/PartnerChatRoomView';
import { SpacesChrome } from '@/components/pages/Spaces/SpacesChrome';
import { parseSidebarState, SIDEBAR_STATE_COOKIE } from '@/lib/sidebar-state';

type Params = { roomId: string };
type Props = { params: Promise<Params> };

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Partner Conversation | UpSpace',
    description: 'Continue replying to your customer conversation.',
  };
}

export default async function PartnerChatRoomPage({ params, }: Props) {
  const { roomId, } = await params;
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value;
  const initialSidebarOpen = parseSidebarState(sidebarCookie);

  return (
    <SpacesChrome initialSidebarOpen={ initialSidebarOpen }>
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-6 sm:px-6 lg:px-8">
        <PartnerChatRoomView roomId={ roomId } />
      </div>
    </SpacesChrome>
  );
}
