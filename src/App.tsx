import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { QuickAdd } from './pages/QuickAdd';
import { Overview } from './pages/Overview';
import { ExportPage } from './pages/ExportPage';
import { Settings } from './pages/Settings';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<QuickAdd />} />
        <Route path="overview" element={<Overview />} />
        <Route path="export" element={<ExportPage />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
