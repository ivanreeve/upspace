export type ChatMessage = {
  id: string;
  roomId: string;
  content: string;
  senderId: string;
  senderRole: 'customer' | 'partner';
  senderName: string | null;
  createdAt: string;
};

export type ChatRoomSummary = {
  id: string;
  spaceId: string;
  spaceName: string;
  spaceCity?: string | null;
  spaceRegion?: string | null;
  customerId: string;
  customerName: string | null;
  customerHandle: string | null;
  customerAvatarUrl: string | null;
  partnerId: string;
  partnerName: string | null;
  partnerAvatarUrl: string | null;
  lastMessage: ChatMessage | null;
  spaceHeroImageUrl?: string | null;
  createdAt: string;
};

export type ChatRoomDetail = ChatRoomSummary & {
  messages: ChatMessage[];
};
