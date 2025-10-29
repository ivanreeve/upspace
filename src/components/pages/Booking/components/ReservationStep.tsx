import Image from 'next/image';
import { useCallback, useMemo, useState } from 'react';
import { format } from 'date-fns';
import type { UseFormReturn } from 'react-hook-form';
import { CalendarIcon } from 'lucide-react';

import type { ReservationFormValues } from '../BookingFlow';
import {
  AvailabilityMap,
  AvailabilityWindow,
  BookingArea,
  PricingDetails,
  formatAvailabilityWindow,
  formatCurrency,
  getAvailabilityWindowsForDate,
  parseTimeInputToMinutes
} from '../booking-utils';

import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { TimePicker } from '@/components/ui/time-picker';
import { cn } from '@/lib/utils';

type ReservationStepProps = {
  form: UseFormReturn<ReservationFormValues>;
  areaOptions: BookingArea[];
  selectedArea: BookingArea | null;
  totalEstimate: number;
  guestCount: number;
  stayHoursValue: number;
  hourOptions: Array<{ value: number; label: string }>;
  availabilityMap: AvailabilityMap;
  availabilityWindows: AvailabilityWindow[];
  selectedDate: Date | undefined;
  selectedPricing: PricingDetails | null;
  onSubmit: (values: ReservationFormValues) => void;
  onReset: () => void;
};

export function ReservationStep({
  form,
  areaOptions,
  selectedArea,
  totalEstimate,
  guestCount,
  stayHoursValue,
  hourOptions,
  availabilityMap,
  availabilityWindows,
  selectedDate,
  selectedPricing,
  onSubmit,
  onReset,
}: ReservationStepProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const today = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return base;
  }, []);

  const availabilitySummary = useMemo(() => {
    if (!selectedDate) {
      return {
        label: undefined,
        message: 'Select a date to set an arrival time.',
      };
    }

    if (availabilityWindows.length === 0) {
      return {
        label: undefined,
        message: 'This date has no availability. Pick a different day.',
      };
    }

    const earliestStart = availabilityWindows.reduce(
      (min, window) => Math.min(min, window.start),
      Infinity
    );
    const latestEnd = availabilityWindows.reduce(
      (max, window) => Math.max(max, window.end),
      -Infinity
    );
    const label = formatAvailabilityWindow({
      start: earliestStart,
      end: latestEnd,
    });

    return {
      label,
      message: `Available window: ${label}`,
    };
  }, [availabilityWindows, selectedDate]);

  const selectedImage = selectedArea?.heroImage ?? null;
  const availabilityLabel = availabilitySummary.label;
  const availabilityMessage = availabilitySummary.message;

  const isDateDisabled = useCallback(
    (date: Date) => {
      if (date < today) return true;
      const windows = getAvailabilityWindowsForDate(date, availabilityMap);
      return windows.length === 0;
    },
    [availabilityMap, today]
  );

  const availableMatcher = useCallback(
    (date: Date) => !isDateDisabled(date),
    [isDateDisabled]
  );

  return (
    <form
      onSubmit={ form.handleSubmit(onSubmit) }
      className="grid gap-6 md:grid-cols-2"
    >
      { /* AREA SELECT */ }
      <FormField
        control={ form.control }
        name="areaId"
        render={ ({ field, }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>Area</FormLabel>
            <Select onValueChange={ field.onChange } value={ field.value ?? '' }>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an area" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                { areaOptions.map((area) => (
                  <SelectItem key={ area.id } value={ area.id }>
                    { area.name }
                  </SelectItem>
                )) }
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        ) }
      />

      <FormField
        control={ form.control }
        name="reservationDate"
        render={ ({ field, }) => (
          <FormItem className="flex flex-col">
            <FormLabel>Reservation Date</FormLabel>
            <Popover open={ calendarOpen } onOpenChange={ setCalendarOpen }>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    className={ cn(
                      'w-full justify-between text-left font-normal',
                      !field.value && 'text-muted-foreground'
                    ) }
                  >
                    <span>
                      { field.value ? format(field.value, 'MMMM d, yyyy') : 'Pick a date' }
                    </span>
                    <CalendarIcon className="size-4 text-muted-foreground" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={ field.value }
                  onSelect={ (date) => {
                    if (!date) return;
                    field.onChange(date);
                    setCalendarOpen(false);
                  } }
                  initialFocus
                  disabled={ isDateDisabled }
                  showOutsideDays
                  modifiers={ { available: availableMatcher, } }
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        ) }
      />

      { /* ARRIVAL TIME */ }
      <FormField
        control={ form.control }
        name="arrivalTime"
        render={ ({ field, }) => {
          const minutes = parseTimeInputToMinutes(field.value ?? '');
          const timeOutsideWindow =
            !!field.value &&
            !!selectedDate &&
            (minutes == null ||
              !availabilityWindows.some(
                (window) => minutes >= window.start && minutes <= window.end
              ));

          const disableInput = !selectedDate || availabilityWindows.length === 0;

          const helperMessage = availabilityMessage;

          return (
            <FormItem>
              <FormLabel>Estimated Arrival Time</FormLabel>
              <FormControl>
                <TimePicker
                  value={ field.value ?? '' }
                  onChange={ field.onChange }
                  disabled={ disableInput }
                  availabilityWindows={ availabilityWindows }
                  availabilityLabel={
                    selectedDate && availabilityWindows.length > 0
                      ? availabilityLabel
                      : undefined
                  }
                  invalid={ timeOutsideWindow }
                  placeholder={
                    selectedDate ? 'Select arrival time' : 'Pick a date first'
                  }
                />
              </FormControl>
              <p
                className={ cn(
                  'text-xs',
                  timeOutsideWindow ? 'text-destructive' : 'text-muted-foreground'
                ) }
              >
                { timeOutsideWindow
                  ? 'Selected time is outside the available schedule. Choose a different slot.'
                  : helperMessage }
              </p>
              <FormMessage />
            </FormItem>
          );
        } }
      />

      { /* HOURS */ }
      <FormField
        control={ form.control }
        name="stayHours"
        render={ ({ field, }) => (
          <FormItem>
            <FormLabel>Number of Hours</FormLabel>
            <Select
              onValueChange={ (value) =>
                field.onChange(Number.parseInt(value, 10))
              }
              value={ String(field.value ?? '') }
            >
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select hours" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                { hourOptions.map((option) => (
                  <SelectItem key={ option.value } value={ String(option.value) }>
                    { option.label }
                  </SelectItem>
                )) }
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        ) }
      />

      { /* GUESTS */ }
      <FormField
        control={ form.control }
        name="guests"
        render={ ({ field, }) => (
          <FormItem>
            <FormLabel>Number of Guests</FormLabel>
            <FormControl>
              <Input type="number" min={ 1 } max={ 200 } { ...field } />
            </FormControl>
            <FormMessage />
          </FormItem>
        ) }
      />

      { /* SUMMARY */ }
      <div className="md:col-span-2 flex flex-col gap-4 rounded-2xl border bg-muted/10 p-4">
        <h4 className="text-sm font-semibold text-foreground">
          Current selection
        </h4>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative size-16 overflow-hidden rounded-xl bg-muted">
              { selectedImage ? (
                <Image
                  src={ selectedImage }
                  alt={ selectedArea?.name ?? 'Selected area' }
                  width={ 64 }
                  height={ 64 }
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                  No image
                </div>
              ) }
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                { selectedArea?.name ?? 'No area selected' }
              </p>
              <p className="text-xs text-muted-foreground">
                { selectedArea
                  ? `Capacity ${selectedArea.capacity} guests`
                  : 'Choose an area to view details' }
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1 text-right text-sm">
            <span className="text-muted-foreground">Estimated total</span>
            <span className="text-lg font-semibold text-foreground">
              { selectedArea && guestCount > 0 && stayHoursValue > 0
                ? formatCurrency(totalEstimate)
                : '—' }
            </span>
            <span className="text-xs text-muted-foreground">
              { selectedPricing?.label ??
                'Select duration and guests to see rate details' }
            </span>
          </div>
        </div>

        { selectedArea && (
          <div className="space-y-3 rounded-xl border bg-background/60 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Guests
              </span>
              <span className="font-medium text-foreground">
                { guestCount || '—' }
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Duration
              </span>
              <span className="font-medium text-foreground">
                { stayHoursValue
                  ? `${stayHoursValue} ${
                      stayHoursValue === 1 ? 'hour' : 'hours'
                    }`
                  : '—' }
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Selected rate
              </span>
              <span className="text-right font-medium text-foreground">
                { selectedPricing?.label ?? 'Select hours to see pricing' }
              </span>
            </div>
          </div>
        ) }
      </div>

      { /* ACTION BUTTONS */ }
      <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          Need to make changes later? You can update details before confirming
          payment.
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={ onReset }>
            Reset
          </Button>
          <Button type="submit">Continue</Button>
        </div>
      </div>
    </form>
  );
}
