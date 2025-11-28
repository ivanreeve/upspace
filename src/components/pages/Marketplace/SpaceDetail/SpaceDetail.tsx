'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';
import { FiChevronDown, FiChevronUp, FiMessageSquare } from 'react-icons/fi';

import SpaceHeader from './SpaceHeader';
import SpacePhotos from './SpacePhotos';
import HostInfo from './HostInfo';
import { BookingCard } from './BookingCard';
import AmenitiesList from './AmenitiesList';
import ReviewsSection from './ReviewsSection';
import WhereYoullBe from './WhereYoullBe';
import AreasWithRates from './AreasWithRates';
import AvailabilityTable from './AvailabilityTable';
import SpaceBreadcrumbs from './SpaceBreadcrumbs';
import { SpaceChatBubble } from './SpaceChatBubble';

import { SPACE_DESCRIPTION_VIEWER_CLASSNAME } from '@/components/pages/Spaces/space-description-rich-text';
import type { MarketplaceSpaceDetail } from '@/lib/queries/space';
import { sanitizeRichText } from '@/lib/rich-text';
import { Button } from '@/components/ui/button';
import { useSession } from '@/components/auth/SessionProvider';
import { cn } from '@/lib/utils';

const DESCRIPTION_COLLAPSED_HEIGHT = 360; // px
type SpaceDetailProps = {
  space: MarketplaceSpaceDetail;
};

export default function SpaceDetail({ space, }: SpaceDetailProps) {
  const { session, } = useSession();
  const isGuest = !session;
  const canMessageHost = !isGuest;

  const locationParts = [space.city, space.region, space.countryCode].filter(Boolean);
  const location = locationParts.length > 0 ? locationParts.join(', ') : 'Global City, Taguig';

  const defaultHostName = 'Trisha M.';
  const [isChatOpen, setIsChatOpen] = useState(false);
  const handleOpenChat = useCallback(() => setIsChatOpen(true), []);
  const handleCloseChat = useCallback(() => setIsChatOpen(false), []);

  const overviewFallback =
    'Located in the heart of the city, Downtown Space offers a modern and flexible coworking environment designed for entrepreneurs, freelancers, and small teams. With high-speed Wi-Fi, ergonomic workstations, private meeting rooms, and a cozy lounge area, it is the perfect place to stay productive and inspired.';

  const rawAbout = space.description?.trim();
  const aboutSource = rawAbout && rawAbout.length > 0 ? rawAbout : `<p>${overviewFallback}</p>`;
  const aboutHtml = sanitizeRichText(aboutSource);

  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isDescriptionOverflowing, setIsDescriptionOverflowing] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const descriptionRef = useRef<HTMLDivElement | null>(null);
  const descriptionSectionRef = useRef<HTMLDivElement | null>(null);
  const descriptionViewportId = `space-description-${space.id}`;

  useEffect(() => {
    const element = descriptionRef.current;
    if (!element) {
      return;
    }

    const updateOverflowState = () => {
      const hasOverflow = element.scrollHeight > DESCRIPTION_COLLAPSED_HEIGHT;
      setIsDescriptionOverflowing(hasOverflow);
    };

    updateOverflowState();

    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(updateOverflowState);
      resizeObserver.observe(element);

      return () => resizeObserver.disconnect();
    }

    return undefined;
  }, [aboutHtml]);

  // Track scroll position to show/hide scroll-to-bottom button
  useEffect(() => {
    if (!isDescriptionExpanded || !isDescriptionOverflowing) {
      setShowScrollToBottom(false);
      return undefined;
    }

    const handleScroll = () => {
      const section = descriptionSectionRef.current;
      if (!section) return;

      const sectionRect = section.getBoundingClientRect();
      const sectionBottom = sectionRect.bottom;
      const viewportHeight = window.innerHeight;

      // Show button if section bottom is below viewport (user hasn't scrolled to bottom yet)
      const isNotAtBottom = sectionBottom > viewportHeight + 100;
      setShowScrollToBottom(isNotAtBottom);
    };

    handleScroll(); // Check initial state
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isDescriptionExpanded, isDescriptionOverflowing]);

  const scrollToBottomOfDescription = () => {
    const section = descriptionSectionRef.current;
    if (!section) return;

    const sectionRect = section.getBoundingClientRect();
    const absoluteTop = window.pageYOffset + sectionRect.top;
    const sectionHeight = sectionRect.height;

    window.scrollTo({
      top: absoluteTop + sectionHeight - window.innerHeight + 100,
      behavior: 'smooth',
    });
  };

  const shouldClampDescription = !isDescriptionExpanded;
  const shouldShowGradient = shouldClampDescription && isDescriptionOverflowing;

  return (
    <>
      <div className="bg-background">
      <div className="mx-auto max-w-[1100px] px-4 py-10 space-y-4">
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
            isGuest
              ? 'lg:grid-cols-1'
              : 'lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]'
          ) }
        >
          <div className="space-y-4">
        <HostInfo
          hostName={ space.hostName ?? defaultHostName }
          avatarUrl={ space.hostAvatarUrl }
          onMessageHost={ canMessageHost ? handleOpenChat : undefined }
          isMessagingDisabled={ !canMessageHost }
        />

            { /* Booking card for mobile - shown above description */ }
            { !isGuest && (
              <div className="lg:hidden">
                <BookingCard spaceName={ space.name } />
              </div>
            ) }

            <section ref={ descriptionSectionRef } className="space-y-4 border-b pb-6">
              <h2 className="text-xl font-medium text-foreground">About { space.name }</h2>
              <div className="relative">
                <div
                  className={ `
                    relative
                    ${shouldClampDescription ? 'max-h-[360px] overflow-hidden' : ''}
                  ` }
                >
                  <div
                    id={ descriptionViewportId }
                    ref={ descriptionRef }
                    className={ `
                      ${SPACE_DESCRIPTION_VIEWER_CLASSNAME}
                      whitespace-pre-line
                      [&_p]:my-3 [&_p:first-of-type]:mt-0 [&_p:last-of-type]:mb-0
                      [&_ul]:my-3 [&_ol]:my-3 [&_li]:leading-relaxed
                      [&_h1]:mt-5 [&_h2]:mt-4 [&_h3]:mt-3
                    ` }
                    dangerouslySetInnerHTML={ { __html: aboutHtml, } }
                  />
                  { shouldShowGradient ? (
                    <div className="absolute inset-x-0 bottom-0 h-32">
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                      <div className="absolute bottom-0 inset-x-0 flex justify-center">
                        <button
                          type="button"
                          onClick={ () => setIsDescriptionExpanded(true) }
                          aria-expanded={ false }
                          aria-controls={ descriptionViewportId }
                          className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          Show more
                          <FiChevronDown className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ) : null }
                </div>
                { isDescriptionOverflowing && isDescriptionExpanded ? (
                  <div className="flex justify-center mt-4">
                    <button
                      type="button"
                      onClick={ () => setIsDescriptionExpanded(false) }
                      aria-expanded={ true }
                      aria-controls={ descriptionViewportId }
                      className="flex items-center gap-2 rounded-lg border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      Show less
                      <FiChevronUp className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : null }

                { /* Floating scroll-to-bottom button when expanded and not at bottom */ }
                { showScrollToBottom ? (
                  <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
                    <button
                      type="button"
                      onClick={ scrollToBottomOfDescription }
                      aria-label="Scroll to bottom of description"
                      className="flex items-center justify-center rounded-full border border-border bg-background p-3 text-foreground shadow-lg transition-all hover:bg-accent hover:text-accent-foreground hover:scale-110"
                    >
                      <FiChevronDown className="size-5" aria-hidden="true" />
                    </button>
                  </div>
                ) : null }
              </div>
            </section>
          </div>

          { /* Booking card for desktop - shows in sidebar */ }
          { !isGuest && (
            <div className="hidden lg:block">
              <BookingCard spaceName={ space.name } />
            </div>
          ) }
        </div>

        <AvailabilityTable items={ space.availability } />

        <section className="border-b pb-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <details className="group space-y-2 rounded-lg border p-4">
              <summary className="cursor-pointer text-base font-medium text-foreground">
                Space Rules
              </summary>
              <p className="text-sm text-muted-foreground">
                Keep shared areas tidy, respect quiet hours after 9 PM, and coordinate meeting room
                use with the host. Smoking is not permitted inside the premises.
              </p>
            </details>
            <details className="group space-y-2 rounded-lg border p-4">
              <summary className="cursor-pointer text-base font-medium text-foreground">
                Cancellation Policy
              </summary>
              <p className="text-sm text-muted-foreground">
                Free cancellation up to 7 days before your reservation. Cancellations within 7 days
                are eligible for a 50 percent refund.
              </p>
            </details>
          </div>
        </section>

        <AmenitiesList amenities={ space.amenities } features={ [] } />

        <AreasWithRates areas={ space.areas } />

        <ReviewsSection spaceId={ space.id } />

        <WhereYoullBe city={ space.city } region={ space.region } country={ space.countryCode } />
      </div>
    </div>
    { canMessageHost && (
      <SpaceChatBubble
        isOpen={ isChatOpen }
        spaceId={ space.id }
        hostName={ space.hostName ?? defaultHostName }
        hostAvatarUrl={ space.hostAvatarUrl }
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
