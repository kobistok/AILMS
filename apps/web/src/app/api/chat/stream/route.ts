import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { streamOrchestrator } from '@ailms/ai';
import type { OrchestratorMessage } from '@ailms/ai';

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { messages } = await req.json() as { messages: OrchestratorMessage[] };

  const result = await streamOrchestrator(messages);
  return result.toDataStreamResponse();
}
