import { z } from 'zod';

export const PRICE_RULE_CONNECTORS = ['and', 'or'] as const;
export type PriceRuleConditionConnector = (typeof PRICE_RULE_CONNECTORS)[number];

export const PRICE_RULE_COMPARATORS = ['<', '<=', '>', '>=', '=', '!='] as const;
export type PriceRuleComparator = (typeof PRICE_RULE_COMPARATORS)[number];

export const PRICE_RULE_LITERAL_TYPES = ['text', 'number', 'datetime'] as const;
export type PriceRuleLiteralType = (typeof PRICE_RULE_LITERAL_TYPES)[number];

export type PriceRuleVariableType = 'text' | 'number';
export type PriceRuleConstantType = 'date' | 'time' | 'text' | 'number';

export type PriceRuleOperand =
  | { kind: 'variable'; key: string; }
  | { kind: 'constant'; key: string; }
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

export type PriceRuleConstant = {
  key: string;
  label: string;
  type: PriceRuleConstantType;
  special?: boolean;
  value?: string;
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
    kind: z.literal('constant'),
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

export const priceRuleDefinitionSchema = z.object({
  variables: z.array(
    z.object({
      key: z.string().min(1),
      label: z.string().min(1),
      type: z.enum(['text', 'number']),
      initialValue: z.string().optional(),
      userInput: z.boolean().optional(),
    })
  ),
  constants: z.array(
    z.object({
      key: z.string().min(1),
      label: z.string().min(1),
      type: z.enum(['date', 'time', 'text', 'number']),
      special: z.boolean().optional(),
      value: z.string().min(1).optional(),
    })
  ),
  conditions: z.array(priceRuleConditionSchema),
  formula: z.string().min(1, 'Add a formula to determine the price action.'),
}).superRefine((definition, ctx) => {
  definition.constants.forEach((constant, index) => {
    if (!constant.special && !constant.value) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Give each constant a value.',
        path: ['constants', index, 'value'],
      });
    }
  });
});

export const priceRuleSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  description: z.string().max(500).optional(),
  definition: priceRuleDefinitionSchema,
});

export type PriceRuleFormValues = z.infer<typeof priceRuleSchema>;

export const PRICE_RULE_SPECIAL_CONSTANTS: PriceRuleConstant[] = [
  {
    key: 'date',
    label: 'Current date',
    type: 'date',
    special: true,
  },
  {
    key: 'time',
    label: 'Current time',
    type: 'time',
    special: true,
  }
];

export const PRICE_RULE_INITIAL_VARIABLES: PriceRuleVariable[] = [
  {
    key: 'input_text',
    label: 'Input text',
    type: 'text',
    initialValue: '',
    userInput: false,
  },
  {
    key: 'booking_hours',
    label: 'Booking hours',
    type: 'number',
    initialValue: '1',
    userInput: false,
  }
];
