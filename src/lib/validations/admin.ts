import { z } from 'zod';

const validUntilSchema = z.union([
  z
    .string()
    .min(1, 'Validity end date is required.')
    .refine(
      (value) => !Number.isNaN(Date.parse(value)),
      'Validity end date must be a valid date.'
    ),
  z.null()
]);

export const verificationActionSchema = z
  .object({
    action: z.enum(['approve', 'reject']),
    rejected_reason: z
      .string()
      .min(1, 'Rejection reason is required.')
      .max(1000, 'Rejection reason must be 1000 characters or less.')
      .optional(),
    valid_until: validUntilSchema.optional(),
  })
  .refine(
    (data) => data.action !== 'reject' || Boolean(data.rejected_reason?.trim()),
    {
      message: 'Rejection reason is required when rejecting.',
      path: ['rejected_reason'],
    }
  )
  .superRefine((data, ctx) => {
    if (data.action === 'approve' && typeof data.valid_until === 'undefined') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Validity end date is required when approving.',
        path: ['valid_until'],
      });
    }
  });

export type VerificationActionInput = z.infer<typeof verificationActionSchema>;
