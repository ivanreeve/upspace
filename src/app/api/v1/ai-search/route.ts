import {
  ApiError,
  FunctionCall,
  FunctionCallingConfigMode,
  FunctionDeclaration,
  GoogleGenAI
} from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { findSpacesAgent, MAX_RADIUS_METERS } from '@/lib/ai/space-agent';
import type { FindSpacesToolInput, FindSpacesToolResult } from '@/lib/ai/space-agent';

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

const FIND_SPACES_PARAMETERS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    query: { type: 'string', },
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
    limit: {
 type: 'integer',
minimum: 1,
maximum: 10, 
},
  },
  additionalProperties: false,
} as const;

const findSpacesFunctionDeclaration: FunctionDeclaration = {
  name: 'find_spaces',
  description:
    'Retrieve coworking spaces that match filters such as location, amenities, price, and rating.',
  parametersJsonSchema: FIND_SPACES_PARAMETERS_JSON_SCHEMA,
};

const findSpacesToolInputSchema = z
  .object({
    query: z.string().trim().optional(),
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
    limit: z.coerce.number().int().min(1).max(10).optional(),
    include_pending: z.boolean().optional(),
    user_id: z.string().regex(/^\d+$/).optional(),
  })
  .refine(
    (value) =>
      value.max_price === undefined ||
      value.min_price === undefined ||
      value.max_price >= value.min_price,
    {
      message: 'max_price must be greater than or equal to min_price.',
      path: ['max_price'],
    }
  )
  .refine(
    (value) =>
      value.max_rating === undefined ||
      value.min_rating === undefined ||
      value.max_rating >= value.min_rating,
    {
      message: 'max_rating must be greater than or equal to min_rating.',
      path: ['max_rating'],
    }
  );

type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const buildConversationContents = (messages: ConversationMessage[]) =>
  messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content.trim(), }],
  }));

const createLocationContext = (location: z.infer<typeof coordinateSchema>) => ({
  role: 'system',
  parts: [
    {
      text: `Customer is currently located at (${location.lat.toFixed(
        5
      )}, ${location.long.toFixed(5)}).`,
    }
  ],
});

const extractTextFromResponse = (response: {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}): string | null => {
  const candidate = response.candidates?.[0];
  if (!candidate) {
    return null;
  }

  const text = candidate.content?.parts
    ?.map((part) => part.text?.trim())
    .filter(Boolean)
    .join('\n\n');

  if (!text) {
    return null;
  }

  return text;
};

const getUserLocationFunctionDeclaration: FunctionDeclaration = {
  name: 'get_user_location',
  description: "Returns the customer's current location (latitude and longitude).",
  parametersJsonSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
};

const createFunctionCallContent = (
  name: string,
  id?: string,
  args?: Record<string, unknown>
) => ({
  role: 'model',
  parts: [
    {
      functionCall: {
        name,
        args,
        id,
      },
    }
  ],
});

const createFunctionResponseContent = (
  name: string,
  id: string | undefined,
  responsePayload: Record<string, unknown>
) => ({
  role: 'function',
  parts: [
    {
      functionResponse: {
        name,
        id,
        response: responsePayload,
      },
    }
  ],
});

const parseFunctionCallArgs = (value?: FunctionCall['args']) => {
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

  return value as Record<string, unknown>;
};

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
      user_id: typeof payload.user_id === 'string' ? payload.user_id : undefined,
      location: payload.location,
    });

    const {
 messages, query, user_id, location, 
} = parsed;
    const trimmedQuery = query?.trim();

    const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI search is unavailable. Missing API key.', },
        { status: 500, }
      );
    }

    const ai = new GoogleGenAI({ apiKey, });
    const conversation =
      messages && messages.length
        ? messages
        : trimmedQuery
          ? [{
 role: 'user',
content: trimmedQuery, 
}]
          : [];

    const conversationContents = buildConversationContents(conversation);
    const contextContents = location ? [createLocationContext(location)] : [];

    const toolConfig = {
      toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO, }, },
      tools: [
        {
          functionDeclarations: [
            getUserLocationFunctionDeclaration,
            findSpacesFunctionDeclaration
          ],
        }
      ],
    };

    const historyContents = [...contextContents, ...conversationContents];

    let finalText: string | null = null;
    let toolResult: FindSpacesToolResult | null = null;
    let toolError: string | null = null;

    const MAX_ATTEMPTS = 5;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: historyContents,
        config: toolConfig,
      });

      const functionCall = response.functionCalls?.[0];
      const responseText = extractTextFromResponse(response);

      if (!functionCall) {
        finalText =
          finalText ??
          responseText ??
          'Gemini did not provide a response.';
        break;
      }

      const callArgs = parseFunctionCallArgs(functionCall.args);
      historyContents.push(
        createFunctionCallContent(functionCall.name, functionCall.id, callArgs)
      );

      if (functionCall.name === 'get_user_location') {
        const locationPayload = location
          ? {
              location: {
                lat: location.lat,
                long: location.long,
              },
            }
          : { error: 'Location access was not granted.', };

        historyContents.push(
          createFunctionResponseContent(
            functionCall.name,
            functionCall.id,
            locationPayload
          )
        );

        continue;
      }

      if (functionCall.name !== 'find_spaces') {
        finalText = responseText ?? finalText;
        break;
      }

      let validatedToolInput: FindSpacesToolInput;
      try {
        validatedToolInput = findSpacesToolInputSchema.parse({
          ...callArgs,
          location: callArgs.location ?? location ?? undefined,
          user_id: callArgs.user_id ?? user_id ?? undefined,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            {
              error: 'Unable to interpret the search parameters.',
              issues: error.errors,
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

      historyContents.push(
        createFunctionResponseContent(
          functionCall.name,
          functionCall.id,
          toolResponsePayload
        )
      );

      const finalResponse = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: historyContents,
        config: toolConfig,
      });

      finalText =
        extractTextFromResponse(finalResponse) ??
        responseText ??
        (toolError ?? 'Gemini did not provide a response.');

      break;
    }

    const reply = (finalText ?? 'Gemini did not provide a response.').trim();

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
          issues: error.errors,
        },
        { status: 400, }
      );
    }

    if (error instanceof ApiError && error.status === 429) {
      console.error('Gemini AI search rate limited', error.message);
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
          : 'Unknown Gemini error';
    console.error('Gemini AI search error', message);
    return NextResponse.json(
      {
        error: 'Gemini could not generate a response. Please try again.',
        detail: message,
      },
      { status: 502, }
    );
  }
}
