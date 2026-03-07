'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { FiMessageSquare } from 'react-icons/fi';
import { toast } from 'sonner';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';

import SpaceHeader from './SpaceHeader';
import SpacePhotos from './SpacePhotos';
import HostInfo from './HostInfo';
import { SpaceDetailSkeleton } from './SpaceDetail.Skeleton';
import AmenitiesList from './AmenitiesList';
import AreasWithRates from './AreasWithRates';
import AvailabilityTable from './AvailabilityTable';
import {
  SpaceBookingFlow,
  SpaceBookingCardMobile,
  SpaceBookingCardDesktop,
  type SpaceBookingFlowHandle
} from './SpaceBookingFlow';
import SpaceBreadcrumbs from './SpaceBreadcrumbs';
import SpaceDescriptionSection from './SpaceDescriptionSection';

const ReviewsSection = dynamic(() => import('./ReviewsSection'), { ssr: false, });
const WhereYoullBe = dynamic(() => import('./WhereYoullBe'), { ssr: false, });
const SpaceChatBubble = dynamic(
  () => import('./SpaceChatBubble').then((mod) => ({ default: mod.SpaceChatBubble, })),
  { ssr: false, }
);

import type { MarketplaceSpaceDetail } from '@/lib/queries/space';
import { sanitizeRichText } from '@/lib/rich-text';
import { Button } from '@/components/ui/button';
import { useSession } from '@/components/auth/SessionProvider';
import { cn } from '@/lib/utils';
import { useUserBookingsQuery } from '@/hooks/api/useBookings';
import { useUserProfile } from '@/hooks/use-user-profile';

const OVERVIEW_FALLBACK =
  'Located in the heart of the city, Downtown Space offers a modern and flexible coworking environment designed for entrepreneurs, freelancers, and small teams. With high-speed Wi-Fi, ergonomic workstations, private meeting rooms, and a cozy lounge area, it is the perfect place to stay productive and inspired.';

type SpaceDetailProps = {
  space: MarketplaceSpaceDetail;
};

function usePaymentStatusToast(pathname: string) {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const searchParams = new URLSearchParams(window.location.search);
    const paymentStatus = searchParams.get('payment');
    if (!paymentStatus) {
      return;
    }

    const bookingId = searchParams.get('booking_id');
    if (paymentStatus === 'success') {
      const preview = bookingId ? ` (#${bookingId.slice(0, 8)})` : '';
      toast.success(`Payment confirmed${preview}. Your booking is locked in.`);
    } else if (paymentStatus === 'cancel') {
      toast.error('Payment was cancelled. You can retry whenever you are ready.');
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete('payment');
    const nextUrl = `${pathname}${params.toString() ? `?${params}` : ''}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  }, [pathname]);
}

function SpaceDetailContent({ space, }: SpaceDetailProps) {
  const { session, } = useSession();
  const pathname = usePathname();
  const isGuest = !session;
  const { data: profile, } = useUserProfile();
  const canBook = !isGuest && profile?.role === 'customer';
  const { data: userBookings = [], } = useUserBookingsQuery({ enabled: !isGuest, });

  const hasConfirmedBooking = useMemo(
    () =>
      userBookings.some(
        (booking) =>
          booking.spaceId === space.id && booking.status === 'confirmed'
      ),
    [space.id, userBookings]
  );
  const canMessageHost = !isGuest;
  const canLeaveReview = hasConfirmedBooking;

  const locationParts = [space.city, space.region, space.countryCode].filter(
    Boolean
  );
  const location =
    locationParts.length > 0 ? locationParts.join(', ') : 'Global City, Taguig';
  const hasAreas = space.areas.length > 0;

  const defaultHostName = 'Trisha M.';
  const [isChatOpen, setIsChatOpen] = useState(false);

  const bookingFlowRef = useRef<SpaceBookingFlowHandle>(null);
  const handleOpenBooking = useCallback(() => {
    bookingFlowRef.current?.openBooking();
  }, []);

  const messageHostButtonRef = useRef<HTMLButtonElement | null>(null);

  const scrollToMessageHostButton = useCallback(() => {
    const button = messageHostButtonRef.current;
    if (!button) {
      return;
    }

    button.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });

    if (canMessageHost) {
      button.focus({ preventScroll: true, });
    }
  }, [canMessageHost]);

  const handleOpenChat = useCallback(() => setIsChatOpen(true), []);
  const handleCloseChat = useCallback(() => setIsChatOpen(false), []);

  usePaymentStatusToast(pathname);

  useEffect(() => {
    if (!canMessageHost && isChatOpen) {
      setIsChatOpen(false);
    }
  }, [canMessageHost, isChatOpen]);

  const rawAbout = space.description?.trim();
  const aboutSource =
    rawAbout && rawAbout.length > 0 ? rawAbout : `<p>${OVERVIEW_FALLBACK}</p>`;
  const aboutText = sanitizeRichText(aboutSource);

  return (
    <>
      <div className="bg-background">
        <div className="mx-auto max-w-[1100px] space-y-4 px-4 py-10">
          <SpaceBreadcrumbs spaceName={ space.name } />

          <SpaceHeader
            name={ space.name }
            location={ location }
            spaceId={ space.id }
            isBookmarked={ space.isBookmarked }
          />

          <SpacePhotos
            spaceName={ space.name }
            heroImageUrl={ space.heroImageUrl }
            galleryImages={ space.galleryImages }
          />

          <div
            className={ cn(
              'grid gap-6 lg:items-start',
              canBook
                ? 'lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]'
                : 'lg:grid-cols-1'
            ) }
          >
            <div className="space-y-4">
              <HostInfo
                spaceName={ space.name }
                hostName={ space.hostName ?? defaultHostName }
                avatarUrl={ space.heroImageUrl ?? space.hostAvatarUrl }
                onMessageHost={ canMessageHost ? handleOpenChat : undefined }
                isMessagingDisabled={ !canMessageHost }
                messageButtonRef={ messageHostButtonRef }
              />

              { canBook && (
                <SpaceBookingCardMobile
                  spaceName={ space.name }
                  hasAreas={ hasAreas }
                  onBook={ handleOpenBooking }
                />
              ) }

              <SpaceDescriptionSection
                spaceId={ space.id }
                spaceName={ space.name }
                aboutText={ aboutText }
              />
            </div>

            { canBook && (
              <SpaceBookingCardDesktop
                spaceName={ space.name }
                hasAreas={ hasAreas }
                onBook={ handleOpenBooking }
              />
            ) }
          </div>

          <AvailabilityTable items={ space.availability } />

          <AmenitiesList
            amenities={ space.amenities }
            features={ [] }
            onAskHost={ scrollToMessageHostButton }
          />

          <AreasWithRates areas={ space.areas } />

          <ReviewsSection spaceId={ space.id } canReview={ canLeaveReview } />

          <WhereYoullBe
            city={ space.city }
            region={ space.region }
            country={ space.countryCode }
          />
        </div>
      </div>
      <SpaceBookingFlow
        ref={ bookingFlowRef }
        space={ space }
        canBook={ canBook }
        session={ session }
        hasAreas={ hasAreas }
      />
      { canMessageHost && (
        <SpaceChatBubble
          isOpen={ isChatOpen }
          spaceId={ space.id }
          spaceName={ space.name }
          hostName={ space.hostName ?? defaultHostName }
          hostAvatarUrl={ space.heroImageUrl ?? space.hostAvatarUrl }
          onClose={ handleCloseChat }
        />
      ) }
      { canMessageHost && !isChatOpen && (
        <Button
          type="button"
          size="icon"
          className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/40 hover:bg-primary/90"
          aria-label="Open messages with host"
          onClick={ handleOpenChat }
        >
          <FiMessageSquare className="size-5" aria-hidden="true" />
        </Button>
      ) }
    </>
  );
}

export default function SpaceDetail(props: SpaceDetailProps) {
  return (
    <Suspense fallback={ <SpaceDetailSkeleton /> }>
      <SpaceDetailContent { ...props } />
    </Suspense>
  );
}
