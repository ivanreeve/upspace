import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

const {
  prismaMock,
  mapBookingRowToRecordMock,
  countActiveBookingsOverlapMock,
  notifyBookingEventMock,
} = vi.hoisted(() => ({
  prismaMock: {
    booking: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  mapBookingRowToRecordMock: vi.fn(),
  countActiveBookingsOverlapMock: vi.fn(),
  notifyBookingEventMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock, }));
vi.mock('@/lib/bookings/serializer', () => ({ mapBookingRowToRecord: mapBookingRowToRecordMock, }));
vi.mock('@/lib/bookings/occupancy', () => ({ countActiveBookingsOverlap: countActiveBookingsOverlapMock, }));
vi.mock('@/lib/notifications/booking', () => ({ notifyBookingEvent: notifyBookingEventMock, }));

import { runBookingLifecycleChecks, warnCapacityConflicts } from '@/lib/bookings/expiration';

describe('booking lifecycle checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.booking.updateMany.mockResolvedValue({ count: 0, });
    mapBookingRowToRecordMock.mockImplementation((row) => ({
      id: row.id,
      spaceId: row.space_id ?? 'space-1',
      areaId: row.area_id ?? 'area-1',
      spaceName: row.space_name ?? 'Focus Hub',
      areaName: row.area_name ?? 'Main Hall',
      customerAuthId: row.user_auth_id ?? 'customer-1',
      partnerAuthId: row.partner_auth_id ?? 'partner-1',
    }));
    countActiveBookingsOverlapMock.mockResolvedValue(0);
    notifyBookingEventMock.mockResolvedValue(undefined);
  });

  it('keeps capacity warnings best-effort when notification creation fails', async () => {
    const startAt = new Date(Date.now() + 5 * 60 * 1000);
    const expiresAt = new Date(startAt.getTime() + 60 * 60 * 1000);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    prismaMock.booking.findMany.mockResolvedValueOnce([{
      id: 'booking-1',
      area_id: 'area-1',
      area_max_capacity: 2n,
      guest_count: 2,
      start_at: startAt,
      expires_at: expiresAt,
    }]);
    countActiveBookingsOverlapMock.mockResolvedValueOnce(1);
    notifyBookingEventMock.mockRejectedValueOnce(new Error('notify failed'));

    await expect(warnCapacityConflicts()).resolves.toBeUndefined();
    expect(notifyBookingEventMock).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to create capacity warning notification',
      expect.objectContaining({
        bookingId: 'booking-1',
        error: expect.any(Error),
      })
    );
  });

  it('does not reject the booking read path when one lifecycle step fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    prismaMock.booking.findMany
      .mockRejectedValueOnce(new Error('expire query failed'))
      .mockResolvedValueOnce([]);

    await expect(runBookingLifecycleChecks()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      'Booking lifecycle check failed',
      expect.objectContaining({
        step: 'expireStaleBookings',
        error: expect.any(Error),
      })
    );
  });
});
