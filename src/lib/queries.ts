import type { SupabaseClient } from '@supabase/supabase-js';

interface ListByStarsOpts {
  type?: string | null;
  query?: string | null;
  names?: string[] | null;
  limit: number;
  offset: number;
}

interface FormationRow {
  name: string;
  description: string;
  type: string;
  latest_version: string | null;
  total_downloads: number;
  [key: string]: unknown;
}

export async function listFormationsByStars(
  supabase: SupabaseClient,
  opts: ListByStarsOpts,
): Promise<{ formations: FormationRow[]; total: number }> {
  const rpcParams = {
    p_type: opts.type ?? null,
    p_query: opts.names ? null : (opts.query ?? null),
    p_names: opts.names ?? null,
    p_limit: opts.limit,
    p_offset: opts.offset,
  };

  const { data, error } = await supabase.rpc('list_formations_by_stars', rpcParams);
  if (error) throw error;

  const rows = (data ?? []) as (FormationRow & { total_count: number })[];
  let total = rows.length > 0 ? Number(rows[0].total_count) : 0;

  // When offset lands past the last row, the window function returns nothing.
  // Fetch the real count so pagination UI stays correct.
  if (rows.length === 0 && opts.offset > 0) {
    const { data: countData } = await supabase.rpc('list_formations_by_stars', {
      ...rpcParams,
      p_limit: 1,
      p_offset: 0,
    });
    total =
      countData && countData.length > 0 ? Number(countData[0].total_count) : 0;
  }

  return { formations: rows, total };
}
