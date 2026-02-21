import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getSupabase } from '@ailms/db';

type ProfileRow = {
  id: string;
  display_name: string | null;
  role: string;
};

type InvitationRow = {
  id: string;
  email: string;
  created_at: string;
};

export default async function TeamSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const adminSupabase = getSupabase();

  const { data: currentProfile } = await adminSupabase
    .from('profiles')
    .select('role, org_name')
    .eq('id', user.id)
    .single();

  const typedProfile = currentProfile as { role?: string; org_name?: string | null } | null;

  if (typedProfile?.role !== 'admin') {
    redirect('/dashboard');
  }

  const { data: membersData } = await adminSupabase
    .from('profiles')
    .select('id, display_name, role')
    .eq('org_name', typedProfile?.org_name ?? '')
    .order('created_at', { ascending: true });

  const members = (membersData ?? []) as ProfileRow[];

  const { data: pendingInvitesData } = await adminSupabase
    .from('invitations')
    .select('id, email, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  const pendingInvites = (pendingInvitesData ?? []) as InvitationRow[];

  async function sendInvite(formData: FormData) {
    'use server';
    const email = (formData.get('email') as string)?.trim();
    if (!email) return;

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const adminSupabase = getSupabase();
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('role, org_name')
      .eq('id', user.id)
      .single();

    const typedProfile = profile as { role?: string; org_name?: string | null } | null;
    if (typedProfile?.role !== 'admin') return;

    await adminSupabase.from('invitations').insert({
      email,
      invited_by: user.id,
      org_name: typedProfile.org_name ?? null,
      status: 'pending',
    });

    redirect('/settings/team');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">
            ← Dashboard
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">Team Settings</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Team members */}
        <section>
          <h2 className="text-base font-medium text-gray-900 mb-4">Team members</h2>
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between px-5 py-3">
                <p className="text-sm font-medium text-gray-900">
                  {member.display_name ?? 'Unknown'}
                  {member.id === user.id && (
                    <span className="ml-2 text-xs text-gray-400">(you)</span>
                  )}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                  member.role === 'admin'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {member.role}
                </span>
              </div>
            ))}
            {members.length === 0 && (
              <div className="px-5 py-4 text-sm text-gray-500">No team members yet.</div>
            )}
          </div>
        </section>

        {/* Invite form */}
        <section>
          <h2 className="text-base font-medium text-gray-900 mb-4">Invite a team member</h2>
          <form action={sendInvite} className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex gap-3">
              <input
                name="email"
                type="email"
                required
                placeholder="colleague@company.com"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Send invite
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              The invited user will be able to sign in with Google using this email address.
            </p>
          </form>
        </section>

        {/* Pending invitations */}
        {pendingInvites.length > 0 && (
          <section>
            <h2 className="text-base font-medium text-gray-900 mb-4">Pending invitations</h2>
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between px-5 py-3">
                  <p className="text-sm text-gray-700">{invite.email}</p>
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded font-medium">
                    Pending
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
