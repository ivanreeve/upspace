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
import { CgSpinner } from 'react-icons/cg';
import { toast } from 'sonner';

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
import { useUserBookingsQuery, useCreateBookingMutation } from '@/hooks/api/useBookings';

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
  const {
    data: userBookings = [],
    isLoading: isBookingsLoading,
  } = useUserBookingsQuery({ enabled: !isGuest, });
  const hasConfirmedBooking = useMemo(
    () => userBookings.some((booking) => booking.spaceId === space.id && booking.status === 'confirmed'),
    [space.id, userBookings]
  );
  const canMessageHost = !isGuest && hasConfirmedBooking;
  const canLeaveReview = hasConfirmedBooking;

  const locationParts = [space.city, space.region, space.countryCode].filter(Boolean);
  const location = locationParts.length > 0 ? locationParts.join(', ') : 'Global City, Taguig';
  const hasAreas = space.areas.length > 0;

  const defaultHostName = 'Trisha M.';
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [bookingHours, setBookingHours] = useState(MIN_BOOKING_HOURS);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia(DESKTOP_BREAKPOINT_QUERY).matches;
  });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const handleOpenChat = useCallback(() => setIsChatOpen(true), []);
  const handleCloseChat = useCallback(() => setIsChatOpen(false), []);
  const createBooking = useCreateBookingMutation();
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

  const resetBookingState = useCallback(() => {
    setBookingHours(MIN_BOOKING_HOURS);
    setSelectedAreaId(null);
    setIsPricingLoading(false);
  }, []);

  const findFirstPricedAreaId = useCallback(() => {
    const areaWithPricing = space.areas.find(
      (area) => area.pricingRuleId && area.pricingRuleName
    );
    return areaWithPricing?.id ?? null;
  }, [space.areas]);

  const initializeBookingSelection = useCallback(() => {
    const defaultAreaId = findFirstPricedAreaId();
    setBookingHours(MIN_BOOKING_HOURS);
    setSelectedAreaId(defaultAreaId);
    setIsPricingLoading(Boolean(defaultAreaId));
  }, [findFirstPricedAreaId]);

  const handleOpenBooking = useCallback(() => {
    if (!hasAreas) {
      return;
    }
    initializeBookingSelection();
    setIsBookingOpen(true);
  }, [hasAreas, initializeBookingSelection]);
  const handleCloseBooking = useCallback(() => {
    resetBookingState();
    setIsBookingOpen(false);
  }, [resetBookingState]);
  const increaseBookingHours = useCallback(() => {
    setBookingHours((prev) => Math.min(prev + 1, MAX_BOOKING_HOURS));
  }, []);
  const decreaseBookingHours = useCallback(() => {
    setBookingHours((prev) => Math.max(prev - 1, MIN_BOOKING_HOURS));
  }, []);
  const handleSelectArea = useCallback((areaId: string) => {
    setSelectedAreaId(areaId);
    setBookingHours(MIN_BOOKING_HOURS);
    setIsPricingLoading(true);
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
      resetBookingState();
    }
  }, [isBookingOpen, resetBookingState]);

  useEffect(() => {
    if (!canMessageHost && isChatOpen) {
      setIsChatOpen(false);
    }
  }, [canMessageHost, isChatOpen]);

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

  const selectedArea = useMemo(
    () => space.areas.find((area) => area.id === selectedAreaId) ?? null,
    [selectedAreaId, space.areas]
  );

  const activePriceRule = useMemo<PriceRuleRecord | null>(() => {
    if (!selectedArea?.pricingRuleId) {
      return null;
    }
    return space.pricingRules.find((rule) => rule.id === selectedArea.pricingRuleId) ?? null;
  }, [selectedArea?.pricingRuleId, space.pricingRules]);

  useEffect(() => {
    if (!selectedAreaId || !isPricingLoading) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setIsPricingLoading(false), 600);

    return () => window.clearTimeout(timeoutId);
  }, [isPricingLoading, selectedAreaId]);

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
      <div className="space-y-3">
        <p className="text-xs text-center uppercase tracking-[0.3em] text-muted-foreground">Choose an area</p>
        { space.areas.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 px-4 py-5 text-center text-sm text-muted-foreground">
            This space has no areas to book yet.
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            { space.areas.map((area) => {
              const isSelected = selectedAreaId === area.id;
              const hasPricingRule = Boolean(area.pricingRuleId && area.pricingRuleName);
              return (
                <Button
                  key={ area.id }
                  type="button"
                  variant={ isSelected ? 'default' : 'outline' }
                  className={ cn(
                    'justify-between rounded-lg border-2 px-4 py-3 text-left',
                    isSelected ? 'border-primary shadow-sm' : 'border-border/70 bg-background text-foreground',
                    !hasPricingRule ? 'opacity-70' : ''
                  ) }
                  onClick={ () => handleSelectArea(area.id) }
                  disabled={ !hasPricingRule }
                  aria-pressed={ isSelected }
                  aria-label={ `Choose ${area.name}` }
                >
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-semibold leading-5">{ area.name }</span>
                    <span className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                      { hasPricingRule ? area.pricingRuleName : 'Pricing not set' }
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    { isSelected ? 'Selected' : hasPricingRule ? 'Select' : 'Unavailable' }
                  </span>
                </Button>
              );
            }) }
          </div>
        ) }
      </div>

      { selectedAreaId ? (
        isPricingLoading ? (
          <div className="flex items-center justify-center gap-3 rounded-lg border border-dashed border-border/70 bg-muted/40 px-4 py-6">
            <CgSpinner className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
          <div className="space-y-1 text-center">
            <p className="text-sm font-semibold text-foreground">Computing pricing data...</p>
          </div>
          </div>
        ) : activePriceRule ? (
          <div className="space-y-5">
            <div className="space-y-1 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Booking duration</p>
              <p className="text-sm font-medium text-foreground">{ selectedArea?.name }</p>
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
                    disabled={ bookingHours <= MIN_BOOKING_HOURS || isPricingLoading }
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
                    disabled={ bookingHours >= MAX_BOOKING_HOURS || isPricingLoading }
                  >
                    <FiPlus className="size-4" aria-hidden="true" />
                    <span className="sr-only">Increase hours</span>
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-center text-muted-foreground">
                This pricing rule applies a fixed rate for every booking.
              </p>
            ) }
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 px-4 py-5 text-center text-sm text-muted-foreground">
            Pricing for this area is not yet available. Choose another area or message the host.
          </div>
        )
      ) : (
        <p className="text-sm text-center text-muted-foreground">
          Select an area to preview pricing.
        </p>
      ) }
    </div>
  );

  const primaryActionLabel = (() => {
    if (!selectedAreaId) {
      return 'Select an area';
    }
    if (createBooking.isPending) {
      return 'Booking...';
    }
    if (isPricingLoading) {
      return 'Computing price...';
    }
    if (!activePriceRule) {
      return 'Pricing unavailable';
    }
    if (!priceEvaluation || priceEvaluation.price === null) {
      return 'Price unavailable';
    }
    return PRICE_FORMATTER.format(priceEvaluation.price);
  })();

  const bookingButtonContent = (
    <>
      { createBooking.isPending && (
        <CgSpinner className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) }
      { primaryActionLabel }
    </>
  );

  const canConfirmBooking = Boolean(
    selectedAreaId &&
    !isPricingLoading &&
    activePriceRule &&
    priceEvaluation &&
    priceEvaluation.price !== null &&
    !isGuest &&
    !createBooking.isPending
  );

  const handleConfirmBooking = useCallback(async () => {
    if (!selectedArea || !canConfirmBooking || !session) {
      return;
    }

    try {
      await createBooking.mutateAsync({
        spaceId: space.id,
        areaId: selectedArea.id,
        bookingHours,
        price: priceEvaluation?.price ?? null,
      });
      toast.success('Booking confirmed. You can now message the host and leave a review.');
      resetBookingState();
      setIsBookingOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to place booking.';
      toast.error(message);
    }
  }, [
    bookingHours,
    canConfirmBooking,
    createBooking,
    priceEvaluation?.price,
    resetBookingState,
    selectedArea,
    session,
    space.id
  ]);

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
                <BookingCard
                  spaceName={ space.name }
                  onBook={ handleOpenBooking }
                  isDisabled={ !hasAreas }
                />
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
                          className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-accent hover:text-white"
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
                      className="flex items-center gap-2 rounded-lg border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-accent hover:text-white"
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
                      className="flex items-center justify-center rounded-full border border-border bg-background p-3 text-foreground shadow-lg transition-all hover:bg-accent hover:text-white hover:scale-110"
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
              <BookingCard
                spaceName={ space.name }
                onBook={ handleOpenBooking }
                isDisabled={ !hasAreas }
              />
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

        <ReviewsSection spaceId={ space.id } canReview={ canLeaveReview } />

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
          <DialogDescription>
            Confirm your preferred duration and review the booking summary before checkout.
          </DialogDescription>
        </DialogHeader>
        { bookingDurationContent }
        <DialogFooter className="flex-col gap-3 lg:flex-row lg:items-center">
          <Button
            type="button"
            className="w-full lg:w-auto"
            onClick={ handleConfirmBooking }
            disabled={ !canConfirmBooking }
          >
            { bookingButtonContent }
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
          <Button
            type="button"
            className="w-full"
            onClick={ handleConfirmBooking }
            disabled={ !canConfirmBooking }
          >
            { bookingButtonContent }
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
const BOOKING_HOURS_KEY = BOOKING_HOURS_VARIABLE.toLowerCase();

function isBookingHoursOperand(operand: PriceRuleOperand): boolean {
  return operand.kind === 'variable' && operand.key.trim().toLowerCase() === BOOKING_HOURS_KEY;
}

function doesRuleUseBookingHours(rule: PriceRuleRecord | null): boolean {
  if (!rule) {
    return false;
  }

  const referencesInConditions = rule.definition.conditions.some(
    (condition) =>
      isBookingHoursOperand(condition.left) || isBookingHoursOperand(condition.right)
  );

  const formulaReferencesBookingHours = rule.definition.formula
    .toLowerCase()
    .includes(BOOKING_HOURS_KEY);

  const declaresBookingHoursVariable = rule.definition.variables.some(
    (variable) => variable.key.trim().toLowerCase() === BOOKING_HOURS_KEY
  );

  return referencesInConditions || formulaReferencesBookingHours || declaresBookingHoursVariable;
}
