'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from 'react';
import { CgSpinner } from 'react-icons/cg';
import { FiMinus, FiPlus } from 'react-icons/fi';
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';

import { BookingCard } from './BookingCard';

import type { MarketplaceSpaceDetail } from '@/lib/queries/space';
import type { PriceRuleVariable } from '@/lib/pricing-rules';
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
import { useCreateCheckoutSessionMutation } from '@/hooks/api/useBookings';

const PRICE_FORMATTER = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});
const DEFAULT_BOOKING_HOURS = MIN_BOOKING_HOURS;
const MIN_GUEST_COUNT = 1;
const MAX_GUEST_COUNT = 99;

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

type SessionValue = ReturnType<typeof import('@/components/auth/SessionProvider').useSession>['session'];

type BookingFormState = {
  bookingHours: number;
  selectedAreaId: string | null;
  isPricingLoading: boolean;
  guestCount: number;
  scheduledDate: string;
  customVariables: Record<string, string | number>;
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
  | { type: 'set-scheduled-date'; scheduledDate: string }
  | { type: 'set-custom-variable'; key: string; value: string | number };

function createInitialBookingFormState(
  earliestScheduleDate: string
): BookingFormState {
  return {
    bookingHours: DEFAULT_BOOKING_HOURS,
    selectedAreaId: null,
    isPricingLoading: false,
    guestCount: MIN_GUEST_COUNT,
    scheduledDate: earliestScheduleDate,
    customVariables: {},
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
        customVariables: {},
      };
    case 'reset':
      return {
        bookingHours: DEFAULT_BOOKING_HOURS,
        selectedAreaId: action.defaultAreaId,
        isPricingLoading: Boolean(action.defaultAreaId),
        guestCount: MIN_GUEST_COUNT,
        scheduledDate: action.earliestScheduleDate,
        customVariables: {},
      };
    case 'select-area':
      return {
        ...state,
        selectedAreaId: action.areaId,
        bookingHours: DEFAULT_BOOKING_HOURS,
        isPricingLoading: true,
        customVariables: {},
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
    case 'set-custom-variable':
      return {
        ...state,
        customVariables: {
          ...state.customVariables,
          [action.key]: action.value,
        },
      };
    default: {
      const exhaustiveCheck: never = action;
      return exhaustiveCheck;
    }
  }
}

// --- Booking Duration Variables Check ---

const BOOKING_DURATION_VARIABLE_KEY_SET = new Set(
  BOOKING_DURATION_VARIABLE_KEYS.map((key) => key.toLowerCase())
);

function isBookingDurationVariableOperand(operand: PriceRuleOperand): boolean {
  return (
    operand.kind === 'variable' &&
    BOOKING_DURATION_VARIABLE_KEY_SET.has(operand.key.trim().toLowerCase())
  );
}

function doesRuleUseBookingDurationVariables(
  rule: PriceRuleRecord | null
): boolean {
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

// --- Sub-components ---

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
  userInputVariables: PriceRuleVariable[];
  customVariables: Record<string, string | number>;
  onCustomVariableChange: (key: string, value: string | number) => void;
};

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
  userInputVariables,
  customVariables,
  onCustomVariableChange,
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
        { userInputVariables.length > 0 && (
          <div className="mt-4 space-y-3">
            <Label className="text-sm font-semibold text-foreground">
              Additional details
            </Label>
            <div className="grid gap-3 md:grid-cols-2">
              { userInputVariables.map((variable) => (
                <div key={ variable.key } className="space-y-1">
                  <Label
                    htmlFor={ `custom-var-${variable.key}` }
                    className="text-xs font-medium text-muted-foreground"
                  >
                    { variable.label }
                  </Label>
                  <Input
                    id={ `custom-var-${variable.key}` }
                    type={ variable.type === 'number' ? 'number' : 'text' }
                    value={ customVariables[variable.key] ?? '' }
                    onChange={ (e) => {
                      const raw = e.target.value;
                      onCustomVariableChange(
                        variable.key,
                        variable.type === 'number' ? (raw === '' ? '' : Number(raw)) : raw
                      );
                    } }
                    aria-label={ variable.label }
                  />
                </div>
              )) }
            </div>
          </div>
        ) }
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

// --- Booking Reservation Overlay ---

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
  const handleOpenChange = (open: boolean) => {
    if (!open && isCheckoutPending) {
      return;
    }
    setIsBookingOpen(open);
  };

  return (
    <>
      <Dialog
        open={ isDesktopViewport && isBookingOpen }
        onOpenChange={ handleOpenChange }
      >
        <DialogContent
          showCloseButton={ false }
          fullWidth
          dismissible={ !isCheckoutPending }
          className="max-h-[90vh] overflow-y-auto lg:max-w-[1024px]"
        >
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
              loading={ isCheckoutPending }
              loadingText="Booking..."
            >
              { primaryActionLabel }
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full lg:w-auto hover:text-white"
              onClick={ onCloseBooking }
              disabled={ isCheckoutPending }
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Sheet
        open={ !isDesktopViewport && isBookingOpen }
        onOpenChange={ handleOpenChange }
      >
        <SheetContent
          side="bottom"
          dismissible={ !isCheckoutPending }
          className="max-h-[90vh] gap-4 overflow-y-auto rounded-t-2xl"
        >
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
              loading={ isCheckoutPending }
              loadingText="Booking..."
            >
              { primaryActionLabel }
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full hover:text-white"
              onClick={ onCloseBooking }
              disabled={ isCheckoutPending }
            >
              Cancel
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

// --- Viewport Hook ---

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

// --- Main Exported Component ---

const DESKTOP_BREAKPOINT_QUERY = '(min-width: 1024px)';

export type SpaceBookingFlowHandle = {
  openBooking: () => void;
};

type SpaceBookingFlowProps = {
  space: MarketplaceSpaceDetail;
  canBook: boolean;
  session: SessionValue;
  hasAreas: boolean;
};

export const SpaceBookingFlow = forwardRef<
  SpaceBookingFlowHandle,
  SpaceBookingFlowProps
>(function SpaceBookingFlow({
 space, canBook, session, hasAreas, 
}, ref) {
  const createCheckoutSession = useCreateCheckoutSessionMutation();
  const earliestScheduleDate = useMemo(() => getTodayIsoDate(), []);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const isDesktopViewport = useIsDesktopViewport(DESKTOP_BREAKPOINT_QUERY);

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
    customVariables,
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
  }, [hasAreas, initializeBookingSelection]);

  const handleCloseBooking = useCallback(() => {
    resetBookingState();
    setIsBookingOpen(false);
  }, [resetBookingState]);

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

  const userInputVariables = useMemo<PriceRuleVariable[]>(() => {
    if (!activePriceRule) {
      return [];
    }
    return activePriceRule.definition.variables.filter(
      (variable) => variable.userInput === true
    );
  }, [activePriceRule]);

  const handleCustomVariableChange = useCallback(
    (key: string, value: string | number) => {
      dispatchBookingAction({
 type: 'set-custom-variable',
key,
value, 
});
    },
    []
  );

  const defaultPricedAreaId = findFirstPricedAreaId();
  const isBookingFormPristine =
    selectedAreaId === defaultPricedAreaId &&
    guestCount === MIN_GUEST_COUNT &&
    bookingHours === MIN_BOOKING_HOURS &&
    scheduledDate === earliestScheduleDate;

  const variableOverrides = useMemo(() => {
    const overrides: Record<string, string | number> = { guest_count: guestCount, };

    if (selectedArea) {
      if (typeof selectedArea.maxCapacity === 'number') {
        overrides.area_max_capacity = selectedArea.maxCapacity;
      }
      if (typeof selectedArea.minCapacity === 'number') {
        overrides.area_min_capacity = selectedArea.minCapacity;
      }
    }

    for (const [key, value] of Object.entries(customVariables)) {
      if (value !== '') {
        overrides[key] = value;
      }
    }

    return overrides;
  }, [customVariables, guestCount, selectedArea]);

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

  const hasAllCustomVariables = userInputVariables.every((variable) => {
    const value = customVariables[variable.key];
    if (value === undefined || value === '') return false;
    if (variable.type === 'number' && typeof value === 'number' && !Number.isFinite(value)) return false;
    return true;
  });

  const canConfirmBooking = Boolean(
    selectedAreaId &&
      !isPricingLoading &&
      activePriceRule &&
      totalPrice !== null &&
      canBook &&
      !createCheckoutSession.isPending &&
      !isOverCapacity &&
      hasAllCustomVariables
  );

  const handleConfirmBooking = useCallback(async () => {
    if (!selectedArea || !canConfirmBooking || !session) {
      return;
    }

    try {
      const checkoutOverrides: Record<string, string | number> = {};
      for (const variable of userInputVariables) {
        const value = customVariables[variable.key];
        if (value !== undefined && value !== '') {
          checkoutOverrides[variable.key] = value;
        }
      }

      const result = await createCheckoutSession.mutateAsync({
        spaceId: space.id,
        areaId: selectedArea.id,
        bookingHours,
        startAt: bookingStartAtIso,
        guestCount,
        ...(Object.keys(checkoutOverrides).length > 0
          ? { variableOverrides: checkoutOverrides, }
          : {}),
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
    customVariables,
    guestCount,
    resetBookingState,
    selectedArea,
    session,
    space.id,
    userInputVariables
  ]);

  // Expose openBooking to the parent via ref
  useImperativeHandle(
    ref,
    () => ({ openBooking: handleOpenBooking, }),
    [handleOpenBooking]
  );

  // Auto-open booking from ?book=true search param
  const searchParams = useSearchParams();
  const hasAutoOpened = useRef(false);
  useEffect(() => {
    if (
      searchParams.get('book') === 'true' &&
      canBook &&
      hasAreas &&
      !hasAutoOpened.current
    ) {
      hasAutoOpened.current = true;
      handleOpenBooking();
    }
  }, [searchParams, canBook, hasAreas, handleOpenBooking]);

  const bookingDurationContent = (
    <BookingDurationForm
      areas={ space.areas }
      selectedAreaId={ selectedAreaId }
      onSelectArea={ handleSelectArea }
      scheduledDate={ scheduledDate }
      earliestScheduleDate={ earliestScheduleDate }
      onScheduledDateChange={ handleScheduledDateChange }
      bookingHours={ bookingHours }
      onBookingHoursChange={ handleBookingHoursChange }
      isPricingLoading={ isPricingLoading }
      shouldShowHourSelector={ shouldShowHourSelector }
      selectedAreaMaxCapacity={ selectedAreaMaxCapacity }
      currentGuestLimit={ currentGuestLimit }
      guestCount={ guestCount }
      onDecreaseGuestCount={ handleDecreaseGuestCount }
      onIncreaseGuestCount={ handleIncreaseGuestCount }
      onGuestCountInputChange={ handleGuestCountInputChange }
      isOverCapacity={ isOverCapacity }
      capacityHelperText={ capacityHelperText }
      pricePreviewLabel={ pricePreviewLabel }
      priceEvaluation={ priceEvaluation }
      isBookingFormPristine={ isBookingFormPristine }
      onResetBookingForm={ handleResetBookingForm }
      userInputVariables={ userInputVariables }
      customVariables={ customVariables }
      onCustomVariableChange={ handleCustomVariableChange }
    />
  );

  if (!canBook) {
    return null;
  }

  return (
    <BookingReservationOverlay
      isDesktopViewport={ isDesktopViewport }
      isBookingOpen={ isBookingOpen }
      setIsBookingOpen={ setIsBookingOpen }
      bookingContent={ bookingDurationContent }
      canConfirmBooking={ canConfirmBooking }
      onConfirmBooking={ handleConfirmBooking }
      onCloseBooking={ handleCloseBooking }
      isCheckoutPending={ createCheckoutSession.isPending }
      primaryActionLabel={ primaryActionLabel }
    />
  );
});

// --- Booking Card Wrappers (for layout positioning) ---

type SpaceBookingCardProps = {
  spaceName: string;
  hasAreas: boolean;
  onBook: () => void;
  className?: string;
};

export function SpaceBookingCardMobile({
  spaceName,
  hasAreas,
  onBook,
  className,
}: SpaceBookingCardProps) {
  return (
    <div className={ cn('lg:hidden', className) }>
      <BookingCard
        spaceName={ spaceName }
        onBook={ onBook }
        isDisabled={ !hasAreas }
      />
    </div>
  );
}

export function SpaceBookingCardDesktop({
  spaceName,
  hasAreas,
  onBook,
  className,
}: SpaceBookingCardProps) {
  return (
    <div className={ cn('hidden lg:block', className) }>
      <BookingCard
        spaceName={ spaceName }
        onBook={ onBook }
        isDisabled={ !hasAreas }
      />
    </div>
  );
}
