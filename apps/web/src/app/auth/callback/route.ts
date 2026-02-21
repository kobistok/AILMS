import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getSupabase } from '@ailms/db';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // Use service-role client for profile operations (bypasses RLS)
  const adminSupabase = getSupabase();

  // Check if profile already exists
  const { data: existingProfile } = await adminSupabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single();

  if (!existingProfile) {
    // First user ever becomes admin
    const { count } = await adminSupabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });
    const role = (count ?? 0) === 0 ? 'admin' : 'member';

    // Check for a pending invitation matching this email
    let orgName: string | null = null;
    if (user.email) {
      const { data: invitation } = await adminSupabase
        .from('invitations')
        .select('id, org_name')
        .eq('email', user.email)
        .eq('status', 'pending')
        .single();

      if (invitation) {
        orgName = invitation.org_name as string | null;
        await adminSupabase
          .from('invitations')
          .update({ status: 'accepted' })
          .eq('id', invitation.id);
      }
    }

    await adminSupabase.from('profiles').insert({
      id: user.id,
      role,
      org_name: orgName,
      onboarding_completed: false,
    });
  }

  return NextResponse.redirect(`${origin}/onboarding`);
}
