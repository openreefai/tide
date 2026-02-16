-- publish_claim: Atomic name-claim + version-row insert under FOR UPDATE lock.
-- Returns formation_id and is_new flag.
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
begin
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


-- publish_finalize: Atomic status update + latest recompute + metadata sync
-- under FOR UPDATE lock.
-- Concurrency guard via p_expected_version_count.
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
begin
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


-- unpublish_version: Atomic version delete + latest recompute + metadata sync
-- + optional formation tombstone. Returns tarball_path for async storage cleanup.
-- Same optimistic concurrency guard as publish_finalize.
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
begin
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
