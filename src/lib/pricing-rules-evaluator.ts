import type {
  PriceRuleComparator,
  PriceRuleCondition,
  PriceRuleDefinition,
  PriceRuleOperand
} from '@/lib/pricing-rules';

const DATE_LITERAL_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_LITERAL_REGEX = /^\d{1,2}:\d{2}(?::\d{2})?$/;
const HOURS_IN_DAY = 24;
const HOURS_IN_WEEK = HOURS_IN_DAY * 7;
const HOURS_IN_MONTH = HOURS_IN_DAY * 30;

const padTwo = (value: number) => String(value).padStart(2, '0');

export function normalizeTimeLiteral(value: string, meridiem?: string) {
  const trimmed = value.trim();
  if (!TIME_LITERAL_REGEX.test(trimmed)) {
    throw new Error(`Invalid time literal "${value}". Expected HH:MM or HH:MM:SS.`);
  }

  const [hoursSegment, minutesSegment, secondsSegment] = trimmed.split(':');
  const hours = Number(hoursSegment);
  const minutes = Number(minutesSegment);
  const seconds = secondsSegment !== undefined ? Number(secondsSegment) : undefined;

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    throw new Error(`Invalid time literal "${value}".`);
  }

  if (minutes < 0 || minutes > 59) {
    throw new Error(`Invalid time literal "${value}".`);
  }

  if (seconds !== undefined && (Number.isNaN(seconds) || seconds < 0 || seconds > 59)) {
    throw new Error(`Invalid time literal "${value}".`);
  }

  let normalizedHours = hours;

  if (meridiem) {
    const normalizedMeridiem = meridiem.trim().toUpperCase();
    if (normalizedMeridiem !== 'AM' && normalizedMeridiem !== 'PM') {
      throw new Error(`Invalid meridiem "${meridiem}" in time literal.`);
    }
    if (normalizedHours < 1 || normalizedHours > 12) {
      throw new Error(`Invalid time literal "${value}" for 12-hour clock.`);
    }
    if (normalizedHours === 12) {
      normalizedHours = normalizedMeridiem === 'AM' ? 0 : 12;
    } else if (normalizedMeridiem === 'PM') {
      normalizedHours += 12;
    }
  } else if (normalizedHours < 0 || normalizedHours > 23) {
    throw new Error(`Invalid time literal "${value}".`);
  }

  const parts = [padTwo(normalizedHours), padTwo(minutes)];
  if (seconds !== undefined) {
    parts.push(padTwo(seconds));
  }
  return parts.join(':');
}

export function validateDateLiteral(value: string) {
  if (!DATE_LITERAL_REGEX.test(value)) {
    throw new Error(`Invalid date literal "${value}". Expected YYYY-MM-DD.`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date literal "${value}".`);
  }
}

export function validateDatetimeLiteral(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid datetime literal "${value}".`);
  }
}

type ComparableValue = number | string;
type OperandComparable = {
  value: ComparableValue;
  kind: 'number' | 'text';
};

export type FormulaVariableValueMap = Record<string, number>;

export type PriceRuleExecutionContext = {
  bookingHours: number;
  now?: Date;
  variableOverrides?: Record<string, number | string | Date>;
};

export type PriceRuleEvaluationResult = {
  price: number | null;
  branch: 'then' | 'else' | 'unconditional' | 'no-match';
  appliedExpression: string | null;
  conditionsSatisfied: boolean;
};

export function evaluatePriceRule(
  definition: PriceRuleDefinition,
  context: PriceRuleExecutionContext
): PriceRuleEvaluationResult {
  const trimmedFormula = definition.formula.trim();
  if (!trimmedFormula) {
    return {
      price: null,
      appliedExpression: null,
      branch: 'unconditional',
      conditionsSatisfied: false,
    };
  }

  const variableMap = buildExecutionVariableMap(definition, context);
  const numericVariableMap = buildNumericVariableMap(variableMap);
  const {
    thenExpression,
    elseExpression,
  } = splitFormulaExpressions(trimmedFormula);
  const hasConditions = definition.conditions.length > 0;

  if (!hasConditions) {
    if (!thenExpression) {
      return {
        price: null,
        appliedExpression: null,
        branch: 'unconditional',
        conditionsSatisfied: true,
      };
    }
    return {
      price: safeEvaluateExpression(thenExpression, numericVariableMap),
      appliedExpression: thenExpression,
      branch: 'unconditional',
      conditionsSatisfied: true,
    };
  }

  const conditionsMatch = evaluateConditionSequence(definition.conditions, variableMap, definition);

  if (conditionsMatch && thenExpression) {
    return {
      price: safeEvaluateExpression(thenExpression, numericVariableMap),
      appliedExpression: thenExpression,
      branch: 'then',
      conditionsSatisfied: true,
    };
  }

  if (!conditionsMatch && elseExpression) {
    return {
      price: safeEvaluateExpression(elseExpression, numericVariableMap),
      appliedExpression: elseExpression,
      branch: 'else',
      conditionsSatisfied: false,
    };
  }

  if (conditionsMatch) {
    return {
      price: null,
      appliedExpression: thenExpression || null,
      branch: 'then',
      conditionsSatisfied: true,
    };
  }

  return {
    price: null,
    appliedExpression: elseExpression || null,
    branch: 'no-match',
    conditionsSatisfied: false,
  };
}

const safeEvaluateExpression = (
  expression: string,
  variables: FormulaVariableValueMap
): number | null => {
  if (!expression.trim()) {
    return null;
  }
  try {
    const value = evaluateFormula(expression, variables);
    if (!Number.isFinite(value)) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
};

const splitFormulaExpressions = (formula: string) => {
  const trimmed = formula.trim();
  const lower = trimmed.toLowerCase();
  const elseMarker = ' else ';
  const elseIndex = lower.indexOf(elseMarker);

  if (elseIndex === -1) {
    return {
      thenExpression: trimmed,
      elseExpression: null,
    };
  }

  const thenExpression = trimmed.slice(0, elseIndex).trim();
  const elseExpression = trimmed
    .slice(elseIndex + elseMarker.length)
    .trim();

  return {
    thenExpression,
    elseExpression: elseExpression || null,
  };
};

const evaluateConditionSequence = (
  conditions: PriceRuleCondition[],
  variables: Record<string, ComparableValue>,
  definition: PriceRuleDefinition
): boolean => {
  if (!conditions.length) {
    return true;
  }

  let result = evaluateCondition(conditions[0], variables, definition);

  for (let i = 1; i < conditions.length; i += 1) {
    const condition = conditions[i];
    const nextValue = evaluateCondition(condition, variables, definition);
    const connector = condition.connector ?? 'and';
    if (connector === 'and') {
      result = result && nextValue;
    } else {
      result = result || nextValue;
    }
  }

  return result;
};

const evaluateCondition = (
  condition: PriceRuleCondition,
  variables: Record<string, ComparableValue>,
  definition: PriceRuleDefinition
) => {
  const left = resolveOperandValue(condition.left, variables, definition);
  const right = resolveOperandValue(condition.right, variables, definition);
  const matches = compareValues(left, right, condition.comparator);
  if (condition.negated) {
    return !matches;
  }
  return matches;
};

const resolveOperandValue = (
  operand: PriceRuleOperand,
  variables: Record<string, ComparableValue>,
  definition: PriceRuleDefinition
): OperandComparable => {
  if (operand.kind === 'literal') {
    const normalized = operand.value.trim();
    const matchingVariable = definition.variables.find((variable) => variable.key === normalized);
    if (matchingVariable) {
      return resolveOperandValue(
        {
          kind: 'variable',
          key: matchingVariable.key,
        },
        variables,
        definition
      );
    }
    const value = parseComparableValue(operand);
    const kind = operand.valueType === 'text' ? 'text' : 'number';
    return {
      value,
      kind,
    };
  }

  const variable = definition.variables.find((item) => item.key === operand.key);
  if (!variable) {
    throw new Error(`Unknown variable "${operand.key}".`);
  }

  const variableValue = variables[operand.key];
  if (variableValue === undefined) {
    throw new Error(`Value for "${operand.key}" is missing.`);
  }

  if (variable.type === 'text') {
    return {
      value: String(variableValue),
      kind: 'text',
    };
  }

  const numericValue = Number(variableValue);
  if (!Number.isFinite(numericValue)) {
    throw new Error(`Variable "${operand.key}" does not have a numeric value.`);
  }
  return {
    value: numericValue,
    kind: 'number',
  };
};

const compareValues = (
  left: OperandComparable,
  right: OperandComparable,
  comparator: PriceRuleComparator
) => {
  const leftIsNumber = left.kind === 'number';
  const rightIsNumber = right.kind === 'number';

  if (leftIsNumber && rightIsNumber) {
    const leftValue = Number(left.value);
    const rightValue = Number(right.value);
    switch (comparator) {
      case '<':
        return leftValue < rightValue;
      case '<=':
        return leftValue <= rightValue;
      case '>':
        return leftValue > rightValue;
      case '>=':
        return leftValue >= rightValue;
      case '=':
        return leftValue === rightValue;
      case '!=':
        return leftValue !== rightValue;
      default:
        return false;
    }
  }

  const leftText = String(left.value);
  const rightText = String(right.value);
  switch (comparator) {
    case '<':
      return leftText < rightText;
    case '<=':
      return leftText <= rightText;
    case '>':
      return leftText > rightText;
    case '>=':
      return leftText >= rightText;
    case '=':
      return leftText === rightText;
    case '!=':
      return leftText !== rightText;
    default:
      return false;
  }
};

const parseComparableValue = (
  literal: Extract<PriceRuleOperand, { kind: 'literal' }>
): ComparableValue => {
  const value = literal.value.trim();

  switch (literal.valueType) {
    case 'number': {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        throw new Error(`Invalid number literal "${value}".`);
      }
      return parsed;
    }
    case 'text':
      return value;
    case 'date': {
      if (!DATE_LITERAL_REGEX.test(value)) {
        throw new Error(`Invalid date literal "${value}". Expected YYYY-MM-DD.`);
      }
      const parsed = Date.parse(`${value}T00:00:00Z`);
      if (!Number.isFinite(parsed)) {
        throw new Error(`Invalid date literal "${value}".`);
      }
      return parsed;
    }
    case 'datetime': {
      const parsed = Date.parse(value);
      if (!Number.isFinite(parsed)) {
        throw new Error(`Invalid datetime literal "${value}".`);
      }
      return parsed;
    }
    case 'time': {
      const normalized = normalizeTimeLiteral(value);
      const [hours, minutes, seconds = '0'] = normalized.split(':');
      const numeric = Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
      if (!Number.isFinite(numeric)) {
        throw new Error(`Invalid time literal "${value}".`);
      }
      return numeric;
    }
    default:
      return value;
  }
};

const buildExecutionVariableMap = (
  definition: PriceRuleDefinition,
  context: PriceRuleExecutionContext
): Record<string, ComparableValue> => {
  const now = context.now ?? new Date();
  const overrides = context.variableOverrides ?? {};
  const map: Record<string, ComparableValue> = {};

  const bookingHours = Number.isFinite(context.bookingHours)
    ? context.bookingHours
    : 0;
  const bookingDays = bookingHours / HOURS_IN_DAY;
  const bookingWeeks = bookingHours / HOURS_IN_WEEK;
  const bookingMonths = bookingHours / HOURS_IN_MONTH;

  const defaultDate = startOfUtcDay(now).getTime();
  const defaultTime = secondsIntoDay(now);
  const defaultDayOfWeek = ((now.getDay() + 6) % 7);

  definition.variables.forEach((variable) => {
    const override = overrides[variable.key];

    if (variable.key === 'booking_hours') {
      map[variable.key] = bookingHours;
      return;
    }

    if (variable.key === 'booking_days') {
      map[variable.key] = bookingDays;
      return;
    }

    if (variable.key === 'booking_weeks') {
      map[variable.key] = bookingWeeks;
      return;
    }

    if (variable.key === 'booking_months') {
      map[variable.key] = bookingMonths;
      return;
    }

    if (variable.type === 'text') {
      map[variable.key] = typeof override === 'string'
        ? override
        : variable.initialValue ?? '';
      return;
    }

    if (variable.type === 'date') {
      map[variable.key] = parseDateOverride(override ?? variable.initialValue, now, defaultDate);
      return;
    }

    if (variable.type === 'time') {
      map[variable.key] = parseTimeOverride(override ?? variable.initialValue, now, defaultTime);
      return;
    }

    const fallback = variable.key === 'day_of_week'
      ? defaultDayOfWeek
      : parseNumeric(variable.initialValue, 0);
    map[variable.key] = parseNumberOverride(override, fallback);
  });

  return map;
};

const buildNumericVariableMap = (
  variables: Record<string, ComparableValue>
): FormulaVariableValueMap => {
  const numeric: FormulaVariableValueMap = {};
  for (const [key, value] of Object.entries(variables)) {
    if (typeof value === 'number') {
      numeric[key] = value;
    }
  }
  return numeric;
};

const parseNumeric = (value: string | number | undefined, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const parseNumberOverride = (
  override: string | number | Date | undefined,
  fallback: number
) => {
  if (typeof override === 'number' && Number.isFinite(override)) {
    return override;
  }
  if (typeof override === 'string') {
    const parsed = Number(override);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const parseDateOverride = (
  value: string | number | Date | undefined,
  now: Date,
  fallback: number
) => {
  if (value instanceof Date) {
    return startOfUtcDay(value).getTime();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    if (DATE_LITERAL_REGEX.test(value)) {
      const parsed = Date.parse(`${value}T00:00:00Z`);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return startOfUtcDay(new Date(parsed)).getTime();
    }
  }
  return fallback;
};

const parseTimeOverride = (
  value: string | number | Date | undefined,
  now: Date,
  fallback: number
) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (value instanceof Date) {
    return secondsIntoDay(value);
  }
  if (typeof value === 'string') {
    try {
      const normalized = normalizeTimeLiteral(value);
      const [hours, minutes, seconds = '0'] = normalized.split(':');
      return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
    } catch {
      //
    }
  }
  return fallback;
};

const startOfUtcDay = (value: Date) => {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
};

const secondsIntoDay = (value: Date) => {
  return value.getHours() * 3600 + value.getMinutes() * 60 + value.getSeconds();
};

type ParserState = {
  expression: string;
  length: number;
  pos: number;
  variables: FormulaVariableValueMap;
  onVariable?: (key: string) => void;
};

const skipWhitespace = (state: ParserState) => {
  while (state.pos < state.length && /\s/.test(state.expression[state.pos])) {
    state.pos += 1;
  }
};

const peekChar = (state: ParserState) => state.expression[state.pos];

export function evaluateFormula(
  expression: string,
  variables: FormulaVariableValueMap,
  onVariable?: (key: string) => void
): number {
  if (!expression.trim()) {
    throw new Error('Enter a formula before validating.');
  }

  const state: ParserState = {
    expression,
    length: expression.length,
    pos: 0,
    variables,
    onVariable,
  };

  const result = parseExpression(state);
  skipWhitespace(state);

  if (state.pos < state.length) {
    throw new Error(`Unexpected character "${state.expression[state.pos]}".`);
  }

  if (!Number.isFinite(result)) {
    throw new Error('Expression evaluates to an invalid number.');
  }

  return result;
}

function parseExpression(state: ParserState): number {
  let value = parseTerm(state);
  while (true) {
    skipWhitespace(state);
    const char = peekChar(state);
    if (char === '+' || char === '-') {
      state.pos += 1;
      const nextValue = parseTerm(state);
      value = char === '+' ? value + nextValue : value - nextValue;
      continue;
    }
    break;
  }
  return value;
}

function parseTerm(state: ParserState): number {
  let value = parseFactor(state);
  while (true) {
    skipWhitespace(state);
    const char = peekChar(state);
    if (char === '*' || char === '/') {
      state.pos += 1;
      const nextValue = parseFactor(state);
      if (char === '/' && nextValue === 0) {
        throw new Error('Division by zero.');
      }
      value = char === '*' ? value * nextValue : value / nextValue;
      continue;
    }
    break;
  }
  return value;
}

function parseFactor(state: ParserState): number {
  skipWhitespace(state);
  const char = peekChar(state);

  if (!char) {
    throw new Error('Unexpected end of expression.');
  }

  if (char === '+' || char === '-') {
    state.pos += 1;
    const nextValue = parseFactor(state);
    return char === '-' ? -nextValue : nextValue;
  }

  if (char === '(') {
    state.pos += 1;
    const value = parseExpression(state);
    skipWhitespace(state);
    if (peekChar(state) !== ')') {
      throw new Error('Expected closing parenthesis.');
    }
    state.pos += 1;
    return value;
  }

  if (isDigit(char) || char === '.') {
    return parseNumber(state);
  }

  if (isVariableStart(char)) {
    return parseVariable(state);
  }

  throw new Error(`Unexpected character "${char}".`);
}

function parseNumber(state: ParserState): number {
  const start = state.pos;
  while (isDigit(peekChar(state))) {
    state.pos += 1;
  }

  if (peekChar(state) === '.') {
    state.pos += 1;
    while (isDigit(peekChar(state))) {
      state.pos += 1;
    }
  }

  const raw = state.expression.slice(start, state.pos);
  if (!raw || raw === '.') {
    throw new Error('Invalid number literal.');
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number "${raw}".`);
  }

  return parsed;
}

const isDigit = (char?: string) => typeof char === 'string' && char >= '0' && char <= '9';
const isLetter = (char?: string) => typeof char === 'string' && (
  (char >= 'a' && char <= 'z')
  || (char >= 'A' && char <= 'Z')
);
const isVariableStart = (char?: string) => char === '_' || isLetter(char);
const isVariablePart = (char?: string) => isVariableStart(char) || isDigit(char);

function parseVariable(state: ParserState): number {
  const start = state.pos;
  state.pos += 1;
  while (isVariablePart(peekChar(state))) {
    state.pos += 1;
  }
  const key = state.expression.slice(start, state.pos);
  if (!Object.prototype.hasOwnProperty.call(state.variables, key)) {
    throw new Error(`Unknown variable "${key}".`);
  }
  state.onVariable?.(key);
  return state.variables[key];
}
