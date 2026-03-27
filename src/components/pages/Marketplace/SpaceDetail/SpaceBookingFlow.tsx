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
import {
FiArrowRight,
FiCalendar,
FiClock,
FiEdit,
FiMinus,
FiPlus,
FiUsers
} from 'react-icons/fi';
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
import {
  Dialog,
  DialogContent,
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
import { MIN_BOOKING_HOURS } from '@/lib/bookings/constants';
import { type PriceRuleRecord } from '@/lib/pricing-rules';
import { evaluatePriceRule, type PriceRuleEvaluationResult } from '@/lib/pricing-rules-evaluator';
import { useAreaOccupancyQuery, useCreateCheckoutSessionMutation } from '@/hooks/api/useBookings';

const PRICE_FORMATTER = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});
const MIN_GUEST_COUNT = 1;
const MAX_GUEST_COUNT = 99;
const COUPON_LIKE_VARIABLE_PATTERN = /\b(coupon|promo|voucher|discount)\b/i;
const MS_PER_HOUR = 60 * 60 * 1000;

const getTodayIsoDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

const getDefaultCheckInTime = () => '09:00';
const getDefaultCheckOutTime = () => '10:00';

/**
 * Derive booking hours from check-in/check-out with ceiling to the nearest
 * whole hour. Returns null when the range is invalid (check-out <= check-in).
 */
const deriveBookingHours = (
  checkInDate: string,
  checkInTime: string,
  checkOutDate: string,
  checkOutTime: string
): number | null => {
  const start = new Date(`${checkInDate}T${checkInTime}:00`);
  const end = new Date(`${checkOutDate}T${checkOutTime}:00`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return null;
  }
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) {
    return null;
  }
  return Math.ceil(diffMs / MS_PER_HOUR);
};

const formatDurationLabel = (hours: number): string => {
  if (hours < 24) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  const dayLabel = `${days} ${days === 1 ? 'day' : 'days'}`;
  if (remainingHours === 0) {
    return dayLabel;
  }
  return `${dayLabel}, ${remainingHours} ${remainingHours === 1 ? 'hr' : 'hrs'}`;
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
  checkInDate: string;
  checkInTime: string;
  checkOutDate: string;
  checkOutTime: string;
  selectedAreaId: string | null;
  isPricingLoading: boolean;
  guestCount: number;
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
  | { type: 'set-pricing-loading'; isPricingLoading: boolean }
  | { type: 'set-guest-count'; guestCount: number }
  | { type: 'set-check-in-date'; value: string }
  | { type: 'set-check-in-time'; value: string }
  | { type: 'set-check-out-date'; value: string }
  | { type: 'set-check-out-time'; value: string }
  | { type: 'set-custom-variable'; key: string; value: string | number };

function createInitialBookingFormState(
  earliestScheduleDate: string
): BookingFormState {
  return {
    checkInDate: earliestScheduleDate,
    checkInTime: getDefaultCheckInTime(),
    checkOutDate: earliestScheduleDate,
    checkOutTime: getDefaultCheckOutTime(),
    selectedAreaId: null,
    isPricingLoading: false,
    guestCount: MIN_GUEST_COUNT,
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
        checkInTime: getDefaultCheckInTime(),
        checkOutTime: getDefaultCheckOutTime(),
        selectedAreaId: action.defaultAreaId,
        isPricingLoading: Boolean(action.defaultAreaId),
        customVariables: {},
      };
    case 'reset':
      return {
        checkInDate: action.earliestScheduleDate,
        checkInTime: getDefaultCheckInTime(),
        checkOutDate: action.earliestScheduleDate,
        checkOutTime: getDefaultCheckOutTime(),
        selectedAreaId: action.defaultAreaId,
        isPricingLoading: Boolean(action.defaultAreaId),
        guestCount: MIN_GUEST_COUNT,
        customVariables: {},
      };
    case 'select-area':
      return {
        ...state,
        selectedAreaId: action.areaId,
        isPricingLoading: true,
        customVariables: {},
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
    case 'set-check-in-date': {
      const next = {
 ...state,
checkInDate: action.value, 
};
      // If check-out date is before the new check-in date, advance it
      if (next.checkOutDate < next.checkInDate) {
        next.checkOutDate = next.checkInDate;
      }
      return next;
    }
    case 'set-check-in-time':
      return {
 ...state,
checkInTime: action.value, 
};
    case 'set-check-out-date':
      return {
 ...state,
checkOutDate: action.value, 
};
    case 'set-check-out-time':
      return {
 ...state,
checkOutTime: action.value, 
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

// --- Sub-components ---

type BookingDurationFormProps = {
  areas: MarketplaceSpaceDetail['areas'];
  selectedAreaId: string | null;
  onSelectArea: (areaId: string) => void;
  checkInDate: string;
  checkInTime: string;
  checkOutDate: string;
  checkOutTime: string;
  earliestScheduleDate: string;
  onCheckInDateChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onCheckInTimeChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onCheckOutDateChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onCheckOutTimeChange: (event: ChangeEvent<HTMLInputElement>) => void;
  derivedBookingHours: number | null;
  isPricingLoading: boolean;
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

function isCouponLikeVariable(variable: PriceRuleVariable) {
  const searchableText = `${variable.key} ${variable.label} ${variable.displayName ?? ''}`;
  return COUPON_LIKE_VARIABLE_PATTERN.test(searchableText);
}

function BookingDurationForm({
  areas,
  selectedAreaId,
  onSelectArea,
  checkInDate,
  checkInTime,
  checkOutDate,
  checkOutTime,
  earliestScheduleDate,
  onCheckInDateChange,
  onCheckInTimeChange,
  onCheckOutDateChange,
  onCheckOutTimeChange,
  derivedBookingHours,
  isPricingLoading,
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
  const isInvalidRange = derivedBookingHours === null;
  const isBelowMinimum = derivedBookingHours !== null && derivedBookingHours < MIN_BOOKING_HOURS;

  return (
    <div className="space-y-6 py-2">
      <div className="space-y-4">
        { /* Step 1: Area selection */ }
        <div className="space-y-4 rounded-xl border border-border/50 bg-muted/20 p-4">
          <div className="flex items-center gap-2 border-b border-border/50 pb-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FiCalendar className="size-4" />
            </div>
            <h3 className="font-semibold text-foreground">1. Select Area</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="area-select"
                  className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                >
                  Area
                </Label>
              </div>
              { areas.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-4 text-center text-sm text-muted-foreground">
                  No areas available.
                </div>
              ) : (
                <Select value={ selectedAreaId ?? undefined } onValueChange={ onSelectArea }>
                  <SelectTrigger
                    id="area-select"
                    className="h-11 rounded-lg border-border/50 bg-background shadow-none transition-all hover:bg-accent/50 focus:ring-1"
                    aria-label="Select an area"
                  >
                    <SelectValue placeholder="Pick an area" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[26rem]">
                    { areas.map((area) => (
                      <SelectItem
                        key={ area.id }
                        value={ area.id }
                        disabled={ !area.pricingRuleId }
                      >
                        <span className="font-medium">{ area.name }</span>
                      </SelectItem>
                    )) }
                  </SelectContent>
                </Select>
              ) }
            </div>
          </div>
        </div>

        { /* Step 2: Guests */ }
        <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
          <div className="flex items-center gap-2 border-b border-border/50 pb-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FiUsers className="size-4" />
            </div>
            <h3 className="font-semibold text-foreground">2. Guests</h3>
          </div>

          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Number of Guests</p>
                <p
                  className={ cn(
                    'text-xs',
                    isOverCapacity ? 'font-medium text-destructive' : 'text-muted-foreground'
                  ) }
                >
                  { capacityHelperText }
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-background p-1 shadow-sm">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-md"
                  onClick={ onDecreaseGuestCount }
                  disabled={ guestCount <= MIN_GUEST_COUNT }
                >
                  <FiMinus className="size-3" />
                </Button>
                <Input
                  type="number"
                  className="h-8 w-12 border-none bg-transparent p-0 text-center text-sm font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus-visible:ring-0"
                  value={ guestCount }
                  onChange={ onGuestCountInputChange }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-md"
                  onClick={ onIncreaseGuestCount }
                  disabled={ guestCount >= currentGuestLimit }
                >
                  <FiPlus className="size-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        { /* Step 3: Check-in / Check-out */ }
          <div className="space-y-4 rounded-xl border border-border/50 bg-muted/20 p-4">
            <div className="flex items-center gap-2 border-b border-border/50 pb-2">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FiClock className="size-4" />
              </div>
              <h3 className="font-semibold text-foreground">3. Check-in & Check-out</h3>
            </div>

            <div className="space-y-4 pt-2">
              { /* Check-in */ }
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Check-in
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={ checkInDate }
                    min={ earliestScheduleDate }
                    onChange={ onCheckInDateChange }
                    aria-label="Check-in date"
                    className="h-11 rounded-lg border-border/50 bg-background shadow-none transition-all hover:bg-accent/50 focus:ring-1"
                  />
                  <Input
                    type="time"
                    value={ checkInTime }
                    onChange={ onCheckInTimeChange }
                    aria-label="Check-in time"
                    className="h-11 rounded-lg border-border/50 bg-background shadow-none transition-all hover:bg-accent/50 focus:ring-1"
                  />
                </div>
              </div>

              <div className="flex items-center justify-center">
                <FiArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </div>

              { /* Check-out */ }
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Check-out
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={ checkOutDate }
                    min={ checkInDate }
                    onChange={ onCheckOutDateChange }
                    aria-label="Check-out date"
                    className="h-11 rounded-lg border-border/50 bg-background shadow-none transition-all hover:bg-accent/50 focus:ring-1"
                  />
                  <Input
                    type="time"
                    value={ checkOutTime }
                    onChange={ onCheckOutTimeChange }
                    aria-label="Check-out time"
                    className="h-11 rounded-lg border-border/50 bg-background shadow-none transition-all hover:bg-accent/50 focus:ring-1"
                  />
                </div>
              </div>

              { /* Duration summary */ }
              <div
                className={ cn(
                  'rounded-lg px-3 py-2 text-center text-sm font-medium',
                  isInvalidRange || isBelowMinimum
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-primary/10 text-primary'
                ) }
              >
                { isInvalidRange
                  ? 'Check-out must be after check-in'
                  : isBelowMinimum
                    ? `Minimum booking is ${MIN_BOOKING_HOURS} hour${MIN_BOOKING_HOURS === 1 ? '' : 's'}`
                    : `Duration: ${formatDurationLabel(derivedBookingHours)} (billed ${derivedBookingHours} hr${derivedBookingHours === 1 ? '' : 's'})` }
              </div>
            </div>
          </div>

          { userInputVariables.length > 0 && (
            <div className="space-y-4 rounded-xl border border-border/50 bg-muted/20 p-4">
              <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <FiEdit className="size-4" />
                </div>
                <h3 className="font-semibold text-foreground">4. Extra Details</h3>
              </div>
              <div className="grid gap-3 pt-2">
                { userInputVariables.map((variable) => (
                  <div key={ variable.key } className="space-y-1.5">
                    <Label
                      htmlFor={ `custom-var-${variable.key}` }
                      className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                    >
                      { variable.displayName || variable.label }
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
                      className={ cn(
                        'h-10 border-border/50 shadow-none focus:ring-1',
                        isCouponLikeVariable(variable) && 'bg-white dark:bg-input/30'
                      ) }
                    />
                  </div>
                )) }
              </div>
            </div>
          ) }
      </div>

      { /* Summary Section */ }
      <div className="relative mt-8 overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 p-6 transition-all dark:border-primary/30 dark:bg-primary/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h4 className="text-sm font-bold uppercase tracking-[0.1em] text-primary/80">
              Estimated Total
            </h4>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tracking-tight text-foreground">
                { pricePreviewLabel }
              </span>
              { isPricingLoading && (
                <CgSpinner className="size-5 animate-spin text-primary" />
              ) }
            </div>
            { priceEvaluation && priceEvaluation.branch !== 'no-match' && (
              <p className="text-xs font-medium text-muted-foreground">
                { priceBranchLabel(priceEvaluation.branch) }
              </p>
            ) }
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={ onResetBookingForm }
              disabled={ isBookingFormPristine }
              className="text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
            >
              Reset Form
            </Button>
          </div>
        </div>

        { !selectedAreaId && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-background/50 px-3 py-2 text-xs text-muted-foreground">
            <FiPlus className="size-3" />
            <span>Pick an area to calculate final pricing.</span>
          </div>
        ) }
      </div>
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
  isPricingLoading: boolean;
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
  isPricingLoading,
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
          dismissible={ !isCheckoutPending }
          className="max-h-[95vh] overflow-y-auto border-none p-0 sm:max-w-3xl"
        >
          <div className="flex flex-col">
            <DialogHeader className="border-b border-border/50 p-6 text-left">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-2xl font-bold tracking-tight">Complete Reservation</DialogTitle>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={ onCloseBooking } 
                  className="rounded-full"
                  disabled={ isCheckoutPending }
                >
                  <FiPlus className="size-5 rotate-45" />
                </Button>
              </div>
            </DialogHeader>
            
            <div className="flex-1 px-6 py-2">
              { bookingContent }
            </div>

            <DialogFooter className="mt-0 border-t border-border/50 bg-muted/30 p-6 sm:justify-between">
              <div className="hidden flex-col justify-center sm:flex">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Secure Checkout</p>
                <p className="text-xs text-muted-foreground">Powered by Xendit</p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                <Button
                  type="button"
                  variant="outline"
                  className="order-2 h-12 border-border bg-muted px-8 font-semibold text-foreground hover:bg-muted/80 hover:text-foreground sm:order-1"
                  onClick={ onCloseBooking }
                  disabled={ isCheckoutPending }
                >
                  Back
                </Button>
                <Button
                  type="button"
                  className="order-1 h-12 px-10 text-base font-bold shadow-lg shadow-primary/20 sm:order-2"
                  onClick={ onConfirmBooking }
                  disabled={ !canConfirmBooking }
                  loading={ isCheckoutPending }
                >
                  { isPricingLoading ? 'Updating Price...' : `Confirm & Pay ${primaryActionLabel.includes('₱') ? primaryActionLabel : ''}` }
                </Button>
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      <Sheet
        open={ !isDesktopViewport && isBookingOpen }
        onOpenChange={ handleOpenChange }
      >
        <SheetContent
          side="bottom"
          dismissible={ !isCheckoutPending }
          className="max-h-[96vh] gap-0 overflow-y-auto rounded-t-[2rem] border-none p-0 shadow-2xl"
        >
          <SheetHeader className="border-b border-border/50 p-6 text-left">
            <SheetTitle className="text-2xl font-bold">Book Reservation</SheetTitle>
          </SheetHeader>
          <div className="px-6 pb-24 pt-4">
            { bookingContent }
          </div>
          <div className="fixed bottom-0 left-0 right-0 border-t border-border/50 bg-background/95 p-6 backdrop-blur-md">
            <div className="flex flex-col gap-3">
              <Button
                type="button"
                size="lg"
                className="h-14 w-full text-lg font-bold shadow-lg shadow-primary/20"
                onClick={ onConfirmBooking }
                disabled={ !canConfirmBooking }
                loading={ isCheckoutPending }
              >
                { isPricingLoading ? 'Updating...' : `Confirm & Pay ${primaryActionLabel.includes('₱') ? primaryActionLabel : ''}` }
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-10 w-full font-medium text-muted-foreground"
                onClick={ onCloseBooking }
                disabled={ isCheckoutPending }
              >
                Maybe later
              </Button>
            </div>
          </div>
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
    checkInDate,
    checkInTime,
    checkOutDate,
    checkOutTime,
    selectedAreaId,
    isPricingLoading,
    guestCount,
    customVariables,
  } = bookingState;

  const derivedBookingHours = useMemo(
    () => deriveBookingHours(checkInDate, checkInTime, checkOutDate, checkOutTime),
    [checkInDate, checkInTime, checkOutDate, checkOutTime]
  );
  const bookingHours = derivedBookingHours ?? MIN_BOOKING_HOURS;

  const bookingStartAtIso = useMemo(() => {
    const candidate = new Date(`${checkInDate}T${checkInTime}:00`);
    const now = new Date();
    if (!Number.isFinite(candidate.getTime())) {
      return now.toISOString();
    }
    if (candidate.getTime() <= now.getTime()) {
      return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    }
    return candidate.toISOString();
  }, [checkInDate, checkInTime]);

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

  const handleCheckInDateChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      dispatchBookingAction({
 type: 'set-check-in-date',
value: event.target.value, 
});
    },
    []
  );

  const handleCheckInTimeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      dispatchBookingAction({
 type: 'set-check-in-time',
value: event.target.value, 
});
    },
    []
  );

  const handleCheckOutDateChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      dispatchBookingAction({
 type: 'set-check-out-date',
value: event.target.value, 
});
    },
    []
  );

  const handleCheckOutTimeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      dispatchBookingAction({
 type: 'set-check-out-time',
value: event.target.value, 
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
    checkInDate === earliestScheduleDate &&
    checkInTime === getDefaultCheckInTime() &&
    checkOutDate === earliestScheduleDate &&
    checkOutTime === getDefaultCheckOutTime();

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
  const { data: occupancy, } = useAreaOccupancyQuery({
    spaceId: selectedArea ? space.id : null,
    areaId: selectedAreaId,
    startAt: bookingStartAtIso,
    hours: bookingHours,
  });
  const liveRemaining = occupancy?.remaining ?? null;
  const remainingCapacity =
    liveRemaining !== null
      ? Math.max(liveRemaining - guestCount, 0)
      : selectedAreaMaxCapacity !== null
        ? Math.max(selectedAreaMaxCapacity - guestCount, 0)
        : null;
  const isOverCapacity =
    liveRemaining !== null
      ? guestCount > liveRemaining
      : selectedAreaMaxCapacity !== null && guestCount > selectedAreaMaxCapacity;
  const capacityHelperText = selectedArea
    ? selectedAreaMaxCapacity === null
      ? 'This area does not have a capacity limit.'
      : isOverCapacity
        ? `Over capacity (${occupancy?.activeGuests ?? 0} guests already booked)`
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
      hasAllCustomVariables &&
      derivedBookingHours !== null &&
      derivedBookingHours >= MIN_BOOKING_HOURS
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
      checkInDate={ checkInDate }
      checkInTime={ checkInTime }
      checkOutDate={ checkOutDate }
      checkOutTime={ checkOutTime }
      earliestScheduleDate={ earliestScheduleDate }
      onCheckInDateChange={ handleCheckInDateChange }
      onCheckInTimeChange={ handleCheckInTimeChange }
      onCheckOutDateChange={ handleCheckOutDateChange }
      onCheckOutTimeChange={ handleCheckOutTimeChange }
      derivedBookingHours={ derivedBookingHours }
      isPricingLoading={ isPricingLoading }
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
      isPricingLoading={ isPricingLoading }
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
