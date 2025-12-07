import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { reactivateUserIfEligible } from '@/lib/auth/reactivate-user';

const requestBodySchema = z.object({ action: z.enum(['reactivate', 'cancelDeletion']), });

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error('Unable to verify session for reactivation', authError);
      return NextResponse.json(
        { message: 'Unable to verify your session.', },
        { status: 500, }
      );
    }

    const authUser = authData.user;

    if (!authUser) {
      return NextResponse.json(
        { message: 'Authentication required.', },
        { status: 401, }
      );
    }

    const payload = await req.json().catch(() => ({}));
    const parsed = requestBodySchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid request.', },
        { status: 400, }
      );
    }

    const lifecycle = await reactivateUserIfEligible(authUser.id);

    if (!lifecycle.allow) {
      const reason = lifecycle.reason ?? 'account_unavailable';
      const message =
        lifecycle.status === 'deleted' || reason === 'deletion_expired'
          ? 'Account deleted.'
          : 'Unable to update your account status.';

      return NextResponse.json(
        { message, },
        { status: 400, }
      );
    }

    return NextResponse.json({ status: 'updated', });
  } catch (error) {
    console.error('Failed to reactivate account', error);
    return NextResponse.json(
      { message: 'Unable to reactivate your account right now.', },
      { status: 500, }
    );
  }
}
