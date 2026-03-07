// @vitest-environment jsdom

import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { AdminDashboardPage } from '@/components/pages/Admin/AdminDashboardPage';
import { type AdminDashboardPayload, useAdminDashboardQuery } from '@/hooks/api/useAdminDashboard';

vi.mock('@/hooks/api/useAdminDashboard', () => ({ useAdminDashboardQuery: vi.fn(), }));

const mockUseAdminDashboardQuery = vi.mocked(useAdminDashboardQuery);

const liveDashboardPayload: AdminDashboardPayload = {
  metrics: {
    revenue: {
      totalMinor: '1250000',
      transactionCount: 312,
    },
    bookings: {
      total: 312,
      statusCounts: [
        {
          status: 'confirmed',
          count: 204,
        }
      ],
    },
    spaces: {
      total: 97,
      published: 72,
      unpublished: 25,
    },
    clients: {
      total: 1524,
      active: 1241,
      deactivated: 104,
      pendingDeletion: 21,
      deleted: 58,
      newLast7Days: 41,
    },
    verifications: {
      total: 69,
      statusCounts: [
        {
          status: 'approved',
          count: 45,
        }
      ],
    },
  },
  recent: {
    bookings: [],
    spaces: [],
    clients: [],
    verifications: [],
  },
  auditLog: [],
};

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    mockUseAdminDashboardQuery.mockReturnValue({
      data: liveDashboardPayload,
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useAdminDashboardQuery>);
  });

  it('renders live dashboard content without preview-mode copy', () => {
    render(<AdminDashboardPage />);

    expect(mockUseAdminDashboardQuery).toHaveBeenCalled();
    expect(
      screen.getByText('Live operational data from recent records, metrics, and audit events.')
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/preview renders a representative dataset/i)
    ).not.toBeInTheDocument();
    expect(screen.getByText('Recent Prisma records')).toBeInTheDocument();
    expect(screen.getByText('Unified audit log')).toBeInTheDocument();
    expect(screen.getByText('No audit events recorded yet.')).toBeInTheDocument();
  });
});
