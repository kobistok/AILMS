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
      .select('*')
      .eq('id', user.id)
      .single();

    return NextResponse.json(profile ?? {});
  } catch (error) {
    console.error('[Profile API GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as {
      displayName?: string;
      orgName?: string;
      industry?: string;
      employeeCount?: string;
    };

    const adminSupabase = getSupabase();
    const { data: profile, error } = await adminSupabase
      .from('profiles')
      .upsert({
        id: user.id,
        display_name: body.displayName ?? null,
        org_name: body.orgName ?? null,
        industry: body.industry ?? null,
        employee_count: body.employeeCount ?? null,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(profile);
  } catch (error) {
    console.error('[Profile API POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
