import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')));
  const sort = searchParams.get('sort') ?? 'newest';
  const type = searchParams.get('type');
  const q = searchParams.get('q');

  // If semantic search is available (OPENAI_API_KEY set), use it to find matching names.
  // These names are then used as a filter in the normal query path, preserving
  // type filtering, sort, and pagination.
  let semanticMatchNames: string[] | null = null;
  if (q && process.env.OPENAI_API_KEY) {
    try {
      const { semanticSearch } = await import('@/lib/search');
      // Fetch a generous set of matches — the normal query applies pagination later
      const results = await semanticSearch(q, 200);
      semanticMatchNames = results.map((r: { name: string }) => r.name);
    } catch {
      // Fall through to text search if semantic search fails
    }
  }

  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from('formations')
    .select('id, name, description, type, license, latest_version, total_downloads, created_at, updated_at, owner_id', { count: 'exact' });

  if (type) query = query.eq('type', type);

  if (semanticMatchNames) {
    // Use semantic search results as an IN filter
    query = query.in('name', semanticMatchNames);
  } else {
    // Fallback: text search via ilike
    const sanitizedQ = q?.replace(/[,().%]/g, '');
    if (sanitizedQ) query = query.or(`name.ilike.%${sanitizedQ}%,description.ilike.%${sanitizedQ}%`);
  }

  if (sort === 'stars') {
    const { data, error: rpcErr } = await supabase
      .rpc('list_formations_by_stars', {
        p_type: type ?? null,
        p_query: q ?? null,
        p_limit: limit,
        p_offset: (page - 1) * limit,
      });
    if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 });
    const rows = data ?? [];
    let total = rows.length > 0 ? Number(rows[0].total_count) : 0;

    // When offset lands past the last row, the window function returns nothing.
    // Fetch the real count so pagination UI stays correct.
    if (rows.length === 0 && (page - 1) * limit > 0) {
      const { data: countData } = await supabase
        .rpc('list_formations_by_stars', {
          p_type: type ?? null,
          p_query: q ?? null,
          p_limit: 1,
          p_offset: 0,
        });
      total = (countData && countData.length > 0) ? Number(countData[0].total_count) : 0;
    }

    return NextResponse.json({ formations: rows, total, page, limit });
  }

  switch (sort) {
    case 'downloads': query = query.order('total_downloads', { ascending: false }); break;
    default: query = query.order('created_at', { ascending: false });
  }

  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    formations: data,
    total: count ?? 0,
    page,
    limit,
  });
}
