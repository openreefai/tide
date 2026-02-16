import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteTarball } from '@/lib/storage';

export async function GET(request: NextRequest) {
  // Fail if CRON_SECRET is not configured — never allow requests through without a secret
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Mark stale 'publishing' rows as 'failed'
  await admin
    .from('formation_versions')
    .update({ status: 'failed' })
    .eq('status', 'publishing')
    .lt('created_at', tenMinutesAgo);

  // Delete 'failed' rows older than 1 hour + their storage objects
  const { data: failedVersions } = await admin
    .from('formation_versions')
    .select('id, formation_id, tarball_path')
    .eq('status', 'failed')
    .lt('created_at', oneHourAgo);

  for (const v of failedVersions ?? []) {
    await deleteTarball(v.tarball_path).catch(() => {});
    await admin.from('formation_versions').delete().eq('id', v.id);

    // Tombstone formation if zero published versions remain
    const { count } = await admin
      .from('formation_versions')
      .select('*', { count: 'exact', head: true })
      .eq('formation_id', v.formation_id)
      .eq('status', 'published');

    if (count === 0) {
      await admin
        .from('formations')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', v.formation_id);
    }
  }

  return NextResponse.json({ ok: true, cleaned: failedVersions?.length ?? 0 });
}
