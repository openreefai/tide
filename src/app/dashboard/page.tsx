import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import TokenManager from '@/components/token-manager';
import Link from 'next/link';

export const metadata = {
  title: 'Dashboard — Tide',
};

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch user's formations
  const { data: formations } = await supabase
    .from('formations')
    .select('id, name, description, type, latest_version, total_downloads, deleted_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  // Fetch user's starred formations
  const { data: stars } = await supabase
    .from('stars')
    .select(`
      created_at,
      formations(id, name, description, type, latest_version, total_downloads)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const username = user.user_metadata?.user_name ?? user.email ?? 'User';
  const avatarUrl = user.user_metadata?.avatar_url;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* User header */}
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-12 w-12 rounded-full" />
        ) : (
          <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center text-xl font-bold text-white">
            {username[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold">{username}</h1>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
      </div>

      {/* Your formations */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Your formations</h2>
        {(formations ?? []).length > 0 ? (
          <div className="mt-4 space-y-2">
            {(formations ?? []).map((f) => (
              <Link
                key={f.id}
                href={`/formations/${f.name}`}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 hover:border-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold text-accent-light">
                    {f.name}
                  </span>
                  {f.deleted_at && (
                    <span className="rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-400">
                      deleted
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted">
                  {f.latest_version && (
                    <span className="font-mono">v{f.latest_version}</span>
                  )}
                  <span className="flex items-center gap-1">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    {f.total_downloads}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-border bg-surface p-8 text-center">
            <p className="text-sm text-muted">
              You haven&apos;t published any formations yet.{' '}
              <Link href="/publish" className="text-accent hover:text-accent-light">
                Learn how to publish
              </Link>
              .
            </p>
          </div>
        )}
      </section>

      {/* Your stars */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Your stars</h2>
        {(stars ?? []).length > 0 ? (
          <div className="mt-4 space-y-2">
            {(stars ?? []).map((s) => {
              const f = s.formations as unknown as {
                id: string;
                name: string;
                description: string;
                type: string;
                latest_version: string | null;
                total_downloads: number;
              } | null;
              if (!f) return null;
              return (
                <Link
                  key={f.id}
                  href={`/formations/${f.name}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 hover:border-muted transition-colors"
                >
                  <div>
                    <span className="font-mono text-sm font-semibold text-accent-light">
                      {f.name}
                    </span>
                    <span className="ml-3 text-xs text-muted">{f.description}</span>
                  </div>
                  <div className="text-xs text-muted font-mono">
                    {f.latest_version && `v${f.latest_version}`}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-border bg-surface p-8 text-center">
            <p className="text-sm text-muted">
              You haven&apos;t starred any formations yet.{' '}
              <Link href="/search" className="text-accent hover:text-accent-light">
                Explore formations
              </Link>
              .
            </p>
          </div>
        )}
      </section>

      {/* API Token */}
      <section className="mt-10">
        <TokenManager />
      </section>
    </div>
  );
}
