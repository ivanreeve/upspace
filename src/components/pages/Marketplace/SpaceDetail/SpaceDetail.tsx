'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from 'react';
import {
  FiChevronDown,
  FiChevronUp,
  FiMessageSquare,
  FiMinus,
  FiPlus
} from 'react-icons/fi';
import { CgSpinner } from 'react-icons/cg';
import { toast } from 'sonner';
import { usePathname } from 'next/navigation';

import SpaceHeader from './SpaceHeader';
import SpacePhotos from './SpacePhotos';
import HostInfo from './HostInfo';
import { BookingCard } from './BookingCard';
import { SpaceDetailSkeleton } from './SpaceDetail.Skeleton';
import AmenitiesList from './AmenitiesList';
import ReviewsSection from './ReviewsSection';
import WhereYoullBe from './WhereYoullBe';
import AreasWithRates from './AreasWithRates';
import AvailabilityTable from './AvailabilityTable';
import SpaceBreadcrumbs from './SpaceBreadcrumbs';
import { SpaceChatBubble } from './SpaceChatBubble';

import { SPACE_DESCRIPTION_VIEWER_CLASSNAME } from '@/components/pages/Spaces/space-description-rich-text';
import type { MarketplaceSpaceDetail } from '@/lib/queries/space';
import { richTextToPlainText } from '@/lib/rich-text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
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
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { MAX_BOOKING_HOURS, MIN_BOOKING_HOURS } from '@/lib/bookings/constants';
import { BOOKING_DURATION_VARIABLE_KEYS, type PriceRuleOperand, type PriceRuleRecord } from '@/lib/pricing-rules';
import { evaluatePriceRule, type PriceRuleEvaluationResult } from '@/lib/pricing-rules-evaluator';
import { useUserBookingsQuery, useCreateCheckoutSessionMutation } from '@/hooks/api/useBookings';

const DESCRIPTION_COLLAPSED_HEIGHT = 360; // px
const DESKTOP_BREAKPOINT_QUERY = '(min-width: 1024px)';
const PRICE_FORMATTER = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});
const DEFAULT_BOOKING_HOURS = MIN_BOOKING_HOURS;
const MIN_GUEST_COUNT = 1;
const MAX_GUEST_COUNT = 99;
const OVERVIEW_FALLBACK =
  'Located in the heart of the city, Downtown Space offers a modern and flexible coworking environment designed for entrepreneurs, freelancers, and small teams. With high-speed Wi-Fi, ergonomic workstations, private meeting rooms, and a cozy lounge area, it is the perfect place to stay productive and inspired.';

const getTodayIsoDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

const clampGuestCount = (value: number, maxLimit: number | null = null) => {
  if (!Number.isFinite(value)) {
    return MIN_GUEST_COUNT;
  }
  const normalized = Math.trunc(value);
  const upperLimit = maxLimit ?? MAX_GUEST_COUNT;
  return Math.min(Math.max(normalized, MIN_GUEST_COUNT), upperLimit);
};

type SpaceDetailProps = {
  space: MarketplaceSpaceDetail;
};

type SessionValue = ReturnType<typeof useSession>['session'];

type BookingFormState = {
  bookingHours: number;
  selectedAreaId: string | null;
  isPricingLoading: boolean;
  guestCount: number;
  scheduledDate: string;
};

type BookingFormAction =
  | { type: 'initialize'; defaultAreaId: string | null }
  | {
      type: 'reset';
      defaultAreaId: string | null;
      earliestScheduleDate: string;
    }
  | { type: 'select-area'; areaId: string }
  | { type: 'set-booking-hours'; bookingHours: number }
  | { type: 'set-pricing-loading'; isPricingLoading: boolean }
  | { type: 'set-guest-count'; guestCount: number }
  | { type: 'set-scheduled-date'; scheduledDate: string };

type BookingDurationFormProps = {
  areas: MarketplaceSpaceDetail['areas'];
  selectedAreaId: string | null;
  onSelectArea: (areaId: string) => void;
  scheduledDate: string;
  earliestScheduleDate: string;
  onScheduledDateChange: (event: ChangeEvent<HTMLInputElement>) => void;
  bookingHours: number;
  onBookingHoursChange: (bookingHours: number) => void;
  isPricingLoading: boolean;
  shouldShowHourSelector: boolean;
  selectedAreaMaxCapacity: number | null;
  currentGuestLimit: number;
  guestCount: number;
  onDecreaseGuestCount: () => void;
  onIncreaseGuestCount: () => void;
  onGuestCountInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  isOverCapacity: boolean;
  capacityHelperText: string;
  pricePreviewLabel: string;
  priceEvaluation: PriceRuleEvaluationResult | null;
  isBookingFormPristine: boolean;
  onResetBookingForm: () => void;
};

type BookingReservationOverlayProps = {
  isDesktopViewport: boolean;
  isBookingOpen: boolean;
  setIsBookingOpen: Dispatch<SetStateAction<boolean>>;
  bookingContent: ReactNode;
  canConfirmBooking: boolean;
  onConfirmBooking: () => void;
  onCloseBooking: () => void;
  isCheckoutPending: boolean;
  primaryActionLabel: string;
};

type SpaceDescriptionSectionProps = {
  spaceId: string;
  spaceName: string;
  aboutText: string;
};

type UseSpaceBookingParams = {
  hasAreas: boolean;
  isBookingOpen: boolean;
  isGuest: boolean;
  session: SessionValue;
  setIsBookingOpen: Dispatch<SetStateAction<boolean>>;
  space: MarketplaceSpaceDetail;
};

function createInitialBookingFormState(
  earliestScheduleDate: string
): BookingFormState {
  return {
    bookingHours: DEFAULT_BOOKING_HOURS,
    selectedAreaId: null,
    isPricingLoading: false,
    guestCount: MIN_GUEST_COUNT,
    scheduledDate: earliestScheduleDate,
  };
}

function bookingFormReducer(
  state: BookingFormState,
  action: BookingFormAction
): BookingFormState {
  switch (action.type) {
    case 'initialize':
      return {
        ...state,
        bookingHours: DEFAULT_BOOKING_HOURS,
        selectedAreaId: action.defaultAreaId,
        isPricingLoading: Boolean(action.defaultAreaId),
      };
    case 'reset':
      return {
        bookingHours: DEFAULT_BOOKING_HOURS,
        selectedAreaId: action.defaultAreaId,
        isPricingLoading: Boolean(action.defaultAreaId),
        guestCount: MIN_GUEST_COUNT,
        scheduledDate: action.earliestScheduleDate,
      };
    case 'select-area':
      return {
        ...state,
        selectedAreaId: action.areaId,
        bookingHours: DEFAULT_BOOKING_HOURS,
        isPricingLoading: true,
      };
    case 'set-booking-hours':
      return {
        ...state,
        bookingHours: action.bookingHours,
      };
    case 'set-pricing-loading':
      return {
        ...state,
        isPricingLoading: action.isPricingLoading,
      };
    case 'set-guest-count':
      return {
        ...state,
        guestCount: action.guestCount,
      };
    case 'set-scheduled-date':
      return {
        ...state,
        scheduledDate: action.scheduledDate,
      };
    default: {
      const exhaustiveCheck: never = action;
      return exhaustiveCheck;
    }
  }
}

function useIsDesktopViewport(query: string) {
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mediaQuery = window.matchMedia(query) as MediaQueryList & {
      addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    };
    const updateDesktopState = () => {
      setIsDesktopViewport(mediaQuery.matches);
    };

    updateDesktopState();

    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktopViewport(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [query]);

  return isDesktopViewport;
}

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

function priceBranchLabel(branch: PriceRuleEvaluationResult['branch']) {
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
}

function SpaceDescriptionSection({
  spaceId,
  spaceName,
  aboutText,
}: SpaceDescriptionSectionProps) {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isDescriptionOverflowing, setIsDescriptionOverflowing] =
    useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const descriptionRef = useRef<HTMLDivElement | null>(null);
  const descriptionSectionRef = useRef<HTMLDivElement | null>(null);
  const descriptionViewportId = `space-description-${spaceId}`;

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
  }, [aboutText]);

  useEffect(() => {
    if (!isDescriptionExpanded || !isDescriptionOverflowing) {
      setShowScrollToBottom(false);
      return undefined;
    }

    const handleScroll = () => {
      const section = descriptionSectionRef.current;
      if (!section) {
        return;
      }

      const sectionRect = section.getBoundingClientRect();
      const sectionBottom = sectionRect.bottom;
      const viewportHeight = window.innerHeight;

      const isNotAtBottom = sectionBottom > viewportHeight + 100;
      setShowScrollToBottom(isNotAtBottom);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true, });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isDescriptionExpanded, isDescriptionOverflowing]);

  const scrollToBottomOfDescription = useCallback(() => {
    const section = descriptionSectionRef.current;
    if (!section) {
      return;
    }

    const sectionRect = section.getBoundingClientRect();
    const absoluteTop = window.pageYOffset + sectionRect.top;
    const sectionHeight = sectionRect.height;

    window.scrollTo({
      top: absoluteTop + sectionHeight - window.innerHeight + 100,
      behavior: 'smooth',
    });
  }, []);

  const shouldClampDescription = !isDescriptionExpanded;
  const shouldShowGradient = shouldClampDescription && isDescriptionOverflowing;

  return (
    <section ref={ descriptionSectionRef } className="space-y-4 border-b pb-6">
      <h2 className="text-xl font-medium text-foreground">About { spaceName }</h2>
      <div className="relative">
        <div
          className={ cn(
            'relative',
            shouldClampDescription && 'max-h-[360px] overflow-hidden'
          ) }
        >
          <div
            id={ descriptionViewportId }
            ref={ descriptionRef }
            className={ cn(
              SPACE_DESCRIPTION_VIEWER_CLASSNAME,
              'whitespace-pre-line',
              '[&_p]:my-3 [&_p:first-of-type]:mt-0 [&_p:last-of-type]:mb-0',
              '[&_ul]:my-3 [&_ol]:my-3 [&_li]:leading-relaxed',
              '[&_h1]:mt-5 [&_h2]:mt-4 [&_h3]:mt-3'
            ) }
          >
            { aboutText }
          </div>
          { shouldShowGradient ? (
            <div className="absolute inset-x-0 bottom-0 h-32">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
              <div className="absolute bottom-0 inset-x-0 flex justify-center">
                <button
                  type="button"
                  onClick={ () => setIsDescriptionExpanded(true) }
                  aria-expanded={ false }
                  aria-controls={ descriptionViewportId }
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-accent hover:text-white"
                >
                  Show more
                  <FiChevronDown className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null }
        </div>

        { isDescriptionOverflowing && isDescriptionExpanded ? (
          <div className="mt-4 flex justify-center">
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

        { showScrollToBottom ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 fixed bottom-8 left-1/2 z-50 -translate-x-1/2">
            <button
              type="button"
              onClick={ scrollToBottomOfDescription }
              aria-label="Scroll to bottom of description"
              className="flex items-center justify-center rounded-full border border-border bg-background p-3 text-foreground shadow-lg transition-all hover:scale-110 hover:bg-accent hover:text-white"
            >
              <FiChevronDown className="size-5" aria-hidden="true" />
            </button>
          </div>
        ) : null }
      </div>
    </section>
  );
}

function BookingDurationForm({
  areas,
  selectedAreaId,
  onSelectArea,
  scheduledDate,
  earliestScheduleDate,
  onScheduledDateChange,
  bookingHours,
  onBookingHoursChange,
  isPricingLoading,
  shouldShowHourSelector,
  selectedAreaMaxCapacity,
  currentGuestLimit,
  guestCount,
  onDecreaseGuestCount,
  onIncreaseGuestCount,
  onGuestCountInputChange,
  isOverCapacity,
  capacityHelperText,
  pricePreviewLabel,
  priceEvaluation,
  isBookingFormPristine,
  onResetBookingForm,
}: BookingDurationFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-lg font-semibold text-left font-sf text-muted-foreground">
          Plan your visit
        </p>
        <p className="text-sm text-muted-foreground">
          Choose an area, date, duration, and guest count to preview pricing.
        </p>
      </div>
      <div className="space-y-4 rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="area-select"
                className="text-sm font-semibold text-foreground"
              >
                Area selection
              </Label>
              <span className="text-xs text-muted-foreground">
                { areas.length } area{ areas.length === 1 ? '' : 's' }
              </span>
            </div>
            { areas.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 px-3 py-5 text-center text-sm text-muted-foreground">
                No areas available yet.
              </div>
            ) : (
              <Select value={ selectedAreaId ?? undefined } onValueChange={ onSelectArea }>
                <SelectTrigger
                  id="area-select"
                  className="w-full rounded-md"
                  aria-label="Select an area"
                >
                  <SelectValue placeholder="Select an area" />
                </SelectTrigger>
                <SelectContent className="max-w-[26rem]">
                  { areas.map((area) => {
                    const hasPricingRule = Boolean(
                      area.pricingRuleId && area.pricingRuleName
                    );
                    return (
                      <SelectItem
                        key={ area.id }
                        value={ area.id }
                        disabled={ !hasPricingRule }
                      >
                        <div className="flex w-full flex-col gap-0.5">
                          <span className="text-sm font-semibold leading-tight text-foreground">
                            { area.name }
                          </span>
                        </div>
                      </SelectItem>
                    );
                  }) }
                </SelectContent>
              </Select>
            ) }
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="booking-date"
              className="text-sm font-semibold text-foreground"
            >
              Calendar schedule
            </Label>
            <Input
              id="booking-date"
              type="date"
              value={ scheduledDate }
              min={ earliestScheduleDate }
              onChange={ onScheduledDateChange }
            />
            <p className="text-xs text-muted-foreground">
              We&apos;ll confirm availability with the host for { scheduledDate }.
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-foreground">
                Duration
              </Label>
              <span className="text-xs text-muted-foreground">
                { bookingHours === MAX_BOOKING_HOURS
                  ? '1 day (24 hours) total'
                  : `${bookingHours} hour${bookingHours === 1 ? '' : 's'} total` }
              </span>
            </div>
            <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/40 px-4 py-4 shadow-sm">
              <div className="text-center">
                <p className="text-3xl font-semibold text-foreground">
                  { bookingHours === MAX_BOOKING_HOURS
                    ? '1 day'
                    : `${bookingHours} hr${bookingHours === 1 ? '' : 's'}` }
                </p>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  { bookingHours === MAX_BOOKING_HOURS
                    ? 'Max duration'
                    : 'Hourly booking' }
                </p>
              </div>
              <Slider
                value={ [bookingHours] }
                min={ MIN_BOOKING_HOURS }
                max={ MAX_BOOKING_HOURS }
                step={ 1 }
                onValueChange={ ([value]) => {
                  const nextValue = value ?? MIN_BOOKING_HOURS;
                  onBookingHoursChange(nextValue);
                } }
                disabled={ isPricingLoading || !selectedAreaId }
                className="h-5"
                aria-label="Pick booking duration in hours"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{ MIN_BOOKING_HOURS } hr</span>
                <span>24 hrs / 1 day</span>
              </div>
              <p className="text-center text-xs font-medium text-muted-foreground">
                { shouldShowHourSelector ? 'Dynamic pricing' : 'Fixed rate' }
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-foreground">
                No. of guests
              </Label>
              <span className="text-xs text-muted-foreground">
                { selectedAreaMaxCapacity
                  ? `Max ${selectedAreaMaxCapacity}`
                  : 'No maximum' }
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-2 py-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={ onDecreaseGuestCount }
                disabled={ guestCount <= MIN_GUEST_COUNT }
                aria-label="Decrease guest count"
              >
                <FiMinus className="size-4" aria-hidden="true" />
              </Button>
              <Input
                type="number"
                min={ MIN_GUEST_COUNT }
                max={ currentGuestLimit }
                step={ 1 }
                className="w-16 text-center text-sm"
                value={ guestCount }
                onChange={ onGuestCountInputChange }
                aria-label="Number of guests"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={ onIncreaseGuestCount }
                disabled={ guestCount >= currentGuestLimit }
                aria-label="Increase guest count"
              >
                <FiPlus className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <p
              className={ cn(
                'text-xs font-medium',
                isOverCapacity ? 'text-destructive' : 'text-muted-foreground'
              ) }
              aria-live="polite"
            >
              { capacityHelperText }
            </p>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-muted-foreground">
            Final price
          </span>
          { isPricingLoading && (
            <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <CgSpinner className="h-3 w-3 animate-spin" aria-hidden="true" />
              <span>Updating</span>
            </div>
          ) }
        </div>
        <p className="mt-2 text-3xl font-semibold text-foreground">
          { pricePreviewLabel }
        </p>
        { priceEvaluation && priceEvaluation.branch !== 'no-match' ? (
          <p className="text-xs text-muted-foreground">
            { priceBranchLabel(priceEvaluation.branch) }
          </p>
        ) : null }
        { isOverCapacity && (
          <p className="mt-2 text-xs font-medium text-destructive">
            Guest count exceeds this area&apos;s capacity.
          </p>
        ) }
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={ onResetBookingForm }
          disabled={ isBookingFormPristine }
        >
          Reset form
        </Button>
      </div>
      { !selectedAreaId && (
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          Select an area to unlock pricing and confirm your preferred date.
        </div>
      ) }
    </div>
  );
}

function BookingReservationOverlay({
  isDesktopViewport,
  isBookingOpen,
  setIsBookingOpen,
  bookingContent,
  canConfirmBooking,
  onConfirmBooking,
  onCloseBooking,
  isCheckoutPending,
  primaryActionLabel,
}: BookingReservationOverlayProps) {
  return (
    <>
      <Dialog
        open={ isDesktopViewport && isBookingOpen }
        onOpenChange={ setIsBookingOpen }
      >
        <DialogContent showCloseButton={ false }>
          <DialogHeader>
            <DialogTitle>Book a reservation</DialogTitle>
            <DialogDescription>
              Confirm your preferred duration and review the booking summary
              before checkout.
            </DialogDescription>
          </DialogHeader>
          { bookingContent }
          <DialogFooter className="mt-4 flex-col gap-3 lg:flex-row lg:items-center">
            <Button
              type="button"
              className="w-full lg:w-auto"
              onClick={ onConfirmBooking }
              disabled={ !canConfirmBooking }
            >
              { isCheckoutPending && (
                <CgSpinner className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) }
              { primaryActionLabel }
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full lg:w-auto hover:text-white"
              onClick={ onCloseBooking }
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
          <div className="px-6 pb-4">{ bookingContent }</div>
          <SheetFooter className="mt-4 space-y-3 px-6 pb-6">
            <Button
              type="button"
              className="w-full"
              onClick={ onConfirmBooking }
              disabled={ !canConfirmBooking }
            >
              { isCheckoutPending && (
                <CgSpinner className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) }
              { primaryActionLabel }
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full hover:text-white"
              onClick={ onCloseBooking }
            >
              Cancel
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

function useSpaceBooking({
  hasAreas,
  isBookingOpen,
  isGuest,
  session,
  setIsBookingOpen,
  space,
}: UseSpaceBookingParams) {
  const createCheckoutSession = useCreateCheckoutSessionMutation();
  const earliestScheduleDate = useMemo(() => getTodayIsoDate(), []);

  const findFirstPricedAreaId = useCallback(() => {
    const areaWithPricing = space.areas.find(
      (area) => area.pricingRuleId && area.pricingRuleName
    );
    return areaWithPricing?.id ?? null;
  }, [space.areas]);

  const [bookingState, dispatchBookingAction] = useReducer(
    bookingFormReducer,
    earliestScheduleDate,
    createInitialBookingFormState
  );

  const {
    bookingHours,
    selectedAreaId,
    isPricingLoading,
    guestCount,
    scheduledDate,
  } = bookingState;

  const bookingStartAtIso = useMemo(() => {
    const candidate = new Date(`${scheduledDate}T23:00:00`);
    const now = new Date();
    if (!Number.isFinite(candidate.getTime())) {
      return now.toISOString();
    }
    if (candidate.getTime() <= now.getTime()) {
      return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    }
    return candidate.toISOString();
  }, [scheduledDate]);

  const resetBookingState = useCallback(() => {
    dispatchBookingAction({
      type: 'reset',
      defaultAreaId: findFirstPricedAreaId(),
      earliestScheduleDate,
    });
  }, [earliestScheduleDate, findFirstPricedAreaId]);

  const handleResetBookingForm = useCallback(() => {
    resetBookingState();
    toast.success('Booking form reset.');
  }, [resetBookingState]);

  const initializeBookingSelection = useCallback(() => {
    dispatchBookingAction({
      type: 'initialize',
      defaultAreaId: findFirstPricedAreaId(),
    });
  }, [findFirstPricedAreaId]);

  const handleOpenBooking = useCallback(() => {
    if (!hasAreas) {
      return;
    }
    initializeBookingSelection();
    setIsBookingOpen(true);
  }, [hasAreas, initializeBookingSelection, setIsBookingOpen]);

  const handleCloseBooking = useCallback(() => {
    resetBookingState();
    setIsBookingOpen(false);
  }, [resetBookingState, setIsBookingOpen]);

  const handleSelectArea = useCallback((areaId: string) => {
    dispatchBookingAction({
      type: 'select-area',
      areaId,
    });
  }, []);

  const handleBookingHoursChange = useCallback((nextBookingHours: number) => {
    dispatchBookingAction({
      type: 'set-booking-hours',
      bookingHours: nextBookingHours,
    });
  }, []);

  const handleScheduledDateChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      dispatchBookingAction({
        type: 'set-scheduled-date',
        scheduledDate: event.target.value,
      });
    },
    []
  );

  useEffect(() => {
    if (!isBookingOpen) {
      resetBookingState();
    }
  }, [isBookingOpen, resetBookingState]);

  useEffect(() => {
    if (!selectedAreaId || !isPricingLoading) {
      return undefined;
    }

    const timeoutId = window.setTimeout(
      () =>
        dispatchBookingAction({
          type: 'set-pricing-loading',
          isPricingLoading: false,
        }),
      600
    );

    return () => window.clearTimeout(timeoutId);
  }, [isPricingLoading, selectedAreaId]);

  const selectedArea = useMemo(
    () => space.areas.find((area) => area.id === selectedAreaId) ?? null,
    [selectedAreaId, space.areas]
  );

  const activePriceRule = useMemo<PriceRuleRecord | null>(() => {
    if (!selectedArea?.pricingRuleId) {
      return null;
    }
    return (
      space.pricingRules.find(
        (rule) => rule.id === selectedArea.pricingRuleId
      ) ?? null
    );
  }, [selectedArea?.pricingRuleId, space.pricingRules]);

  const shouldShowHourSelector = useMemo(
    () => doesRuleUseBookingDurationVariables(activePriceRule),
    [activePriceRule]
  );

  const defaultPricedAreaId = findFirstPricedAreaId();
  const isBookingFormPristine =
    selectedAreaId === defaultPricedAreaId &&
    guestCount === MIN_GUEST_COUNT &&
    bookingHours === MIN_BOOKING_HOURS &&
    scheduledDate === earliestScheduleDate;

  const variableOverrides = useMemo(() => {
    const overrides: Record<string, number> = { guest_count: guestCount, };

    if (selectedArea) {
      if (typeof selectedArea.maxCapacity === 'number') {
        overrides.area_max_capacity = selectedArea.maxCapacity;
      }
      if (typeof selectedArea.minCapacity === 'number') {
        overrides.area_min_capacity = selectedArea.minCapacity;
      }
    }

    return overrides;
  }, [guestCount, selectedArea]);

  const priceEvaluation = useMemo(() => {
    if (!activePriceRule) {
      return null;
    }
    return evaluatePriceRule(activePriceRule.definition, {
      bookingHours,
      now: new Date(bookingStartAtIso),
      variableOverrides,
    });
  }, [activePriceRule, bookingHours, bookingStartAtIso, variableOverrides]);

  const selectedAreaMaxCapacity = selectedArea?.maxCapacity ?? null;
  const remainingCapacity =
    selectedAreaMaxCapacity !== null
      ? Math.max(selectedAreaMaxCapacity - guestCount, 0)
      : null;
  const isOverCapacity =
    selectedAreaMaxCapacity !== null && guestCount > selectedAreaMaxCapacity;
  const capacityHelperText = selectedArea
    ? selectedAreaMaxCapacity === null
      ? 'This area does not have a capacity limit.'
      : isOverCapacity
        ? `Over the ${selectedAreaMaxCapacity}-guest limit`
        : `${remainingCapacity} slot${remainingCapacity === 1 ? '' : 's'} remaining`
    : 'Select an area to view capacity limits.';

  const totalPrice = useMemo(() => {
    if (!priceEvaluation || priceEvaluation.price === null) {
      return null;
    }
    const formulaAlreadyHandlesGuests =
      priceEvaluation.usedVariables.includes('guest_count');
    const guestMultiplier = formulaAlreadyHandlesGuests ? 1 : guestCount;
    return priceEvaluation.price * guestMultiplier;
  }, [priceEvaluation, guestCount]);

  const pricePreviewLabel = (() => {
    if (!selectedArea) {
      return 'Select an area to preview pricing';
    }
    if (!activePriceRule) {
      return 'Pricing unavailable';
    }
    if (totalPrice === null) {
      return 'Calculating price...';
    }
    return PRICE_FORMATTER.format(totalPrice);
  })();

  const currentGuestLimit = selectedAreaMaxCapacity ?? MAX_GUEST_COUNT;

  useEffect(() => {
    const clampedGuestCount = clampGuestCount(guestCount, selectedAreaMaxCapacity);
    if (clampedGuestCount !== guestCount) {
      dispatchBookingAction({
        type: 'set-guest-count',
        guestCount: clampedGuestCount,
      });
    }
  }, [guestCount, selectedAreaMaxCapacity]);

  const handleDecreaseGuestCount = useCallback(() => {
    dispatchBookingAction({
      type: 'set-guest-count',
      guestCount: clampGuestCount(guestCount - 1, currentGuestLimit),
    });
  }, [currentGuestLimit, guestCount]);

  const handleIncreaseGuestCount = useCallback(() => {
    dispatchBookingAction({
      type: 'set-guest-count',
      guestCount: clampGuestCount(guestCount + 1, currentGuestLimit),
    });
  }, [currentGuestLimit, guestCount]);

  const handleGuestCountInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const parsed = Number(event.target.value);
      dispatchBookingAction({
        type: 'set-guest-count',
        guestCount: clampGuestCount(parsed, currentGuestLimit),
      });
    },
    [currentGuestLimit]
  );

  const primaryActionLabel = (() => {
    if (!selectedAreaId) {
      return 'Select an area';
    }
    if (createCheckoutSession.isPending) {
      return 'Booking...';
    }
    if (isPricingLoading) {
      return 'Computing price...';
    }
    if (!activePriceRule) {
      return 'Pricing unavailable';
    }
    if (totalPrice === null) {
      return 'Price unavailable';
    }
    return PRICE_FORMATTER.format(totalPrice);
  })();

  const canConfirmBooking = Boolean(
    selectedAreaId &&
      !isPricingLoading &&
      activePriceRule &&
      totalPrice !== null &&
      !isGuest &&
      !createCheckoutSession.isPending &&
      !isOverCapacity
  );

  const handleConfirmBooking = useCallback(async () => {
    if (!selectedArea || !canConfirmBooking || !session) {
      return;
    }

    try {
      const result = await createCheckoutSession.mutateAsync({
        spaceId: space.id,
        areaId: selectedArea.id,
        bookingHours,
        price: totalPrice ?? 0,
        startAt: bookingStartAtIso,
        guestCount,
      });
      resetBookingState();
      setIsBookingOpen(false);
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to place booking.';
      toast.error(message);
    }
  }, [
    bookingHours,
    bookingStartAtIso,
    canConfirmBooking,
    createCheckoutSession,
    guestCount,
    resetBookingState,
    selectedArea,
    session,
    setIsBookingOpen,
    space.id,
    totalPrice
  ]);

  return {
    bookingHours,
    canConfirmBooking,
    capacityHelperText,
    currentGuestLimit,
    earliestScheduleDate,
    guestCount,
    handleBookingHoursChange,
    handleCloseBooking,
    handleConfirmBooking,
    handleDecreaseGuestCount,
    handleGuestCountInputChange,
    handleIncreaseGuestCount,
    handleOpenBooking,
    handleResetBookingForm,
    handleScheduledDateChange,
    handleSelectArea,
    isBookingFormPristine,
    isCheckoutPending: createCheckoutSession.isPending,
    isOverCapacity,
    isPricingLoading,
    priceEvaluation,
    pricePreviewLabel,
    primaryActionLabel,
    scheduledDate,
    selectedAreaId,
    selectedAreaMaxCapacity,
    shouldShowHourSelector,
  };
}

function SpaceDetailContent({ space, }: SpaceDetailProps) {
  const { session, } = useSession();
  const pathname = usePathname();
  const isGuest = !session;
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
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const isDesktopViewport = useIsDesktopViewport(DESKTOP_BREAKPOINT_QUERY);

  const booking = useSpaceBooking({
    hasAreas,
    isBookingOpen,
    isGuest,
    session,
    setIsBookingOpen,
    space,
  });

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
  const aboutText = richTextToPlainText(aboutSource);

  const bookingDurationContent = (
    <BookingDurationForm
      areas={ space.areas }
      selectedAreaId={ booking.selectedAreaId }
      onSelectArea={ booking.handleSelectArea }
      scheduledDate={ booking.scheduledDate }
      earliestScheduleDate={ booking.earliestScheduleDate }
      onScheduledDateChange={ booking.handleScheduledDateChange }
      bookingHours={ booking.bookingHours }
      onBookingHoursChange={ booking.handleBookingHoursChange }
      isPricingLoading={ booking.isPricingLoading }
      shouldShowHourSelector={ booking.shouldShowHourSelector }
      selectedAreaMaxCapacity={ booking.selectedAreaMaxCapacity }
      currentGuestLimit={ booking.currentGuestLimit }
      guestCount={ booking.guestCount }
      onDecreaseGuestCount={ booking.handleDecreaseGuestCount }
      onIncreaseGuestCount={ booking.handleIncreaseGuestCount }
      onGuestCountInputChange={ booking.handleGuestCountInputChange }
      isOverCapacity={ booking.isOverCapacity }
      capacityHelperText={ booking.capacityHelperText }
      pricePreviewLabel={ booking.pricePreviewLabel }
      priceEvaluation={ booking.priceEvaluation }
      isBookingFormPristine={ booking.isBookingFormPristine }
      onResetBookingForm={ booking.handleResetBookingForm }
    />
  );

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

              { !isGuest && (
                <div className="lg:hidden">
                  <BookingCard
                    spaceName={ space.name }
                    onBook={ booking.handleOpenBooking }
                    isDisabled={ !hasAreas }
                  />
                </div>
              ) }

              <SpaceDescriptionSection
                spaceId={ space.id }
                spaceName={ space.name }
                aboutText={ aboutText }
              />
            </div>

            { !isGuest && (
              <div className="hidden lg:block">
                <BookingCard
                  spaceName={ space.name }
                  onBook={ booking.handleOpenBooking }
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

          <WhereYoullBe
            city={ space.city }
            region={ space.region }
            country={ space.countryCode }
          />
        </div>
      </div>
      <BookingReservationOverlay
        isDesktopViewport={ isDesktopViewport }
        isBookingOpen={ isBookingOpen }
        setIsBookingOpen={ setIsBookingOpen }
        bookingContent={ bookingDurationContent }
        canConfirmBooking={ booking.canConfirmBooking }
        onConfirmBooking={ booking.handleConfirmBooking }
        onCloseBooking={ booking.handleCloseBooking }
        isCheckoutPending={ booking.isCheckoutPending }
        primaryActionLabel={ booking.primaryActionLabel }
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

const BOOKING_DURATION_VARIABLE_KEY_SET = new Set(
  BOOKING_DURATION_VARIABLE_KEYS.map((key) => key.toLowerCase())
);

function isBookingDurationVariableOperand(operand: PriceRuleOperand): boolean {
  return (
    operand.kind === 'variable' &&
    BOOKING_DURATION_VARIABLE_KEY_SET.has(operand.key.trim().toLowerCase())
  );
}

function doesRuleUseBookingDurationVariables(rule: PriceRuleRecord | null): boolean {
  if (!rule) {
    return false;
  }

  const referencesInConditions = rule.definition.conditions.some(
    (condition) =>
      isBookingDurationVariableOperand(condition.left) ||
      isBookingDurationVariableOperand(condition.right)
  );

  const normalizedFormula = rule.definition.formula.toLowerCase();
  const formulaReferencesBookingDuration = BOOKING_DURATION_VARIABLE_KEYS.some(
    (variable) => normalizedFormula.includes(variable.toLowerCase())
  );

  const declaresBookingDurationVariable = rule.definition.variables.some(
    (variable) =>
      BOOKING_DURATION_VARIABLE_KEY_SET.has(variable.key.trim().toLowerCase())
  );

  return (
    referencesInConditions ||
    formulaReferencesBookingDuration ||
    declaresBookingDurationVariable
  );
}
