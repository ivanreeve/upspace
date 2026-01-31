import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { computeStartingPriceFromAreas } from '@/lib/spaces/pricing';
import { buildPublicObjectUrl, isAbsoluteUrl } from '@/lib/spaces/image-urls';
import type { Space } from '@/lib/api/spaces';
import type { PriceRuleDefinition } from '@/lib/pricing-rules';
import type { AreaPricingPayload } from '@/lib/spaces/pricing';

const getUserBookmarksInputSchema = z.object({
  user_id: z.string().regex(/^\d+$/),
  limit: z.coerce.number().int().min(1).max(20).optional().default(10),
});

const getUserBookingHistoryInputSchema = z.object({
  user_id: z.string().regex(/^\d+$/),
  limit: z.coerce.number().int().min(1).max(20).optional().default(10),
});

const getSimilarSpacesInputSchema = z.object({
  space_id: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(10).optional().default(5),
  user_id: z.string().regex(/^\d+$/).optional(),
});

export type GetUserBookmarksInput = z.infer<typeof getUserBookmarksInputSchema>;
export type GetUserBookingHistoryInput = z.infer<typeof getUserBookingHistoryInputSchema>;
export type GetSimilarSpacesInput = z.infer<typeof getSimilarSpacesInputSchema>;

/**
 * Get user's bookmarked spaces.
 */
export async function getUserBookmarks(input: unknown) {
  const validated = getUserBookmarksInputSchema.parse(input);
  const {
 user_id, limit,
} = validated;

  const bookmarks = await prisma.bookmark.findMany({
    where: { user_id: BigInt(user_id), },
    include: {
      space: {
        include: {
          amenity: { include: { amenity_choice: true, }, },
          area: { include: { price_rule: { select: { definition: true, }, }, }, },
          review: { select: { rating_star: true, }, },
        },
      },
    },
    orderBy: { created_at: 'desc', },
    take: limit,
  });

  const spaces = bookmarks.map((bookmark) => {
    const space = bookmark.space;
    if (!space) return null;
    const amenityNames = space.amenity.map((sa: { amenity_choice: { name: string } }) => sa.amenity_choice.name);

    const ratings = space.review.map((r: { rating_star: bigint }) => Number(r.rating_star));
    const averageRating =
      ratings.length > 0
        ? ratings.reduce((sum: number, rating: number) => sum + rating, 0) / ratings.length
        : null;

    const areaPricingPayloads: AreaPricingPayload[] = (space.area ?? []).map((area) => ({
      price_rule: area.price_rule
        ? {
            definition:
              (area.price_rule.definition as PriceRuleDefinition) ?? null,
          }
        : null,
    }));
    const startingPrice = computeStartingPriceFromAreas(areaPricingPayloads);

    // Note: hero_image_path is not available in the space model
    const heroImageUrl = null;

    return {
      space_id: space.id,
      name: space.name,
      address: `${space.unit_number} ${space.street}`,
      city: space.city ?? '',
      region: space.region ?? '',
      description: space.description ?? '',
      starting_price: startingPrice,
      average_rating: averageRating,
      total_reviews: ratings.length,
      amenities: amenityNames,
      amenity_count: amenityNames.length,
      hero_image_url: heroImageUrl,
      bookmarked_at: bookmark.created_at.toISOString(),
    };
  }).filter((s): s is NonNullable<typeof s> => s !== null);

  return {
    user_id,
    bookmarks: spaces,
    total_count: spaces.length,
  };
}

/**
 * Get user's booking history with aggregated patterns.
 */
export async function getUserBookingHistory(input: unknown) {
  const validated = getUserBookingHistoryInputSchema.parse(input);
  const {
 user_id, limit,
} = validated;

  const bookings = await prisma.booking.findMany({
    where: {
      user_auth_id: user_id,
      status: { in: ['confirmed', 'completed'], },
    },
    include: {
      space: { include: { amenity: { include: { amenity_choice: true, }, }, }, },
      area: true,
    },
    orderBy: { created_at: 'desc', },
    take: limit,
  });

  // Aggregate booking patterns
  const spaceBookingCounts: Record<string, number> = {};
  const amenityCounts: Record<string, number> = {};
  const areaTypeCounts: Record<string, number> = {};
  let totalSpent = 0;
  let totalHours = BigInt(0);

  bookings.forEach((booking) => {
    // Count space bookings
    const spaceId = booking.space_id;
    spaceBookingCounts[spaceId] = (spaceBookingCounts[spaceId] ?? 0) + 1;

    // Count amenity preferences
    booking.space.amenity.forEach((sa: { amenity_choice: { name: string } }) => {
      const amenityName = sa.amenity_choice.name;
      amenityCounts[amenityName] = (amenityCounts[amenityName] ?? 0) + 1;
    });

    // Count area type preferences
    const areaName = booking.area_name;
    areaTypeCounts[areaName] = (areaTypeCounts[areaName] ?? 0) + 1;

    // Sum spending
    if (booking.price_minor) {
      totalSpent += Number(booking.price_minor) / 100;
    }

    // Sum hours
    totalHours += booking.booking_hours;
  });

  // Find most booked space
  const mostBookedSpaceId =
    Object.keys(spaceBookingCounts).length > 0
      ? Object.entries(spaceBookingCounts).reduce((a: [string, number], b: [string, number]) =>
          b[1] > a[1] ? b : a
        )[0]
      : null;

  // Top amenities
  const topAmenities = Object.entries(amenityCounts)
    .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]: [string, number]) => ({
      amenity: name,
      count,
    }));

  // Preferred area types
  const preferredAreaTypes = Object.entries(areaTypeCounts)
    .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
    .map(([name, count]: [string, number]) => ({
      area_type: name,
      count,
    }));

  const avgBookingHours =
    bookings.length > 0 ? Number(totalHours) / bookings.length : 0;

  const avgSpent = bookings.length > 0 ? totalSpent / bookings.length : 0;

  return {
    user_id,
    total_bookings: bookings.length,
    recent_bookings: bookings.map((b) => ({
      booking_id: b.id,
      space_id: b.space_id,
      space_name: b.space_name,
      area_name: b.area_name,
      booking_hours: Number(b.booking_hours),
      price: b.price_minor ? Number(b.price_minor) / 100 : null,
      currency: b.currency,
      start_at: b.start_at.toISOString(),
      created_at: b.created_at.toISOString(),
    })),
    patterns: {
      most_booked_space_id: mostBookedSpaceId,
      top_amenities: topAmenities,
      preferred_area_types: preferredAreaTypes,
      average_booking_hours: avgBookingHours,
      average_spent: avgSpent,
      total_spent: totalSpent,
      currency: 'PHP',
    },
  };
}

/**
 * Find spaces similar to a given space.
 * Based on amenities, location, and price range.
 */
export async function getSimilarSpaces(input: unknown) {
  const validated = getSimilarSpacesInputSchema.parse(input);
  const {
 space_id, limit, user_id,
} = validated;

  // Fetch the reference space
  const referenceSpace = await prisma.space.findUnique({
    where: { id: space_id, },
    include: {
      amenity: { include: { amenity_choice: true, }, },
      area: { include: { price_rule: { select: { definition: true, }, }, }, },
      review: { select: { rating_star: true, }, },
    },
  });

  if (!referenceSpace) {
    return { error: 'Reference space not found', };
  }

  const referenceAmenities = referenceSpace.amenity.map((sa: { amenity_choice: { name: string } }) => sa.amenity_choice.name);

  const referenceAreaPricingPayloads: AreaPricingPayload[] = (referenceSpace.area ?? []).map((area) => ({
    price_rule: area.price_rule
      ? {
          definition:
            (area.price_rule.definition as PriceRuleDefinition) ?? null,
        }
      : null,
  }));
  const referencePrice = computeStartingPriceFromAreas(referenceAreaPricingPayloads);

  // Define price range (±30%)
  const priceMin = referencePrice ? referencePrice * 0.7 : null;
  const priceMax = referencePrice ? referencePrice * 1.3 : null;

  // Find similar spaces
  const similarSpaces = await prisma.space.findMany({
    where: {
      id: { not: space_id, },
      is_published: true,
      city: referenceSpace.city,
      amenity: { some: { amenity_choice: { name: { in: referenceAmenities, }, }, }, },
    },
    include: {
      amenity: { include: { amenity_choice: true, }, },
      area: { include: { price_rule: { select: { definition: true, }, }, }, },
      review: { select: { rating_star: true, }, },
      bookmark: user_id
        ? {
            where: { user_id: BigInt(user_id), },
            take: 1,
          }
        : false,
    },
    take: limit * 3, // Get more candidates for filtering
  });

  // Score each space based on similarity
  const scoredSpaces = similarSpaces.map((space) => {
    const spaceAmenities = space.amenity.map((sa: { amenity_choice: { name: string } }) => sa.amenity_choice.name);

    const spaceAreaPricingPayloads: AreaPricingPayload[] = (space.area ?? []).map((area) => ({
      price_rule: area.price_rule
        ? {
            definition:
              (area.price_rule.definition as PriceRuleDefinition) ?? null,
          }
        : null,
    }));
    const spacePrice = computeStartingPriceFromAreas(spaceAreaPricingPayloads);

    // Calculate amenity overlap (Jaccard similarity)
    const amenityOverlap = spaceAmenities.filter((a: string) =>
      referenceAmenities.includes(a)
    ).length;
    const amenitySimilarity =
      amenityOverlap /
      (referenceAmenities.length + spaceAmenities.length - amenityOverlap);

    // Calculate price similarity (1 if within range, decreasing if outside)
    let priceSimilarity = 0;
    if (spacePrice !== null && referencePrice !== null) {
      if (spacePrice >= (priceMin ?? 0) && spacePrice <= (priceMax ?? Infinity)) {
        priceSimilarity = 1;
      } else {
        const priceDiff = Math.abs(spacePrice - referencePrice);
        priceSimilarity = Math.max(0, 1 - priceDiff / referencePrice);
      }
    }

    // Combined similarity score (amenities weighted 70%, price 30%)
    const similarityScore = amenitySimilarity * 0.7 + priceSimilarity * 0.3;

    const ratings = space.review.map((r: { rating_star: bigint }) => Number(r.rating_star));
    const averageRating =
      ratings.length > 0
        ? ratings.reduce((sum: number, rating: number) => sum + rating, 0) / ratings.length
        : null;

    return {
      space_id: space.id,
      name: space.name,
      address: `${space.unit_number} ${space.street}`,
      city: space.city ?? '',
      region: space.region ?? '',
      description: space.description ?? '',
      starting_price: spacePrice,
      average_rating: averageRating,
      total_reviews: ratings.length,
      amenities: spaceAmenities,
      amenity_count: spaceAmenities.length,
      amenity_overlap: amenityOverlap,
      similarity_score: similarityScore,
      is_bookmarked: user_id ? (space.bookmark as unknown[]).length > 0 : false,
    };
  });

  // Sort by similarity score and take top results
  scoredSpaces.sort((a: { similarity_score: number }, b: { similarity_score: number }) => b.similarity_score - a.similarity_score);
  const topSimilarSpaces = scoredSpaces.slice(0, limit);

  return {
    reference_space_id: space_id,
    reference_space_name: referenceSpace.name,
    similar_spaces: topSimilarSpaces,
    total_found: topSimilarSpaces.length,
  };
}
