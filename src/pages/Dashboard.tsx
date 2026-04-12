import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDatabase } from '../hooks/useDatabase';
import { getStats, getRecentSessions } from '../db/database';
import type { Session } from '../types';

export default function Dashboard() {
  const { version } = useDatabase();
  const [stats, setStats] = useState({ totalNodes: 0, totalCards: 0, dueNow: 0, reviewedToday: 0 });
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    setStats(getStats());
    setSessions(getRecentSessions(5));
  }, [version]);

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        {stats.dueNow > 0 && (
          <Link to="/review">
            <button className="btn-primary">Review {stats.dueNow} due cards</button>
          </Link>
        )}
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Knowledge Nodes</div>
          <div className="stat-value">{stats.totalNodes}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Flashcards</div>
          <div className="stat-value">{stats.totalCards}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Due Now</div>
          <div className="stat-value" style={{ color: stats.dueNow > 0 ? 'var(--recall-hot)' : 'var(--recall-cold)' }}>
            {stats.dueNow}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Reviewed Today</div>
          <div className="stat-value" style={{ color: 'var(--recall-cold)' }}>
            {stats.reviewedToday}
          </div>
        </div>
      </div>

      {stats.totalNodes === 0 ? (
        <div className="empty-state">
          <h2>Get started</h2>
          <p>Create your first knowledge node and add some flashcards to begin.</p>
          <Link to="/nodes" style={{ marginTop: 16, display: 'inline-block' }}>
            <button className="btn-primary">Create a Node</button>
          </Link>
        </div>
      ) : (
        <>
          <h2 style={{ marginBottom: 16 }}>Recent Sessions</h2>
          {sessions.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No sessions yet. Start a review to begin tracking.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Mode</th>
                  <th>Cards Reviewed</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => {
                  const start = new Date(s.startedAt);
                  const end = s.endedAt ? new Date(s.endedAt) : null;
                  const duration = end ? Math.round((end.getTime() - start.getTime()) / 60000) : null;
                  return (
                    <tr key={s.id}>
                      <td>{start.toLocaleDateString()} {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td>{s.mode}</td>
                      <td>{s.cardsReviewed}</td>
                      <td>{duration !== null ? `${duration}m` : 'In progress'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
