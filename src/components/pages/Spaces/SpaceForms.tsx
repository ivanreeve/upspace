'use client';

import {
  useCallback,
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
import { useQuery } from '@tanstack/react-query';
import {
  FiLoader,
  FiLock,
  FiMapPin,
  FiList,
  FiSearch,
  FiSlash
} from 'react-icons/fi';
import { BiCurrentLocation } from 'react-icons/bi';
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
import { zipcodes as philippineZipcodes } from 'ph-zipcode-lookup';

import {
  AREA_INPUT_DEFAULT,
  AreaRecord,
  cloneWeeklyAvailability,
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
import {
  fetchPhilippineBarangaysByCity,
  fetchPhilippineCitiesByRegion,
  fetchPhilippineRegions,
  type PhilippineBarangayOption,
  type PhilippineCityOption,
  type PhilippineRegionOption
} from '@/lib/philippines-addresses/client';
import {
  areaSchema,
  rateUnits,
  spaceSchema,
  type AreaFormValues,
  type SpaceFormValues
} from '@/lib/validations/spaces';

const DESCRIPTION_EDITOR_PLACEHOLDER = 'Describe what makes this space unique, amenities available, and any booking requirements (min. 20 characters).';
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

const formatCoordinate = (value: number | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined;
  }

  return Math.round(value * 1_000_000) / 1_000_000;
};

const dedupeAddressOptions = <T extends { code: string; name: string }>(options: readonly T[]) => {
  const seen = new Set<string>();
  return options.filter((option) => {
    const identifier = `${option.code}-${option.name}`.trim().toLowerCase();
    if (seen.has(identifier)) {
      return false;
    }
    seen.add(identifier);
    return true;
  });
};
const GOOGLE_AUTOCOMPLETE_MIN_QUERY_LENGTH = 3;
const FORM_SET_OPTIONS = {
  shouldDirty: true,
  shouldValidate: true,
  shouldTouch: true,
} as const;
const SUPPORTED_COUNTRIES = [
  {
    code: 'PH',
    name: 'Philippines',
  }
] as const;

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

const TABLE_INSERT_DEFAULTS = {
  rows: 2,
  cols: 2,
  withHeaderRow: true,
} as const;

export const createSpaceFormDefaults = (): SpaceFormValues => ({
  ...SPACE_INPUT_DEFAULT,
  amenities: [...SPACE_INPUT_DEFAULT.amenities],
  availability: cloneWeeklyAvailability(SPACE_INPUT_DEFAULT.availability),
});

export const createAreaFormDefaults = (): AreaFormValues => ({ ...AREA_INPUT_DEFAULT, });

export const spaceRecordToFormValues = (space: SpaceRecord): SpaceFormValues => ({
  name: space.name,
  description: sanitizeRichText(space.description),
  unit_number: space.unit_number,
  address_subunit: space.address_subunit,
  street: space.street,
  barangay: space.barangay ?? '',
  city: space.city,
  region: space.region,
  postal_code: space.postal_code,
  country_code: space.country_code,
  lat: space.lat,
  long: space.long,
  amenities: [...space.amenities],
  availability: cloneWeeklyAvailability(space.availability),
});

export const areaRecordToFormValues = (area: AreaRecord): AreaFormValues => ({
  name: area.name,
  min_capacity: area.min_capacity,
  max_capacity: area.max_capacity,
  rate_time_unit: area.rate_time_unit,
  rate_amount: area.rate_amount,
});

export type DescriptionEditorProps<TFieldValues extends { description: string }> = {
  field: ControllerRenderProps<TFieldValues, 'description'>;
};

export function DescriptionEditor<TFieldValues extends { description: string }>(props: DescriptionEditorProps<TFieldValues>) {
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

type PinLocationDialogProps = {
  open: boolean;
  initialLat?: number;
  initialLong?: number;
  countryCode?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (coordinates: Coordinates) => void;
};

function PinLocationDialog({
  open,
  initialLat,
  initialLong,
  countryCode,
  onOpenChange,
  onConfirm,
}: PinLocationDialogProps) {
  const {
    isReady,
    isLoading,
    isError,
    errorMessage,
  } = useGoogleMapsPlaces();
  const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null);
  const handleMapContainerRef = useCallback((node: HTMLDivElement | null) => {
    setMapContainer((prev) => (prev === node ? prev : node));
  }, []);
  const mapInstanceRef = useRef<GoogleMapsMap | null>(null);
  const mapInstanceContainerRef = useRef<Element | null>(null);
  const markerRef = useRef<GoogleMapsMarker | null>(null);
  const clickListenerRef = useRef<GoogleMapsEventListener | null>(null);
  const autocompleteServiceRef = useRef<GoogleAutocompleteService | null>(null);
  const placesServiceRef = useRef<GooglePlacesService | null>(null);
  const searchListboxId = useId();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchFetchTimeoutRef = useRef<number | null>(null);
  const searchBlurTimeoutRef = useRef<number | null>(null);
  const normalizedInitial = useMemo(() => toCoordinates(initialLat, initialLong), [initialLat, initialLong]);
  const [selectedPosition, setSelectedPosition] = useState<Coordinates | null>(normalizedInitial);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPredictions, setSearchPredictions] = useState<AddressPrediction[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchHighlightedIndex, setSearchHighlightedIndex] = useState(-1);
  const [isFetchingSearchPredictions, setIsFetchingSearchPredictions] = useState(false);
  const [isFetchingSearchDetails, setIsFetchingSearchDetails] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [isGeolocationSupported, setIsGeolocationSupported] = useState(false);

  const normalizedCountry = (countryCode ?? 'PH').toUpperCase();

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
    if (typeof window === 'undefined') {
      return;
    }

    setIsGeolocationSupported('geolocation' in window.navigator);
  }, []);

  useEffect(() => () => {
    if (searchFetchTimeoutRef.current) {
      window.clearTimeout(searchFetchTimeoutRef.current);
    }
    if (searchBlurTimeoutRef.current) {
      window.clearTimeout(searchBlurTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (!isReady || !autocompleteServiceRef.current) {
      if (isFetchingSearchPredictions) {
        setIsFetchingSearchPredictions(false);
      }
      return;
    }

    if (searchFetchTimeoutRef.current) {
      window.clearTimeout(searchFetchTimeoutRef.current);
    }

    const trimmed = searchQuery.trim();
    if (trimmed.length < GOOGLE_AUTOCOMPLETE_MIN_QUERY_LENGTH) {
      setSearchPredictions([]);
      setIsFetchingSearchPredictions(false);
      setSearchError(null);
      return;
    }

    setIsFetchingSearchPredictions(true);
    let cancelled = false;

    searchFetchTimeoutRef.current = window.setTimeout(() => {
      const service = autocompleteServiceRef.current;
      if (!service) {
        setIsFetchingSearchPredictions(false);
        return;
      }

      service.getPlacePredictions(
        {
          input: trimmed,
          componentRestrictions: { country: normalizedCountry, },
        },
        (result, status) => {
          if (cancelled) {
            return;
          }

          setIsFetchingSearchPredictions(false);

          if (status === 'OK' && result && result.length > 0) {
            setSearchPredictions(
              result.map((prediction) => ({
                placeId: prediction.place_id,
                description: prediction.description,
                mainText: prediction.structured_formatting?.main_text ?? prediction.description,
                secondaryText: prediction.structured_formatting?.secondary_text,
              }))
            );
            setSearchError(null);
          } else if (status === 'ZERO_RESULTS') {
            setSearchPredictions([]);
            setSearchError(null);
          } else if (status !== 'OK') {
            setSearchPredictions([]);
            setSearchError('Unable to search Google Maps right now. Try again in a moment.');
          }
        }
      );
    }, 250);

    return () => {
      cancelled = true;
      if (searchFetchTimeoutRef.current) {
        window.clearTimeout(searchFetchTimeoutRef.current);
      }
    };
  }, [isReady, searchQuery, normalizedCountry, isFetchingSearchPredictions]);

  useEffect(() => {
    if (searchPredictions.length === 0) {
      setSearchHighlightedIndex(-1);
    }
  }, [searchPredictions.length]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedPosition(normalizedInitial);
  }, [open, normalizedInitial]);

  useEffect(() => {
    if (open) {
      return;
    }

    setSearchQuery('');
    setSearchPredictions([]);
    setIsSearchFocused(false);
    setSearchHighlightedIndex(-1);
    setSearchError(null);
  }, [open]);

  useEffect(() => {
    if (!open || !isReady || typeof window === 'undefined' || !mapContainer) {
      return;
    }

    const maps = window.google?.maps;
    if (!maps?.Map) {
      return;
    }

    if (mapInstanceRef.current && mapInstanceContainerRef.current !== mapContainer) {
      mapInstanceRef.current = null;
      mapInstanceContainerRef.current = null;
      markerRef.current = null;
    }

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new maps.Map(mapContainer, {
        center: normalizedInitial ?? DEFAULT_MAP_CENTER,
        zoom: normalizedInitial ? 17 : 12,
        disableDefaultUI: true,
        zoomControl: true,
      });
      mapInstanceContainerRef.current = mapContainer;
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

    clickListenerRef.current?.remove();

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
  }, [open, isReady, normalizedInitial, selectedPosition, mapContainer]);

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

  const handleSearchPredictionSelect = (prediction: AddressPrediction) => {
    if (!placesServiceRef.current) {
      return;
    }

    setIsFetchingSearchDetails(true);
    setSearchPredictions([]);
    setIsSearchFocused(false);
    setSearchHighlightedIndex(-1);
    setSearchQuery(prediction.description);
    setSearchError(null);

    placesServiceRef.current.getDetails(
      {
        placeId: prediction.placeId,
        fields: ['geometry'],
      },
      (details, status) => {
        setIsFetchingSearchDetails(false);

        if (status !== 'OK' || !details?.geometry?.location) {
          setSearchError('Unable to load that place. Try clicking on the map instead.');
          return;
        }

        const lat = formatCoordinate(details.geometry.location.lat());
        const lng = formatCoordinate(details.geometry.location.lng());

        if (typeof lat !== 'number' || typeof lng !== 'number') {
          setSearchError('Unable to determine that location.');
          return;
        }

        const coordinates = {
          lat,
          lng,
        };
        setSelectedPosition(coordinates);
        markerRef.current?.setPosition(coordinates);
        mapInstanceRef.current?.setCenter(coordinates);
        mapInstanceRef.current?.setZoom(17);
      }
    );
  };

  const handleUseCurrentLocation = () => {
    if (isLocatingUser || typeof window === 'undefined') {
      return;
    }

    const geolocation = window.navigator?.geolocation;

    if (!geolocation) {
      setSearchError('Location access is not available in this browser.');
      return;
    }

    setIsLocatingUser(true);
    setSearchPredictions([]);
    setIsSearchFocused(false);
    setSearchHighlightedIndex(-1);
    setSearchError(null);

    geolocation.getCurrentPosition(
      (position) => {
        setIsLocatingUser(false);
        const lat = formatCoordinate(position.coords.latitude);
        const lng = formatCoordinate(position.coords.longitude);

        if (typeof lat !== 'number' || typeof lng !== 'number') {
          setSearchError('Unable to determine your current location. Try searching instead.');
          return;
        }

        const coordinates = {
          lat,
          lng,
        };
        setSelectedPosition(coordinates);
        markerRef.current?.setPosition(coordinates);
        mapInstanceRef.current?.setCenter(coordinates);
        mapInstanceRef.current?.setZoom(17);
        setSearchQuery('Current location');
      },
      (error: GeolocationPositionError) => {
        setIsLocatingUser(false);
        let message = 'Unable to fetch your current location. Try searching instead.';
        if (error.code === error.PERMISSION_DENIED) {
          message = 'Location access was blocked. Allow it in your browser settings and try again.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = 'Your location is unavailable. Try again in a moment or search manually.';
        } else if (error.code === error.TIMEOUT) {
          message = 'Getting your current location took too long. Please try again.';
        }
        setSearchError(message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleSearchFocus = () => {
    if (searchBlurTimeoutRef.current) {
      window.clearTimeout(searchBlurTimeoutRef.current);
    }
    setIsSearchFocused(true);
  };

  const handleSearchBlur = () => {
    searchBlurTimeoutRef.current = window.setTimeout(() => {
      setIsSearchFocused(false);
    }, 100);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!searchPredictions.length) {
      if (event.key === 'Escape') {
        setSearchPredictions([]);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSearchHighlightedIndex((prev) => (prev + 1) % searchPredictions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSearchHighlightedIndex((prev) => (prev - 1 + searchPredictions.length) % searchPredictions.length);
    } else if (event.key === 'Enter') {
      if (searchHighlightedIndex >= 0 && searchHighlightedIndex < searchPredictions.length) {
        event.preventDefault();
        handleSearchPredictionSelect(searchPredictions[searchHighlightedIndex]);
      }
    } else if (event.key === 'Escape') {
      setSearchPredictions([]);
      setSearchHighlightedIndex(-1);
    }
  };

  const shouldShowSearchSuggestions =
    isReady &&
    isSearchFocused &&
    (searchPredictions.length > 0 || isFetchingSearchPredictions);

  const searchHelperText = searchError
    ?? (isError ? (errorMessage ?? 'Google Maps search is unavailable right now.') : 'Search Google Maps to jump to your building or landmark.');
  const isSearchHelperError = Boolean(searchError) || isError;
  const locationButtonLabel = isLocatingUser ? 'Locating your current position...' : 'Use my current location';
  const locationButtonDisabled = !isGeolocationSupported || isLocatingUser;
  const locationButtonTitle = !isGeolocationSupported
    ? 'Location access is not available in this browser.'
    : locationButtonLabel;

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
          <div className="space-y-1">
            <label htmlFor="pin-location-search" className="text-sm font-medium text-foreground">
              Search places
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Input
                  id="pin-location-search"
                  ref={ (node) => {
                    searchInputRef.current = node;
                  } }
                  placeholder="Ayala North Exchange"
                  value={ searchQuery }
                  autoComplete="off"
                  disabled={ !isReady || isError }
                  aria-autocomplete="list"
                  aria-controls={ shouldShowSearchSuggestions ? searchListboxId : undefined }
                  aria-expanded={ shouldShowSearchSuggestions }
                  aria-activedescendant={
                    searchHighlightedIndex >= 0 ? `${searchListboxId}-option-${searchHighlightedIndex}` : undefined
                  }
                  role="combobox"
                  className="w-full pl-10 pr-12"
                  onFocus={ handleSearchFocus }
                  onBlur={ handleSearchBlur }
                  onChange={ (event) => {
                    setSearchError(null);
                    setSearchQuery(event.target.value);
                  } }
                  onKeyDown={ handleSearchKeyDown }
                />
                <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                  <FiSearch className="size-4" aria-hidden="true" />
                </div>
                { isFetchingSearchDetails && (
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
                    <FiLoader className="size-4 animate-spin" aria-hidden="true" />
                  </div>
                ) }
                { shouldShowSearchSuggestions && (
                  <div
                    className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-border/70 bg-popover text-popover-foreground shadow-lg"
                    role="presentation"
                  >
                    <ul
                      id={ searchListboxId }
                      role="listbox"
                      aria-label="Map search suggestions"
                      className="max-h-56 overflow-auto py-1"
                    >
                      { searchPredictions.map((prediction, index) => (
                        <li key={ prediction.placeId }>
                          <button
                            type="button"
                            id={ `${searchListboxId}-option-${index}` }
                            role="option"
                            aria-selected={ searchHighlightedIndex === index }
                            className={ [
                              'flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors',
                              searchHighlightedIndex === index ? 'bg-muted' : 'hover:bg-muted/60'
                            ].join(' ') }
                            onMouseDown={ (event) => event.preventDefault() }
                            onClick={ () => handleSearchPredictionSelect(prediction) }
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
                      { isFetchingSearchPredictions && (
                        <li className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                          <FiLoader className="size-4 animate-spin" aria-hidden="true" />
                          <span>Searching Google Maps...</span>
                        </li>
                      ) }
                    </ul>
                    <div className="border-t border-border/50 px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      Powered by Google
                    </div>
                  </div>
                ) }
              </div>
              <Button
                type="button"
                variant="outline"
                className="shrink-0 gap-2 whitespace-nowrap"
                onClick={ handleUseCurrentLocation }
                disabled={ locationButtonDisabled }
                title={ locationButtonTitle }
              >
                { isLocatingUser
                  ? (
                    <>
                      <FiLoader className="size-4 animate-spin" aria-hidden="true" />
                    </>
                    )
                  : (
                    <>
                      <BiCurrentLocation className="size-4" aria-hidden="true" />
                    </>
                    ) }
              </Button>
            </div>
            <p className={ `text-xs ${isSearchHelperError ? 'text-destructive' : 'text-muted-foreground'}` }>
              { searchHelperText }
            </p>
          </div>
          <div className="relative h-[320px] w-full overflow-hidden rounded-md border border-border/70 bg-muted">
            <div ref={ handleMapContainerRef } className="absolute inset-0" />
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
  const countryCodeValue = useWatch<SpaceFormValues, 'country_code'>({
    control: form.control,
    name: 'country_code',
    defaultValue: form.getValues('country_code'),
  });
  const regionValue = useWatch<SpaceFormValues, 'region'>({
    control: form.control,
    name: 'region',
    defaultValue: form.getValues('region'),
  });
  const cityValue = useWatch<SpaceFormValues, 'city'>({
    control: form.control,
    name: 'city',
    defaultValue: form.getValues('city'),
  });
  const barangayValue = useWatch<SpaceFormValues, 'barangay'>({
    control: form.control,
    name: 'barangay',
    defaultValue: form.getValues('barangay'),
  });

  const normalizedCountryCode = (countryCodeValue ?? '').toUpperCase();
  const isPhilippines = normalizedCountryCode === 'PH';

  const {
    data: regionOptions = [],
    isLoading: isRegionsLoading,
    isError: isRegionsError,
  } = useQuery<PhilippineRegionOption[]>({
    queryKey: ['philippines', 'regions'],
    queryFn: fetchPhilippineRegions,
    enabled: isPhilippines,
    staleTime: 1000 * 60 * 60 * 24,
  });

  const selectedRegion = useMemo(
    () => regionOptions.find((region) => region.name === regionValue),
    [regionOptions, regionValue]
  );

  const regionCodeForQuery = selectedRegion?.code;
  const {
    data: cityOptions = [],
    isLoading: isCitiesLoading,
    isError: isCitiesError,
  } = useQuery<PhilippineCityOption[]>({
    queryKey: ['philippines', 'cities', regionCodeForQuery],
    queryFn: () => {
      if (!regionCodeForQuery) {
        return Promise.resolve<PhilippineCityOption[]>([]);
      }

      return fetchPhilippineCitiesByRegion(regionCodeForQuery);
    },
    enabled: Boolean(regionCodeForQuery),
    staleTime: 1000 * 60 * 30,
  });

  const dedupedCityOptions = useMemo(() => dedupeAddressOptions(cityOptions), [cityOptions]);

  const selectedCity = useMemo(
    () => dedupedCityOptions.find((city) => city.name === cityValue),
    [dedupedCityOptions, cityValue]
  );

  const cityCodeForQuery = selectedCity?.code;
  const {
    data: barangayOptions = [],
    isLoading: isBarangaysLoading,
    isError: isBarangaysError,
  } = useQuery<PhilippineBarangayOption[]>({
    queryKey: ['philippines', 'barangays', cityCodeForQuery],
    queryFn: () => {
      if (!cityCodeForQuery) {
        return Promise.resolve<PhilippineBarangayOption[]>([]);
      }

      return fetchPhilippineBarangaysByCity(cityCodeForQuery);
    },
    enabled: Boolean(cityCodeForQuery),
    staleTime: 1000 * 60 * 30,
  });

  const regionDisabled = !isPhilippines || isRegionsLoading;
  const cityDisabled = !selectedRegion || isCitiesLoading;
  const dedupedBarangayOptions = useMemo(() => dedupeAddressOptions(barangayOptions), [barangayOptions]);
  const barangayDisabled = !selectedCity || isBarangaysLoading || dedupedBarangayOptions.length === 0;

  useEffect(() => {
    if (!isPhilippines) {
      return;
    }

    const currentPostalCode = form.getValues('postal_code');
    const trimmedBarangay = barangayValue?.trim();
    const trimmedCity = cityValue?.trim();

    if (!trimmedBarangay && !trimmedCity) {
      if (currentPostalCode !== '') {
        form.setValue('postal_code', '', FORM_SET_OPTIONS);
      }
      return;
    }

    let resolvedPostal = trimmedBarangay ? philippineZipcodes.findZipcode(trimmedBarangay) : null;
    if ((!resolvedPostal || resolvedPostal.trim() === '') && trimmedCity) {
      resolvedPostal = philippineZipcodes.findZipcode(trimmedCity);
    }
    if (typeof resolvedPostal === 'string' && resolvedPostal.trim() !== '') {
      const digitsOnly = resolvedPostal.replace(/\D/g, '').padStart(4, '0').slice(0, 4);
      if (digitsOnly && digitsOnly !== currentPostalCode) {
        form.setValue('postal_code', digitsOnly, FORM_SET_OPTIONS);
      }
      return;
    }

    if (currentPostalCode !== '') {
      form.setValue('postal_code', '', FORM_SET_OPTIONS);
    }
  }, [barangayValue, cityValue, form, isPhilippines]);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
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
                <Select
                  value={ field.value ?? '' }
                  onValueChange={ (value) => {
                    const normalized = (value ?? '').toUpperCase();
                    field.onChange(normalized);
                    form.setValue('region', '', FORM_SET_OPTIONS);
                    form.setValue('city', '', FORM_SET_OPTIONS);
                    form.setValue('barangay', '', FORM_SET_OPTIONS);
                    form.setValue('postal_code', '', FORM_SET_OPTIONS);
                  } }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Philippines" />
                  </SelectTrigger>
                  <SelectContent>
                    { SUPPORTED_COUNTRIES.map((country) => (
                      <SelectItem key={ country.code } value={ country.code }>
                        { country.name }
                      </SelectItem>
                    )) }
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          ) }
        />
        <FormField
          control={ form.control }
          name="region"
          render={ ({ field, }) => (
            <FormItem>
              <FormLabel>Region / State</FormLabel>
              <FormControl>
                <Select
                  value={ field.value ?? '' }
                  onValueChange={ (value) => {
                    field.onChange(value);
                    form.setValue('city', '', FORM_SET_OPTIONS);
                    form.setValue('barangay', '', FORM_SET_OPTIONS);
                    form.setValue('postal_code', '', FORM_SET_OPTIONS);
                  } }
                  disabled={ regionDisabled }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={ isRegionsLoading ? 'Loading regions...' : 'Select region / state' } />
                  </SelectTrigger>
                  <SelectContent>
                    { isRegionsError && (
                      <SelectItem value="regions-error" disabled>
                        Unable to load regions
                      </SelectItem>
                    ) }
                    { regionOptions.map((region) => (
                      <SelectItem key={ region.code } value={ region.name }>
                        { region.name }
                      </SelectItem>
                    )) }
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          ) }
        />
        <FormField
          control={ form.control }
          name="city"
          render={ ({ field, }) => (
            <FormItem>
              <FormLabel className="data-[error=true]:text-foreground">City</FormLabel>
              <FormControl>
                <Select
                  value={ field.value ?? '' }
                  onValueChange={ (value) => {
                    field.onChange(value);
                    form.setValue('barangay', '', FORM_SET_OPTIONS);
                    form.setValue('postal_code', '', FORM_SET_OPTIONS);
                  } }
                  disabled={ cityDisabled }
                >
                  <SelectTrigger className="w-full aria-invalid:border-input aria-invalid:ring-transparent aria-invalid:ring-0">
                    <SelectValue placeholder={ isCitiesLoading ? 'Loading cities...' : 'Select city' } />
                  </SelectTrigger>
                  <SelectContent>
                    { isCitiesError && (
                      <SelectItem value="cities-error" disabled>
                        Unable to load cities
                      </SelectItem>
                    ) }
                    { dedupedCityOptions.map((city) => (
                      <SelectItem key={ `${city.code}-${city.name}` } value={ city.name }>
                        { city.name }
                      </SelectItem>
                    )) }
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          ) }
        />
        <FormField
          control={ form.control }
          name="barangay"
          render={ ({ field, }) => (
            <FormItem>
              <FormLabel>Barangay</FormLabel>
              <FormControl>
                <Select
                  value={ field.value ?? '' }
                  onValueChange={ (value) => field.onChange(value) }
                  disabled={ barangayDisabled }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        !selectedCity
                          ? 'Select a city first'
                          : isBarangaysLoading
                            ? 'Loading barangays...'
                            : dedupedBarangayOptions.length === 0
                              ? 'No barangays available'
                              : 'Select barangay'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    { isBarangaysError && (
                      <SelectItem value="barangays-error" disabled>
                        Unable to load barangays
                      </SelectItem>
                    ) }
                    { dedupedBarangayOptions.map((barangay) => (
                      <SelectItem key={ `${barangay.code}-${barangay.name}` } value={ barangay.name }>
                        { barangay.name }
                      </SelectItem>
                    )) }
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          ) }
        />
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <FormField
          control={ form.control }
          name="street"
          render={ ({ field, }) => (
            <FormItem>
              <FormLabel>Street</FormLabel>
              <FormControl>
                <Input placeholder="Rizal Ave" { ...field } />
              </FormControl>
            </FormItem>
          ) }
        />
        <FormField
          control={ form.control }
          name="address_subunit"
          render={ ({ field, }) => (
            <FormItem>
              <FormLabel>Address subunit <span className="italic text-muted-foreground">(Optional)</span></FormLabel>
              <FormControl>
                <Input placeholder="2F" { ...field } />
              </FormControl>
              <FormMessage />
            </FormItem>
          ) }
        />
        <FormField
          control={ form.control }
          name="unit_number"
          render={ ({ field, }) => (
            <FormItem>
              <FormLabel>Unit / Suite <span className="italic text-muted-foreground">(Optional)</span></FormLabel>
              <FormControl>
                <Input placeholder="Unit Number" { ...field } />
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
              <FormLabel className="data-[error=true]:text-foreground">Postal code</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={ 4 }
                  placeholder="1000"
                  { ...field }
                  readOnly
                  disabled
                  className="aria-invalid:border-input aria-invalid:ring-transparent aria-invalid:ring-0"
                  aria-live="polite"
                />
              </FormControl>
            </FormItem>
          ) }
        />
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
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
        <div className="flex flex-col items-end gap-2 md:col-span-1">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={ () => setPinDialogOpen(true) }>
            <FiMapPin className="mr-2 size-4" aria-hidden="true" />
            Pin exact location
          </Button>
        </div>
      </div>
      <PinLocationDialog
        open={ pinDialogOpen }
        onOpenChange={ setPinDialogOpen }
        initialLat={ typeof latValue === 'number' ? latValue : undefined }
        initialLong={ typeof longValue === 'number' ? longValue : undefined }
        countryCode={ countryCodeValue }
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
  isSubmitting?: boolean;
};

export function SpaceDialog({
  open,
  mode,
  initialValues,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
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
              <Button type="button" variant="outline" onClick={ close } disabled={ isSubmitting }>
                Cancel
              </Button>
              <Button type="submit" disabled={ isSubmitting }>
                { isSubmitting ? 'Saving…' : mode === 'create' ? 'Save space' : 'Update space' }
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
  isSubmitting?: boolean;
};

export function AreaDialog({
  open,
  initialValues,
  onOpenChange,
  onSubmit,
  mode = 'create',
  isSubmitting = false,
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
              <Button type="button" variant="outline" onClick={ close } disabled={ isSubmitting }>
                Cancel
              </Button>
              <Button type="submit" disabled={ isSubmitting }>
                { isSubmitting ? 'Saving…' : mode === 'edit' ? 'Update area' : 'Save area' }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
