import { z } from 'zod';

export const verificationActionSchema = z
  .object({
    action: z.enum(['approve', 'reject']),
    rejected_reason: z
      .string()
      .min(1, 'Rejection reason is required.')
      .max(1000, 'Rejection reason must be 1000 characters or less.')
      .optional(),
  })
  .refine(
    (data) => data.action !== 'reject' || Boolean(data.rejected_reason?.trim()),
    {
      message: 'Rejection reason is required when rejecting.',
      path: ['rejected_reason'],
    }
  );

export type VerificationActionInput = z.infer<typeof verificationActionSchema>;
