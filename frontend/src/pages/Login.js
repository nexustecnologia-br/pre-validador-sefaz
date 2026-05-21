import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
export const Login = () => {
    const navigate = useNavigate();
    const { login, isLoading, error } = useAuth();
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [localError, setLocalError] = useState(null);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError(null);
        if (!email || !senha) {
            setLocalError('Email e senha são obrigatórios');
            return;
        }
        const success = await login(email, senha);
        if (success) {
            navigate('/dashboard');
        }
        else {
            setLocalError(error || 'Erro ao fazer login');
        }
    };
    return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center px-4", children: _jsx("div", { className: "w-full max-w-md", children: _jsxs("div", { className: "card bg-white", children: [_jsxs("div", { className: "mb-8 text-center", children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900 mb-2", children: "PRE_VALIDADOR_SEFAZ" }), _jsx("p", { className: "text-gray-500", children: "Sistema de Pr\u00E9-Valida\u00E7\u00E3o de Notas Fiscais" })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [(localError || error) && (_jsx("div", { className: "p-4 bg-danger-50 border border-danger-200 rounded-lg", children: _jsx("p", { className: "text-danger-600 text-sm font-medium", children: localError || error }) })), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Email" }), _jsx("input", { type: "email", value: email, onChange: (e) => setEmail(e.target.value), className: "input-field", placeholder: "seu@email.com", disabled: isLoading })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Senha" }), _jsx("input", { type: "password", value: senha, onChange: (e) => setSenha(e.target.value), className: "input-field", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", disabled: isLoading })] }), _jsx("button", { type: "submit", disabled: isLoading, className: "w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed", children: isLoading ? 'Entrando...' : 'Entrar' })] }), _jsxs("div", { className: "mt-6 pt-6 border-t border-gray-200", children: [_jsx("p", { className: "text-center text-sm text-gray-500", children: "Usu\u00E1rios de teste:" }), _jsxs("div", { className: "mt-2 space-y-1 text-xs text-gray-600", children: [_jsxs("p", { children: [_jsx("strong", { children: "Admin:" }), " admin@example.com / senha123"] }), _jsxs("p", { children: [_jsx("strong", { children: "Usu\u00E1rio:" }), " user@example.com / senha123"] })] })] })] }) }) }));
};
export default Login;
