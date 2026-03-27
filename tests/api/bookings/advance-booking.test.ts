import crypto from 'crypto';

import {
describe,
it,
expect,
vi,
beforeEach
} from 'vitest';
import { NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';
import { POST as createBookingHandler } from '@/app/api/v1/bookings/route';

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1', }, },
        error: null,
      }),
      admin: {
        getUserById: vi.fn().mockResolvedValue({
          data: { user: { email: 'partner@example.com', }, },
          error: null,
        }),
      },
    },
  }),
}));

vi.mock('@/lib/testing-mode', () => ({ isTestingModeEnabled: vi.fn().mockReturnValue(true), }));

vi.mock('@/lib/prisma', () => {
  const mockPrisma = {
    area: { findUnique: vi.fn(), },
    user: {
      findFirst: vi.fn().mockResolvedValue({
        role: 'customer',
        handle: 'customer',
        first_name: 'C',
        last_name: 'U',
      }),
    },
    app_notification: { create: vi.fn().mockResolvedValue({ id: 'notification-1', }), },
    booking: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn().mockResolvedValue({ _sum: { guest_count: 0, }, }),
    },
    $transaction: vi.fn((cb) => cb(mockPrisma)),
  };
  return { prisma: mockPrisma, };
});

vi.mock('@/lib/email', () => ({
  sendBookingNotificationEmail: vi.fn().mockResolvedValue(undefined),
  sendBookingRejectionEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/notifications/booking', () => ({ notifyBookingEvent: vi.fn().mockResolvedValue(undefined), }));

describe('Advance Booking Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow same-day booking when advance booking is enabled', async () => {
    const now = new Date();
    const sameDayStart = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
    const spaceId = crypto.randomUUID();
    const areaId = crypto.randomUUID();
    const ruleId = crypto.randomUUID();
    const bookingId = crypto.randomUUID();

    const mockArea = {
      id: areaId,
      space_id: spaceId,
      advance_booking_enabled: true,
      advance_booking_value: 30,
      advance_booking_unit: 'days',
      max_capacity: 10,
      price_rule: {
        id: ruleId,
        definition: {
 formula: '100',
variables: [],
conditions: [], 
},
        is_active: true,
      },
      space: {
        id: spaceId,
        is_published: true,
        user: { 
          auth_user_id: 'partner-1',
          first_name: 'P',
          last_name: 'U',
          handle: 'partner',
        },
      },
    };

    (prisma.area.findUnique as any).mockResolvedValue(mockArea);
    (prisma.booking.count as any).mockResolvedValue(0);
    (prisma.booking.create as any).mockResolvedValue({ 
      id: bookingId,
      status: 'pending',
      start_at: sameDayStart,
      guest_count: 1,
      area_name: 'Test Area',
      space_name: 'Test Space',
      user_id: 1n,
      created_at: new Date(),
      user_auth_id: 'user-1',
      partner_auth_id: 'partner-1',
      user: {
        first_name: 'C',
        last_name: 'U',
        email: 'customer@example.com',
      },
    });

    const payload = {
      spaceId,
      areaId,
      guestCount: 1,
      bookingHours: 1,
      startAt: sameDayStart.toISOString(),
    };

    const req = {
      json: async () => payload,
      headers: new Headers(),
    } as unknown as NextRequest;

    const response = await createBookingHandler(req);
    expect(response.status).toBe(202);
  });

  it('should reject booking too far in advance', async () => {
    const now = new Date();
    const tooFarStart = new Date(now.getTime() + 32 * 24 * 60 * 60 * 1000); // 32 days from now
    const spaceId = crypto.randomUUID();
    const areaId = crypto.randomUUID();

    const mockArea = {
      id: areaId,
      space_id: spaceId,
      advance_booking_enabled: true,
      advance_booking_value: 30,
      advance_booking_unit: 'days',
      max_capacity: 10,
      price_rule: {
        id: crypto.randomUUID(),
        definition: {
 formula: '100',
variables: [],
conditions: [], 
},
        is_active: true,
      },
      space: {
        id: spaceId,
        is_published: true,
        user: { auth_user_id: 'partner-1', },
      },
    };

    (prisma.area.findUnique as any).mockResolvedValue(mockArea);

    const payload = {
      spaceId,
      areaId,
      guestCount: 1,
      bookingHours: 1,
      startAt: tooFarStart.toISOString(),
    };

    const req = {
      json: async () => payload,
      headers: new Headers(),
    } as unknown as NextRequest;

    const response = await createBookingHandler(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('only allows bookings up to 30 days');
  });

  it('should reject booking beyond 24h when advance booking is disabled', async () => {
    const now = new Date();
    const nextDayStart = new Date(now.getTime() + 25 * 60 * 60 * 1000); // 25 hours from now
    const spaceId = crypto.randomUUID();
    const areaId = crypto.randomUUID();

    const mockArea = {
      id: areaId,
      space_id: spaceId,
      advance_booking_enabled: false,
      advance_booking_value: null,
      advance_booking_unit: null,
      max_capacity: 10,
      price_rule: {
        id: crypto.randomUUID(),
        definition: {
 formula: '100',
variables: [],
conditions: [], 
},
        is_active: true,
      },
      space: {
        id: spaceId,
        is_published: true,
        user: { auth_user_id: 'partner-1', },
      },
    };

    (prisma.area.findUnique as any).mockResolvedValue(mockArea);

    const payload = {
      spaceId,
      areaId,
      guestCount: 1,
      bookingHours: 1,
      startAt: nextDayStart.toISOString(),
    };

    const req = {
      json: async () => payload,
      headers: new Headers(),
    } as unknown as NextRequest;

    const response = await createBookingHandler(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('only allows bookings up to 24 hours');
  });
});
