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
    setHistory(getReviewHistory(14));
  }, [version]);

  const nodesWithStats = useMemo(() => getNodesWithStats(), [version]);
  const atRiskNodes = nodesWithStats.filter(ns => ns.dueCount > 0).slice(0, 5);
  const maxHistory = Math.max(...history.map(h => h.count), 1);

  const handleExport = () => {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `learning-os-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
        setImportResult(`Imported ${result.nodes} nodes and ${result.cards} cards.`);
        refresh();
        setTimeout(() => setImportResult(null), 5000);
      } catch {
        setImportResult('Import failed. Check file format.');
        setTimeout(() => setImportResult(null), 5000);
      }
    };
    input.click();
  };

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {stats.dueNow > 0 && (
            <Link to="/review">
              <button className="btn-primary">Review {stats.dueNow} due cards</button>
            </Link>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Nodes</div>
          <div className="stat-value">{stats.totalNodes}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cards</div>
          <div className="stat-value">{stats.totalCards}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Due Now</div>
          <div className="stat-value" style={{ color: stats.dueNow > 0 ? 'var(--recall-hot)' : 'var(--recall-cold)' }}>
            {stats.dueNow}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Today</div>
          <div className="stat-value" style={{ color: 'var(--recall-cold)' }}>
            {stats.reviewedToday}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Streak</div>
          <div className="stat-value" style={{ color: stats.streak > 0 ? 'var(--recall-cold)' : 'var(--text-muted)' }}>
            {stats.streak}d
          </div>
        </div>
      </div>

      {stats.totalNodes === 0 ? (
        <div className="empty-state">
          <h2>Get started</h2>
          <p>Create your first knowledge node and add some flashcards.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
            <Link to="/nodes">
              <button className="btn-primary">Create a Node</button>
            </Link>
            <button className="btn-ghost" onClick={handleImport}>Import Data</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Left column */}
          <div>
            {/* Review history chart */}
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, marginBottom: 16, color: 'var(--text-muted)' }}>Last 14 Days</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
                {history.map((h, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div
                      style={{
                        width: '100%',
                        height: `${(h.count / maxHistory) * 60}px`,
                        minHeight: h.count > 0 ? 4 : 0,
                        background: h.count > 0 ? 'var(--accent)' : 'var(--bg-elevated)',
                        borderRadius: 2,
                        transition: 'height 0.3s',
                      }}
                      title={`${h.date}: ${h.count} reviews`}
                    />
                    {i % 2 === 0 && (
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>{h.date.split(' ')[1]}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* At-risk nodes */}
            {atRiskNodes.length > 0 && (
              <div className="card">
                <h3 style={{ fontSize: 14, marginBottom: 12, color: 'var(--text-muted)' }}>Needs Attention</h3>
                {atRiskNodes.map(ns => {
                  const healthColor = ns.avgEase === null ? 'var(--text-muted)'
                    : ns.avgEase >= 2.5 ? 'var(--recall-cold)'
                    : ns.avgEase >= 2.0 ? 'var(--recall-cool)'
                    : ns.avgEase >= 1.5 ? 'var(--recall-warm)'
                    : 'var(--recall-hot)';
                  return (
                    <div key={ns.node.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: healthColor, flexShrink: 0 }} />
                        <Link to="/nodes" style={{ fontSize: 14 }}>{ns.node.title}</Link>
                      </div>
                      <span className="badge badge-due">{ns.dueCount} due</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right column */}
          <div>
            {/* Recent sessions */}
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, marginBottom: 12, color: 'var(--text-muted)' }}>Recent Sessions</h3>
              {sessions.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No sessions yet.</p>
              ) : (
                sessions.map(s => {
                  const start = new Date(s.startedAt);
                  const end = s.endedAt ? new Date(s.endedAt) : null;
                  const duration = end ? Math.round((end.getTime() - start.getTime()) / 60000) : null;
                  return (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: 14 }}>{start.toLocaleDateString()}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {s.mode} — {s.cardsReviewed} cards{duration !== null ? ` — ${duration}m` : ''}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Export/Import */}
            <div className="card">
              <h3 style={{ fontSize: 14, marginBottom: 12, color: 'var(--text-muted)' }}>Data</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-ghost" onClick={handleExport}>Export Backup</button>
                <button className="btn-ghost" onClick={handleImport}>Import</button>
              </div>
              {importResult && <p style={{ marginTop: 8, fontSize: 13, color: 'var(--accent)' }}>{importResult}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
