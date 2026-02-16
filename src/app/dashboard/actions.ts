'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateApiToken, revokeApiToken, getActiveToken } from '@/lib/tokens';

export async function createToken() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
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
