import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoadingDotsText } from './components/LoadingDotsText';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { TeamsPage } from './pages/TeamsPage';
import { WorkspacePage } from './pages/WorkspacePage';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="desktop-shell" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="win-window" style={{ padding: 20 }}>
          <LoadingDotsText text="Aguarde um momento" />
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/teams" replace /> : <AuthPage />} />
      <Route path="/teams" element={user ? <TeamsPage /> : <Navigate to="/auth" replace />} />
      <Route
        path="/board/:boardId"
        element={user ? <WorkspacePage /> : <Navigate to="/auth" replace />}
      />
      <Route path="*" element={<Navigate to={user ? '/teams' : '/auth'} replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
