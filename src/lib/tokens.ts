import { randomBytes, createHash } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

const TOKEN_PREFIX_CONST = 'reef_tok_';
const PREFIX_DISPLAY_LENGTH = 13; // reef_tok_k7Bx

interface TokenResult {
  token: string;      // plaintext — shown once, never stored
  prefix: string;     // first 13 chars — stored for dashboard display
}

export async function generateApiToken(userId: string): Promise<TokenResult> {
  const admin = createAdminClient();

  // Revoke any existing active token
  await admin
    .from('api_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('revoked_at', null);

  // Generate new token
  const raw = randomBytes(32);
  const encoded = raw.toString('base64url');
  const token = `${TOKEN_PREFIX_CONST}${encoded}`;
  const hash = createHash('sha256').update(token).digest('hex');
  const prefix = token.slice(0, PREFIX_DISPLAY_LENGTH);

  const { error } = await admin.from('api_tokens').insert({
    user_id: userId,
    token_hash: hash,
    token_prefix: prefix,
  });

  if (error) throw new Error(`Failed to create token: ${error.message}`);

  return { token, prefix };
}

export async function revokeApiToken(userId: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from('api_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('revoked_at', null);
}

export async function getActiveToken(userId: string): Promise<{ prefix: string; createdAt: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('api_tokens')
    .select('token_prefix, created_at')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .single();

  if (!data) return null;
  return { prefix: data.token_prefix, createdAt: data.created_at };
}
