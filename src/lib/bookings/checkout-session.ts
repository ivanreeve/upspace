import { randomUUID } from 'crypto';

import { BOOKING_PRICE_MINOR_FACTOR, mapBookingRowToRecord, normalizeNumeric } from '@/lib/bookings/serializer';
import { countActiveBookingsOverlap, resolveBookingDecision } from '@/lib/bookings/occupancy';
import { sendBookingNotificationEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { evaluatePriceRule } from '@/lib/pricing-rules-evaluator';
import { BUILT_IN_VARIABLE_KEYS, type PriceRuleRecord } from '@/lib/pricing-rules';
import { getFinancialProvider } from '@/lib/providers/provider-registry';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isTestingModeEnabled } from '@/lib/testing-mode';
import { recordTestModeBookingWalletCharge } from '@/lib/wallet-server';

const DEFAULT_APP_URL = 'http://localhost:3000';
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.trim().length > 0
  ? process.env.NEXT_PUBLIC_APP_URL
  : DEFAULT_APP_URL).replace(/\/+$/, '');
const BOOKING_ID_PLACEHOLDER = '__BOOKING_ID__';
const CHECKOUT_ALLOWED_REDIRECT_ORIGINS = process.env.CHECKOUT_ALLOWED_REDIRECT_ORIGINS ?? '';

function resolveAllowedRedirectOrigins() {
  const origins = new Set<string>();

  try {
    origins.add(new URL(APP_URL).origin);
  } catch {
    // APP_URL fallback should never block checkout creation.
  }

  for (const entry of CHECKOUT_ALLOWED_REDIRECT_ORIGINS.split(',')) {
    const candidate = entry.trim();
    if (!candidate) {
      continue;
    }

    try {
      origins.add(new URL(candidate).origin);
    } catch {
      // Ignore invalid env entries.
    }
  }

  return origins;
}

const ALLOWED_REDIRECT_ORIGINS = resolveAllowedRedirectOrigins();

function resolveTrustedRedirectUrl(candidate: string | undefined) {
  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate);
    return ALLOWED_REDIRECT_ORIGINS.has(url.origin) ? url.toString() : null;
  } catch {
    return null;
  }
}

function interpolateBookingRedirectUrl(url: string, bookingId: string) {
  return url.replaceAll(BOOKING_ID_PLACEHOLDER, bookingId);
}

function resolveLeadTimeMs(value: number | null, unit: string | null) {
  if (!value || !unit) {
    return 0;
  }

  switch (unit) {
    case 'days':
      return value * 24 * 60 * 60 * 1000;
    case 'weeks':
      return value * 7 * 24 * 60 * 60 * 1000;
    case 'months':
      return value * 30 * 24 * 60 * 60 * 1000;
    default:
      return 0;
  }
}

export class BookingCheckoutError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'BookingCheckoutError';
    this.status = status;
  }
}

export type BookingCheckoutCustomer = {
  auth_user_id: string;
  user_id: bigint;
};

export type CreateBookingCheckoutSessionOptions = {
  areaId: string;
  bookingHours: number;
  cancelUrl?: string;
  customer: BookingCheckoutCustomer;
  guestCount: number;
  spaceId: string;
  startAt: Date;
  successUrl?: string;
  variableOverrides?: Record<string, string | number>;
};

export type CreateBookingCheckoutSessionResult = {
  areaId: string;
  areaName: string;
  bookingHours: number;
  bookingId: string;
  checkoutUrl: string;
  guestCount: number;
  price: number;
  priceCurrency: 'PHP';
  requiresHostApproval: boolean;
  spaceId: string;
  spaceName: string;
  startAt: string;
  testingMode: boolean;
};

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getExistingProviderCheckoutUrl(rawGatewayJson: unknown) {
  if (!isJsonObject(rawGatewayJson)) {
    return null;
  }

  const invoiceUrl = rawGatewayJson.invoice_url;
  return typeof invoiceUrl === 'string' && invoiceUrl.length > 0
    ? invoiceUrl
    : null;
}

export async function createBookingCheckoutSession(
  options: CreateBookingCheckoutSessionOptions
): Promise<CreateBookingCheckoutSessionResult> {
  const {
    areaId,
    bookingHours,
    cancelUrl,
    customer,
    guestCount,
    spaceId,
    startAt,
    successUrl,
    variableOverrides: customVariableOverrides,
  } = options;

  if (!Number.isFinite(startAt.getTime())) {
    throw new BookingCheckoutError(400, 'Please choose a booking start date.');
  }

  const now = new Date();
  if (startAt.getTime() < now.getTime()) {
    throw new BookingCheckoutError(400, 'Start time must be in the future.');
  }

  const area = await prisma.area.findUnique({
    where: { id: areaId, },
    select: {
      id: true,
      name: true,
      max_capacity: true,
      automatic_booking_enabled: true,
      request_approval_at_capacity: true,
      space_id: true,
      advance_booking_enabled: true,
      advance_booking_value: true,
      advance_booking_unit: true,
      price_rule: {
        select: {
          id: true,
          name: true,
          definition: true,
          is_active: true,
        },
      },
      space: {
        select: {
          id: true,
          name: true,
          is_published: true,
          user: { select: { auth_user_id: true, }, },
        },
      },
    },
  });

  if (!area || area.space_id !== spaceId || !area.space) {
    throw new BookingCheckoutError(404, 'Area not found for this space.');
  }

  if (!area.space.is_published) {
    throw new BookingCheckoutError(410, 'This space is no longer available for booking.');
  }

  const areaMaxCapacity = normalizeNumeric(area.max_capacity);
  if (areaMaxCapacity !== null && guestCount > areaMaxCapacity) {
    throw new BookingCheckoutError(400, `This area allows up to ${areaMaxCapacity} guests.`);
  }

  const maxLeadMs = area.advance_booking_enabled
    ? resolveLeadTimeMs(area.advance_booking_value, area.advance_booking_unit)
    : 24 * 60 * 60 * 1000;

  if (maxLeadMs > 0) {
    const maxStart = new Date(now.getTime() + maxLeadMs);
    if (startAt.getTime() > maxStart.getTime()) {
      throw new BookingCheckoutError(
        400,
        `This area only allows bookings up to ${area.advance_booking_enabled ? `${area.advance_booking_value} ${area.advance_booking_unit}` : '24 hours'} in advance.`
      );
    }
  }

  const partnerAuthId = area.space.user?.auth_user_id ?? null;
  const expiresAt = new Date(startAt.getTime() + bookingHours * 60 * 60 * 1000);

  class CapacityReachedError extends Error {}

  const priceRule = area.price_rule as (PriceRuleRecord & { is_active?: boolean }) | null;
  if (!priceRule) {
    throw new BookingCheckoutError(400, 'Pricing is unavailable for this area.');
  }

  if (priceRule.is_active === false) {
    throw new BookingCheckoutError(400, 'The pricing rule for this area is currently inactive.');
  }

  // Validate that customer-provided overrides only target variables declared
  // with userInput: true. This prevents customers from overriding internal
  // variables the partner intended to be fixed.
  if (customVariableOverrides && Object.keys(customVariableOverrides).length > 0) {
    const allowedOverrideKeys = new Set(
      priceRule.definition.variables
        .filter((v) => v.userInput === true)
        .map((v) => v.key)
    );

    const invalidKeys = Object.keys(customVariableOverrides).filter(
      (key) => !allowedOverrideKeys.has(key) && !BUILT_IN_VARIABLE_KEYS.has(key)
    );

    if (invalidKeys.length > 0) {
      throw new BookingCheckoutError(
        400,
        `Invalid variable overrides: ${invalidKeys.join(', ')}`
      );
    }
  }

  const priceEvaluation = (() => {
    try {
      return evaluatePriceRule(priceRule.definition, {
        bookingHours,
        now: startAt,
        variableOverrides: {
          ...customVariableOverrides,
          guest_count: guestCount,
          ...(areaMaxCapacity !== null ? { area_max_capacity: areaMaxCapacity, } : {}),
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Price rule evaluation failed', {
        areaId: area.id,
        priceRuleId: priceRule.id,
        priceRuleName: priceRule.name,
        bookingHours,
        guestCount,
        error: errorMessage,
      });
      return {
        price: null,
        branch: 'unconditional' as const,
        appliedExpression: null,
        conditionsSatisfied: false,
        usedVariables: [] as string[],
      };
    }
  })();

  if (priceEvaluation.price === null) {
    throw new BookingCheckoutError(400, 'Unable to compute a price for this booking.');
  }

  // Check if the formula *meaningfully* uses guest_count by evaluating again
  // with guest_count = 1. A formula like `100 + guest_count * 0` technically
  // references the variable but doesn't change the output — in that case we
  // still need to apply the automatic guest multiplier.
  const formulaAlreadyHandlesGuests = (() => {
    if (!priceEvaluation.usedVariables.includes('guest_count') || guestCount <= 1) {
      return false;
    }
    try {
      const singleGuestEval = evaluatePriceRule(priceRule.definition, {
        bookingHours,
        now: startAt,
        variableOverrides: {
          ...customVariableOverrides,
          guest_count: 1,
          ...(areaMaxCapacity !== null ? { area_max_capacity: areaMaxCapacity, } : {}),
        },
      });
      return singleGuestEval.price !== priceEvaluation.price;
    } catch {
      return false;
    }
  })();
  const guestMultiplier = formulaAlreadyHandlesGuests ? 1 : guestCount;
  const priceMinor = Math.round(priceEvaluation.price * guestMultiplier * BOOKING_PRICE_MINOR_FACTOR);

  if (!Number.isFinite(priceMinor) || priceMinor <= 0) {
    throw new BookingCheckoutError(400, 'Unable to compute a valid price for this booking.');
  }
  const existingPendingBooking = await prisma.booking.findFirst({
    where: {
      area_id: area.id,
      booking_hours: bookingHours,
      expires_at: expiresAt,
      guest_count: guestCount,
      space_id: spaceId,
      start_at: startAt,
      status: 'pending',
      user_auth_id: customer.auth_user_id,
    },
    orderBy: { created_at: 'desc', },
    include: {
      payment_transaction: {
        orderBy: { created_at: 'desc', },
        take: 1,
        select: {
          id: true,
          provider: true,
          provider_object_id: true,
          status: true,
          raw_gateway_json: true,
          amount_minor: true,
          currency_iso3: true,
          is_live: true,
          occurred_at: true,
          created_at: true,
        },
      },
    },
  });

  const bookingResult = existingPendingBooking
    ? await (async () => {
        const existingPaymentTransaction = existingPendingBooking.payment_transaction[0] ?? null;
        const activeCount = await countActiveBookingsOverlap(
          prisma,
          area.id,
          startAt,
          expiresAt,
          existingPendingBooking.id
        );

        const approval = resolveBookingDecision({
          automaticBookingEnabled: Boolean(area.automatic_booking_enabled),
          requestApprovalAtCapacity: Boolean(area.request_approval_at_capacity),
          maxCapacity: areaMaxCapacity,
          activeCount,
          requestedGuestCount: guestCount,
        });
        if (approval.status === 'reject_full') {
          return null;
        }

        return {
          bookingRow: existingPendingBooking,
          existingPaymentTransaction,
          requiresHostApproval: approval.status === 'pending',
        };
      })()
    : await prisma
        .$transaction(
          async (tx) => {
            const activeCount = await countActiveBookingsOverlap(
              tx,
              area.id,
              startAt,
              expiresAt
            );

            const approval = resolveBookingDecision({
              automaticBookingEnabled: Boolean(area.automatic_booking_enabled),
              requestApprovalAtCapacity: Boolean(area.request_approval_at_capacity),
              maxCapacity: areaMaxCapacity,
              activeCount,
              requestedGuestCount: guestCount,
            });
            const requiresHostApproval = approval.status === 'pending';

            if (approval.status === 'reject_full') {
              throw new CapacityReachedError('This area is fully booked for this time window.');
            }

            const created = await tx.booking.create({
              data: {
                id: randomUUID(),
                space_id: spaceId,
                space_name: area.space.name,
                area_id: area.id,
                area_name: area.name,
                booking_hours: bookingHours,
                start_at: startAt,
                price_minor: priceMinor,
                currency: 'PHP',
                status: approval.status === 'confirmed' ? 'pending' : approval.status,
                user_auth_id: customer.auth_user_id,
                partner_auth_id: partnerAuthId,
                area_max_capacity: areaMaxCapacity,
                guest_count: guestCount,
                expires_at: expiresAt,
                price_rule_id: priceRule.id,
                price_rule_name: priceRule.name,
                price_rule_snapshot: priceRule.definition,
                price_rule_branch: priceEvaluation.branch ?? null,
                price_rule_expression: priceEvaluation.appliedExpression ?? null,
                ...(customVariableOverrides && Object.keys(customVariableOverrides).length > 0
                  ? { price_rule_overrides: customVariableOverrides, }
                  : {}),
              },
            });

            return {
              bookingRow: created,
              existingPaymentTransaction: null,
              requiresHostApproval,
            };
          },
          { isolationLevel: 'Serializable', }
        )
        .catch((error) => {
          if (error instanceof CapacityReachedError) {
            return null;
          }
          throw error;
        });

  if (!bookingResult) {
    throw new BookingCheckoutError(409, 'This area is fully booked for the requested time window.');
  }

  const {
    bookingRow,
    existingPaymentTransaction,
    requiresHostApproval,
  } = bookingResult;

  const defaultSuccessUrl = `${APP_URL}/marketplace/${area.space.id}?booking_id=${bookingRow.id}&payment=success`;
  const defaultCancelUrl = `${APP_URL}/marketplace/${area.space.id}?booking_id=${bookingRow.id}&payment=cancel`;
  const resolvedSuccessUrl = interpolateBookingRedirectUrl(
    resolveTrustedRedirectUrl(successUrl) ?? defaultSuccessUrl,
    bookingRow.id
  );
  const resolvedCancelUrl = interpolateBookingRedirectUrl(
    resolveTrustedRedirectUrl(cancelUrl) ?? defaultCancelUrl,
    bookingRow.id
  );

  const partnerWalletOwner = partnerAuthId
    ? await prisma.user.findUnique({
        where: { auth_user_id: partnerAuthId, },
        select: {
          user_id: true,
          provider_accounts: {
            where: { provider: 'xendit', },
            select: {
              id: true,
              provider_account_id: true,
              status: true,
              currency: true,
            },
            take: 1,
          },
        },
      })
    : null;
  const partnerInternalUserId = partnerWalletOwner?.user_id?.toString() ?? null;
  const partnerProviderAccount = partnerWalletOwner?.provider_accounts[0] ?? null;

  const metadata = {
    booking_id: bookingRow.id,
    space_id: bookingRow.space_id,
    area_id: bookingRow.area_id,
    internal_user_id: customer.user_id.toString(),
    customer_internal_user_id: customer.user_id.toString(),
    requires_host_approval: requiresHostApproval ? 'true' : 'false',
    ...(partnerInternalUserId
      ? { partner_internal_user_id: partnerInternalUserId, }
      : {}),
  } satisfies Record<string, string>;

  if (isTestingModeEnabled()) {
    const confirmedBooking = await prisma.booking.update({
      where: { id: bookingRow.id, },
      data: { status: 'confirmed', },
    });

    const booking = mapBookingRowToRecord(confirmedBooking);
    const bookingHref = `/marketplace/${booking.spaceId}`;

    await prisma.app_notification.create({
      data: {
        user_auth_id: booking.customerAuthId,
        title: 'Booking confirmed',
        body: `${booking.areaName} at ${booking.spaceName} is confirmed.`,
        href: bookingHref,
        type: 'booking_confirmed',
        booking_id: booking.id,
        space_id: booking.spaceId,
        area_id: booking.areaId,
      },
    });

    if (booking.partnerAuthId) {
      await prisma.app_notification.create({
        data: {
          user_auth_id: booking.partnerAuthId,
          title: 'New booking received',
          body: `${booking.areaName} in ${booking.spaceName} was just booked.`,
          href: bookingHref,
          type: 'booking_received',
          booking_id: booking.id,
          space_id: booking.spaceId,
          area_id: booking.areaId,
        },
      });
    }

    try {
      const adminClient = getSupabaseAdminClient();
      const {
        data: userData,
        error: userError,
      } = await adminClient.auth.admin.getUserById(booking.customerAuthId);

      if (userError) {
        console.warn('Unable to read customer email for booking notification', userError);
      }

      const userEmail = userData?.user?.email;
      if (userEmail) {
        await sendBookingNotificationEmail({
          to: userEmail,
          spaceName: booking.spaceName,
          areaName: booking.areaName,
          bookingHours: booking.bookingHours,
          price: booking.price,
          link: `${APP_URL}${bookingHref}`,
        });
      }
    } catch (notifyError) {
      console.error('Failed to send booking notification email', notifyError);
    }

    if (partnerWalletOwner?.user_id) {
      const walletMetadata: Record<string, unknown> = { customer_internal_user_id: customer.user_id.toString(), };

      if (partnerInternalUserId) {
        walletMetadata.partner_internal_user_id = partnerInternalUserId;
      }

      if (partnerAuthId) {
        walletMetadata.partner_auth_id = partnerAuthId;
      }

      try {
        await recordTestModeBookingWalletCharge({
          walletOwnerUserId: partnerWalletOwner.user_id,
          bookingId: booking.id,
          amountMinor: priceMinor,
          currency: confirmedBooking.currency,
          description: `${booking.areaName} · ${booking.spaceName}`,
          metadata: walletMetadata,
        });
      } catch (walletError) {
        console.error('Failed to record wallet activity in testing mode', {
          bookingId: booking.id,
          error: walletError,
        });
      }
    }

    return {
      areaId: booking.areaId,
      areaName: booking.areaName,
      bookingHours: booking.bookingHours,
      bookingId: booking.id,
      checkoutUrl: resolvedSuccessUrl,
      guestCount: booking.guestCount ?? guestCount,
      price: booking.price ?? priceMinor / BOOKING_PRICE_MINOR_FACTOR,
      priceCurrency: 'PHP',
      requiresHostApproval,
      spaceId: booking.spaceId,
      spaceName: booking.spaceName,
      startAt: booking.startAt,
      testingMode: true,
    };
  }

  if (
    existingPaymentTransaction?.provider === 'xendit' &&
    existingPaymentTransaction.status === 'pending'
  ) {
    const existingCheckoutUrl = getExistingProviderCheckoutUrl(
      existingPaymentTransaction.raw_gateway_json
    );

    if (existingCheckoutUrl) {
      // Use the amount from the existing payment transaction to ensure the
      // displayed price matches what the customer will actually be charged.
      const chargedAmountMinor = Number(existingPaymentTransaction.amount_minor);
      const displayPrice = Number.isFinite(chargedAmountMinor) && chargedAmountMinor > 0
        ? chargedAmountMinor / BOOKING_PRICE_MINOR_FACTOR
        : priceMinor / BOOKING_PRICE_MINOR_FACTOR;

      return {
        areaId: area.id,
        areaName: area.name,
        bookingHours,
        bookingId: bookingRow.id,
        checkoutUrl: existingCheckoutUrl,
        guestCount,
        price: displayPrice,
        priceCurrency: 'PHP',
        requiresHostApproval,
        spaceId: area.space.id,
        spaceName: area.space.name,
        startAt: startAt.toISOString(),
        testingMode: false,
      };
    }
  }

  if (!partnerProviderAccount?.provider_account_id || partnerProviderAccount.status !== 'live') {
    throw new BookingCheckoutError(
      409,
      'This space is temporarily unavailable because the partner payout account is not ready.'
    );
  }

  const provider = getFinancialProvider();
  const checkoutSession = await provider.createBookingPayment({
    partnerProviderAccountId: partnerProviderAccount.provider_account_id,
    referenceId: bookingRow.id,
    amountMinor: BigInt(priceMinor),
    currency: bookingRow.currency,
    description: `${area.space.name} · ${area.name}`,
    successUrl: resolvedSuccessUrl,
    cancelUrl: resolvedCancelUrl,
    metadata: {
      ...metadata,
      partner_provider_account_id: partnerProviderAccount.id,
    },
  });

  await prisma.payment_transaction.upsert({
    where: {
      provider_provider_object_id: {
        provider: 'xendit',
        provider_object_id: checkoutSession.paymentId,
      },
    },
    create: {
      booking_id: bookingRow.id,
      provider: 'xendit',
      provider_object_id: checkoutSession.paymentId,
      status: 'pending',
      amount_minor: BigInt(priceMinor),
      currency_iso3: bookingRow.currency,
      payment_method_type: 'xendit_invoice',
      is_live: checkoutSession.isLive,
      raw_gateway_json: {
        ...(checkoutSession.raw ?? {}),
        invoice_url: checkoutSession.checkoutUrl,
        partner_provider_account_id: partnerProviderAccount.id,
      },
    },
    update: {
      booking_id: bookingRow.id,
      status: 'pending',
      amount_minor: BigInt(priceMinor),
      currency_iso3: bookingRow.currency,
      payment_method_type: 'xendit_invoice',
      is_live: checkoutSession.isLive,
      raw_gateway_json: {
        ...(checkoutSession.raw ?? {}),
        invoice_url: checkoutSession.checkoutUrl,
        partner_provider_account_id: partnerProviderAccount.id,
      },
      updated_at: new Date(),
    },
  });

  return {
    areaId: area.id,
    areaName: area.name,
    bookingHours,
    bookingId: bookingRow.id,
    checkoutUrl: checkoutSession.checkoutUrl,
    guestCount,
    price: priceMinor / BOOKING_PRICE_MINOR_FACTOR,
    priceCurrency: 'PHP',
    requiresHostApproval,
    spaceId,
    spaceName: area.space.name,
    startAt: startAt.toISOString(),
    testingMode: false,
  };
}
