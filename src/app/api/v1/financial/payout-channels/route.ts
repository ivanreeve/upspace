import { NextRequest, NextResponse } from 'next/server';

import { getFinancialProvider } from '@/lib/providers/provider-registry';
import { FinancialProviderError } from '@/lib/providers/errors';
import { resolveAuthenticatedUserForWallet } from '@/lib/wallet-server';

export async function GET(_req: NextRequest) {
  try {
    const auth = await resolveAuthenticatedUserForWallet({ requirePartner: true, });
    if (auth.response) {
      return auth.response;
    }

    const provider = getFinancialProvider();
    const channels = await provider.listPayoutChannels('PHP');
    const filteredChannels = channels
      .filter((channel) => channel.category === 'BANK' || channel.category === 'EWALLET')
      .sort((left, right) => left.channelName.localeCompare(right.channelName, 'en'));

    return NextResponse.json({
      data: filteredChannels.map((channel) => ({
        channelCode: channel.channelCode,
        channelName: channel.channelName,
        category: channel.category,
        currency: channel.currency,
        country: channel.country,
        minimumAmountMinor: channel.minimumAmountMinor?.toString() ?? null,
        maximumAmountMinor: channel.maximumAmountMinor?.toString() ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof FinancialProviderError) {
      return NextResponse.json(
        { message: error.message, },
        { status: error.status, }
      );
    }

    console.error('Failed to load payout channels', error);
    return NextResponse.json(
      { message: 'Unable to load payout destinations right now.', },
      { status: 500, }
    );
  }
}
