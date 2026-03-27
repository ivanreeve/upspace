import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { AdminSessionError, requireAdminSession } from '@/lib/auth/require-admin-session';
import { listAdminReconciliationData, runProviderReconciliation } from '@/lib/financial/reconciliation';

const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).optional(), });

export async function GET(req: NextRequest) {
  try {
    await requireAdminSession(req);

    const parsed = querySchema.safeParse({ limit: req.nextUrl.searchParams.get('limit') ?? undefined, });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid reconciliation query.', },
        { status: 400, }
      );
    }

    const data = await listAdminReconciliationData(parsed.data.limit);
    return NextResponse.json({ data, });
  } catch (error) {
    if (error instanceof AdminSessionError) {
      return NextResponse.json(
        { error: error.message, },
        { status: error.status, }
      );
    }

    console.error('Failed to load admin reconciliation data', error);
    return NextResponse.json(
      { error: 'Unable to load reconciliation data.', },
      { status: 500, }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminSession(req);

    const parsed = querySchema.safeParse(
      await req.json().catch(() => ({}))
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid reconciliation request.', },
        { status: 400, }
      );
    }

    const result = await runProviderReconciliation(parsed.data.limit);
    return NextResponse.json({ data: result, });
  } catch (error) {
    if (error instanceof AdminSessionError) {
      return NextResponse.json(
        { error: error.message, },
        { status: error.status, }
      );
    }

    console.error('Failed to run admin reconciliation', error);
    return NextResponse.json(
      { error: 'Unable to run reconciliation right now.', },
      { status: 500, }
    );
  }
}
