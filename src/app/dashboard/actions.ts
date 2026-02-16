'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateApiToken, revokeApiToken, getActiveToken } from '@/lib/tokens';

/**
 * Ensure the user has a row in public.users.
 * The handle_new_user trigger should create this on signup, but if it failed
 * (e.g., metadata key mismatch), we backfill here from the auth session.
 */
async function ensureUserExists(authUser: { id: string; email?: string; user_metadata?: Record<string, string> }) {
  const admin = createAdminClient();
  const { data } = await admin.from('users').select('id').eq('id', authUser.id).single();
  if (data) return; // already exists

  const meta = authUser.user_metadata ?? {};
  await admin.from('users').insert({
    id: authUser.id,
    github_id: meta.provider_id ?? meta.sub ?? authUser.id,
    github_username: meta.user_name ?? meta.preferred_username ?? `user-${authUser.id.slice(0, 8)}`,
    email: authUser.email ?? null,
    avatar_url: meta.avatar_url ?? null,
    display_name: meta.full_name ?? meta.name ?? meta.user_name ?? `user-${authUser.id.slice(0, 8)}`,
  });
}

export async function createToken() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  await ensureUserExists(user);
  return generateApiToken(user.id);
}

export async function deleteToken() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  await revokeApiToken(user.id);
}

export async function fetchActiveToken() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  return getActiveToken(user.id);
}
