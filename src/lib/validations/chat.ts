import { z } from 'zod';

export const chatRoomQuerySchema = z.object({ space_id: z.string().uuid().optional(), });

export const chatMessageRoomQuerySchema = z.object({ room_id: z.string().uuid(), });

export const chatMessagePayloadSchema = z.object({
  room_id: z.string().uuid().optional(),
  space_id: z.string().uuid().optional(),
  content: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty.')
    .max(2000, 'Message cannot exceed 2,000 characters.'),
});
