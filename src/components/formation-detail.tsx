'use client';

import { useState } from 'react';
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
  agents?: Array<{ name: string; model?: string; role?: string }>;
  agentToAgent?: Array<{ from: string; to: string; channel?: string }>;
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

function renderReadme(readme: string): string {
  // Strip HTML tags to prevent XSS — formation README could contain arbitrary content
  const stripped = readme.replace(/<[^>]*>/g, '');

  // Basic markdown-to-HTML: headings, bold, italic, code blocks, links, paragraphs
  let html = stripped
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="rounded-lg border border-border bg-surface-2 p-4 overflow-x-auto text-sm my-4"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="rounded bg-surface-2 px-1.5 py-0.5 text-sm text-accent-light">$1</code>')
    // Headings
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mt-8 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>')
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links — only allow safe URL schemes to prevent XSS via javascript: URIs
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, url) => {
      if (/^https?:\/\/|^mailto:/i.test(url)) {
        return `<a href="${url}" class="text-accent hover:text-accent-light underline" target="_blank" rel="noopener noreferrer">${text}</a>`;
      }
      return text; // Strip the link, keep the text
    })
    // Line breaks (double newline = paragraph)
    .replace(/\n\n/g, '</p><p class="my-3">')
    // Single newlines to <br>
    .replace(/\n/g, '<br/>');

  return `<p class="my-3">${html}</p>`;
}

export default function FormationDetail({
  formation,
  readme,
  versions,
  reefJson,
}: FormationDetailProps) {
  const [activeTab, setActiveTab] = useState<Tab>('readme');

  const agents = reefJson?.agents ?? [];
  const edges = reefJson?.agentToAgent ?? [];
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
                  <div
                    className="text-sm leading-relaxed text-foreground"
                    dangerouslySetInnerHTML={{ __html: renderReadme(readme) }}
                  />
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
