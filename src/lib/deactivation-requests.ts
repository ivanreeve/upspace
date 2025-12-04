export type DeactivationReasonCategory = 'not_using' | 'pricing' | 'privacy' | 'switching' | 'other';

export const DEACTIVATION_REASON_OPTIONS: {
  value: DeactivationReasonCategory;
  label: string;
  description: string;
 }[] = [
  {
    value: 'not_using',
    label: 'I no longer use UpSpace',
    description: 'My workflow has shifted and I rarely book new spaces.',
  },
  {
    value: 'pricing',
    label: 'Cost doesn’t match my current needs',
    description: 'I am looking for a more affordable option.',
  },
  {
    value: 'privacy',
    label: 'Privacy or security concerns',
    description: 'I want tighter control over my stored data.',
  },
  {
    value: 'switching',
    label: 'I’m switching to another platform',
    description: 'Another service better fits my team.',
  },
  {
    value: 'other',
    label: 'Other (please share)',
    description: 'Tell us what else we should know before closing your account.',
  }
];

export const DEACTIVATION_REASON_LABELS: Record<DeactivationReasonCategory, string> = {
  not_using: 'No longer using UpSpace',
  pricing: 'Pricing does not fit',
  privacy: 'Privacy or security concerns',
  switching: 'Switching platforms',
  other: 'Other',
};
