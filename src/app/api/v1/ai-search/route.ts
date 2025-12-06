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
});

export async function POST(request: NextRequest) {
  const jsonBody = await request.json().catch(() => null);
  const rawText = jsonBody === null ? await request.text().catch(() => '') : '';
  const queryFromSearch = request.nextUrl.searchParams.get('q');

  const parsed = requestSchema.safeParse({
    query:
      typeof jsonBody === 'string'
        ? jsonBody
        : typeof jsonBody?.prompt === 'string'
          ? jsonBody.prompt
          : typeof jsonBody?.query === 'string'
            ? jsonBody.query
            : rawText || queryFromSearch,
    messages: Array.isArray(jsonBody?.messages) ? jsonBody.messages : undefined,
  });

  if (!parsed.success || (!parsed.data.messages && !parsed.data.query)) {
    return NextResponse.json(
      {
        error:
          'Enter a question (or conversation) with messages under 2,000 characters each.',
      },
      { status: 400, }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI search is unavailable. Missing API key.', },
      { status: 500, }
    );
  }

  const ai = new GoogleGenAI({ apiKey, });

  try {
    const {
      messages,
      query,
    } = parsed.data;

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
