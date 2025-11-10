import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';

const onboardingSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.'),
  middleName: z.string().trim().optional(),
  lastName: z.string().trim().min(1, 'Last name is required.'),
  role: z.enum(['partner', 'customer']),
  birthday: z.string().datetime().optional(),
});

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const parsed = onboardingSchema.safeParse(payload);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { message: issue?.message ?? 'Invalid onboarding payload.', },
        { status: 400, }
      );
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error('Failed to read Supabase session in onboarding route', authError);
      return NextResponse.json({ message: 'Unable to verify your session.', }, { status: 500, });
    }

    const authUser = authData.user;
    if (!authUser) {
      return NextResponse.json({ message: 'Authentication required.', }, { status: 401, });
    }

    const birthdayValue = parsed.data.birthday
      ? new Date(parsed.data.birthday).toISOString().split('T')[0]
      : null;

    const { error: updateError, } = await supabase
      .from('user')
      .update({
        first_name: parsed.data.firstName,
        middle_name: parsed.data.middleName?.length ? parsed.data.middleName : null,
        last_name: parsed.data.lastName,
        birthday: birthdayValue,
        role: parsed.data.role,
        is_onboard: false,
      })
      .eq('auth_user_id', authUser.id);

    if (updateError) {
      console.error('Failed to save onboarding info', updateError);
      return NextResponse.json(
        { message: 'Unable to persist your onboarding information at the moment.', },
        { status: 500, }
      );
    }

    return NextResponse.json({ ok: true, });
  } catch (error) {
    console.error('Unexpected error in onboarding route', error);
    return NextResponse.json(
      { message: 'A server error occurred while saving your onboarding data.', },
      { status: 500, }
    );
  }
}
