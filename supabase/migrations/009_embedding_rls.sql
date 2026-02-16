-- Enable RLS on formation_embeddings to match project's defensive posture.
-- Reads go through search_formations RPC (SECURITY DEFINER), writes through admin client.
-- This policy allows public reads and blocks direct writes via PostgREST.
alter table formation_embeddings enable row level security;

create policy "public read embeddings"
  on formation_embeddings for select
  using (true);
