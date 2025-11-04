import { format } from 'date-fns';

export type BookingAreaRate = {
  id: string;
  timeUnit: string;
  price: string;
};

export type BookingArea = {
  id: string;
  name: string;
  capacity: number;
  minCapacity: number | null;
  maxCapacity: number | null;
  heroImage?: string | null;
  rates: BookingAreaRate[];
};

export type AvailabilityRecord = {
  day_of_week: string | number | bigint;
  opening?: string | Date;
  closing?: string | Date;
  opening_time?: string | Date;
  closing_time?: string | Date;
};

export type AvailabilityWindow = {
  start: number;
  end: number;
};

export type AvailabilityMap = Record<number, AvailabilityWindow[]>;

const DAY_TO_INDEX: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

export type PricingDetails = {
  total: number;
  perGuestRate?: number;
  label?: string;
  usesHourlyMultiplier: boolean;
};

export type ReviewSummary = {
  areaId: string;
  reservationDate: Date;
  stayHours: number;
  guests: number;
  arrivalTime: string;
  totalAmount: number;
  perGuestRate?: number;
  rateLabel?: string;
  usesHourlyMultiplier?: boolean;
};

type RateUnitKind = 'fixed' | 'range' | 'hourly';

type ParsedRateUnit = {
  kind: RateUnitKind;
  minHours: number;
  maxHours: number | null;
};

type ParsedAreaRate = {
  descriptor: ParsedRateUnit | null;
  rawTimeUnit: string;
  pricePerGuest: number;
};

const RANGE_PATTERN =
  /(\d+(?:\.\d+)?)\s*(?:-|to|–|—)\s*(\d+(?:\.\d+)?)/i;
const SINGLE_HOUR_PATTERN = /(\d+(?:\.\d+)?)/;
const HOURLY_KEYWORDS = ['per hour', 'hourly', '/hr', '/hour'];

export function normalizeAvailability(records: AvailabilityRecord[]): AvailabilityMap {
  const map: AvailabilityMap = {
    0: [],
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
  };

  for (const record of records ?? []) {
    const rawIndex = resolveDayIndex(record.day_of_week);
    if (rawIndex == null) continue;

    const index = ((rawIndex + 1) % 7) as keyof AvailabilityMap;

    const start = toMinutes(record.opening ?? record.opening_time);
    const end = toMinutes(record.closing ?? record.closing_time);
    if (start == null || end == null || start >= end) continue;

    map[index].push({
      start,
      end,
    });
  }

  (Object.keys(map) as Array<keyof AvailabilityMap>).forEach((key) => {
    map[key] = mergeWindows(map[key]);
  });

  return map;
}

export function getAvailabilityWindowsForDate(
  date: Date | undefined,
  map: AvailabilityMap
): AvailabilityWindow[] {
  if (!date) return [];
  return map[date.getDay()] ?? [];
}

export function isTimeWithinAvailability(
  date: Date | undefined,
  time: string,
  map: AvailabilityMap
): boolean {
  if (!date) return false;
  const minutes = parseTimeInputToMinutes(time);
  if (minutes == null) return false;
  const windows = getAvailabilityWindowsForDate(date, map);
  if (windows.length === 0) return false;
  return windows.some((window) => minutes >= window.start && minutes <= window.end);
}

export function minutesToTimeValue(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export function formatMinutesToDisplay(minutes: number): string {
  if (!Number.isFinite(minutes)) return '—';
  const normalized = ((Math.trunc(minutes) % 1440) + 1440) % 1440;
  const hours24 = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12.toString().padStart(2, '0')}:${mins
    .toString()
    .padStart(2, '0')} ${period}`;
}

export function formatTimeDisplay(value: string): string {
  const minutes = toMinutes(value);
  if (minutes == null) return value;
  return formatMinutesToDisplay(minutes);
}

export function formatAvailabilityWindow(window: AvailabilityWindow) {
  return `${formatMinutesToDisplay(window.start)} – ${formatMinutesToDisplay(window.end)}`;
}

export function formatCurrency(value: number) {
  if (!Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return `₱${value.toFixed(2)}`;
  }
}

export function formatRateLabel(area: BookingArea) {
  if (area.rates.length === 0) return 'Rate unavailable';
  return area.rates
    .map((rate) => {
      const parsed = parseRateUnit(rate.timeUnit);
      const price = formatCurrency(safeNumber(rate.price));
      if (!parsed) {
        return `${price} per guest • ${rate.timeUnit.toLowerCase()}`;
      }
      if (parsed.kind === 'hourly') {
        return `${price} per guest / hour`;
      }
      return `${price} per guest • ${formatRateDescriptor(parsed)}`;
    })
    .join(' • ');
}

export function resolveRatePricing(
  area: BookingArea,
  stayHours: number,
  guests: number
): PricingDetails {
  const safeGuests = Math.max(guests, 1);
  const stay = Math.max(stayHours, 1);
  const parsedRates = area.rates
    .map((rate) => ({
      descriptor: parseRateUnit(rate.timeUnit),
      rawTimeUnit: rate.timeUnit,
      pricePerGuest: safeNumber(rate.price),
    }))
    .sort((a, b) => {
      const aMin = a.descriptor?.minHours ?? Number.MAX_SAFE_INTEGER;
      const bMin = b.descriptor?.minHours ?? Number.MAX_SAFE_INTEGER;
      if (aMin !== bMin) return aMin - bMin;
      const aMax = a.descriptor?.maxHours ?? Number.MAX_SAFE_INTEGER;
      const bMax = b.descriptor?.maxHours ?? Number.MAX_SAFE_INTEGER;
      return aMax - bMax;
    });

  const boundedCandidates = parsedRates
    .filter((rate) => {
      if (!rate.descriptor || rate.descriptor.kind === 'hourly') return false;
      const upper = rate.descriptor.maxHours ?? Number.POSITIVE_INFINITY;
      return stay >= rate.descriptor.minHours && stay <= upper;
    })
    .sort((a, b) => {
      const aDescriptor = a.descriptor as ParsedRateUnit;
      const bDescriptor = b.descriptor as ParsedRateUnit;
      const aSpan =
        aDescriptor.maxHours == null
          ? Number.POSITIVE_INFINITY
          : aDescriptor.maxHours - aDescriptor.minHours;
      const bSpan =
        bDescriptor.maxHours == null
          ? Number.POSITIVE_INFINITY
          : bDescriptor.maxHours - bDescriptor.minHours;

      if (aSpan !== bSpan) {
        if (aSpan === Number.POSITIVE_INFINITY) return 1;
        if (bSpan === Number.POSITIVE_INFINITY) return -1;
        return aSpan - bSpan;
      }

      return bDescriptor.minHours - aDescriptor.minHours;
    });

  const boundedRate = boundedCandidates[0];
  if (boundedRate) {
    const total = boundedRate.pricePerGuest * safeGuests;
    return {
      total,
      perGuestRate: boundedRate.pricePerGuest,
      label: `${formatCurrency(boundedRate.pricePerGuest)} per guest • ${formatRateDescriptor(
        // descriptor checked above
        boundedRate.descriptor as ParsedRateUnit
      )}`,
      usesHourlyMultiplier: false,
    };
  }

  const hourlyRate = parsedRates.find(
    (rate) => rate.descriptor?.kind === 'hourly' && rate.pricePerGuest > 0
  );
  if (hourlyRate?.descriptor?.kind === 'hourly') {
    const total = hourlyRate.pricePerGuest * safeGuests * stay;
    return {
      total,
      perGuestRate: hourlyRate.pricePerGuest,
      label: `${formatCurrency(hourlyRate.pricePerGuest)} per guest / hour`,
      usesHourlyMultiplier: true,
    };
  }

  const fallback = parsedRates[0];
  if (fallback) {
    const total = fallback.pricePerGuest * safeGuests;
    return {
      total,
      perGuestRate: fallback.pricePerGuest,
      label: `${formatCurrency(fallback.pricePerGuest)} per guest • ${fallback.rawTimeUnit.toLowerCase()}`,
      usesHourlyMultiplier: false,
    };
  }

  return {
    total: 0,
    usesHourlyMultiplier: false,
  };
}

export function buildRateOptions(area: BookingArea | null, fallback: Array<{ value: number; label: string }>) {
  if (!area) return { hourOptions: fallback, };

  const unique = new Map<number, { value: number; label: string }>();

  const parsedRates: ParsedAreaRate[] = area.rates.map((rate) => ({
    descriptor: parseRateUnit(rate.timeUnit),
    rawTimeUnit: rate.timeUnit,
    pricePerGuest: safeNumber(rate.price),
  }));

  parsedRates.forEach((rate) => {
    if (!rate.descriptor || rate.descriptor.kind === 'hourly') return;
    const start = Math.max(1, Math.ceil(rate.descriptor.minHours));
    const end = Math.max(
      start,
      Math.floor(rate.descriptor.maxHours ?? rate.descriptor.minHours)
    );
    for (let hour = start; hour <= end; hour += 1) {
      if (unique.has(hour)) continue;
      const baseLabel = formatHoursLabel(hour);
      const suffix =
        rate.descriptor.kind === 'range'
          ? ` • ${formatCurrency(rate.pricePerGuest)}/guest (covers ${formatRateDescriptor(rate.descriptor)})`
          : ` • ${formatCurrency(rate.pricePerGuest)}/guest`;
      unique.set(hour, {
        value: hour,
        label: `${baseLabel}${suffix}`,
      });
    }
  });

  const hourlyRate = parsedRates.find((rate) => rate.descriptor?.kind === 'hourly');
  if (hourlyRate) {
    fallback.forEach((option) => {
      if (unique.has(option.value)) return;
      unique.set(option.value, {
        value: option.value,
        label: `${formatHoursLabel(option.value)} • ${formatCurrency(
          hourlyRate.pricePerGuest
        )}/guest/hour`,
      });
    });
  }

  if (unique.size === 0) {
    fallback.forEach((option) => unique.set(option.value, option));
  }

  const options = Array.from(unique.values()).sort((a, b) => a.value - b.value);
  return { hourOptions: options, };
}

export function parseHoursFromUnit(unit: string): number | null {
  const parsed = parseRateUnit(unit);
  if (!parsed) return null;
  if (parsed.kind === 'hourly') return 1;
  return parsed.minHours;
}

export function formatReservationDisplay(reservationDate: string, arrivalTime: string) {
  const date = new Date(reservationDate);
  const arrivalLabel = formatTimeDisplay(arrivalTime);
  return `${format(date, 'MMMM d, yyyy')} · ${arrivalLabel}`;
}

export function safeNumber(value: string | number | null | undefined) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseTimeInputToMinutes(value: string): number | null {
  if (!value) return null;
  const matches = value.match(/^(\d{2}):(\d{2})$/);
  if (!matches) return null;
  const hours = Number.parseInt(matches[1], 10);
  const minutes = Number.parseInt(matches[2], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

const AVAILABILITY_TIMEZONE =
  (typeof process !== 'undefined' &&
    (process.env.NEXT_PUBLIC_AVAILABILITY_TIMEZONE ??
      process.env.AVAILABILITY_TIMEZONE)) ||
  'Asia/Manila';

function toMinutes(value: string | Date): number | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return null;
    try {
      const formatter = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: AVAILABILITY_TIMEZONE,
      });
      const parts = formatter.formatToParts(value);
      const hoursPart = parts.find((part) => part.type === 'hour');
      const minutesPart = parts.find((part) => part.type === 'minute');
      const hours = Number.parseInt(hoursPart?.value ?? '', 10);
      const minutes = Number.parseInt(minutesPart?.value ?? '', 10);
      if (Number.isFinite(hours) && Number.isFinite(minutes)) {
        return hours * 60 + minutes;
      }
    } catch {
      // ignore and fallback to UTC computation
    }
    const hours = value.getUTCHours();
    const minutes = value.getUTCMinutes();
    return hours * 60 + minutes;
  }

  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return null;

  if (/^\d{2}:\d{2}$/.test(normalized)) {
    return parseTimeInputToMinutes(normalized);
  }

  const tailMatch = normalized.match(
    /(?:T)?(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}(?::\d{2})?)?$/
  );
  if (tailMatch) {
    const hours = Number.parseInt(tailMatch[1] ?? '', 10);
    const minutes = Number.parseInt(tailMatch[2] ?? '', 10);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return hours * 60 + minutes;
  }

  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.getUTCHours() * 60 + parsed.getUTCMinutes();
}

function mergeWindows(windows: AvailabilityWindow[]): AvailabilityWindow[] {
  if (windows.length <= 1) return windows.slice();
  const sorted = [...windows].sort((a, b) => a.start - b.start);
  const merged: AvailabilityWindow[] = [];

  for (const window of sorted) {
    const last = merged.at(-1);
    if (!last) {
      merged.push({ ...window, });
      continue;
    }

    if (window.start <= last.end) {
      last.end = Math.max(last.end, window.end);
    } else {
      merged.push({ ...window, });
    }
  }

  return merged;
}

function resolveDayIndex(value: AvailabilityRecord['day_of_week']): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const bounded = ((Math.trunc(value) % 7) + 7) % 7;
    return bounded;
  }

  if (typeof value === 'bigint') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    const bounded = ((Math.trunc(numeric) % 7) + 7) % 7;
    return bounded;
  }

  const raw = value?.toString().trim().toLowerCase();
  if (!raw) return null;

  if (DAY_TO_INDEX[raw as keyof typeof DAY_TO_INDEX] != null) {
    return DAY_TO_INDEX[raw as keyof typeof DAY_TO_INDEX];
  }

  const numeric = Number.parseInt(raw, 10);
  if (Number.isFinite(numeric)) {
    const bounded = ((Math.trunc(numeric) % 7) + 7) % 7;
    return bounded;
  }

  return null;
}

function parseRateUnit(unit: string): ParsedRateUnit | null {
  if (!unit) return null;
  const normalized = unit.trim().toLowerCase();
  if (HOURLY_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return {
      kind: 'hourly',
      minHours: 1,
      maxHours: null,
    };
  }

  const rangeMatch = unit.match(RANGE_PATTERN);
  if (rangeMatch) {
    const min = Number.parseFloat(rangeMatch[1]);
    const max = Number.parseFloat(rangeMatch[2]);
    if (Number.isFinite(min) && Number.isFinite(max) && max >= min) {
      return {
        kind: 'range',
        minHours: min,
        maxHours: max,
      };
    }
  }

  const singleMatch = unit.match(SINGLE_HOUR_PATTERN);
  if (singleMatch) {
    const hours = Number.parseFloat(singleMatch[1]);
    if (Number.isFinite(hours) && hours > 0) {
      return {
        kind: 'fixed',
        minHours: hours,
        maxHours: hours,
      };
    }
  }

  return null;
}

function formatRateDescriptor(descriptor: ParsedRateUnit) {
  if (descriptor.kind === 'hourly') return 'per hour';
  if (
    descriptor.maxHours != null &&
    Math.abs(descriptor.maxHours - descriptor.minHours) > Number.EPSILON
  ) {
    return `${formatHoursLabel(descriptor.minHours)} – ${formatHoursLabel(descriptor.maxHours)}`;
  }
  return formatHoursLabel(descriptor.minHours);
}

function formatHoursLabel(value: number) {
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(1));
  const label = Number.isInteger(rounded) ? `${rounded}` : `${rounded}`.replace(/\.0$/, '');
  const numeric = Number.parseFloat(label);
  const isSingular = Math.abs(numeric - 1) < Number.EPSILON;
  return `${label} ${isSingular ? 'hour' : 'hours'}`;
}
