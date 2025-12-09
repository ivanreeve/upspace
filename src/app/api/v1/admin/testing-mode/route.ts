import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { AdminSessionError, requireAdminSession } from '@/lib/auth/require-admin-session';
import { getTestingMode, setTestingMode } from '@/lib/testing-mode';

const payloadSchema = z.object({ enabled: z.boolean(), });

export async function GET(req: NextRequest) {
  try {
    await requireAdminSession(req);
    const enabled = await getTestingMode();
    return NextResponse.json({ enabled, });
  } catch (error) {
    if (error instanceof AdminSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }
    console.error('Failed to read testing mode', error);
    return NextResponse.json({ error: 'Unable to read testing mode.', }, { status: 500, });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdminSession(req);
    const body = await req.json().catch(() => null);
    const parsed = payloadSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten(), },
        { status: 400, }
      );
    }

    await setTestingMode(parsed.data.enabled);
    return NextResponse.json({ enabled: parsed.data.enabled, });
  } catch (error) {
    if (error instanceof AdminSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }
    console.error('Failed to update testing mode', error);
    return NextResponse.json({ error: 'Unable to update testing mode.', }, { status: 500, });
  }
}
