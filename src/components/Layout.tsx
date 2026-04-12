import { NavLink, Outlet } from 'react-router-dom';
import { useDatabase } from '../hooks/useDatabase';

export default function Layout() {
  const { ready, error } = useDatabase();

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>
        <h2>Database Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading database...
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
              Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink to="/nodes" className={({ isActive }) => isActive ? 'active' : ''}>
              Knowledge Nodes
            </NavLink>
          </li>
          <li>
            <NavLink to="/review" className={({ isActive }) => isActive ? 'active' : ''}>
              Review
            </NavLink>
          </li>
        </ul>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
