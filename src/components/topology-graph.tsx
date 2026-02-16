interface TopologyEdge {
  from: string;
  to: string;
  channel?: string;
}

interface TopologyGraphProps {
  agents: Array<{ name: string; model?: string; role?: string }>;
  edges: TopologyEdge[];
}

interface NodePos {
  x: number;
  y: number;
  name: string;
}

const SVG_W = 600;
const SVG_H = 400;
const NODE_W = 120;
const NODE_H = 40;
const GRID_LANE_H = 70;

function computeCircularLayout(agents: TopologyGraphProps['agents']): NodePos[] {
  const cx = SVG_W / 2;
  const cy = SVG_H / 2;

  if (agents.length === 1) {
    return [{ x: cx, y: cy, name: agents[0].name }];
  }
  if (agents.length === 2) {
    return [
      { x: cx - 120, y: cy, name: agents[0].name },
      { x: cx + 120, y: cy, name: agents[1].name },
    ];
  }

  const rx = Math.min(SVG_W * 0.38, 220);
  const ry = Math.min(SVG_H * 0.35, 150);

  return agents.map((a, i) => {
    const angle = (2 * Math.PI * i) / agents.length - Math.PI / 2;
    return {
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
      name: a.name,
    };
  });
}

function computeGridLayout(agents: TopologyGraphProps['agents']): NodePos[] {
  const cols = Math.min(4, agents.length);
  const rows = Math.ceil(agents.length / cols);
  const colW = SVG_W / (cols + 1);
  const startY = 40;

  return agents.map((a, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      x: colW * (col + 1),
      y: startY + row * GRID_LANE_H + GRID_LANE_H / 2,
      name: a.name,
    };
  });
}

function bezierPath(from: NodePos, to: NodePos): string {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // Perpendicular offset for curve
  const off = Math.min(Math.sqrt(dx * dx + dy * dy) * 0.2, 40);
  const cx1 = mx - (dy / Math.sqrt(dx * dx + dy * dy || 1)) * off;
  const cy1 = my + (dx / Math.sqrt(dx * dx + dy * dy || 1)) * off;
  return `M${from.x},${from.y} Q${cx1},${cy1} ${to.x},${to.y}`;
}

function gridPath(from: NodePos, to: NodePos): string {
  // Straight line for grid layout
  return `M${from.x},${from.y} L${to.x},${to.y}`;
}

export default function TopologyGraph({ agents, edges }: TopologyGraphProps) {
  if (agents.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-muted">
        No agents defined.
      </div>
    );
  }

  const useGrid = agents.length >= 9;
  const positions = useGrid ? computeGridLayout(agents) : computeCircularLayout(agents);
  const posMap = new Map(positions.map((p) => [p.name, p]));
  const animate = agents.length <= 8;

  const svgH = useGrid
    ? Math.ceil(agents.length / Math.min(4, agents.length)) * GRID_LANE_H + 60
    : SVG_H;

  return (
    <div className="space-y-4">
      {/* SVG Topology */}
      <div className="rounded-lg border border-border bg-surface p-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${SVG_W} ${svgH}`}
          width="100%"
          role="img"
          aria-label="Agent topology graph"
          style={{ minWidth: 320 }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L8,3 L0,6" fill="var(--accent)" opacity="0.7" />
            </marker>
          </defs>

          {/* Edges */}
          {edges.map((edge, i) => {
            const from = posMap.get(edge.from);
            const to = posMap.get(edge.to);
            if (!from || !to) return null;
            const d = useGrid ? gridPath(from, to) : bezierPath(from, to);
            return (
              <g key={i}>
                <path
                  d={d}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="1.5"
                  strokeDasharray="6 4"
                  strokeOpacity="0.5"
                  markerEnd="url(#arrowhead)"
                  className={animate ? 'topology-edge-animated' : undefined}
                  style={animate ? { animation: 'dashflow 2s linear infinite' } : undefined}
                />
                {edge.channel && (
                  <text
                    x={(from.x + to.x) / 2}
                    y={(from.y + to.y) / 2 - 8}
                    textAnchor="middle"
                    fill="var(--muted)"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                  >
                    {edge.channel}
                  </text>
                )}
              </g>
            );
          })}

          {/* No-edge lines: if no edges but multiple agents, show all isolated */}
          {edges.length === 0 && agents.length > 1 && (
            <text
              x={SVG_W / 2}
              y={svgH - 12}
              textAnchor="middle"
              fill="var(--muted)"
              fontSize="11"
              fontFamily="var(--font-mono)"
            >
              No explicit connections defined
            </text>
          )}

          {/* Nodes */}
          {positions.map((pos) => {
            const agent = agents.find((a) => a.name === pos.name);
            return (
              <g key={pos.name}>
                <rect
                  x={pos.x - NODE_W / 2}
                  y={pos.y - NODE_H / 2}
                  width={NODE_W}
                  height={NODE_H}
                  rx="8"
                  fill="var(--surface-2)"
                  stroke="var(--accent)"
                  strokeWidth="1.5"
                  strokeOpacity="0.6"
                />
                <text
                  x={pos.x}
                  y={pos.y + (agent?.role ? -2 : 4)}
                  textAnchor="middle"
                  fill="var(--accent-light)"
                  fontSize="12"
                  fontWeight="600"
                  fontFamily="var(--font-mono)"
                >
                  {pos.name.length > 14 ? pos.name.slice(0, 13) + '\u2026' : pos.name}
                </text>
                {agent?.role && (
                  <text
                    x={pos.x}
                    y={pos.y + 12}
                    textAnchor="middle"
                    fill="var(--muted)"
                    fontSize="9"
                    fontFamily="var(--font-mono)"
                  >
                    {agent.role}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Agent list (legend/detail) */}
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
