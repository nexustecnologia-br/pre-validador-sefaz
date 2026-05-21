import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Validacao from './pages/Validacao';
import './styles/index.css';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
};

function App() {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <BrowserRouter>
      {isAuthenticated && user && (
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="font-bold text-lg text-primary-600">
              PRE_VALIDADOR_SEFAZ
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-600 text-sm">
                {user.nome}
              </span>
              <button
                onClick={logout}
                className="btn-secondary text-sm"
              >
                Sair
              </button>
            </div>
          </div>
        </nav>
      )}

      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/validacao"
          element={
            <ProtectedRoute>
              <Validacao />
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
