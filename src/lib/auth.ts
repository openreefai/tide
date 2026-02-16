import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

const TOKEN_PREFIX = 'reef_tok_';

export interface AuthResult {
  userId: string;
  tokenId: string;
}

export async function verifyToken(headers: Headers): Promise<AuthResult | null> {
  const authHeader = headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  if (!token.startsWith(TOKEN_PREFIX)) return null;

  const hash = createHash('sha256').update(token).digest('hex');
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('api_tokens')
    .select('id, user_id')
    .eq('token_hash', hash)
    .is('revoked_at', null)
    .single();

  if (error || !data) return null;

  return { userId: data.user_id, tokenId: data.id };
}
