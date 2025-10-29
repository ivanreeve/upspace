import { useEffect, useMemo, useState } from 'react';

import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

import { cn } from '@/lib/utils';
import {
  formatAvailabilityWindow,
  formatTimeDisplay,
  minutesToTimeValue,
  parseTimeInputToMinutes,
  type AvailabilityWindow
} from '@/components/pages/Booking/booking-utils';

type TimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  availabilityWindows?: AvailabilityWindow[];
  availabilityLabel?: string;
  invalid?: boolean;
  placeholder?: string;
};

type Period = 'AM' | 'PM';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const HOURS = Array.from({ length: 12, }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 60, }, (_, index) => index);
const PERIODS: Period[] = ['AM', 'PM'];

export function TimePicker({
  value,
  onChange,
  disabled,
  availabilityWindows = [],
  availabilityLabel,
  invalid,
  placeholder = 'Select time',
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [tempHour, setTempHour] = useState<number | null>(null);
  const [tempMinute, setTempMinute] = useState<number | null>(null);
  const [tempPeriod, setTempPeriod] = useState<Period | null>(null);

  const formattedButtonLabel = value ? formatTimeDisplay(value) : placeholder;

  const selectionWithinAvailability = useMemo(() => {
    if (!value) return true;
    if (!availabilityWindows.length) return true;
    return isWithinAvailability(value, availabilityWindows);
  }, [value, availabilityWindows]);

  const showInvalid = invalid || !selectionWithinAvailability;

  const availabilityTimes = useMemo(() => {
    if (!availabilityWindows.length) return null;
    const set = new Set<string>();
    availabilityWindows.forEach((window) => {
      const start = Math.max(0, Math.min(1440, window.start));
      const end = Math.max(0, Math.min(1439, window.end));
      for (let minute = start; minute <= end; minute += 1) {
        set.add(minutesToTimeValue(minute));
      }
    });
    return set;
  }, [availabilityWindows]);

  const hourOptions = useMemo(() => {
    return HOURS.map((hour) => {
      if (!availabilityTimes) {
        return {
 hour,
disabled: false, 
};
      }
      if (!tempPeriod) {
        const hasAnyPeriod = PERIODS.some((period) =>
          hasAvailabilityForHour(hour, period, availabilityTimes)
        );
        return {
 hour,
disabled: !hasAnyPeriod, 
};
      }
      const availableForSelectedPeriod = hasAvailabilityForHour(
        hour,
        tempPeriod,
        availabilityTimes
      );
      return {
        hour,
        disabled: !availableForSelectedPeriod,
      };
    });
  }, [availabilityTimes, tempPeriod]);

  const minuteOptions = useMemo(() => {
    return MINUTES.map((minute) => {
      if (tempHour == null || tempPeriod == null) {
        return {
 minute,
disabled: true, 
};
      }
      if (!availabilityTimes) {
        return {
 minute,
disabled: false, 
};
      }
      const timeValue = toTimeValueFrom12(tempHour, tempPeriod, minute);
      return {
        minute,
        disabled: !availabilityTimes.has(timeValue),
      };
    });
  }, [tempHour, tempPeriod, availabilityTimes]);

  const availabilitySummary = useMemo(() => {
    if (!availabilityWindows.length) return null;
    return availabilityWindows.map((window, index) => ({
      id: `${window.start}-${window.end}-${index}`,
      label: formatAvailabilityWindow(window),
    }));
  }, [availabilityWindows]);

  useEffect(() => {
    if (!open) return;
    if (value && TIME_PATTERN.test(value)) {
      const [hourValue, minuteValue] = value.split(':').map((part) => Number.parseInt(part, 10));
      const safeHour = Number.isFinite(hourValue) ? hourValue : null;
      const safeMinute = Number.isFinite(minuteValue) ? minuteValue : null;
      if (safeHour != null) {
        const {
 hour12, period, 
} = toHourPeriod(safeHour);
        setTempHour(hour12);
        setTempPeriod(period);
      } else {
        setTempHour(null);
        setTempPeriod(null);
      }
      setTempMinute(Number.isFinite(minuteValue) ? minuteValue : null);
      return;
    }
    setTempHour(null);
    setTempMinute(null);
    setTempPeriod(null);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    if (tempHour == null || tempPeriod == null || !availabilityTimes) return;
    const hasAvailableMinutes = getMinutesForHour(tempHour, tempPeriod, availabilityTimes).length > 0;
    if (!hasAvailableMinutes) {
      setTempHour(null);
      setTempMinute(null);
      setTempPeriod(null);
    }
  }, [availabilityTimes, open, tempHour, tempPeriod]);

  const handlePeriodSelect = (period: Period) => {
    setTempPeriod(period);

    if (tempHour == null) {
      setTempMinute(null);
      onChange('');
      return;
    }

    const minutesForHour = getMinutesForHour(tempHour, period, availabilityTimes);
    if (minutesForHour.length === 0) {
      setTempMinute(null);
      onChange('');
      return;
    }

    let nextMinute = tempMinute;
    if (nextMinute == null || !minutesForHour.includes(nextMinute)) {
      nextMinute = minutesForHour[0] ?? null;
    }

    setTempMinute(nextMinute);
    if (nextMinute != null) {
      onChange(toTimeValueFrom12(tempHour, period, nextMinute));
    } else {
      onChange('');
    }
  };

  const handleHourSelect = (hour: number) => {
    const hourEntry = hourOptions.find((item) => item.hour === hour);
    if (hourEntry?.disabled) return;
    setTempHour(hour);

    let period = tempPeriod;
    if (!period) {
      period = availabilityTimes
        ? PERIODS.find((candidate) => hasAvailabilityForHour(hour, candidate, availabilityTimes)) ?? 'AM'
        : 'AM';
      setTempPeriod(period);
    }

    const minutesForHour = getMinutesForHour(hour, period, availabilityTimes);

    let nextMinute: number | null = tempMinute;
    if (nextMinute == null || !minutesForHour.includes(nextMinute)) {
      nextMinute = minutesForHour[0] ?? null;
    }

    if (nextMinute != null) {
      setTempMinute(nextMinute);
      onChange(toTimeValueFrom12(hour, period, nextMinute));
    } else {
      setTempMinute(null);
      onChange('');
    }
  };

  const handleMinuteSelect = (minute: number) => {
    if (tempHour == null || tempPeriod == null) return;
    const minuteEntry = minuteOptions.find((item) => item.minute === minute);
    if (minuteEntry?.disabled) return;
    setTempMinute(minute);
    onChange(toTimeValueFrom12(tempHour, tempPeriod, minute));
  };

  const handleClear = () => {
    setTempHour(null);
    setTempMinute(null);
    setTempPeriod(null);
    onChange('');
    setOpen(false);
  };

  return (
    <Popover
      open={ open }
      onOpenChange={ (next) => {
        if (disabled) return;
        setOpen(next);
      } }
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={ disabled }
          className={ cn(
            'w-full justify-between rounded-lg border bg-background px-4 py-3 text-left text-sm font-medium transition-colors hover:border-primary/40 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-primary/40',
            !value && 'text-muted-foreground',
            showInvalid && 'border-destructive/70 text-destructive',
            disabled && 'opacity-70'
          ) }
        >
          <span>{ formattedButtonLabel }</span>
          <span className="text-xs text-muted-foreground">
            { availabilityLabel ?? (availabilityWindows.length ? 'Tap to change' : 'Unavailable') }
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={ 8 }
        className="w-[320px] rounded-lg border bg-background p-4 shadow-lg"
      >
        <div className="flex flex-col gap-4 text-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Estimated arrival
              </p>
              <p className="text-lg font-semibold">
                { value ? formatTimeDisplay(value) : 'Pick a time' }
              </p>
            </div>
            { availabilityLabel && (
              <span className="text-xs text-muted-foreground">{ availabilityLabel }</span>
            ) }
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Availability
            </p>
            { availabilitySummary?.length ? (
              <ul className="space-y-1 text-xs text-muted-foreground">
                { availabilitySummary.map((window) => (
                  <li key={ window.id }>{ window.label }</li>
                )) }
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No availability for this date.</p>
            ) }
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Period</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              { PERIODS.map((period) => {
                const periodUnavailable = availabilityTimes
                  ? !HOURS.some((hour) => hasAvailabilityForHour(hour, period, availabilityTimes))
                  : false;
                return (
                  <button
                    key={ period }
                    type="button"
                    onClick={ () => handlePeriodSelect(period) }
                    disabled={ periodUnavailable }
                    className={ cn(
                      'rounded-md border px-3 py-2 text-sm transition-colors',
                      tempPeriod === period
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'hover:bg-muted/70',
                      periodUnavailable && 'cursor-not-allowed text-muted-foreground/60 hover:bg-transparent'
                    ) }
                    aria-pressed={ tempPeriod === period }
                  >
                    { period }
                  </button>
                );
              }) }
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Hour</p>
              <div className="mt-2 max-h-48 overflow-y-auto scroll-smooth rounded-md border bg-muted/40">
                <ul className="divide-y divide-border text-sm">
                  { hourOptions.map(({
 hour, disabled: itemDisabled, 
}) => (
                    <li key={ hour }>
                      <button
                        type="button"
                        onClick={ () => handleHourSelect(hour) }
                        className={ cn(
                          'flex w-full items-center justify-between px-3 py-2 text-left transition-colors',
                          tempHour === hour
                            ? 'bg-primary/10 font-semibold text-primary'
                            : 'hover:bg-muted/80',
                          itemDisabled && 'cursor-not-allowed text-muted-foreground/60 hover:bg-transparent'
                        ) }
                        disabled={ itemDisabled }
                      >
                        <span>{ hour.toString().padStart(2, '0') }</span>
                      </button>
                    </li>
                  )) }
                </ul>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Minute</p>
              <div className="mt-2 max-h-48 overflow-y-auto scroll-smooth rounded-md border bg-muted/40">
                <ul className="divide-y divide-border text-sm">
                  { minuteOptions.map(({
 minute, disabled: itemDisabled, 
}) => (
                    <li key={ minute }>
                      <button
                        type="button"
                        onClick={ () => handleMinuteSelect(minute) }
                        className={ cn(
                          'flex w-full items-center justify-between px-3 py-2 text-left transition-colors',
                          tempMinute === minute
                            ? 'bg-primary/10 font-semibold text-primary'
                            : 'hover:bg-muted/80',
                          (itemDisabled || tempHour == null || tempPeriod == null) &&
                            'cursor-not-allowed text-muted-foreground/60 hover:bg-transparent'
                        ) }
                        disabled={ itemDisabled || tempHour == null || tempPeriod == null }
                      >
                        <span>{ minute.toString().padStart(2, '0') }</span>
                      </button>
                    </li>
                  )) }
                </ul>
              </div>
            </div>
          </div>

          { showInvalid && value && (
            <p className="text-xs text-destructive">
              Selected time is outside the available schedule.
            </p>
          ) }

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={ handleClear }
              disabled={ !value }
            >
              Clear
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={ () => setOpen(false) }
              disabled={ tempHour == null || tempMinute == null || tempPeriod == null }
            >
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function isWithinAvailability(time: string, windows: AvailabilityWindow[]) {
  if (!windows.length) return true;
  const minutes = parseTimeInputToMinutes(time);
  if (minutes == null) return false;
  return windows.some((window) => minutes >= window.start && minutes <= window.end);
}

function hasAvailabilityForHour(hour: number, period: Period, availabilityTimes: Set<string>) {
  const hour24 = to24Hour(hour, period);
  return MINUTES.some((minute) => availabilityTimes.has(to24HourValue(hour24, minute)));
}

function getMinutesForHour(
  hour: number,
  period: Period,
  availabilityTimes: Set<string> | null
): number[] {
  if (!availabilityTimes) {
    return [...MINUTES];
  }
  const hour24 = to24Hour(hour, period);
  return MINUTES.filter((minute) => availabilityTimes.has(to24HourValue(hour24, minute)));
}

function to24HourValue(hour: number, minute: number) {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function toTimeValueFrom12(hour: number, period: Period, minute: number) {
  return to24HourValue(to24Hour(hour, period), minute);
}

function to24Hour(hour: number, period: Period) {
  const normalized = hour % 12;
  if (period === 'AM') {
    return normalized === 0 ? 0 : normalized;
  }
  return normalized === 0 ? 12 : normalized + 12;
}

function toHourPeriod(hour24: number) {
  const period: Period = hour24 >= 12 ? 'PM' : 'AM';
  const remainder = hour24 % 12;
  const hour12 = remainder === 0 ? 12 : remainder;
  return {
 hour12,
period, 
};
}
