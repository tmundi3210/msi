import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDatabase } from '../hooks/useDatabase';
import { getStats, getRecentSessions, getNodesWithStats, getReviewHistory, exportData, importData } from '../db/database';
import type { Session } from '../types';

export default function Dashboard() {
  const { version, refresh } = useDatabase();
  const [stats, setStats] = useState({ totalNodes: 0, totalCards: 0, dueNow: 0, reviewedToday: 0, streak: 0 });
  const [sessions, setSessions] = useState<Session[]>([]);
  const [history, setHistory] = useState<Array<{ date: string; count: number }>>([]);
  const [importResult, setImportResult] = useState<string | null>(null);

  useEffect(() => {
    setStats(getStats());
    setSessions(getRecentSessions(5));
    setHistory(getReviewHistory(28));
  }, [version]);

  const nodesWithStats = useMemo(() => getNodesWithStats(), [version]);
  const atRiskNodes = nodesWithStats.filter(ns => ns.dueCount > 0).slice(0, 6);
  const maxHistory = Math.max(...history.map(h => h.count), 1);

  const handleExport = () => {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `learning-os-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const result = importData(text);
        setImportResult(`Imported ${result.nodes} nodes, ${result.cards} cards`);
        refresh();
        setTimeout(() => setImportResult(null), 4000);
      } catch {
        setImportResult('Import failed — check file format');
        setTimeout(() => setImportResult(null), 4000);
      }
    };
    input.click();
  };

  // Empty state
  if (stats.totalNodes === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>
            <span style={{ background: 'linear-gradient(135deg, var(--accent), #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Learning OS</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: 15, lineHeight: 1.7 }}>
            Build a knowledge graph, create flashcards, and let spaced repetition do the rest. Start by creating your first knowledge node.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link to="/nodes">
              <button className="btn-primary btn-lg">Create First Node</button>
            </Link>
            <button className="btn-ghost btn-lg" onClick={handleImport}>Import Data</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        {stats.dueNow > 0 && (
          <Link to="/review">
            <button className="btn-primary">Review {stats.dueNow} Due Cards</button>
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card" data-color="accent">
          <div className="stat-label">Nodes</div>
          <div className="stat-value">{stats.totalNodes}</div>
        </div>
        <div className="stat-card" data-color="accent">
          <div className="stat-label">Cards</div>
          <div className="stat-value">{stats.totalCards}</div>
        </div>
        <div className="stat-card" data-color={stats.dueNow > 0 ? "danger" : "success"}>
          <div className="stat-label">Due Now</div>
          <div className="stat-value" style={{ color: stats.dueNow > 0 ? 'var(--recall-hot)' : 'var(--recall-cold)' }}>
            {stats.dueNow}
          </div>
        </div>
        <div className="stat-card" data-color="success">
          <div className="stat-label">Today</div>
          <div className="stat-value" style={{ color: 'var(--recall-cold)' }}>{stats.reviewedToday}</div>
        </div>
        <div className="stat-card" data-color={stats.streak > 0 ? "warning" : undefined}>
          <div className="stat-label">Streak</div>
          <div className="stat-value">{stats.streak}<span style={{ fontSize: 14, color: 'var(--text-muted)' }}>d</span></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Heatmap */}
          <div className="card">
            <div className="section-title">Activity — Last 28 Days</div>
            <div className="heatmap">
              {history.map((h, i) => {
                const level = h.count === 0 ? 0 : h.count <= 5 ? 1 : h.count <= 15 ? 2 : h.count <= 30 ? 3 : 4;
                return (
                  <div
                    key={i}
                    className="heatmap-cell"
                    data-level={level}
                    title={`${h.date}: ${h.count} reviews`}
                  />
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>4 weeks ago</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Less</span>
                {[0,1,2,3,4].map(l => (
                  <div key={l} className="heatmap-cell" data-level={l} style={{ width: 10, height: 10 }} />
                ))}
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>More</span>
              </div>
            </div>
          </div>

          {/* At-risk nodes */}
          {atRiskNodes.length > 0 && (
            <div className="card">
              <div className="section-title">Needs Attention</div>
              {atRiskNodes.map(ns => {
                const healthColor = ns.avgEase === null ? 'var(--text-muted)'
                  : ns.avgEase >= 2.5 ? 'var(--recall-cold)'
                  : ns.avgEase >= 2.0 ? 'var(--recall-cool)'
                  : ns.avgEase >= 1.5 ? 'var(--recall-warm)'
                  : 'var(--recall-hot)';
                return (
                  <div key={ns.node.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: healthColor, flexShrink: 0 }} />
                      <Link to="/nodes" style={{ fontSize: 13, fontWeight: 500 }}>{ns.node.title}</Link>
                    </div>
                    <span className="badge badge-due">{ns.dueCount} due</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Data */}
          <div className="card">
            <div className="section-title">Data</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-ghost btn-sm" onClick={handleExport}>Export Backup</button>
              <button className="btn-ghost btn-sm" onClick={handleImport}>Import</button>
            </div>
            {importResult && <p style={{ marginTop: 10, fontSize: 13, color: 'var(--accent)' }}>{importResult}</p>}
          </div>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Bar chart */}
          <div className="card">
            <div className="section-title">Reviews per Day</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 100 }}>
              {history.slice(-14).map((h, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <div
                    style={{
                      width: '100%',
                      height: `${Math.max(h.count > 0 ? 6 : 0, (h.count / maxHistory) * 80)}px`,
                      background: h.count > 0 ? 'linear-gradient(to top, var(--accent-dim), var(--accent))' : 'var(--bg-elevated)',
                      borderRadius: '3px 3px 0 0',
                      transition: 'height 0.3s',
                    }}
                    title={`${h.date}: ${h.count}`}
                  />
                  {i % 3 === 0 && (
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 6 }}>
                      {h.date.replace(' ', '\n').split(' ')[0]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recent sessions */}
          <div className="card">
            <div className="section-title">Recent Sessions</div>
            {sessions.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No sessions yet. Start a review to begin.</p>
            ) : (
              sessions.map(s => {
                const start = new Date(s.startedAt);
                const end = s.endedAt ? new Date(s.endedAt) : null;
                const duration = end ? Math.round((end.getTime() - start.getTime()) / 60000) : null;
                return (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontWeight: 400 }}>
                          {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {s.mode} — {s.cardsReviewed} cards{duration !== null ? ` — ${duration}m` : ''}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Knowledge map summary */}
          <div className="card">
            <div className="section-title">Knowledge Health</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Strong', color: 'var(--recall-cold)', count: nodesWithStats.filter(n => n.avgEase !== null && n.avgEase >= 2.5).length },
                { label: 'Good', color: 'var(--recall-cool)', count: nodesWithStats.filter(n => n.avgEase !== null && n.avgEase >= 2.0 && n.avgEase < 2.5).length },
                { label: 'Weak', color: 'var(--recall-warm)', count: nodesWithStats.filter(n => n.avgEase !== null && n.avgEase >= 1.5 && n.avgEase < 2.0).length },
                { label: 'At Risk', color: 'var(--recall-hot)', count: nodesWithStats.filter(n => n.avgEase !== null && n.avgEase < 1.5).length },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{item.count}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
