import type { BookingRecord } from './types';
import {
buildBookingRefundSummary,
hasCapturedPayment,
type PaymentTxForRefundSummary,
type RefundTxForRefundSummary
} from './refund-summary';

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
  currency: row.currency,
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
  const bookingIds = Array.from(new Set(rows.map((row) => row.id)));

  const [customers, paymentTxs, refundTxs] = await Promise.all([
    customerAuthIds.length
      ? prisma.user.findMany({
          where: { auth_user_id: { in: customerAuthIds, }, },
          select: {
            auth_user_id: true,
            first_name: true,
            last_name: true,
            handle: true,
          },
        })
      : Promise.resolve([]),
    bookingIds.length
      ? prisma.payment_transaction.findMany({
          where: {
            booking_id: { in: bookingIds, },
            status: { in: ['succeeded', 'refunded'], },
          },
          orderBy: { created_at: 'desc', },
          select: {
            booking_id: true,
            status: true,
            amount_minor: true,
            currency_iso3: true,
            provider: true,
          },
        })
      : Promise.resolve([]),
    bookingIds.length
      ? prisma.wallet_transaction.findMany({
          where: {
            booking_id: { in: bookingIds, },
            type: 'refund',
          },
          orderBy: { created_at: 'desc', },
          select: {
            booking_id: true,
            status: true,
            amount_minor: true,
            currency: true,
            created_at: true,
            updated_at: true,
            processed_at: true,
          },
        })
      : Promise.resolve([])
  ]);

  const customerLookup = new Map(
    customers.map((customer) => [customer.auth_user_id, customer])
  );
  const paymentLookup = new Map<string, PaymentTxForRefundSummary>();
  const refundLookup = new Map<string, RefundTxForRefundSummary[]>();

  paymentTxs.forEach((paymentTx) => {
    if (!paymentTx.booking_id || paymentLookup.has(paymentTx.booking_id)) {
      return;
    }

    paymentLookup.set(paymentTx.booking_id, {
      status: paymentTx.status,
      amount_minor: paymentTx.amount_minor,
      currency_iso3: paymentTx.currency_iso3,
      provider: paymentTx.provider,
    });
  });

  refundTxs.forEach((refundTx) => {
    if (!refundTx.booking_id) {
      return;
    }

    const existing = refundLookup.get(refundTx.booking_id) ?? [];
    existing.push({
      status: refundTx.status,
      amount_minor: refundTx.amount_minor,
      currency: refundTx.currency,
      created_at: refundTx.created_at,
      updated_at: refundTx.updated_at,
      processed_at: refundTx.processed_at,
    });
    refundLookup.set(refundTx.booking_id, existing);
  });

  return baseBookings.map((booking) => {
    const profile = customerLookup.get(booking.customerAuthId);
    const paymentTx = paymentLookup.get(booking.id) ?? null;
    const refundSummary = buildBookingRefundSummary({
      bookingStatus: booking.status,
      paymentTx,
      refundTxs: refundLookup.get(booking.id) ?? [],
      bookingCurrency: booking.currency,
    });

    return {
      ...booking,
      customerHandle: profile?.handle ?? null,
      customerName: formatFullName(profile),
      paymentCaptured: hasCapturedPayment(paymentTx),
      paymentMethod: paymentTx?.provider ?? null,
      refundSummary,
    };
  });
}
