import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ starred: false });

  const { data } = await supabase
    .from('stars')
    .select('formation_id, formations!inner(name)')
    .eq('user_id', user.id)
    .eq('formations.name', name)
    .maybeSingle();

  return NextResponse.json({ starred: !!data });
}
