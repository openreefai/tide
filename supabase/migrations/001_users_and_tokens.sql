-- Enable pgcrypto (Supabase typically has this, but be safe)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users (synced from Supabase Auth via trigger)
-- id = auth.users.id (Supabase Auth UUID) — this is the identity anchor
create table users (
  id uuid primary key references auth.users(id),
  github_id text unique not null,
  github_username text not null,
  email text,
  avatar_url text,
  display_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trigger: auto-create public.users row on Supabase Auth signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, github_id, github_username, email, avatar_url, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'provider_id', new.id::text),
    coalesce(new.raw_user_meta_data->>'user_name', 'user-' || left(new.id::text, 8)),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'user_name',
      'user-' || left(new.id::text, 8)
    )
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- API tokens (one active per user, hashed at rest)
create table api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  token_hash text unique not null,
  token_prefix text not null,
  created_at timestamptz default now(),
  revoked_at timestamptz
);

-- Enforce one active token per user at the database level
create unique index one_active_token_per_user
  on api_tokens (user_id)
  where revoked_at is null;
