import { z } from 'zod';

export const CHAT_MESSAGE_MAX_LENGTH = 1500;

export const chatRoomQuerySchema = z.object({ space_id: z.string().uuid().optional(), });

export const chatMessageRoomQuerySchema = z.object({ room_id: z.string().uuid(), });

export const chatMessagePayloadSchema = z.object({
  room_id: z.string().uuid().optional(),
  space_id: z.string().uuid().optional(),
  content: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty.')
    .max(CHAT_MESSAGE_MAX_LENGTH, 'Message cannot exceed 1,500 characters.'),
});
