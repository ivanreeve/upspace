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

import { AdminReportsPage } from '@/components/pages/Admin/AdminReportsPage';
import { type AdminReportPayload, useAdminReportsQuery } from '@/hooks/api/useAdminReports';

vi.mock('@/hooks/api/useAdminReports', () => ({ useAdminReportsQuery: vi.fn(), }));

const mockUseAdminReportsQuery = vi.mocked(useAdminReportsQuery);

const basePayload: AdminReportPayload = {
  range: {
    days: 30,
    start: '2026-02-07T00:00:00.000Z',
    end: '2026-03-09T00:00:00.000Z',
    previousStart: '2026-01-08T00:00:00.000Z',
    previousEnd: '2026-02-07T00:00:00.000Z',
  },
  trends: {
    bookings: {
 current: 10,
previous: 5,
changePct: 100, 
},
    grossRevenue: {
 currentMinor: '50000',
previousMinor: '40000',
changePct: 25, 
},
    cancellationRate: {
 current: 0.2,
previous: 0.1,
changePct: 100, 
},
    refunds: {
      rate: {
 current: 0.4,
previous: 0.2,
changePct: 100, 
},
      count: {
 current: 2,
previous: 1,
changePct: 100, 
},
      amountMinor: {
 currentMinor: '2000',
previousMinor: '1000',
changePct: 100, 
},
    },
    averageRating: {
 current: 4.5,
previous: 4.1,
changePct: 9.8, 
},
  },
  queueHealth: [
    {
      key: 'verifications',
      label: 'Verifications',
      pendingCount: 3,
      oldestPendingDays: 2,
      averageResolutionDays: 1.5,
      resolvedCount: 4,
    }
  ],
  risk: {
    topCancellationSpaces: [
      {
        space_id: 'space-1',
        space_name: 'Desk Club',
        city: 'Makati',
        region: 'NCR',
        totalBookings: 10,
        cancelledBookings: 3,
        cancellationRate: 0.3,
      }
    ],
  },
};

describe('AdminReportsPage', () => {
  beforeEach(() => {
    mockUseAdminReportsQuery.mockReturnValue({
      data: basePayload,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as ReturnType<typeof useAdminReportsQuery>);
  });

  it('renders admin reports with summary and tables', () => {
    render(<AdminReportsPage />);

    expect(mockUseAdminReportsQuery).toHaveBeenCalled();
    expect(screen.getByText('Admin Reports')).toBeInTheDocument();
    expect(screen.getByText('Queue Health')).toBeInTheDocument();
    expect(screen.getByText('Cancellation Risk')).toBeInTheDocument();
    expect(screen.getByText('Desk Club')).toBeInTheDocument();
  });
});
