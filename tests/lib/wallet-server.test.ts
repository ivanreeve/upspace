import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import * as prismaModule from '@/lib/prisma';
import * as supabaseServerModule from '@/lib/supabase/server';
import {
  ensureWalletRow,
  resolveAuthenticatedUserForWallet,
} from '@/lib/wallet-server';

describe('wallet server helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns unauthorized when there is no authenticated user', async () => {
    vi.spyOn(supabaseServerModule, 'createSupabaseServerClient').mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null, },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof supabaseServerModule.createSupabaseServerClient>>);

    const result = await resolveAuthenticatedUserForWallet();

    expect(result.dbUser).toBeNull();
    expect(result.response?.status).toBe(401);
  });

  it('blocks non-partners when requirePartner is true', async () => {
    vi.spyOn(supabaseServerModule, 'createSupabaseServerClient').mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'customer-auth-id', }, },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof supabaseServerModule.createSupabaseServerClient>>);

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      user: {
        findFirst: vi.fn().mockResolvedValue({
          user_id: 9n,
          auth_user_id: 'customer-auth-id',
          role: 'customer',
        }),
      },
    } as unknown as typeof prismaModule.prisma);

    const result = await resolveAuthenticatedUserForWallet({ requirePartner: true, });

    expect(result.dbUser).toBeNull();
    expect(result.response?.status).toBe(403);
  });

  it('upserts a wallet row with the expected defaults', async () => {
    const upsert = vi.fn().mockResolvedValue({
      id: 'wallet-9',
      user_id: 9n,
      balance_minor: 0n,
      currency: 'PHP',
    });

    vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue({
      wallet: {
        upsert,
      },
    } as unknown as typeof prismaModule.prisma);

    const result = await ensureWalletRow(9n);

    expect(upsert).toHaveBeenCalledWith({
      where: { user_id: 9n, },
      create: {
        user_id: 9n,
        balance_minor: 0n,
        currency: 'PHP',
      },
      update: {},
    });
    expect(result).toEqual({
      id: 'wallet-9',
      user_id: 9n,
      balance_minor: 0n,
      currency: 'PHP',
    });
  });
});
