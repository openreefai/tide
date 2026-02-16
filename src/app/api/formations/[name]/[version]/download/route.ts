import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createSignedDownloadUrl } from '@/lib/storage';
import { createAdminClient } from '@/lib/supabase/admin';

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

  const { data: versionData } = await supabase
    .from('formation_versions')
    .select('tarball_path')
    .eq('formation_id', formation.id)
    .eq('version', version)
    .single();

  if (!versionData) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 });
  }

  // Generate signed URL from private bucket
  const signedUrl = await createSignedDownloadUrl(versionData.tarball_path);

  // Increment download count (best-effort, use admin client)
  const admin = createAdminClient();
  try {
    await admin.rpc('increment_downloads', { formation_name: name });
  } catch {
    // best-effort — ignore failures
  }

  // 302 redirect
  return NextResponse.redirect(signedUrl, 302);
}
