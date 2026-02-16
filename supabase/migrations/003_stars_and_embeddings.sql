-- Stars
create table stars (
  user_id uuid references users(id) not null,
  formation_id uuid references formations(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (user_id, formation_id)
);

-- Embeddings for semantic search
-- Note: pg_vector extension must be installed in the 'public' schema.
-- In Supabase Dashboard: Database > Extensions > vector > Schema: public
create extension if not exists vector;

create table formation_embeddings (
  id uuid primary key default gen_random_uuid(),
  formation_id uuid references formations(id) on delete cascade unique not null,
  embedding vector(1536),
  updated_at timestamptz default now()
);

-- Reserved names
create table reserved_names (
  name text primary key,
  reason text not null,
  created_at timestamptz default now()
);

-- Seed reserved names
INSERT INTO reserved_names (name, reason) VALUES
  ('openreef', 'OpenReef project name'),
  ('reef', 'OpenReef project name'),
  ('tide', 'Tide registry name'),
  ('openclaw', 'OpenClaw project name'),
  ('claw', 'OpenClaw project name'),
  ('test', 'Generic reserved name'),
  ('example', 'Generic reserved name'),
  ('demo', 'Generic reserved name'),
  ('template', 'Generic reserved name'),
  ('my-formation', 'Generic reserved name'),
  ('untitled', 'Generic reserved name');
