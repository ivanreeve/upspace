import type { NextRequest } from 'next/server';
import {
describe,
expect,
it,
vi
} from 'vitest';

import * as supabaseServer from '@/lib/supabase/server';
import * as prismaModule from '@/lib/prisma';
import * as pricingRules from '@/lib/pricing-rules-evaluator';
import { POST as createBookingHandler } from '@/app/api/v1/bookings/route';

const mockUserId = '00000000-0000-0000-0000-000000000001';
const mockSpaceId = '11111111-1111-1111-1111-111111111111';
const mockAreaId = '22222222-2222-2222-2222-222222222222';

describe('booking POST pricing rule error handling', () => {
  it('returns 400 when price rule evaluation throws', async () => {
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
      area: {
        findUnique: vi.fn().mockResolvedValue({
          id: mockAreaId,
          name: 'Test Area',
          max_capacity: 5,
          automatic_booking_enabled: true,
          request_approval_at_capacity: false,
          space_id: mockSpaceId,
          advance_booking_enabled: false,
          advance_booking_value: null,
          advance_booking_unit: null,
          price_rule: {
            id: 'pr-1',
            name: 'Bad Rule',
            definition: { bad: 'rule', },
          },
          space: {
            id: mockSpaceId,
            name: 'Test Space',
            is_published: true,
            user: {
              auth_user_id: 'partner-1',
              handle: 'host',
              first_name: 'Host',
              last_name: 'Name',
            },
          },
        }),
      },
    } as any);

    vi.spyOn(pricingRules, 'evaluatePriceRule').mockImplementation(() => {
      throw new Error('bad rule');
    });

    const payload = {
      spaceId: mockSpaceId,
      areaId: mockAreaId,
      bookingHours: 1,
      price: 100,
      startAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
    const req = { json: async () => payload, } as NextRequest;

    const res = await createBookingHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid request payload.');
  });
});
