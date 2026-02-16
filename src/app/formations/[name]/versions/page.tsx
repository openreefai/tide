import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import CopyCommand from '@/components/copy-command';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ name: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { name } = await params;
  return {
    title: `${name} — Versions — Tide`,
    description: `Version history for the ${name} formation`,
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Unknown';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default async function VersionsPage({ params }: PageProps) {
  const { name } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: formation } = await supabase
    .from('formations')
    .select('id, name, latest_version')
    .eq('name', name)
    .single();

  if (!formation) {
    notFound();
  }

  const { data: versions } = await supabase
    .from('formation_versions')
    .select('version, published_at, tarball_size, agent_count, is_prerelease')
    .eq('formation_id', formation.id)
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center gap-3">
        <Link
          href={`/formations/${name}`}
          className="text-accent hover:text-accent-light transition-colors"
        >
          &larr; {name}
        </Link>
      </div>

      <h1 className="mt-4 text-2xl font-bold">
        Version History
      </h1>
      <p className="mt-1 text-sm text-muted">
        All published versions of{' '}
        <span className="font-mono text-accent-light">{name}</span>
      </p>

      <div className="mt-8 space-y-4">
        {(versions ?? []).map((v) => (
          <div
            key={v.version}
            className="rounded-lg border border-border bg-surface p-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="font-mono text-lg font-semibold text-accent-light">
                  v{v.version}
                </span>
                {v.is_prerelease && (
                  <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
                    prerelease
                  </span>
                )}
                {v.version === formation.latest_version && (
                  <span className="rounded bg-green-500/10 px-2 py-0.5 text-xs text-green-400">
                    latest
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted">
                <span>
                  {v.agent_count} agent{v.agent_count !== 1 ? 's' : ''}
                </span>
                <span>{formatBytes(v.tarball_size)}</span>
                <span>{formatDate(v.published_at)}</span>
              </div>
            </div>

            <div className="mt-3">
              <CopyCommand command={`reef install ${name}@${v.version}`} />
            </div>
          </div>
        ))}

        {(!versions || versions.length === 0) && (
          <div className="rounded-lg border border-border bg-surface p-12 text-center">
            <p className="text-muted">No versions published yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
