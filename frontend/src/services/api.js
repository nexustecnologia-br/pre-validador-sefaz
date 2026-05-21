import axios from 'axios';
class ApiClient {
    constructor() {
        Object.defineProperty(this, "client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "token", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.client = axios.create({
            baseURL: '/api',
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        // Interceptor para adicionar token
        this.client.interceptors.request.use((config) => {
            const token = this.getToken();
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        });
        // Interceptor para erros
        this.client.interceptors.response.use((response) => response, (error) => {
            if (error.response?.status === 401) {
                this.clearToken();
                window.location.href = '/login';
            }
            return Promise.reject(error);
        });
        // Carregar token do localStorage
        this.token = this.getToken();
    }
    getToken() {
        return localStorage.getItem('token');
    }
    setToken(token) {
        this.token = token;
        localStorage.setItem('token', token);
    }
    clearToken() {
        this.token = null;
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
    }
    // ============================================
    // AUTH ENDPOINTS
    // ============================================
    async login(email, senha) {
        const response = await this.client.post('/auth/login', { email, senha });
        if (response.data.data.token) {
            this.setToken(response.data.data.token);
        }
        return response.data;
    }
    async logout() {
        try {
            await this.client.post('/auth/logout');
        }
        finally {
            this.clearToken();
        }
    }
    async refreshToken() {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken)
            throw new Error('No refresh token');
        const response = await this.client.post('/auth/refresh', { refreshToken });
        if (response.data.data.token) {
            this.setToken(response.data.data.token);
        }
        return response.data;
    }
    async getMe() {
        const response = await this.client.get('/auth/me');
        return response.data.data;
    }
    // ============================================
    // VALIDATION ENDPOINTS
    // ============================================
    async validar(xmlContent, empresaId) {
        const response = await this.client.post('/validar', { xmlContent, empresaId });
        return response.data;
    }
    async getValidacao(id) {
        const response = await this.client.get(`/validacao/${id}`);
        return response.data.data;
    }
    async getMinhasValidacoes(page = 1, limit = 20, status, dataInicio, dataFim) {
        const params = new URLSearchParams({
            page: String(page),
            limit: String(limit),
        });
        if (status)
            params.append('status', status);
        if (dataInicio)
            params.append('dataInicio', dataInicio);
        if (dataFim)
            params.append('dataFim', dataFim);
        const response = await this.client.get(`/validacoes/minhas?${params}`);
        return response.data;
    }
    async downloadXML(validacaoId) {
        const response = await this.client.get(`/download/${validacaoId}/xml`, {
            responseType: 'blob',
        });
        return response.data;
    }
    // ============================================
    // UTILITY METHODS
    // ============================================
    isAuthenticated() {
        return !!this.token;
    }
    async downloadFile(blob, filename) {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    }
}
export const apiClient = new ApiClient();
export default apiClient;
