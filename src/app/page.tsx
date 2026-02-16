import { createServerSupabaseClient } from '@/lib/supabase/server';
import FormationCard from '@/components/formation-card';
import Link from 'next/link';

export default async function Home() {
  let formations: Array<{
    name: string;
    description: string;
    type: string;
    latest_version: string | null;
    total_downloads: number;
  }> = [];
  let totalFormations = 0;
  let totalDownloads = 0;

  try {
    const supabase = await createServerSupabaseClient();

    const { data, count } = await supabase
      .from('formations')
      .select('name, description, type, latest_version, total_downloads', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(12);

    formations = data ?? [];
    totalFormations = count ?? 0;

    const { data: dlData } = await supabase
      .from('formations')
      .select('total_downloads')
      .is('deleted_at', null);

    totalDownloads = (dlData ?? []).reduce(
      (sum: number, f: { total_downloads: number }) => sum + f.total_downloads,
      0,
    );
  } catch {
    // Supabase unavailable — render with empty state
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      {/* Hero */}
      <section className="py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Discover multi-agent{' '}
          <span className="text-accent">formations</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
          Browse, share, and install reusable agent formations for the OpenReef
          ecosystem. Solo agents, shoals, and schools — ready to deploy.
        </p>

        {/* Search */}
        <form action="/search" method="get" className="mx-auto mt-8 max-w-md">
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              name="q"
              placeholder="Search formations..."
              className="w-full rounded-xl border border-border bg-surface py-3 pl-12 pr-4 text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </form>

        {/* Install example */}
        <div className="mx-auto mt-6 max-w-xs">
          <code className="block rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-accent-light">
            $ reef install daily-ops
          </code>
        </div>
      </section>

      {/* Stats */}
      <section className="flex justify-center gap-12 border-y border-border py-8">
        <div className="text-center">
          <div className="text-2xl font-bold font-mono text-accent">
            {totalFormations.toLocaleString()}
          </div>
          <div className="mt-1 text-sm text-muted">Formations</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold font-mono text-warm">
            {totalDownloads.toLocaleString()}
          </div>
          <div className="mt-1 text-sm text-muted">Downloads</div>
        </div>
      </section>

      {/* Recent formations */}
      <section className="py-12">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent formations</h2>
          <Link
            href="/search"
            className="text-sm text-accent hover:text-accent-light transition-colors"
          >
            View all &rarr;
          </Link>
        </div>

        {formations.length > 0 ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {formations.map((f, i) => (
              <div key={f.name} className="card-entrance" style={{ animationDelay: `${i * 50}ms` }}>
                <FormationCard
                  name={f.name}
                  description={f.description}
                  type={f.type}
                  latest_version={f.latest_version}
                  total_downloads={f.total_downloads}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-lg border border-border bg-surface p-12 text-center">
            <p className="text-muted">
              No formations published yet. Be the first to{' '}
              <Link href="/publish" className="text-accent hover:text-accent-light">
                publish a formation
              </Link>
              .
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
