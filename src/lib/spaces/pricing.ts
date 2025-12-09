import { evaluatePriceRule } from '@/lib/pricing-rules-evaluator';
import type { PriceRuleDefinition } from '@/lib/pricing-rules';

const STARTING_PRICE_DEFAULT_BOOKING_HOURS = 1;

type AreaPricingPayload = {
  price_rule: {
    definition: PriceRuleDefinition | null;
  } | null;
};

export function computeStartingPriceFromAreas(
  areas: AreaPricingPayload[] = []
): number | null {
  const prices: number[] = [];

  for (const area of areas) {
    const definition = area.price_rule?.definition ?? null;
    if (!definition) {
      continue;
    }

    try {
      const result = evaluatePriceRule(definition, { bookingHours: STARTING_PRICE_DEFAULT_BOOKING_HOURS, });
      const price = result.price;
      if (price === null) {
        continue;
      }

      const numericPrice = Number(price);
      if (!Number.isFinite(numericPrice) || numericPrice < 0) {
        continue;
      }

      prices.push(numericPrice);
    } catch {
      // Ignore invalid pricing rule definitions.
    }
  }

  if (!prices.length) {
    return null;
  }

  return Math.min(...prices);
}
