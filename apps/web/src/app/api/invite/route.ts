import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getSupabase } from '@ailms/db';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminSupabase = getSupabase();
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if ((profile as { role?: string } | null)?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: invitations } = await adminSupabase
      .from('invitations')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    return NextResponse.json(invitations ?? []);
  } catch (error) {
    console.error('[Invite API GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminSupabase = getSupabase();
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('role, org_name')
      .eq('id', user.id)
      .single();

    const typedProfile = profile as { role?: string; org_name?: string | null } | null;
    if (typedProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email } = await request.json() as { email?: string };
    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const { data: invitation, error } = await adminSupabase
      .from('invitations')
      .insert({
        email: email.trim(),
        invited_by: user.id,
        org_name: typedProfile.org_name ?? null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(invitation, { status: 201 });
  } catch (error) {
    console.error('[Invite API POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
