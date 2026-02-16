import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: formation } = await supabase
    .from('formations')
    .select('id')
    .eq('name', name)
    .single();

  if (!formation) {
    return NextResponse.json({ error: 'Formation not found' }, { status: 404 });
  }

  const { data: versions, error } = await supabase
    .from('formation_versions')
    .select('version, published_at, tarball_sha256, tarball_size, agent_count, is_prerelease, readme')
    .eq('formation_id', formation.id)
    .order('published_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ versions: versions ?? [] });
}
