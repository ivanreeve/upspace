import { z } from 'zod';

import { FORMULA_MAX_LENGTH, FORMULA_MAX_CONDITIONS } from '@/lib/pricing-rules-evaluator';

export const PRICE_RULE_CONNECTORS = ['and', 'or'] as const;
export type PriceRuleConditionConnector = (typeof PRICE_RULE_CONNECTORS)[number];

export const PRICE_RULE_COMPARATORS = ['<', '<=', '>', '>=', '=', '!='] as const;
export type PriceRuleComparator = (typeof PRICE_RULE_COMPARATORS)[number];

export const PRICE_RULE_LITERAL_TYPES = ['text', 'number', 'datetime', 'date', 'time'] as const;
export type PriceRuleLiteralType = (typeof PRICE_RULE_LITERAL_TYPES)[number];

export type PriceRuleVariableType = 'text' | 'number' | 'date' | 'time';

export type PriceRuleOperand =
  | { kind: 'variable'; key: string; }
  | { kind: 'literal'; value: string; valueType: PriceRuleLiteralType; };

export type PriceRuleCondition = {
  id: string;
  connector?: PriceRuleConditionConnector;
  negated?: boolean;
  comparator: PriceRuleComparator;
  left: PriceRuleOperand;
  right: PriceRuleOperand;
};

export type PriceRuleVariable = {
  key: string;
  label: string;
  type: PriceRuleVariableType;
  initialValue?: string;
  userInput?: boolean;
};

export type PriceRuleDefinition = {
  variables: PriceRuleVariable[];
  conditions: PriceRuleCondition[];
  formula: string;
};

export type PriceRuleRecord = {
  id: string;
  name: string;
  description: string | null;
  definition: PriceRuleDefinition;
  is_active: boolean;
  linked_area_count: number;
  created_at: string;
  updated_at: string | null;
};

const priceRuleLiteralTypeSchema = z.enum(PRICE_RULE_LITERAL_TYPES);
const priceRuleComparatorSchema = z.enum(PRICE_RULE_COMPARATORS);

export const priceRuleOperandSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('variable'),
    key: z.string().min(1),
  }),
  z.object({
    kind: z.literal('literal'),
    value: z.string().min(1),
    valueType: priceRuleLiteralTypeSchema,
  })
]);

export const priceRuleConditionSchema = z.object({
  id: z.string().uuid(),
  connector: z.enum(PRICE_RULE_CONNECTORS).optional(),
  negated: z.boolean().optional(),
  comparator: priceRuleComparatorSchema,
  left: priceRuleOperandSchema,
  right: priceRuleOperandSchema,
});

const VARIABLE_KEY_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export const priceRuleDefinitionSchema = z.object({
  variables: z.array(
    z.object({
      key: z.string().min(1).regex(VARIABLE_KEY_REGEX, 'Variable key must contain only letters, numbers, and underscores, and start with a letter or underscore.'),
      label: z.string().min(1),
      type: z.enum(['text', 'number', 'date', 'time']),
      initialValue: z.string().optional(),
      userInput: z.boolean().optional(),
    })
  ),
  conditions: z.array(priceRuleConditionSchema).max(FORMULA_MAX_CONDITIONS, `A rule can have at most ${FORMULA_MAX_CONDITIONS} conditions.`),
  formula: z.string()
    .min(1, 'Add a formula to determine the price action.')
    .max(FORMULA_MAX_LENGTH, `Formula must not exceed ${FORMULA_MAX_LENGTH} characters.`),
});

export const priceRuleSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  description: z.string().max(500).optional(),
  definition: priceRuleDefinitionSchema,
}).superRefine((value, ctx) => {
  // Validate IF/ELSE structure
  const formula = value.definition.formula.trim();
  if (formula) {
    const hasIfClause = /\bif\b/i.test(formula);
    if (hasIfClause) {
      const elseMatches = formula.toLowerCase().match(/\belse\b/g) ?? [];
      if (elseMatches.length !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Conditions that use IF statements must include exactly one ELSE clause.',
          path: ['definition', 'formula'],
        });
      }
    }
  }

  // Validate no duplicate variable keys
  const declaredKeys = new Set<string>();
  for (const variable of value.definition.variables) {
    if (declaredKeys.has(variable.key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate variable key "${variable.key}".`,
        path: ['definition', 'variables'],
      });
    }
    declaredKeys.add(variable.key);
  }

  // Validate condition operand variable references exist
  for (let i = 0; i < value.definition.conditions.length; i++) {
    const condition = value.definition.conditions[i];
    for (const side of ['left', 'right'] as const) {
      const operand = condition[side];
      if (operand.kind === 'variable' && !declaredKeys.has(operand.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Condition references unknown variable "${operand.key}".`,
          path: ['definition', 'conditions', i, side, 'key'],
        });
      }
    }
  }
});

export type PriceRuleFormValues = z.infer<typeof priceRuleSchema>;

export const BOOKING_DURATION_VARIABLE_KEYS = [
  'booking_hours',
  'booking_days',
  'booking_weeks',
  'booking_months'
] as const;

export const FORMULA_ALLOWED_BUILTIN_KEYS = [
  ...BOOKING_DURATION_VARIABLE_KEYS,
  'guest_count'
] as const;

export const BOOKING_DURATION_VARIABLE_REFERENCE_TEXT =
  'booking_hours, booking_days, booking_weeks, booking_months, or guest_count';

export const PRICE_RULE_INITIAL_VARIABLES: PriceRuleVariable[] = [
  {
    key: 'booking_hours',
    label: 'booking hours',
    type: 'number',
    initialValue: '1',
    userInput: false,
  },
  {
    key: 'booking_days',
    label: 'booking days',
    type: 'number',
    initialValue: '0',
    userInput: false,
  },
  {
    key: 'booking_weeks',
    label: 'booking weeks',
    type: 'number',
    initialValue: '0',
    userInput: false,
  },
  {
    key: 'booking_months',
    label: 'booking months',
    type: 'number',
    initialValue: '0',
    userInput: false,
  },
  {
    key: 'date',
    label: 'current date',
    type: 'date',
    userInput: false,
  },
  {
    key: 'time',
    label: 'current time',
    type: 'time',
    userInput: false,
  },
  {
    key: 'day_of_week',
    label: 'day of week',
    type: 'number',
    userInput: false,
  },
  {
    key: 'guest_count',
    label: 'guest count',
    type: 'number',
    initialValue: '1',
    userInput: false,
  }
];
