import { useState, useCallback } from 'react';
import apiClient from '../services/api';
export const useValidation = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const validar = useCallback(async (xmlContent, empresaId) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await apiClient.validar(xmlContent, empresaId);
            return result;
        }
        catch (err) {
            const errorMessage = err.response?.data?.message ||
                err.message ||
                'Erro ao validar XML';
            setError(errorMessage);
            return null;
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    const getValidacao = useCallback(async (id) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await apiClient.getValidacao(id);
            return result;
        }
        catch (err) {
            const errorMessage = err.response?.data?.message ||
                err.message ||
                'Erro ao buscar validação';
            setError(errorMessage);
            return null;
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    const getMinhasValidacoes = useCallback(async (page = 1, limit = 20, status) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await apiClient.getMinhasValidacoes(page, limit, status);
            return result;
        }
        catch (err) {
            const errorMessage = err.response?.data?.message ||
                err.message ||
                'Erro ao buscar validações';
            setError(errorMessage);
            return null;
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    const downloadXML = useCallback(async (validacaoId) => {
        try {
            const blob = await apiClient.downloadXML(validacaoId);
            await apiClient.downloadFile(blob, `validacao-${validacaoId}.xml`);
        }
        catch (err) {
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
