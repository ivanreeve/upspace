'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiChevronUp,
  FiMessageSquare,
  FiMinus,
  FiPlus
} from 'react-icons/fi';

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { PriceRuleOperand, PriceRuleRecord } from '@/lib/pricing-rules';
import { evaluatePriceRule, type PriceRuleEvaluationResult } from '@/lib/pricing-rules-evaluator';

const DESCRIPTION_COLLAPSED_HEIGHT = 360; // px
const MIN_BOOKING_HOURS = 1;
const MAX_BOOKING_HOURS = 24;
const DESKTOP_BREAKPOINT_QUERY = '(min-width: 1024px)';
const PRICE_FORMATTER = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});
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
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [bookingHours, setBookingHours] = useState(MIN_BOOKING_HOURS);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia(DESKTOP_BREAKPOINT_QUERY).matches;
  });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const handleOpenChat = useCallback(() => setIsChatOpen(true), []);
  const handleCloseChat = useCallback(() => setIsChatOpen(false), []);
  const messageHostButtonRef = useRef<HTMLButtonElement | null>(null);
  const scrollToMessageHostButton = useCallback(() => {
    const button = messageHostButtonRef.current;
    if (!button) return;

    button.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });

    if (canMessageHost) {
      button.focus({ preventScroll: true, });
    }
  }, [canMessageHost]);

  const handleOpenBooking = useCallback(() => setIsBookingOpen(true), []);
  const handleCloseBooking = useCallback(() => setIsBookingOpen(false), []);
  const handleConfirmBooking = useCallback(() => setIsBookingOpen(false), []);
  const increaseBookingHours = useCallback(() => {
    setBookingHours((prev) => Math.min(prev + 1, MAX_BOOKING_HOURS));
  }, []);
  const decreaseBookingHours = useCallback(() => {
    setBookingHours((prev) => Math.max(prev - 1, MIN_BOOKING_HOURS));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mediaQuery = window.matchMedia(DESKTOP_BREAKPOINT_QUERY);
    const updateDesktopState = () => {
      setIsDesktopViewport(mediaQuery.matches);
    };

    updateDesktopState();

    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktopViewport(event.matches);
    };

    if ('addEventListener' in mediaQuery) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

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

  useEffect(() => {
    if (!isBookingOpen) {
      setBookingHours(MIN_BOOKING_HOURS);
    }
  }, [isBookingOpen]);

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

  const activeAreaWithPricingRule = useMemo(
    () => space.areas.find((area) => area.pricingRuleId && area.pricingRuleName) ?? null,
    [space.areas]
  );

  const activePriceRule = useMemo<PriceRuleRecord | null>(() => {
    if (!activeAreaWithPricingRule) {
      return space.pricingRules.length > 0 ? space.pricingRules[0] : null;
    }
    return space.pricingRules.find((rule) => rule.id === activeAreaWithPricingRule.pricingRuleId) ?? null;
  }, [activeAreaWithPricingRule, space.pricingRules]);

  const shouldShowHourSelector = useMemo(
    () => doesRuleUseBookingHours(activePriceRule),
    [activePriceRule]
  );

  const priceEvaluation = useMemo(() => {
    if (!activePriceRule) {
      return null;
    }
    return evaluatePriceRule(activePriceRule.definition, { bookingHours, });
  }, [activePriceRule, bookingHours]);

  const priceBranchLabel = (branch: PriceRuleEvaluationResult['branch']) => {
    switch (branch) {
      case 'then':
        return 'Matches rule conditions';
      case 'else':
        return 'Fallback pricing applied';
      case 'unconditional':
        return 'Flat rate applied';
      default:
        return 'Pricing rule';
    }
  };

  const bookingDurationContent = (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Booking duration</p>
      </div>
      { shouldShowHourSelector ? (
        <div className="space-y-5">
          <div className="flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              disabled
            >
              <FiChevronLeft className="size-4" aria-hidden="true" />
              <span className="sr-only">Previous unit</span>
            </Button>
            <span className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Hour</span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              disabled
            >
              <FiChevronRight className="size-4" aria-hidden="true" />
              <span className="sr-only">Next unit</span>
            </Button>
          </div>
          <div className="flex items-center justify-center gap-6">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={ decreaseBookingHours }
              disabled={ bookingHours <= MIN_BOOKING_HOURS }
            >
              <FiMinus className="size-4" aria-hidden="true" />
              <span className="sr-only">Decrease hours</span>
            </Button>
            <div className="text-center">
              <div className="text-5xl font-semibold tracking-tight">{ bookingHours }</div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-muted-foreground">Hours</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={ increaseBookingHours }
              disabled={ bookingHours >= MAX_BOOKING_HOURS }
            >
              <FiPlus className="size-4" aria-hidden="true" />
              <span className="sr-only">Increase hours</span>
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-center text-muted-foreground">
          { activePriceRule
            ? 'This pricing rule applies a fixed rate for every booking.'
            : 'Booking duration selection will appear once the host publishes pricing.' }
        </p>
      ) }
      { activePriceRule && priceEvaluation ? (
        <div className="space-y-2 text-center">
          { priceEvaluation.price !== null ? (
            <>
              <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
                Estimated total
              </p>
              <p className="text-3xl font-semibold tracking-tight">
                { PRICE_FORMATTER.format(priceEvaluation.price) }
              </p>
              <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
                { priceBranchLabel(priceEvaluation.branch) }
              </p>
            </>
          ) : (
            <p className="text-sm text-center text-destructive/80">
              { priceEvaluation.branch === 'no-match'
                ? 'No pricing tier matches this duration. Try a different number of hours or message the host.'
                : 'This pricing rule does not define a numeric value for the selected duration.' }
            </p>
          ) }
        </div>
      ) : null }
    </div>
  );

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
          spaceName={ space.name }
          hostName={ space.hostName ?? defaultHostName }
          avatarUrl={ space.heroImageUrl ?? space.hostAvatarUrl }
          onMessageHost={ canMessageHost ? handleOpenChat : undefined }
          isMessagingDisabled={ !canMessageHost }
          messageButtonRef={ messageHostButtonRef }
        />

            { /* Booking card for mobile - shown above description */ }
            { !isGuest && (
              <div className="lg:hidden">
                <BookingCard spaceName={ space.name } onBook={ handleOpenBooking } />
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
              <BookingCard spaceName={ space.name } onBook={ handleOpenBooking } />
            </div>
          ) }
        </div>

        <AvailabilityTable items={ space.availability } />

        <AmenitiesList
          amenities={ space.amenities }
          features={ [] }
          onAskHost={ scrollToMessageHostButton }
        />

        <AreasWithRates areas={ space.areas } />

        <ReviewsSection spaceId={ space.id } />

        <WhereYoullBe city={ space.city } region={ space.region } country={ space.countryCode } />
      </div>
    </div>
    <Dialog
      open={ isDesktopViewport && isBookingOpen }
      onOpenChange={ setIsBookingOpen }
    >
      <DialogContent showCloseButton={ false }>
        <DialogHeader>
          <DialogTitle>Book a reservation</DialogTitle>
        </DialogHeader>
        { bookingDurationContent }
        <DialogFooter className="flex-col gap-3 lg:flex-row lg:items-center">
          <Button
            type="button"
            className="w-full lg:w-auto"
            onClick={ handleConfirmBooking }
          >
            Book
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full lg:w-auto"
            onClick={ handleCloseBooking }
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Sheet
      open={ !isDesktopViewport && isBookingOpen }
      onOpenChange={ setIsBookingOpen }
    >
      <SheetContent side="bottom" className="gap-4">
        <SheetHeader>
          <SheetTitle>Book a reservation</SheetTitle>
        </SheetHeader>
        <div className="px-6 pb-4">{ bookingDurationContent }</div>
        <SheetFooter className="space-y-3 px-6 pb-6">
          <Button type="button" className="w-full" onClick={ handleConfirmBooking }>
            Book
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={ handleCloseBooking }
          >
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
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

const BOOKING_HOURS_VARIABLE = 'booking_hours';

function isBookingHoursOperand(operand: PriceRuleOperand): boolean {
  return operand.kind === 'variable' && operand.key === BOOKING_HOURS_VARIABLE;
}

function doesRuleUseBookingHours(rule: PriceRuleRecord | null): boolean {
  if (!rule) {
    return false;
  }

  const referencesInConditions = rule.definition.conditions.some(
    (condition) =>
      isBookingHoursOperand(condition.left) || isBookingHoursOperand(condition.right)
  );

  const formulaReferencesBookingHours = rule.definition.formula.includes(BOOKING_HOURS_VARIABLE);

  return referencesInConditions || formulaReferencesBookingHours;
}
