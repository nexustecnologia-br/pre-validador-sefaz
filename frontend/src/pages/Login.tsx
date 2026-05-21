import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const Login = () => {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuth();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email || !senha) {
      setLocalError('Email e senha são obrigatórios');
      return;
    }

    const success = await login(email, senha);
    if (success) {
      navigate('/dashboard');
    } else {
      setLocalError(error || 'Erro ao fazer login');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="card bg-white">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              PRE_VALIDADOR_SEFAZ
            </h1>
            <p className="text-gray-500">
              Sistema de Pré-Validação de Notas Fiscais
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {(localError || error) && (
              <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg">
                <p className="text-danger-600 text-sm font-medium">
                  {localError || error}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="seu@email.com"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Senha
              </label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-gray-500">
              Usuários de teste:
            </p>
            <div className="mt-2 space-y-1 text-xs text-gray-600">
              <p>
                <strong>Admin:</strong> admin@example.com / senha123
              </p>
              <p>
                <strong>Usuário:</strong> user@example.com / senha123
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
