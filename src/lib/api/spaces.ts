export type SpaceAvailabilitySlot = {
  day_of_week: number;
  opens_at: string;
  closes_at: string;
};

export type Space = {
  space_id: string;
  name: string;
  unit_number?: string | null;
  street?: string | null;
  address_subunit?: string | null;
  barangay?: string | null;
  city?: string | null;
  region?: string | null;
  country_code?: string | null;
  postal_code?: string | null;
  image_url?: string | null;
  isBookmarked?: boolean;
  created_at?: string;
  updated_at?: string;
  status?: 'Live' | 'Pending' | 'Draft' | 'Unpublished';
  average_rating?: number;
  total_reviews?: number;
  min_rate_price?: number | null;
  max_rate_price?: number | null;
  rate_time_unit?: string | null;
  starting_price?: number | null;
  availability?: SpaceAvailabilitySlot[];
  lat?: number;
  long?: number;
};

export type ListSpacesParams = Partial<{
  limit: number;
  cursor: string | null;
  q: string;
  city: string;
  region: string;
  barangay: string;
  street: string;
  country: string;
  bookmark_user_id: string;
  amenities: string[]; // names
  amenities_mode: 'all' | 'any';
  amenities_negate: boolean;
  min_rate_price: number;
  max_rate_price: number;
  available_from: string;
  available_to: string;
  include_pending: boolean;
}>;

export type SpaceSuggestion = {
  space_id: string;
  name: string;
  location: string | null;
  similarity: number;
  image_url: string | null;
};

export type SuggestSpacesParams = {
  q: string;
  limit?: number;
  include_pending?: boolean;
  signal?: AbortSignal;
};

export async function listSpaces(params: ListSpacesParams = {}) {
  const sp = new URLSearchParams();
  if (typeof params.limit === 'number') sp.set('limit', String(params.limit));
  if (params.cursor) sp.set('cursor', params.cursor);
  if (params.q) sp.set('q', params.q);
  if (params.city) sp.set('city', params.city);
  if (params.region) sp.set('region', params.region);
  if (params.barangay) sp.set('barangay', params.barangay);
  if (params.street) sp.set('street', params.street);
  if (params.country) sp.set('country', params.country);
  if (params.bookmark_user_id) {
    sp.set('bookmark_user_id', params.bookmark_user_id);
  }
  if (params.amenities?.length) sp.set('amenities', params.amenities.join(','));
  if (params.amenities_mode) sp.set('amenities_mode', params.amenities_mode);
  if (typeof params.amenities_negate === 'boolean') {
    sp.set('amenities_negate', String(params.amenities_negate));
  }
  if (typeof params.min_rate_price === 'number') sp.set('min_rate_price', String(params.min_rate_price));
  if (typeof params.max_rate_price === 'number') sp.set('max_rate_price', String(params.max_rate_price));
  if (params.available_from) sp.set('available_from', params.available_from);
  if (params.available_to) sp.set('available_to', params.available_to);
  if (typeof params.include_pending === 'boolean') {
    sp.set('include_pending', String(params.include_pending));
  }

  const query = sp.toString();
  const response = await fetch(query ? `/api/v1/spaces?${query}` : '/api/v1/spaces', {
    headers: { accept: 'application/json', },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch spaces (${response.status})`);
  }
  const json = await response.json();
  return json as { data: Space[]; nextCursor: string | null };
}

export async function suggestSpaces(params: SuggestSpacesParams) {
  const trimmedQuery = params.q.trim();
  if (trimmedQuery.length < 2) {
    return { suggestions: [] as SpaceSuggestion[], };
  }

  const includePending = params.include_pending ?? false;

  const sp = new URLSearchParams();
  sp.set('q', trimmedQuery);
  if (typeof params.limit === 'number') sp.set('limit', String(params.limit));
  if (typeof includePending === 'boolean') sp.set('include_pending', String(includePending));

  const query = sp.toString();
  const response = await fetch(`/api/v1/spaces/suggest?${query}`, {
    headers: { accept: 'application/json', },
    cache: 'no-store',
    signal: params.signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch space suggestions (${response.status})`);
  }

  const json = await response.json();
  return json as { suggestions: SpaceSuggestion[] };
}
