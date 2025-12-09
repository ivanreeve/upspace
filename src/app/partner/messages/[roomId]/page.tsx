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
    <SpacesChrome
      initialSidebarOpen={ initialSidebarOpen }
      insetClassName="p-2"
      insetStyle={ {
        height: '100svh',
        overflow: 'hidden',
        marginTop: 0,
        marginBottom: 0,
        paddingBottom: 'calc(0.75rem + var(--safe-area-bottom))',
      } }
    >
      <div className="flex h-full w-full flex-col overflow-hidden p-0 sm:p-2">
        <PartnerChatRoomView roomId={ roomId } />
      </div>
    </SpacesChrome>
  );
}
