import type { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import * as prismaModule from '@/lib/prisma';
import * as rateLimitModule from '@/lib/rate-limit';
import * as walletServerModule from '@/lib/wallet-server';
import { POST as createPayoutRequestHandler } from '@/app/api/v1/wallet/payout/route';

const makeRequest = (body: unknown) =>
  ({ json: async () => body, } as unknown as NextRequest);

describe('wallet payout api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 429 when the payout request rate limit is exceeded', async () => {
    vi.spyOn(walletServerModule, 'resolveAuthenticatedUserForWallet').mockResolvedValue({
      response: null,
      dbUser: {
        user_id: 42n,
        auth_user_id: 'partner-auth-id',
        role: 'partner',
      },
    });

    vi.spyOn(rateLimitModule, 'enforceRateLimit').mockRejectedValue(
      new rateLimitModule.RateLimitExceededError('payout-request', 300)
    );

    const response = await createPayoutRequestHandler(makeRequest({ amountMinor: 15000, }));

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('300');
    await expect(response.json()).resolves.toEqual({ error: 'Too many requests. Please try again later.', });
    expect(rateLimitModule.enforceRateLimit).toHaveBeenCalledWith({
      scope: 'payout-request',
      identity: 'partner-auth-id',
    });
  });

  it('returns 409 when the payout transaction hits a serialization conflict', async () => {
    vi.spyOn(walletServerModule, 'resolveAuthenticatedUserForWallet').mockResolvedValue({
      response: null,
      dbUser: {
        user_id: 42n,
        auth_user_id: 'partner-auth-id',
        role: 'partner',
      },
    });
    vi.spyOn(rateLimitModule, 'enforceRateLimit').mockResolvedValue();
    vi.spyOn(walletServerModule, 'ensureWalletRow').mockResolvedValue({
      id: 'wallet-1',
      user_id: 42n,
      balance_minor: 50000n,
      currency: 'PHP',
      created_at: new Date('2026-03-12T12:00:00.000Z'),
      updated_at: new Date('2026-03-12T12:00:00.000Z'),
    });

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      $transaction: vi.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('serialization conflict', {
          code: 'P2034',
          clientVersion: 'test',
        })
      ),
    } as unknown as typeof prismaModule.prisma);

    const response = await createPayoutRequestHandler(makeRequest({ amountMinor: 15000, }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'A conflict occurred. Please try again.', });
  });
});
