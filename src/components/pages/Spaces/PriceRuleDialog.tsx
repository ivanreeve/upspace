'use client';

import {
  ChangeEvent,
  Dispatch,
  KeyboardEvent,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { CgSpinner } from 'react-icons/cg';
import {
  FiCalendar,
  FiChevronDown,
  FiClock,
  FiHash,
  FiPlus,
  FiType,
  FiTrash2
} from 'react-icons/fi';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  PRICE_RULE_COMPARATORS,
  PRICE_RULE_CONNECTORS,
  PRICE_RULE_INITIAL_VARIABLES,
  PriceRuleCondition,
  PriceRuleConditionConnector,
  PriceRuleComparator,
  PriceRuleDefinition,
  PriceRuleFormValues,
  PriceRuleLiteralType,
  PriceRuleOperand,
  PriceRuleVariableType,
  priceRuleSchema
} from '@/lib/pricing-rules';

const ensureUniqueKey = (desired: string, existing: string[]) => {
  const normalized = desired
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)+/g, '') || 'custom';

  if (!existing.includes(normalized)) {
    return normalized;
  }

  let suffixIndex = 1;
  while (true) {
    const candidate = `${normalized}_${suffixIndex}`;
    if (!existing.includes(candidate)) {
      return candidate;
    }
    suffixIndex += 1;
  }
};

const randomId = () => globalThis?.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

const RESERVED_VARIABLE_KEYS = PRICE_RULE_INITIAL_VARIABLES.map((variable) => variable.key);

const normalizeVariableName = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }
  return trimmed
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '_');
};

const KEYWORD_NORMALIZATION_REGEX = /\b(if|then|else|and|or|not)\b/gi;
const normalizeConditionKeywords = (value: string) =>
  value.replace(KEYWORD_NORMALIZATION_REGEX, (match) => match.toUpperCase());
const normalizeConditionSegment = (value: string) => normalizeConditionKeywords(value).trim().toLowerCase();

const formatDateForInput = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

type DatePickerInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

function DatePickerInput({
  value,
  onChange,
  disabled,
}: DatePickerInputProps) {
  const selectedDate = value ? new Date(value) : undefined;
  const label = selectedDate
    ? selectedDate.toLocaleDateString()
    : 'Pick a date';

  return (
    <Popover modal={ false }>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between font-normal tracking-tight"
          disabled={ disabled }
          type="button"
          aria-label={ selectedDate ? `Selected date ${label}` : 'Select date' }
        >
          <span className="flex items-center gap-2 text-sm">
            <FiCalendar className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className={ selectedDate ? '' : 'text-muted-foreground' }>{ label }</span>
          </span>
          <FiChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={ selectedDate }
          onSelect={ (date) => {
            if (date) {
              onChange(formatDateForInput(date));
            }
          } }
          defaultMonth={ selectedDate ?? undefined }
        />
      </PopoverContent>
    </Popover>
  );
}

type DataType = 'text' | 'number' | 'date' | 'time';
type TypeIconProps = {
  type: DataType;
};

const TypeIcon = (props: TypeIconProps) => {
  const type = props.type;
  if (type === 'number') {
    return <FiHash className="size-4" aria-hidden="true" />;
  }
  if (type === 'date') {
    return <FiCalendar className="size-4" aria-hidden="true" />;
  }
  if (type === 'time') {
    return <FiClock className="size-4" aria-hidden="true" />;
  }
  return <FiType className="size-4" aria-hidden="true" />;
};

type VariableValueMap = Record<string, number>;

type ParserState = {
  expression: string;
  length: number;
  pos: number;
  variables: VariableValueMap;
  onVariable?: (key: string) => void;
};

const isDigit = (char?: string) => typeof char === 'string' && char >= '0' && char <= '9';
const isLetter = (char?: string) => typeof char === 'string' && (
  (char >= 'a' && char <= 'z')
  || (char >= 'A' && char <= 'Z')
);
const isVariableStart = (char?: string) => char === '_' || isLetter(char);
const isVariablePart = (char?: string) => isVariableStart(char) || isDigit(char);

const skipWhitespace = (state: ParserState) => {
  while (state.pos < state.length && /\s/.test(state.expression[state.pos])) {
    state.pos += 1;
  }
};

const peekChar = (state: ParserState) => state.expression[state.pos];

function evaluateFormula(
  expression: string,
  variables: VariableValueMap,
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

const createVariableValueMap = (definition: PriceRuleDefinition): VariableValueMap => {
  const map: VariableValueMap = {};
  definition.variables.forEach((variable) => {
    map[variable.key] = 0;
  });
  return map;
};

const validatePriceExpression = (
  expression: string,
  label: 'THEN' | 'ELSE',
  variableMap: VariableValueMap,
  definition: PriceRuleDefinition
) => {
  const trimmed = expression.trim();
  if (!trimmed) {
    throw new Error(`${label} expression is required.`);
  }
  const isLiteral = SIMPLE_NUMBER_REGEX.test(trimmed);
  if (!isLiteral && /[<>=!]/.test(trimmed)) {
    throw new Error(`${label} expression can only use arithmetic operators and variables.`);
  }
  try {
    const usedVariables = new Set<string>();
    evaluateFormula(trimmed, variableMap, (key) => {
      usedVariables.add(key);
    });
    const allowedVariables = new Set<string>(['booking_hours']);
    definition.variables.forEach((variable) => {
      if (!RESERVED_VARIABLE_KEYS.includes(variable.key) && variable.type === 'number') {
        allowedVariables.add(variable.key);
      }
    });
    usedVariables.forEach((key) => {
      if (!allowedVariables.has(key)) {
        throw new Error(
          `${label} expression can only reference booking_hours or number variables you’ve added.`
        );
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid';
    throw new Error(`${label} expression is invalid. ${message}`);
  }
};

const isArithmeticOperand = (value: string, definition: PriceRuleDefinition) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  try {
    const variableMap = createVariableValueMap(definition);
    validatePriceExpression(trimmed, 'Operand', variableMap, definition);
    return true;
  } catch {
    return false;
  }
};

type ConditionSegment = {
  text: string;
  connector?: PriceRuleConditionConnector;
};

const isConnectorBoundary = (char?: string) => !char || /\s/.test(char);

const SPLIT_CONNECTORS = PRICE_RULE_CONNECTORS;

const COMPARATORS_IN_ORDER = [...PRICE_RULE_COMPARATORS].sort((a, b) => b.length - a.length);

const escapeSingleQuote = (value: string) => value.replace(/'/g, "\\'");

const formatOperandToken = (operand: PriceRuleOperand): string => {
  if (operand.kind === 'variable') {
    return operand.key;
  }

  const literalValue = operand.value || '';

  switch (operand.valueType) {
    case 'number':
      return literalValue;
    case 'date':
      return `date('${literalValue}')`;
    case 'time':
      return `time('${literalValue}')`;
    case 'datetime':
      return `datetime('${literalValue}')`;
    case 'text':
    default:
      return `'${escapeSingleQuote(literalValue)}'`;
  }
};

const serializeConditions = (conditions: PriceRuleCondition[]): string => {
  if (!conditions.length) {
    return '';
  }

    return conditions.reduce((expression, condition, index) => {
    const left = formatOperandToken(condition.left);
    const right = formatOperandToken(condition.right);
    const clause = `${condition.negated ? 'NOT ' : ''}${left} ${condition.comparator} ${right}`;

    if (index === 0) {
      return clause;
    }

    const connector = condition.connector ?? 'and';
    return `${expression} ${connector.toUpperCase()} ${clause}`;
  }, '');
};

const buildConditionExpressionFromDefinition = (definition: PriceRuleDefinition): string => {
  const conditionText = serializeConditions(definition.conditions).trim();
  const trimmedFormula = definition.formula.trim();

  if (!conditionText) {
    return trimmedFormula;
  }

  if (!trimmedFormula) {
    return conditionText;
  }

  const elseSeparator = ' ELSE ';
  const elseIndex = trimmedFormula.indexOf(elseSeparator);

  if (elseIndex === -1) {
    return `IF ${conditionText} THEN ${trimmedFormula}`;
  }

  const thenFormula = trimmedFormula.slice(0, elseIndex).trim();
  const elseFormula = trimmedFormula.slice(elseIndex + elseSeparator.length).trim();

  if (!thenFormula) {
    return `IF ${conditionText} THEN ${trimmedFormula}`;
  }

  if (!elseFormula) {
    return `IF ${conditionText} THEN ${thenFormula}`;
  }

  return `IF ${conditionText} THEN ${thenFormula} ELSE ${elseFormula}`;
};

const findConnectorSegments = (expression: string): ConditionSegment[] => {
  const segments: ConditionSegment[] = [];
  let lastConnector: PriceRuleConditionConnector | undefined;
  let cursor = 0;
  let bufferStart = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  const commitSegment = (end: number, hasTrailingContent: boolean) => {
    const raw = expression.slice(bufferStart, end).trim();

    if (!raw) {
      if (end > bufferStart) {
        if (!segments.length) {
          throw new Error('Condition expected before connector.');
        }
        throw new Error('Condition expected after connector.');
      }
      bufferStart = end;
      return;
    }

    segments.push({
      text: raw,
      connector: segments.length === 0 ? undefined : lastConnector,
    });
    lastConnector = undefined;
    bufferStart = end;
  };

  while (cursor < expression.length) {
    const char = expression[cursor];

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      for (const keyword of SPLIT_CONNECTORS) {
        const end = cursor + keyword.length;
        const fragment = expression.slice(cursor, end);
        if (fragment.toLowerCase() !== keyword) {
          continue;
        }

        const before = cursor === 0 ? undefined : expression[cursor - 1];
        const after = expression[end];
        if (!isConnectorBoundary(before) || !isConnectorBoundary(after)) {
          continue;
        }

        commitSegment(cursor, true);
        lastConnector = keyword;
        bufferStart = cursor + keyword.length;
        cursor = end - 1;
        break;
      }
    }

    cursor += 1;
  }

  commitSegment(expression.length, false);

  if (lastConnector) {
    throw new Error('Condition expected after connector.');
  }
  return segments;
};

const parseOperandReference = (token: string, definition: PriceRuleDefinition): PriceRuleOperand => {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error('Each comparison requires two operands.');
  }

  const numericMatch = trimmed.match(/^[+-]?\d+(?:\.\d+)?$/);
  if (numericMatch) {
    return {
      kind: 'literal',
      value: numericMatch[0],
      valueType: 'number',
    };
  }

  const textMatch = trimmed.match(/^'(.*)'$|^"(.*)"$/s);
  if (textMatch) {
    const value = textMatch[1] ?? textMatch[2] ?? '';
    return {
      kind: 'literal',
      value,
      valueType: 'text',
    };
  }

  const functionMatch = trimmed.match(/^([a-z_]+)\(([\s\S]*)\)$/i);
  if (functionMatch) {
    const [, functionName, rawArguments] = functionMatch;
    const normalized = functionName.toLowerCase();
    const args = parseFunctionArguments(rawArguments);

    if (normalized === 'date') {
      if (args.length !== 1) {
        throw new Error('date() expects a single argument.');
      }
      const value = args[0];
      validateDateLiteral(value);
      return {
        kind: 'literal',
        value,
        valueType: 'date',
      };
    }

    if (normalized === 'time') {
      if (args.length === 0 || args.length > 2) {
        throw new Error('time() expects one or two arguments.');
      }
      const [value, meridiem] = args;
      const normalizedValue = normalizeTimeLiteral(value, meridiem);
      return {
        kind: 'literal',
        value: normalizedValue,
        valueType: 'time',
      };
    }

    if (normalized === 'datetime') {
      if (args.length !== 1) {
        throw new Error('datetime() expects a single argument.');
      }
      const value = args[0];
      validateDatetimeLiteral(value);
      return {
        kind: 'literal',
        value,
        valueType: 'datetime',
      };
    }
  }

  if (isArithmeticOperand(trimmed, definition)) {
    return {
      kind: 'literal',
      value: trimmed,
      valueType: 'number',
    };
  }

  const variable = definition.variables.find((item) => item.key === trimmed);
  if (variable) {
    return {
      kind: 'variable',
      key: trimmed,
    };
  }
  throw new Error(`Unrecognized reference "${trimmed}".`);
};

const VARIABLE_LITERAL_COMPATIBILITY: Record<PriceRuleVariableType, PriceRuleLiteralType[]> = {
  number: ['number'],
  text: ['text'],
  date: ['date', 'datetime'],
  time: ['time'],
};

const VARIABLE_TYPE_LABELS: Record<PriceRuleVariableType, string> = {
  number: 'numeric value',
  text: 'text value',
  date: 'date value',
  time: 'time value',
};

const LITERAL_TYPE_LABELS: Record<PriceRuleLiteralType, string> = {
  number: 'numeric literal',
  text: 'text literal',
  date: 'date literal',
  time: 'time literal',
  datetime: 'datetime literal',
};

const getVariableType = (definition: PriceRuleDefinition, key: string): PriceRuleVariableType => {
  const variable = definition.variables.find((item) => item.key === key);
  if (!variable) {
    throw new Error(`Unknown variable "${key}".`);
  }
  return variable.type;
};

const ensureVariableMatchesLiteral = (
  variable: Extract<PriceRuleOperand, { kind: 'variable' }>,
  literal: Extract<PriceRuleOperand, { kind: 'literal' }>,
  definition: PriceRuleDefinition
) => {
  const variableType = getVariableType(definition, variable.key);
  const allowedLiteralTypes = VARIABLE_LITERAL_COMPATIBILITY[variableType];
  if (!allowedLiteralTypes.includes(literal.valueType)) {
    const variableLabel = VARIABLE_TYPE_LABELS[variableType];
    const literalLabel = LITERAL_TYPE_LABELS[literal.valueType];
    throw new Error(
      `${variable.key} expects a ${variableLabel} and cannot be compared to a ${literalLabel}.`
    );
  }
};

const ensureOperandTypesAreCompatible = (
  left: PriceRuleOperand,
  right: PriceRuleOperand,
  definition: PriceRuleDefinition
) => {
  if (left.kind === 'variable' && right.kind === 'literal') {
    ensureVariableMatchesLiteral(left, right, definition);
  } else if (right.kind === 'variable' && left.kind === 'literal') {
    ensureVariableMatchesLiteral(right, left, definition);
  } else if (left.kind === 'variable' && right.kind === 'variable') {
    const leftType = getVariableType(definition, left.key);
    const rightType = getVariableType(definition, right.key);
    if (leftType !== rightType) {
      const leftLabel = VARIABLE_TYPE_LABELS[leftType];
      const rightLabel = VARIABLE_TYPE_LABELS[rightType];
      throw new Error(
        `Cannot compare ${left.key} (${leftLabel}) with ${right.key} (${rightLabel}).`
      );
    }
  }
};

const DATE_LITERAL_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_LITERAL_REGEX = /^\d{1,2}:\d{2}(?::\d{2})?$/;

function parseFunctionArguments(input: string): string[] {
  if (!input.trim()) {
    return [];
  }

  return input
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const match = segment.match(/^(['"])([\s\S]*?)\1$/);
      if (!match) {
        throw new Error('Function arguments must be quoted text.');
      }
      return match[2];
    });
}

const padTwo = (value: number) => String(value).padStart(2, '0');

function normalizeTimeLiteral(value: string, meridiem?: string) {
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

function validateDateLiteral(value: string) {
  if (!DATE_LITERAL_REGEX.test(value)) {
    throw new Error(`Invalid date literal "${value}". Expected YYYY-MM-DD.`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date literal "${value}".`);
  }
}

function validateDatetimeLiteral(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid datetime literal "${value}".`);
  }
}

const parseConditionText = (text: string, definition: PriceRuleDefinition): Omit<PriceRuleCondition, 'id'> => {
  const normalized = text.trim();
  const lower = normalized.toLowerCase();
  const negated = lower.startsWith('not ');
  const cursor = negated ? normalized.slice(4).trim() : normalized;

  if (!cursor) {
    throw new Error('Condition is missing operands.');
  }

  let comparator: PriceRuleComparator | null = null;
  let comparatorIndex = -1;
  let comparatorLength = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < cursor.length; i += 1) {
    const char = cursor[i];
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    }

    if (inSingleQuote || inDoubleQuote) {
      continue;
    }

    for (const candidate of COMPARATORS_IN_ORDER) {
      if (cursor.slice(i, i + candidate.length) === candidate) {
        comparator = candidate;
        comparatorIndex = i;
        comparatorLength = candidate.length;
        break;
      }
    }

    if (comparator) {
      break;
    }
  }

  if (!comparator) {
    throw new Error('Condition must contain a comparator like ">" or "=".');
  }

  const leftToken = cursor.slice(0, comparatorIndex).trim();
  const rightToken = cursor.slice(comparatorIndex + comparatorLength).trim();

  if (!leftToken || !rightToken) {
    throw new Error('Both sides of the comparison must have a value.');
  }

  const leftOperand = parseOperandReference(leftToken, definition);
  const rightOperand = parseOperandReference(rightToken, definition);
  ensureOperandTypesAreCompatible(leftOperand, rightOperand, definition);

  return {
    comparator,
    negated,
    left: leftOperand,
    right: rightOperand,
  };
};

export const parseConditionExpression = (
  expression: string,
  definition: PriceRuleDefinition
): PriceRuleCondition[] => {
  const trimmed = expression.trim();
  if (!trimmed) {
    return [];
  }

  const segments = findConnectorSegments(expression);
  return segments.map((segment) => ({
    ...parseConditionText(segment.text, definition),
    id: randomId(),
    connector: segment.connector,
  }));
};

type ConstraintKind = 'numeric' | 'text';

type ConditionConstraint = {
  variableKey: string;
  comparator: PriceRuleComparator;
  kind: ConstraintKind;
  value: number | string;
};

type NumericRangeState = {
  kind: 'numeric';
  lower?: Bound;
  upper?: Bound;
  equalValue?: number;
  excludes: Set<number>;
};

type TextRangeState = {
  kind: 'text';
  equalValue?: string;
  excludes: Set<string>;
};

type RangeState = NumericRangeState | TextRangeState;

type Bound = {
  value: number;
  inclusive: boolean;
};

const SIMPLE_NUMBER_REGEX = /^[+-]?\d+(?:\.\d+)?$/;

const NEGATED_COMPARATORS: Record<PriceRuleComparator, PriceRuleComparator> = {
  '=': '!=',
  '!=': '=',
  '<': '>=',
  '<=': '>',
  '>': '<=',
  '>=': '<',
};

const FLIPPED_COMPARATORS: Record<PriceRuleComparator, PriceRuleComparator> = {
  '=': '=',
  '!=': '!=',
  '<': '>',
  '<=': '>=',
  '>': '<',
  '>=': '<=',
};

const detectConditionCollisions = (
  conditions: PriceRuleCondition[],
  definition: PriceRuleDefinition
): string | null => {
  const buildRangeState = (kind: ConstraintKind): RangeState => {
    if (kind === 'numeric') {
      return {
        kind,
        excludes: new Set<number>(),
      };
    }
    return {
      kind,
      excludes: new Set<string>(),
    };
  };

const describeConstraintId = (constraint: ConditionConstraint) => {
  const value = typeof constraint.value === 'number'
    ? constraint.value.toString()
    : constraint.value;
  return `${constraint.variableKey}|${constraint.comparator}|${value}`;
};

const flushGroup = (group: PriceRuleCondition[]): string | null => {
  if (group.length <= 1) {
    return null;
  }

  const stateMap = new Map<string, RangeState>();
  const seenConstraints = new Set<string>();

  for (const condition of group) {
    const constraint = buildConstraintFromCondition(condition, definition);
    if (!constraint) {
      continue;
    }

    const descriptor = describeConstraintId(constraint);
    if (seenConstraints.has(descriptor)) {
      return `Condition for "${constraint.variableKey}" already exists.`;
    }
    seenConstraints.add(descriptor);

    const state = stateMap.get(constraint.variableKey) ?? buildRangeState(constraint.kind);
    const conflict = applyRangeConstraint(state, constraint);
    if (conflict) {
      return conflict;
    }

    stateMap.set(constraint.variableKey, state);
  }

  return null;
  };

  let group: PriceRuleCondition[] = [];

  for (const condition of conditions) {
    if (condition.connector === 'or') {
      const conflict = flushGroup(group);
      if (conflict) {
        return conflict;
      }
      group = [condition];
      continue;
    }

    group.push(condition);
  }

  return flushGroup(group);
};

const buildConstraintFromCondition = (
  condition: PriceRuleCondition,
  definition: PriceRuleDefinition
): ConditionConstraint | null => {
  let comparator = condition.comparator;
  let left = condition.left;
  let right = condition.right;

  if (left.kind === 'literal' && right.kind === 'variable') {
    comparator = FLIPPED_COMPARATORS[comparator];
    [left, right] = [right, left];
  }

  if (left.kind !== 'variable' || right.kind !== 'literal') {
    return null;
  }

  const normalizedComparator = condition.negated
    ? NEGATED_COMPARATORS[comparator]
    : comparator;

  const variableType = getVariableType(definition, left.key);
  const kind: ConstraintKind = variableType === 'text' ? 'text' : 'numeric';
  const parsedValue = parseComparableValue(right, variableType);
  if (parsedValue === null) {
    return null;
  }

  return {
    variableKey: left.key,
    comparator: normalizedComparator,
    kind,
    value: parsedValue,
  };
};

const parseComparableValue = (
  literal: Extract<PriceRuleOperand, { kind: 'literal' }>,
  variableType: PriceRuleVariableType
): number | string | null => {
  const value = literal.value.trim();
  if (variableType === 'text') {
    if (literal.valueType !== 'text') {
      return null;
    }
    return value;
  }

  if (variableType === 'number') {
    if (!SIMPLE_NUMBER_REGEX.test(value)) {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (variableType === 'date' || variableType === 'datetime') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (variableType === 'time') {
    const segments = value.split(':');
    if (segments.length < 2 || segments.length > 3) {
      return null;
    }
    const parsedSegments = segments.map((segment) => Number(segment));
    if (parsedSegments.some((segment) => Number.isNaN(segment))) {
      return null;
    }
    const [hours, minutes, seconds = 0] = parsedSegments;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
      return null;
    }
    return hours * 3600 + minutes * 60 + seconds;
  }

  return null;
};

const applyRangeConstraint = (state: RangeState, constraint: ConditionConstraint): string | null => {
  if (constraint.kind === 'numeric') {
    if (typeof constraint.value !== 'number') {
      return null;
    }
    return applyNumericConstraint(state as NumericRangeState, constraint.comparator, constraint.value, constraint.variableKey);
  }
  if (constraint.kind === 'text') {
    if (typeof constraint.value !== 'string') {
      return null;
    }
    return applyTextConstraint(state as TextRangeState, constraint.comparator, constraint.value, constraint.variableKey);
  }
  return null;
};

const applyTextConstraint = (
  state: TextRangeState,
  comparator: PriceRuleComparator,
  value: string,
  variableKey: string
): string | null => {
  const message = `Conflicting conditions for "${variableKey}".`;
  if (comparator === '=') {
    if (state.equalValue !== undefined && state.equalValue !== value) {
      return message;
    }
    if (state.excludes.has(value)) {
      return message;
    }
    state.equalValue = value;
    return null;
  }

  if (comparator === '!=') {
    if (state.equalValue === value) {
      return message;
    }
    state.excludes.add(value);
  }
  return null;
};

const applyNumericConstraint = (
  state: NumericRangeState,
  comparator: PriceRuleComparator,
  value: number,
  variableKey: string
): string | null => {
  const message = `Conflicting conditions for "${variableKey}".`;

  const ensureEqualValueStillFits = () => {
    if (state.equalValue === undefined) {
      return true;
    }
    return valueWithinBounds(state.equalValue, state.lower, state.upper);
  };

  switch (comparator) {
    case '>': {
      const conflict = updateLowerBound(state, {
        value,
        inclusive: false,
      });
      if (conflict) {
        return message;
      }
      break;
    }
    case '>=': {
      const conflict = updateLowerBound(state, {
        value,
        inclusive: true,
      });
      if (conflict) {
        return message;
      }
      break;
    }
    case '<': {
      const conflict = updateUpperBound(state, {
        value,
        inclusive: false,
      });
      if (conflict) {
        return message;
      }
      break;
    }
    case '<=': {
      const conflict = updateUpperBound(state, {
        value,
        inclusive: true,
      });
      if (conflict) {
        return message;
      }
      break;
    }
    case '=': {
      if (state.excludes.has(value)) {
        return message;
      }
      if (!valueWithinBounds(value, state.lower, state.upper)) {
        return message;
      }
      state.equalValue = value;
      state.lower = {
        value,
        inclusive: true,
      };
      state.upper = {
        value,
        inclusive: true,
      };
      break;
    }
    case '!=':
      if (state.equalValue === value) {
        return message;
      }
      state.excludes.add(value);
      break;
    default:
      break;
  }

  if (!ensureEqualValueStillFits()) {
    return message;
  }

  return null;
};

const updateLowerBound = (
  state: NumericRangeState,
  bound: Bound
): boolean => {
  if (state.upper && isLowerAboveUpper(bound, state.upper)) {
    return true;
  }

  if (!state.lower || isMoreRestrictiveLower(bound, state.lower)) {
    state.lower = bound;
  }

  if (state.upper && isLowerAboveUpper(state.lower, state.upper)) {
    return true;
  }

  if (
    state.equalValue !== undefined
    && !valueWithinBounds(state.equalValue, state.lower, state.upper)
  ) {
    return true;
  }

  return false;
};

const updateUpperBound = (
  state: NumericRangeState,
  bound: Bound
): boolean => {
  if (state.lower && isLowerAboveUpper(state.lower, bound)) {
    return true;
  }

  if (!state.upper || isMoreRestrictiveUpper(bound, state.upper)) {
    state.upper = bound;
  }

  if (state.lower && isLowerAboveUpper(state.lower, state.upper)) {
    return true;
  }

  if (
    state.equalValue !== undefined
    && !valueWithinBounds(state.equalValue, state.lower, state.upper)
  ) {
    return true;
  }

  return false;
};

const valueWithinBounds = (value: number, lower?: Bound, upper?: Bound) => {
  if (lower) {
    if (value < lower.value || (value === lower.value && !lower.inclusive)) {
      return false;
    }
  }
  if (upper) {
    if (value > upper.value || (value === upper.value && !upper.inclusive)) {
      return false;
    }
  }
  return true;
};

const isLowerAboveUpper = (lower?: Bound, upper?: Bound) => {
  if (!lower || !upper) {
    return false;
  }
  if (lower.value > upper.value) {
    return true;
  }
  if (lower.value === upper.value && (!lower.inclusive || !upper.inclusive)) {
    return true;
  }
  return false;
};

const isMoreRestrictiveLower = (candidate: Bound, current: Bound) => (
  candidate.value > current.value
  || (candidate.value === current.value && !candidate.inclusive && current.inclusive)
);

const isMoreRestrictiveUpper = (candidate: Bound, current: Bound) => (
  candidate.value < current.value
  || (candidate.value === current.value && !candidate.inclusive && current.inclusive)
);

type ConditionFormulaSplit = {
  condition: string;
  formula: string;
  thenFormula: string;
  elseFormula: string;
};

const splitConditionAndFormula = (expression: string): ConditionFormulaSplit => {
  const trimmed = expression.trim();
  const lower = trimmed.toLowerCase();
  const thenSeparator = ' then ';
  const elseSeparator = ' else ';
  const thenIndex = lower.indexOf(thenSeparator);

  if (thenIndex === -1) {
    return {
      condition: trimmed,
      formula: '',
      thenFormula: '',
      elseFormula: '',
    };
  }

  let condition = trimmed.slice(0, thenIndex).trim();
  if (condition.toLowerCase().startsWith('if ')) {
    condition = condition.slice(3).trim();
  }

  let formulaSection = trimmed.slice(thenIndex + thenSeparator.length);
  const connectorPattern = /\s+(AND|OR)\s+/i;
  const connectorMatch = formulaSection.match(connectorPattern);
  if (connectorMatch && connectorMatch.index !== undefined) {
    formulaSection = formulaSection.slice(0, connectorMatch.index);
  }
  const elseIndex = formulaSection.toLowerCase().indexOf(elseSeparator);

  if (elseIndex === -1) {
    const thenFormula = formulaSection.trim();
    return {
      condition,
      formula: thenFormula,
      thenFormula,
      elseFormula: '',
    };
  }

  const thenFormula = formulaSection.slice(0, elseIndex).trim();
  const elseFormula = formulaSection
    .slice(elseIndex + elseSeparator.length)
    .trim();

  if (!elseFormula) {
    throw new Error('Add a price expression after ELSE.');
  }

  return {
    condition,
    formula: `${thenFormula} ELSE ${elseFormula}`.trim(),
    thenFormula,
    elseFormula,
  };
};

const splitExpressionSegments = (expression: string) => {
  const trimmed = expression.trim();
  if (!trimmed) {
    return [];
  }

  const segments: string[] = [];
  let cursor = 0;
  let bufferStart = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  const lower = trimmed.toLowerCase();

  const commitSegment = (end: number) => {
    const segment = trimmed.slice(bufferStart, end).trim();
    if (segment) {
      segments.push(segment);
    }
    bufferStart = end;
  };

  while (cursor < trimmed.length) {
    const char = trimmed[cursor];

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      for (const connector of SPLIT_CONNECTORS) {
        const end = cursor + connector.length;
        if (lower.slice(cursor, end) !== connector) {
          continue;
        }

        const before = cursor === 0 ? undefined : trimmed[cursor - 1];
        const after = trimmed[end];
        if (!isConnectorBoundary(before) || !isConnectorBoundary(after)) {
          continue;
        }

        let lookahead = end;
        while (lookahead < trimmed.length && /\s/.test(trimmed[lookahead])) {
          lookahead += 1;
        }

        const hasFollowingIf = lower.slice(lookahead, lookahead + 2) === 'if'
          && isConnectorBoundary(trimmed[lookahead + 2]);

        if (!hasFollowingIf) {
          continue;
        }

        commitSegment(cursor);
        bufferStart = lookahead;
        cursor = lookahead - 1;
        break;
      }
    }

    cursor += 1;
  }

  commitSegment(trimmed.length);
  return segments;
};

const getConditionTargetKey = (segment: string, definition: PriceRuleDefinition): string | null => {
  const trimmed = segment.trim();
  if (!trimmed) {
    return null;
  }
  if (!/^if\b/i.test(trimmed)) {
    return null;
  }
  try {
    const { condition, } = splitConditionAndFormula(trimmed);
    if (!condition.trim()) {
      return null;
    }
    const parsed = parseConditionExpression(condition, definition);
    if (!parsed.length) {
      return null;
    }

    const operandSignature = (operand: PriceRuleOperand) => {
      if (operand.kind === 'variable') {
        return `var:${operand.key.toLowerCase()}`;
      }
      const value = operand.value.trim();
      if (operand.valueType === 'number') {
        const numeric = Number(value);
        return Number.isNaN(numeric) ? `lit:number:${value}` : `lit:number:${numeric}`;
      }
      return `lit:${operand.valueType}:${value.toLowerCase()}`;
    };

    const clauseSignature = (conditionClause: PriceRuleCondition) => {
      const constraint = buildConstraintFromCondition(conditionClause, definition);
      if (constraint) {
        const value = typeof constraint.value === 'number'
          ? constraint.value
          : constraint.value.toString().toLowerCase();
        return `constraint:${constraint.variableKey.toLowerCase()}:${constraint.comparator}:${value}`;
      }
      const comparator = conditionClause.negated
        ? `!${conditionClause.comparator}`
        : conditionClause.comparator;
      return [
        operandSignature(conditionClause.left),
        comparator,
        operandSignature(conditionClause.right)
      ].join('|');
    };

    const connectors = parsed
      .slice(1)
      .map((item) => item.connector)
      .filter((connector): connector is PriceRuleConditionConnector => Boolean(connector));
    const uniqueConnectors = new Set(connectors);
    const connectorKey = connectors.length === 0
      ? 'single'
      : uniqueConnectors.size === 1
        ? connectors[0] ?? 'single'
        : 'mixed';

    const clauseSignatures = parsed.map((item) => clauseSignature(item));
    const canonicalClauses = connectorKey === 'mixed'
      ? clauseSignatures
      : [...clauseSignatures].sort();

    return `${connectorKey}:${canonicalClauses.join('|')}`;
  } catch {
    return null;
  }
};

const findDuplicateConditionTargetKey = (
  expression: string,
  definition: PriceRuleDefinition
): string | null => {
  const segments = splitExpressionSegments(expression);
  const seen = new Set<string>();

  for (const segment of segments) {
    const key = getConditionTargetKey(segment, definition);
    if (!key) {
      continue;
    }
    if (seen.has(key)) {
      return key;
    }
    seen.add(key);
  }

  return null;
};

const cloneDefinition = (definition: PriceRuleDefinition): PriceRuleDefinition => ({
  variables: definition.variables.map((variable) => ({ ...variable, })),
  conditions: definition.conditions.map((condition) => ({
    ...condition,
    left: { ...condition.left, },
    right: { ...condition.right, },
  })),
  formula: definition.formula,
});

const createDefaultRule = (): PriceRuleFormValues => ({
  name: '',
  description: '',
  definition: {
    variables: PRICE_RULE_INITIAL_VARIABLES.map((variable) => ({ ...variable, })),
    conditions: [],
    formula: '',
  },
});

export type PriceRuleFormState = {
  values: PriceRuleFormValues;
  setValues: Dispatch<SetStateAction<PriceRuleFormValues>>;
  errorMessage: string | null;
  setErrorMessage: Dispatch<SetStateAction<string | null>>;
  newVariableLabel: string;
  setNewVariableLabel: Dispatch<SetStateAction<string>>;
  newVariableType: 'text' | 'number' | 'date' | 'time';
  setNewVariableType: Dispatch<SetStateAction<'text' | 'number' | 'date' | 'time'>>;
  newVariableValue: string;
  setNewVariableValue: Dispatch<SetStateAction<string>>;
  newVariableUserInput: boolean;
  setNewVariableUserInput: Dispatch<SetStateAction<boolean>>;
  handleAddVariable: () => void;
  removeVariable: (key: string) => void;
  usedVariables: Set<string>;
  conditionExpression: string;
  conditionError: string | null;
  handleConditionExpressionChange: (value: string) => void;
  updateDefinition: (updater: (definition: PriceRuleDefinition) => PriceRuleDefinition) => void;
};

export function usePriceRuleFormState(
  initialValues?: PriceRuleFormValues,
  resetTrigger?: unknown
): PriceRuleFormState {
  const [values, setValues] = useState<PriceRuleFormValues>(createDefaultRule);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newVariableLabel, setNewVariableLabel] = useState('');
  const [newVariableType, setNewVariableType] = useState<'text' | 'number' | 'date' | 'time'>('text');
  const [newVariableValue, setNewVariableValue] = useState('');
  const [newVariableUserInput, setNewVariableUserInput] = useState(false);
  const [conditionExpression, setConditionExpression] = useState('');
  const [conditionError, setConditionError] = useState<string | null>(null);

  useEffect(() => {
    if (resetTrigger === false) {
      return;
    }

    if (initialValues) {
      const clonedDefinition = cloneDefinition(initialValues.definition);
      setValues({
        ...initialValues,
        definition: clonedDefinition,
      });
      setConditionExpression(buildConditionExpressionFromDefinition(clonedDefinition));
    } else {
      setValues(createDefaultRule());
      setConditionExpression('');
    }
    setErrorMessage(null);
    setNewVariableLabel('');
    setNewVariableType('text');
    setNewVariableValue('');
    setNewVariableUserInput(false);
    setConditionError(null);
  }, [initialValues, resetTrigger]);

  const updateDefinition = (updater: (definition: PriceRuleDefinition) => PriceRuleDefinition) => {
    setValues((prev) => ({
      ...prev,
      definition: updater(prev.definition),
    }));
  };

  const handleAddVariable = () => {
    const normalizedLabel = normalizeVariableName(newVariableLabel);
    if (!normalizedLabel) {
      return;
    }

    const existingKeys = values.definition.variables.map((variable) => variable.key);
    const key = ensureUniqueKey(normalizedLabel, existingKeys);

    const userInputAllowed = newVariableUserInput && (newVariableType === 'text' || newVariableType === 'number');

    updateDefinition((definition) => ({
      ...definition,
      variables: [
        ...definition.variables,
        {
          key,
          label: normalizedLabel,
          type: newVariableType,
          initialValue: newVariableUserInput ? undefined : newVariableValue || undefined,
          userInput: userInputAllowed || undefined,
        }
      ],
    }));

    setNewVariableLabel('');
    setNewVariableType('text');
    setNewVariableValue('');
    setNewVariableUserInput(false);
  };

  const usedVariables = useMemo(() => {
    const used = new Set<string>();
    values.definition.conditions.forEach((condition) => {
      if (condition.left.kind === 'variable') {
        used.add(condition.left.key);
      }
      if (condition.right.kind === 'variable') {
        used.add(condition.right.key);
      }
    });
    return used;
  }, [values.definition.conditions]);

  const removeVariable = (key: string) => {
    if (usedVariables.has(key)) {
      return;
    }
    updateDefinition((definition) => ({
      ...definition,
      variables: definition.variables.filter((variable) => variable.key !== key),
    }));
  };

  const handleConditionExpressionChange = (nextExpression: string) => {
    const normalizedExpression = normalizeConditionKeywords(nextExpression);
    setConditionExpression(normalizedExpression);
    const trimmedExpression = normalizedExpression.trim();
    if (!trimmedExpression) {
      updateDefinition((definition) => ({
        ...definition,
        conditions: [],
        formula: '0',
      }));
      setConditionError(null);
      return normalizedExpression;
    }

    const lowerExpression = trimmedExpression.toLowerCase();
    if (!/^if\b/.test(lowerExpression)) {
      try {
        const variableMap = createVariableValueMap(values.definition);
        validatePriceExpression(trimmedExpression, 'Formula', variableMap, values.definition);
        updateDefinition((definition) => ({
          ...definition,
          conditions: [],
          formula: trimmedExpression,
        }));
        setConditionError(null);
      } catch (error) {
        setConditionError(error instanceof Error ? error.message : 'Invalid price expression.');
      }
      return normalizedExpression;
    }

    if (!lowerExpression.includes(' then ')) {
      setConditionError('Add a THEN clause with the formula to apply.');
      return normalizedExpression;
    }

    try {
      const {
        condition,
        formula,
        thenFormula,
        elseFormula,
      } = splitConditionAndFormula(trimmedExpression);

      if (!condition) {
        throw new Error('Condition is missing operands.');
      }

      if (!thenFormula) {
        throw new Error('Add a price expression after THEN.');
      }

      const duplicateConditionKey = findDuplicateConditionTargetKey(trimmedExpression, values.definition);
      if (duplicateConditionKey) {
        throw new Error('This condition already exists.');
      }

      const variableMap = createVariableValueMap(values.definition);
      validatePriceExpression(thenFormula, 'THEN', variableMap, values.definition);
      if (elseFormula) {
        validatePriceExpression(elseFormula, 'ELSE', variableMap, values.definition);
      }

      const parsedConditions = parseConditionExpression(condition, values.definition);
      const collisionError = detectConditionCollisions(parsedConditions, values.definition);
      if (collisionError) {
        throw new Error(collisionError);
      }
      updateDefinition((definition) => ({
        ...definition,
        conditions: parsedConditions,
        formula: formula || '0',
      }));
      setConditionError(null);
    } catch (error) {
      setConditionError(error instanceof Error ? error.message : 'Invalid condition expression.');
    }
    return normalizedExpression;
  };

  return {
    values,
    setValues,
    errorMessage,
    setErrorMessage,
    newVariableLabel,
    setNewVariableLabel,
    newVariableType,
    setNewVariableType,
    newVariableValue,
    setNewVariableValue,
    newVariableUserInput,
    setNewVariableUserInput,
    handleAddVariable,
    usedVariables,
    removeVariable,
    conditionExpression,
    conditionError,
    handleConditionExpressionChange,
    updateDefinition,
  };
}

type RuleLanguageEditorProps = {
  definition: PriceRuleDefinition;
  newVariableLabel: string;
  setNewVariableLabel: Dispatch<SetStateAction<string>>;
  newVariableType: 'text' | 'number';
  setNewVariableType: Dispatch<SetStateAction<'text' | 'number'>>;
  newVariableValue: string;
  setNewVariableValue: Dispatch<SetStateAction<string>>;
  newVariableUserInput: boolean;
  setNewVariableUserInput: Dispatch<SetStateAction<boolean>>;
  handleAddVariable: () => void;
  usedVariables: Set<string>;
  removeVariable: (key: string) => void;
  conditionExpression: string;
  conditionError: string | null;
  handleConditionExpressionChange: (value: string) => void;
};

type SuggestionCategory = 'connector' | 'comparator' | 'literal' | 'variable';
type Suggestion = {
  id: string;
  label: string;
  insert: string;
  description: string;
  category: SuggestionCategory;
};

type TokenRange = {
  start: number;
  end: number;
  token: string;
};

const computeTokenRange = (text: string, cursor: number): TokenRange => {
  const normalizedCursor = Math.min(Math.max(cursor, 0), text.length);
  let start = normalizedCursor;
  while (start > 0 && !/\s/.test(text[start - 1])) {
    start -= 1;
  }
  return {
    start,
    end: normalizedCursor,
    token: text.slice(start, normalizedCursor),
  };
};

function RuleLanguageEditor({
  definition,
  newVariableLabel,
  setNewVariableLabel,
  newVariableType,
  setNewVariableType,
  newVariableValue,
  setNewVariableValue,
  newVariableUserInput,
  setNewVariableUserInput,
  handleAddVariable,
  usedVariables,
  removeVariable,
  conditionExpression,
  conditionError,
  handleConditionExpressionChange,
}: RuleLanguageEditorProps) {
  const [expressionField, setExpressionField] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [suggestionCandidates, setSuggestionCandidates] = useState<Suggestion[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [tokenRange, setTokenRange] = useState<TokenRange | null>(null);
  const [expressionError, setExpressionError] = useState<string | null>(null);
  const comparatorDescriptions = useMemo<Record<PriceRuleComparator, string>>(() => ({
    '<': 'Less than',
    '<=': 'Less than or equal',
    '>': 'Greater than',
    '>=': 'Greater than or equal',
    '=': 'Equal to',
    '!=': 'Not equal to',
  }), []);

  const connectorTokens = useMemo(() => [
    {
      label: 'AND',
      value: ' AND ',
    },
    {
      label: 'OR',
      value: ' OR ',
    },
    {
      label: 'NOT',
      value: 'NOT ',
    }
  ], []);

  const keywordTokens = useMemo(() => [
    {
      label: 'IF',
      value: 'if ',
      description: 'Start condition',
    },
    {
      label: 'THEN',
      value: ' then ',
      description: 'Primary formula',
    },
    {
      label: 'ELSE',
      value: ' ELSE ',
      description: 'Fallback formula',
    }
  ], []);

  const literalTokens = useMemo(() => [
    "date('2024-01-01')",
    "time('08:30', 'AM')",
    "datetime('2024-01-01T08:30:00Z')"
  ], []);

  const variableSuggestions = useMemo(() => definition.variables.map((variable) => {
    const normalizedKey = variable.key.toLowerCase();
    const normalizedLabel = variable.label.toLowerCase();
    return {
      id: `variable-${normalizedKey}`,
      label: normalizedKey,
      insert: `${normalizedKey} `,
      description: `${variable.type} • ${normalizedLabel}`,
      category: 'variable',
    };
  }), [definition.variables]);

  const expressionSegments = useMemo(() => splitExpressionSegments(conditionExpression), [conditionExpression]);

  const expressionConditionKeys = useMemo(() => (
    expressionSegments
      .map((segment) => getConditionTargetKey(segment, definition))
      .filter((key): key is string => Boolean(key))
  ), [definition, expressionSegments]);

  const validateClause = useCallback((text: string) => {
    const normalized = normalizeConditionKeywords(text).trim();
    if (!normalized) {
      return 'Enter a clause to add.';
    }
    const lower = normalized.toLowerCase();
    if (!lower.startsWith('if ')) {
      try {
        const variableMap = createVariableValueMap(definition);
        validatePriceExpression(normalized, 'Formula', variableMap, definition);
        return null;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid clause.';
        return message;
      }
    }
    if (!lower.includes(' then ')) {
      return 'Add a THEN clause.';
    }
    try {
      const {
        condition,
        thenFormula,
        elseFormula,
      } = splitConditionAndFormula(normalized);
      const clauseConditionKey = getConditionTargetKey(normalized, definition);
      if (clauseConditionKey && expressionConditionKeys.includes(clauseConditionKey)) {
        return 'This condition already exists.';
      }
      if (!condition) {
        return 'Condition is missing operands.';
      }
      if (!thenFormula) {
        return 'Add a formula after THEN.';
      }
      const variableMap = createVariableValueMap(definition);
      validatePriceExpression(thenFormula, 'THEN', variableMap, definition);
      if (elseFormula) {
        validatePriceExpression(elseFormula, 'ELSE', variableMap, definition);
      }
      const parsedConditions = parseConditionExpression(condition, definition);
      const collisionError = detectConditionCollisions(parsedConditions, definition);
      if (collisionError) {
        return collisionError;
      }
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid clause.';
      return message;
    }
  }, [definition, expressionConditionKeys]);

  const isExpressionFieldValid = useMemo(() => validateClause(expressionField) === null, [expressionField, validateClause]);

  useEffect(() => {
    const trimmed = expressionField.trim();
    if (!trimmed) {
      setExpressionError(null);
      return;
    }

    setExpressionError(validateClause(expressionField));
  }, [expressionField, validateClause]);

  const allSuggestions = useMemo(() => {
    const connectors: Suggestion[] = connectorTokens.map((token) => ({
      id: `connector-${token.label}`,
      label: token.label,
      insert: token.value,
      description: 'Connector',
      category: 'connector',
    }));

    const comparators: Suggestion[] = PRICE_RULE_COMPARATORS.map((operator) => ({
      id: `comparator-${operator}`,
      label: operator,
      insert: ` ${operator} `,
      description: comparatorDescriptions[operator],
      category: 'comparator',
    }));

    const literals: Suggestion[] = literalTokens.map((literal) => ({
      id: `literal-${literal}`,
      label: literal,
      insert: `${literal} `,
      description: 'Literal',
      category: 'literal',
    }));

    const keywords: Suggestion[] = keywordTokens.map((keyword) => ({
      id: `keyword-${keyword.label}`,
      label: keyword.label,
      insert: keyword.value,
      description: keyword.description,
      category: 'connector',
    }));

    return [...variableSuggestions, ...connectors, ...comparators, ...literals, ...keywords];
  }, [connectorTokens, comparatorDescriptions, literalTokens, keywordTokens, variableSuggestions]);

  const updateSuggestions = useCallback((text: string, cursor: number) => {
    const range = computeTokenRange(text, cursor);
    setTokenRange(range);
    const prefix = range.token.trim();

    if (!prefix) {
      setSuggestionCandidates([]);
      setActiveSuggestionIndex(0);
      return;
    }

    const normalized = prefix.toLowerCase();
    const filtered = allSuggestions
      .filter((suggestion) => {
        const trimmedInsert = suggestion.insert.trim().toLowerCase();
        return (
          suggestion.label.toLowerCase().startsWith(normalized)
          || trimmedInsert.startsWith(normalized)
        );
      })
      .slice(0, 8);

    setSuggestionCandidates(filtered);
    setActiveSuggestionIndex(0);
  }, [allSuggestions]);

  const insertSuggestion = useCallback((suggestion: Suggestion) => {
    if (!tokenRange) {
      return;
    }
    const before = expressionField.slice(0, tokenRange.start);
    const after = expressionField.slice(tokenRange.end);
    const nextExpression = `${before}${suggestion.insert}${after}`;
    const normalized = normalizeConditionKeywords(nextExpression);
    const cursor = before.length + suggestion.insert.length;
    setExpressionField(normalized);
    updateSuggestions(normalized, cursor);
    setSuggestionCandidates([]);
  }, [expressionField, tokenRange, updateSuggestions]);

  const handleExpressionFieldChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    const normalized = normalizeConditionKeywords(next);
    setExpressionField(normalized);
    const cursor = event.target.selectionStart ?? next.length;
    updateSuggestions(normalized, cursor);
  };

  const addExpressionSegment = useCallback(() => {
    const trimmed = expressionField.trim();
    if (!trimmed) {
      return;
    }

    const normalizedSegment = normalizeConditionSegment(trimmed);
    if (expressionSegments.some((segment) => normalizeConditionSegment(segment) === normalizedSegment)) {
      setExpressionError('This condition already exists.');
      return;
    }
    const clauseConditionKey = getConditionTargetKey(trimmed, definition);
    if (clauseConditionKey && expressionConditionKeys.includes(clauseConditionKey)) {
      setExpressionError('This condition already exists.');
      return;
    }
    try {
      const condition = splitConditionAndFormula(trimmed).condition;
      const parsedConditions = parseConditionExpression(condition, definition);
      const simulatedConditions = [...definition.conditions, ...parsedConditions];
      const collisionError = detectConditionCollisions(simulatedConditions, definition);
      if (collisionError) {
        setExpressionError(collisionError);
        return;
      }
    } catch (error) {
      setExpressionError(error instanceof Error ? error.message : 'Invalid condition.');
      return;
    }
    const baseExpression = conditionExpression.trim();
    const separator = baseExpression ? ' AND ' : '';
    handleConditionExpressionChange(`${baseExpression}${separator}${trimmed}`);
    setExpressionField('');
    setSuggestionCandidates([]);
    setActiveSuggestionIndex(0);
    setTokenRange(null);
    setExpressionError(null);
  }, [conditionExpression, definition, expressionConditionKeys, expressionField, expressionSegments, handleConditionExpressionChange]);

  const handleExpressionFieldKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (suggestionCandidates.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveSuggestionIndex((prev) => (prev + 1) % suggestionCandidates.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveSuggestionIndex((prev) => (prev - 1 + suggestionCandidates.length) % suggestionCandidates.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        insertSuggestion(suggestionCandidates[activeSuggestionIndex]);
        return;
      }
      if (event.key === 'Escape') {
        setSuggestionCandidates([]);
        setActiveSuggestionIndex(0);
        return;
      }
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      addExpressionSegment();
    }
  };

  const insertSnippet = useCallback((value: string) => {
    setExpressionField((prev) => {
      const next = `${prev}${value}`;
      const normalized = normalizeConditionKeywords(next);
      updateSuggestions(normalized, normalized.length);
      return normalized;
    });
  }, [updateSuggestions]);

  const removeExpressionSegment = useCallback((index: number) => {
    const updatedSegments = expressionSegments.filter((_, idx) => idx !== index);
    handleConditionExpressionChange(updatedSegments.join(' AND '));
  }, [expressionSegments, handleConditionExpressionChange]);

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background p-4 shadow-sm">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1 gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold">Rule language</h3>
            <p className="text-xs text-muted-foreground">
              Define how your rule behaves with a readable expression, then select variables and a formula.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            The chips insert valid tokens for faster authoring.
          </p>
        </div>
      </div>
      <div className="space-y-4">
        <div className="space-y-3 rounded-xl border border-border/80 bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <Label>Variables</Label>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            { definition.variables
              .filter((variable) => !RESERVED_VARIABLE_KEYS.includes(variable.key))
              .map((variable) => (
                <div
                  key={ variable.key }
                  className="flex items-center gap-2 rounded-md border border-border/80 pr-1 pl-3 py-1 text-[11px] font-semibold tracking-wide"
                >
                  <div className="flex items-center gap-2">
                    <TypeIcon type={ variable.type } />
                    <span className="text-xs">{ variable.label.toLowerCase() }</span>
                  </div>
                  { variable.userInput ? (
                    <span className="text-[9px] font-semibold text-muted-foreground">
                      Input
                    </span>
                  ) : variable.initialValue ? (
                    <span className="text-[9px] text-muted-foreground">
                      Default: { variable.initialValue }
                    </span>
                  ) : null }
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={ () => removeVariable(variable.key) }
                    disabled={ usedVariables.has(variable.key) }
                    aria-label="Remove variable"
                  >
                    <FiTrash2 className="size-3" aria-hidden="true" />
                  </Button>
                </div>
              )) }
          </div>
          <div className="flex items-center gap-3 flex-nowrap overflow-x-auto">
            <Button
              type="button"
              className="h-full w-10"
              onClick={ handleAddVariable }
            >
              <FiPlus className="size-4" aria-hidden="true" />
              <span className="sr-only">Add variable</span>
            </Button>
            <Input
              className="min-w-[12rem]"
              placeholder="New variable label"
              value={ newVariableLabel }
              onChange={ (event) => setNewVariableLabel(normalizeVariableName(event.target.value)) }
            />
            <Select
              value={ newVariableType }
              onValueChange={ (value) => {
                const nextType = value as DataType;
                setNewVariableType(nextType);
                if (nextType === 'date' || nextType === 'time') {
                  setNewVariableUserInput(false);
                }
              } }
            >
              <SelectTrigger className="min-w-[8rem]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">
                  <div className="flex items-center gap-2">
                    <TypeIcon type="text" />
                    Text
                  </div>
                </SelectItem>
                <SelectItem value="number">
                  <div className="flex items-center gap-2">
                    <TypeIcon type="number" />
                    Number
                  </div>
                </SelectItem>
                <SelectItem value="date">
                  <div className="flex items-center gap-2">
                    <TypeIcon type="date" />
                    Date
                  </div>
                </SelectItem>
                <SelectItem value="time">
                  <div className="flex items-center gap-2">
                    <TypeIcon type="time" />
                    Time
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            { newVariableType === 'date' ? (
              <div className="w-full">
              <DatePickerInput
                value={ newVariableValue }
                onChange={ (nextValue) => setNewVariableValue(nextValue) }
                disabled={ newVariableUserInput }
              />
              </div>
            ) : newVariableType === 'time' ? (
              <div className="w-full border border-input rounded-md">
                <Input
                  readOnly={ newVariableUserInput }
                  className="w-full border-none pl-4 focus-visible:outline-none"
                  placeholder="Default value"
                  type="time"
                  value={ newVariableValue }
                  onChange={ (event) => setNewVariableValue(event.target.value) }
                  disabled={ newVariableUserInput }
                />
              </div>
            ) : (
              <Input
                className="min-w-[8rem]"
                placeholder="Default value"
                type={ newVariableType === 'number' ? 'number' : 'text' }
                inputMode={ newVariableType === 'number' ? 'decimal' : undefined }
                value={ newVariableValue }
                onChange={ (event) => {
                  const nextValue = event.target.value;
                  if (newVariableType === 'number') {
                    const sanitized = nextValue.replace(/[^0-9.-]/g, '');
                    const match = sanitized.match(/^-?(?:\d+)?(?:\.\d*)?/);
                    setNewVariableValue(match ? match[0] : '');
                    return;
                  }
                  setNewVariableValue(nextValue);
                } }
                disabled={ newVariableUserInput }
                step={ newVariableType === 'number' ? 'any' : undefined }
                onKeyDown={ (event) => {
                  if (newVariableType !== 'number') {
                    return;
                  }

                  const allowed = [
                    'Backspace',
                    'Tab',
                    'ArrowLeft',
                    'ArrowRight',
                    'Delete',
                    'Home',
                    'End',
                    'Enter',
                    'Escape',
                    '.',
                    '-'
                  ];

                  if (
                    allowed.includes(event.key)
                    || event.ctrlKey
                    || event.metaKey
                  ) {
                    return;
                  }

                  if (/^[0-9]$/.test(event.key)) {
                    return;
                  }

                  event.preventDefault();
                } }
              />
            ) }
            <div className="flex items-center gap-2 whitespace-nowrap">
              { /* Date/Time variables must be derived, not user-provided. */ }
              <Switch
                id="variable-user-input"
                checked={ newVariableUserInput && newVariableType !== 'date' && newVariableType !== 'time' }
                disabled={ newVariableType === 'date' || newVariableType === 'time' }
                onCheckedChange={ (checked) => {
                  const allowed = newVariableType === 'text' || newVariableType === 'number';
                  setNewVariableUserInput(allowed && Boolean(checked));
                  if (checked && !allowed) {
                    setNewVariableValue('');
                  }
                } }
              />
              <label htmlFor="variable-user-input" className="text-xs text-muted-foreground">
                User Input{ (newVariableType === 'date' || newVariableType === 'time') ? ' (not available for date/time)' : '' }
              </label>
            </div>
          </div>
        </div>
          <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <Label htmlFor="condition-field">Conditions</Label>
          </div>
          <div className="flex items-start gap-2">
            <div className="relative flex-1">
              <Input
                id="condition-field"
                ref={ inputRef }
                value={ expressionField }
                onChange={ handleExpressionFieldChange }
                onKeyDown={ handleExpressionFieldKeyDown }
                className="flex-1 min-w-0"
                placeholder="IF booking_hours >= 4 THEN booking_hours * 10 ELSE booking_hours * 8"
                aria-label="Add condition expression"
              />
              { suggestionCandidates.length > 0 && (
                <div className="absolute left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border/70 bg-popover shadow-lg">
                  <ul className="divide-y divide-border/60" role="listbox">
                    { suggestionCandidates.map((suggestion, index) => (
                      <li key={ suggestion.id }>
                        <button
                          type="button"
                          className={ `flex w-full items-center justify-between gap-3 px-3 py-1 text-left text-xs ${
                            index === activeSuggestionIndex ? 'bg-primary/10' : 'hover:bg-border/60'
                          }` }
                          onMouseDown={ (event) => {
                            event.preventDefault();
                            insertSuggestion(suggestion);
                          } }
                          role="option"
                          aria-selected={ index === activeSuggestionIndex }
                        >
                          <span className={ `font-medium tracking-wide${suggestion.category === 'variable' ? '' : ' uppercase'}` }>{ suggestion.label }</span>
                          <span className="text-[10px] text-muted-foreground">{ suggestion.description }</span>
                        </button>
                      </li>
                    )) }
                  </ul>
                </div>
              ) }
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10 aspect-square p-0"
              onClick={ addExpressionSegment }
              disabled={ !expressionField.trim() || !isExpressionFieldValid }
              aria-label="Add expression"
            >
              <FiPlus className="size-4" aria-hidden="true" />
              <span className="sr-only">Add expression</span>
            </Button>
          </div>
          { expressionError && (
            <p className="text-xs text-destructive font-sf">
              { expressionError }
            </p>
          ) }
          { expressionSegments.length > 0 && (
            <div className="flex flex-col gap-2">
              { expressionSegments.map((segment, index) => (
                <div
                  key={ `${segment}-${index}` }
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-border/10 px-3 py-2 text-[12px] font-semibold"
                >
                  <span className="truncate">{ segment }</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={ () => removeExpressionSegment(index) }
                  >
                    <FiTrash2 className="size-3" aria-hidden="true" />
                    <span className="sr-only">Delete clause</span>
                  </Button>
                </div>
              )) }
            </div>
          ) }
          { conditionError ? (
            <p className="text-xs text-destructive font-sf">{ conditionError }</p>
          ) : (
            <p id="condition-language-help" className="text-xs text-muted-foreground font-sf">
              Use <strong>IF ... THEN ...</strong> for conditional logic or type a standalone expression such as <code>booking_hours * 1.5</code>. Use <strong>AND</strong>/<strong>OR</strong> to chain conditions.
            </p>
          ) }
        </div>
      </div>
    </section>
  );
}

type PriceRuleFormShellProps = PriceRuleFormState & {
  mode?: 'create' | 'edit';
  isSubmitting?: boolean;
  onSubmit: (values: PriceRuleFormValues) => void;
  onCancel?: () => void;
};

export function PriceRuleFormShell({
  mode = 'create',
  isSubmitting = false,
  onSubmit,
  onCancel,
  values,
  setValues,
  errorMessage,
  setErrorMessage,
  newVariableLabel,
  setNewVariableLabel,
  newVariableType,
  setNewVariableType,
  newVariableValue,
  setNewVariableValue,
  newVariableUserInput,
  setNewVariableUserInput,
  handleAddVariable,
  removeVariable,
  usedVariables,
  conditionExpression,
  conditionError,
  handleConditionExpressionChange,
  updateDefinition,
}: PriceRuleFormShellProps) {
  const handleSubmit = () => {
    const parsed = priceRuleSchema.safeParse(values);
    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? 'Fix form errors.');
      return;
    }
    setErrorMessage(null);
    onSubmit(parsed.data);
  };

  return (
    <div className="space-y-6">
      { errorMessage ? (
        <p className="text-sm text-destructive">{ errorMessage }</p>
      ) : null }

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="rule-name">Rule name</Label>
          <Input
            id="rule-name"
            placeholder="Weekend uplift"
            value={ values.name }
            onChange={ (event) => setValues((prev) => ({
              ...prev,
              name: event.target.value,
            })) }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rule-description">Description</Label>
          <Input
            id="rule-description"
            placeholder="Apply higher rates on Saturdays and Sundays."
            value={ values.description ?? '' }
            onChange={ (event) => setValues((prev) => ({
              ...prev,
              description: event.target.value,
            })) }
          />
        </div>
      </div>



      <RuleLanguageEditor
        definition={ values.definition }
        newVariableLabel={ newVariableLabel }
        setNewVariableLabel={ setNewVariableLabel }
        newVariableType={ newVariableType }
        setNewVariableType={ setNewVariableType }
        newVariableValue={ newVariableValue }
        setNewVariableValue={ setNewVariableValue }
        newVariableUserInput={ newVariableUserInput }
        setNewVariableUserInput={ setNewVariableUserInput }
        handleAddVariable={ handleAddVariable }
        removeVariable={ removeVariable }
        usedVariables={ usedVariables }
        conditionExpression={ conditionExpression }
        conditionError={ conditionError }
        handleConditionExpressionChange={ handleConditionExpressionChange }
      />
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end px-0 pb-0 pt-2">
          { onCancel && (
            <Button variant="outline" onClick={ onCancel } disabled={ isSubmitting }>
              Cancel
            </Button>
          ) }
        <Button
          onClick={ handleSubmit }
          disabled={ isSubmitting || Boolean(conditionError) || !conditionExpression.trim() }
          className="inline-flex items-center justify-center gap-2"
        >
          { isSubmitting && <CgSpinner className="size-4 animate-spin" aria-hidden="true" /> }
          { isSubmitting ? 'Saving…' : mode === 'create' ? 'Save rule' : 'Update rule' }
        </Button>
        </div>
    </div>
  );
}

type PriceRuleDialogProps = {
  open: boolean;
  mode?: 'create' | 'edit';
  initialValues?: PriceRuleFormValues;
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: PriceRuleFormValues) => void;
};

export function PriceRuleDialog({
  open,
  mode = 'create',
  initialValues,
  isSubmitting = false,
  onOpenChange,
  onSubmit,
}: PriceRuleDialogProps) {
  const formState = usePriceRuleFormState(initialValues, open);

  return (
    <Dialog open={ open } onOpenChange={ onOpenChange }>
      <DialogContent className="h-screen w-screen max-w-none p-0 sm:max-w-none">
        <div className="flex h-full flex-col">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>{ mode === 'create' ? 'Add pricing rule' : 'Edit pricing rule' }</DialogTitle>
            <DialogDescription>
              Define the condition tree, variables, and formula that determines the rate adjustments.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <PriceRuleFormShell
              { ...formState }
              mode={ mode }
              isSubmitting={ isSubmitting }
              onSubmit={ onSubmit }
              onCancel={ () => onOpenChange(false) }
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PriceRuleDialog;
