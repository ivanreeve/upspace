import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { evaluatePriceRule } from '@/lib/pricing-rules-evaluator';
import { findSpacesAgent } from '@/lib/ai/space-agent';
import type { FindSpacesToolInput } from '@/lib/ai/space-agent';
import type { PriceRuleDefinition } from '@/lib/pricing-rules';

const estimateMonthlyCostInputSchema = z.object({
  space_id: z.string().uuid(),
  area_id: z.string().uuid().optional(),
  days_per_week: z.coerce.number().int().min(1).max(7),
  hours_per_day: z.coerce.number().min(1).max(24).optional().default(8),
});

const findBudgetOptimalSpacesInputSchema = z.object({
  budget: z.coerce.number().min(0),
  days_per_week: z.coerce.number().int().min(1).max(7).optional().default(5),
  hours_per_day: z.coerce.number().min(1).max(24).optional().default(8),
  location: z
    .object({
      lat: z.coerce.number().min(-90).max(90),
      long: z.coerce.number().min(-180).max(180),
    })
    .optional(),
  amenities: z.array(z.string()).optional(),
  min_rating: z.coerce.number().min(0).max(5).optional(),
  user_id: z.string().regex(/^\d+$/).optional(),
});

export type EstimateMonthlyCostInput = z.infer<typeof estimateMonthlyCostInputSchema>;
export type FindBudgetOptimalSpacesInput = z.infer<typeof findBudgetOptimalSpacesInputSchema>;

/**
 * Estimate monthly cost for a usage pattern at a specific space.
 */
export async function estimateMonthlyCost(input: unknown) {
  const validated = estimateMonthlyCostInputSchema.parse(input);
  const {
 space_id, area_id, days_per_week, hours_per_day,
} = validated;

  // Fetch space with areas
  const space = await prisma.space.findUnique({
    where: { id: space_id, },
    include: {
      area: {
        where: area_id ? { id: area_id, } : undefined,
        include: { price_rule: { select: { definition: true, }, }, },
      },
    },
  });

  if (!space) {
    return { error: 'Space not found', };
  }

  if (space.area.length === 0) {
    return { error: area_id ? 'Area not found in this space' : 'No areas available in this space', };
  }

  // Calculate for each area
  const areaEstimates = space.area.map((area: {
    id: string;
    name: string;
    price_rule: { definition: unknown } | null;
  }) => {
    if (!area.price_rule?.definition) {
      return {
        area_id: area.id,
        area_name: area.name,
        error: 'Pricing not available for this area',
      };
    }

    try {
      // Daily cost
      const dailyResult = evaluatePriceRule(area.price_rule.definition as PriceRuleDefinition, { bookingHours: hours_per_day, });

      if (dailyResult.price === null) {
        return {
          area_id: area.id,
          area_name: area.name,
          error: 'Could not calculate price',
        };
      }

      const dailyCost = Number(dailyResult.price);

      // Weekly cost
      const weeklyCost = dailyCost * days_per_week;

      // Monthly cost (approximate 4.33 weeks per month)
      const monthlyCost = weeklyCost * 4.33;

      return {
        area_id: area.id,
        area_name: area.name,
        daily_cost: dailyCost,
        weekly_cost: weeklyCost,
        monthly_cost: monthlyCost,
        usage_pattern: {
          days_per_week,
          hours_per_day,
        },
        currency: 'PHP',
      };
    } catch (error) {
      console.error('Cost estimation error:', error);
      return {
        area_id: area.id,
        area_name: area.name,
        error: 'Failed to calculate cost',
      };
    }
  });

  // Find cheapest option
  const validEstimates = areaEstimates.filter(
    (e): e is Exclude<typeof e, { error: string }> => !('error' in e)
  );

  const cheapestArea =
    validEstimates.length > 0
      ? validEstimates.reduce((prev: typeof validEstimates[0], current: typeof validEstimates[0]) =>
          current.monthly_cost < prev.monthly_cost ? current : prev
        )
      : null;

  return {
    space_id,
    space_name: space.name,
    estimates: areaEstimates,
    cheapest_option: cheapestArea,
    usage_pattern: {
      days_per_week,
      hours_per_day,
    },
  };
}

/**
 * Find spaces that fit within a budget constraint.
 * Returns spaces sorted by value (features per price).
 */
export async function findBudgetOptimalSpaces(input: unknown) {
  const validated = findBudgetOptimalSpacesInputSchema.parse(input);
  const {
    budget,
    days_per_week,
    hours_per_day,
    location,
    amenities,
    min_rating,
    user_id,
  } = validated;

  // Calculate what the daily budget would be
  const dailyBudget = budget / (days_per_week * 4.33);

  // Use space search agent to find spaces
  const searchInput: FindSpacesToolInput = {
    max_price: dailyBudget,
    ...(location ? { location, } : {}),
    ...(amenities ? { amenities, } : {}),
    ...(min_rating ? { min_rating, } : {}),
    ...(user_id ? { user_id, } : {}),
    sort_by: 'price',
    sort_direction: 'asc',
    limit: 10,
  };

  const searchResult = await findSpacesAgent(searchInput);

  if (!searchResult.spaces || searchResult.spaces.length === 0) {
    return {
      message:
        'No spaces found within your budget. Try increasing your budget or adjusting your requirements.',
      budget,
      daily_budget: dailyBudget,
      usage_pattern: {
        days_per_week,
        hours_per_day,
      },
      spaces: [],
    };
  }

  // Calculate estimated monthly cost for each space
  const spacesWithEstimates = searchResult.spaces.map((space) => {
    const startingPrice = space.starting_price ?? 0;
    const estimatedMonthlyCost = startingPrice * days_per_week * 4.33;

    // Calculate "value score" based on amenities, rating, and price
    // Note: amenity_count is not available in Space type, defaulting to 0
    const amenityCount = 0;
    const rating = space.average_rating ?? 0;
    const valueScore =
      estimatedMonthlyCost > 0
        ? (amenityCount * 10 + rating * 20) / estimatedMonthlyCost
        : 0;

    return {
      ...space,
      estimated_monthly_cost: estimatedMonthlyCost,
      value_score: valueScore,
      budget_utilization: budget > 0 ? (estimatedMonthlyCost / budget) * 100 : 0,
    };
  });

  // Sort by value score (best value first)
  spacesWithEstimates.sort((a, b) => b.value_score - a.value_score);

  return {
    budget,
    daily_budget: dailyBudget,
    usage_pattern: {
      days_per_week,
      hours_per_day,
    },
    spaces: spacesWithEstimates,
    total_found: spacesWithEstimates.length,
    filters_used: searchResult.filters,
  };
}
