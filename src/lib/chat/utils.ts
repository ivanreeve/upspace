import { buildPublicObjectUrl } from '@/lib/spaces/image-urls';
import type { ChatMessage } from '@/types/chat';

type ChatUserPreview = {
  first_name: string | null;
  last_name: string | null;
  handle: string | null;
  avatar: string | null;
};

export function formatDisplayName(user: ChatUserPreview | null | undefined) {
  if (!user) {
    return null;
  }

  const names = [user.first_name, user.last_name]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  if (names.length) {
    return names.join(' ');
  }

  if (user.handle) {
    return user.handle.trim();
  }

  return null;
}

export function resolveAvatarUrl(avatar: string | null | undefined) {
  return buildPublicObjectUrl(avatar ?? null);
}

export function mapChatMessage(
  message: {
    id: string;
    room_id: string;
    sender_id: bigint;
    sender_role: 'customer' | 'partner';
    content: string;
    created_at: Date;
  },
  customerName: string | null,
  partnerName: string | null
): ChatMessage {
  return {
    id: message.id,
    roomId: message.room_id,
    content: message.content,
    senderId: message.sender_id.toString(),
    senderRole: message.sender_role,
    senderName: message.sender_role === 'customer' ? customerName : partnerName,
    createdAt: message.created_at.toISOString(),
  };
}
