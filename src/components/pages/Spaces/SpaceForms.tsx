'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from 'react';
import type { KeyboardEvent } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ControllerRenderProps,
  useForm,
  useWatch,
  type UseFormReturn
} from 'react-hook-form';
import { z } from 'zod';
import {
  FiLoader,
  FiLock,
  FiMapPin,
  FiList,
  FiSlash
} from 'react-icons/fi';
import {
  LuAlignCenter,
  LuAlignJustify,
  LuAlignLeft,
  LuAlignRight,
  LuLink2,
  LuLink2Off,
  LuListOrdered,
  LuTable
} from 'react-icons/lu';
import type { ChainedCommands, Command } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';

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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { richTextPlainTextLength, sanitizeRichText } from '@/lib/rich-text';
import { useGoogleMapsPlaces } from '@/hooks/useGoogleMapsPlaces';

const rateUnits = ['hour', 'day', 'week'] as const;

const normalizeEditorHtml = (value?: string) => {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();
  if (trimmed === '<p><br></p>' || trimmed === '<div><br></div>') {
    return '';
  }

  return sanitizeRichText(value);
};

const ensureValidLinkHref = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
};

const DESCRIPTION_EDITOR_PLACEHOLDER = 'Describe the space, vibe, or suitable use cases...';
const DESCRIPTION_EDITOR_STYLES = [
  'prose prose-sm max-w-full focus-visible:outline-none',
  '[&_p]:m-0',
  '[&_h1]:m-0 [&_h1]:text-2xl [&_h1]:font-semibold',
  '[&_h2]:m-0 [&_h2]:text-xl [&_h2]:font-semibold',
  '[&_h3]:m-0 [&_h3]:text-lg [&_h3]:font-semibold',
  '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:marker:text-muted-foreground',
  '[&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1',
  '[&_table]:w-full [&_table]:border [&_table]:border-border/70 [&_table]:border-collapse [&_table]:rounded-md',
  '[&_th]:border [&_th]:border-border/70 [&_th]:bg-muted/60 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold',
  '[&_td]:border [&_td]:border-border/70 [&_td]:px-2 [&_td]:py-1 [&_td]:align-top'
].join(' ');

const TABLE_INSERT_DEFAULTS = {
  rows: 2,
  cols: 2,
  withHeaderRow: true,
} as const;

type TextAlignment = 'left' | 'center' | 'right' | 'justify';

const TEXT_ALIGNMENT_OPTIONS: ReadonlyArray<{
  value: TextAlignment;
  label: string;
  icon: typeof LuAlignLeft;
}> = [
  {
    value: 'left',
    label: 'Align left',
    icon: LuAlignLeft,
  },
  {
    value: 'center',
    label: 'Align center',
    icon: LuAlignCenter,
  },
  {
    value: 'right',
    label: 'Align right',
    icon: LuAlignRight,
  },
  {
    value: 'justify',
    label: 'Justify text',
    icon: LuAlignJustify,
  }
];

const GOOGLE_AUTOCOMPLETE_MIN_QUERY_LENGTH = 3;
const FORM_SET_OPTIONS = {
  shouldDirty: true,
  shouldValidate: true,
  shouldTouch: true,
} as const;

type AddressPrediction = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText?: string;
};

type ParsedAddressDetails = {
  street?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  countryCode?: string;
  lat?: number;
  lng?: number;
};

type Coordinates = {
  lat: number;
  lng: number;
};

const DEFAULT_MAP_CENTER: Coordinates = {
  lat: 14.5995,
  lng: 120.9842,
};

const toCoordinates = (lat?: number, lng?: number): Coordinates | null => {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return null;
  }

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  return {
    lat,
    lng,
  };
};

const getAddressComponentValue = (
  components: GooglePlaceAddressComponent[] | undefined,
  type: string,
  useShortName = false
) => {
  if (!components) {
    return '';
  }

  const component = components.find((entry) => entry.types.includes(type));
  if (!component) {
    return '';
  }

  return useShortName ? component.short_name : component.long_name;
};

const buildStreetLine = (components: GooglePlaceAddressComponent[] | undefined) => {
  const streetNumber = getAddressComponentValue(components, 'street_number');
  const route = getAddressComponentValue(components, 'route');
  return [streetNumber, route].filter(Boolean).join(' ').trim();
};

const parseGooglePlaceDetails = (
  details: GooglePlaceDetails,
  fallbackStreet: string
): ParsedAddressDetails => {
  const street = buildStreetLine(details.address_components) || fallbackStreet;
  const city =
    getAddressComponentValue(details.address_components, 'locality') ||
    getAddressComponentValue(details.address_components, 'sublocality') ||
    getAddressComponentValue(details.address_components, 'administrative_area_level_2');
  const region = getAddressComponentValue(details.address_components, 'administrative_area_level_1', true);
  const postalCode = getAddressComponentValue(details.address_components, 'postal_code');
  const countryCode = getAddressComponentValue(details.address_components, 'country', true);
  const lat = details.geometry?.location?.lat();
  const lng = details.geometry?.location?.lng();

  return {
    street,
    city,
    region,
    postalCode,
    countryCode,
    lat,
    lng,
  };
};

const formatCoordinate = (value: number | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined;
  }

  return Math.round(value * 1_000_000) / 1_000_000;
};

export const spaceSchema = z.object({
  name: z.string().min(1, 'Space name is required.'),
  description: z
    .preprocess(
      (value) => (typeof value === 'string' ? sanitizeRichText(value) : ''),
      z
        .string()
        .refine((value) => richTextPlainTextLength(value) >= 20, 'Describe the space in at least 20 characters.')
        .refine((value) => richTextPlainTextLength(value) <= 500, 'Keep the description under 500 characters.')
    ),
  amenities: z
    .array(z.string().min(1))
    .min(2, 'Select at least two amenities.'),
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

export const createSpaceFormDefaults = (): SpaceFormValues => ({
  ...SPACE_INPUT_DEFAULT,
  amenities: [...SPACE_INPUT_DEFAULT.amenities],
});

export const createAreaFormDefaults = (): AreaFormValues => ({ ...AREA_INPUT_DEFAULT, });

export const spaceRecordToFormValues = (space: SpaceRecord): SpaceFormValues => ({
  name: space.name,
  description: sanitizeRichText(space.description),
  unit_number: space.unit_number,
  address_subunit: space.address_subunit,
  street: space.street,
  city: space.city,
  region: space.region,
  postal_code: space.postal_code,
  country_code: space.country_code,
  lat: space.lat,
  long: space.long,
  amenities: [...space.amenities],
});

export const areaRecordToFormValues = (area: AreaRecord): AreaFormValues => ({
  name: area.name,
  min_capacity: area.min_capacity,
  max_capacity: area.max_capacity,
  rate_time_unit: area.rate_time_unit,
  rate_amount: area.rate_amount,
});

type DescriptionEditorProps = {
  field: ControllerRenderProps<SpaceFormValues, 'description'>;
};

function DescriptionEditor(props: DescriptionEditorProps) {
  const { field, } = props;
  const handlersRef = useRef({
    onChange: field.onChange,
    onBlur: field.onBlur,
  });
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkHref, setLinkHref] = useState('');

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3], }, }),
      Link.configure({
        autolink: true,
        linkOnPaste: true,
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'], }),
      Table.configure({
        allowTableNodeSelection: true,
        resizable: false,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: DESCRIPTION_EDITOR_PLACEHOLDER, })
    ],
    content: field.value ?? '',
    editorProps: {
      attributes: {
        class: DESCRIPTION_EDITOR_STYLES,
        role: 'textbox',
        'aria-label': 'Space description',
      },
    },
    onUpdate: ({ editor, }) => {
      handlersRef.current.onChange(normalizeEditorHtml(editor.getHTML()));
    },
    onBlur: () => {
      handlersRef.current.onBlur?.();
    },
  });

  useEffect(() => {
    handlersRef.current = {
      onChange: field.onChange,
      onBlur: field.onBlur,
    };
  }, [field]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const normalizedValue = field.value ?? '';
    const normalizedCurrent = normalizeEditorHtml(editor.getHTML());

    if (normalizedValue === normalizedCurrent) {
      return;
    }

    if (normalizedValue) {
      editor.commands.setContent(normalizedValue, false);
    } else {
      editor.commands.clearContent();
    }
  }, [editor, field.value]);

  if (!editor) {
    return (
      <div className="rounded-md border border-border/70">
        <div className="min-h-[220px]" />
      </div>
    );
  }

  const splitSelectionToBlockBoundaries: Command = ({
    tr,
    dispatch,
  }) => {
    const { selection, } = tr;

    if (!(selection instanceof TextSelection) || selection.empty) {
      return true;
    }

    let {
      from,
      to,
    } = selection;
    let modified = false;

    const selectionEndsMidBlock = () => {
      const $to = tr.doc.resolve(to);
      return (
        $to.parent.isTextblock &&
        $to.parentOffset > 0 &&
        $to.parentOffset < $to.parent.content.size
      );
    };

    const selectionStartsMidBlock = () => {
      const $from = tr.doc.resolve(from);
      return $from.parent.isTextblock && $from.parentOffset > 0;
    };

    if (selectionEndsMidBlock()) {
      tr.split(to);
      from = tr.mapping.map(from, 1);
      to = tr.mapping.map(to, 1);
      modified = true;
    }

    if (selectionStartsMidBlock()) {
      tr.split(from);
      from = tr.mapping.map(from, 1);
      to = tr.mapping.map(to, 1);
      modified = true;
    }

    if (modified) {
      tr.setSelection(TextSelection.create(tr.doc, from, to));
    }

    if (dispatch) {
      dispatch(tr);
    }

    return true;
  };

  const runBlockCommand = (execute: (chain: ChainedCommands) => ChainedCommands) => {
    const shouldNormalizeSelection =
      editor.state.selection instanceof TextSelection && !editor.state.selection.empty;

    let chain = editor.chain().focus();

    if (shouldNormalizeSelection) {
      chain = chain.command(splitSelectionToBlockBoundaries);
    }

    execute(chain).run();
  };

  const toggleHeading = (level?: number) => {
    runBlockCommand((chain) => (level ? chain.toggleHeading({ level, }) : chain.setParagraph()));
  };

  const toggleOrderedList = () => {
    runBlockCommand((chain) => chain.toggleOrderedList());
  };

  const toggleBulletList = () => {
    runBlockCommand((chain) => chain.toggleBulletList());
  };

  const toggleBold = () => {
    editor.chain().focus().toggleBold().run();
  };

  const toggleItalic = () => {
    editor.chain().focus().toggleItalic().run();
  };

  const toggleStrike = () => {
    editor.chain().focus().toggleStrike().run();
  };

  const setTextAlignment = (alignment: TextAlignment) => {
    runBlockCommand((chain) => chain.setTextAlign(alignment));
  };

  const isAlignmentActive = (alignment: TextAlignment) =>
    editor.isActive({ textAlign: alignment, });

  const handleLinkOpenChange = (open: boolean) => {
    if (open) {
      const currentHref = editor.getAttributes('link').href ?? '';
      setLinkHref(currentHref);
    }

    setLinkPopoverOpen(open);
  };

  const applyLink = () => {
    const nextHref = ensureValidLinkHref(linkHref);

    if (!nextHref) {
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({
        href: nextHref,
        target: '_blank',
        rel: 'noopener noreferrer',
      })
      .run();

    setLinkPopoverOpen(false);
  };

  const removeLink = () => {
    editor.chain().focus().unsetLink().run();
    setLinkHref('');
    setLinkPopoverOpen(false);
  };

  const insertTable = () => {
    editor.chain().focus().insertTable(TABLE_INSERT_DEFAULTS).run();
  };

  const addTableRowBelow = () => {
    editor.chain().focus().addRowAfter().run();
  };

  const addTableColumnAfter = () => {
    editor.chain().focus().addColumnAfter().run();
  };

  const deleteTableRow = () => {
    editor.chain().focus().deleteRow().run();
  };

  const deleteTableColumn = () => {
    editor.chain().focus().deleteColumn().run();
  };

  const deleteTable = () => {
    editor.chain().focus().deleteTable().run();
  };

  const clearFormatting = () => {
    editor.chain().focus().unsetAllMarks().clearNodes().run();
  };

  const isHeadingActive = (level?: number) =>
    level ? editor.isActive('heading', { level, }) : editor.isActive('paragraph');

  const isTableActive = editor.isActive('table');
  const isLinkActive = editor.isActive('link');
  const sanitizedLinkHref = ensureValidLinkHref(linkHref);
  const createCanChain = () => editor.can().chain().focus();
  const canInsertTable = createCanChain().insertTable(TABLE_INSERT_DEFAULTS).run();
  const canAddRowAfter = createCanChain().addRowAfter().run();
  const canAddColumnAfter = createCanChain().addColumnAfter().run();
  const canDeleteRow = createCanChain().deleteRow().run();
  const canDeleteColumn = createCanChain().deleteColumn().run();
  const canDeleteTable = createCanChain().deleteTable().run();
  const canApplyLink =
    sanitizedLinkHref.length > 0
      ? createCanChain()
        .extendMarkRange('link')
        .setLink({
          href: sanitizedLinkHref,
          target: '_blank',
          rel: 'noopener noreferrer',
        })
        .run()
      : false;
  const canRemoveLink = isLinkActive && createCanChain().unsetLink().run();

  return (
    <div className="rounded-md border border-border/70">
      <div className="border-b border-border/70 bg-muted px-3 py-2">
        <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Description formatting tools">
          { (['Normal', 'H1', 'H2', 'H3'] as const).map((label, index) => {
            const headingLevel = index === 0 ? undefined : index;
            return (
              <Tooltip key={ label }>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant={ isHeadingActive(headingLevel) ? 'outline' : 'ghost' }
                    className="min-w-[3rem] font-normal"
                    onClick={ () => toggleHeading(headingLevel) }
                    aria-pressed={ isHeadingActive(headingLevel) }
                    aria-label={ headingLevel ? `Heading ${headingLevel}` : 'Normal text' }
                  >
                    { label }
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  { headingLevel ? `Heading ${headingLevel}` : 'Normal text' }
                </TooltipContent>
              </Tooltip>
            );
          }) }
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant={ editor.isActive('bold') ? 'outline' : 'ghost' }
                onClick={ toggleBold }
                aria-pressed={ editor.isActive('bold') }
                aria-label="Bold"
              >
                B
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Bold</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant={ editor.isActive('italic') ? 'outline' : 'ghost' }
                onClick={ toggleItalic }
                aria-pressed={ editor.isActive('italic') }
                aria-label="Italic"
              >
                I
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Italic</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant={ editor.isActive('strike') ? 'outline' : 'ghost' }
                onClick={ toggleStrike }
                aria-pressed={ editor.isActive('strike') }
                aria-label="Strikethrough"
              >
                S
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Strikethrough</TooltipContent>
          </Tooltip>
          { TEXT_ALIGNMENT_OPTIONS.map(({
            value,
            label,
            icon: Icon,
          }) => (
            <Tooltip key={ value }>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant={ isAlignmentActive(value) ? 'outline' : 'ghost' }
                  onClick={ () => setTextAlignment(value) }
                  aria-pressed={ isAlignmentActive(value) }
                  aria-label={ label }
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span className="sr-only">{ label }</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{ label }</TooltipContent>
            </Tooltip>
          )) }
          <Popover open={ linkPopoverOpen } onOpenChange={ handleLinkOpenChange }>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant={ isLinkActive ? 'outline' : 'ghost' }
                    aria-pressed={ isLinkActive }
                    aria-label="Insert link"
                  >
                    <LuLink2 className="size-4" aria-hidden="true" />
                    <span className="sr-only">Insert link</span>
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">Insert link</TooltipContent>
            </Tooltip>
            <PopoverContent align="start" className="w-64 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="description-link-input">
                  Link URL
                </label>
                <Input
                  id="description-link-input"
                  value={ linkHref }
                  onChange={ (event) => setLinkHref(event.target.value) }
                  placeholder="https://example.com"
                  autoComplete="url"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" onClick={ applyLink } disabled={ !canApplyLink }>
                  Apply
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={ removeLink }
                  disabled={ !canRemoveLink }
                >
                  <LuLink2Off className="mr-2 size-4" aria-hidden="true" />
                  Remove
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant={ editor.isActive('bulletList') ? 'outline' : 'ghost' }
                onClick={ toggleBulletList }
                aria-pressed={ editor.isActive('bulletList') }
                aria-label="Bullet list"
              >
                <FiList className="size-4" aria-hidden="true" />
                <span className="sr-only">Bullet list</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Bullet list</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant={ editor.isActive('orderedList') ? 'outline' : 'ghost' }
                onClick={ toggleOrderedList }
                aria-pressed={ editor.isActive('orderedList') }
                aria-label="Numbered list"
              >
                <LuListOrdered className="size-4" aria-hidden="true" />
                <span className="sr-only">Numbered list</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Numbered list</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant={ isTableActive ? 'outline' : 'ghost' }
                    aria-pressed={ isTableActive }
                    aria-label="Table tools"
                  >
                    <LuTable className="size-4" aria-hidden="true" />
                    <span className="sr-only">Table tools</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">Table tools</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem
                onSelect={ () => insertTable() }
                disabled={ !canInsertTable }
              >
                Insert 2x2 table
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={ () => addTableRowBelow() }
                disabled={ !canAddRowAfter }
              >
                Add row below
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={ () => addTableColumnAfter() }
                disabled={ !canAddColumnAfter }
              >
                Add column to the right
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={ () => deleteTableRow() }
                disabled={ !canDeleteRow }
              >
                Delete row
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={ () => deleteTableColumn() }
                disabled={ !canDeleteColumn }
              >
                Delete column
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={ () => deleteTable() }
                disabled={ !canDeleteTable }
              >
                Delete table
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-sm font-normal"
                onClick={ clearFormatting }
                aria-label="Clear formatting"
              >
                <FiSlash className="size-4" aria-hidden="true" />
                <span className="sr-only">Clear formatting</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Clear formatting</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div className="bg-background px-3 py-3">
        <EditorContent
          editor={ editor }
          className="h-[500px] w-full overflow-auto border-none focus-visible:outline-none"
        />
      </div>
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
            <FormLabel>Description <span className="text-muted-foreground italic">(min. 20 characters)</span></FormLabel>
            <FormControl>
              <DescriptionEditor field={ field } />
            </FormControl>
            <FormMessage />
          </FormItem>
        ) }
      />
    </>
  );
}

type AddressAutocompleteInputProps = {
  form: UseFormReturn<SpaceFormValues>;
  field: ControllerRenderProps<SpaceFormValues, 'street'>;
};

function AddressAutocompleteInput({
  form,
  field,
}: AddressAutocompleteInputProps) {
  const {
    isReady,
    isLoading,
    isError,
    errorMessage,
  } = useGoogleMapsPlaces();
  const [predictions, setPredictions] = useState<AddressPrediction[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isFetchingPredictions, setIsFetchingPredictions] = useState(false);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const autocompleteServiceRef = useRef<GoogleAutocompleteService | null>(null);
  const placesServiceRef = useRef<GooglePlacesService | null>(null);
  const fetchTimeoutRef = useRef<number | null>(null);
  const blurTimeoutRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const latestQueryRef = useRef('');
  const listboxId = useId();

  useEffect(() => {
    if (!isReady || typeof window === 'undefined') {
      return;
    }

    const places = window.google?.maps?.places;
    if (!places) {
      return;
    }

    if (!autocompleteServiceRef.current) {
      autocompleteServiceRef.current = new places.AutocompleteService();
    }

    if (!placesServiceRef.current) {
      const container = document.createElement('div');
      placesServiceRef.current = new places.PlacesService(container);
    }
  }, [isReady]);

  useEffect(() => {
    return () => {
      if (fetchTimeoutRef.current) {
        window.clearTimeout(fetchTimeoutRef.current);
      }
      if (blurTimeoutRef.current) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    latestQueryRef.current = field.value ?? '';

    if (!isReady || !autocompleteServiceRef.current) {
      if (isFetchingPredictions) {
        setIsFetchingPredictions(false);
      }
      return;
    }

    if (fetchTimeoutRef.current) {
      window.clearTimeout(fetchTimeoutRef.current);
    }

    const trimmedValue = (field.value ?? '').trim();

    if (trimmedValue.length < GOOGLE_AUTOCOMPLETE_MIN_QUERY_LENGTH) {
      setPredictions([]);
      setIsFetchingPredictions(false);
      return;
    }

    setIsFetchingPredictions(true);
    let cancelled = false;

    fetchTimeoutRef.current = window.setTimeout(() => {
      const service = autocompleteServiceRef.current;
      if (!service) {
        setIsFetchingPredictions(false);
        return;
      }

      service.getPlacePredictions(
        {
          input: field.value ?? '',
          componentRestrictions: { country: (form.getValues('country_code') ?? 'PH').toUpperCase(), },
          types: ['geocode'],
        },
        (result, status) => {
          if (cancelled) {
            return;
          }

          setIsFetchingPredictions(false);

          if (status === 'OK' && result && result.length > 0) {
            setPredictions(
              result.map((prediction) => ({
                placeId: prediction.place_id,
                description: prediction.description,
                mainText: prediction.structured_formatting?.main_text ?? prediction.description,
                secondaryText: prediction.structured_formatting?.secondary_text,
              }))
            );
            setLocalError(null);
          } else if (status === 'ZERO_RESULTS') {
            setPredictions([]);
            setLocalError(null);
          } else if (status !== 'OK') {
            setPredictions([]);
            setLocalError('Unable to fetch address suggestions. Fill the address manually.');
          }
        }
      );
    }, 250);

    return () => {
      cancelled = true;
      if (fetchTimeoutRef.current) {
        window.clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [field.value, form, isReady, isFetchingPredictions]);

  useEffect(() => {
    if (predictions.length === 0) {
      setHighlightedIndex(-1);
    }
  }, [predictions.length]);

  const handlePredictionSelect = (prediction: AddressPrediction) => {
    if (!placesServiceRef.current) {
      return;
    }

    setIsFetchingDetails(true);
    setPredictions([]);
    setIsFocused(false);
    setHighlightedIndex(-1);
    setLocalError(null);

    placesServiceRef.current.getDetails(
      {
        placeId: prediction.placeId,
        fields: ['address_component', 'geometry', 'formatted_address'],
      },
      (details, status) => {
        setIsFetchingDetails(false);

        if (status !== 'OK' || !details) {
          setLocalError('Unable to load that address. Please fill in the details manually.');
          return;
        }

        const parsed = parseGooglePlaceDetails(details, prediction.description);
        form.setValue('street', parsed.street ?? prediction.description, FORM_SET_OPTIONS);
        form.setValue('city', parsed.city ?? '', FORM_SET_OPTIONS);
        form.setValue('region', parsed.region ?? '', FORM_SET_OPTIONS);
        form.setValue('postal_code', parsed.postalCode ?? '', FORM_SET_OPTIONS);
        form.setValue(
          'country_code',
          (parsed.countryCode ?? form.getValues('country_code') ?? 'PH').toUpperCase(),
          FORM_SET_OPTIONS
        );

        const parsedLat = formatCoordinate(parsed.lat);
        const parsedLong = formatCoordinate(parsed.lng);

        if (typeof parsedLat === 'number') {
          form.setValue('lat', parsedLat, FORM_SET_OPTIONS);
        }

        if (typeof parsedLong === 'number') {
          form.setValue('long', parsedLong, FORM_SET_OPTIONS);
        }

        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
      }
    );
  };

  const handleFocus = () => {
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current);
    }
    setIsFocused(true);
  };

  const handleBlur = () => {
    field.onBlur();
    blurTimeoutRef.current = window.setTimeout(() => {
      setIsFocused(false);
    }, 100);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!predictions.length) {
      if (event.key === 'Escape') {
        setPredictions([]);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % predictions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + predictions.length) % predictions.length);
    } else if (event.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < predictions.length) {
        event.preventDefault();
        handlePredictionSelect(predictions[highlightedIndex]);
      }
    } else if (event.key === 'Escape') {
      setPredictions([]);
      setHighlightedIndex(-1);
    }
  };

  const helperError = localError ?? (isError ? errorMessage : null);
  const helperText = helperError ?? (isLoading ? 'Loading Google Maps suggestions...' : null);
  const shouldShowSuggestions =
    isReady && isFocused && (predictions.length > 0 || isFetchingPredictions);

  return (
    <>
      <FormControl>
        <div className="relative">
          <Input
            ref={ (node) => {
              field.ref(node);
              inputRef.current = node;
            } }
            id={ field.name }
            name={ field.name }
            value={ field.value ?? '' }
            placeholder="661 San Marcelino"
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls={ shouldShowSuggestions ? listboxId : undefined }
            aria-expanded={ shouldShowSuggestions }
            aria-activedescendant={
              highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined
            }
            role="combobox"
            className="pr-10"
            onFocus={ handleFocus }
            onBlur={ handleBlur }
            onChange={ (event) => {
              setLocalError(null);
              field.onChange(event);
            } }
            onKeyDown={ handleKeyDown }
          />
          { isFetchingDetails && (
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
              <FiLoader className="size-4 animate-spin" aria-hidden="true" />
            </div>
          ) }
          { shouldShowSuggestions && (
            <div
              className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-border/70 bg-popover text-popover-foreground shadow-lg"
              role="presentation"
            >
              <ul
                id={ listboxId }
                role="listbox"
                aria-label="Address suggestions"
                className="max-h-56 overflow-auto py-1"
              >
                { predictions.map((prediction, index) => (
                  <li key={ prediction.placeId }>
                    <button
                      type="button"
                      id={ `${listboxId}-option-${index}` }
                      role="option"
                      aria-selected={ highlightedIndex === index }
                      className={ [
                        'flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors',
                        highlightedIndex === index ? 'bg-muted' : 'hover:bg-muted/60'
                      ].join(' ') }
                      onMouseDown={ (event) => event.preventDefault() }
                      onClick={ () => handlePredictionSelect(prediction) }
                    >
                      <FiMapPin className="mt-1 size-4 text-primary" aria-hidden="true" />
                      <span className="flex flex-col">
                        <span className="font-medium">{ prediction.mainText }</span>
                        { prediction.secondaryText && (
                          <span className="text-xs text-muted-foreground">{ prediction.secondaryText }</span>
                        ) }
                      </span>
                    </button>
                  </li>
                )) }
                { isFetchingPredictions && (
                  <li className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                    <FiLoader className="size-4 animate-spin" aria-hidden="true" />
                    <span>Loading suggestions...</span>
              </li>
            ) }
              </ul>
              <div className="border-t border-border/50 px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                Powered by Google
              </div>
            </div>
          ) }
        </div>
      </FormControl>
      { helperText && (
        <FormDescription className={ helperError ? 'text-destructive' : undefined }>
          { helperText }
        </FormDescription>
      ) }
    </>
  );
}

type PinLocationDialogProps = {
  open: boolean;
  initialLat?: number;
  initialLong?: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: (coordinates: Coordinates) => void;
};

function PinLocationDialog({
  open,
  initialLat,
  initialLong,
  onOpenChange,
  onConfirm,
}: PinLocationDialogProps) {
  const {
    isReady,
    isLoading,
    isError,
    errorMessage,
  } = useGoogleMapsPlaces();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<GoogleMapsMap | null>(null);
  const markerRef = useRef<GoogleMapsMarker | null>(null);
  const clickListenerRef = useRef<GoogleMapsEventListener | null>(null);
  const normalizedInitial = useMemo(() => toCoordinates(initialLat, initialLong), [initialLat, initialLong]);
  const [selectedPosition, setSelectedPosition] = useState<Coordinates | null>(normalizedInitial);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedPosition(normalizedInitial);
  }, [open, normalizedInitial]);

  useEffect(() => {
    if (!open || !isReady || typeof window === 'undefined') {
      return;
    }

    const maps = window.google?.maps;
    if (!maps?.Map || !mapContainerRef.current) {
      return;
    }

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new maps.Map(mapContainerRef.current, {
        center: normalizedInitial ?? DEFAULT_MAP_CENTER,
        zoom: normalizedInitial ? 17 : 12,
        disableDefaultUI: true,
        zoomControl: true,
      });
    }

    if (!markerRef.current && mapInstanceRef.current) {
      markerRef.current = new maps.Marker({
        map: mapInstanceRef.current,
        position: normalizedInitial ?? DEFAULT_MAP_CENTER,
      });
    }

    const target = selectedPosition ?? normalizedInitial ?? DEFAULT_MAP_CENTER;
    mapInstanceRef.current.setCenter(target);
    mapInstanceRef.current.setZoom(selectedPosition ? 17 : normalizedInitial ? 15 : 12);
    markerRef.current?.setPosition(target);
  }, [open, isReady, normalizedInitial, selectedPosition]);

  useEffect(() => {
    if (!open || !isReady || !mapInstanceRef.current) {
      return;
    }

    if (clickListenerRef.current) {
      clickListenerRef.current.remove();
      clickListenerRef.current = null;
    }

    const listener = mapInstanceRef.current.addListener('click', (event) => {
      if (!event.latLng) {
        return;
      }

      const lat = formatCoordinate(event.latLng.lat());
      const lng = formatCoordinate(event.latLng.lng());

      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return;
      }

      const next = {
        lat,
        lng,
      };
      setSelectedPosition(next);
      markerRef.current?.setPosition(next);
    });

    clickListenerRef.current = listener;

    return () => {
      listener.remove();
      clickListenerRef.current = null;
    };
  }, [open, isReady]);

  useEffect(() => {
    if (!open) {
      return;
    }

    return () => {
      if (clickListenerRef.current) {
        clickListenerRef.current.remove();
        clickListenerRef.current = null;
      }
    };
  }, [open]);

  const confirmDisabled = !selectedPosition;

  const handleConfirm = () => {
    if (!selectedPosition) {
      return;
    }

    onConfirm(selectedPosition);
    onOpenChange(false);
  };

  const helperText = isError
    ? errorMessage ?? 'Unable to load Google Maps. Try again later or continue without pinning the location.'
    : 'Click on the map to drop a pin at the entrance of the space.';

  return (
    <Dialog open={ open } onOpenChange={ onOpenChange }>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pin exact location</DialogTitle>
          <DialogDescription>
            { helperText }
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative h-[320px] w-full overflow-hidden rounded-md border border-border/70 bg-muted">
            <div ref={ mapContainerRef } className="absolute inset-0" />
            { (!isReady || isError) && (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
                { isError ? (errorMessage ?? 'Google Maps is unavailable right now.') : 'Loading Google Maps...' }
              </div>
            ) }
          </div>
          { selectedPosition && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Selected pin:</span>{ ' ' }
              <span className="font-mono">
                { selectedPosition.lat.toFixed(6) }, { selectedPosition.lng.toFixed(6) }
              </span>
            </div>
          ) }
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={ () => onOpenChange(false) }>
            Cancel
          </Button>
          <Button type="button" onClick={ handleConfirm } disabled={ confirmDisabled || isError || isLoading }>
            Use this location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SpaceAddressFields({ form, }: SpaceFormFieldsProps) {
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const latValue = useWatch<SpaceFormValues, 'lat'>({
    control: form.control,
    name: 'lat',
    defaultValue: form.getValues('lat'),
  });
  const longValue = useWatch<SpaceFormValues, 'long'>({
    control: form.control,
    name: 'long',
    defaultValue: form.getValues('long'),
  });

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
              <AddressAutocompleteInput form={ form } field={ field } />
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
                    Latitude and longitude are determined by the address or by pinning the map.
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
                    Latitude and longitude are determined by the address or by pinning the map.
                  </TooltipContent>
                </Tooltip>
              </FormControl>
              <FormMessage />
            </FormItem>
          ) }
        />
      </div>
      <div className="space-y-2">
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={ () => setPinDialogOpen(true) }>
          <FiMapPin className="mr-2 size-4" aria-hidden="true" />
          Pin exact location
        </Button>
        <p className="text-sm text-muted-foreground">
          Drop a pin on the map to fine-tune the coordinates travelers will receive.
        </p>
      </div>
      <PinLocationDialog
        open={ pinDialogOpen }
        onOpenChange={ setPinDialogOpen }
        initialLat={ typeof latValue === 'number' ? latValue : undefined }
        initialLong={ typeof longValue === 'number' ? longValue : undefined }
        onConfirm={ ({
          lat,
          lng,
        }) => {
          form.setValue('lat', lat, FORM_SET_OPTIONS);
          form.setValue('long', lng, FORM_SET_OPTIONS);
        } }
      />
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
