import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteTarball } from '@/lib/storage';
import { computeLatestVersion } from '@/lib/versions';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string; version: string }> },
) {
  const { name, version } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: formation } = await supabase
    .from('formations')
    .select('id')
    .eq('name', name)
    .single();

  if (!formation) {
    return NextResponse.json({ error: 'Formation not found' }, { status: 404 });
  }

  const { data: versionData, error } = await supabase
    .from('formation_versions')
    .select('version, reef_json, readme, published_at, tarball_sha256, tarball_size, agent_count, is_prerelease')
    .eq('formation_id', formation.id)
    .eq('version', version)
    .single();

  if (error || !versionData) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 });
  }

  return NextResponse.json(versionData);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string; version: string }> },
) {
  const { name, version } = await params;

  const auth = await verifyToken(request.headers);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const { data: formation } = await admin
    .from('formations')
    .select('id, owner_id')
    .eq('name', name)
    .single();

  if (!formation) return NextResponse.json({ error: 'Formation not found' }, { status: 404 });
  if (formation.owner_id !== auth.userId) {
    return NextResponse.json({ error: 'Not the formation owner' }, { status: 403 });
  }

  let removedTarballPath: string | null = null;
  let unpubErr: { message: string } | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: allVersions } = await admin
      .from('formation_versions')
      .select('version, status, is_prerelease')
      .eq('formation_id', formation.id);

    const publishedVersions = (allVersions ?? []).filter((v) => v.status === 'published');
    const publishedCount = publishedVersions.length;
    const remainingVersions = publishedVersions.filter((v) => v.version !== version);
    const newLatest = computeLatestVersion(remainingVersions);

    let newLatestMeta: { description: string; type: string; license: string | null } | null = null;
    if (newLatest) {
      const { data: latestRow } = await admin
        .from('formation_versions')
        .select('reef_json')
        .eq('formation_id', formation.id)
        .eq('version', newLatest)
        .single();
      if (latestRow?.reef_json) {
        const rj = latestRow.reef_json as Record<string, unknown>;
        newLatestMeta = {
          description: (rj.description as string) ?? '',
          type: (rj.type as string) ?? 'solo',
          license: (rj.license as string) ?? null,
        };
      }
    }

    const result = await admin.rpc('unpublish_version', {
      p_formation_id: formation.id,
      p_version: version,
      p_new_latest: newLatest,
      p_expected_version_count: publishedCount,
      p_new_latest_description: newLatestMeta?.description ?? null,
      p_new_latest_type: newLatestMeta?.type ?? null,
      p_new_latest_license: newLatestMeta?.license ?? null,
    });

    if (result.error?.message?.includes('CONCURRENT_MODIFY') && attempt < 2) {
      continue;
    }
    removedTarballPath = result.data as string | null;
    unpubErr = result.error;
    break;
  }

  if (unpubErr) {
    return NextResponse.json({ error: unpubErr.message }, { status: 400 });
  }

  if (removedTarballPath) {
    deleteTarball(removedTarballPath as string).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
