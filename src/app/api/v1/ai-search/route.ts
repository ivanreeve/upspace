import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z
    .string()
    .trim()
    .min(1, 'Please enter a question.')
    .max(2000, 'Keep each message under 2,000 characters.'),
});

const requestSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, 'Please enter a question.')
    .max(2000, 'Keep your question under 2,000 characters.')
    .optional(),
  messages: z.array(messageSchema).min(1).optional(),
}).refine(
  (data) => Boolean(data.query?.length) || Boolean(data.messages?.length),
  'Provide a question or conversation to continue.'
);

export async function POST(request: NextRequest) {
  try {
    const jsonBody = await request.json().catch(() => null);
    const rawText = jsonBody === null ? await request.text().catch(() => '') : '';
    const queryFromSearch = request.nextUrl.searchParams.get('q');

    const queryCandidate =
      typeof jsonBody === 'string'
        ? jsonBody
        : typeof jsonBody?.prompt === 'string'
          ? jsonBody.prompt
          : typeof jsonBody?.query === 'string'
            ? jsonBody.query
            : rawText || queryFromSearch || undefined;

    const parsed = requestSchema.parse({
      query:
        typeof queryCandidate === 'string' && queryCandidate.trim().length > 0
          ? queryCandidate
          : undefined,
      messages: Array.isArray(jsonBody?.messages) ? jsonBody.messages : undefined,
    });

    const {
      messages,
      query,
    } = parsed;

    const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI search is unavailable. Missing API key.', },
        { status: 500, }
      );
    }

    const ai = new GoogleGenAI({ apiKey, });

    const normalizedMessages =
      messages?.map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content.trim(), }],
      })) ??
      [
        {
          role: 'user',
          parts: [{ text: query?.trim() ?? '', }],
        }
      ];

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: normalizedMessages,
    });

    const reply =
      response.candidates?.[0]?.content?.parts
        ?.map((part) => part.text?.trim())
        .filter(Boolean)
        .join('\n\n') ?? response.text?.trim();

    if (!reply) {
      throw new Error('Gemini returned an empty response.');
    }

    return NextResponse.json({ reply, }, { status: 200, });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request.', issues: error.errors, },
        { status: 400, }
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
