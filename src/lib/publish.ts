import { createHash, randomUUID } from 'crypto';
import semver from 'semver';
import { validateManifest } from '@/lib/validate-manifest';
import { createAdminClient } from '@/lib/supabase/admin';
import { uploadTarball, deleteTarball } from '@/lib/storage';
import { canonicalizeName, validateName, checkNearDuplicate } from '@/lib/names';
import { computeLatestVersion } from '@/lib/versions';
import { extractTarballContents } from '@/lib/tarball';
import { refreshFormationEmbedding } from '@/lib/embeddings';

const MAX_TARBALL_SIZE = 10 * 1024 * 1024; // 10MB

interface PublishInput {
  userId: string;
  name: string;
  tarball: Buffer;
}

export async function publishFormation(input: PublishInput) {
  const { userId, name, tarball } = input;
  const admin = createAdminClient();

  // 1. Validate name
  const canonical = canonicalizeName(name);
  const nameResult = validateName(canonical);
  if (!nameResult.valid) throw new Error(nameResult.error);

  // 2. Validate tarball size
  if (tarball.length > MAX_TARBALL_SIZE) {
    throw new Error(`Tarball exceeds ${MAX_TARBALL_SIZE / 1024 / 1024}MB limit`);
  }

  // 3. Extract reef.json and README from tarball (server-side — never trust client)
  const { reefJson, readme } = await extractTarballContents(tarball);

  // 4. Validate extracted reef.json against schema
  const version = reefJson.version as string;
  if (!semver.valid(version)) throw new Error(`Invalid version: ${version}`);
  if ((reefJson.name as string) !== canonical) {
    throw new Error(`Name in URL (${canonical}) does not match reef.json (${reefJson.name})`);
  }

  // Full schema validation
  const schemaResult = await validateManifest(reefJson);
  if (!schemaResult.valid) {
    throw new Error(`Invalid reef.json: ${schemaResult.errors.join(', ')}`);
  }

  // 5. Check reserved names
  const { data: reserved } = await admin
    .from('reserved_names')
    .select('name')
    .eq('name', canonical)
    .single();
  if (reserved) throw new Error(`Name "${canonical}" is reserved`);

  // 6. Check near-duplicates
  const normalized = checkNearDuplicate(canonical);
  if (normalized !== canonical) {
    const { data: conflict } = await admin
      .from('formations')
      .select('name')
      .eq('name', normalized)
      .single();
    if (conflict) throw new Error(`Name "${canonical}" conflicts with existing "${conflict.name}"`);
  }

  const sha256 = createHash('sha256').update(tarball).digest('hex');
  const isPrerelease = !!semver.prerelease(version);
  const agentCount = Object.keys((reefJson.agents as Record<string, unknown>) ?? {}).length;
  const formationUuid = randomUUID();

  // --- DB transaction via RPC: claim name + insert version row ---
  const { data: claimResult, error: claimErr } = await admin.rpc('publish_claim', {
    p_formation_id: formationUuid,
    p_name: canonical,
    p_owner_id: userId,
    p_description: (reefJson.description as string) ?? '',
    p_type: (reefJson.type as string) ?? 'solo',
    p_license: (reefJson.license as string) ?? null,
    p_version: version,
    p_readme: readme,
    p_reef_json: reefJson,
    p_tarball_sha256: sha256,
    p_tarball_size: tarball.length,
    p_agent_count: agentCount,
    p_is_prerelease: isPrerelease,
  });

  if (claimErr) {
    throw new Error(claimErr.message);
  }

  const formationId = claimResult.formation_id as string;
  const isNewFormation = claimResult.is_new as boolean;
  const actualPath = claimResult.tarball_path as string;

  // --- Upload + finalize with unified compensation ---
  // If any step after claim fails, best-effort clean up all resources.
  // The cleanup cron handles stale 'publishing' versions as a safety net,
  // so this compensation is defense-in-depth and failure is acceptable.
  let tarballUploaded = false;
  try {
    // --- External: upload tarball ---
    await uploadTarball(actualPath, tarball);
    tarballUploaded = true;

    // --- Compute latest + finalize (with optimistic concurrency) ---
    let finalizeErr: { message: string } | null = null;
    let isNewLatest = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: allVersions } = await admin
        .from('formation_versions')
        .select('version, status, is_prerelease')
        .eq('formation_id', formationId);

      const versionsForCompute = (allVersions ?? []).map((v) =>
        v.version === version ? { ...v, status: 'published' } : v,
      );
      const publishedCount = (allVersions ?? []).filter((v) => v.status === 'published').length;
      const latest = computeLatestVersion(versionsForCompute);
      isNewLatest = latest === version;

      const result = await admin.rpc('publish_finalize', {
        p_formation_id: formationId,
        p_version: version,
        p_latest_version: latest,
        p_is_new_latest: isNewLatest,
        p_expected_version_count: publishedCount,
        p_description: isNewLatest ? ((reefJson.description as string) ?? '') : null,
        p_type: isNewLatest ? ((reefJson.type as string) ?? 'solo') : null,
        p_license: isNewLatest ? ((reefJson.license as string) ?? null) : null,
      });

      if (result.error?.message?.includes('CONCURRENT_MODIFY') && attempt < 2) {
        continue;
      }
      finalizeErr = result.error;
      break;
    }

    if (finalizeErr) {
      throw new Error(`Finalize failed: ${finalizeErr.message}`);
    }

    // Generate embedding for semantic search (best-effort — don't block publish)
    if (isNewLatest) {
      await refreshFormationEmbedding(
        formationId,
        (reefJson.description as string) ?? '',
        readme,
      ).catch(() => {});
    }

    return {
      ok: true,
      name: canonical,
      version,
      url: `https://tide.openreef.ai/formations/${canonical}`,
    };
  } catch (err) {
    // Best-effort compensation: mark version as failed and clean up resources
    await admin.from('formation_versions')
      .update({ status: 'failed' })
      .eq('formation_id', formationId)
      .eq('version', version)
      .then(() => {}, () => {});

    if (isNewFormation) {
      await admin.from('formations')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', formationId)
        .then(() => {}, () => {});
    }

    if (tarballUploaded) {
      await deleteTarball(actualPath).catch(() => {});
    }

    throw err;
  }
}
