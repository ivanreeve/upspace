import { NextResponse } from 'next/server';

import { hasValidCronSecret } from '@/lib/cron-auth';
import { runProviderReconciliation } from '@/lib/financial/reconciliation';

const unauthorizedResponse = NextResponse.json(
  { message: 'Unauthorized', },
  { status: 401, }
);

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!hasValidCronSecret(request, cronSecret)) {
    return unauthorizedResponse;
  }

  try {
    const result = await runProviderReconciliation();
    return NextResponse.json({ data: result, });
  } catch (error) {
    console.error('Provider reconciliation cron failed', error);
    return NextResponse.json(
      { message: 'Unable to run provider reconciliation.', },
      { status: 500, }
    );
  }
}
