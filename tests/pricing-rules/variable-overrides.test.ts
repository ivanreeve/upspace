import { describe, expect, it } from 'vitest';

import { getInvalidPriceRuleOverrideKeys, getMissingRequiredPriceRuleVariables, type PriceRuleDefinition } from '@/lib/pricing-rules';

const definition: PriceRuleDefinition = {
  formula: 'base_rate',
  conditions: [],
  variables: [
    {
      key: 'base_rate',
      label: 'Base rate',
      type: 'number',
      initialValue: '500',
      userInput: false,
    },
    {
      key: 'coupon_code',
      label: 'Coupon code',
      type: 'text',
      userInput: true,
    },
    {
      key: 'company_name',
      label: 'Company name',
      type: 'text',
      userInput: true,
      required: false,
    }
  ],
};

describe('pricing rule variable overrides', () => {
  it('treats user-input variables as required by default', () => {
    expect(
      getMissingRequiredPriceRuleVariables(definition, { company_name: '', }).map((variable) => variable.key)
    ).toEqual(['coupon_code']);
  });

  it('allows explicitly optional user-input variables to be blank', () => {
    expect(
      getMissingRequiredPriceRuleVariables(definition, {
        coupon_code: 'WELCOME10',
        company_name: '',
      })
    ).toEqual([]);
  });

  it('rejects overrides for undeclared and built-in variables', () => {
    expect(
      getInvalidPriceRuleOverrideKeys(definition, {
        coupon_code: 'WELCOME10',
        guest_count: 2,
        hidden_rate: 1000,
      })
    ).toEqual(['guest_count', 'hidden_rate']);
  });
});
