import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import { getNodesWithStats, getLinksForNode } from '../db/database';

interface GraphNode {
  id: string;
  title: string;
  definition: string;
  cardCount: number;
  dueCount: number;
  avgEase: number | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  pinned: boolean;
}

interface GraphLink {
  source: string;
  target: string;
  type: 'parent' | 'lateral';
}

function getHealthColor(avgEase: number | null, dueCount: number): string {
  if (dueCount > 0) {
    if (avgEase === null) return '#ff5c5c';
    if (avgEase < 1.5) return '#ff5c5c';   // at-risk: red
    if (avgEase < 2.0) return '#f5b731';   // weak: amber
  }
  if (avgEase === null) return '#4a5275';   // no data: grey
  if (avgEase >= 2.5) return '#3dd68c';    // strong: green
  if (avgEase >= 2.0) return '#6c8cff';    // good: blue
  if (avgEase >= 1.5) return '#f5b731';    // weak: amber
  return '#ff5c5c';                         // at-risk: red
}

function getHealthGlow(avgEase: number | null, dueCount: number): string {
  const base = getHealthColor(avgEase, dueCount);
  return base + '40'; // 25% opacity for glow
}

function getDecayOpacity(avgEase: number | null, dueCount: number): number {
  if (dueCount > 5) return 0.5;  // heavily overdue: faded
  if (dueCount > 0) return 0.75; // some due: slightly faded
  if (avgEase === null) return 0.4; // no reviews yet
  return 1.0; // healthy
}

export default function MindMapPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { version } = useDatabase();
  const animFrameRef = useRef<number>(0);
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<GraphNode | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dimensions, setDimensions] = useState({ w: 800, h: 600 });

  // Build graph data
  const nodesWithStats = useMemo(() => getNodesWithStats(), [version]);

  useEffect(() => {
    const allLinks: GraphLink[] = [];
    const linkSet = new Set<string>();

    for (const ns of nodesWithStats) {
      const nodeLinks = getLinksForNode(ns.node.id);
      for (const l of nodeLinks) {
        const key = [l.sourceId, l.targetId].sort().join(':');
        if (!linkSet.has(key)) {
          linkSet.add(key);
          allLinks.push({ source: l.sourceId, target: l.targetId, type: l.linkType });
        }
      }
    }

    // Preserve positions for existing nodes
    const existingPositions = new Map<string, { x: number; y: number }>();
    for (const n of nodesRef.current) {
      existingPositions.set(n.id, { x: n.x, y: n.y });
    }

    const cx = dimensions.w / 2;
    const cy = dimensions.h / 2;

    nodesRef.current = nodesWithStats.map((ns, i) => {
      const existing = existingPositions.get(ns.node.id);
      const angle = (2 * Math.PI * i) / nodesWithStats.length;
      const spread = Math.min(dimensions.w, dimensions.h) * 0.3;
      return {
        id: ns.node.id,
        title: ns.node.title,
        definition: ns.node.definition,
        cardCount: ns.cardCount,
        dueCount: ns.dueCount,
        avgEase: ns.avgEase,
        x: existing?.x ?? cx + Math.cos(angle) * spread + (Math.random() - 0.5) * 50,
        y: existing?.y ?? cy + Math.sin(angle) * spread + (Math.random() - 0.5) * 50,
        vx: 0,
        vy: 0,
        radius: Math.max(18, Math.min(40, 18 + ns.cardCount * 2)),
        pinned: false,
      };
    });

    linksRef.current = allLinks;
  }, [nodesWithStats, dimensions]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ w: width, h: height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Force simulation + rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const simulate = () => {
      if (!running) return;
      const nodes = nodesRef.current;
      const links = linksRef.current;
      const nodeMap = new Map(nodes.map(n => [n.id, n]));

      // Forces
      const alpha = 0.3;
      const repulsion = 3000;
      const springLength = 120;
      const springStrength = 0.02;
      const centerStrength = 0.01;
      const damping = 0.85;
      const cx = dimensions.w / 2;
      const cy = dimensions.h / 2;

      // Repulsion (all pairs)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const force = repulsion / (dist * dist);
          const fx = (dx / dist) * force * alpha;
          const fy = (dy / dist) * force * alpha;
          if (!a.pinned) { a.vx -= fx; a.vy -= fy; }
          if (!b.pinned) { b.vx += fx; b.vy += fy; }
        }
      }

      // Spring (links)
      for (const link of links) {
        const a = nodeMap.get(link.source);
        const b = nodeMap.get(link.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = (dist - springLength) * springStrength * alpha;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (!a.pinned) { a.vx += fx; a.vy += fy; }
        if (!b.pinned) { b.vx -= fx; b.vy -= fy; }
      }

      // Center gravity
      for (const n of nodes) {
        if (n.pinned) continue;
        n.vx += (cx - n.x) * centerStrength * alpha;
        n.vy += (cy - n.y) * centerStrength * alpha;
      }

      // Apply velocity
      for (const n of nodes) {
        if (n.pinned) continue;
        n.vx *= damping;
        n.vy *= damping;
        n.x += n.vx;
        n.y += n.vy;
        // Bounds
        n.x = Math.max(n.radius, Math.min(dimensions.w - n.radius, n.x));
        n.y = Math.max(n.radius, Math.min(dimensions.h - n.radius, n.y));
      }

      // Render
      ctx.clearRect(0, 0, dimensions.w, dimensions.h);
      ctx.save();
      ctx.translate(offset.x, offset.y);
      ctx.scale(zoom, zoom);

      // Draw links
      for (const link of links) {
        const a = nodeMap.get(link.source);
        const b = nodeMap.get(link.target);
        if (!a || !b) continue;

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = link.type === 'parent'
          ? 'rgba(108, 140, 255, 0.25)'
          : 'rgba(108, 140, 255, 0.12)';
        ctx.lineWidth = link.type === 'parent' ? 2 : 1;
        if (link.type === 'lateral') {
          ctx.setLineDash([4, 4]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw nodes
      for (const n of nodes) {
        const color = getHealthColor(n.avgEase, n.dueCount);
        const glow = getHealthGlow(n.avgEase, n.dueCount);
        const opacity = getDecayOpacity(n.avgEase, n.dueCount);
        const isHovered = hovered?.id === n.id;

        ctx.globalAlpha = opacity;

        // Glow
        if (n.dueCount > 0 || isHovered) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + (isHovered ? 12 : 8), 0, Math.PI * 2);
          ctx.fillStyle = isHovered ? 'rgba(108, 140, 255, 0.15)' : glow;
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = isHovered ? '#1f2436' : '#12151c';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = isHovered ? 3 : 2;
        ctx.stroke();

        // Due count indicator (pulsing ring)
        if (n.dueCount > 0) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = color + '60';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Label
        ctx.fillStyle = isHovered ? '#e8eaf0' : '#b0b5c5';
        ctx.font = `${isHovered ? '600' : '500'} ${Math.max(10, Math.min(13, n.radius * 0.6))}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Truncate title to fit
        const maxWidth = n.radius * 1.8;
        let label = n.title;
        while (ctx.measureText(label).width > maxWidth && label.length > 3) {
          label = label.slice(0, -2) + '…';
        }
        ctx.fillText(label, n.x, n.y);

        // Card count badge
        if (n.cardCount > 0) {
          const badgeX = n.x + n.radius * 0.6;
          const badgeY = n.y - n.radius * 0.6;
          ctx.beginPath();
          ctx.arc(badgeX, badgeY, 8, 0, Math.PI * 2);
          ctx.fillStyle = n.dueCount > 0 ? '#ff5c5c' : '#4a5275';
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = '600 8px Inter, sans-serif';
          ctx.fillText(String(n.dueCount > 0 ? n.dueCount : n.cardCount), badgeX, badgeY);
        }

        ctx.globalAlpha = 1;
      }

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(simulate);
    };

    simulate();
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [dimensions, hovered, offset, zoom]);

  // Mouse handlers
  const getNodeAt = useCallback((mx: number, my: number): GraphNode | null => {
    const x = (mx - offset.x) / zoom;
    const y = (my - offset.y) / zoom;
    for (const n of [...nodesRef.current].reverse()) {
      const dx = n.x - x;
      const dy = n.y - y;
      if (dx * dx + dy * dy <= n.radius * n.radius) return n;
    }
    return null;
  }, [offset, zoom]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setMousePos({ x: e.clientX, y: e.clientY });

    if (dragging) {
      dragging.x = (mx - offset.x) / zoom;
      dragging.y = (my - offset.y) / zoom;
      dragging.vx = 0;
      dragging.vy = 0;
    } else {
      const node = getNodeAt(mx, my);
      setHovered(node);
      if (canvasRef.current) {
        canvasRef.current.style.cursor = node ? 'grab' : 'default';
      }
    }
  }, [dragging, getNodeAt, offset, zoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const node = getNodeAt(mx, my);
    if (node) {
      node.pinned = true;
      setDragging(node);
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
    }
  }, [getNodeAt]);

  const handleMouseUp = useCallback(() => {
    if (dragging) {
      dragging.pinned = false;
      setDragging(null);
    }
  }, [dragging]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.3, Math.min(3, z * delta)));
  }, []);

  // Legend data
  const legend = [
    { color: '#3dd68c', label: 'Strong' },
    { color: '#6c8cff', label: 'Good' },
    { color: '#f5b731', label: 'Weak' },
    { color: '#ff5c5c', label: 'At Risk' },
    { color: '#4a5275', label: 'No Data' },
  ];

  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <h1>Mind Map</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {nodesWithStats.length} nodes
          </span>
          <button className="btn-ghost btn-sm" onClick={() => { setOffset({ x: 0, y: 0 }); setZoom(1); }}>
            Reset View
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        style={{ flex: 1, position: 'relative', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)', overflow: 'hidden' }}
      >
        {nodesWithStats.length === 0 ? (
          <div className="empty-state" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div>
              <h2>Empty Graph</h2>
              <p>Create knowledge nodes to see them visualized here.</p>
            </div>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            width={dimensions.w}
            height={dimensions.h}
            style={{ display: 'block', width: '100%', height: '100%' }}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          />
        )}

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 16, left: 16,
          background: 'rgba(18, 21, 28, 0.9)', backdropFilter: 'blur(8px)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          padding: '10px 14px', display: 'flex', gap: 14, alignItems: 'center',
        }}>
          {legend.map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.color, border: `2px solid ${l.color}`, boxShadow: `0 0 6px ${l.color}40` }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.label}</span>
            </div>
          ))}
        </div>

        {/* Zoom indicator */}
        <div style={{
          position: 'absolute', bottom: 16, right: 16,
          background: 'rgba(18, 21, 28, 0.9)', backdropFilter: 'blur(8px)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          padding: '6px 12px', display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <button className="btn-ghost btn-sm" style={{ padding: '2px 8px' }} onClick={() => setZoom(z => Math.max(0.3, z * 0.8))}>-</button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button className="btn-ghost btn-sm" style={{ padding: '2px 8px' }} onClick={() => setZoom(z => Math.min(3, z * 1.2))}>+</button>
        </div>

        {/* Tooltip */}
        {hovered && !dragging && (
          <div style={{
            position: 'fixed',
            left: mousePos.x + 16,
            top: mousePos.y - 8,
            background: 'rgba(18, 21, 28, 0.95)',
            backdropFilter: 'blur(12px)',
            border: `1px solid ${getHealthColor(hovered.avgEase, hovered.dueCount)}40`,
            borderRadius: 'var(--radius)',
            padding: '12px 16px',
            maxWidth: 280,
            zIndex: 200,
            boxShadow: 'var(--shadow-lg)',
            pointerEvents: 'none',
          }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{hovered.title}</div>
            {hovered.definition && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>
                {hovered.definition.length > 120 ? hovered.definition.slice(0, 120) + '...' : hovered.definition}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 12 }}>
              <div style={{ color: 'var(--text-muted)' }}>Cards</div>
              <div style={{ fontWeight: 600 }}>{hovered.cardCount}</div>
              <div style={{ color: 'var(--text-muted)' }}>Due</div>
              <div style={{ fontWeight: 600, color: hovered.dueCount > 0 ? 'var(--danger)' : 'var(--success)' }}>
                {hovered.dueCount}
              </div>
              <div style={{ color: 'var(--text-muted)' }}>Health</div>
              <div style={{ fontWeight: 600, color: getHealthColor(hovered.avgEase, hovered.dueCount) }}>
                {hovered.avgEase === null ? 'No data'
                  : hovered.avgEase >= 2.5 ? 'Strong'
                  : hovered.avgEase >= 2.0 ? 'Good'
                  : hovered.avgEase >= 1.5 ? 'Weak'
                  : 'At Risk'}
              </div>
              {hovered.avgEase !== null && (
                <>
                  <div style={{ color: 'var(--text-muted)' }}>Ease</div>
                  <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{hovered.avgEase.toFixed(2)}</div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', padding: '10px 0', fontSize: 11, color: 'var(--text-muted)' }}>
        <span>Drag nodes to rearrange</span>
        <span>Scroll to zoom</span>
        <span>Node size = card count</span>
        <span>Faded = needs review</span>
      </div>
    </div>
  );
}
