export type PartnerSpace = {
  id: string;
  name: string;
  city: string;
  status: 'Live' | 'Pending' | 'Draft' | 'Unpublished';
  occupancy: number;
  occupancyDelta: number;
  nextBooking: string;
  plan: 'Enterprise' | 'Flex' | 'Event';
  unresolvedItems: number;
};

export const PARTNER_SPACES: PartnerSpace[] = [
  {
    id: 'atlas-loft',
    name: 'Atlas Loft',
    city: 'San Francisco, CA',
    status: 'Live',
    occupancy: 87,
    occupancyDelta: 4,
    nextBooking: 'Mar 18 - Team Off-site',
    plan: 'Enterprise',
    unresolvedItems: 0,
  },
  {
    id: 'beacon-collective',
    name: 'Beacon Collective',
    city: 'Brooklyn, NY',
    status: 'Pending',
    occupancy: 64,
    occupancyDelta: -3,
    nextBooking: 'Mar 12 - Film Studio',
    plan: 'Flex',
    unresolvedItems: 2,
  },
  {
    id: 'marina-lab',
    name: 'Marina Lab',
    city: 'Seattle, WA',
    status: 'Live',
    occupancy: 58,
    occupancyDelta: 7,
    nextBooking: 'Mar 14 - Hardware Sprint',
    plan: 'Flex',
    unresolvedItems: 1,
  },
  {
    id: 'north-loop-atelier',
    name: 'North Loop Atelier',
    city: 'Minneapolis, MN',
    status: 'Draft',
    occupancy: 0,
    occupancyDelta: 0,
    nextBooking: '--',
    plan: 'Event',
    unresolvedItems: 4,
  },
  {
    id: 'crosstown-commons',
    name: 'Crosstown Commons',
    city: 'Chicago, IL',
    status: 'Live',
    occupancy: 92,
    occupancyDelta: 2,
    nextBooking: 'Mar 19 - Executive Briefing',
    plan: 'Enterprise',
    unresolvedItems: 0,
  }
];

export type ActionCard = {
  id: string;
  title: string;
  description: string;
  helper: string;
  ctaLabel: string;
  href: string;
};

export const ACTION_CARDS: ActionCard[] = [
  {
    id: 'new-listing',
    title: 'Add a new space',
    description: 'Upload media, define amenities, and set day or hourly pricing in less than 10 minutes.',
    helper: 'Syncs with Supabase inventory immediately',
    ctaLabel: 'Create listing',
    href: '/partner/spaces/new',
  },
  {
    id: 'calendar',
    title: 'Update availability',
    description: 'Push blackout dates or bulk import ICS feeds so members always see an accurate calendar.',
    helper: 'Supports Google and Outlook feeds',
    ctaLabel: 'Open calendar',
    href: '/partner/calendar',
  },
  {
    id: 'payouts',
    title: 'Review payouts',
    description: 'Monitor completed bookings, dispute adjustments, and export monthly statements.',
    helper: 'Latest transfer: Mar 8, 2025',
    ctaLabel: 'Go to payouts',
    href: '/partner/payouts',
  }
];

export type KPIStat = {
  label: string;
  value: string;
  helper: string;
};

export const KPI_STATS: KPIStat[] = [
  {
    label: 'Active spaces',
    value: '18',
    helper: '+3 vs last quarter',
  },
  {
    label: 'Occupancy',
    value: '82%',
    helper: 'Rolling 30-day average',
  },
  {
    label: 'Avg. response time',
    value: '1.9 hrs',
    helper: 'SLA target: 2 hrs',
  }
];
