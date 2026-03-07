'use client';

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';
import { parseErrorMessage } from '@/lib/api/parse-error-message';

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
  revenue: {
    totalMinor: string;
    transactionCount: number;
  };
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

export type PaginationInfo = {
  page: number;
  pageSize: number;
  total: number;
};

export type RecentPaginationInfo = {
  page: number;
  pageSize: number;
  totals: {
    bookings: number;
    spaces: number;
    clients: number;
    verifications: number;
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
  recentPagination: RecentPaginationInfo;
  auditLog: AdminDashboardAuditEvent[];
  auditPagination: PaginationInfo;
};

export type AdminDashboardParams = {
  recentPage?: number;
  recentSize?: number;
  auditPage?: number;
  auditSize?: number;
};

export const adminDashboardKeys = {
  all: ['admin-dashboard'] as const,
  paginated: (params: AdminDashboardParams) =>
    ['admin-dashboard', params] as const,
};

type AdminDashboardQueryOptions = Omit<
  UseQueryOptions<AdminDashboardPayload>,
  'queryKey' | 'queryFn'
>;

export function useAdminDashboardQuery(
  params: AdminDashboardParams = {},
  options?: AdminDashboardQueryOptions
) {
  const authFetch = useAuthenticatedFetch();

  return useQuery<AdminDashboardPayload>({
    queryKey: adminDashboardKeys.paginated(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.recentPage) searchParams.set('recentPage', String(params.recentPage));
      if (params.recentSize) searchParams.set('recentSize', String(params.recentSize));
      if (params.auditPage) searchParams.set('auditPage', String(params.auditPage));
      if (params.auditSize) searchParams.set('auditSize', String(params.auditSize));

      const qs = searchParams.toString();
      const url = `/api/v1/admin/dashboard${qs ? `?${qs}` : ''}`;
      const response = await authFetch(url);
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response, 'Unable to load dashboard data.'));
      }
      const payload = await response.json();
      return payload.data;
    },
    staleTime: 60_000,
    ...options,
  });
}
