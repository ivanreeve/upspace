export const CHAT_REPORT_REASON_VALUES = [
  'harassment',
  'scam',
  'spam',
  'inappropriate',
  'other'
] as const;

export type ChatReportReason = (typeof CHAT_REPORT_REASON_VALUES)[number];

export const CHAT_REPORT_STATUS_VALUES = ['pending', 'resolved', 'dismissed'] as const;

export type ChatReportStatus = (typeof CHAT_REPORT_STATUS_VALUES)[number];

export const CHAT_REPORT_REASON_LABELS: Record<ChatReportReason, string> = {
  harassment: 'Harassment or hate speech',
  scam: 'Scam or fraud',
  spam: 'Spam',
  inappropriate: 'Inappropriate content',
  other: 'Other',
};

export const CHAT_REPORT_STATUS_LABELS: Record<ChatReportStatus, string> = {
  pending: 'Pending',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

export const CHAT_REPORT_REASON_OPTIONS = CHAT_REPORT_REASON_VALUES.map((value) => ({
  value,
  label: CHAT_REPORT_REASON_LABELS[value],
}));
