import type { BookingRecord } from './types';

import { prisma } from '@/lib/prisma';

export type BookingRow = {
  id: string;
  space_id: string;
  space_name: string;
  area_id: string;
  area_name: string;
  booking_hours: bigint | number;
  start_at: Date;
  price_minor: bigint | number | null;
  currency: string;
  guest_count: number;
  status: BookingRecord['status'];
  created_at: Date;
  user_auth_id: string;
  partner_auth_id: string | null;
  area_max_capacity: bigint | number | null;
};

export const BOOKING_PRICE_MINOR_FACTOR = 100;

export const normalizeNumeric = (
  value: bigint | number | null | undefined
): number | null => {
  if (value === null || typeof value === 'undefined') {
    return null;
  }

  const numeric = typeof value === 'bigint' ? Number(value) : value;
  return Number.isFinite(numeric) ? numeric : null;
};

export const mapBookingRowToRecord = (row: BookingRow): BookingRecord => ({
  id: row.id,
  spaceId: row.space_id,
  spaceName: row.space_name,
  areaId: row.area_id,
  areaName: row.area_name,
  bookingHours: normalizeNumeric(row.booking_hours) ?? 0,
  startAt: (row.start_at ?? row.created_at).toISOString(),
  price: (() => {
    const priceMinor = normalizeNumeric(row.price_minor);
    return typeof priceMinor === 'number'
      ? priceMinor / BOOKING_PRICE_MINOR_FACTOR
      : null;
  })(),
  guestCount: typeof row.guest_count === 'number' && Number.isFinite(row.guest_count)
    ? row.guest_count
    : 1,
  status: row.status,
  createdAt: row.created_at.toISOString(),
  customerAuthId: row.user_auth_id,
  partnerAuthId: row.partner_auth_id,
  areaMaxCapacity: normalizeNumeric(row.area_max_capacity),
  customerHandle: null,
  customerName: null,
});

export const formatFullName = (
  values?: { first_name: string | null; last_name: string | null } | null
) => {
  if (!values) {
    return null;
  }

  const name = [values.first_name, values.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();

  return name.length > 0 ? name : null;
};

export async function mapBookingsWithProfiles(
  rows: BookingRow[]
): Promise<BookingRecord[]> {
  if (rows.length === 0) {
    return [];
  }

  const baseBookings = rows.map(mapBookingRowToRecord);
  const customerAuthIds = Array.from(
    new Set(rows.map((row) => row.user_auth_id))
  );

  const customers = customerAuthIds.length
    ? await prisma.user.findMany({
        where: { auth_user_id: { in: customerAuthIds, }, },
        select: {
          auth_user_id: true,
          first_name: true,
          last_name: true,
          handle: true,
        },
      })
    : [];

  const customerLookup = new Map(
    customers.map((customer) => [customer.auth_user_id, customer])
  );

  return baseBookings.map((booking) => {
    const profile = customerLookup.get(booking.customerAuthId);
    return {
      ...booking,
      customerHandle: profile?.handle ?? null,
      customerName: formatFullName(profile),
    };
  });
}
