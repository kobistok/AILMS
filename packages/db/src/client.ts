import { drizzle } from 'drizzle-orm/postgres-js';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import * as schema from './schema.js';

// ─── Supabase client (for Storage, Auth, RPC calls) ──────────────────────────
function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

// ─── Drizzle client (for typed SQL queries) ───────────────────────────────────
function getDrizzleClient() {
  const connectionString = process.env.DATABASE_URL ?? buildConnectionString();
  const sql = postgres(connectionString, { max: 10 });
  return drizzle(sql, { schema });
}

function buildConnectionString(): string {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }

  // Extract project ref from Supabase URL: https://<ref>.supabase.co
  const ref = new URL(url).hostname.split('.')[0];
  // Direct postgres connection (transaction pooler on port 6543 or session on 5432)
  return process.env.DATABASE_URL ?? `postgresql://postgres.${ref}:${key}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
}

// Singleton instances (lazy init to avoid issues during import)
let _supabase: ReturnType<typeof getSupabaseClient> | undefined;
let _db: ReturnType<typeof getDrizzleClient> | undefined;

export function getSupabase() {
  if (!_supabase) _supabase = getSupabaseClient();
  return _supabase;
}

export function getDb() {
  if (!_db) _db = getDrizzleClient();
  return _db;
}

// Named exports for convenience
export const supabase = new Proxy({} as ReturnType<typeof getSupabaseClient>, {
  get(_, prop) {
    return getSupabase()[prop as keyof ReturnType<typeof getSupabaseClient>];
  },
});

export const db = new Proxy({} as ReturnType<typeof getDrizzleClient>, {
  get(_, prop) {
    return getDb()[prop as keyof ReturnType<typeof getDrizzleClient>];
  },
});
