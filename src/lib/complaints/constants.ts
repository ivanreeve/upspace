export const COMPLAINT_CATEGORY_VALUES = [
  'service_quality',
  'billing',
  'cancellation',
  'safety',
  'other'
] as const;

export type ComplaintCategory = (typeof COMPLAINT_CATEGORY_VALUES)[number];

export const COMPLAINT_STATUS_VALUES = ['pending', 'escalated', 'resolved', 'dismissed'] as const;

export type ComplaintStatus = (typeof COMPLAINT_STATUS_VALUES)[number];

export const COMPLAINT_CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  service_quality: 'Service quality',
  billing: 'Billing',
  cancellation: 'Cancellation',
  safety: 'Safety',
  other: 'Other',
};

export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  pending: 'Pending',
  escalated: 'Escalated',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

export const COMPLAINT_CATEGORY_OPTIONS = COMPLAINT_CATEGORY_VALUES.map((value) => ({
  value,
  label: COMPLAINT_CATEGORY_LABELS[value],
}));
