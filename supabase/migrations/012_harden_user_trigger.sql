-- 012_harden_user_trigger.sql
-- Harden the handle_new_user trigger to handle varying GitHub OAuth metadata
-- key names across Supabase versions, and gracefully handle conflicts
-- (e.g., user re-signup after account deletion).
--
-- Known metadata keys across Supabase auth versions:
--   GitHub ID:  'provider_id' or 'sub'
--   Username:   'user_name' or 'preferred_username'
--   Name:       'full_name' or 'name'
--   Avatar:     'avatar_url'

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, github_id, github_username, email, avatar_url, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'provider_id',
      new.raw_user_meta_data->>'sub',
      new.id::text
    ),
    coalesce(
      new.raw_user_meta_data->>'user_name',
      new.raw_user_meta_data->>'preferred_username',
      'user-' || left(new.id::text, 8)
    ),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'user_name',
      'user-' || left(new.id::text, 8)
    )
  )
  on conflict (id) do update set
    github_username = excluded.github_username,
    email = excluded.email,
    avatar_url = excluded.avatar_url,
    display_name = excluded.display_name,
    updated_at = now();
  return new;
exception when others then
  -- Never let user creation fail because of our sync trigger.
  -- The user row can be backfilled later.
  raise warning 'handle_new_user trigger failed for user %: %', new.id, sqlerrm;
  return new;
end;
$$ language plpgsql security definer;
