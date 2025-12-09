export type SpaceStatus = 'Live' | 'Pending' | 'Draft' | 'Unpublished';

export const WEEKDAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type WeekdayName = (typeof WEEKDAY_ORDER)[number];

export type DayAvailability = {
  is_open: boolean;
  opens_at: string;
  closes_at: string;
};

export type WeeklyAvailability = Record<WeekdayName, DayAvailability>;

const createDailyAvailability = (overrides?: Partial<DayAvailability>): DayAvailability => ({
  is_open: true,
  opens_at: '09:00',
  closes_at: '18:00',
  ...overrides,
});

export const createDefaultWeeklyAvailability = (): WeeklyAvailability => {
  const availability = {} as WeeklyAvailability;

  for (const day of WEEKDAY_ORDER) {
    const isWeekend = day === 'Saturday' || day === 'Sunday';
    availability[day] = createDailyAvailability({ is_open: !isWeekend, });
  }

  return availability;
};

export const cloneWeeklyAvailability = (availability: WeeklyAvailability): WeeklyAvailability => {
  const clone = {} as WeeklyAvailability;

  for (const day of WEEKDAY_ORDER) {
    const slot = availability[day];
    clone[day] = slot ? { ...slot, } : createDailyAvailability();
  }

  return clone;
};

import type { PriceRuleRecord } from '@/lib/pricing-rules';

export type SpaceInput = {
  name: string;
  description: string;
  unit_number: string;
  address_subunit: string;
  street: string;
  barangay?: string;
  city: string;
  region: string;
  postal_code: string;
  country_code: string;
  lat: number;
  long: number;
  amenities: string[];
  availability: WeeklyAvailability;
};

export type AreaInput = {
  name: string;
  max_capacity: number;
  automatic_booking_enabled: boolean;
  request_approval_at_capacity: boolean;
  advance_booking_enabled: boolean;
  advance_booking_value: number | null;
  advance_booking_unit: 'days' | 'weeks' | 'months' | null;
  booking_notes_enabled: boolean;
  booking_notes: string | null;
  price_rule_id?: string | null;
};

export type AreaRecord = AreaInput & {
  id: string;
  created_at: string;
  price_rule: PriceRuleRecord | null;
};

export type SpaceImageRecord = {
  id: string;
  path: string;
  public_url: string | null;
  category: string | null;
  is_primary: boolean;
  display_order: number;
};

export type SpaceRecord = SpaceInput & {
  id: string;
  status: SpaceStatus;
  created_at: string;
  is_published: boolean;
  pending_unpublish_request: boolean;
  areas: AreaRecord[];
  pricing_rules: PriceRuleRecord[];
  images: SpaceImageRecord[];
};

export const SPACE_INPUT_DEFAULT: SpaceInput = {
  name: '',
  description: '',
  unit_number: '',
  address_subunit: '',
  street: '',
  barangay: '',
  city: '',
  region: '',
  postal_code: '',
  country_code: 'PH',
  lat: 14.5906,
  long: 120.9811,
  amenities: [],
  availability: createDefaultWeeklyAvailability(),
};

export const AREA_INPUT_DEFAULT: AreaInput = {
  name: '',
  max_capacity: 10,
  automatic_booking_enabled: false,
  request_approval_at_capacity: false,
  advance_booking_enabled: false,
  advance_booking_value: null,
  advance_booking_unit: null,
  booking_notes_enabled: false,
  booking_notes: null,
};

export const INITIAL_SPACES: SpaceRecord[] = [
  {
    id: 'atlas-loft',
    name: 'Atlas Loft',
    description: 'Light-filled SOMA loft that works for executive summits, board off-sites, and hybrid collaboration.',
    unit_number: 'Suite 120',
    address_subunit: 'Floor 12',
    street: '123 Mission St',
    barangay: '',
    city: 'San Francisco',
    region: 'CA',
    postal_code: '94105',
    country_code: 'US',
    lat: 37.791212,
    long: -122.392756,
    amenities: ['amenity-meeting-room', 'amenity-free-coffee'],
    availability: createDefaultWeeklyAvailability(),
    status: 'Live',
    is_published: true,
    pending_unpublish_request: false,
    created_at: '2025-02-10T10:00:00.000Z',
    images: [],
    pricing_rules: [],
    areas: [
      {
        id: 'atlas-loft-boardroom',
        name: 'Sky Boardroom',
        max_capacity: 14,
        automatic_booking_enabled: false,
        request_approval_at_capacity: false,
        advance_booking_enabled: false,
        advance_booking_value: null,
        advance_booking_unit: null,
        booking_notes_enabled: false,
        booking_notes: null,
        created_at: '2025-02-11T09:00:00.000Z',
        price_rule: null,
      }
    ],
  },
  {
    id: 'beacon-collective',
    name: 'Beacon Collective',
    description: 'Brooklyn warehouse conversion with maker tables, podcast booth, and modular AV grid.',
    unit_number: 'Unit 4B',
    address_subunit: 'Building B',
    street: '85 Berry St',
    barangay: '',
    city: 'Brooklyn',
    region: 'NY',
    postal_code: '11249',
    country_code: 'US',
    lat: 40.71978,
    long: -73.9615,
    amenities: ['amenity-podcast-booth', 'amenity-yoga-room'],
    availability: createDefaultWeeklyAvailability(),
    status: 'Pending',
    is_published: true,
    pending_unpublish_request: false,
    created_at: '2025-03-01T13:15:00.000Z',
    images: [],
    pricing_rules: [],
    areas: [
      {
        id: 'beacon-maker-lab',
        name: 'Maker Lab',
        max_capacity: 24,
        automatic_booking_enabled: false,
        request_approval_at_capacity: false,
        advance_booking_enabled: false,
        advance_booking_value: null,
        advance_booking_unit: null,
        booking_notes_enabled: false,
        booking_notes: null,
        created_at: '2025-03-02T08:00:00.000Z',
        price_rule: null,
      },
      {
        id: 'beacon-podcast',
        name: 'Podcast Booth',
        max_capacity: 4,
        automatic_booking_enabled: false,
        request_approval_at_capacity: false,
        advance_booking_enabled: false,
        advance_booking_value: null,
        advance_booking_unit: null,
        booking_notes_enabled: false,
        booking_notes: null,
        created_at: '2025-03-02T08:30:00.000Z',
        price_rule: null,
      }
    ],
  },
  {
    id: 'north-loop-atelier',
    name: 'North Loop Atelier',
    description: 'Minimal studio with cyc wall and daylight bays ideal for shoots and intimate demos.',
    unit_number: 'Studio 2',
    address_subunit: 'Level 1',
    street: '410 N 1st Ave',
    barangay: '',
    city: 'Minneapolis',
    region: 'MN',
    postal_code: '55401',
    country_code: 'US',
    lat: 44.98857,
    long: -93.27121,
    amenities: ['amenity-daylight', 'amenity-modular'],
    availability: createDefaultWeeklyAvailability(),
    status: 'Draft',
    is_published: true,
    pending_unpublish_request: false,
    created_at: '2025-03-05T08:45:00.000Z',
    images: [],
    pricing_rules: [],
    areas: [],
  }
];
