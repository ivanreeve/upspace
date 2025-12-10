import { OpenRouter } from '@openrouter/sdk';
import type {
  AssistantMessage,
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
import { searchAgentSystemPromptTemplate } from '@/lib/search-agent';

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

const buildConversationMessages = (messages: ConversationMessage[]): Message[] =>
  messages.map((message) => ({
    role: message.role,
    content: message.content.trim(),
  }));

const createLocationMessage = (
  location: z.infer<typeof coordinateSchema>
): Message => ({
  role: 'user',
  content: `Customer is currently located at (${location.lat.toFixed(
    5
  )}, ${location.long.toFixed(5)}).`,
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
      content: text as string,
    }));
};

const flattenMessageContent = (
  content?: string | Array<ChatMessageContentItemText>
): string | null => {
  if (!content) {
    return null;
  }

  if (typeof content === 'string') {
    const trimmed = content.trim();
    return trimmed.length ? trimmed : null;
  }

  const text = content
    .map((item) => (item.type === 'text' ? item.text.trim() : ''))
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
  content: JSON.stringify(payload),
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
    try {
      const parsed = JSON.parse(value);
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

const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini';

const TOOL_DEFINITIONS: ToolDefinitionJson[] = [
  getUserLocationFunctionDefinition,
  ...referenceDataFunctionDefinitions,
  findSpacesFunctionDefinition,
  keywordSearchFunctionDefinition
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
 messages, query, user_id, location, 
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
        content: searchAgentSystemPromptTemplate,
      },
      ...contextMessages,
      ...referenceMessages,
      ...conversationMessages
    ];

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI search is unavailable. Missing API key.', },
        { status: 500, }
      );
    }

    const ai = new OpenRouter({ apiKey, });

    let finalText: string | null = null;
    let toolResult: FindSpacesToolResult | null = null;
    let toolError: string | null = null;

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
        content: assistantMessage.content,
        name: assistantMessage.name,
        toolCalls: assistantMessage.toolCalls,
        refusal: assistantMessage.refusal,
        reasoning: assistantMessage.reasoning,
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

    return NextResponse.json(
      {
        reply,
        spaces: toolResult?.spaces ?? [],
        filters: toolResult?.filters,
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
