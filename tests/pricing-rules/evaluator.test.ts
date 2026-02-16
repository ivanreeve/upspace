import { describe, expect, it } from 'vitest';

import {
  evaluateFormula,
  evaluatePriceRule,
  normalizeTimeLiteral,
  validateDateLiteral,
  validateDatetimeLiteral,
  FORMULA_MAX_LENGTH,
  FORMULA_MAX_NESTING_DEPTH,
  FORMULA_MAX_CONDITIONS,
} from '@/lib/pricing-rules-evaluator';
import type { PriceRuleDefinition, PriceRuleCondition } from '@/lib/pricing-rules';
import { PRICE_RULE_INITIAL_VARIABLES, priceRuleSchema } from '@/lib/pricing-rules';
import { computeStartingPriceFromAreas } from '@/lib/spaces/pricing';

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

const makeDefinition = (
  overrides: Partial<PriceRuleDefinition> = {}
): PriceRuleDefinition => ({
  variables: [...PRICE_RULE_INITIAL_VARIABLES],
  conditions: [],
  formula: '',
  ...overrides,
});

const makeCondition = (
  overrides: Partial<PriceRuleCondition> & Pick<PriceRuleCondition, 'id' | 'comparator' | 'left' | 'right'>
): PriceRuleCondition => ({
  ...overrides,
});

// ---------------------------------------------------------------------------
// evaluateFormula — arithmetic
// ---------------------------------------------------------------------------

describe('evaluateFormula', () => {
  describe('basic arithmetic', () => {
    it('evaluates a simple number', () => {
      expect(evaluateFormula('42', {})).toBe(42);
    });

    it('evaluates addition', () => {
      expect(evaluateFormula('2 + 3', {})).toBe(5);
    });

    it('evaluates subtraction', () => {
      expect(evaluateFormula('10 - 4', {})).toBe(6);
    });

    it('evaluates multiplication', () => {
      expect(evaluateFormula('3 * 7', {})).toBe(21);
    });

    it('evaluates division', () => {
      expect(evaluateFormula('20 / 4', {})).toBe(5);
    });

    it('evaluates decimal numbers', () => {
      expect(evaluateFormula('1.5 + 2.5', {})).toBe(4);
    });

    it('evaluates zero', () => {
      expect(evaluateFormula('0', {})).toBe(0);
    });

    it('evaluates negative result', () => {
      expect(evaluateFormula('3 - 10', {})).toBe(-7);
    });
  });

  describe('operator precedence', () => {
    it('multiplication before addition', () => {
      expect(evaluateFormula('2 + 3 * 4', {})).toBe(14);
    });

    it('division before subtraction', () => {
      expect(evaluateFormula('10 - 6 / 2', {})).toBe(7);
    });

    it('left-to-right for same precedence', () => {
      expect(evaluateFormula('10 - 3 - 2', {})).toBe(5);
    });

    it('mixed operators', () => {
      expect(evaluateFormula('2 + 3 * 4 - 6 / 2', {})).toBe(11);
    });
  });

  describe('parentheses', () => {
    it('overrides precedence', () => {
      expect(evaluateFormula('(2 + 3) * 4', {})).toBe(20);
    });

    it('nested parentheses', () => {
      expect(evaluateFormula('((2 + 3) * (4 - 1))', {})).toBe(15);
    });

    it('deeply nested', () => {
      expect(evaluateFormula('(((10)))', {})).toBe(10);
    });

    it('throws on unclosed parenthesis', () => {
      expect(() => evaluateFormula('(2 + 3', {})).toThrow('Expected closing parenthesis');
    });

    it('throws on extra closing parenthesis', () => {
      expect(() => evaluateFormula('2 + 3)', {})).toThrow('Unexpected character');
    });
  });

  describe('unary operators', () => {
    it('evaluates unary minus', () => {
      expect(evaluateFormula('-5', {})).toBe(-5);
    });

    it('evaluates unary plus', () => {
      expect(evaluateFormula('+5', {})).toBe(5);
    });

    it('double negative', () => {
      expect(evaluateFormula('--5', {})).toBe(5);
    });

    it('negative in expression', () => {
      expect(evaluateFormula('10 + -3', {})).toBe(7);
    });
  });

  describe('variables', () => {
    it('resolves a variable', () => {
      expect(evaluateFormula('x', { x: 10 })).toBe(10);
    });

    it('uses variable in expression', () => {
      expect(evaluateFormula('x * 2 + y', { x: 5, y: 3 })).toBe(13);
    });

    it('throws on unknown variable', () => {
      expect(() => evaluateFormula('unknown_var', {})).toThrow('Unknown variable "unknown_var"');
    });

    it('calls onVariable callback', () => {
      const used: string[] = [];
      evaluateFormula('x + y', { x: 1, y: 2 }, (key) => used.push(key));
      expect(used).toEqual(['x', 'y']);
    });

    it('handles underscore-prefixed variables', () => {
      expect(evaluateFormula('_val', { _val: 42 })).toBe(42);
    });

    it('handles variables with digits', () => {
      expect(evaluateFormula('var1 + var2', { var1: 10, var2: 20 })).toBe(30);
    });
  });

  describe('division by zero', () => {
    it('throws on direct division by zero', () => {
      expect(() => evaluateFormula('10 / 0', {})).toThrow('Division by zero');
    });

    it('throws on variable division by zero', () => {
      expect(() => evaluateFormula('10 / x', { x: 0 })).toThrow('Division by zero');
    });
  });

  describe('edge cases', () => {
    it('throws on empty string', () => {
      expect(() => evaluateFormula('', {})).toThrow('Enter a formula');
    });

    it('throws on whitespace-only', () => {
      expect(() => evaluateFormula('   ', {})).toThrow('Enter a formula');
    });

    it('throws on invalid characters', () => {
      expect(() => evaluateFormula('2 @ 3', {})).toThrow('Unexpected character');
    });

    it('throws on trailing operator', () => {
      expect(() => evaluateFormula('2 +', {})).toThrow();
    });

    it('handles whitespace around operators', () => {
      expect(evaluateFormula('  2  +  3  ', {})).toBe(5);
    });

    it('handles large numbers', () => {
      expect(evaluateFormula('1000000 * 1000000', {})).toBe(1e12);
    });

    it('handles very small decimals', () => {
      expect(evaluateFormula('0.001 + 0.002', {})).toBeCloseTo(0.003);
    });
  });

  describe('formula length limit', () => {
    it('throws when formula exceeds max length', () => {
      const longFormula = '1 + ' + '1 + '.repeat(FORMULA_MAX_LENGTH / 4) + '1';
      expect(() => evaluateFormula(longFormula, {})).toThrow('exceeds maximum length');
    });
  });

  describe('nesting depth limit', () => {
    it('throws when nesting exceeds max depth', () => {
      const open = '('.repeat(FORMULA_MAX_NESTING_DEPTH + 1);
      const close = ')'.repeat(FORMULA_MAX_NESTING_DEPTH + 1);
      const formula = `${open}1${close}`;
      expect(() => evaluateFormula(formula, {})).toThrow('exceeds maximum nesting depth');
    });

    it('allows nesting up to max depth', () => {
      const open = '('.repeat(FORMULA_MAX_NESTING_DEPTH);
      const close = ')'.repeat(FORMULA_MAX_NESTING_DEPTH);
      const formula = `${open}1${close}`;
      expect(evaluateFormula(formula, {})).toBe(1);
    });
  });
});

// ---------------------------------------------------------------------------
// normalizeTimeLiteral
// ---------------------------------------------------------------------------

describe('normalizeTimeLiteral', () => {
  it('normalizes 24-hour time', () => {
    expect(normalizeTimeLiteral('9:30')).toBe('09:30');
  });

  it('preserves seconds', () => {
    expect(normalizeTimeLiteral('14:30:45')).toBe('14:30:45');
  });

  it('handles midnight', () => {
    expect(normalizeTimeLiteral('0:00')).toBe('00:00');
  });

  it('converts 12-hour AM', () => {
    expect(normalizeTimeLiteral('9:30', 'AM')).toBe('09:30');
  });

  it('converts 12-hour PM', () => {
    expect(normalizeTimeLiteral('2:30', 'PM')).toBe('14:30');
  });

  it('converts 12 AM to 00', () => {
    expect(normalizeTimeLiteral('12:00', 'AM')).toBe('00:00');
  });

  it('converts 12 PM to 12', () => {
    expect(normalizeTimeLiteral('12:00', 'PM')).toBe('12:00');
  });

  it('throws on invalid format', () => {
    expect(() => normalizeTimeLiteral('abc')).toThrow('Invalid time literal');
  });

  it('throws on out-of-range hours', () => {
    expect(() => normalizeTimeLiteral('25:00')).toThrow('Invalid time literal');
  });

  it('throws on out-of-range minutes', () => {
    expect(() => normalizeTimeLiteral('12:60')).toThrow('Invalid time literal');
  });

  it('throws on invalid meridiem', () => {
    expect(() => normalizeTimeLiteral('9:00', 'XM')).toThrow('Invalid meridiem');
  });

  it('throws on invalid 12-hour value', () => {
    expect(() => normalizeTimeLiteral('0:00', 'AM')).toThrow('Invalid time literal');
  });
});

// ---------------------------------------------------------------------------
// validateDateLiteral
// ---------------------------------------------------------------------------

describe('validateDateLiteral', () => {
  it('accepts valid date', () => {
    expect(() => validateDateLiteral('2024-01-15')).not.toThrow();
  });

  it('throws on invalid format', () => {
    expect(() => validateDateLiteral('01-15-2024')).toThrow('Invalid date literal');
  });

  it('throws on invalid date', () => {
    expect(() => validateDateLiteral('2024-13-01')).toThrow('Invalid date literal');
  });
});

// ---------------------------------------------------------------------------
// validateDatetimeLiteral
// ---------------------------------------------------------------------------

describe('validateDatetimeLiteral', () => {
  it('accepts ISO datetime', () => {
    expect(() => validateDatetimeLiteral('2024-01-15T10:30:00Z')).not.toThrow();
  });

  it('throws on invalid datetime', () => {
    expect(() => validateDatetimeLiteral('not-a-date')).toThrow('Invalid datetime literal');
  });
});

// ---------------------------------------------------------------------------
// evaluatePriceRule — unconditional formulas
// ---------------------------------------------------------------------------

describe('evaluatePriceRule', () => {
  describe('unconditional formulas', () => {
    it('evaluates a simple constant formula', () => {
      const def = makeDefinition({ formula: '100' });
      const result = evaluatePriceRule(def, { bookingHours: 1 });
      expect(result.price).toBe(100);
      expect(result.branch).toBe('unconditional');
      expect(result.conditionsSatisfied).toBe(true);
    });

    it('evaluates a formula with booking_hours', () => {
      const def = makeDefinition({ formula: 'booking_hours * 50' });
      const result = evaluatePriceRule(def, { bookingHours: 3 });
      expect(result.price).toBe(150);
    });

    it('evaluates booking_days', () => {
      const def = makeDefinition({ formula: 'booking_days * 500' });
      const result = evaluatePriceRule(def, { bookingHours: 48 });
      expect(result.price).toBe(1000);
    });

    it('evaluates booking_weeks', () => {
      const def = makeDefinition({ formula: 'booking_weeks * 3000' });
      const result = evaluatePriceRule(def, { bookingHours: 168 });
      expect(result.price).toBe(3000);
    });

    it('evaluates booking_months', () => {
      const def = makeDefinition({ formula: 'booking_months * 10000' });
      const result = evaluatePriceRule(def, { bookingHours: 720 });
      expect(result.price).toBe(10000);
    });

    it('returns null for empty formula', () => {
      const def = makeDefinition({ formula: '' });
      const result = evaluatePriceRule(def, { bookingHours: 1 });
      expect(result.price).toBeNull();
    });

    it('returns null for whitespace formula', () => {
      const def = makeDefinition({ formula: '   ' });
      const result = evaluatePriceRule(def, { bookingHours: 1 });
      expect(result.price).toBeNull();
    });

    it('tracks used variables', () => {
      const def = makeDefinition({ formula: 'booking_hours * 50' });
      const result = evaluatePriceRule(def, { bookingHours: 1 });
      expect(result.usedVariables).toContain('booking_hours');
    });

    it('returns empty usedVariables for constant formula', () => {
      const def = makeDefinition({ formula: '100' });
      const result = evaluatePriceRule(def, { bookingHours: 1 });
      expect(result.usedVariables).toEqual([]);
    });
  });

  describe('conditional formulas (IF/ELSE)', () => {
    it('evaluates THEN branch when conditions match', () => {
      const def = makeDefinition({
        formula: 'booking_hours * 100 ELSE booking_hours * 50',
        conditions: [
          makeCondition({
            id: 'c1',
            comparator: '>',
            left: { kind: 'variable', key: 'booking_hours' },
            right: { kind: 'literal', value: '5', valueType: 'number' },
          }),
        ],
      });
      const result = evaluatePriceRule(def, { bookingHours: 10 });
      expect(result.price).toBe(1000);
      expect(result.branch).toBe('then');
      expect(result.conditionsSatisfied).toBe(true);
    });

    it('evaluates ELSE branch when conditions do not match', () => {
      const def = makeDefinition({
        formula: 'booking_hours * 100 ELSE booking_hours * 50',
        conditions: [
          makeCondition({
            id: 'c1',
            comparator: '>',
            left: { kind: 'variable', key: 'booking_hours' },
            right: { kind: 'literal', value: '5', valueType: 'number' },
          }),
        ],
      });
      const result = evaluatePriceRule(def, { bookingHours: 2 });
      expect(result.price).toBe(100);
      expect(result.branch).toBe('else');
      expect(result.conditionsSatisfied).toBe(false);
    });

    it('returns null when conditions match but no THEN expression', () => {
      const def = makeDefinition({
        formula: '',
        conditions: [
          makeCondition({
            id: 'c1',
            comparator: '=',
            left: { kind: 'variable', key: 'booking_hours' },
            right: { kind: 'literal', value: '1', valueType: 'number' },
          }),
        ],
      });
      const result = evaluatePriceRule(def, { bookingHours: 1 });
      expect(result.price).toBeNull();
    });

    it('returns no-match when conditions fail and no ELSE', () => {
      const def = makeDefinition({
        formula: 'booking_hours * 100',
        conditions: [
          makeCondition({
            id: 'c1',
            comparator: '=',
            left: { kind: 'variable', key: 'booking_hours' },
            right: { kind: 'literal', value: '999', valueType: 'number' },
          }),
        ],
      });
      const result = evaluatePriceRule(def, { bookingHours: 1 });
      expect(result.price).toBeNull();
      expect(result.branch).toBe('no-match');
    });
  });

  describe('condition operators', () => {
    const makeNumericConditionDef = (
      comparator: '<' | '<=' | '>' | '>=' | '=' | '!=',
      rightValue: string
    ): PriceRuleDefinition => makeDefinition({
      formula: '1 ELSE 0',
      conditions: [
        makeCondition({
          id: 'c1',
          comparator,
          left: { kind: 'variable', key: 'booking_hours' },
          right: { kind: 'literal', value: rightValue, valueType: 'number' },
        }),
      ],
    });

    it('< operator', () => {
      expect(evaluatePriceRule(makeNumericConditionDef('<', '5'), { bookingHours: 3 }).branch).toBe('then');
      expect(evaluatePriceRule(makeNumericConditionDef('<', '5'), { bookingHours: 5 }).branch).toBe('else');
      expect(evaluatePriceRule(makeNumericConditionDef('<', '5'), { bookingHours: 7 }).branch).toBe('else');
    });

    it('<= operator', () => {
      expect(evaluatePriceRule(makeNumericConditionDef('<=', '5'), { bookingHours: 3 }).branch).toBe('then');
      expect(evaluatePriceRule(makeNumericConditionDef('<=', '5'), { bookingHours: 5 }).branch).toBe('then');
      expect(evaluatePriceRule(makeNumericConditionDef('<=', '5'), { bookingHours: 7 }).branch).toBe('else');
    });

    it('> operator', () => {
      expect(evaluatePriceRule(makeNumericConditionDef('>', '5'), { bookingHours: 7 }).branch).toBe('then');
      expect(evaluatePriceRule(makeNumericConditionDef('>', '5'), { bookingHours: 5 }).branch).toBe('else');
    });

    it('>= operator', () => {
      expect(evaluatePriceRule(makeNumericConditionDef('>=', '5'), { bookingHours: 5 }).branch).toBe('then');
      expect(evaluatePriceRule(makeNumericConditionDef('>=', '5'), { bookingHours: 3 }).branch).toBe('else');
    });

    it('= operator', () => {
      expect(evaluatePriceRule(makeNumericConditionDef('=', '5'), { bookingHours: 5 }).branch).toBe('then');
      expect(evaluatePriceRule(makeNumericConditionDef('=', '5'), { bookingHours: 3 }).branch).toBe('else');
    });

    it('!= operator', () => {
      expect(evaluatePriceRule(makeNumericConditionDef('!=', '5'), { bookingHours: 3 }).branch).toBe('then');
      expect(evaluatePriceRule(makeNumericConditionDef('!=', '5'), { bookingHours: 5 }).branch).toBe('else');
    });
  });

  describe('condition connectors (AND / OR)', () => {
    it('AND: both true', () => {
      const def = makeDefinition({
        formula: '1 ELSE 0',
        conditions: [
          makeCondition({
            id: 'c1',
            comparator: '>',
            left: { kind: 'variable', key: 'booking_hours' },
            right: { kind: 'literal', value: '2', valueType: 'number' },
          }),
          makeCondition({
            id: 'c2',
            connector: 'and',
            comparator: '<',
            left: { kind: 'variable', key: 'booking_hours' },
            right: { kind: 'literal', value: '10', valueType: 'number' },
          }),
        ],
      });
      expect(evaluatePriceRule(def, { bookingHours: 5 }).branch).toBe('then');
    });

    it('AND: one false', () => {
      const def = makeDefinition({
        formula: '1 ELSE 0',
        conditions: [
          makeCondition({
            id: 'c1',
            comparator: '>',
            left: { kind: 'variable', key: 'booking_hours' },
            right: { kind: 'literal', value: '2', valueType: 'number' },
          }),
          makeCondition({
            id: 'c2',
            connector: 'and',
            comparator: '<',
            left: { kind: 'variable', key: 'booking_hours' },
            right: { kind: 'literal', value: '3', valueType: 'number' },
          }),
        ],
      });
      expect(evaluatePriceRule(def, { bookingHours: 5 }).branch).toBe('else');
    });

    it('OR: one true', () => {
      const def = makeDefinition({
        formula: '1 ELSE 0',
        conditions: [
          makeCondition({
            id: 'c1',
            comparator: '=',
            left: { kind: 'variable', key: 'booking_hours' },
            right: { kind: 'literal', value: '1', valueType: 'number' },
          }),
          makeCondition({
            id: 'c2',
            connector: 'or',
            comparator: '=',
            left: { kind: 'variable', key: 'booking_hours' },
            right: { kind: 'literal', value: '5', valueType: 'number' },
          }),
        ],
      });
      expect(evaluatePriceRule(def, { bookingHours: 5 }).branch).toBe('then');
    });

    it('OR: both false', () => {
      const def = makeDefinition({
        formula: '1 ELSE 0',
        conditions: [
          makeCondition({
            id: 'c1',
            comparator: '=',
            left: { kind: 'variable', key: 'booking_hours' },
            right: { kind: 'literal', value: '1', valueType: 'number' },
          }),
          makeCondition({
            id: 'c2',
            connector: 'or',
            comparator: '=',
            left: { kind: 'variable', key: 'booking_hours' },
            right: { kind: 'literal', value: '2', valueType: 'number' },
          }),
        ],
      });
      expect(evaluatePriceRule(def, { bookingHours: 5 }).branch).toBe('else');
    });
  });

  describe('condition negation', () => {
    it('negates a condition result', () => {
      const def = makeDefinition({
        formula: '1 ELSE 0',
        conditions: [
          makeCondition({
            id: 'c1',
            negated: true,
            comparator: '=',
            left: { kind: 'variable', key: 'booking_hours' },
            right: { kind: 'literal', value: '5', valueType: 'number' },
          }),
        ],
      });
      // booking_hours = 5 matches, but negated → false → ELSE
      expect(evaluatePriceRule(def, { bookingHours: 5 }).branch).toBe('else');
      // booking_hours = 3 doesn't match, negated → true → THEN
      expect(evaluatePriceRule(def, { bookingHours: 3 }).branch).toBe('then');
    });
  });

  describe('custom user-defined variables', () => {
    it('uses custom variable from overrides', () => {
      const def = makeDefinition({
        variables: [
          ...PRICE_RULE_INITIAL_VARIABLES,
          { key: 'guest_count', label: 'guest count', type: 'number', initialValue: '1' },
        ],
        formula: 'booking_hours * 50 * guest_count',
      });
      const result = evaluatePriceRule(def, {
        bookingHours: 2,
        variableOverrides: { guest_count: 3 },
      });
      expect(result.price).toBe(300);
      expect(result.usedVariables).toContain('guest_count');
      expect(result.usedVariables).toContain('booking_hours');
    });

    it('falls back to initialValue when no override', () => {
      const def = makeDefinition({
        variables: [
          ...PRICE_RULE_INITIAL_VARIABLES,
          { key: 'rate', label: 'rate', type: 'number', initialValue: '100' },
        ],
        formula: 'booking_hours * rate',
      });
      const result = evaluatePriceRule(def, { bookingHours: 3 });
      expect(result.price).toBe(300);
    });
  });

  describe('day_of_week variable', () => {
    it('correctly computes day of week (Monday=0)', () => {
      // 2024-01-15 is a Monday
      const monday = new Date('2024-01-15T12:00:00Z');
      const def = makeDefinition({
        formula: '1 ELSE 0',
        conditions: [
          makeCondition({
            id: 'c1',
            comparator: '=',
            left: { kind: 'variable', key: 'day_of_week' },
            right: { kind: 'literal', value: '0', valueType: 'number' },
          }),
        ],
      });
      const result = evaluatePriceRule(def, { bookingHours: 1, now: monday });
      expect(result.branch).toBe('then');
    });
  });

  describe('time-based conditions', () => {
    it('compares time literals', () => {
      const def = makeDefinition({
        formula: '1 ELSE 0',
        conditions: [
          makeCondition({
            id: 'c1',
            comparator: '>=',
            left: { kind: 'variable', key: 'time' },
            right: { kind: 'literal', value: '18:00', valueType: 'time' },
          }),
        ],
      });
      // 7 PM → should match >= 18:00
      const evening = new Date('2024-01-15T19:00:00');
      const result = evaluatePriceRule(def, { bookingHours: 1, now: evening });
      expect(result.branch).toBe('then');
    });
  });

  describe('conditions count limit', () => {
    it('throws when conditions exceed maximum', () => {
      const conditions: PriceRuleCondition[] = Array.from(
        { length: FORMULA_MAX_CONDITIONS + 1 },
        (_, i) => makeCondition({
          id: `c${i}`,
          connector: i > 0 ? 'and' : undefined,
          comparator: '=',
          left: { kind: 'variable', key: 'booking_hours' },
          right: { kind: 'literal', value: '1', valueType: 'number' },
        })
      );
      const def = makeDefinition({ formula: '1 ELSE 0', conditions });
      expect(() => evaluatePriceRule(def, { bookingHours: 1 })).toThrow(`exceeds maximum of ${FORMULA_MAX_CONDITIONS}`);
    });
  });

  describe('error handling', () => {
    it('returns null price for invalid formula via safe evaluation', () => {
      const def = makeDefinition({ formula: 'booking_hours / (booking_hours - booking_hours)' });
      const result = evaluatePriceRule(def, { bookingHours: 5 });
      expect(result.price).toBeNull();
    });

    it('returns null price for unknown variable in formula', () => {
      const def = makeDefinition({ formula: 'nonexistent_var * 10' });
      const result = evaluatePriceRule(def, { bookingHours: 1 });
      expect(result.price).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Zod validation
// ---------------------------------------------------------------------------

describe('priceRuleSchema', () => {

  it('accepts valid rule', () => {
    const result = priceRuleSchema.safeParse({
      name: 'Test Rule',
      description: 'A test',
      definition: {
        variables: PRICE_RULE_INITIAL_VARIABLES,
        conditions: [],
        formula: 'booking_hours * 50',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const result = priceRuleSchema.safeParse({
      name: '',
      definition: {
        variables: PRICE_RULE_INITIAL_VARIABLES,
        conditions: [],
        formula: '100',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects formula exceeding max length', () => {
    const result = priceRuleSchema.safeParse({
      name: 'Test',
      definition: {
        variables: PRICE_RULE_INITIAL_VARIABLES,
        conditions: [],
        formula: 'a'.repeat(FORMULA_MAX_LENGTH + 1),
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate variable keys', () => {
    const result = priceRuleSchema.safeParse({
      name: 'Test',
      definition: {
        variables: [
          ...PRICE_RULE_INITIAL_VARIABLES,
          { key: 'rate', label: 'Rate A', type: 'number' },
          { key: 'rate', label: 'Rate B', type: 'number' },
        ],
        conditions: [],
        formula: 'rate * 10',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects condition referencing unknown variable', () => {
    const result = priceRuleSchema.safeParse({
      name: 'Test',
      definition: {
        variables: PRICE_RULE_INITIAL_VARIABLES,
        conditions: [
          {
            id: '00000000-0000-0000-0000-000000000001',
            comparator: '=',
            left: { kind: 'variable', key: 'nonexistent' },
            right: { kind: 'literal', value: '1', valueType: 'number' },
          },
        ],
        formula: '100 ELSE 50',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects variable keys with invalid characters', () => {
    const result = priceRuleSchema.safeParse({
      name: 'Test',
      definition: {
        variables: [
          ...PRICE_RULE_INITIAL_VARIABLES,
          { key: 'invalid-key', label: 'Bad', type: 'number' },
        ],
        conditions: [],
        formula: '100',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects IF without matching ELSE', () => {
    const result = priceRuleSchema.safeParse({
      name: 'Test',
      definition: {
        variables: PRICE_RULE_INITIAL_VARIABLES,
        conditions: [],
        formula: 'IF booking_hours > 5',
      },
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeStartingPriceFromAreas
// ---------------------------------------------------------------------------

describe('computeStartingPriceFromAreas', () => {

  it('returns minimum price across areas', () => {
    const areas = [
      { price_rule: { definition: makeDefinition({ formula: '200' }) } },
      { price_rule: { definition: makeDefinition({ formula: '100' }) } },
      { price_rule: { definition: makeDefinition({ formula: '300' }) } },
    ];
    expect(computeStartingPriceFromAreas(areas)).toBe(100);
  });

  it('returns null when no areas', () => {
    expect(computeStartingPriceFromAreas([])).toBeNull();
  });

  it('returns null when no valid pricing rules', () => {
    const areas = [{ price_rule: null }];
    expect(computeStartingPriceFromAreas(areas)).toBeNull();
  });

  it('skips areas with invalid formulas', () => {
    const areas = [
      { price_rule: { definition: makeDefinition({ formula: 'invalid!!!' }) } },
      { price_rule: { definition: makeDefinition({ formula: '150' }) } },
    ];
    expect(computeStartingPriceFromAreas(areas)).toBe(150);
  });

  it('skips inactive pricing rules', () => {
    const areas = [
      { price_rule: { definition: makeDefinition({ formula: '50' }), is_active: false } },
      { price_rule: { definition: makeDefinition({ formula: '150' }) } },
    ];
    expect(computeStartingPriceFromAreas(areas)).toBe(150);
  });

  it('skips negative prices', () => {
    const areas = [
      { price_rule: { definition: makeDefinition({ formula: '-100' }) } },
      { price_rule: { definition: makeDefinition({ formula: '200' }) } },
    ];
    expect(computeStartingPriceFromAreas(areas)).toBe(200);
  });
});
