import { getSupabase } from '@ailms/db';

// Minimal structural type — only the shape we use from the Slack WebClient
type SlackUsersClient = {
  users: {
    info(args: { user: string }): Promise<{
      user?: { profile?: { email?: string } };
    }>;
  };
};

// In-memory cache: Slack user ID → org name, 5-minute TTL
const cache = new Map<string, { orgName: string | null; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Resolves the AILMS org name for a Slack user.
 * Gets their email from the Slack API, then looks up the matching profile.
 * Returns null if the user has no AILMS account or no org set.
 */
export async function resolveOrgName(
  userId: string,
  client: SlackUsersClient,
): Promise<string | null> {
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.orgName;
  }

  try {
    const info = await client.users.info({ user: userId });
    const email = info.user?.profile?.email;

    if (!email) {
      cache.set(userId, { orgName: null, ts: Date.now() });
      return null;
    }

    const adminSupabase = getSupabase();
    const { data } = await adminSupabase
      .from('profiles')
      .select('org_name')
      .eq('email', email)
      .maybeSingle();

    const orgName = (data as { org_name?: string | null } | null)?.org_name ?? null;
    cache.set(userId, { orgName, ts: Date.now() });
    return orgName;
  } catch (err) {
    console.error('[resolveOrgName] Error resolving org for user', userId, err);
    return null;
  }
}
