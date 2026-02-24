import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getSupabase } from '@ailms/db';
import { streamOrchestrator } from '@ailms/ai';
import type { OrchestratorMessage } from '@ailms/ai';

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const adminSupabase = getSupabase();
  const { data: profileData } = await adminSupabase
    .from('profiles')
    .select('org_name')
    .eq('id', user.id)
    .single();
  const orgName = (profileData as { org_name?: string | null } | null)?.org_name ?? null;

  const { messages } = await req.json() as { messages: OrchestratorMessage[] };

  const result = await streamOrchestrator(messages, { orgName });
  return result.toDataStreamResponse();
}
