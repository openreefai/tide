import { createServerSupabaseClient } from '@/lib/supabase/server';
import FormationCard from '@/components/formation-card';
import SearchBar from '@/components/search-bar';
import Link from 'next/link';

interface SearchPageProps {
  searchParams: Promise<{ q?: string; type?: string; sort?: string; page?: string }>;
}

export async function generateMetadata({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  return {
    title: q ? `Search: ${q} — Tide` : 'Explore Formations — Tide',
  };
}

const ITEMS_PER_PAGE = 12;

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, type, sort, page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? '1'));
  const currentSort = sort ?? 'newest';
  const currentType = type ?? '';

  let formations: Array<{
    name: string;
    description: string;
    type: string;
    latest_version: string | null;
    total_downloads: number;
  }> = [];
  let total = 0;

  try {
    const supabase = await createServerSupabaseClient();

    let query = supabase
      .from('formations')
      .select('name, description, type, latest_version, total_downloads', { count: 'exact' })
      .is('deleted_at', null);

    if (currentType) {
      query = query.eq('type', currentType);
    }

    if (q) {
      const sanitized = q.replace(/[^a-zA-Z0-9\s\-]/g, '');
      query = query.or(`name.ilike.%${sanitized}%,description.ilike.%${sanitized}%`);
    }

    switch (currentSort) {
      case 'downloads':
        query = query.order('total_downloads', { ascending: false });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    const from = (currentPage - 1) * ITEMS_PER_PAGE;
    query = query.range(from, from + ITEMS_PER_PAGE - 1);

    const { data, count } = await query;
    formations = data ?? [];
    total = count ?? 0;
  } catch {
    // Supabase unavailable
  }

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  function buildUrl(overrides: Record<string, string | undefined>): string {
    const params = new URLSearchParams();
    const merged = { q, type: currentType, sort: currentSort, page: String(currentPage), ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== '' && !(k === 'page' && v === '1') && !(k === 'sort' && v === 'newest') && !(k === 'type' && v === '')) {
        params.set(k, v);
      }
    }
    return `/search?${params.toString()}`;
  }

  const types = ['', 'solo', 'shoal', 'school'] as const;
  const sorts = [
    { value: 'newest', label: 'Newest' },
    { value: 'downloads', label: 'Most downloads' },
  ] as const;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">Explore formations</h1>

      {/* Search bar */}
      <div className="mt-6">
        <SearchBar defaultValue={q ?? ''} />
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {/* Type filter chips */}
        <div className="flex gap-2">
          {types.map((t) => (
            <Link
              key={t || 'all'}
              href={buildUrl({ type: t, page: '1' })}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                currentType === t
                  ? 'bg-accent text-white'
                  : 'border border-border text-muted hover:border-muted hover:text-foreground'
              }`}
            >
              {t || 'All'}
            </Link>
          ))}
        </div>

        {/* Sort */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted">Sort:</span>
          {sorts.map((s) => (
            <Link
              key={s.value}
              href={buildUrl({ sort: s.value, page: '1' })}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                currentSort === s.value
                  ? 'bg-surface-2 text-foreground'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="mt-4 text-sm text-muted">
        {total} formation{total !== 1 ? 's' : ''} found
        {q && <> for &ldquo;<span className="text-foreground">{q}</span>&rdquo;</>}
      </div>

      {/* Results grid */}
      {formations.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {formations.map((f) => (
            <FormationCard
              key={f.name}
              name={f.name}
              description={f.description}
              type={f.type}
              latest_version={f.latest_version}
              total_downloads={f.total_downloads}
            />
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-lg border border-border bg-surface p-12 text-center">
          <p className="text-muted">No formations found. Try a different search term.</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          {currentPage > 1 && (
            <Link
              href={buildUrl({ page: String(currentPage - 1) })}
              className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:border-muted hover:text-foreground transition-colors"
            >
              Previous
            </Link>
          )}

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
            .map((p, i, arr) => {
              const prev = arr[i - 1];
              const showEllipsis = prev !== undefined && p - prev > 1;
              return (
                <span key={p} className="flex items-center gap-2">
                  {showEllipsis && <span className="text-muted px-1">...</span>}
                  <Link
                    href={buildUrl({ page: String(p) })}
                    className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                      p === currentPage
                        ? 'bg-accent text-white'
                        : 'border border-border text-muted hover:border-muted hover:text-foreground'
                    }`}
                  >
                    {p}
                  </Link>
                </span>
              );
            })}

          {currentPage < totalPages && (
            <Link
              href={buildUrl({ page: String(currentPage + 1) })}
              className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:border-muted hover:text-foreground transition-colors"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
