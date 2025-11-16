export type SpaceStatus = 'Live' | 'Pending' | 'Draft';

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
};

export type AreaInput = {
  name: string;
  min_capacity: number;
  max_capacity: number;
  rate_time_unit: 'hour' | 'day' | 'week';
  rate_amount: number;
};

export type AreaRecord = AreaInput & {
  id: string;
  created_at: string;
};

export type SpaceRecord = SpaceInput & {
  id: string;
  status: SpaceStatus;
  created_at: string;
  areas: AreaRecord[];
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
};

export const AREA_INPUT_DEFAULT: AreaInput = {
  name: '',
  min_capacity: 1,
  max_capacity: 10,
  rate_time_unit: 'hour',
  rate_amount: 100,
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
    status: 'Live',
    created_at: '2025-02-10T10:00:00.000Z',
    areas: [
      {
        id: 'atlas-loft-boardroom',
        name: 'Sky Boardroom',
        min_capacity: 4,
        max_capacity: 14,
        rate_time_unit: 'hour',
        rate_amount: 185,
        created_at: '2025-02-11T09:00:00.000Z',
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
    status: 'Pending',
    created_at: '2025-03-01T13:15:00.000Z',
    areas: [
      {
        id: 'beacon-maker-lab',
        name: 'Maker Lab',
        min_capacity: 6,
        max_capacity: 24,
        rate_time_unit: 'hour',
        rate_amount: 145,
        created_at: '2025-03-02T08:00:00.000Z',
      },
      {
        id: 'beacon-podcast',
        name: 'Podcast Booth',
        min_capacity: 2,
        max_capacity: 4,
        rate_time_unit: 'hour',
        rate_amount: 95,
        created_at: '2025-03-02T08:30:00.000Z',
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
    status: 'Draft',
    created_at: '2025-03-05T08:45:00.000Z',
    areas: [],
  }
];
