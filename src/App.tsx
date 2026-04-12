import { HashRouter, Routes, Route } from 'react-router-dom';
import { DatabaseProvider } from './hooks/useDatabase';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import NodesPage from './pages/NodesPage';
import ReviewPage from './pages/ReviewPage';

export default function App() {
  return (
    <HashRouter>
      <DatabaseProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="nodes" element={<NodesPage />} />
            <Route path="review" element={<ReviewPage />} />
          </Route>
        </Routes>
      </DatabaseProvider>
    </HashRouter>
  );
}
