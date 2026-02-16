import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import semver from 'semver';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const range = request.nextUrl.searchParams.get('range');

  if (!range) {
    return NextResponse.json({ error: 'range parameter is required' }, { status: 400 });
  }

  if (!semver.validRange(range)) {
    return NextResponse.json({ error: `Invalid semver range: ${range}` }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  const { data: formation } = await supabase
    .from('formations')
    .select('id')
    .eq('name', name)
    .single();

  if (!formation) {
    return NextResponse.json({ error: 'Formation not found' }, { status: 404 });
  }

  // RLS filters to published-only
  const { data: versions } = await supabase
    .from('formation_versions')
    .select('version, tarball_sha256')
    .eq('formation_id', formation.id);

  if (!versions?.length) {
    return NextResponse.json({ error: 'No published versions' }, { status: 404 });
  }

  const versionStrings = versions.map((v) => v.version);
  const best = semver.maxSatisfying(versionStrings, range);

  if (!best) {
    return NextResponse.json(
      { error: `No version satisfies range ${range}` },
      { status: 404 },
    );
  }

  const match = versions.find((v) => v.version === best)!;
  return NextResponse.json({ version: best, sha256: match.tarball_sha256 });
}
