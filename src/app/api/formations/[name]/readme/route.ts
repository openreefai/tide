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
    .select('id, latest_version')
    .eq('name', name)
    .single();

  if (!formation?.latest_version) {
    return NextResponse.json({ error: 'Formation not found' }, { status: 404 });
  }

  const { data: version } = await supabase
    .from('formation_versions')
    .select('readme')
    .eq('formation_id', formation.id)
    .eq('version', formation.latest_version)
    .single();

  if (!version) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 });
  }

  return NextResponse.json({ readme: version.readme ?? '' });
}
