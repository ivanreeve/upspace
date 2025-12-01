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
  PriceRuleOperand,
  PriceRuleVariable,
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

function evaluateFormula(expression: string, variables: VariableValueMap): number {
  if (!expression.trim()) {
    throw new Error('Enter a formula before validating.');
  }

  const state: ParserState = {
    expression,
    length: expression.length,
    pos: 0,
    variables,
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
  return state.variables[key] ?? 0;
}

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
        cursor = end - 1;
        break;
      }
    }

    cursor += 1;
  }

  commitSegment(expression.length, false);
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

  const functionMatch = trimmed.match(/^([a-z_]+)\(\s*(['"])(.+?)\2\s*\)$/i);
  if (functionMatch) {
    const [, functionName, , innerValue] = functionMatch;
    const normalized = functionName.toLowerCase();
    if (normalized === 'date') {
      return {
        kind: 'literal',
        value: innerValue,
        valueType: 'date',
      };
    }
    if (normalized === 'time') {
      return {
        kind: 'literal',
        value: innerValue,
        valueType: 'time',
      };
    }
    if (normalized === 'datetime') {
      return {
        kind: 'literal',
        value: innerValue,
        valueType: 'datetime',
      };
    }
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

  return {
    comparator,
    negated,
    left: parseOperandReference(leftToken, definition),
    right: parseOperandReference(rightToken, definition),
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

const splitConditionAndFormula = (expression: string) => {
  const trimmed = expression.trim();
  const lower = trimmed.toLowerCase();
  const thenSeparator = ' then ';
  const elseSeparator = ' else ';
  const thenIndex = lower.indexOf(thenSeparator);

  if (thenIndex === -1) {
    return {
      condition: trimmed,
      formula: '',
    };
  }

  let condition = trimmed.slice(0, thenIndex).trim();
  if (condition.toLowerCase().startsWith('if ')) {
    condition = condition.slice(3).trim();
  }

  const formulaSection = trimmed.slice(thenIndex + thenSeparator.length);
  const elseIndex = formulaSection.toLowerCase().indexOf(elseSeparator);
  if (elseIndex === -1) {
    return {
      condition,
      formula: formulaSection.trim(),
    };
  }

  const primary = formulaSection.slice(0, elseIndex).trim();
  const elsePart = formulaSection.slice(elseIndex + elseSeparator.length).trim();
  return {
    condition,
    formula: `${primary}${elsePart ? ` ELSE ${elsePart}` : ''}`.trim(),
  };
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

const RESERVED_VARIABLE_KEYS = PRICE_RULE_INITIAL_VARIABLES.map((variable) => variable.key);

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
      setConditionExpression(serializeConditions(clonedDefinition.conditions));
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
    const trimmedLabel = newVariableLabel.trim();
    if (!trimmedLabel) {
      return;
    }

    const existingKeys = values.definition.variables.map((variable) => variable.key);
    const key = ensureUniqueKey(trimmedLabel, existingKeys);

    updateDefinition((definition) => ({
      ...definition,
      variables: [
        ...definition.variables,
        {
          key,
          label: trimmedLabel,
          type: newVariableType,
          initialValue: newVariableUserInput ? undefined : newVariableValue || undefined,
          userInput: newVariableUserInput || undefined,
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
    setConditionExpression(nextExpression);
    if (!nextExpression.trim()) {
      updateDefinition((definition) => ({
        ...definition,
        conditions: [],
        formula: '0',
      }));
      setConditionError(null);
      return;
    }

    try {
      const {
        condition,
        formula,
      } = splitConditionAndFormula(nextExpression);
      const parsedConditions = condition
        ? parseConditionExpression(condition, values.definition)
        : [];
      updateDefinition((definition) => ({
        ...definition,
        conditions: parsedConditions,
        formula: formula || '0',
      }));
      if (!formula.trim() && condition) {
        setConditionError('Add a THEN clause with the formula to apply.');
      } else {
        setConditionError(null);
      }
    } catch (error) {
      setConditionError(error instanceof Error ? error.message : 'Invalid condition expression.');
    }
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
  formulaExpression,
  onFormulaChange,
}: RuleLanguageEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const [suggestionCandidates, setSuggestionCandidates] = useState<Suggestion[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [tokenRange, setTokenRange] = useState<TokenRange | null>(null);
  const [suggestionPosition, setSuggestionPosition] = useState({
    top: 0,
    left: 0,
  });

  useEffect(() => {
    const mirror = document.createElement('div');
    mirrorRef.current = mirror;
    document.body.appendChild(mirror);
    return () => {
      mirror.remove();
      mirrorRef.current = null;
    };
  }, []);

  const insertToken = (value: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      handleConditionExpressionChange(`${conditionExpression}${value}`);
      return;
    }
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const nextExpression = `${conditionExpression.slice(0, start)}${value}${conditionExpression.slice(end)}`;
    const cursor = start + value.length;
    handleConditionExpressionChange(nextExpression);
    updateSuggestions(nextExpression, cursor);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  };

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
      value: ' else ',
      description: 'Fallback formula',
    }
  ], []);

  const literalTokens = useMemo(() => [
    "date('2024-01-01')",
    "time('08:30')",
    "datetime('2024-01-01T08:30:00Z')",
    "'Downtown'",
    '123'
  ], []);

  const variableSuggestions = useMemo(() => definition.variables.map((variable) => ({
    id: `variable-${variable.key}`,
    label: variable.label,
    insert: `${variable.key} `,
    description: `${variable.type} • ${variable.key}`,
    category: 'variable',
  })), [definition.variables]);

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

  const updateCaretPosition = useCallback((cursor: number) => {
    const textarea = textareaRef.current;
    const mirror = mirrorRef.current;
    if (!textarea || !mirror) {
      return;
    }
    const computedStyle = window.getComputedStyle(textarea);
    const textareaRect = textarea.getBoundingClientRect();
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordWrap = 'break-word';
    mirror.style.overflowWrap = 'break-word';
    mirror.style.padding = computedStyle.padding;
    mirror.style.border = computedStyle.border;
    mirror.style.font = computedStyle.font;
    mirror.style.letterSpacing = computedStyle.letterSpacing;
    mirror.style.top = `${textareaRect.top + window.scrollY}px`;
    mirror.style.left = `${textareaRect.left + window.scrollX}px`;
    mirror.style.width = `${textarea.clientWidth}px`;
    mirror.style.boxSizing = computedStyle.boxSizing;
    mirror.textContent = textarea.value.slice(0, cursor);
    const span = document.createElement('span');
    span.textContent = '\u200b';
    mirror.appendChild(span);
    const spanRect = span.getBoundingClientRect();
    const top = (spanRect.top - textareaRect.top) + textarea.scrollTop;
    const left = spanRect.left - textareaRect.left;
    const lineHeight = parseFloat(computedStyle.lineHeight || '20');
    setSuggestionPosition({
      top: Math.max(0, top + lineHeight),
      left: Math.max(0, left),
    });
  }, []);

  const updateSuggestions = useCallback((text: string, cursor: number) => {
    const range = computeTokenRange(text, cursor);
    setTokenRange(range);
    const prefix = range.token.trim();

    if (!prefix) {
      setSuggestionCandidates([]);
      setActiveSuggestionIndex(0);
      updateCaretPosition(cursor);
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
    updateCaretPosition(cursor);
  }, [allSuggestions, updateCaretPosition]);

  useEffect(() => {
    const textarea = textareaRef.current;
    updateSuggestions(
      conditionExpression,
      textarea?.selectionStart ?? conditionExpression.length
    );
  }, [conditionExpression, updateSuggestions]);

  const insertSuggestion = (suggestion: Suggestion) => {
    if (!tokenRange) {
      return;
    }
    const before = conditionExpression.slice(0, tokenRange.start);
    const after = conditionExpression.slice(tokenRange.end);
    const nextExpression = `${before}${suggestion.insert}${after}`;
    handleConditionExpressionChange(nextExpression);
    updateSuggestions(nextExpression, before.length + suggestion.insert.length);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        const cursor = before.length + suggestion.insert.length;
        textarea.focus();
        textarea.setSelectionRange(cursor, cursor);
      }
    });
    setSuggestionCandidates([]);
  };

  const handleTextareaChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    handleConditionExpressionChange(next);
    const cursor = event.target.selectionStart ?? next.length;
    updateSuggestions(next, cursor);
  };

  const handleSuggestionKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestionCandidates.length === 0) {
      return;
    }

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
    }
  };

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
                  className="flex items-center gap-2 rounded-md border border-border/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
                >
                  <div className="flex items-center gap-2">
                    <TypeIcon type={ variable.type } />
                    <span className="text-xs">{ variable.label }</span>
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
              onChange={ (event) => setNewVariableLabel(event.target.value) }
            />
                <Select
                  value={ newVariableType }
                  onValueChange={ (value) => setNewVariableType(value as DataType) }
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
              <Switch
                id="variable-user-input"
                checked={ newVariableUserInput }
                onCheckedChange={ (checked) => {
                  setNewVariableUserInput(Boolean(checked));
                  if (checked) {
                    setNewVariableValue('');
                  }
                } }
              />
              <label htmlFor="variable-user-input" className="text-xs text-muted-foreground">
                User Input
              </label>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <Label htmlFor="condition-expression">Conditions</Label>
          </div>
          <div className="relative">
            <textarea
              id="condition-expression"
              ref={ textareaRef }
              value={ conditionExpression }
              onChange={ handleTextareaChange }
              onKeyDown={ handleSuggestionKeyDown }
              placeholder="IF booking_hours >= 4 THEN booking_hours * 10 ELSE booking_hours * 8"
              className="min-h-[10rem] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              aria-describedby="condition-language-help"
              aria-haspopup="listbox"
            />
            { suggestionCandidates.length > 0 && (
              <div
                className="absolute z-10 mt-1 max-h-48 overflow-y-auto rounded-none border border-border/70 bg-popover shadow-lg"
                style={ {
                  top: suggestionPosition.top,
                  left: suggestionPosition.left,
                  minWidth: 192,
                } }
              >
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
                        <span className="font-medium uppercase tracking-wide">{ suggestion.label }</span>
                        <span className="text-[10px] text-muted-foreground">{ suggestion.description }</span>
                      </button>
                    </li>
                  )) }
                </ul>
              </div>
            ) }
          </div>
          { conditionError ? (
            <p className="text-xs text-destructive">{ conditionError }</p>
          ) : (
            <p id="condition-language-help" className="text-xs text-muted-foreground">
              Start with a variable, add a comparator, then a literal. Use <strong>AND</strong>/<strong>OR</strong> to chain.
            </p>
          ) }
          <div className="space-y-3 rounded-xl border border-border/80 bg-muted/30 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Quick inserts</p>
            <div className="space-y-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Connectors</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  { connectorTokens.map((token) => (
                    <Button
                      key={ token.label }
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full text-[11px] uppercase tracking-wide"
                      onClick={ () => insertToken(token.value) }
                    >
                      { token.label }
                    </Button>
                  )) }
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Comparators</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  { PRICE_RULE_COMPARATORS.map((operator) => (
                    <Button
                      key={ operator }
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full text-[11px] uppercase tracking-wide"
                      onClick={ () => insertToken(` ${operator} `) }
                      title={ comparatorDescriptions[operator] }
                    >
                      { operator }
                    </Button>
                  )) }
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Literals</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  { literalTokens.map((literal) => (
                    <Button
                      key={ literal }
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full text-[11px] uppercase tracking-wide"
                      onClick={ () => insertToken(`${literal} `) }
                    >
                      { literal }
                    </Button>
                  )) }
                </div>
              </div>
            </div>
          </div>
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
        <Button onClick={ handleSubmit } disabled={ isSubmitting }>
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
