interface TopologyEdge {
  from: string;
  to: string;
  channel?: string;
}

interface TopologyGraphProps {
  agents: Array<{ name: string; model?: string; role?: string }>;
  edges: TopologyEdge[];
}

export default function TopologyGraph({ agents, edges }: TopologyGraphProps) {
  if (agents.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-muted">
        No agents defined.
      </div>
    );
  }

  // Build adjacency for text-based graph
  const agentNames = new Set(agents.map((a) => a.name));

  return (
    <div className="space-y-4">
      {/* Text-based topology diagram */}
      <div className="rounded-lg border border-border bg-surface p-4 font-mono text-sm">
        <div className="text-muted mb-3"># Agent Topology</div>
        {edges.length > 0 ? (
          <div className="space-y-1">
            {edges.map((edge, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-accent-light">[{edge.from}]</span>
                <span className="text-muted">---{edge.channel ? `(${edge.channel})` : ''}{`-->`}</span>
                <span className="text-accent-light">[{edge.to}]</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {[...agentNames].map((name) => (
              <div key={name} className="text-accent-light">[{name}]</div>
            ))}
            {agentNames.size > 1 && (
              <div className="text-muted mt-2">No explicit connections defined.</div>
            )}
          </div>
        )}
      </div>

      {/* Agent list */}
      <div className="space-y-2">
        {agents.map((agent) => (
          <div
            key={agent.name}
            className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3"
          >
            <div>
              <span className="font-mono text-sm font-semibold text-accent-light">
                {agent.name}
              </span>
              {agent.role && (
                <span className="ml-2 text-xs text-muted">({agent.role})</span>
              )}
            </div>
            {agent.model && (
              <span className="rounded bg-surface-2 px-2 py-0.5 text-xs font-mono text-muted">
                {agent.model}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
