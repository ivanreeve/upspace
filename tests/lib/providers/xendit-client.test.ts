import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

describe('XenditFinancialProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('requests payout channels from the payouts_channels endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          channel_code: 'PH_GCASH',
          channel_name: 'GCash',
          channel_category: 'EWALLET',
          currency: 'PHP',
          amount_limits: {
            minimum: 100,
            maximum: 50000,
          },
        }
      ],
    });

    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('XENDIT_SECRET_KEY', 'xnd_development_test_key');

    const { XenditFinancialProvider, } = await import('@/lib/providers/xendit');
    const provider = new XenditFinancialProvider();

    const channels = await provider.listPayoutChannels('PHP');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.xendit.co/payouts_channels?currency=PHP',
      expect.objectContaining({ method: 'GET', })
    );
    expect(channels).toEqual([
      expect.objectContaining({
        channelCode: 'PH_GCASH',
        channelName: 'GCash',
        category: 'EWALLET',
        currency: 'PHP',
        country: null,
        minimumAmountMinor: 10000n,
        maximumAmountMinor: 5000000n,
      })
    ]);
  });
});
