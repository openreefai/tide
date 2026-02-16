import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: formation } = await supabase
    .from('formations')
    .select('id')
    .eq('name', name)
    .single();
  if (!formation) return NextResponse.json({ error: 'Formation not found' }, { status: 404 });

  const { error } = await supabase
    .from('stars')
    .upsert({ user_id: user.id, formation_id: formation.id }, { onConflict: 'user_id,formation_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: formation } = await supabase
    .from('formations')
    .select('id')
    .eq('name', name)
    .single();
  if (!formation) return NextResponse.json({ error: 'Formation not found' }, { status: 404 });

  await supabase
    .from('stars')
    .delete()
    .eq('user_id', user.id)
    .eq('formation_id', formation.id);

  return NextResponse.json({ ok: true });
}
