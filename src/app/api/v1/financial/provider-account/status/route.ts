import { NextRequest, NextResponse } from 'next/server';

import { requirePartnerSession } from '@/lib/auth/require-partner-session';
import { createFinancialErrorResponse } from '@/lib/financial/http';
import { getPartnerProviderAccountView } from '@/lib/financial/provider-accounts';

export async function GET(req: NextRequest) {
  try {
    const session = await requirePartnerSession();
    const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1';
    const account = await getPartnerProviderAccountView({
      partnerUserId: session.userId,
      forceRefresh,
    });

    return NextResponse.json(account, { headers: { 'Cache-Control': 'no-store', }, });
  } catch (error) {
    const response = createFinancialErrorResponse(error);
    if (response) {
      return response;
    }

    console.error('Failed to load provider-backed payout status', error);
    return NextResponse.json(
      { message: 'Unable to load payout setup right now.', },
      { status: 500, }
    );
  }
}
