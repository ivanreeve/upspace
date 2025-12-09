import type { Prisma, verification_status } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import type { Space } from '@/lib/api/spaces';
import { buildPublicObjectUrl, isAbsoluteUrl, resolveSignedImageUrls } from '@/lib/spaces/image-urls';
import { computeStartingPriceFromAreas } from '@/lib/spaces/pricing';
import type { AreaPricingPayload } from '@/lib/spaces/pricing';
import type { PriceRuleDefinition } from '@/lib/pricing-rules';

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const CANDIDATE_MULTIPLIER = 6;
const MAX_CANDIDATE_SPACES = 120;
const DEFAULT_RADIUS_METERS = 5000;
export const MAX_RADIUS_METERS = 50_000;
const EARTH_RADIUS_METERS = 6_371_000;

type NormalizedLocation = {
  lat: number;
  long: number;
};

export type SharedSpaceSearchFilters = {
  location?: NormalizedLocation;
  radius?: number;
  amenities?: string[];
  amenities_mode?: 'any' | 'all';
  amenities_negate?: boolean;
  min_price?: number;
  max_price?: number;
  min_rating?: number;
  max_rating?: number;
  sort_by?: 'price' | 'rating' | 'distance' | 'relevance';
  sort_direction?: 'asc' | 'desc';
  limit?: number;
  include_pending?: boolean;
  user_id?: string;
};

export type FindSpacesToolInput = SharedSpaceSearchFilters & {
  query?: string;
};

export type FindSpacesToolResult = {
  spaces: Space[];
  filters: {
    location?: NormalizedLocation | null;
    radius?: number | null;
    query?: string | null;
    amenities?: string[] | null;
    sort_by: FindSpacesToolInput['sort_by'] | 'relevance';
    sort_direction: 'asc' | 'desc';
    min_price?: number | null;
    max_price?: number | null;
    min_rating?: number | null;
    max_rating?: number | null;
  };
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const toRadians = (value: number) => (value * Math.PI) / 180;

const compareNullableAscending = (a: number | null | undefined, b: number | null | undefined) => {
  const normalizedA = a ?? Number.MAX_SAFE_INTEGER;
  const normalizedB = b ?? Number.MAX_SAFE_INTEGER;
  return normalizedA - normalizedB;
};

const normalizeAmenities = (amenities?: string[]) =>
  Array.from(
    new Set(
      (amenities ?? [])
        .map((name) => name.trim())
        .filter(Boolean)
    )
  );

const nearbyQueryPattern = /\b(?:nearby|near|around|closest|nearest|within)\b/;
const closeToPhrasePattern = /\bclose (?:to|by)\b/;

const indicatesNearbySearch = (query?: string) => {
  if (!query?.trim()) {
    return false;
  }

  const normalized = query.trim().toLowerCase();
  return nearbyQueryPattern.test(normalized) || closeToPhrasePattern.test(normalized);
};

const buildAmenityClause = (
  names: string[],
  mode: 'any' | 'all',
  negate: boolean
): Prisma.spaceWhereInput | null => {
  if (!names.length) {
    return null;
  }

  const clauses = names.map((name) => ({
    amenity_choice: {
      name: {
        equals: name,
        mode: 'insensitive' as const,
      },
    },
  }));

  if (negate) {
    return { amenity: { none: { OR: clauses, }, }, };
  }

  if (mode === 'all') {
    return {
      AND: names.map((name) => ({
        amenity: {
          some: {
            amenity_choice: {
              name: {
                equals: name,
                mode: 'insensitive' as const,
              },
            },
          },
        },
      })),
    };
  }

  return { amenity: { some: { OR: clauses, }, }, };
};

const haversineDistance = (
  origin: NormalizedLocation,
  targetLat: number,
  targetLon: number
): number => {
  const deltaLat = toRadians(targetLat - origin.lat);
  const deltaLon = toRadians(targetLon - origin.long);
  const baseLat = toRadians(origin.lat);
  const targetLatRadians = toRadians(targetLat);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(baseLat) * Math.cos(targetLatRadians) * Math.sin(deltaLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
};

export async function findSpacesAgent(
  input: FindSpacesToolInput
): Promise<FindSpacesToolResult> {
  const limit = clampNumber(input.limit ?? DEFAULT_LIMIT, 1, MAX_LIMIT);
  const normalizedAmenities = normalizeAmenities(input.amenities);
  const sortBy = input.sort_by ?? 'relevance';
  const includePending = input.include_pending ?? false;
  const radiusValue = (() => {
    if (typeof input.radius === 'number') {
      return clampNumber(input.radius, 0, MAX_RADIUS_METERS);
    }

    if (input.location && indicatesNearbySearch(input.query)) {
      return DEFAULT_RADIUS_METERS;
    }

    return undefined;
  })();
  const sortDirectionPreference = input.sort_direction;
  const resolveSortDirection = (defaultDirection: 'asc' | 'desc') =>
    (sortDirectionPreference ?? defaultDirection) as 'asc' | 'desc';
  const priceSortDirection = resolveSortDirection('asc');
  const distanceSortDirection = resolveSortDirection('asc');
  const ratingSortDirection = resolveSortDirection('desc');

  const verificationStatuses: verification_status[] = includePending
    ? ['approved', 'in_review']
    : ['approved'];

  const clauses: Prisma.spaceWhereInput[] = [
    { is_published: true, },
    { verification: { some: { status: { in: verificationStatuses, }, }, }, }
  ];

  if (input.query) {
    const trimmed = input.query.trim();
    if (trimmed) {
      clauses.push({
        OR: [
          {
 name: {
 contains: trimmed,
mode: 'insensitive', 
}, 
},
          {
 street: {
 contains: trimmed,
mode: 'insensitive', 
}, 
},
          {
 city: {
 contains: trimmed,
mode: 'insensitive', 
}, 
},
          {
 region: {
 contains: trimmed,
mode: 'insensitive', 
}, 
}
        ],
      });
    }
  }

  const amenityClause = buildAmenityClause(
    normalizedAmenities,
    input.amenities_mode ?? 'any',
    Boolean(input.amenities_negate)
  );
  if (amenityClause) {
    clauses.push(amenityClause);
  }

  const candidateLimit = Math.min(
    MAX_CANDIDATE_SPACES,
    Math.max(limit * CANDIDATE_MULTIPLIER, 20)
  );

  const rows = await prisma.space.findMany({
    where: clauses.length ? { AND: clauses, } : {},
    take: candidateLimit,
    orderBy: { updated_at: 'desc', },
    include: {
      space_image: {
        orderBy: [
          { is_primary: 'desc', },
          { display_order: 'asc', },
          { created_at: 'asc', }
        ],
        select: { path: true, },
        take: 1,
      },
      area: { select: { price_rule: { select: { definition: true, }, }, }, },
    },
  });

  const spaceIds = rows.map((space) => space.id);

  const ratingAggregates =
    spaceIds.length > 0
      ? await prisma.review.groupBy({
          by: ['space_id'],
          where: { space_id: { in: spaceIds, }, },
          _count: { rating_star: true, },
          _avg: { rating_star: true, },
        })
      : [];

  const ratingMap = new Map<string, { average_rating: number; total_reviews: number }>();
  for (const aggregate of ratingAggregates) {
    const avg = aggregate._avg.rating_star ?? 0;
    const count = aggregate._count.rating_star ?? 0;
    ratingMap.set(aggregate.space_id, {
      average_rating: Number(avg),
      total_reviews: count,
    });
  }

  const signedImageUrlMap = await resolveSignedImageUrls(
    rows.flatMap((space) => space.space_image)
  );

  const bookmarkUserId =
    typeof input.user_id === 'string' && input.user_id.trim()
      ? BigInt(input.user_id)
      : null;

  const bookmarkedSpaceIds = new Set<string>();
  if (bookmarkUserId && spaceIds.length > 0) {
    const bookmarks = await prisma.bookmark.findMany({
      where: {
        user_id: bookmarkUserId,
        space_id: { in: spaceIds, },
      },
      select: { space_id: true, },
    });
    for (const bookmark of bookmarks) {
      if (bookmark.space_id) {
        bookmarkedSpaceIds.add(bookmark.space_id);
      }
    }
  }

  const location = input.location;

  const normalizedSpaces = rows.map((space) => {
    const imagePath = space.space_image[0]?.path ?? null;
    const resolvedImageUrl = imagePath
      ? isAbsoluteUrl(imagePath)
        ? imagePath
        : signedImageUrlMap.get(imagePath) ?? buildPublicObjectUrl(imagePath)
      : null;

    const ratingSummary = ratingMap.get(space.id) ?? {
      average_rating: 0,
      total_reviews: 0,
    };

    const areaPricingPayloads: AreaPricingPayload[] = (space.area ?? []).map((area) => ({
      price_rule: area.price_rule
        ? {
            definition:
              (area.price_rule.definition as PriceRuleDefinition) ?? null,
          }
        : null,
    }));
    const startingPrice = computeStartingPriceFromAreas(areaPricingPayloads);
    const lat = typeof space.lat === 'number' ? space.lat : Number(space.lat);
    const lon = typeof space.long === 'number' ? space.long : Number(space.long);

    const distanceMeters =
      location && Number.isFinite(lat) && Number.isFinite(lon)
        ? haversineDistance(location, lat, lon)
        : null;

    return {
      space_id: space.id,
      name: space.name,
      unit_number: space.unit_number || null,
      street: space.street,
      address_subunit: space.address_subunit || null,
      barangay: space.barangay,
      city: space.city,
      region: space.region,
      country_code: space.country_code,
      postal_code: space.postal_code,
      description: space.description ?? '',
      image_url: resolvedImageUrl,
      isBookmarked: bookmarkedSpaceIds.has(space.id),
      created_at: space.created_at.toISOString(),
      updated_at: space.updated_at.toISOString(),
      status: 'Live',
      average_rating: ratingSummary.average_rating,
      total_reviews: ratingSummary.total_reviews,
      min_rate_price: null,
      max_rate_price: null,
      rate_time_unit: null,
      starting_price: startingPrice,
      availability: [],
      lat,
      long: lon,
      distance_meters: distanceMeters,
    } satisfies Space & { distance_meters: number | null };
  });

  const filteredSpaces = normalizedSpaces.filter((space) => {
    if (input.min_price !== undefined) {
      if (space.starting_price === null || space.starting_price < input.min_price) {
        return false;
      }
    }

    if (input.max_price !== undefined) {
      if (space.starting_price === null || space.starting_price > input.max_price) {
        return false;
      }
    }

    if (input.min_rating !== undefined && space.average_rating < input.min_rating) {
      return false;
    }

    if (input.max_rating !== undefined && space.average_rating > input.max_rating) {
      return false;
    }

    if (radiusValue !== undefined) {
      if (space.distance_meters === null || space.distance_meters > radiusValue) {
        return false;
      }
    }

    return true;
  });

  const sortedSpaces = filteredSpaces.sort((a, b) => {
    const priceComparison = compareNullableAscending(
      a.starting_price,
      b.starting_price
    );
    switch (sortBy) {
      case 'distance': {
        const comparison = compareNullableAscending(
          a.distance_meters,
          b.distance_meters
        );
        if (comparison !== 0) {
          return distanceSortDirection === 'asc' ? comparison : -comparison;
        }
        return priceComparison;
      }
      case 'price': {
        return priceSortDirection === 'asc' ? priceComparison : -priceComparison;
      }
      case 'rating': {
        const ratingDiff = b.average_rating - a.average_rating;
        if (Math.abs(ratingDiff) > Number.EPSILON) {
          return ratingSortDirection === 'asc' ? -ratingDiff : ratingDiff;
        }
        return priceComparison;
      }
      default: {
        const ratingDiff = b.average_rating - a.average_rating;
        if (Math.abs(ratingDiff) > Number.EPSILON) {
          return ratingSortDirection === 'asc' ? -ratingDiff : ratingDiff;
        }
        return priceComparison;
      }
    }
  });

  const limitedSpaces = sortedSpaces.slice(0, limit);
  const activeSortDirection =
    sortBy === 'distance'
      ? distanceSortDirection
      : sortBy === 'price'
        ? priceSortDirection
        : ratingSortDirection;

  return {
    spaces: limitedSpaces,
    filters: {
      location: location ?? null,
      radius: radiusValue ?? null,
      query: input.query?.trim() ?? null,
      amenities: normalizedAmenities.length ? normalizedAmenities : null,
      sort_by: sortBy,
      sort_direction: activeSortDirection,
      min_price: input.min_price ?? null,
      max_price: input.max_price ?? null,
      min_rating: input.min_rating ?? null,
      max_rating: input.max_rating ?? null,
    },
  };
}
