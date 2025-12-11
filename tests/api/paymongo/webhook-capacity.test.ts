import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import * as occupancy from '@/lib/bookings/occupancy';
import * as prismaModule from '@/lib/prisma';
import { handleCheckoutEvent } from '@/app/api/paymongo/webhook/handlers';

describe('PayMongo webhook capacity safeguard', () => {
  it('does not confirm booking when projected capacity is exceeded and sends review notifications once', async () => {
    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-1',
          area_id: 'area-1',
          area_name: 'Area One',
          space_id: 'space-1',
          space_name: 'Space One',
          booking_hours: 2n,
          price_minor: 1000n,
          currency: 'PHP',
          status: 'pending',
          created_at: new Date(Date.now() - 20 * 60 * 1000),
          user_auth_id: 'user-1',
          partner_auth_id: 'partner-1',
          area_max_capacity: 2n,
          guest_count: 2,
          start_at: new Date(Date.now() + 5 * 60 * 1000),
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000),
        }),
        update: vi.fn(),
      },
      app_notification: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      transaction: { create: vi.fn(), },
    } as any);

    vi.spyOn(occupancy, 'countActiveBookingsOverlap').mockResolvedValue(2);

    const event = {
      type: 'checkout.session.paid',
      livemode: false,
      data: {
        object: {
          id: 'co_1',
          amount: 2000,
          currency: 'PHP',
          metadata: {
            booking_id: 'booking-1',
            requires_host_approval: 'false',
          },
          status: 'paid',
        },
      },
    } as any;

    const response = await handleCheckoutEvent(event);
    expect(response.status).toBe(200);

    const prisma = prismaModule.prisma as any;
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(prisma.app_notification.create).toHaveBeenCalledTimes(2);
  });
});
