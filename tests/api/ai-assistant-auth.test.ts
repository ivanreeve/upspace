import type { NextRequest } from 'next/server';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import * as supabaseServer from '@/lib/supabase/server';
import { POST as aiAssistantHandler } from '@/app/api/v1/ai-assistant/route';

const makeRequest = (payload: Record<string, unknown>) =>
  ({
    json: async () => payload,
    nextUrl: new URL('http://localhost/api/v1/ai-assistant'),
  } as NextRequest);

describe('AI assistant route auth', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when the user is not authenticated', async () => {
    vi.spyOn(supabaseServer, 'createSupabaseServerClient').mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null, },
          error: null,
        }),
      },
    } as any);

    const response = await aiAssistantHandler(
      makeRequest({
 messages: [{
 role: 'user',
content: 'Find a desk for tomorrow', 
}], 
})
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required.', });
  });
});
