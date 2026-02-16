-- 013_publish_repository_url.sql
-- Wire repository_url through publish_claim, publish_finalize, and unpublish_version RPCs.
-- The formations.repository_url column already exists (002_formations.sql).
-- This migration re-creates the three functions with an additional p_repository_url
-- parameter and re-applies the REVOKE/GRANT + in-function JWT guard security pattern
-- from 010_security_hardening.sql.

BEGIN;

-- =============================================================================
-- 1. DROP old function signatures (exact arg types must match 010)
-- =============================================================================

DROP FUNCTION IF EXISTS publish_claim(
  uuid, text, uuid, text, text, text, text, text, jsonb, text, int, int, boolean
);

DROP FUNCTION IF EXISTS publish_finalize(
  uuid, text, text, boolean, int, text, text, text
);

DROP FUNCTION IF EXISTS unpublish_version(
  uuid, text, text, int, text, text, text
);

-- =============================================================================
-- 2. CREATE functions with new signatures (adding p_repository_url text)
-- =============================================================================

-- publish_claim: accepts p_repository_url but does NOT update formation-level
-- repository_url (claim precedes finalize; metadata sync happens in finalize).
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

  IF v_existing IS NOT NULL THEN
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


-- publish_finalize: sets formation-level repository_url from p_repository_url
-- ONLY when p_is_new_latest = true.
CREATE OR REPLACE FUNCTION publish_finalize(
  p_formation_id uuid,
  p_version text,
  p_latest_version text,
  p_is_new_latest boolean,
  p_expected_version_count int,
  p_description text DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_license text DEFAULT NULL,
  p_repository_url text DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_actual_count int;
  v_claims text;
  v_role text;
BEGIN
  -- Defense-in-depth: reject non-service-role callers
  v_claims := current_setting('request.jwt.claims', true);
  IF v_claims IS NOT NULL THEN
    v_role := v_claims::json->>'role';
    IF v_role IS DISTINCT FROM 'service_role' THEN
      RAISE EXCEPTION 'publish_finalize requires service_role (got %)', coalesce(v_role, 'unknown');
    END IF;
  END IF;

  -- Lock formation row
  PERFORM 1 FROM formations WHERE id = p_formation_id FOR UPDATE;

  -- Optimistic concurrency check
  SELECT count(*) INTO v_actual_count
    FROM formation_versions
    WHERE formation_id = p_formation_id AND status = 'published';
  IF v_actual_count != p_expected_version_count THEN
    RAISE EXCEPTION 'CONCURRENT_MODIFY: expected % published versions but found %. Retry.',
      p_expected_version_count, v_actual_count;
  END IF;

  -- Mark version as published
  UPDATE formation_versions
    SET status = 'published', published_at = now()
    WHERE formation_id = p_formation_id AND version = p_version;

  -- Update latest_version
  UPDATE formations
    SET latest_version = p_latest_version, updated_at = now()
    WHERE id = p_formation_id;

  -- Sync metadata from new latest version's reef_json
  IF p_is_new_latest AND p_description IS NOT NULL THEN
    UPDATE formations
      SET description = p_description, type = coalesce(p_type, type),
          license = p_license, repository_url = p_repository_url
      WHERE id = p_formation_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- unpublish_version: updates formations.repository_url alongside other metadata.
CREATE OR REPLACE FUNCTION unpublish_version(
  p_formation_id uuid,
  p_version text,
  p_new_latest text,
  p_expected_version_count int,
  p_new_latest_description text DEFAULT NULL,
  p_new_latest_type text DEFAULT NULL,
  p_new_latest_license text DEFAULT NULL,
  p_repository_url text DEFAULT NULL
) RETURNS text AS $$
DECLARE
  v_tarball_path text;
  v_actual_count int;
  v_claims text;
  v_role text;
BEGIN
  -- Defense-in-depth: reject non-service-role callers
  v_claims := current_setting('request.jwt.claims', true);
  IF v_claims IS NOT NULL THEN
    v_role := v_claims::json->>'role';
    IF v_role IS DISTINCT FROM 'service_role' THEN
      RAISE EXCEPTION 'unpublish_version requires service_role (got %)', coalesce(v_role, 'unknown');
    END IF;
  END IF;

  -- Lock formation row
  PERFORM 1 FROM formations WHERE id = p_formation_id FOR UPDATE;

  -- Optimistic concurrency check
  SELECT count(*) INTO v_actual_count
    FROM formation_versions
    WHERE formation_id = p_formation_id AND status = 'published';
  IF v_actual_count != p_expected_version_count THEN
    RAISE EXCEPTION 'CONCURRENT_MODIFY: expected % published versions but found %. Retry.',
      p_expected_version_count, v_actual_count;
  END IF;

  -- Capture tarball_path before delete
  SELECT tarball_path INTO v_tarball_path
    FROM formation_versions
    WHERE formation_id = p_formation_id AND version = p_version AND status = 'published';

  IF v_tarball_path IS NULL THEN
    RAISE EXCEPTION 'Version not found';
  END IF;

  -- Delete version row
  DELETE FROM formation_versions
    WHERE formation_id = p_formation_id AND version = p_version;

  -- Update latest_version
  UPDATE formations
    SET latest_version = p_new_latest, updated_at = now()
    WHERE id = p_formation_id;

  -- If no published versions remain, tombstone
  IF p_new_latest IS NULL THEN
    UPDATE formations SET deleted_at = now() WHERE id = p_formation_id;
  ELSE
    -- Sync metadata from new latest version
    IF p_new_latest_description IS NOT NULL THEN
      UPDATE formations
        SET description = p_new_latest_description,
            type = coalesce(p_new_latest_type, type),
            license = p_new_latest_license,
            repository_url = p_repository_url
        WHERE id = p_formation_id;
    END IF;
  END IF;

  RETURN v_tarball_path;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 3. REVOKE from public + GRANT to service_role (new signatures)
-- =============================================================================

REVOKE EXECUTE ON FUNCTION publish_claim(
  uuid, text, uuid, text, text, text, text, text, text, jsonb, text, int, int, boolean
) FROM public;

REVOKE EXECUTE ON FUNCTION publish_finalize(
  uuid, text, text, boolean, int, text, text, text, text
) FROM public;

REVOKE EXECUTE ON FUNCTION unpublish_version(
  uuid, text, text, int, text, text, text, text
) FROM public;

GRANT EXECUTE ON FUNCTION publish_claim(
  uuid, text, uuid, text, text, text, text, text, text, jsonb, text, int, int, boolean
) TO service_role;

GRANT EXECUTE ON FUNCTION publish_finalize(
  uuid, text, text, boolean, int, text, text, text, text
) TO service_role;

GRANT EXECUTE ON FUNCTION unpublish_version(
  uuid, text, text, int, text, text, text, text
) TO service_role;

COMMIT;
