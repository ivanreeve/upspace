import { z } from 'zod';

import { CHAT_REPORT_REASON_VALUES, CHAT_REPORT_STATUS_VALUES } from '@/lib/chat/reporting';

export const createChatReportPayloadSchema = z
  .object({
    room_id: z.string().uuid('A valid room id is required.'),
    reason: z.enum(CHAT_REPORT_REASON_VALUES),
    details: z
      .string()
      .trim()
      .max(1000, 'Additional details must be 1000 characters or less.')
      .optional(),
  })
  .superRefine((payload, ctx) => {
    if (payload.reason === 'other' && !payload.details?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please provide details when selecting Other.',
        path: ['details'],
      });
    }
  });

export const adminChatReportsQuerySchema = z.object({
  status: z.enum(CHAT_REPORT_STATUS_VALUES).default('pending'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});

export const adminChatReportActionSchema = z
  .object({
    action: z.enum(['resolve', 'dismiss']),
    resolution_note: z
      .string()
      .trim()
      .max(1000, 'Resolution note must be 1000 characters or less.')
      .optional(),
  })
  .superRefine((payload, ctx) => {
    if (payload.action === 'dismiss' && !payload.resolution_note?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A dismissal note is required when dismissing a report.',
        path: ['resolution_note'],
      });
    }
  });
