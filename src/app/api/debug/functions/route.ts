import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const admin = createAdminClient();

  const { data: formations, error: formErr } = await admin
    .from('formations')
    .select('id, name, owner_id, deleted_at, latest_version')
    .in('name', ['daily-ops', 'launch-ops']);

  const { data: dailyOps, error: dailyErr } = await admin
    .from('formations')
    .select('id, name, owner_id, deleted_at, latest_version')
    .eq('name', 'daily-ops')
    .single();

  return NextResponse.json({
    formations,
    formErr: formErr?.message ?? null,
    dailyOps,
    dailyErr: dailyErr?.message ?? null,
  });
}
