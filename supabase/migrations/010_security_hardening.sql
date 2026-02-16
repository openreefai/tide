-- 010_security_hardening.sql
-- Harden RPC function access: revoke direct invocation by anon/authenticated,
-- restrict to service-role only where appropriate, and add in-function guards.
--
-- Background:
--   Supabase grants EXECUTE on new functions to public by default, meaning any
--   anon or authenticated user can call them directly via PostgREST. The
--   publish/unpublish/embedding RPCs are intended to be called exclusively from
--   Next.js API routes using the service-role client. Without these revocations,
--   a malicious user could bypass API-layer authorization checks.
--
-- What stays public:
--   - list_formations_by_stars: read-only listing, safe for any caller
--   - search_formations: read-only semantic search, safe for any caller
--
-- Note on 009_embedding_rls.sql (formation_embeddings public SELECT):
--   The public SELECT policy on formation_embeddings is intentional and must
--   remain. search_formations is a SECURITY DEFINER function, but
--   list_formations_by_stars and other read paths may also benefit from direct
--   embedding reads. The RLS policy only allows SELECT; there are no INSERT,
--   UPDATE, or DELETE policies, so writes are blocked at the RLS layer
--   regardless.
--
-- Note on token_hash:
--   001_users_and_tokens.sql already defines token_hash as
--   `token_hash text unique not null`, so no additional constraint is needed.


-- =============================================================================
-- 1. REVOKE EXECUTE from anon and authenticated on service-role-only functions
-- =============================================================================

-- Transaction functions (publish/unpublish workflow)
-- Revoke from PUBLIC (which anon and authenticated inherit from by default)
revoke execute on function publish_claim(
  uuid, text, uuid, text, text, text, text, text, jsonb, text, int, int, boolean
) from public;

revoke execute on function publish_finalize(
  uuid, text, text, boolean, int, text, text, text
) from public;

revoke execute on function unpublish_version(
  uuid, text, text, int, text, text, text
) from public;

-- Download counter (called by API route via admin/service-role client)
revoke execute on function increment_downloads(text) from public;

-- Embedding upsert (called by API route via admin/service-role client)
revoke execute on function upsert_formation_embedding(uuid, float8[]) from public;

-- Explicitly grant back to service_role so the admin client can still call them.
-- REVOKE FROM public removes the default grant that all roles (including
-- service_role) inherit. Without this re-grant, service-role RPC calls would fail.
grant execute on function publish_claim(
  uuid, text, uuid, text, text, text, text, text, jsonb, text, int, int, boolean
) to service_role;

grant execute on function publish_finalize(
  uuid, text, text, boolean, int, text, text, text
) to service_role;

grant execute on function unpublish_version(
  uuid, text, text, int, text, text, text
) to service_role;

grant execute on function increment_downloads(text) to service_role;

grant execute on function upsert_formation_embedding(uuid, float8[]) to service_role;


-- =============================================================================
-- 2. In-function defense-in-depth: verify service_role caller
-- =============================================================================
-- Even with EXECUTE revoked, belt-and-suspenders: if grants are ever
-- accidentally restored, the function itself will reject non-service-role
-- callers. We use CREATE OR REPLACE to patch the existing functions.
--
-- The check inspects the PostgREST JWT claim `role`. When called via the
-- service-role key, this is 'service_role'. When called via anon or
-- authenticated keys, it is 'anon' or 'authenticated' respectively.
-- current_setting('request.jwt.claims', true) returns NULL outside of a
-- PostgREST context (e.g., direct psql), so we also allow that case
-- (the function is SECURITY DEFINER and already requires superuser-level
-- access to invoke directly).

-- publish_claim with service_role guard
create or replace function publish_claim(
  p_formation_id uuid,
  p_name text,
  p_owner_id uuid,
  p_description text,
  p_type text,
  p_license text,
  p_version text,
  p_readme text,
  p_reef_json jsonb,
  p_tarball_sha256 text,
  p_tarball_size int,
  p_agent_count int,
  p_is_prerelease boolean
) returns jsonb as $$
declare
  v_fid uuid;
  v_is_new boolean := false;
  v_existing record;
  v_existing_ver record;
  v_claims text;
  v_role text;
begin
  -- Defense-in-depth: reject non-service-role callers
  v_claims := current_setting('request.jwt.claims', true);
  if v_claims is not null then
    v_role := v_claims::json->>'role';
    if v_role is distinct from 'service_role' then
      raise exception 'publish_claim requires service_role (got %)', coalesce(v_role, 'unknown');
    end if;
  end if;

  -- Lock or create formation
  select id, owner_id, deleted_at into v_existing
    from formations where name = p_name for update;

  if v_existing is not null then
    if v_existing.owner_id != p_owner_id then
      raise exception 'Not the formation owner';
    end if;
    v_fid := v_existing.id;
    -- Revive if tombstoned
    if v_existing.deleted_at is not null then
      update formations set deleted_at = null, updated_at = now() where id = v_fid;
    end if;
  else
    v_fid := p_formation_id;
    v_is_new := true;
    insert into formations (id, name, owner_id, description, type, license)
      values (p_formation_id, p_name, p_owner_id, p_description, p_type, p_license);
  end if;

  -- Handle existing version (delete if 'failed', error if published/publishing)
  select id, status into v_existing_ver
    from formation_versions
    where formation_id = v_fid and version = p_version for update;

  if v_existing_ver is not null then
    if v_existing_ver.status = 'failed' then
      delete from formation_versions where id = v_existing_ver.id;
    elsif v_existing_ver.status = 'published' then
      raise exception 'Version % already published', p_version;
    else
      raise exception 'Version % is currently publishing', p_version;
    end if;
  end if;

  -- Compute tarball_path using the actual formation ID (may differ from p_formation_id
  -- if formation already existed).
  insert into formation_versions
    (formation_id, version, status, readme, reef_json, tarball_path,
     tarball_sha256, tarball_size, agent_count, is_prerelease)
  values
    (v_fid, p_version, 'publishing', p_readme, p_reef_json,
     'formations/' || v_fid || '/' || p_version || '.tar.gz',
     p_tarball_sha256, p_tarball_size, p_agent_count, p_is_prerelease);

  return jsonb_build_object(
    'formation_id', v_fid,
    'is_new', v_is_new,
    'tarball_path', 'formations/' || v_fid || '/' || p_version || '.tar.gz'
  );
end;
$$ language plpgsql security definer;


-- publish_finalize with service_role guard
create or replace function publish_finalize(
  p_formation_id uuid,
  p_version text,
  p_latest_version text,
  p_is_new_latest boolean,
  p_expected_version_count int,
  p_description text default null,
  p_type text default null,
  p_license text default null
) returns void as $$
declare
  v_actual_count int;
  v_claims text;
  v_role text;
begin
  -- Defense-in-depth: reject non-service-role callers
  v_claims := current_setting('request.jwt.claims', true);
  if v_claims is not null then
    v_role := v_claims::json->>'role';
    if v_role is distinct from 'service_role' then
      raise exception 'publish_finalize requires service_role (got %)', coalesce(v_role, 'unknown');
    end if;
  end if;

  -- Lock formation row
  perform 1 from formations where id = p_formation_id for update;

  -- Optimistic concurrency check
  select count(*) into v_actual_count
    from formation_versions
    where formation_id = p_formation_id and status = 'published';
  if v_actual_count != p_expected_version_count then
    raise exception 'CONCURRENT_MODIFY: expected % published versions but found %. Retry.',
      p_expected_version_count, v_actual_count;
  end if;

  -- Mark version as published
  update formation_versions
    set status = 'published', published_at = now()
    where formation_id = p_formation_id and version = p_version;

  -- Update latest_version
  update formations
    set latest_version = p_latest_version, updated_at = now()
    where id = p_formation_id;

  -- Sync metadata from new latest version's reef_json
  if p_is_new_latest and p_description is not null then
    update formations
      set description = p_description, type = coalesce(p_type, type),
          license = p_license
      where id = p_formation_id;
  end if;
end;
$$ language plpgsql security definer;


-- unpublish_version with service_role guard
create or replace function unpublish_version(
  p_formation_id uuid,
  p_version text,
  p_new_latest text,
  p_expected_version_count int,
  p_new_latest_description text default null,
  p_new_latest_type text default null,
  p_new_latest_license text default null
) returns text as $$
declare
  v_tarball_path text;
  v_actual_count int;
  v_claims text;
  v_role text;
begin
  -- Defense-in-depth: reject non-service-role callers
  v_claims := current_setting('request.jwt.claims', true);
  if v_claims is not null then
    v_role := v_claims::json->>'role';
    if v_role is distinct from 'service_role' then
      raise exception 'unpublish_version requires service_role (got %)', coalesce(v_role, 'unknown');
    end if;
  end if;

  -- Lock formation row
  perform 1 from formations where id = p_formation_id for update;

  -- Optimistic concurrency check
  select count(*) into v_actual_count
    from formation_versions
    where formation_id = p_formation_id and status = 'published';
  if v_actual_count != p_expected_version_count then
    raise exception 'CONCURRENT_MODIFY: expected % published versions but found %. Retry.',
      p_expected_version_count, v_actual_count;
  end if;

  -- Capture tarball_path before delete
  select tarball_path into v_tarball_path
    from formation_versions
    where formation_id = p_formation_id and version = p_version and status = 'published';

  if v_tarball_path is null then
    raise exception 'Version not found';
  end if;

  -- Delete version row
  delete from formation_versions
    where formation_id = p_formation_id and version = p_version;

  -- Update latest_version
  update formations
    set latest_version = p_new_latest, updated_at = now()
    where id = p_formation_id;

  -- If no published versions remain, tombstone
  if p_new_latest is null then
    update formations set deleted_at = now() where id = p_formation_id;
  else
    -- Sync metadata from new latest version
    if p_new_latest_description is not null then
      update formations
        set description = p_new_latest_description,
            type = coalesce(p_new_latest_type, type),
            license = p_new_latest_license
        where id = p_formation_id;
    end if;
  end if;

  return v_tarball_path;
end;
$$ language plpgsql security definer;
