'use client';

import {
  Dispatch,
  SetStateAction,
  useEffect,
  useMemo,
  useState
} from 'react';
import { FiChevronDown, FiPlus, FiTrash2 } from 'react-icons/fi';

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
import { Textarea } from '@/components/ui/textarea';
import {
  PRICE_RULE_COMPARATORS,
  PRICE_RULE_INITIAL_VARIABLES,
  PRICE_RULE_LITERAL_TYPES,
  PRICE_RULE_SPECIAL_CONSTANTS,
  PriceRuleCondition,
  PriceRuleDefinition,
  PriceRuleFormValues,
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

const createCondition = (definition: PriceRuleDefinition): PriceRuleCondition => {
  const defaultVariable = definition.variables.find((variable) => variable.key === 'booking_hours') ?? definition.variables[0];
  const fallbackReference = defaultVariable
    ? {
        kind: 'variable',
        key: defaultVariable.key,
      }
    : {
        kind: 'literal',
        value: '0',
        valueType: 'number',
      };
  return {
    id: randomId(),
    connector: definition.conditions.length === 0 ? undefined : 'and',
    negated: false,
    comparator: PRICE_RULE_COMPARATORS[0],
    left: fallbackReference,
    right: {
      kind: 'literal',
      value: '',
      valueType: 'number',
    },
  };
};

const cloneDefinition = (definition: PriceRuleDefinition): PriceRuleDefinition => ({
  constants: definition.constants.map((constant) => ({ ...constant, })),
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
    constants: PRICE_RULE_SPECIAL_CONSTANTS.map((constant) => ({ ...constant, })),
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
  newVariableType: 'text' | 'number';
  setNewVariableType: Dispatch<SetStateAction<'text' | 'number'>>;
  newVariableValue: string;
  setNewVariableValue: Dispatch<SetStateAction<string>>;
  newVariableUserInput: boolean;
  setNewVariableUserInput: Dispatch<SetStateAction<boolean>>;
  operandOptions: {
    label: string;
    value: string;
  }[];
  addCondition: () => void;
  updateCondition: (id: string, updater: (condition: PriceRuleCondition) => PriceRuleCondition) => void;
  removeCondition: (id: string) => void;
  handleRightModeChange: (id: string, mode: 'reference' | 'literal') => void;
  handleAddVariable: () => void;
  usedVariables: Set<string>;
  updateDefinition: (updater: (definition: PriceRuleDefinition) => PriceRuleDefinition) => void;
};

export function usePriceRuleFormState(
  initialValues?: PriceRuleFormValues,
  resetTrigger?: unknown
): PriceRuleFormState {
  const [values, setValues] = useState<PriceRuleFormValues>(createDefaultRule);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newVariableLabel, setNewVariableLabel] = useState('');
  const [newVariableType, setNewVariableType] = useState<'text' | 'number'>('text');
  const [newVariableValue, setNewVariableValue] = useState('');
  const [newVariableUserInput, setNewVariableUserInput] = useState(false);

  useEffect(() => {
    if (resetTrigger === false) {
      return;
    }

    if (initialValues) {
      setValues({
        ...initialValues,
        definition: cloneDefinition(initialValues.definition),
      });
    } else {
      setValues(createDefaultRule());
    }
    setErrorMessage(null);
    setNewVariableLabel('');
    setNewVariableType('text');
    setNewVariableValue('');
    setNewVariableUserInput(false);
  }, [initialValues, resetTrigger]);

  const operandOptions = useMemo(() => {
    const variables = values.definition.variables
      .filter((variable) => variable.key !== 'input_text')
      .map((variable) => ({
      label: `${variable.label} (${variable.key})`,
      value: `variable:${variable.key}`,
    }));
    const constants = values.definition.constants.map((constant) => ({
      label: `${constant.label} (${constant.key})${constant.special ? ' · special' : ''}`,
      value: `constant:${constant.key}`,
    }));

    return [...variables, ...constants];
  }, [values.definition.constants, values.definition.variables]);

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

  const addCondition = () => {
    updateDefinition((definition) => ({
      ...definition,
      conditions: [...definition.conditions, createCondition(definition)],
    }));
  };

  const updateCondition = (id: string, updater: (condition: PriceRuleCondition) => PriceRuleCondition) => {
    updateDefinition((definition) => {
      const nextConditions = definition.conditions.map((condition) =>
        condition.id === id ? updater(condition) : condition
      );
      return {
        ...definition,
        conditions: nextConditions,
      };
    });
  };

  const removeCondition = (id: string) => {
    updateDefinition((definition) => {
      const nextConditions = definition.conditions.filter((condition) => condition.id !== id);
      if (nextConditions.length > 0) {
        nextConditions[0] = {
          ...nextConditions[0],
          connector: undefined,
        };
      }
      return {
        ...definition,
        conditions: nextConditions,
      };
    });
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

  const handleRightModeChange = (id: string, mode: 'reference' | 'literal') => {
    updateCondition(id, (condition) => {
      if (mode === 'literal') {
        return {
          ...condition,
          right: {
            kind: 'literal',
            value: '',
            valueType: 'number',
          },
        };
      }
      const fallbackReference = operandOptions[0]?.value ?? 'variable:input_text';
      const [kind, key] = fallbackReference.split(':');
      return {
        ...condition,
        right: {
          kind: kind as 'variable' | 'constant',
          key,
        },
      };
    });
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
    operandOptions,
    addCondition,
    updateCondition,
    removeCondition,
    handleRightModeChange,
    handleAddVariable,
    usedVariables,
    updateDefinition,
  };
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
  operandOptions,
  addCondition,
  updateCondition,
  removeCondition,
  handleRightModeChange,
  handleAddVariable,
  usedVariables,
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

      <section className="space-y-3 rounded-lg border border-border p-4">
        <details className="group" open>
          <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold leading-none">
            <span>Variables</span>
            <FiChevronDown
              className="size-4 transition-transform duration-150 group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              { values.definition.variables
                .filter((variable) => !RESERVED_VARIABLE_KEYS.includes(variable.key))
                .map((variable) => (
                  <div
                    key={ variable.key }
                  className="flex items-center gap-2 rounded-md border pl-3 pr-1 py-1 text-xs"
                  >
                    <span>{ variable.label }</span>
                    { variable.userInput ? (
                      <span className="text-[9px] font-semibold uppercase text-muted-foreground">
                        User input
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
                      onClick={ () => {
                        if (usedVariables.has(variable.key)) return;
                        updateDefinition((definition) => ({
                          ...definition,
                          variables: definition.variables.filter((item) => item.key !== variable.key),
                        }));
                      } }
                      disabled={ usedVariables.has(variable.key) }
                      aria-label="Remove variable"
                    >
                      <FiTrash2 className="size-3" aria-hidden="true" />
                    </Button>
                  </div>
                )) }
            </div>
            <div className="flex items-center gap-3 overflow-x-auto">
              <Button type="button" className="h-full w-10 sm:w-10" onClick={ handleAddVariable }>
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
                onValueChange={ (value) => setNewVariableType(value as 'text' | 'number') }
              >
                <SelectTrigger className="min-w-[8rem]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                </SelectContent>
              </Select>
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
        </details>
      </section>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Conditions</h3>
          <Button type="button" variant="outline" onClick={ addCondition }>
            <FiPlus className="size-4" aria-hidden="true" />
            Add condition
          </Button>
        </div>
        { values.definition.conditions.length === 0 && (
          <p className="text-xs text-muted-foreground">Add at least one condition to activate this rule.</p>
        ) }
        <div className="space-y-3">
          { values.definition.conditions.map((condition, index) => (
            <div key={ condition.id } className="rounded-lg border border-border/80 p-3">
              { index > 0 && (
                <div className="mb-2">
                  <Select
                    value={ condition.connector ?? 'and' }
                    onValueChange={ (value) => updateCondition(condition.id, (prev) => ({
                      ...prev,
                      connector: value as 'and' | 'or',
                    })) }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Connector" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="and">AND</SelectItem>
                      <SelectItem value="or">OR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) }
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Label htmlFor={ `left-${condition.id}` }>Left operand</Label>
                  <Select
                    id={ `left-${condition.id}` }
                    value={ `${condition.left.kind}:${condition.left.key}` }
                    onValueChange={ (value) => {
                      const [kind, key] = value.split(':');
                      updateCondition(condition.id, (prev) => ({
                        ...prev,
                        left: {
                          kind: kind as 'variable' | 'constant',
                          key,
                        },
                      }));
                    } }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an operand" />
                    </SelectTrigger>
                    <SelectContent>
                      { operandOptions.map((option) => (
                        <SelectItem key={ option.value } value={ option.value }>
                          { option.label }
                        </SelectItem>
                      )) }
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label htmlFor={ `comparator-${condition.id}` }>Comparator</Label>
                  <Select
                    id={ `comparator-${condition.id}` }
                    value={ condition.comparator }
                    onValueChange={ (value) => updateCondition(condition.id, (prev) => ({
                      ...prev,
                      comparator: value as typeof condition.comparator,
                    })) }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Comparator" />
                    </SelectTrigger>
                    <SelectContent>
                      { PRICE_RULE_COMPARATORS.map((operator) => (
                        <SelectItem key={ operator } value={ operator }>
                          { operator === '<' && 'LESS THAN' }
                          { operator === '<=' && 'LESS THAN OR EQUAL' }
                          { operator === '>' && 'GREATER THAN' }
                          { operator === '>=' && 'GREATER THAN OR EQUAL' }
                          { operator === '=' && 'EQUAL TO' }
                          { operator === '!=' && 'NOT EQUAL TO' }
                        </SelectItem>
                      )) }
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label htmlFor={ `right-${condition.id}` }>Right operand</Label>
                  <div className="space-y-2">
                    <Select
                      value={ condition.right.kind === 'literal' ? 'literal' : 'reference' }
                      onValueChange={ (value) => handleRightModeChange(condition.id, value as 'literal' | 'reference') }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Operand type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reference">Reference</SelectItem>
                        <SelectItem value="literal">Literal value</SelectItem>
                      </SelectContent>
                    </Select>
                    { condition.right.kind === 'literal' ? (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Value"
                          value={ condition.right.value }
                          onChange={ (event) => updateCondition(condition.id, (prev) => ({
                            ...prev,
                            right: {
                              ...prev.right,
                              value: event.target.value,
                            },
                          })) }
                        />
                        <Select
                          value={ condition.right.valueType }
                          onValueChange={ (value) => updateCondition(condition.id, (prev) => ({
                            ...prev,
                            right: {
                              ...prev.right,
                              valueType: value as typeof prev.right.valueType,
                            },
                          })) }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            { PRICE_RULE_LITERAL_TYPES.map((literalType) => (
                              <SelectItem key={ literalType } value={ literalType }>
                                { literalType }
                              </SelectItem>
                            )) }
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <Select
                        value={ `${condition.right.kind}:${condition.right.key}` }
                        onValueChange={ (value) => {
                          const [kind, key] = value.split(':');
                          updateCondition(condition.id, (prev) => ({
                            ...prev,
                            right: {
                              kind: kind as 'variable' | 'constant',
                              key,
                            },
                          }));
                        } }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a reference" />
                        </SelectTrigger>
                        <SelectContent>
                          { operandOptions.map((option) => (
                            <SelectItem key={ option.value } value={ option.value }>
                              { option.label }
                            </SelectItem>
                          )) }
                        </SelectContent>
                      </Select>
                    ) }
                  </div>
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <Button
                    type="button"
                    variant={ condition.negated ? 'destructive' : 'outline' }
                    onClick={ () => updateCondition(condition.id, (prev) => ({
                      ...prev,
                      negated: !prev.negated,
                    })) }
                  >
                    NOT
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive"
                    onClick={ () => removeCondition(condition.id) }
                    aria-label="Remove condition"
                  >
                    <FiTrash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </div>
          )) }
        </div>
      </section>

      <section className="space-y-2 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Formula</h3>
          <p className="text-xs text-muted-foreground">Refer to variables by key (e.g., booking_hours * 1.5)</p>
        </div>
        <Textarea
          placeholder="booking_hours * 1.25 + 50"
          value={ values.definition.formula }
          onChange={ (event) => updateDefinition((definition) => ({
            ...definition,
            formula: event.target.value,
          })) }
          rows={ 4 }
        />
      </section>

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
