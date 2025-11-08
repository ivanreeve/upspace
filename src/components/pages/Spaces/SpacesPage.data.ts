export type PartnerSpace = {
  id: string;
  name: string;
  city: string;
  status: 'Live' | 'Pending' | 'Draft';
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

export type TaskItem = {
  id: string;
  title: string;
  description: string;
  due: string;
  severity: 'high' | 'medium' | 'low';
};

export const TASKS: TaskItem[] = [
  {
    id: 'compliance-audit',
    title: 'Upload updated fire safety certificate',
    description: 'Atlas Loft expires on Mar 30. Upload the signed document to avoid delisting.',
    due: 'Due in 5 days',
    severity: 'high',
  },
  {
    id: 'photos',
    title: 'Refresh Beacon Collective media set',
    description: 'New podcast booth photos increase booking conversion by 18% on average.',
    due: 'Due in 9 days',
    severity: 'medium',
  },
  {
    id: 'policy',
    title: 'Confirm flex cancellation policy',
    description: 'Crosstown Commons requires the updated 72-hour policy for corporate clients.',
    due: 'Due in 12 days',
    severity: 'low',
  }
];

export type WorkflowStep = {
  id: number;
  title: string;
  description: string;
  owner: string;
  status: 'Complete' | 'In progress' | 'Queued';
};

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 1,
    title: 'Compliance verification',
    description: 'Upload liability insurance, safety docs, and front-of-house SOPs.',
    owner: 'Compliance',
    status: 'Complete',
  },
  {
    id: 2,
    title: 'Inventory sync',
    description: 'Connect property management feeds or manual schedules.',
    owner: 'Partner Ops',
    status: 'In progress',
  },
  {
    id: 3,
    title: 'Demand boost campaign',
    description: 'Enable paid placements for underutilized suites.',
    owner: 'Growth',
    status: 'Queued',
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
