import type { NextRequest } from 'next/server';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import * as providerRegistryModule from '@/lib/providers/provider-registry';
import * as walletServerModule from '@/lib/wallet-server';
import { GET as listPayoutChannelsHandler } from '@/app/api/v1/financial/payout-channels/route';

describe('financial payout channels api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists partner-usable Xendit payout channels for PHP', async () => {
    vi.spyOn(walletServerModule, 'resolveAuthenticatedUserForWallet').mockResolvedValue({
      response: null,
      dbUser: {
        user_id: 42n,
        auth_user_id: 'partner-auth-id',
        role: 'partner',
      },
    });
    vi.spyOn(providerRegistryModule, 'getFinancialProvider').mockReturnValue({
      name: 'xendit',
      createPartnerAccount: vi.fn(),
      getPartnerAccountStatus: vi.fn(),
      getPartnerBalance: vi.fn(),
      createPayout: vi.fn(),
      getPayout: vi.fn(),
      getPayoutsByReferenceId: vi.fn(),
      listPayoutChannels: vi.fn().mockResolvedValue([
        {
          channelCode: 'PH_GCASH',
          channelName: 'GCash',
          category: 'EWALLET',
          currency: 'PHP',
          country: 'PH',
          minimumAmountMinor: 10000n,
          maximumAmountMinor: null,
          raw: {},
        },
        {
          channelCode: 'PH_TEST_OTC',
          channelName: 'OTC Counter',
          category: 'OTC',
          currency: 'PHP',
          country: 'PH',
          minimumAmountMinor: null,
          maximumAmountMinor: null,
          raw: {},
        },
        {
          channelCode: 'PH_BDO',
          channelName: 'BDO',
          category: 'BANK',
          currency: 'PHP',
          country: 'PH',
          minimumAmountMinor: 10000n,
          maximumAmountMinor: 5000000n,
          raw: {},
        }
      ]),
    });

    const response = await listPayoutChannelsHandler({} as NextRequest);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          channelCode: 'PH_BDO',
          channelName: 'BDO',
          category: 'BANK',
          currency: 'PHP',
          country: 'PH',
          minimumAmountMinor: '10000',
          maximumAmountMinor: '5000000',
        },
        {
          channelCode: 'PH_GCASH',
          channelName: 'GCash',
          category: 'EWALLET',
          currency: 'PHP',
          country: 'PH',
          minimumAmountMinor: '10000',
          maximumAmountMinor: null,
        }
      ],
    });
  });
});
