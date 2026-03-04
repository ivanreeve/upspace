import type { NextRequest } from 'next/server';
import {
describe,
expect,
it,
vi
} from 'vitest';

import * as supabaseServer from '@/lib/supabase/server';
import * as prismaModule from '@/lib/prisma';
import { POST as createBookingHandler } from '@/app/api/v1/bookings/route';

const mockUserId = '00000000-0000-0000-0000-000000000001';
const mockSpaceId = '11111111-1111-4111-8111-111111111111';
const mockAreaId = '22222222-2222-4222-8222-222222222222';

describe('booking POST endpoint guards', () => {
  it('returns 403 when direct booking is disabled outside testing mode', async () => {
    delete process.env.TESTING_MODE_ENABLED;

    vi.spyOn(supabaseServer, 'createSupabaseServerClient').mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: mockUserId, }, },
          error: null,
        }),
      },
    } as any);

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      user: {
        findFirst: vi.fn().mockResolvedValue({
          role: 'customer',
          handle: 'test',
          first_name: 'T',
          last_name: 'User',
        }),
      },
    } as any);

    const payload = {
      spaceId: mockSpaceId,
      areaId: mockAreaId,
      bookingHours: 1,
      startAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
    const req = { json: async () => payload, } as NextRequest;

    const res = await createBookingHandler(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Direct booking creation is disabled. Use checkout instead.');
  });
});
