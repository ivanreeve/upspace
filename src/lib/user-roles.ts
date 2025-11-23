export const ALLOWED_USER_ROLES = ['partner', 'customer'] as const;
export type AllowedUserRole = (typeof ALLOWED_USER_ROLES)[number];

export const ROLE_DETAILS: Record<AllowedUserRole, {
  title: string;
  description: string;
  image: string;
}> = {
  partner: {
    title: 'Partner',
    description: 'Manage spaces, onboard teammates, and keep your inventory visible to the community.',
    image: '/img/onboarding-partner-bg.jpeg',
  },
  customer: {
    title: 'Customer',
    description: 'Book ready-to-use rooms, see availability in one glance, and keep your projects on track.',
    image: '/img/onboarding-customer-bg.jpeg',
  },
};
