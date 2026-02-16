import { createAdminClient } from '@/lib/supabase/admin';

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI embeddings API error (${response.status}): ${body}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

export async function refreshFormationEmbedding(
  formationId: string,
  description: string,
  readme: string | null,
): Promise<void> {
  const text = [description, readme].filter(Boolean).join('\n\n');
  const embedding = await generateEmbedding(text);

  // Use RPC to properly cast the float array to vector type.
  const admin = createAdminClient();
  await admin.rpc('upsert_formation_embedding', {
    p_formation_id: formationId,
    p_embedding: embedding,
  });
}
