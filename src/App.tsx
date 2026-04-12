import { HashRouter, Routes, Route } from 'react-router-dom';
import { DatabaseProvider } from './hooks/useDatabase';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import NodesPage from './pages/NodesPage';
import CardsPage from './pages/CardsPage';
import MindMapPage from './pages/MindMapPage';
import ReviewPage from './pages/ReviewPage';

export default function App() {
  return (
    <HashRouter>
      <DatabaseProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="nodes" element={<NodesPage />} />
            <Route path="cards" element={<CardsPage />} />
            <Route path="map" element={<MindMapPage />} />
            <Route path="review" element={<ReviewPage />} />
          </Route>
        </Routes>
      </DatabaseProvider>
    </HashRouter>
  );
}
