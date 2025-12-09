'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent
} from 'react';
import {
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiChevronUp,
  FiMessageSquare,
  FiMinus,
  FiPlus,
  FiUsers
} from 'react-icons/fi';
import { CgSpinner } from 'react-icons/cg';
import { toast } from 'sonner';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
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
import { MAX_BOOKING_HOURS } from '@/lib/bookings/constants';
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
type BookingDurationUnitKey = 'hours' | 'days' | 'weeks' | 'months';
type BookingDurationUnit = {
  key: BookingDurationUnitKey;
  label: string;
  pluralLabel: string;
  multiplier: number;
};

const BOOKING_DURATION_UNITS: BookingDurationUnit[] = [
  {
    key: 'hours',
    label: 'Hour',
    pluralLabel: 'Hours',
    multiplier: 1,
  },
  {
    key: 'days',
    label: 'Day',
    pluralLabel: 'Days',
    multiplier: 24,
  },
  {
    key: 'weeks',
    label: 'Week',
    pluralLabel: 'Weeks',
    multiplier: 24 * 7,
  },
  {
    key: 'months',
    label: 'Month',
    pluralLabel: 'Months',
    multiplier: 24 * 30,
  }
];

const DEFAULT_BOOKING_UNIT_INDEX = 0;
const DEFAULT_BOOKING_UNIT_VALUE = 1;
const MIN_GUEST_COUNT = 1;
const MAX_GUEST_COUNT = 99;

const clampGuestCount = (value: number, maxLimit: number | null = null) => {
  if (!Number.isFinite(value)) {
    return MIN_GUEST_COUNT;
  }
  const normalized = Math.trunc(value);
  const upperLimit = maxLimit ?? MAX_GUEST_COUNT;
  return Math.min(Math.max(normalized, MIN_GUEST_COUNT), upperLimit);
};

const getMaxUnitsForDurationUnit = (multiplier: number) =>
  Math.max(1, Math.floor(MAX_BOOKING_HOURS / multiplier));
type SpaceDetailProps = {
  space: MarketplaceSpaceDetail;
};

export default function SpaceDetail({ space, }: SpaceDetailProps) {
  const { session, } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isGuest = !session;
  const {
 data: userBookings = [], isLoading: isBookingsLoading, 
} =
    useUserBookingsQuery({ enabled: !isGuest, });
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
  const [bookingDurationUnitIndex, setBookingDurationUnitIndex] = useState(
    DEFAULT_BOOKING_UNIT_INDEX
  );
  const [bookingUnitValue, setBookingUnitValue] = useState(DEFAULT_BOOKING_UNIT_VALUE);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [guestCount, setGuestCount] = useState(MIN_GUEST_COUNT);
  const [scheduledDate, setScheduledDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const earliestScheduleDate = useMemo(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }, []);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia(DESKTOP_BREAKPOINT_QUERY).matches;
  });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const handleOpenChat = useCallback(() => setIsChatOpen(true), []);
  const handleCloseChat = useCallback(() => setIsChatOpen(false), []);
  const createCheckoutSession = useCreateCheckoutSessionMutation();
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
    setBookingDurationUnitIndex(DEFAULT_BOOKING_UNIT_INDEX);
    setBookingUnitValue(DEFAULT_BOOKING_UNIT_VALUE);
    setSelectedAreaId(null);
    setIsPricingLoading(false);
    setGuestCount(MIN_GUEST_COUNT);
  }, []);

  const findFirstPricedAreaId = useCallback(() => {
    const areaWithPricing = space.areas.find(
      (area) => area.pricingRuleId && area.pricingRuleName
    );
    return areaWithPricing?.id ?? null;
  }, [space.areas]);

  const initializeBookingSelection = useCallback(() => {
    const defaultAreaId = findFirstPricedAreaId();
    setBookingDurationUnitIndex(DEFAULT_BOOKING_UNIT_INDEX);
    setBookingUnitValue(DEFAULT_BOOKING_UNIT_VALUE);
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

  const handleScheduledDateChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setScheduledDate(event.target.value);
  }, []);

  useEffect(() => {
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
    router.replace(nextUrl, { scroll: false, });
  }, [pathname, router, searchParams]);
  const handleCloseBooking = useCallback(() => {
    resetBookingState();
    setIsBookingOpen(false);
  }, [resetBookingState]);
  const currentDurationUnit = BOOKING_DURATION_UNITS[bookingDurationUnitIndex];
  const bookingUnitMax = getMaxUnitsForDurationUnit(currentDurationUnit.multiplier);
  const bookingHours = bookingUnitValue * currentDurationUnit.multiplier;
  const bookingUnitLabel =
    bookingUnitValue === 1 ? currentDurationUnit.label : currentDurationUnit.pluralLabel;
  const increaseBookingUnitValue = useCallback(() => {
    setBookingUnitValue((prev) =>
      Math.min(
        prev + 1,
        getMaxUnitsForDurationUnit(
          BOOKING_DURATION_UNITS[bookingDurationUnitIndex].multiplier
        )
      )
    );
  }, [bookingDurationUnitIndex]);
  const decreaseBookingUnitValue = useCallback(() => {
    setBookingUnitValue((prev) => Math.max(prev - 1, DEFAULT_BOOKING_UNIT_VALUE));
  }, []);
  const handleSelectArea = useCallback((areaId: string) => {
    setSelectedAreaId(areaId);
    setBookingUnitValue(DEFAULT_BOOKING_UNIT_VALUE);
    setIsPricingLoading(true);
  }, []);

  const cycleBookingDurationUnit = useCallback((direction: 1 | -1) => {
    setBookingDurationUnitIndex((prevIndex) => {
      const totalUnits = BOOKING_DURATION_UNITS.length;
      const nextIndex =
        (prevIndex + direction + totalUnits) % totalUnits;
      const currentUnit = BOOKING_DURATION_UNITS[prevIndex];
      const nextUnit = BOOKING_DURATION_UNITS[nextIndex];
      const nextMax = getMaxUnitsForDurationUnit(nextUnit.multiplier);
      setBookingUnitValue((prevValue) => {
        const currentHours = prevValue * currentUnit.multiplier;
        const nextValue = Math.max(
          DEFAULT_BOOKING_UNIT_VALUE,
          Math.ceil(currentHours / nextUnit.multiplier)
        );
        return Math.min(nextValue, nextMax);
      });
      return nextIndex;
    });
  }, []);

  const handlePreviousDurationUnit = useCallback(
    () => cycleBookingDurationUnit(-1),
    [cycleBookingDurationUnit]
  );
  const handleNextDurationUnit = useCallback(
    () => cycleBookingDurationUnit(1),
    [cycleBookingDurationUnit]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mediaQuery = window.matchMedia(DESKTOP_BREAKPOINT_QUERY) as MediaQueryList & {
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
  }, []);

  const overviewFallback =
    'Located in the heart of the city, Downtown Space offers a modern and flexible coworking environment designed for entrepreneurs, freelancers, and small teams. With high-speed Wi-Fi, ergonomic workstations, private meeting rooms, and a cozy lounge area, it is the perfect place to stay productive and inspired.';

  const rawAbout = space.description?.trim();
  const aboutSource =
    rawAbout && rawAbout.length > 0 ? rawAbout : `<p>${overviewFallback}</p>`;
  const aboutHtml = sanitizeRichText(aboutSource);

  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isDescriptionOverflowing, setIsDescriptionOverflowing] =
    useState(false);
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
    return (
      space.pricingRules.find(
        (rule) => rule.id === selectedArea.pricingRuleId
      ) ?? null
    );
  }, [selectedArea?.pricingRuleId, space.pricingRules]);

  useEffect(() => {
    if (!selectedAreaId || !isPricingLoading) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setIsPricingLoading(false), 600);

    return () => window.clearTimeout(timeoutId);
  }, [isPricingLoading, selectedAreaId]);

  const shouldShowHourSelector = useMemo(
    () => doesRuleUseBookingDurationVariables(activePriceRule),
    [activePriceRule]
  );

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
    return evaluatePriceRule(
      activePriceRule.definition,
      {
        bookingHours,
        variableOverrides,
      }
    );
  }, [activePriceRule, bookingHours, variableOverrides]);

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

  const basePrice = priceEvaluation?.price ?? null;
  const totalPrice = basePrice === null ? null : basePrice * guestCount;
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
    setGuestCount((current) => clampGuestCount(current, selectedAreaMaxCapacity));
  }, [selectedAreaMaxCapacity]);

  const handleDecreaseGuestCount = useCallback(() => {
    setGuestCount((current) => clampGuestCount(current - 1, currentGuestLimit));
  }, [currentGuestLimit]);

  const handleIncreaseGuestCount = useCallback(() => {
    setGuestCount((current) => clampGuestCount(current + 1, currentGuestLimit));
  }, [currentGuestLimit]);

  const handleGuestCountInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number(event.target.value);
    setGuestCount(clampGuestCount(parsed, currentGuestLimit));
  }, [currentGuestLimit]);

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
                { space.areas.length } area{ space.areas.length === 1 ? '' : 's' }
              </span>
            </div>
            { space.areas.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 px-3 py-5 text-center text-sm text-muted-foreground">
                No areas available yet.
              </div>
            ) : (
              <Select
                id="area-select"
                value={ selectedAreaId ?? undefined }
                onValueChange={ handleSelectArea }
              >
                <SelectTrigger
                  className="w-full rounded-md"
                  aria-label="Select an area"
                >
                  <SelectValue placeholder="Select an area" />
                </SelectTrigger>
                <SelectContent className="max-w-[26rem]">
                  { space.areas.map((area) => {
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
              onChange={ handleScheduledDateChange }
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
                { bookingHours } hour{ bookingHours === 1 ? '' : 's' } total
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/40 px-2 py-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={ decreaseBookingUnitValue }
                disabled={
                  bookingUnitValue <= DEFAULT_BOOKING_UNIT_VALUE ||
                  isPricingLoading ||
                  !selectedAreaId
                }
                aria-label="Decrease booking duration"
              >
                <FiMinus className="size-4" aria-hidden="true" />
              </Button>
              <div className="text-center">
                <p className="text-2xl font-semibold text-foreground">
                  { bookingUnitValue }
                </p>
                <p className="text-xs uppercase text-muted-foreground">
                  { bookingUnitLabel }
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={ increaseBookingUnitValue }
                disabled={
                  bookingUnitValue >= bookingUnitMax ||
                  isPricingLoading ||
                  !selectedAreaId
                }
                aria-label="Increase booking duration"
              >
                <FiPlus className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={ handlePreviousDurationUnit }
                disabled={ isPricingLoading || !selectedAreaId }
                aria-label="Switch to the previous duration unit"
              >
                <FiChevronLeft className="size-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={ handleNextDurationUnit }
                disabled={ isPricingLoading || !selectedAreaId }
                aria-label="Switch to the next duration unit"
              >
                <FiChevronRight className="size-4" aria-hidden="true" />
              </Button>
              <span>
                { shouldShowHourSelector
                  ? 'Dynamic pricing'
                  : 'Fixed rate' }
              </span>
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
                onClick={ handleDecreaseGuestCount }
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
                onChange={ handleGuestCountInputChange }
                aria-label="Number of guests"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={ handleIncreaseGuestCount }
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
        <p className="text-3xl font-semibold text-foreground mt-2">
          { pricePreviewLabel }
        </p>
        { priceEvaluation && priceEvaluation.branch !== 'no-match' ? (
          <p className="text-xs text-muted-foreground">
            { priceBranchLabel(priceEvaluation.branch) }
          </p>
        ) : null }
        { isOverCapacity && (
          <p className="text-xs text-destructive font-medium mt-2">
            Guest count exceeds this area&apos;s capacity.
          </p>
        ) }
      </div>
      { !selectedAreaId && (
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          Select an area to unlock pricing and confirm your preferred date.
        </div>
      ) }
    </div>
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

  const bookingButtonContent = (
    <>
      { createCheckoutSession.isPending && (
        <CgSpinner className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) }
      { primaryActionLabel }
    </>
  );

  const canConfirmBooking = Boolean(
    selectedAreaId &&
    !isPricingLoading &&
    activePriceRule &&
    totalPrice !== null &&
    !isGuest &&
    !createCheckoutSession.isPending
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
    canConfirmBooking,
    createCheckoutSession,
    resetBookingState,
    selectedArea,
    session,
    space.id,
    totalPrice
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

              <section
                ref={ descriptionSectionRef }
                className="space-y-4 border-b pb-6"
              >
                <h2 className="text-xl font-medium text-foreground">
                  About { space.name }
                </h2>
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
                            <FiChevronDown
                              className="size-4"
                              aria-hidden="true"
                            />
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

          <WhereYoullBe
            city={ space.city }
            region={ space.region }
            country={ space.countryCode }
          />
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
              Confirm your preferred duration and review the booking summary
              before checkout.
            </DialogDescription>
          </DialogHeader>
          { bookingDurationContent }
          <DialogFooter className="flex-col gap-3 lg:flex-row lg:items-center mt-4">
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
          <SheetFooter className="space-y-3 px-6 pb-6 mt-4">
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

const BOOKING_DURATION_VARIABLE_KEY_SET = new Set(
  BOOKING_DURATION_VARIABLE_KEYS.map((key) => key.toLowerCase())
);

function isBookingDurationVariableOperand(
  operand: PriceRuleOperand
): boolean {
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
