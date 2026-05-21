import { useState, useCallback } from 'react';
import apiClient from '../services/api';

export interface ValidationError {
  id: string;
  tipo: string;
  descricao: string;
  severidade: 'critico' | 'aviso';
  sugestao: string;
  campo: string;
}

export interface ValidationResult {
  status: 'aprovado' | 'rejeitado';
  message: string;
  validacaoId: string;
  erros?: ValidationError[];
  tempoProcessamento: number;
  nf?: {
    numero: string;
    dataEmissao: string;
    valor: number;
    cfop: number;
  };
}

export interface Validacao {
  id: string;
  status: 'pendente' | 'processando' | 'aprovado' | 'rejeitado';
  nfe?: string;
  dataEmissao?: string;
  valor: number;
  tempoProcessamento: number;
  erros?: ValidationError[];
  criadoEm: string;
}

export const useValidation = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validar = useCallback(
    async (xmlContent: string, empresaId: string): Promise<ValidationResult | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await apiClient.validar(xmlContent, empresaId);
        return result;
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.message ||
          err.message ||
          'Erro ao validar XML';
        setError(errorMessage);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const getValidacao = useCallback(
    async (id: string): Promise<Validacao | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await apiClient.getValidacao(id);
        return result;
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.message ||
          err.message ||
          'Erro ao buscar validação';
        setError(errorMessage);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const getMinhasValidacoes = useCallback(
    async (page: number = 1, limit: number = 20, status?: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await apiClient.getMinhasValidacoes(page, limit, status);
        return result;
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.message ||
          err.message ||
          'Erro ao buscar validações';
        setError(errorMessage);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const downloadXML = useCallback(async (validacaoId: string) => {
    try {
      const blob = await apiClient.downloadXML(validacaoId);
      await apiClient.downloadFile(blob, `validacao-${validacaoId}.xml`);
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao fazer download';
      setError(errorMessage);
    }
  }, []);

  return {
    isLoading,
    error,
    validar,
    getValidacao,
    getMinhasValidacoes,
    downloadXML,
  };
};
