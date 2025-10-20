export type Space = {
  space_id: string;
  name: string;
  unit_number?: string | null;
  street?: string | null;
  address_subunit?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  postal_code?: string | null;
  image_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ListSpacesParams = Partial<{
  limit: number;
  cursor: string | null;
  q: string;
  city: string;
  region: string;
  country: string;
  amenities: string[]; // names
  amenities_mode: 'all' | 'any';
}>;

export async function listSpaces(params: ListSpacesParams = {}) {
  const sp = new URLSearchParams();
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.cursor) sp.set('cursor', params.cursor);
  if (params.q) sp.set('q', params.q);
  if (params.city) sp.set('city', params.city);
  if (params.region) sp.set('region', params.region);
  if (params.country) sp.set('country', params.country);
  if (params.amenities?.length) sp.set('amenities', params.amenities.join(','));
  if (params.amenities_mode) sp.set('amenities_mode', params.amenities_mode);

  const res = await fetch(`/api/v1/spaces?${sp.toString()}`, {
    headers: { 'accept': 'application/json', },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch spaces (${res.status})`);
  }
  const json = await res.json();
  return json as { data: Space[]; nextCursor: string | null };
}
