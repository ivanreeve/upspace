import type { NextRequest } from 'next/server';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import * as pricingRules from '@/lib/pricing-rules-evaluator';
import * as paymongo from '@/lib/paymongo';
import * as prismaModule from '@/lib/prisma';
import * as walletServer from '@/lib/wallet-server';
import { POST as createCheckoutHandler } from '@/app/api/v1/paymongo/checkout/route';

const mockSpaceId = '11111111-1111-4111-8111-111111111111';
const mockAreaId = '22222222-2222-4222-8222-222222222222';

const makeRequest = (payload: Record<string, unknown>) =>
  ({ json: async () => payload, } as NextRequest);

const makeArea = () => ({
  id: mockAreaId,
  name: 'Test Area',
  max_capacity: 10,
  automatic_booking_enabled: true,
  request_approval_at_capacity: false,
  space_id: mockSpaceId,
  advance_booking_enabled: false,
  advance_booking_value: null,
  advance_booking_unit: null,
  price_rule: {
    id: 'pr-1',
    name: 'Rule',
    definition: {
 formula: '100',
variables: [],
conditions: [], 
},
    is_active: true,
  },
  space: {
    id: mockSpaceId,
    name: 'Test Space',
    is_published: true,
    user: { auth_user_id: 'partner-auth-id', },
  },
});

describe('checkout pricing guards', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 when price rule evaluation throws', async () => {
    vi.spyOn(walletServer, 'resolveAuthenticatedUserForWallet').mockResolvedValue({
      response: null,
      dbUser: {
        user_id: 1n,
        auth_user_id: 'customer-auth-id',
        role: 'customer',
      },
    });

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({ area: { findUnique: vi.fn().mockResolvedValue(makeArea()), }, } as unknown as typeof prismaModule.prisma);

    vi.spyOn(pricingRules, 'evaluatePriceRule').mockImplementation(() => {
      throw new Error('bad rule');
    });
    const checkoutSpy = vi.spyOn(paymongo, 'createPaymongoCheckoutSession');

    const response = await createCheckoutHandler(
      makeRequest({
        spaceId: mockSpaceId,
        areaId: mockAreaId,
        bookingHours: 1,
        guestCount: 1,
        startAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Unable to compute a price for this booking.');
    expect(checkoutSpy).not.toHaveBeenCalled();
  });

  it('returns 400 when computed price is zero or negative', async () => {
    vi.spyOn(walletServer, 'resolveAuthenticatedUserForWallet').mockResolvedValue({
      response: null,
      dbUser: {
        user_id: 1n,
        auth_user_id: 'customer-auth-id',
        role: 'customer',
      },
    });

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({ area: { findUnique: vi.fn().mockResolvedValue(makeArea()), }, } as unknown as typeof prismaModule.prisma);

    vi.spyOn(pricingRules, 'evaluatePriceRule').mockReturnValue({
      price: 0,
      branch: 'unconditional',
      appliedExpression: '0',
      conditionsSatisfied: true,
      usedVariables: [],
    });
    const checkoutSpy = vi.spyOn(paymongo, 'createPaymongoCheckoutSession');

    const response = await createCheckoutHandler(
      makeRequest({
        spaceId: mockSpaceId,
        areaId: mockAreaId,
        bookingHours: 1,
        guestCount: 1,
        startAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Unable to compute a valid price for this booking.');
    expect(checkoutSpy).not.toHaveBeenCalled();
  });
});
