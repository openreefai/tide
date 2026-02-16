import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

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
