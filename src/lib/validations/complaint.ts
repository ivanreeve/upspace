import { z } from 'zod';

import { COMPLAINT_CATEGORY_VALUES, COMPLAINT_STATUS_VALUES } from '@/lib/complaints/constants';

export const createComplaintPayloadSchema = z.object({
  booking_id: z.string().uuid('A valid booking id is required.'),
  category: z.enum(COMPLAINT_CATEGORY_VALUES),
  description: z
    .string()
    .trim()
    .min(10, 'Description must be at least 10 characters.')
    .max(2000, 'Description must be 2000 characters or less.'),
});

export const customerComplaintsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});

export const partnerComplaintsQuerySchema = z.object({
  status: z.enum(COMPLAINT_STATUS_VALUES).default('pending'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});

export const partnerComplaintActionSchema = z
  .object({
    action: z.enum(['resolve', 'escalate']),
    note: z
      .string()
      .trim()
      .max(1000, 'Note must be 1000 characters or less.')
      .optional(),
  })
  .superRefine((payload, ctx) => {
    if (payload.action === 'escalate' && !payload.note?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A note is required when escalating a complaint.',
        path: ['note'],
      });
    }
  });

export const adminComplaintsQuerySchema = z.object({
  status: z.enum(COMPLAINT_STATUS_VALUES).default('escalated'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});

export const adminComplaintActionSchema = z
  .object({
    action: z.enum(['resolve', 'dismiss']),
    note: z
      .string()
      .trim()
      .max(1000, 'Note must be 1000 characters or less.')
      .optional(),
  })
  .superRefine((payload, ctx) => {
    if (payload.action === 'dismiss' && !payload.note?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A note is required when dismissing a complaint.',
        path: ['note'],
      });
    }
  });
