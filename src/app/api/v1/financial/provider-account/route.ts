import { NextResponse } from 'next/server';

import { requirePartnerSession } from '@/lib/auth/require-partner-session';
import { ensurePartnerProviderAccount } from '@/lib/financial/provider-accounts';
import { createFinancialErrorResponse } from '@/lib/financial/http';

export async function POST() {
  try {
    const session = await requirePartnerSession();
    const account = await ensurePartnerProviderAccount({
      partnerUserId: session.userId,
      partnerAuthUserId: session.authUserId,
      email: session.email,
    });

    return NextResponse.json(account, { status: 201, });
  } catch (error) {
    const response = createFinancialErrorResponse(error);
    if (response) {
      return response;
    }

    console.error('Failed to enable provider-backed payouts', error);
    return NextResponse.json(
      { message: 'Unable to enable payouts right now.', },
      { status: 500, }
    );
  }
}
