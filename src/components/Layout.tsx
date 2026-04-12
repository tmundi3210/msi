import { NavLink, Outlet } from 'react-router-dom';
import { useDatabase } from '../hooks/useDatabase';
import { useEffect, useState } from 'react';
import { getStats } from '../db/database';

export default function Layout() {
  const { ready, error, version } = useDatabase();
  const [stats, setStats] = useState({ totalNodes: 0, totalCards: 0, dueNow: 0, reviewedToday: 0, streak: 0 });

  useEffect(() => {
    if (ready) setStats(getStats());
  }, [ready, version]);

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2 style={{ color: 'var(--danger)', marginBottom: 8 }}>Database Error</h2>
        <p style={{ color: 'var(--text-muted)' }}>{error}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading database...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">Learning OS</div>
        <ul className="sidebar-nav">
          <li>
            <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
              <span>Dashboard</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/nodes" className={({ isActive }) => isActive ? 'active' : ''}>
              <span>Nodes</span>
              {stats.totalNodes > 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stats.totalNodes}</span>}
            </NavLink>
          </li>
          <li>
            <NavLink to="/cards" className={({ isActive }) => isActive ? 'active' : ''}>
              <span>Cards</span>
              {stats.totalCards > 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stats.totalCards}</span>}
            </NavLink>
          </li>
          <li>
            <NavLink to="/map" className={({ isActive }) => isActive ? 'active' : ''}>
              <span>Mind Map</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/review" className={({ isActive }) => isActive ? 'active' : ''}>
              <span>Review</span>
              {stats.dueNow > 0 && <span className="nav-badge">{stats.dueNow}</span>}
            </NavLink>
          </li>
        </ul>
        <div className="sidebar-footer">
          <div className="sidebar-stat">
            <span>Streak</span>
            <span>{stats.streak}d</span>
          </div>
          <div className="sidebar-stat">
            <span>Today</span>
            <span>{stats.reviewedToday}</span>
          </div>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
