import { z } from 'zod';

import { WEEKDAY_ORDER } from '@/data/spaces';

export const advanceBookingUnits = ['days', 'weeks', 'months'] as const;

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const weekdayEnum = z.enum(WEEKDAY_ORDER);

const toMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : Number.NaN;
};

const weeklyAvailabilitySchema = z
  .record(
    weekdayEnum,
    z
      .object({
        is_open: z.boolean(),
        opens_at: z.string().regex(timePattern, 'Use 24-hour HH:MM format.'),
        closes_at: z.string().regex(timePattern, 'Use 24-hour HH:MM format.'),
      })
      .superRefine((values, ctx) => {
        if (!values.is_open) {
          return;
        }

        const openMinutes = toMinutes(values.opens_at);
        const closeMinutes = toMinutes(values.closes_at);

        if (!Number.isFinite(openMinutes) || !Number.isFinite(closeMinutes)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Enter valid times in HH:MM format.',
          });
          return;
        }

        if (closeMinutes <= openMinutes) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Closing time must be after opening time.',
            path: ['closes_at'],
          });
        }
      })
  )
  .superRefine((availability, ctx) => {
    let hasOpenDay = false;

    for (const day of WEEKDAY_ORDER) {
      const slot = availability[day];

      if (!slot) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [day],
          message: `Provide hours for ${day}.`,
        });
        continue;
      }

      if (slot.is_open) {
        hasOpenDay = true;
      }
    }

    if (!hasOpenDay) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Open the space on at least one day of the week.',
        path: [],
      });
    }
  });

export const spaceSchema = z.object({
  name: z.string().min(1, 'Space name is required.'),
  description: z
    .string({ required_error: 'Description is required.', })
    .refine((value) => value.trim().length >= 20, 'Description must be at least 20 characters long.'),
  unit_number: z
    .string()
    .max(200, 'Unit / suite must be 200 characters or less.')
    .optional()
    .transform((value) => (value ?? '').trim()),
  address_subunit: z
    .string()
    .max(200, 'Address subunit must be 200 characters or less.')
    .optional()
    .transform((value) => (value ?? '').trim()),
  street: z.string().min(1, 'Street is required.'),
  barangay: z.string().optional(),
  city: z.string().min(1, 'City is required.'),
  region: z.string().min(1, 'Region / state is required.'),
  postal_code: z
    .string()
    .length(4, 'Postal code must be exactly 4 digits.')
    .regex(/^\d{4}$/, 'Postal code must be exactly 4 digits.'),
  country_code: z
    .string()
    .length(2, 'Use the 2-letter ISO country code.')
    .regex(/^[A-Za-z]{2}$/, 'Only alphabetic characters are allowed.'),
  lat: z
    .coerce
    .number({ message: 'Latitude is required.', })
    .min(-90, 'Latitude must be >= -90.')
    .max(90, 'Latitude must be <= 90.'),
  long: z
    .coerce
    .number({ message: 'Longitude is required.', })
    .min(-180, 'Longitude must be >= -180.')
    .max(180, 'Longitude must be <= 180.'),
  availability: weeklyAvailabilitySchema,
  amenities: z.array(z.string().uuid()).default([]),
});

export const spaceDetailsSchema = spaceSchema.pick({
  name: true,
  description: true,
  unit_number: true,
  address_subunit: true,
  street: true,
  barangay: true,
  city: true,
  region: true,
  postal_code: true,
  country_code: true,
  lat: true,
  long: true,
});

export const areaSchema = z
  .object({
    name: z.string().min(1, 'Area name is required.'),
    max_capacity: z
      .coerce
      .number({ message: 'Provide the maximum capacity.', })
      .int()
      .min(1, 'Maximum capacity must be at least 1 seat.'),
    automatic_booking_enabled: z.boolean().default(false),
    request_approval_at_capacity: z.boolean().default(false),
    advance_booking_enabled: z.boolean().default(false),
    advance_booking_value: z
      .coerce
      .number({ message: 'Provide an advance booking window.', })
      .int()
      .min(1, 'Advance booking window must be at least 1.')
      .optional()
      .nullable(),
    advance_booking_unit: z.enum(advanceBookingUnits).optional().nullable(),
    booking_notes_enabled: z.boolean().default(false),
    booking_notes: z
      .string()
      .trim()
      .max(2000, 'Booking notes must be 2,000 characters or less.')
      .optional()
      .nullable(),
    price_rule_id: z
      .string()
      .uuid()
      .optional()
      .nullable(),
  })
  .refine(
    (values) => !values.advance_booking_enabled || (values.advance_booking_value && values.advance_booking_unit),
    {
      path: ['advance_booking_value'],
      message: 'Set a window and unit when advance booking is enabled.',
    }
  )
  .refine(
    (values) => !values.advance_booking_enabled || Boolean(values.advance_booking_unit),
    {
      path: ['advance_booking_unit'],
      message: 'Choose a unit when advance booking is enabled.',
    }
  )
  .refine(
    (values) => !values.automatic_booking_enabled || values.max_capacity >= 1,
    {
      path: ['max_capacity'],
      message: 'Maximum capacity is required when automatic booking is enabled.',
    }
  );

export type SpaceFormValues = z.infer<typeof spaceSchema>;
export type AreaFormValues = z.infer<typeof areaSchema>;
export type WeeklyAvailabilityFormValues = z.infer<typeof weeklyAvailabilitySchema>;
export type SpaceDetailsFormValues = z.infer<typeof spaceDetailsSchema>;
