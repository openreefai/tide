import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateEmbedding } from '@/lib/embeddings';

export async function semanticSearch(query: string, limit: number = 20) {
  const embedding = await generateEmbedding(query);

  // Use the session/anon client — NOT the admin client. Public reads never
  // use service-role. The search_formations RPC is SECURITY DEFINER so it
  // already runs with elevated privileges for the vector operation.
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('search_formations', {
    query_embedding: embedding,
    match_count: limit,
  });

  return data ?? [];
}
