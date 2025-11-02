export type SpaceCard = {
  space_id: string;
  name: string;
  city: string;
  region: string;
  address: string;
  images: string[];
  price_min: number | null;
  price_max: number | null;
  rating: number | null;
};

export type ListSpacesParams = Partial<{
  limit: number;
  cursor: string | null;
  q: string;
  city: string;
  region: string;
  country_code: string;
  amenities: string[]; // names
  amenities_mode: 'all' | 'any';
  min_rate_price: number;
  max_rate_price: number;
  rate_time_unit: string;
  sort: 'space_id' | 'name' | 'created_at' | 'updated_at';
  order: 'asc' | 'desc';
}>;

export type ListSpacesResponse = {
  data: SpaceCard[];
  nextCursor: string | null;
};

export async function listSpaces(
  params: ListSpacesParams = {},
  options: { signal?: AbortSignal } = {}
) {
  const sp = new URLSearchParams();
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.cursor) sp.set('cursor', params.cursor);
  if (params.q) sp.set('q', params.q);
  if (params.city) sp.set('city', params.city);
  if (params.region) sp.set('region', params.region);
  if (params.country_code) sp.set('country_code', params.country_code);
  if (params.amenities?.length) sp.set('amenities', params.amenities.join(','));
  if (params.amenities_mode) sp.set('amenities_mode', params.amenities_mode);
  if (params.min_rate_price != null) sp.set('min_rate_price', String(params.min_rate_price));
  if (params.max_rate_price != null) sp.set('max_rate_price', String(params.max_rate_price));
  if (params.rate_time_unit) sp.set('rate_time_unit', params.rate_time_unit);
  if (params.sort) sp.set('sort', params.sort);
  if (params.order) sp.set('order', params.order);

  const res = await fetch(`/api/v1/spaces?${sp.toString()}`, {
    headers: { accept: 'application/json', },
    cache: 'no-store',
    signal: options.signal,
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch spaces (${res.status})`);
  }
  const json = await res.json();
  return json as ListSpacesResponse;
}
