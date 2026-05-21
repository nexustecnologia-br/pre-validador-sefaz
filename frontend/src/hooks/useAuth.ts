import { useState, useCallback, useEffect } from 'react';
import apiClient from '../services/api';

export interface User {
  id: string;
  email: string;
  nome: string;
  role: 'admin' | 'usuario';
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  usuario: User;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar usuário ao montar
  useEffect(() => {
    const loadUser = async () => {
      if (apiClient.isAuthenticated()) {
        try {
          const userData = await apiClient.getMe();
          setUser(userData);
        } catch (err) {
          apiClient.clearToken();
          setUser(null);
        }
      }
    };

    loadUser();
  }, []);

  const login = useCallback(
    async (email: string, senha: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiClient.login(email, senha);
        const { usuario, refreshToken } = response.data;

        setUser(usuario);
        localStorage.setItem('refreshToken', refreshToken);

        return true;
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.message ||
          err.message ||
          'Erro ao fazer login';
        setError(errorMessage);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    setIsLoading(true);

    try {
      await apiClient.logout();
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const isAuthenticated = !!user;

  return {
    user,
    isLoading,
    error,
    login,
    logout,
    isAuthenticated,
  };
};
