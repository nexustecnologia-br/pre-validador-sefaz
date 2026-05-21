import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useValidation } from '../hooks/useValidation';
import { useAuth } from '../hooks/useAuth';
export const Dashboard = () => {
    const { user } = useAuth();
    const { getMinhasValidacoes, downloadXML, isLoading } = useValidation();
    const [validacoes, setValidacoes] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
    const [statusFilter, setStatusFilter] = useState();
    const [error, setError] = useState(null);
    const fetchValidacoes = async (page = 1) => {
        const result = await getMinhasValidacoes(page, 20, statusFilter);
        if (result) {
            setValidacoes(result.data || []);
            setPagination(result.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
        }
    };
    useEffect(() => {
        fetchValidacoes();
    }, [statusFilter]);
    const getStatusBadge = (status) => {
        const badges = {
            aprovado: 'badge-success',
            rejeitado: 'badge-danger',
            pendente: 'inline-block px-3 py-1 bg-yellow-50 text-yellow-600 rounded-full text-sm font-medium',
        };
        return badges[status] || 'badge-danger';
    };
    const getStatusLabel = (status) => {
        const labels = {
            aprovado: '✅ Aprovado',
            rejeitado: '❌ Rejeitado',
            pendente: '⏳ Pendente',
        };
        return labels[status] || status;
    };
    return (_jsxs("div", { className: "min-h-screen bg-gray-50", children: [_jsx("div", { className: "bg-white border-b border-gray-200", children: _jsxs("div", { className: "max-w-6xl mx-auto px-4 py-6 flex justify-between items-center", children: [_jsxs("div", { children: [_jsxs("h1", { className: "text-3xl font-bold text-gray-900", children: ["Bem-vindo, ", user?.nome, "!"] }), _jsx("p", { className: "text-gray-600 mt-1", children: user?.role === 'admin' ? 'Administrador' : 'Usuário' })] }), _jsx(Link, { to: "/validacao", className: "btn-primary", children: "\u2795 Nova Valida\u00E7\u00E3o" })] }) }), _jsxs("div", { className: "max-w-6xl mx-auto px-4 py-8", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6 mb-8", children: [_jsxs("div", { className: "card", children: [_jsx("p", { className: "text-gray-500 text-sm mb-2", children: "Total de Valida\u00E7\u00F5es" }), _jsx("p", { className: "text-4xl font-bold text-primary-600", children: pagination.total })] }), _jsxs("div", { className: "card", children: [_jsx("p", { className: "text-gray-500 text-sm mb-2", children: "Taxa de Sucesso" }), _jsxs("p", { className: "text-4xl font-bold text-success-600", children: [pagination.total > 0
                                                ? ((validacoes.filter((v) => v.status === 'aprovado').length /
                                                    pagination.total) *
                                                    100).toFixed(0)
                                                : 0, "%"] })] }), _jsxs("div", { className: "card", children: [_jsx("p", { className: "text-gray-500 text-sm mb-2", children: "Tempo M\u00E9dio" }), _jsxs("p", { className: "text-4xl font-bold text-gray-900", children: [validacoes.length > 0
                                                ? (validacoes.reduce((sum, v) => sum + (v.tempoProcessamento || 0), 0) /
                                                    validacoes.length).toFixed(0)
                                                : 0, "ms"] })] })] }), _jsxs("div", { className: "mb-6 flex gap-2", children: [_jsx("button", { onClick: () => setStatusFilter(undefined), className: `px-4 py-2 rounded-lg font-medium transition ${!statusFilter
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`, children: "Todas" }), _jsx("button", { onClick: () => setStatusFilter('aprovado'), className: `px-4 py-2 rounded-lg font-medium transition ${statusFilter === 'aprovado'
                                    ? 'bg-success-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`, children: "\u2705 Aprovadas" }), _jsx("button", { onClick: () => setStatusFilter('rejeitado'), className: `px-4 py-2 rounded-lg font-medium transition ${statusFilter === 'rejeitado'
                                    ? 'bg-danger-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`, children: "\u274C Rejeitadas" })] }), error && (_jsx("div", { className: "mb-6 p-4 bg-danger-50 border border-danger-200 rounded-lg", children: _jsx("p", { className: "text-danger-600 text-sm font-medium", children: error }) })), _jsx("div", { className: "card overflow-x-auto", children: isLoading ? (_jsx("div", { className: "flex justify-center items-center py-12", children: _jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" }) })) : validacoes.length === 0 ? (_jsxs("div", { className: "text-center py-12", children: [_jsx("p", { className: "text-gray-500 mb-4", children: "Nenhuma valida\u00E7\u00E3o encontrada" }), _jsx(Link, { to: "/validacao", className: "btn-primary", children: "Criar Primeira Valida\u00E7\u00E3o" })] })) : (_jsxs("table", { className: "w-full", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-gray-200", children: [_jsx("th", { className: "text-left px-6 py-3 text-gray-700 font-semibold", children: "NF-e" }), _jsx("th", { className: "text-left px-6 py-3 text-gray-700 font-semibold", children: "Status" }), _jsx("th", { className: "text-left px-6 py-3 text-gray-700 font-semibold", children: "Valor" }), _jsx("th", { className: "text-left px-6 py-3 text-gray-700 font-semibold", children: "Tempo" }), _jsx("th", { className: "text-left px-6 py-3 text-gray-700 font-semibold", children: "Data" }), _jsx("th", { className: "text-left px-6 py-3 text-gray-700 font-semibold", children: "A\u00E7\u00F5es" })] }) }), _jsx("tbody", { children: validacoes.map((v) => (_jsxs("tr", { className: "border-b border-gray-200 hover:bg-gray-50", children: [_jsx("td", { className: "px-6 py-4 text-gray-900 font-medium", children: v.nfe || '-' }), _jsx("td", { className: "px-6 py-4", children: _jsx("span", { className: getStatusBadge(v.status), children: getStatusLabel(v.status) }) }), _jsxs("td", { className: "px-6 py-4 text-gray-900", children: ["R$ ", (v.valor || 0).toFixed(2)] }), _jsxs("td", { className: "px-6 py-4 text-gray-900", children: [v.tempoProcessamento, "ms"] }), _jsx("td", { className: "px-6 py-4 text-gray-600 text-sm", children: new Date(v.criadoEm).toLocaleDateString('pt-BR') }), _jsxs("td", { className: "px-6 py-4 space-x-2", children: [_jsx(Link, { to: `/validacao/${v.id}`, className: "text-primary-600 hover:underline text-sm font-medium", children: "Ver Detalhes" }), _jsx("button", { onClick: () => downloadXML(v.id), className: "text-gray-600 hover:underline text-sm font-medium", children: "Download" })] })] }, v.id))) })] })) }), pagination.pages > 1 && (_jsxs("div", { className: "mt-6 flex justify-center gap-2", children: [_jsx("button", { onClick: () => fetchValidacoes(Math.max(1, pagination.page - 1)), disabled: pagination.page === 1, className: "btn-secondary disabled:opacity-50", children: "\u2190 Anterior" }), Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (_jsx("button", { onClick: () => fetchValidacoes(page), className: `px-3 py-2 rounded-lg font-medium ${page === pagination.page
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`, children: page }, page))), _jsx("button", { onClick: () => fetchValidacoes(Math.min(pagination.pages, pagination.page + 1)), disabled: pagination.page === pagination.pages, className: "btn-secondary disabled:opacity-50", children: "Pr\u00F3xima \u2192" })] }))] })] }));
};
export default Dashboard;
