import type { NextRequest } from 'next/server';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

const mockRequirePartnerSession = vi.fn();
const mockPrisma = {
  space: { findFirst: vi.fn(), },
  price_rule: { findFirst: vi.fn(), },
  area: { findFirst: vi.fn(), },
  $transaction: vi.fn(),
};

vi.mock('@/lib/auth/require-partner-session', () => ({
  PartnerSessionError: class PartnerSessionError extends Error {
    status: number;

    constructor(message = 'Unauthorized', status = 401) {
      super(message);
      this.status = status;
    }
  },
  requirePartnerSession: mockRequirePartnerSession,
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma, }));
vi.mock('@/lib/spaces/partner-serializer', () => ({ serializeArea: vi.fn(), }));

const { POST, } = await import('@/app/api/v1/partner/spaces/[space_id]/areas/route');
const { PUT, } = await import('@/app/api/v1/partner/spaces/[space_id]/areas/[area_id]/route');

const spaceId = '11111111-1111-1111-8111-111111111111';
const areaId = '22222222-2222-4222-8222-222222222222';
const inactivePriceRuleId = '33333333-3333-4333-8333-333333333333';

const areaPayload = {
  name: 'Focus Booth',
  max_capacity: 4,
  automatic_booking_enabled: false,
  request_approval_at_capacity: false,
  advance_booking_enabled: false,
  advance_booking_value: null,
  advance_booking_unit: null,
  booking_notes_enabled: false,
  booking_notes: null,
  price_rule_id: inactivePriceRuleId,
};

describe('partner areas pricing rule active guard', () => {
  beforeEach(() => {
    mockRequirePartnerSession.mockReset();
    mockPrisma.space.findFirst.mockReset();
    mockPrisma.area.findFirst.mockReset();
    mockPrisma.price_rule.findFirst.mockReset();
    mockPrisma.$transaction.mockReset();
  });

  it('rejects create when pricing rule is inactive', async () => {
    mockRequirePartnerSession.mockResolvedValue({ userId: 1, });
    mockPrisma.space.findFirst.mockResolvedValue({ id: spaceId, });
    mockPrisma.price_rule.findFirst.mockResolvedValue(null);

    const response = await POST(
      { json: async () => areaPayload, } as NextRequest,
      { params: Promise.resolve({ space_id: spaceId, }), }
    );
    const body = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('Selected pricing rule is invalid or inactive.');
    expect(mockPrisma.price_rule.findFirst).toHaveBeenCalledWith({
      where: {
        id: inactivePriceRuleId,
        space_id: spaceId,
        is_active: true,
      },
      select: { id: true, },
    });
  });

  it('rejects update when pricing rule is inactive', async () => {
    mockRequirePartnerSession.mockResolvedValue({ userId: 1, });
    mockPrisma.space.findFirst.mockResolvedValue({ id: spaceId, });
    mockPrisma.area.findFirst.mockResolvedValue({ id: areaId, });
    mockPrisma.price_rule.findFirst.mockResolvedValue(null);

    const response = await PUT(
      { json: async () => areaPayload, } as NextRequest,
      {
 params: Promise.resolve({
 space_id: spaceId,
area_id: areaId, 
}), 
}
    );
    const body = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('Selected pricing rule is invalid or inactive.');
    expect(mockPrisma.price_rule.findFirst).toHaveBeenCalledWith({
      where: {
        id: inactivePriceRuleId,
        space_id: spaceId,
        is_active: true,
      },
      select: { id: true, },
    });
  });
});
