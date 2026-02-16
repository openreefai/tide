-- 014_fix_publish_claim_null_check.sql
-- Fix: IS NOT NULL on a record type returns FALSE when any field is NULL.
-- When an active formation has deleted_at = NULL, the record (uuid, uuid, NULL)
-- causes "v_existing IS NOT NULL" to evaluate to FALSE, falling through to the
-- INSERT branch and hitting the unique constraint on formations.name.
-- Fix: use PL/pgSQL's FOUND variable instead, which is TRUE whenever SELECT INTO
-- returns at least one row regardless of NULL fields.

CREATE OR REPLACE FUNCTION publish_claim(
  p_formation_id uuid,
  p_name text,
  p_owner_id uuid,
  p_description text,
  p_type text,
  p_license text,
  p_repository_url text,
  p_version text,
  p_readme text,
  p_reef_json jsonb,
  p_tarball_sha256 text,
  p_tarball_size int,
  p_agent_count int,
  p_is_prerelease boolean
) RETURNS jsonb AS $$
DECLARE
  v_fid uuid;
  v_is_new boolean := false;
  v_existing record;
  v_existing_ver record;
  v_claims text;
  v_role text;
BEGIN
  -- Defense-in-depth: reject non-service-role callers
  v_claims := current_setting('request.jwt.claims', true);
  IF v_claims IS NOT NULL THEN
    v_role := v_claims::json->>'role';
    IF v_role IS DISTINCT FROM 'service_role' THEN
      RAISE EXCEPTION 'publish_claim requires service_role (got %)', coalesce(v_role, 'unknown');
    END IF;
  END IF;

  -- Lock or create formation
  SELECT id, owner_id, deleted_at INTO v_existing
    FROM formations WHERE name = p_name FOR UPDATE;

  IF FOUND THEN
    IF v_existing.owner_id != p_owner_id THEN
      RAISE EXCEPTION 'Not the formation owner';
    END IF;
    v_fid := v_existing.id;
    -- Revive if tombstoned
    IF v_existing.deleted_at IS NOT NULL THEN
      UPDATE formations SET deleted_at = NULL, updated_at = now() WHERE id = v_fid;
    END IF;
  ELSE
    v_fid := p_formation_id;
    v_is_new := true;
    INSERT INTO formations (id, name, owner_id, description, type, license)
      VALUES (p_formation_id, p_name, p_owner_id, p_description, p_type, p_license);
  END IF;

  -- Handle existing version (delete if 'failed', error if published/publishing)
  SELECT id, status INTO v_existing_ver
    FROM formation_versions
    WHERE formation_id = v_fid AND version = p_version FOR UPDATE;

  IF v_existing_ver IS NOT NULL THEN
    IF v_existing_ver.status = 'failed' THEN
      DELETE FROM formation_versions WHERE id = v_existing_ver.id;
    ELSIF v_existing_ver.status = 'published' THEN
      RAISE EXCEPTION 'Version % already published', p_version;
    ELSE
      RAISE EXCEPTION 'Version % is currently publishing', p_version;
    END IF;
  END IF;

  -- Compute tarball_path using the actual formation ID (may differ from p_formation_id
  -- if formation already existed).
  INSERT INTO formation_versions
    (formation_id, version, status, readme, reef_json, tarball_path,
     tarball_sha256, tarball_size, agent_count, is_prerelease)
  VALUES
    (v_fid, p_version, 'publishing', p_readme, p_reef_json,
     'formations/' || v_fid || '/' || p_version || '.tar.gz',
     p_tarball_sha256, p_tarball_size, p_agent_count, p_is_prerelease);

  RETURN jsonb_build_object(
    'formation_id', v_fid,
    'is_new', v_is_new,
    'tarball_path', 'formations/' || v_fid || '/' || p_version || '.tar.gz'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
