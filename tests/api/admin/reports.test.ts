import type { NextRequest } from 'next/server';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import * as adminSessionModule from '@/lib/auth/require-admin-session';
import * as prismaModule from '@/lib/prisma';
import { GET as adminReportsHandler } from '@/app/api/v1/admin/reports/route';

const makeRequest = (url: string) =>
  ({
    url,
    nextUrl: new URL(url),
  } as unknown as NextRequest);

describe('admin reports api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns aggregated report data', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-09T12:00:00.000Z'));

    vi.spyOn(adminSessionModule, 'requireAdminSession').mockResolvedValue({
      authUserId: 'admin-auth-id',
      userId: 99n,
    });

    const bookingGroupBy = vi.fn()
      .mockResolvedValueOnce([
        {
 status: 'confirmed',
_count: { _all: 8, }, 
},
        {
 status: 'cancelled',
_count: { _all: 2, }, 
}
      ])
      .mockResolvedValueOnce([
        {
 status: 'confirmed',
_count: { _all: 4, }, 
},
        {
 status: 'noshow',
_count: { _all: 1, }, 
}
      ])
      .mockResolvedValueOnce([
        {
 space_id: 'space-1',
status: 'confirmed',
_count: { _all: 3, }, 
},
        {
 space_id: 'space-1',
status: 'cancelled',
_count: { _all: 2, }, 
},
        {
 space_id: 'space-2',
status: 'confirmed',
_count: { _all: 4, }, 
}
      ]);

    const paymentAggregate = vi.fn()
      .mockResolvedValueOnce({
 _sum: { amount_minor: 50000n, },
_count: { _all: 5, }, 
})
      .mockResolvedValueOnce({
 _sum: { amount_minor: 40000n, },
_count: { _all: 4, }, 
});

    const refundAggregate = vi.fn()
      .mockResolvedValueOnce({
 _sum: { amount_minor: 2000n, },
_count: { _all: 2, }, 
})
      .mockResolvedValueOnce({
 _sum: { amount_minor: 1000n, },
_count: { _all: 1, }, 
});

    const reviewAggregate = vi.fn()
      .mockResolvedValueOnce({ _avg: { rating_star: 4.5, }, })
      .mockResolvedValueOnce({ _avg: { rating_star: 4.0, }, });

    const prismaMock = {
      booking: { groupBy: bookingGroupBy, },
      payment_transaction: { aggregate: paymentAggregate, },
      wallet_transaction: {
        aggregate: refundAggregate,
        count: vi.fn().mockResolvedValue(2),
        findFirst: vi.fn().mockResolvedValue({ created_at: new Date('2026-03-07T12:00:00.000Z'), }),
        findMany: vi.fn().mockResolvedValue([
          {
 created_at: new Date('2026-03-01T12:00:00.000Z'),
processed_at: new Date('2026-03-03T12:00:00.000Z'), 
}
        ]),
      },
      review: { aggregate: reviewAggregate, },
      verification: {
        count: vi.fn().mockResolvedValue(3),
        findFirst: vi.fn().mockResolvedValue({ submitted_at: new Date('2026-03-07T12:00:00.000Z'), }),
        findMany: vi.fn().mockResolvedValue([
          {
 submitted_at: new Date('2026-03-01T12:00:00.000Z'),
approved_at: new Date('2026-03-02T12:00:00.000Z'),
rejected_at: null, 
}
        ]),
      },
      unpublish_request: {
        count: vi.fn().mockResolvedValue(1),
        findFirst: vi.fn().mockResolvedValue({ created_at: new Date('2026-03-08T12:00:00.000Z'), }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      deactivation_request: {
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      chat_report: {
        count: vi.fn().mockResolvedValue(4),
        findFirst: vi.fn().mockResolvedValue({ created_at: new Date('2026-03-05T12:00:00.000Z'), }),
        findMany: vi.fn().mockResolvedValue([
          {
 created_at: new Date('2026-03-01T12:00:00.000Z'),
processed_at: new Date('2026-03-04T12:00:00.000Z'), 
}
        ]),
      },
      space: {
        findMany: vi.fn().mockResolvedValue([
          {
 id: 'space-1',
name: 'Desk Club',
city: 'Makati',
region: 'NCR', 
}
        ]),
      },
    } as unknown as typeof prismaModule.prisma;

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue(prismaMock);

    const response = await adminReportsHandler(
      makeRequest('http://localhost/api/v1/admin/reports?days=30')
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.data.trends.bookings.current).toBe(10);
    expect(body.data.trends.bookings.previous).toBe(5);
    expect(body.data.trends.bookings.changePct).toBe(100);

    expect(body.data.trends.grossRevenue.currentMinor).toBe('50000');
    expect(body.data.trends.grossRevenue.previousMinor).toBe('40000');

    expect(body.data.trends.cancellationRate.current).toBe(0.2);

    expect(body.data.trends.refunds.rate.current).toBe(0.4);
    expect(body.data.trends.refunds.amountMinor.currentMinor).toBe('2000');

    expect(body.data.trends.averageRating.current).toBe(4.5);

    const verificationQueue = body.data.queueHealth.find((item: { key: string }) => item.key === 'verifications');
    expect(verificationQueue.pendingCount).toBe(3);
    expect(verificationQueue.oldestPendingDays).toBe(2);

    expect(body.data.risk.topCancellationSpaces).toHaveLength(1);
    expect(body.data.risk.topCancellationSpaces[0].space_name).toBe('Desk Club');
  });

  it('returns 400 for invalid day range', async () => {
    vi.spyOn(adminSessionModule, 'requireAdminSession').mockResolvedValue({
      authUserId: 'admin-auth-id',
      userId: 99n,
    });

    const response = await adminReportsHandler(
      makeRequest('http://localhost/api/v1/admin/reports?days=0')
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });

  it('returns empty risk list when no qualifying spaces', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-09T12:00:00.000Z'));

    vi.spyOn(adminSessionModule, 'requireAdminSession').mockResolvedValue({
      authUserId: 'admin-auth-id',
      userId: 99n,
    });

    const prismaMock = {
      booking: {
        groupBy: vi.fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]),
      },
      payment_transaction: {
        aggregate: vi.fn()
          .mockResolvedValueOnce({
 _sum: { amount_minor: null, },
_count: { _all: 0, }, 
})
          .mockResolvedValueOnce({
 _sum: { amount_minor: null, },
_count: { _all: 0, }, 
}),
      },
      wallet_transaction: {
        aggregate: vi.fn()
          .mockResolvedValueOnce({
 _sum: { amount_minor: null, },
_count: { _all: 0, }, 
})
          .mockResolvedValueOnce({
 _sum: { amount_minor: null, },
_count: { _all: 0, }, 
}),
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      review: {
        aggregate: vi.fn()
          .mockResolvedValueOnce({ _avg: { rating_star: null, }, })
          .mockResolvedValueOnce({ _avg: { rating_star: null, }, }),
      },
      verification: {
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      unpublish_request: {
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      deactivation_request: {
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      chat_report: {
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      space: { findMany: vi.fn().mockResolvedValue([]), },
    } as unknown as typeof prismaModule.prisma;

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue(prismaMock);

    const response = await adminReportsHandler(
      makeRequest('http://localhost/api/v1/admin/reports?days=30')
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.risk.topCancellationSpaces).toEqual([]);
  });
});
