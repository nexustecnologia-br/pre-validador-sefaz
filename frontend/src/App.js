import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Validacao from './pages/Validacao';
import './styles/index.css';
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    if (!isAuthenticated || !user) {
        return _jsx(Navigate, { to: "/login" });
    }
    return _jsx(_Fragment, { children: children });
};
function App() {
    const { isAuthenticated, user, logout } = useAuth();
    return (_jsxs(BrowserRouter, { children: [isAuthenticated && user && (_jsx("nav", { className: "bg-white border-b border-gray-200 sticky top-0 z-50", children: _jsxs("div", { className: "max-w-6xl mx-auto px-4 py-4 flex justify-between items-center", children: [_jsx("div", { className: "font-bold text-lg text-primary-600", children: "PRE_VALIDADOR_SEFAZ" }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsx("span", { className: "text-gray-600 text-sm", children: user.nome }), _jsx("button", { onClick: logout, className: "btn-secondary text-sm", children: "Sair" })] })] }) })), _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsx(Route, { path: "/dashboard", element: _jsx(ProtectedRoute, { children: _jsx(Dashboard, {}) }) }), _jsx(Route, { path: "/validacao", element: _jsx(ProtectedRoute, { children: _jsx(Validacao, {}) }) }), _jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/dashboard" }) })] })] }));
}
export default App;
