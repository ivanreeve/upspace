'use client';

import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent
} from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ControllerRenderProps, useForm, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import {
  FiBold,
  FiItalic,
  FiList,
  FiLock,
  FiSlash
} from 'react-icons/fi';

import {
  AREA_INPUT_DEFAULT,
  AreaRecord,
  SPACE_INPUT_DEFAULT,
  SpaceRecord
} from '@/data/spaces';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const rateUnits = ['hour', 'day', 'week'] as const;

const wrapSelectionWith = (wrapper: string) => (value: string) => `${wrapper}${value}${wrapper}`;

const formatHeaderLevel = (value: string, level: number) => {
  const prefix = '#'.repeat(level);

  return value
    .split('\n')
    .map((line) => `${prefix} ${line.replace(/^\s*#{1,6}\s*/, '').trimEnd()}`)
    .join('\n');
};

const formatList = (value: string, ordered: boolean) =>
  value
    .split('\n')
    .map((line, index) => {
      const cleaned = line.replace(/^\s*(?:[-*+]|\d+\.)\s*/, '');
      const prefix = ordered ? `${index + 1}. ` : '- ';
      return `${prefix}${cleaned}`;
    })
    .join('\n');

const inlineFormattingActions = [
  {
    label: 'Bold',
    formatter: wrapSelectionWith('**'),
    icon: <FiBold aria-hidden="true" className="size-4" />,
  },
  {
    label: 'Italic',
    formatter: wrapSelectionWith('*'),
    icon: <FiItalic aria-hidden="true" className="size-4" />,
  },
  {
    label: 'Strikethrough',
    formatter: wrapSelectionWith('~~'),
    icon: <FiSlash aria-hidden="true" className="size-4" />,
  }
];

export const spaceSchema = z.object({
  name: z.string().min(1, 'Space name is required.'),
  description: z
    .string()
    .min(20, 'Describe the space in at least 20 characters.')
    .max(500, 'Keep the description under 500 characters.'),
  unit_number: z.string().min(1, 'Unit or suite number is required.'),
  address_subunit: z.string().min(1, 'Address subunit is required (e.g., floor).'),
  street: z.string().min(1, 'Street is required.'),
  city: z.string().min(1, 'City is required.'),
  region: z.string().min(1, 'Region / state is required.'),
  postal_code: z
    .string()
    .min(1, 'Postal code is required.')
    .regex(/^\d{4}$/, 'Postal code must be exactly 4 digits.'),
  country_code: z
    .string()
    .length(2, 'Use the 2-letter ISO country code.')
    .regex(/^[A-Za-z]{2}$/, 'Only alphabetic characters are allowed.'),
  lat: z
    .coerce
    .number({ message: 'Latitude is required.', })
    .min(-90, 'Latitude must be >= -90.')
    .max(90, 'Latitude must be <= 90.'),
  long: z
    .coerce
    .number({ message: 'Longitude is required.', })
    .min(-180, 'Longitude must be >= -180.')
    .max(180, 'Longitude must be <= 180.'),
});

export const areaSchema = z
  .object({
    name: z.string().min(1, 'Area name is required.'),
    min_capacity: z
      .coerce
      .number({ message: 'Provide the minimum capacity.', })
      .int()
      .min(1, 'Minimum capacity must be at least 1 seat.'),
    max_capacity: z
      .coerce
      .number({ message: 'Provide the maximum capacity.', })
      .int()
      .min(1, 'Maximum capacity must be at least 1 seat.'),
    rate_time_unit: z.enum(rateUnits, { required_error: 'Select a billing cadence.', }),
    rate_amount: z.coerce.number({ message: 'Provide a rate amount.', }).positive('Rate must be greater than zero.'),
  })
  .refine((values) => values.max_capacity >= values.min_capacity, {
    path: ['max_capacity'],
    message: 'Max capacity must be greater than or equal to min capacity.',
  });

export type SpaceFormValues = z.infer<typeof spaceSchema>;
export type AreaFormValues = z.infer<typeof areaSchema>;

export const createSpaceFormDefaults = (): SpaceFormValues => ({ ...SPACE_INPUT_DEFAULT, });

export const createAreaFormDefaults = (): AreaFormValues => ({ ...AREA_INPUT_DEFAULT, });

export const spaceRecordToFormValues = (space: SpaceRecord): SpaceFormValues => ({
  name: space.name,
  description: space.description,
  unit_number: space.unit_number,
  address_subunit: space.address_subunit,
  street: space.street,
  city: space.city,
  region: space.region,
  postal_code: space.postal_code,
  country_code: space.country_code,
  lat: space.lat,
  long: space.long,
});

export const areaRecordToFormValues = (area: AreaRecord): AreaFormValues => ({
  name: area.name,
  min_capacity: area.min_capacity,
  max_capacity: area.max_capacity,
  rate_time_unit: area.rate_time_unit,
  rate_amount: area.rate_amount,
});

type TextSelection = {
  start: number;
  end: number;
};

type DescriptionTextareaProps = {
  field: ControllerRenderProps<SpaceFormValues, 'description'>;
};

function DescriptionTextarea({ field, }: DescriptionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [selectionRange, setSelectionRange] = useState<TextSelection | null>(null);

  const {
    ref,
    onBlur,
    ...inputProps
  } = field;

  const setTextareaRef = (element: HTMLTextAreaElement | null) => {
    textareaRef.current = element;

    if (typeof ref === 'function') {
      ref(element);
    } else if (ref && 'current' in ref) {
      (ref as { current: HTMLTextAreaElement | null }).current = element;
    }
  };

  const updateSelectionRange = () => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setSelectionRange(null);
      return;
    }

    const {
      selectionStart,
      selectionEnd,
    } = textarea;
    if (
      selectionStart === null ||
      selectionEnd === null ||
      selectionStart === selectionEnd
    ) {
      setSelectionRange(null);
      return;
    }

    setSelectionRange({
      start: selectionStart,
      end: selectionEnd,
    });
  };

  const handleBlur = (event: FocusEvent<HTMLTextAreaElement>) => {
    onBlur?.(event);
    setSelectionRange(null);
  };

  const handleMouseUp = () => {
    requestAnimationFrame(updateSelectionRange);
  };

  const handleKeyUp = (_event: KeyboardEvent<HTMLTextAreaElement>) => {
    updateSelectionRange();
  };

  const applyFormatting = (formatter: (value: string) => string) => {
    if (!textareaRef.current || !selectionRange) {
      return;
    }

    const currentValue = field.value ?? '';
    const before = currentValue.slice(0, selectionRange.start);
    const selection = currentValue.slice(selectionRange.start, selectionRange.end);
    const after = currentValue.slice(selectionRange.end);
    const formattedSelection = formatter(selection);
    const updatedValue = `${before}${formattedSelection}${after}`;

    inputProps.onChange?.(updatedValue);

    const nextStart = before.length;
    const nextEnd = nextStart + formattedSelection.length;

    requestAnimationFrame(() => {
      textareaRef.current?.focus({ preventScroll: true, });
      textareaRef.current?.setSelectionRange(nextStart, nextEnd);
    });

    setSelectionRange({
      start: nextStart,
      end: nextEnd,
    });
  };

  return (
    <div className="relative">
      { selectionRange && (
        <div
          role="toolbar"
          aria-label="Description formatting options"
          className="mb-2 flex flex-wrap items-center gap-1 rounded-md border border-border/70 bg-background/80 px-2 py-1 text-xs shadow-sm"
        >
          <div className="flex items-center gap-1">
            { inlineFormattingActions.map((action) => (
              <Button
                key={ action.label }
                variant="ghost"
                size="icon"
                type="button"
                aria-label={ action.label }
                onClick={ () => applyFormatting(action.formatter) }
                className="text-muted-foreground"
              >
                { action.icon }
              </Button>
            )) }
          </div>
          <div className="flex items-center gap-1 border-l border-border/40 px-2">
            { [1, 2, 3].map((level) => (
              <Button
                key={ `header-${ level }` }
                variant="ghost"
                size="sm"
                type="button"
                aria-label={ `Apply H${ level } heading` }
                className="px-2 text-[11px] font-semibold uppercase tracking-[0.08em]"
                onClick={ () => applyFormatting((value) => formatHeaderLevel(value, level)) }
              >
                H{ level }
              </Button>
            )) }
          </div>
          <div className="flex items-center gap-1 border-l border-border/40 px-2">
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label="Convert to bullet list"
              className="text-muted-foreground"
              onClick={ () => applyFormatting((value) => formatList(value, false)) }
            >
              <FiList aria-hidden="true" className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              aria-label="Convert to numbered list"
              className="px-2 text-[11px] font-semibold"
              onClick={ () => applyFormatting((value) => formatList(value, true)) }
            >
              1.
            </Button>
          </div>
        </div>
      ) }
      <Textarea
        { ...inputProps }
        ref={ setTextareaRef }
        rows={ 12 }
        className="min-h-[220px]"
        placeholder="Describe the space, vibe, or suitable use cases..."
        onBlur={ handleBlur }
        onMouseUp={ handleMouseUp }
        onSelect={ updateSelectionRange }
        onKeyUp={ handleKeyUp }
      />
    </div>
  );
}

type SpaceFormFieldsProps = {
  form: UseFormReturn<SpaceFormValues>;
};

export function SpaceDetailsFields({ form, }: SpaceFormFieldsProps) {
  return (
    <>
      <FormField
        control={ form.control }
        name="name"
        render={ ({ field, }) => (
          <FormItem>
            <FormLabel>Space name</FormLabel>
            <FormControl>
              <Input placeholder="Study Corner" { ...field } />
            </FormControl>
            <FormMessage />
          </FormItem>
        ) }
      />
      <FormField
        control={ form.control }
        name="description"
        render={ ({ field, }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <DescriptionTextarea field={ field } />
            </FormControl>
            <FormMessage />
          </FormItem>
        ) }
      />
    </>
  );
}

export function SpaceAddressFields({ form, }: SpaceFormFieldsProps) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          control={ form.control }
          name="unit_number"
          render={ ({ field, }) => (
            <FormItem>
              <FormLabel>Unit / Suite</FormLabel>
              <FormControl>
                <Input placeholder="Unit Number" { ...field } />
              </FormControl>
              <FormMessage />
            </FormItem>
          ) }
        />
        <FormField
          control={ form.control }
          name="address_subunit"
          render={ ({ field, }) => (
            <FormItem>
              <FormLabel>Address subunit</FormLabel>
              <FormControl>
                <Input placeholder="2F" { ...field } />
              </FormControl>
              <FormMessage />
            </FormItem>
          ) }
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          control={ form.control }
          name="street"
          render={ ({ field, }) => (
            <FormItem>
              <FormLabel>Street</FormLabel>
              <FormControl>
                <Input placeholder="661 San Marcelino" { ...field } />
              </FormControl>
              <FormMessage />
            </FormItem>
          ) }
        />
        <FormField
          control={ form.control }
          name="city"
          render={ ({ field, }) => (
            <FormItem>
              <FormLabel>City</FormLabel>
              <FormControl>
                <Input placeholder="Manila" { ...field } />
              </FormControl>
              <FormMessage />
            </FormItem>
          ) }
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <FormField
          control={ form.control }
          name="region"
          render={ ({ field, }) => (
            <FormItem>
              <FormLabel>Region / State</FormLabel>
              <FormControl>
                <Input placeholder="NCR" { ...field } />
              </FormControl>
              <FormMessage />
            </FormItem>
          ) }
        />
        <FormField
          control={ form.control }
          name="postal_code"
          render={ ({ field, }) => (
            <FormItem>
              <FormLabel>Postal code</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={ 4 }
                  placeholder="1000"
                  { ...field }
                  onChange={ (event) => {
                    const digits = event.target.value.replace(/\D/g, '');
                    field.onChange(digits.slice(0, 4));
                  } }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          ) }
        />
        <FormField
          control={ form.control }
          name="country_code"
          render={ ({ field, }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <FiLock className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>Country</span>
              </FormLabel>
              <FormControl>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Input
                      placeholder="PH"
                      maxLength={ 2 }
                      { ...field }
                      readOnly
                      value={ field.value?.toUpperCase() ?? '' }
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Currently available for coworking spaces in the Philippines.
                  </TooltipContent>
                </Tooltip>
              </FormControl>
              <FormMessage />
            </FormItem>
          ) }
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          control={ form.control }
          name="lat"
          render={ ({ field, }) => (
            <FormItem>
              <FormLabel>
                <div className="flex items-center gap-2">
                  <FiLock className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span>Latitude</span>
                </div>
              </FormLabel>
              <FormControl>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Input
                      type="number"
                      step="0.000001"
                      placeholder="37.791212"
                      { ...field }
                      readOnly
                      value={ field.value ?? '' }
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Latitude and longitude are determined by the address.
                  </TooltipContent>
                </Tooltip>
              </FormControl>
              <FormMessage />
            </FormItem>
          ) }
        />
        <FormField
          control={ form.control }
          name="long"
          render={ ({ field, }) => (
            <FormItem>
              <FormLabel>
                <div className="flex items-center gap-2">
                  <FiLock className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span>Longitude</span>
                </div>
              </FormLabel>
              <FormControl>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Input
                      type="number"
                      step="0.000001"
                      placeholder="-122.392756"
                      { ...field }
                      readOnly
                      value={ field.value ?? '' }
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Latitude and longitude are determined by the address.
                  </TooltipContent>
                </Tooltip>
              </FormControl>
              <FormMessage />
            </FormItem>
          ) }
        />
      </div>
    </>
  );
}

export function SpaceFormFields({ form, }: SpaceFormFieldsProps) {
  return (
    <>
      <SpaceDetailsFields form={ form } />
      <SpaceAddressFields form={ form } />
    </>
  );
}

type SchemaReferenceProps = {
  table: 'space' | 'area' | 'price_rate';
  column: string;
};

export function SchemaReference({
  table,
  column,
}: SchemaReferenceProps) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
      { table }.{ column }
    </span>
  );
}

type SpaceDialogProps = {
  open: boolean;
  mode: 'create' | 'edit';
  initialValues: SpaceFormValues;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: SpaceFormValues) => void;
};

export function SpaceDialog({
  open,
  mode,
  initialValues,
  onOpenChange,
  onSubmit,
}: SpaceDialogProps) {
  const form = useForm<SpaceFormValues>({
    resolver: zodResolver(spaceSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    form.reset(initialValues);
  }, [initialValues, form]);

  const close = () => onOpenChange(false);

  return (
    <Dialog open={ open } onOpenChange={ onOpenChange }>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{ mode === 'create' ? 'Add a new space' : 'Edit space' }</DialogTitle>
          <DialogDescription>
            Fill the required address and location details
          </DialogDescription>
        </DialogHeader>
        <Form { ...form }>
          <form className="space-y-6" onSubmit={ form.handleSubmit(onSubmit) }>
            <SpaceFormFields form={ form } />
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={ close }>
                Cancel
              </Button>
              <Button type="submit">
                { mode === 'create' ? 'Save space' : 'Update space' }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

type AreaDialogProps = {
  open: boolean;
  initialValues: AreaFormValues;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: AreaFormValues) => void;
  mode?: 'create' | 'edit';
};

export function AreaDialog({
  open,
  initialValues,
  onOpenChange,
  onSubmit,
  mode = 'create',
}: AreaDialogProps) {
  const form = useForm<AreaFormValues>({
    resolver: zodResolver(areaSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    form.reset(initialValues);
  }, [initialValues, form]);

  const close = () => onOpenChange(false);

  return (
    <Dialog open={ open } onOpenChange={ onOpenChange }>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ mode === 'edit' ? 'Edit area' : 'Add area' }</DialogTitle>
          <DialogDescription>Maps to <code>prisma.area</code> and <code>price_rate</code>.</DialogDescription>
        </DialogHeader>
        <Form { ...form }>
          <form className="space-y-4" onSubmit={ form.handleSubmit(onSubmit) }>
            <FormField
              control={ form.control }
              name="name"
          render={ ({ field, }) => (
            <FormItem>
              <FormLabel className="flex items-center justify-between">
                <span>Area name</span>
                <SchemaReference table="area" column="name" />
              </FormLabel>
              <FormControl>
                <Input placeholder="Boardroom A" { ...field } />
              </FormControl>
              <FormMessage />
            </FormItem>
          ) }
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={ form.control }
            name="min_capacity"
            render={ ({ field, }) => (
              <FormItem>
                <FormLabel className="flex items-center justify-between">
                  <span>Min capacity</span>
                  <SchemaReference table="area" column="min_capacity" />
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={ 1 }
                    placeholder="2"
                    value={ field.value ?? '' }
                    onChange={ (event) => field.onChange(event.target.value === '' ? undefined : Number(event.target.value)) }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            ) }
          />
          <FormField
            control={ form.control }
            name="max_capacity"
            render={ ({ field, }) => (
              <FormItem>
                <FormLabel className="flex items-center justify-between">
                  <span>Max capacity</span>
                  <SchemaReference table="area" column="max_capacity" />
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={ 1 }
                    placeholder="12"
                    value={ field.value ?? '' }
                    onChange={ (event) => field.onChange(event.target.value === '' ? undefined : Number(event.target.value)) }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            ) }
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={ form.control }
            name="rate_time_unit"
            render={ ({ field, }) => (
              <FormItem>
                <FormLabel className="flex items-center justify-between">
                  <span>Billing cadence</span>
                  <SchemaReference table="price_rate" column="time_unit" />
                </FormLabel>
                <Select value={ field.value } onValueChange={ field.onChange }>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select cadence" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    { rateUnits.map((unit) => (
                      <SelectItem key={ unit } value={ unit }>
                        { unit === 'hour' && 'Hourly' }
                        { unit === 'day' && 'Daily' }
                        { unit === 'week' && 'Weekly' }
                      </SelectItem>
                    )) }
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            ) }
          />
          <FormField
            control={ form.control }
            name="rate_amount"
            render={ ({ field, }) => (
              <FormItem>
                <FormLabel className="flex items-center justify-between">
                  <span>Rate (USD)</span>
                  <SchemaReference table="price_rate" column="price" />
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={ 0 }
                    step="0.01"
                    placeholder="150"
                    value={ field.value ?? '' }
                    onChange={ (event) => field.onChange(event.target.value === '' ? undefined : Number(event.target.value)) }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            ) }
          />
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={ close }>
                Cancel
              </Button>
              <Button type="submit">{ mode === 'edit' ? 'Update area' : 'Save area' }</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
