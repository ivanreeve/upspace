import { evaluatePriceRule } from '@/lib/pricing-rules-evaluator';
import type { PriceRuleDefinition } from '@/lib/pricing-rules';

const STARTING_PRICE_DEFAULT_BOOKING_HOURS = 1;
const STARTING_PRICE_CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = { price: number | null; expiresAt: number };
const startingPriceCache = new Map<string, CacheEntry>();

export function invalidateStartingPriceCache(spaceId: string) {
  startingPriceCache.delete(spaceId);
}

export function computeStartingPriceFromAreasCached(
  spaceId: string,
  areas: AreaPricingPayload[] = []
): number | null {
  const cached = startingPriceCache.get(spaceId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.price;
  }

  const price = computeStartingPriceFromAreas(areas);
  startingPriceCache.set(spaceId, {
    price,
    expiresAt: Date.now() + STARTING_PRICE_CACHE_TTL_MS,
  });
  return price;
}

export type AreaPricingPayload = {
  price_rule: {
    definition: PriceRuleDefinition | null;
    is_active?: boolean;
  } | null;
};

export function computeStartingPriceFromAreas(
  areas: AreaPricingPayload[] = []
): number | null {
  const prices: number[] = [];

  for (const area of areas) {
    if (area.price_rule?.is_active === false) {
      continue;
    }
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
