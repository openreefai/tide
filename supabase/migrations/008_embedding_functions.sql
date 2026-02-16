-- Upsert embedding with proper vector cast.
-- The Supabase JS client passes the embedding as a JSON array (float8[]).
-- This function casts it to the vector type before storing.
create or replace function upsert_formation_embedding(
  p_formation_id uuid,
  p_embedding float8[]
) returns void as $$
begin
  insert into formation_embeddings (formation_id, embedding, updated_at)
    values (p_formation_id, p_embedding::vector(1536), now())
  on conflict (formation_id) do update
    set embedding = excluded.embedding, updated_at = now();
end;
$$ language plpgsql security definer;

-- Semantic search using cosine distance.
-- query_embedding is passed as float8[] and cast to vector for the distance op.
create or replace function search_formations(
  query_embedding float8[],
  match_count int default 20
)
returns table (
  id uuid,
  name text,
  description text,
  type text,
  latest_version text,
  total_downloads int,
  similarity float
)
language sql stable security definer
as $$
  select
    f.id, f.name, f.description, f.type, f.latest_version, f.total_downloads,
    1 - (fe.embedding <=> query_embedding::vector(1536)) as similarity
  from formation_embeddings fe
  join formations f on f.id = fe.formation_id
  where f.deleted_at is null
  order by fe.embedding <=> query_embedding::vector(1536)
  limit match_count;
$$;
