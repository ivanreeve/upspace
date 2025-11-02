export type SpaceAreaRate = {
  rate_id: string | null;
  time_unit: string | null;
  price: number | null;
};

export type SpaceAreaImage = {
  image_id: string | null;
  url: string;
};

export type SpaceAvailability = {
  availability_id: string | null;
  day_index: number;
  day_label: string;
  opening: string;
  closing: string;
};

export type SpaceAmenity = {
  amenity_id: string | null;
  name: string;
};

export type SpaceHost = {
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
};

export type SpaceArea = {
  area_id: string | null;
  name: string;
  min_capacity: number | null;
  max_capacity: number | null;
  images: SpaceAreaImage[];
  price_rates: SpaceAreaRate[];
};

export type SpaceDetail = {
  space_id: string | null;
  user_id: string | null;
  name: string;
  overview: string | null;
  unit_number: string;
  street: string;
  address_subunit: string | null;
  city: string;
  region: string;
  country_code: string;
  postal_code: string;
  lat: number | null;
  long: number | null;
  images: string[];
  amenities: SpaceAmenity[];
  areas: SpaceArea[];
  availability: SpaceAvailability[];
  host: SpaceHost | null;
  created_at: string;
  updated_at: string;
};

export type SpaceDetailResponse = {
  data: SpaceDetail;
};

const resolveBaseUrl = () => {
  if (typeof window !== 'undefined') return '';
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
};

export async function getSpaceDetail(spaceId: string, init?: RequestInit) {
  const baseUrl = resolveBaseUrl();
  const url = `${baseUrl}/api/v1/spaces/${spaceId}`;
  const res = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch space detail (${res.status})`);
  }

  const json = await res.json() as SpaceDetailResponse;
  return json.data;
}
