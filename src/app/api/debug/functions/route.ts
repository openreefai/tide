import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const admin = createAdminClient();

  // Check formation exists
  const { data: dailyOps } = await admin
    .from('formations')
    .select('id, name, owner_id')
    .eq('name', 'daily-ops')
    .single();

  // Check for function overloads via information_schema
  const { data: routines, error: routineErr } = await admin
    .from('information_schema.routines' as 'formations')
    .select('routine_name, data_type, routine_definition')
    .eq('routine_schema', 'public')
    .eq('routine_name', 'publish_claim');

  // Try calling the RPC with a dummy version to see which function resolves
  const { error: rpcErr } = await admin.rpc('publish_claim', {
    p_formation_id: '00000000-0000-0000-0000-000000000000',
    p_name: 'daily-ops',
    p_owner_id: dailyOps?.owner_id ?? '00000000-0000-0000-0000-000000000000',
    p_description: 'test',
    p_type: 'shoal',
    p_license: 'MIT',
    p_repository_url: null,
    p_version: '99.99.99',
    p_readme: '',
    p_reef_json: {},
    p_tarball_sha256: 'test',
    p_tarball_size: 0,
    p_agent_count: 0,
    p_is_prerelease: false,
  });

  return NextResponse.json({
    dailyOps,
    routines,
    routineErr: routineErr?.message ?? null,
    rpcErr: rpcErr?.message ?? rpcErr?.code ?? null,
    rpcErrFull: rpcErr ? JSON.parse(JSON.stringify(rpcErr)) : null,
  });
}
