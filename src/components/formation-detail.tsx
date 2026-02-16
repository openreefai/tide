'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TopologyGraph from '@/components/topology-graph';
import CopyCommand from '@/components/copy-command';
import StarButton from '@/components/star-button';
import Link from 'next/link';
import { typeBadgeClass, formatBytes, formatDate } from '@/lib/format';

interface FormationVersion {
  version: string;
  published_at: string | null;
  tarball_size: number;
  agent_count: number;
  is_prerelease: boolean;
}

interface ReefJson {
  name?: string;
  description?: string;
  type?: string;
  version?: string;
  license?: string;
  agents?: Record<string, { model?: string; role?: string; [key: string]: unknown }> | Array<{ name: string; model?: string; role?: string }>;
  agentToAgent?: Record<string, string[]> | Array<{ from: string; to: string; channel?: string }>;
  variables?: Record<string, unknown>;
  cron?: Record<string, unknown> | Array<unknown>;
  [key: string]: unknown;
}

interface FormationDetailProps {
  formation: {
    name: string;
    description: string;
    type: string;
    license: string | null;
    latest_version: string | null;
    total_downloads: number;
    created_at: string;
    updated_at: string;
    repository_url: string | null;
    homepage_url: string | null;
    owner_id: string;
    users: { github_username: string; avatar_url: string | null; display_name: string | null } | null;
    stars: number;
  };
  readme: string;
  versions: FormationVersion[];
  reefJson: ReefJson | null;
}

type Tab = 'readme' | 'agents' | 'versions' | 'manifest';

export default function FormationDetail({
  formation,
  readme,
  versions,
  reefJson,
}: FormationDetailProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab') as Tab | null;
  const validTabs: Tab[] = ['readme', 'agents', 'versions', 'manifest'];
  const activeTab = tabParam && validTabs.includes(tabParam) ? tabParam : 'readme';

  function setActiveTab(tab: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'readme') params.delete('tab');
    else params.set('tab', tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  const rawAgents = reefJson?.agents;
  const agents: Array<{ name: string; model?: string; role?: string }> = rawAgents
    ? Array.isArray(rawAgents)
      ? rawAgents
      : Object.entries(rawAgents).map(([slug, cfg]) => ({ name: slug, model: cfg.model, role: cfg.role }))
    : [];
  const rawEdges = reefJson?.agentToAgent;
  const edges: Array<{ from: string; to: string; channel?: string }> = rawEdges
    ? Array.isArray(rawEdges)
      ? rawEdges
      : Object.entries(rawEdges).flatMap(([from, targets]) =>
          (Array.isArray(targets) ? targets : []).map((to: string) => ({ from, to }))
        )
    : [];
  const variableCount = reefJson?.variables ? Object.keys(reefJson.variables).length : 0;
  const cronCount = reefJson?.cron
    ? Array.isArray(reefJson.cron)
      ? reefJson.cron.length
      : Object.keys(reefJson.cron).length
    : 0;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'readme', label: 'README' },
    { key: 'agents', label: `Agents (${agents.length})` },
    { key: 'versions', label: `Versions (${versions.length})` },
    { key: 'manifest', label: 'reef.json' },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-bold text-foreground">{formation.name}</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${typeBadgeClass(formation.type)}`}
            >
              {formation.type}
            </span>
          </div>
          <p className="mt-2 text-muted">{formation.description}</p>
          <div className="mt-2 flex items-center gap-3 text-sm text-muted">
            {formation.users && (
              <span className="flex items-center gap-1.5">
                {formation.users.avatar_url && (
                  <img
                    src={formation.users.avatar_url}
                    alt=""
                    className="h-5 w-5 rounded-full"
                  />
                )}
                {formation.users.github_username}
              </span>
            )}
            {formation.latest_version && (
              <span className="font-mono">v{formation.latest_version}</span>
            )}
            {formation.license && <span>{formation.license}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StarButton
            formationName={formation.name}
            initialStars={formation.stars}
          />
        </div>
      </div>

      {/* Install command */}
      <div className="mt-6">
        <CopyCommand command={`reef install ${formation.name}`} />
      </div>

      {/* Main content + sidebar */}
      <div className="mt-8 flex flex-col gap-8 lg:flex-row">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-border">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'border-b-2 border-accent text-accent'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="mt-6">
            {activeTab === 'readme' && (
              <div className="prose-invert max-w-none">
                {readme ? (
                  <div className="text-sm leading-relaxed text-foreground">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => <h1 className="text-2xl font-bold mt-8 mb-4">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-xl font-semibold mt-8 mb-3">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-lg font-semibold mt-6 mb-2">{children}</h3>,
                        h4: ({ children }) => <h4 className="text-base font-semibold mt-4 mb-2">{children}</h4>,
                        p: ({ children }) => <p className="my-3">{children}</p>,
                        a: ({ href, children }) => (
                          <a href={href} className="text-accent hover:text-accent-light underline" target="_blank" rel="noopener noreferrer">{children}</a>
                        ),
                        code: ({ className, children, ...props }) => {
                          const isInline = !className;
                          return isInline
                            ? <code className="rounded bg-surface-2 px-1.5 py-0.5 text-sm text-accent-light">{children}</code>
                            : <code className={className} {...props}>{children}</code>;
                        },
                        pre: ({ children }) => (
                          <pre className="rounded-lg border border-border bg-surface-2 p-4 overflow-x-auto text-sm my-4">{children}</pre>
                        ),
                        ul: ({ children }) => <ul className="list-disc pl-6 my-3 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-6 my-3 space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="text-sm">{children}</li>,
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-border pl-4 my-4 text-muted italic">{children}</blockquote>
                        ),
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-4">
                            <table className="min-w-full text-sm border border-border">{children}</table>
                          </div>
                        ),
                        thead: ({ children }) => <thead className="bg-surface-2">{children}</thead>,
                        th: ({ children }) => <th className="border border-border px-3 py-2 text-left font-semibold">{children}</th>,
                        td: ({ children }) => <td className="border border-border px-3 py-2">{children}</td>,
                        hr: () => <hr className="my-6 border-border" />,
                        img: ({ src, alt }) => (
                          <img src={src} alt={alt || ''} className="max-w-full rounded my-4" />
                        ),
                        strong: ({ children }) => <strong>{children}</strong>,
                        em: ({ children }) => <em>{children}</em>,
                      }}
                    >
                      {readme}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-muted">No README provided.</p>
                )}
              </div>
            )}

            {activeTab === 'agents' && (
              <TopologyGraph agents={agents} edges={edges} />
            )}

            {activeTab === 'versions' && (
              <div className="space-y-2">
                {versions.map((v) => (
                  <div
                    key={v.version}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold text-accent-light">
                        v{v.version}
                      </span>
                      {v.is_prerelease && (
                        <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
                          prerelease
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted">
                      <span>{v.agent_count} agent{v.agent_count !== 1 ? 's' : ''}</span>
                      <span>{formatBytes(v.tarball_size)}</span>
                      <span>{formatDate(v.published_at)}</span>
                    </div>
                  </div>
                ))}
                {versions.length === 0 && (
                  <p className="text-muted text-sm">No versions published yet.</p>
                )}
              </div>
            )}

            {activeTab === 'manifest' && (
              <pre className="rounded-lg border border-border bg-surface p-4 overflow-x-auto text-sm text-foreground">
                <code>{reefJson ? JSON.stringify(reefJson, null, 2) : 'No manifest available.'}</code>
              </pre>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-full shrink-0 lg:w-64">
          <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted">Type</div>
              <div className="mt-1 text-sm">{formation.type} &middot; {agents.length} agent{agents.length !== 1 ? 's' : ''}</div>
            </div>

            {variableCount > 0 && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted">Variables</div>
                <div className="mt-1 text-sm">{variableCount}</div>
              </div>
            )}

            {cronCount > 0 && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted">Cron Jobs</div>
                <div className="mt-1 text-sm">{cronCount}</div>
              </div>
            )}

            {formation.license && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted">License</div>
                <div className="mt-1 text-sm">{formation.license}</div>
              </div>
            )}

            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted">Last Published</div>
              <div className="mt-1 text-sm">{formatDate(formation.updated_at)}</div>
            </div>

            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted">Downloads</div>
              <div className="mt-1 text-sm font-mono">{formation.total_downloads.toLocaleString()}</div>
            </div>

            {formation.repository_url && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted">Repository</div>
                <a
                  href={formation.repository_url}
                  className="mt-1 block text-sm text-accent hover:text-accent-light truncate"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {formation.repository_url.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}

            <div className="pt-2 border-t border-border">
              <Link
                href={`/formations/${formation.name}/versions`}
                className="text-sm text-accent hover:text-accent-light"
              >
                All versions &rarr;
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
