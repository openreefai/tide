-- Formations
create table formations (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  owner_id uuid references users(id) not null,
  description text not null,
  type text not null,
  license text,
  homepage_url text,
  repository_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  latest_version text,
  total_downloads int default 0,
  constraint name_format check (name ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint name_length check (char_length(name) <= 128),
  constraint valid_type  check (type in ('solo', 'shoal', 'school'))
);

-- Formation versions
create table formation_versions (
  id uuid primary key default gen_random_uuid(),
  formation_id uuid references formations(id) not null,
  version text not null,
  status text not null default 'publishing',
  readme text,
  reef_json jsonb not null,
  tarball_path text not null,
  tarball_sha256 text not null,
  tarball_size int not null,
  agent_count int not null,
  created_at timestamptz default now(),
  published_at timestamptz,
  is_prerelease boolean default false,
  constraint valid_status check (status in ('publishing', 'published', 'failed')),
  unique (formation_id, version)
);
