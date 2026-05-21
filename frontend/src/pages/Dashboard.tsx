import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useValidation } from '../hooks/useValidation';
import { useAuth } from '../hooks/useAuth';

export const Dashboard = () => {
  const { user } = useAuth();
  const { getMinhasValidacoes, downloadXML, isLoading } = useValidation();

  const [validacoes, setValidacoes] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const fetchValidacoes = async (page: number = 1) => {
    const result = await getMinhasValidacoes(page, 20, statusFilter);
    if (result) {
      setValidacoes(result.data || []);
      setPagination(result.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
    }
  };

  useEffect(() => {
    fetchValidacoes();
  }, [statusFilter]);

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: string } = {
      aprovado: 'badge-success',
      rejeitado: 'badge-danger',
      pendente: 'inline-block px-3 py-1 bg-yellow-50 text-yellow-600 rounded-full text-sm font-medium',
    };
    return badges[status] || 'badge-danger';
  };

  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      aprovado: '✅ Aprovado',
      rejeitado: '❌ Rejeitado',
      pendente: '⏳ Pendente',
    };
    return labels[status] || status;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Bem-vindo, {user?.nome}!
            </h1>
            <p className="text-gray-600 mt-1">
              {user?.role === 'admin' ? 'Administrador' : 'Usuário'}
            </p>
          </div>
          <Link to="/validacao" className="btn-primary">
            ➕ Nova Validação
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <p className="text-gray-500 text-sm mb-2">Total de Validações</p>
            <p className="text-4xl font-bold text-primary-600">
              {pagination.total}
            </p>
          </div>

          <div className="card">
            <p className="text-gray-500 text-sm mb-2">Taxa de Sucesso</p>
            <p className="text-4xl font-bold text-success-600">
              {pagination.total > 0
                ? (
                    (validacoes.filter((v) => v.status === 'aprovado').length /
                      pagination.total) *
                    100
                  ).toFixed(0)
                : 0}
              %
            </p>
          </div>

          <div className="card">
            <p className="text-gray-500 text-sm mb-2">Tempo Médio</p>
            <p className="text-4xl font-bold text-gray-900">
              {validacoes.length > 0
                ? (
                    validacoes.reduce((sum, v) => sum + (v.tempoProcessamento || 0), 0) /
                    validacoes.length
                  ).toFixed(0)
                : 0}
              ms
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setStatusFilter(undefined)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              !statusFilter
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setStatusFilter('aprovado')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              statusFilter === 'aprovado'
                ? 'bg-success-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ✅ Aprovadas
          </button>
          <button
            onClick={() => setStatusFilter('rejeitado')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              statusFilter === 'rejeitado'
                ? 'bg-danger-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ❌ Rejeitadas
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-danger-50 border border-danger-200 rounded-lg">
            <p className="text-danger-600 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Table */}
        <div className="card overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : validacoes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">Nenhuma validação encontrada</p>
              <Link to="/validacao" className="btn-primary">
                Criar Primeira Validação
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-6 py-3 text-gray-700 font-semibold">
                    NF-e
                  </th>
                  <th className="text-left px-6 py-3 text-gray-700 font-semibold">
                    Status
                  </th>
                  <th className="text-left px-6 py-3 text-gray-700 font-semibold">
                    Valor
                  </th>
                  <th className="text-left px-6 py-3 text-gray-700 font-semibold">
                    Tempo
                  </th>
                  <th className="text-left px-6 py-3 text-gray-700 font-semibold">
                    Data
                  </th>
                  <th className="text-left px-6 py-3 text-gray-700 font-semibold">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {validacoes.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-gray-200 hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 text-gray-900 font-medium">
                      {v.nfe || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={getStatusBadge(v.status)}>
                        {getStatusLabel(v.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-900">
                      R$ {(v.valor || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-gray-900">
                      {v.tempoProcessamento}ms
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm">
                      {new Date(v.criadoEm).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 space-x-2">
                      <Link
                        to={`/validacao/${v.id}`}
                        className="text-primary-600 hover:underline text-sm font-medium"
                      >
                        Ver Detalhes
                      </Link>
                      <button
                        onClick={() => downloadXML(v.id)}
                        className="text-gray-600 hover:underline text-sm font-medium"
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={() => fetchValidacoes(Math.max(1, pagination.page - 1))}
              disabled={pagination.page === 1}
              className="btn-secondary disabled:opacity-50"
            >
              ← Anterior
            </button>
            {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(
              (page) => (
                <button
                  key={page}
                  onClick={() => fetchValidacoes(page)}
                  className={`px-3 py-2 rounded-lg font-medium ${
                    page === pagination.page
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {page}
                </button>
              )
            )}
            <button
              onClick={() =>
                fetchValidacoes(Math.min(pagination.pages, pagination.page + 1))
              }
              disabled={pagination.page === pagination.pages}
              className="btn-secondary disabled:opacity-50"
            >
              Próxima →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
