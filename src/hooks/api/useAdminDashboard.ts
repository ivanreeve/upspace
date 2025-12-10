'use client';

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';

export type AdminDashboardBooking = {
  id: string;
  space_id: string;
  area_id: string;
  booking_hours: string;
  price_minor: string | null;
  currency: string;
  status: string;
  created_at: string;
  expires_at: string | null;
  user_auth_id: string;
  partner_auth_id: string | null;
};

export type AdminDashboardSpace = {
  id: string;
  name: string;
  city: string;
  region: string;
  user_id: string;
  is_published: boolean;
  unpublished_at: string | null;
  unpublished_reason: string | null;
  unpublished_by_admin: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type AdminDashboardClient = {
  user_id: string;
  role: string;
  status: string;
  first_name: string | null;
  last_name: string | null;
  handle: string;
  created_at: string;
  updated_at: string;
};

export type AdminDashboardVerification = {
  id: string;
  space_id: string;
  partner_id: string | null;
  subject_type: string;
  status: string;
  submitted_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminDashboardAuditEvent = {
  audit_id: string;
  occured_at: string;
  action: string;
  object_table: string;
  object_pk: string;
  actor_label: string | null;
  actor_user_id: string | null;
  session_id: string | null;
  request_id: string | null;
  outcome: string;
  reason: string | null;
  extra: Record<string, unknown> | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
};

export type AdminDashboardMetrics = {
  bookings: {
    total: number;
    statusCounts: { status: string; count: number }[];
  };
  spaces: {
    total: number;
    published: number;
    unpublished: number;
  };
  clients: {
    total: number;
    active: number;
    deactivated: number;
    pendingDeletion: number;
    deleted: number;
    newLast7Days: number;
  };
  verifications: {
    total: number;
    statusCounts: { status: string; count: number }[];
  };
};

export type AdminDashboardPayload = {
  metrics: AdminDashboardMetrics;
  recent: {
    bookings: AdminDashboardBooking[];
    spaces: AdminDashboardSpace[];
    clients: AdminDashboardClient[];
    verifications: AdminDashboardVerification[];
  };
  auditLog: AdminDashboardAuditEvent[];
};

export const adminDashboardKeys = { all: ['admin-dashboard'] as const, };

type AdminDashboardQueryOptions = Omit<
  UseQueryOptions<AdminDashboardPayload>,
  'queryKey' | 'queryFn'
>;

const parseErrorMessage = async (response: Response) => {
  try {
    const body = await response.json();
    if (typeof body?.error === 'string') {
      return body.error;
    }
    if (typeof body?.message === 'string') {
      return body.message;
    }
  } catch {
    // ignore
  }
  return 'Unable to load dashboard data.';
};

export function useAdminDashboardQuery(options?: AdminDashboardQueryOptions) {
  const authFetch = useAuthenticatedFetch();

  return useQuery<AdminDashboardPayload>({
    queryKey: adminDashboardKeys.all,
    queryFn: async () => {
      const response = await authFetch('/api/v1/admin/dashboard');
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }
      const payload = await response.json();
      return payload.data;
    },
    ...options,
  });
}
