import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: formation, error } = await supabase
    .from('formations')
    .select(`
      id, name, description, type, license, homepage_url, repository_url,
      latest_version, total_downloads, created_at, updated_at,
      owner_id,
      users!formations_owner_id_fkey(github_username, avatar_url, display_name)
    `)
    .eq('name', name)
    .single();

  if (error || !formation) {
    return NextResponse.json({ error: 'Formation not found' }, { status: 404 });
  }

  const { count: stars } = await supabase
    .from('stars')
    .select('*', { count: 'exact', head: true })
    .eq('formation_id', formation.id);

  return NextResponse.json({ ...formation, stars: stars ?? 0 });
}
