import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { computeStartingPriceFromAreas } from '@/lib/spaces/pricing';
import type { Space } from '@/lib/api/spaces';
import type { PriceRuleDefinition } from '@/lib/pricing-rules';
import type { AreaPricingPayload } from '@/lib/spaces/pricing';

const compareSpacesInputSchema = z.object({
  space_ids: z.array(z.string().uuid()).min(2).max(5),
  user_id: z.string().regex(/^\d+$/).optional(),
});

export type CompareSpacesInput = z.infer<typeof compareSpacesInputSchema>;

type SpaceComparison = {
  space_id: string;
  name: string;
  address: string;
  city: string;
  region: string;
  starting_price: number | null;
  average_rating: number | null;
  total_reviews: number;
  amenities: string[];
  is_bookmarked: boolean;
  description: string;
  is_published: boolean;
};

type ComparisonAnalysis = {
  cheapest_space_id: string | null;
  highest_rated_space_id: string | null;
  most_amenities_space_id: string | null;
  price_range: {
    min: number | null;
    max: number | null;
  };
  rating_range: {
    min: number | null;
    max: number | null;
  };
  common_amenities: string[];
  unique_amenities_by_space: Record<string, string[]>;
};

/**
 * Compare multiple coworking spaces side-by-side.
 * Returns detailed comparison data with analysis.
 */
export async function compareSpaces(input: unknown) {
  const validated = compareSpacesInputSchema.parse(input);
  const {
 space_ids, user_id,
} = validated;

  // Fetch all spaces with their data
  const spaces = await prisma.space.findMany({
    where: { id: { in: space_ids, }, },
    include: {
      amenity: { include: { amenity_choice: true, }, },
      area: { include: { price_rule: { select: { definition: true, }, }, }, },
      bookmark: user_id
        ? {
            where: { user_id: BigInt(user_id), },
            take: 1,
          }
        : false,
      review: { select: { rating_star: true, }, },
    },
  });

  if (spaces.length === 0) {
    return { error: 'No spaces found with the provided IDs', };
  }

  if (spaces.length < 2) {
    return { error: 'At least 2 spaces are required for comparison', };
  }

  // Transform spaces into comparison format
  const comparisons: SpaceComparison[] = spaces.map((space) => {
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

    return {
      space_id: space.id,
      name: space.name,
      address: `${space.unit_number} ${space.street}`,
      city: space.city ?? '',
      region: space.region ?? '',
      starting_price: startingPrice,
      average_rating: averageRating,
      total_reviews: ratings.length,
      amenities: amenityNames,
      is_bookmarked: user_id ? (space.bookmark as unknown[]).length > 0 : false,
      description: space.description ?? '',
      is_published: space.is_published,
    };
  });

  // Perform analysis
  const analysis = analyzeComparisons(comparisons);

  return {
    spaces: comparisons,
    analysis,
    comparison_count: comparisons.length,
  };
}

/**
 * Analyze comparison data to provide insights.
 */
function analyzeComparisons(comparisons: SpaceComparison[]): ComparisonAnalysis {
  const prices = comparisons
    .map((c) => c.starting_price)
    .filter((p): p is number => p !== null);

  const ratings = comparisons
    .map((c) => c.average_rating)
    .filter((r): r is number => r !== null);

  // Find cheapest space
  const cheapestSpace =
    prices.length > 0
      ? comparisons.find((c) => c.starting_price === Math.min(...prices))
      : null;

  // Find highest rated space
  const highestRatedSpace =
    ratings.length > 0
      ? comparisons.find((c) => c.average_rating === Math.max(...ratings))
      : null;

  // Find space with most amenities
  const mostAmenitiesSpace = comparisons.reduce((prev, current) =>
    current.amenities.length > prev.amenities.length ? current : prev
  );

  // Find common amenities (present in all spaces)
  const allAmenities = comparisons.map((c) => new Set(c.amenities));
  const commonAmenities = comparisons[0].amenities.filter((amenity) =>
    allAmenities.every((set) => set.has(amenity))
  );

  // Find unique amenities per space
  const uniqueAmenitiesBySpace: Record<string, string[]> = {};
  comparisons.forEach((space) => {
    const otherAmenities = new Set(
      comparisons
        .filter((c) => c.space_id !== space.space_id)
        .flatMap((c) => c.amenities)
    );

    uniqueAmenitiesBySpace[space.space_id] = space.amenities.filter(
      (amenity) => !otherAmenities.has(amenity)
    );
  });

  return {
    cheapest_space_id: cheapestSpace?.space_id ?? null,
    highest_rated_space_id: highestRatedSpace?.space_id ?? null,
    most_amenities_space_id: mostAmenitiesSpace.space_id,
    price_range: {
      min: prices.length > 0 ? Math.min(...prices) : null,
      max: prices.length > 0 ? Math.max(...prices) : null,
    },
    rating_range: {
      min: ratings.length > 0 ? Math.min(...ratings) : null,
      max: ratings.length > 0 ? Math.max(...ratings) : null,
    },
    common_amenities: commonAmenities,
    unique_amenities_by_space: uniqueAmenitiesBySpace,
  };
}
