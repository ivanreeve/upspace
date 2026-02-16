import { OpenRouter } from '@openrouter/sdk';
import type {
  AssistantMessage,
  ChatMessageContentItem,
  ChatMessageContentItemText,
  ChatMessageToolCall,
  Message,
  ToolDefinitionJson,
  ToolResponseMessage
} from '@openrouter/sdk/models';
import { OpenRouterError } from '@openrouter/sdk/models/errors/openroutererror';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { findSpacesAgent, MAX_RADIUS_METERS } from '@/lib/ai/space-agent';
import type { FindSpacesToolInput, FindSpacesToolResult } from '@/lib/ai/space-agent';
import {
  fetchSearchReferenceData,
  fetchAmenityChoices,
  fetchRegions,
  fetchCities,
  fetchBarangays,
  type SearchReferenceData
} from '@/lib/ai/search-reference-data';
import { assistantAgentSystemPromptTemplate } from '@/lib/assistant-agent';
import {
getBookingAvailability,
getBookingPricing,
validateBookingRequest,
createBookingCheckout
} from '@/lib/ai/booking-tools';
import { compareSpaces } from '@/lib/ai/comparison-tools';
import { estimateMonthlyCost, findBudgetOptimalSpaces } from '@/lib/ai/budget-tools';
import { getUserBookmarks, getUserBookingHistory, getSimilarSpaces } from '@/lib/ai/recommendation-tools';
import {
  hasNonLatin1Chars,
  normalizeOpenRouterApiKey,
  sanitizeOpenRouterJson,
  sanitizeOpenRouterString
} from '@/lib/ai/openrouter-sanitize';

export const runtime = 'nodejs';

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z
    .string()
    .trim()
    .min(1, 'Please enter a question.')
    .max(2000, 'Keep each message under 2,000 characters.'),
});

const coordinateSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  long: z.coerce.number().min(-180).max(180),
});

const requestSchema = z
  .object({
    query: z
      .string()
      .trim()
      .min(1, 'Please enter a question.')
      .max(2000, 'Keep your question under 2,000 characters.')
      .optional(),
    messages: z.array(messageSchema).min(1).optional(),
    user_id: z.string().regex(/^\d+$/).optional(),
    location: coordinateSchema.optional(),
    conversation_id: z.string().uuid().optional(),
  })
  .refine(
    (data) => Boolean(data.query?.length) || Boolean(data.messages?.length),
    'Provide a question or conversation to continue.'
  );

const SPACE_SEARCH_FILTER_PROPERTIES = {
  location: {
    type: 'object',
    properties: {
      lat: {
        type: 'number',
        minimum: -90,
        maximum: 90,
      },
      long: {
        type: 'number',
        minimum: -180,
        maximum: 180,
      },
    },
    required: ['lat', 'long'],
  },
  radius: {
    type: 'number',
    minimum: 0,
    maximum: MAX_RADIUS_METERS,
  },
  amenities: {
    type: 'array',
    items: {
      type: 'string',
      minLength: 1,
    },
    maxItems: 10,
  },
  amenities_mode: {
    type: 'string',
    enum: ['any', 'all'],
  },
  amenities_negate: { type: 'boolean', },
  min_price: {
    type: 'number',
    minimum: 0,
  },
  max_price: {
    type: 'number',
    minimum: 0,
  },
  min_rating: {
    type: 'number',
    minimum: 0,
    maximum: 5,
  },
  max_rating: {
    type: 'number',
    minimum: 0,
    maximum: 5,
  },
  sort_by: {
    type: 'string',
    enum: ['price', 'rating', 'distance', 'relevance'],
  },
  sort_direction: {
    type: 'string',
    enum: ['asc', 'desc'],
  },
  limit: {
    type: 'integer',
    minimum: 1,
    maximum: 10,
  },
  include_pending: { type: 'boolean', },
  user_id: {
    type: 'string',
    pattern: '^\\d+$',
  },
} as const;

const FIND_SPACES_PARAMETERS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    query: { type: 'string', },
    ...SPACE_SEARCH_FILTER_PROPERTIES,
  },
  additionalProperties: false,
} as const;

const KEYWORD_SEARCH_PARAMETERS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    keywords: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1,
      },
      minItems: 1,
      maxItems: 5,
    },
    ...SPACE_SEARCH_FILTER_PROPERTIES,
  },
  required: ['keywords'],
  additionalProperties: false,
} as const;

type AiFunctionDefinition = {
  name: string;
  description: string;
  parametersJsonSchema: Record<string, unknown>;
};

const findSpacesFunctionDefinition: AiFunctionDefinition = {
  name: 'find_spaces',
  description:
    'Retrieve coworking spaces that match filters such as location, amenities, price, and rating.',
  parametersJsonSchema: FIND_SPACES_PARAMETERS_JSON_SCHEMA,
};

const keywordSearchFunctionDefinition: AiFunctionDefinition = {
  name: 'keyword_search',
  description:
    'Retrieve coworking spaces whose description or location fields mention specific keywords.',
  parametersJsonSchema: KEYWORD_SEARCH_PARAMETERS_JSON_SCHEMA,
};

const bookingAvailabilityFunctionDefinition: AiFunctionDefinition = {
  name: 'get_booking_availability',
  description:
    'Check availability for a coworking space on specific dates. Returns which areas are available for booking.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      space_id: {
        type: 'string',
        format: 'uuid',
      },
      start_date: {
        type: 'string',
        format: 'date-time',
      },
      end_date: {
        type: 'string',
        format: 'date-time',
      },
    },
    required: ['space_id', 'start_date', 'end_date'],
    additionalProperties: false,
  },
};

const bookingPricingFunctionDefinition: AiFunctionDefinition = {
  name: 'get_booking_pricing',
  description:
    'Get detailed pricing information for booking a specific area in a space for a given time period.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      space_id: {
        type: 'string',
        format: 'uuid',
      },
      area_id: {
        type: 'string',
        format: 'uuid',
      },
      start_date: {
        type: 'string',
        format: 'date-time',
      },
      end_date: {
        type: 'string',
        format: 'date-time',
      },
    },
    required: ['space_id', 'area_id', 'start_date', 'end_date'],
    additionalProperties: false,
  },
};

const validateBookingFunctionDefinition: AiFunctionDefinition = {
  name: 'validate_booking_request',
  description:
    'Validate a booking request by checking both availability and pricing. Use this before guiding the user to complete their booking.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      space_id: {
        type: 'string',
        format: 'uuid',
      },
      area_id: {
        type: 'string',
        format: 'uuid',
      },
      start_date: {
        type: 'string',
        format: 'date-time',
      },
      end_date: {
        type: 'string',
        format: 'date-time',
      },
    },
    required: ['space_id', 'area_id', 'start_date', 'end_date'],
    additionalProperties: false,
  },
};

const createBookingCheckoutFunctionDefinition: AiFunctionDefinition = {
  name: 'create_booking_checkout',
  description:
    'Validate availability, pricing, and capacity for a booking, then return checkout-ready parameters. Use this when the user confirms they want to proceed with booking a specific area.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      space_id: {
        type: 'string',
        format: 'uuid',
      },
      area_id: {
        type: 'string',
        format: 'uuid',
      },
      booking_hours: {
        type: 'integer',
        minimum: 1,
        maximum: 24,
      },
      start_at: {
        type: 'string',
        format: 'date-time',
      },
      guest_count: {
        type: 'integer',
        minimum: 1,
        maximum: 999,
      },
    },
    required: ['space_id', 'area_id', 'booking_hours', 'start_at'],
    additionalProperties: false,
  },
};

const compareSpacesFunctionDefinition: AiFunctionDefinition = {
  name: 'compare_spaces',
  description:
    'Compare multiple coworking spaces side-by-side. Returns detailed comparison including pricing, ratings, amenities, and highlights differences.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      space_ids: {
        type: 'array',
        items: {
          type: 'string',
          format: 'uuid',
        },
        minItems: 2,
        maxItems: 5,
      },
      user_id: {
        type: 'string',
        pattern: '^\\d+$',
      },
    },
    required: ['space_ids'],
    additionalProperties: false,
  },
};

const estimateMonthlyCostFunctionDefinition: AiFunctionDefinition = {
  name: 'estimate_monthly_cost',
  description:
    'Estimate monthly cost for a specific usage pattern (days per week, hours per day) at a coworking space.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      space_id: {
        type: 'string',
        format: 'uuid',
      },
      area_id: {
        type: 'string',
        format: 'uuid',
      },
      days_per_week: {
        type: 'number',
        minimum: 1,
        maximum: 7,
      },
      hours_per_day: {
        type: 'number',
        minimum: 1,
        maximum: 24,
      },
    },
    required: ['space_id', 'days_per_week'],
    additionalProperties: false,
  },
};

const findBudgetOptimalSpacesFunctionDefinition: AiFunctionDefinition = {
  name: 'find_budget_optimal_spaces',
  description:
    'Find coworking spaces that fit within a monthly budget. Returns spaces sorted by value (best features per price).',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      budget: {
        type: 'number',
        minimum: 0,
      },
      days_per_week: {
        type: 'number',
        minimum: 1,
        maximum: 7,
      },
      hours_per_day: {
        type: 'number',
        minimum: 1,
        maximum: 24,
      },
      location: {
        type: 'object',
        properties: {
          lat: {
            type: 'number',
            minimum: -90,
            maximum: 90,
          },
          long: {
            type: 'number',
            minimum: -180,
            maximum: 180,
          },
        },
        required: ['lat', 'long'],
      },
      amenities: {
        type: 'array',
        items: { type: 'string', },
      },
      min_rating: {
        type: 'number',
        minimum: 0,
        maximum: 5,
      },
      user_id: {
        type: 'string',
        pattern: '^\\d+$',
      },
    },
    required: ['budget'],
    additionalProperties: false,
  },
};

const getUserBookmarksFunctionDefinition: AiFunctionDefinition = {
  name: 'get_user_bookmarks',
  description:
    "Get the user's saved/bookmarked coworking spaces. Use this to provide personalized recommendations based on their saved spaces.",
  parametersJsonSchema: {
    type: 'object',
    properties: {
      user_id: {
        type: 'string',
        pattern: '^\\d+$',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 20,
      },
    },
    required: ['user_id'],
    additionalProperties: false,
  },
};

const getUserBookingHistoryFunctionDefinition: AiFunctionDefinition = {
  name: 'get_user_booking_history',
  description:
    "Get the user's past booking history with aggregated patterns (most booked spaces, preferred amenities, average spending). Use this to understand user preferences.",
  parametersJsonSchema: {
    type: 'object',
    properties: {
      user_id: {
        type: 'string',
        pattern: '^\\d+$',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 20,
      },
    },
    required: ['user_id'],
    additionalProperties: false,
  },
};

const getSimilarSpacesFunctionDefinition: AiFunctionDefinition = {
  name: 'get_similar_spaces',
  description:
    'Find coworking spaces similar to a reference space based on amenities, location, and price range. Use this to recommend alternatives.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      space_id: {
        type: 'string',
        format: 'uuid',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 10,
      },
      user_id: {
        type: 'string',
        pattern: '^\\d+$',
      },
    },
    required: ['space_id'],
    additionalProperties: false,
  },
};

const spaceSearchFiltersBaseSchema = z.object({
  location: coordinateSchema.optional(),
  radius: z.coerce.number().min(0).max(MAX_RADIUS_METERS).optional(),
  amenities: z.array(z.string().trim().min(1)).max(10).optional(),
  amenities_mode: z.enum(['any', 'all']).optional(),
  amenities_negate: z.boolean().optional(),
  min_price: z.coerce.number().min(0).optional(),
  max_price: z.coerce.number().min(0).optional(),
  min_rating: z.coerce.number().min(0).max(5).optional(),
  max_rating: z.coerce.number().min(0).max(5).optional(),
  sort_by: z.enum(['price', 'rating', 'distance', 'relevance']).optional(),
  sort_direction: z.enum(['asc', 'desc']).optional(),
  limit: z.coerce.number().int().min(1).max(10).optional(),
  include_pending: z.boolean().optional(),
  user_id: z.string().regex(/^\d+$/).optional(),
});

// Apply shared range validations without blocking schema extension.
type RangeFilterValues = {
  min_price?: number;
  max_price?: number;
  min_rating?: number;
  max_rating?: number;
};

const withRangeRefinements = <T extends z.ZodTypeAny>(schema: T) =>
  schema
    .refine(
      (value) => {
        const filters = value as RangeFilterValues;
        return (
          filters.max_price === undefined ||
          filters.min_price === undefined ||
          filters.max_price >= filters.min_price
        );
      },
      {
        message: 'max_price must be greater than or equal to min_price.',
        path: ['max_price'],
      }
    )
    .refine(
      (value) => {
        const filters = value as RangeFilterValues;
        return (
          filters.max_rating === undefined ||
          filters.min_rating === undefined ||
          filters.max_rating >= filters.min_rating
        );
      },
      {
        message: 'max_rating must be greater than or equal to min_rating.',
        path: ['max_rating'],
      }
    );

const spaceSearchFiltersSchema = withRangeRefinements(
  spaceSearchFiltersBaseSchema
);

const findSpacesToolInputSchema = withRangeRefinements(
  spaceSearchFiltersBaseSchema.extend({ query: z.string().trim().optional(), })
);

const keywordSearchToolInputSchema = withRangeRefinements(
  spaceSearchFiltersBaseSchema.extend({ keywords: z.array(z.string().trim().min(1)).min(1).max(5), })
);

const spaceSearchFunctionNames = ['find_spaces', 'keyword_search'] as const;
type SpaceSearchFunctionName = (typeof spaceSearchFunctionNames)[number];

const isSpaceSearchFunction = (name: string): name is SpaceSearchFunctionName =>
  spaceSearchFunctionNames.includes(name as SpaceSearchFunctionName);

const buildSpaceSearchToolInput = (
  name: SpaceSearchFunctionName,
  args: Record<string, unknown>,
  fallbackLocation?: z.infer<typeof coordinateSchema>,
  fallbackUserId?: string
): FindSpacesToolInput => {
  const normalizedArgs: Record<string, unknown> = {
    ...args,
    location: args.location ?? fallbackLocation ?? undefined,
    user_id: args.user_id ?? fallbackUserId ?? undefined,
  };

  if (name === 'find_spaces') {
    return findSpacesToolInputSchema.parse(normalizedArgs);
  }

  const keywordInput = keywordSearchToolInputSchema.parse(normalizedArgs);
  const {
 keywords, ...sharedFilters 
} = keywordInput;
  const query = keywords.map((keyword) => keyword.trim()).join(' ');

  return {
    ...sharedFilters,
    query,
  };
};

type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const sanitizeContent = (value: string): string =>
  sanitizeOpenRouterString(value);

const sanitizeMessageContent = (
  content?: string | Array<ChatMessageContentItem> | null
): string | Array<ChatMessageContentItem> | null => {
  if (content === null || content === undefined) {
    return null;
  }

  if (typeof content === 'string') {
    return sanitizeOpenRouterString(content);
  }

  return content.map((item) =>
    item.type === 'text'
      ? {
 ...item,
text: sanitizeOpenRouterString(item.text), 
}
      : item
  );
};

const sanitizeToolCalls = (
  toolCalls?: ChatMessageToolCall[] | null
): ChatMessageToolCall[] | undefined => {
  if (!toolCalls?.length) {
    return toolCalls ?? undefined;
  }

  return toolCalls.map((call) => ({
    ...call,
    function: {
      ...call.function,
      arguments:
        typeof call.function.arguments === 'string'
          ? sanitizeOpenRouterString(call.function.arguments)
          : call.function.arguments,
    },
  }));
};

const buildConversationMessages = (messages: ConversationMessage[]): Message[] =>
  messages.map((message) => ({
    role: message.role,
    content: sanitizeContent(message.content.trim()),
  }));

const createLocationMessage = (
  location: z.infer<typeof coordinateSchema>
): Message => ({
  role: 'user',
  content: sanitizeOpenRouterString(`Customer is currently located at (${location.lat.toFixed(
    5
  )}, ${location.long.toFixed(5)}).`),
});

const buildReferenceMessages = (data: SearchReferenceData): Message[] => {
  const MAX_ITEMS = 50;

  const formatList = (label: string, items: string[]): string | null => {
    if (!items.length) return null;

    const trimmed = items.slice(0, MAX_ITEMS);
    const summary = trimmed.map((item) => `- ${item}`).join('\n');
    const extra =
      items.length > trimmed.length
        ? `\n- ...and ${items.length - trimmed.length} more`
        : '';

    return `${label} (${items.length}):\n${summary}${extra}`;
  };

  return [
    formatList('Available amenities', data.amenities),
    formatList('Regions with spaces', data.regions),
    formatList('Cities with spaces', data.cities),
    formatList('Barangays with spaces', data.barangays)
  ]
    .filter(Boolean)
    .map((text) => ({
      role: 'user',
      content: sanitizeOpenRouterString(text as string),
    }));
};

const flattenMessageContent = (
  content?: string | Array<ChatMessageContentItem> | null
): string | null => {
  if (!content) {
    return null;
  }

  if (typeof content === 'string') {
    const trimmed = content.trim();
    return trimmed.length ? trimmed : null;
  }

  const text = content
    .filter(
      (item): item is ChatMessageContentItemText => item.type === 'text'
    )
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join(' ');

  return text.length ? text : null;
};

const extractFirstToolCall = (
  message?: AssistantMessage
): ChatMessageToolCall | null => message?.toolCalls?.[0] ?? null;

const createToolResponseMessage = (
  callId: string,
  payload: Record<string, unknown>
): ToolResponseMessage => ({
  role: 'tool',
  content: sanitizeOpenRouterJson(payload),
  toolCallId: callId,
});

const referenceDataToolDefinitions = [
  {
    name: 'get_amenity_choices',
    description:
      'Returns the normalized list of amenity choices available in the marketplace.',
    fetcher: fetchAmenityChoices,
  },
  {
    name: 'get_regions',
    description:
      'Returns the alphabetized list of regions that currently have listed spaces.',
    fetcher: fetchRegions,
  },
  {
    name: 'get_cities',
    description:
      'Returns the alphabetized list of cities that currently have listed spaces.',
    fetcher: fetchCities,
  },
  {
    name: 'get_barangays',
    description:
      'Returns the alphabetized list of barangays that currently have listed spaces.',
    fetcher: fetchBarangays,
  }
] as const;

type ReferenceDataToolName =
  (typeof referenceDataToolDefinitions)[number]['name'];

const referenceDataFunctionDefinitions: AiFunctionDefinition[] =
  referenceDataToolDefinitions.map(
    ({
      name,
      description,
    }) => ({
      name,
      description,
      parametersJsonSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    })
  );

const referenceToolFetchers = referenceDataToolDefinitions.reduce(
  (acc, definition) => {
    acc[definition.name] = definition.fetcher;
    return acc;
  },
  {} as Record<ReferenceDataToolName, () => Promise<string[]>>
);

const referenceDataToolSet = new Set(
  referenceDataToolDefinitions.map((tool) => tool.name)
);
const isReferenceDataTool = (name: string): name is ReferenceDataToolName =>
  referenceDataToolSet.has(name as ReferenceDataToolName);

const parseFunctionCallArgs = (
  value?: string | Record<string, unknown>
): Record<string, unknown> => {
  if (!value) {
    return {};
  }

  if (typeof value === 'string') {
    const sanitized = sanitizeOpenRouterString(value);
    try {
      const parsed = JSON.parse(sanitized);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }

  return value;
};

const getUserLocationFunctionDefinition: AiFunctionDefinition = {
  name: 'get_user_location',
  description:
    "Returns the customer's current location (latitude and longitude).",
  parametersJsonSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
};

const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? 'z-ai/glm-4.7';

const TOOL_DEFINITIONS: ToolDefinitionJson[] = [
  getUserLocationFunctionDefinition,
  ...referenceDataFunctionDefinitions,
  findSpacesFunctionDefinition,
  keywordSearchFunctionDefinition,
  bookingAvailabilityFunctionDefinition,
  bookingPricingFunctionDefinition,
  validateBookingFunctionDefinition,
  createBookingCheckoutFunctionDefinition,
  compareSpacesFunctionDefinition,
  estimateMonthlyCostFunctionDefinition,
  findBudgetOptimalSpacesFunctionDefinition,
  getUserBookmarksFunctionDefinition,
  getUserBookingHistoryFunctionDefinition,
  getSimilarSpacesFunctionDefinition
].map((definition) => ({
  type: 'function',
  function: {
    name: definition.name,
    description: definition.description,
    parameters: definition.parametersJsonSchema,
    strict: true,
  },
}));

export async function POST(request: NextRequest) {
  try {
    const jsonBody = await request.json().catch(() => null);
    const rawText =
      jsonBody === null ? await request.text().catch(() => '') : '';
    const queryFromSearch = request.nextUrl.searchParams.get('q');

    const queryCandidate =
      typeof jsonBody === 'string'
        ? jsonBody
        : typeof jsonBody?.prompt === 'string'
          ? jsonBody.prompt
          : typeof jsonBody?.query === 'string'
            ? jsonBody.query
            : rawText || queryFromSearch || undefined;

    const payload =
      typeof jsonBody === 'object' && jsonBody !== null ? jsonBody : {};

    const parsed = requestSchema.parse({
      query:
        typeof queryCandidate === 'string' && queryCandidate.trim().length > 0
          ? queryCandidate
          : undefined,
      messages: Array.isArray(jsonBody?.messages)
        ? jsonBody.messages
        : undefined,
      user_id:
        typeof payload.user_id === 'string' ? payload.user_id : undefined,
      location: payload.location,
    });

    const {
 messages, query, user_id, location, conversation_id,
} = parsed;
    const trimmedQuery = query?.trim();

    const conversation: ConversationMessage[] =
      messages && messages.length
        ? messages
        : trimmedQuery
          ? [
              {
                role: 'user',
                content: trimmedQuery,
              }
            ]
          : [];

    const conversationMessages = buildConversationMessages(conversation);
    const contextMessages = location ? [createLocationMessage(location)] : [];
    const referenceData = await fetchSearchReferenceData();
    const referenceMessages = buildReferenceMessages(referenceData);

    const historyMessages: Message[] = [
      {
        role: 'system',
        content: sanitizeContent(assistantAgentSystemPromptTemplate),
      },
      ...contextMessages,
      ...referenceMessages,
      ...conversationMessages
    ];

    const rawApiKey = process.env.OPENROUTER_API_KEY;
    if (!rawApiKey) {
      return NextResponse.json(
        { error: 'AI search is unavailable. Missing API key.', },
        { status: 500, }
      );
    }

    const apiKey = normalizeOpenRouterApiKey(rawApiKey);
    if (!apiKey || hasNonLatin1Chars(apiKey)) {
      return NextResponse.json(
        {
          error: 'AI search is unavailable. Invalid API key.',
          detail:
            'OPENROUTER_API_KEY contains invalid characters. Remove smart quotes or non-ASCII characters.',
        },
        { status: 500, }
      );
    }

    const ai = new OpenRouter({ apiKey, });

    let finalText: string | null = null;
    let toolResult: FindSpacesToolResult | null = null;
    let toolError: string | null = null;
    let bookingAction: Record<string, unknown> | null = null;

    const MAX_ATTEMPTS = 5;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const response = await ai.chat.send({
        model: OPENROUTER_MODEL,
        messages: historyMessages,
        tools: TOOL_DEFINITIONS,
        toolChoice: 'auto',
        user: user_id ?? undefined,
      });

      const assistantMessage = response.choices?.[0]?.message;
      const responseText = assistantMessage
        ? flattenMessageContent(assistantMessage.content)
        : null;

      if (!assistantMessage) {
        finalText =
          finalText ?? responseText ?? 'OpenRouter did not provide a response.';
        break;
      }

      historyMessages.push({
        role: 'assistant',
        content: sanitizeMessageContent(assistantMessage.content),
        name: assistantMessage.name
          ? sanitizeOpenRouterString(assistantMessage.name)
          : undefined,
        toolCalls: sanitizeToolCalls(assistantMessage.toolCalls),
        refusal: assistantMessage.refusal
          ? sanitizeOpenRouterString(assistantMessage.refusal)
          : undefined,
        reasoning: assistantMessage.reasoning
          ? sanitizeOpenRouterString(assistantMessage.reasoning)
          : undefined,
      });

      const functionCall = extractFirstToolCall(assistantMessage);
      if (!functionCall) {
        finalText =
          finalText ?? responseText ?? 'OpenRouter did not provide a response.';
        break;
      }

      const functionCallName = functionCall.function.name ?? 'unknown';
      const callArgs = parseFunctionCallArgs(functionCall.function.arguments);
      const callId = functionCall.id;

      if (functionCallName === 'get_user_location') {
        const locationPayload = location
          ? {
              location: {
                lat: location.lat,
                long: location.long,
              },
            }
          : { error: 'Location access was not granted.', };

        historyMessages.push(
          createToolResponseMessage(callId, locationPayload)
        );

        continue;
      }

      if (isReferenceDataTool(functionCallName)) {
        try {
          const items = await referenceToolFetchers[functionCallName]();

          historyMessages.push(
            createToolResponseMessage(callId, {
              items,
              count: items.length,
            })
          );
        } catch (referenceToolError) {
          const message =
            referenceToolError instanceof Error
              ? referenceToolError.message
              : 'Unable to fetch reference data.';
          console.error('Reference tool error', message);
          historyMessages.push(
            createToolResponseMessage(callId, { error: message, })
          );
        }

        continue;
      }

      if (functionCallName === 'get_booking_availability') {
        try {
          const result = await getBookingAvailability(callArgs);
          historyMessages.push(createToolResponseMessage(callId, result));
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to check booking availability.';
          console.error('Booking availability error', message);
          historyMessages.push(
            createToolResponseMessage(callId, { error: message, })
          );
        }

        continue;
      }

      if (functionCallName === 'get_booking_pricing') {
        try {
          const result = await getBookingPricing(callArgs);
          historyMessages.push(createToolResponseMessage(callId, result));
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to get booking pricing.';
          console.error('Booking pricing error', message);
          historyMessages.push(
            createToolResponseMessage(callId, { error: message, })
          );
        }

        continue;
      }

      if (functionCallName === 'validate_booking_request') {
        try {
          const result = await validateBookingRequest(callArgs);
          historyMessages.push(createToolResponseMessage(callId, result));
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to validate booking request.';
          console.error('Booking validation error', message);
          historyMessages.push(
            createToolResponseMessage(callId, { error: message, })
          );
        }

        continue;
      }

      if (functionCallName === 'create_booking_checkout') {
        try {
          const result = await createBookingCheckout(callArgs);
          if ('action' in result && result.action === 'checkout') {
            bookingAction = result;
          }
          historyMessages.push(createToolResponseMessage(callId, result));
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to create booking checkout.';
          console.error('Booking checkout error', message);
          historyMessages.push(
            createToolResponseMessage(callId, { error: message, })
          );
        }

        continue;
      }

      if (functionCallName === 'compare_spaces') {
        try {
          const normalizedArgs = {
            ...callArgs,
            user_id: callArgs.user_id ?? user_id ?? undefined,
          };
          const result = await compareSpaces(normalizedArgs);
          historyMessages.push(createToolResponseMessage(callId, result));
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to compare spaces.';
          console.error('Space comparison error', message);
          historyMessages.push(
            createToolResponseMessage(callId, { error: message, })
          );
        }

        continue;
      }

      if (functionCallName === 'estimate_monthly_cost') {
        try {
          const result = await estimateMonthlyCost(callArgs);
          historyMessages.push(createToolResponseMessage(callId, result));
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to estimate monthly cost.';
          console.error('Cost estimation error', message);
          historyMessages.push(
            createToolResponseMessage(callId, { error: message, })
          );
        }

        continue;
      }

      if (functionCallName === 'find_budget_optimal_spaces') {
        try {
          const normalizedArgs = {
            ...callArgs,
            location: callArgs.location ?? location ?? undefined,
            user_id: callArgs.user_id ?? user_id ?? undefined,
          };
          const result = await findBudgetOptimalSpaces(normalizedArgs);
          historyMessages.push(createToolResponseMessage(callId, result));
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to find budget-optimal spaces.';
          console.error('Budget search error', message);
          historyMessages.push(
            createToolResponseMessage(callId, { error: message, })
          );
        }

        continue;
      }

      if (functionCallName === 'get_user_bookmarks') {
        try {
          const normalizedArgs = {
            ...callArgs,
            user_id: callArgs.user_id ?? user_id ?? undefined,
          };
          const result = await getUserBookmarks(normalizedArgs);
          historyMessages.push(createToolResponseMessage(callId, result));
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to get user bookmarks.';
          console.error('User bookmarks error', message);
          historyMessages.push(
            createToolResponseMessage(callId, { error: message, })
          );
        }

        continue;
      }

      if (functionCallName === 'get_user_booking_history') {
        try {
          const normalizedArgs = {
            ...callArgs,
            user_id: callArgs.user_id ?? user_id ?? undefined,
          };
          const result = await getUserBookingHistory(normalizedArgs);
          historyMessages.push(createToolResponseMessage(callId, result));
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to get booking history.';
          console.error('Booking history error', message);
          historyMessages.push(
            createToolResponseMessage(callId, { error: message, })
          );
        }

        continue;
      }

      if (functionCallName === 'get_similar_spaces') {
        try {
          const normalizedArgs = {
            ...callArgs,
            user_id: callArgs.user_id ?? user_id ?? undefined,
          };
          const result = await getSimilarSpaces(normalizedArgs);
          historyMessages.push(createToolResponseMessage(callId, result));
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to find similar spaces.';
          console.error('Similar spaces error', message);
          historyMessages.push(
            createToolResponseMessage(callId, { error: message, })
          );
        }

        continue;
      }

      if (!isSpaceSearchFunction(functionCallName)) {
        finalText = responseText ?? finalText;
        break;
      }

      let validatedToolInput: FindSpacesToolInput;
      try {
        validatedToolInput = buildSpaceSearchToolInput(
          functionCallName,
          callArgs,
          location,
          user_id
        );
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            {
              error: 'Unable to interpret the search parameters.',
              issues: error.issues,
            },
            { status: 400, }
          );
        }
        throw error;
      }

      try {
        toolResult = await findSpacesAgent(validatedToolInput);
        toolError = null;
      } catch (toolExecutionError) {
        toolError =
          toolExecutionError instanceof Error
            ? toolExecutionError.message
            : 'Space search tool failed.';
        console.error('Space agent error', toolError);
      }

      const toolResponsePayload = toolError
        ? { error: toolError, }
        : { output: toolResult, };

      historyMessages.push(
        createToolResponseMessage(callId, toolResponsePayload)
      );

      continue;
    }

    if (toolError && (!finalText || finalText === toolError)) {
      finalText =
        'I am sorry, I could not find spaces right now. Please try again in a moment.';
    }

    const reply = (finalText ?? 'OpenRouter did not provide a response.').trim();

    if (conversation_id) {
      const lastUserMessage = conversation[conversation.length - 1];
      try {
        await prisma.ai_conversation_message.createMany({
          data: [
            {
              conversation_id,
              role: 'user',
              content: lastUserMessage.content,
            },
            {
              conversation_id,
              role: 'assistant',
              content: reply,
              space_results: toolResult?.spaces
                ? (JSON.parse(JSON.stringify(toolResult.spaces)) as object)
                : undefined,
              booking_action: bookingAction
                ? (JSON.parse(JSON.stringify(bookingAction)) as object)
                : undefined,
            }
          ],
        });

        await prisma.ai_conversation.update({
          where: { id: conversation_id, },
          data: {
            updated_at: new Date(),
            ...(conversation.length === 1
              ? { title: lastUserMessage.content.slice(0, 100), }
              : {}),
          },
        });
      } catch (persistError) {
        console.error('Failed to persist AI conversation messages', persistError);
      }
    }

    return NextResponse.json(
      {
        reply,
        spaces: toolResult?.spaces ?? [],
        filters: toolResult?.filters,
        ...(bookingAction ? { bookingAction, } : {}),
      },
      { status: 200, }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request.',
          issues: error.issues,
        },
        { status: 400, }
      );
    }

    if (error instanceof OpenRouterError && error.statusCode === 429) {
      console.error('OpenRouter AI search rate limited', error.message);
      return NextResponse.json(
        {
          error:
            'UpSpace is handling a lot of requests right now. Please try again in a minute.',
        },
        { status: 429, }
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Unknown OpenRouter error';
    console.error('OpenRouter AI search error', message);
    return NextResponse.json(
      {
        error: 'OpenRouter could not generate a response. Please try again.',
        detail: message,
      },
      { status: 502, }
    );
  }
}
