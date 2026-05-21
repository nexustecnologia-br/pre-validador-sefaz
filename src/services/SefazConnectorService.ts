/**
 * SEFAZ API Connector with Circuit Breaker Pattern
 * Resilient integration with SEFAZ-RS validation service
 *
 * Circuit Breaker States:
 * - CLOSED: Normal operation, all requests pass through
 * - OPEN: Failures detected, fast-fail all requests for timeout duration
 * - HALF_OPEN: Testing recovery, limited requests allowed
 *
 * Performance: <100ms p95 on success, <10ms on circuit open (fast-fail)
 */

import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Failures before opening (default: 5)
  resetTimeout: number; // Milliseconds before attempting recovery (default: 60000 = 1min)
  halfOpenRequests: number; // Requests allowed in HALF_OPEN state (default: 3)
  requestTimeout: number; // Request timeout in milliseconds (default: 30000 = 30s)
}

export interface SefazResponse {
  numeroProtocolo: string;
  statusValidacao: 'APROVADO' | 'REJEITADO' | 'PENDENTE';
  mensagens: string[];
  timestamp: string;
}

export interface SefazValidationRequest {
  nfeXml: string;
  ambient: 'producao' | 'homologacao';
  cnpjEmitente: string;
}

export class CircuitBreakerError extends Error {
  constructor(message: string, public state: CircuitState) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export class SefazConnectorService {
  private client: AxiosInstance;
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private config: Required<CircuitBreakerConfig>;

  constructor(
    baseURL: string = process.env.SEFAZ_API_URL || 'https://sefaz.sefazrs.example.com/api',
    config: Partial<CircuitBreakerConfig> = {}
  ) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      resetTimeout: config.resetTimeout ?? 60000, // 1 minute
      halfOpenRequests: config.halfOpenRequests ?? 3,
      requestTimeout: config.requestTimeout ?? 30000, // 30 seconds
    };

    this.client = axios.create({
      baseURL,
      timeout: this.config.requestTimeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'PRE_VALIDADOR_SEFAZ/2.0',
      },
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        this.onSuccess();
        return response;
      },
      (error) => {
        this.onFailure();
        throw error;
      }
    );

    logger.info('SefazConnectorService initialized', {
      baseURL,
      config: this.config,
    });
  }

  /**
   * Validate NF-e via SEFAZ API
   * Implements circuit breaker logic for resilience
   */
  async validarNFe(request: SefazValidationRequest): Promise<SefazResponse> {
    const startTime = Date.now();

    // Check circuit state
    if (this.state === CircuitState.OPEN) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;

      if (timeSinceLastFailure < this.config.resetTimeout) {
        // Circuit still open, fast-fail
        const error = new CircuitBreakerError(
          `Circuit breaker OPEN. Retry after ${this.config.resetTimeout - timeSinceLastFailure}ms`,
          CircuitState.OPEN
        );
        logger.warn('Circuit breaker OPEN - fast-fail', { error: error.message });
        throw error;
      } else {
        // Timeout expired, transition to HALF_OPEN
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        logger.info('Circuit breaker transitioning to HALF_OPEN');
      }
    }

    // Enforce request limit in HALF_OPEN state
    if (this.state === CircuitState.HALF_OPEN && this.successCount >= this.config.halfOpenRequests) {
      const error = new CircuitBreakerError(
        `Circuit breaker HALF_OPEN request limit exceeded (${this.config.halfOpenRequests} allowed)`,
        CircuitState.HALF_OPEN
      );
      throw error;
    }

    try {
      const response = await this.client.post<SefazResponse>('/validar', request);
      const duration = Date.now() - startTime;

      logger.info('SEFAZ validation successful', {
        numeroProtocolo: response.data.numeroProtocolo,
        duration,
        circuitState: this.state,
      });

      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('SEFAZ validation failed', {
        error: error instanceof Error ? error.message : String(error),
        duration,
        circuitState: this.state,
      });

      throw error;
    }
  }

  /**
   * Get validation status by protocol number
   * Lightweight status check without full validation
   */
  async getProtocolStatus(numeroProtocolo: string): Promise<{
    status: string;
    lastUpdate: string;
  }> {
    if (this.state === CircuitState.OPEN) {
      throw new CircuitBreakerError(
        `Circuit breaker OPEN. Cannot fetch status.`,
        CircuitState.OPEN
      );
    }

    try {
      const response = await this.client.get('/protocol/' + numeroProtocolo);
      this.onSuccess();
      return response.data;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Health check: Verify SEFAZ API availability
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', {
        timeout: 5000, // 5s timeout for health check
      });
      this.onSuccess();
      return response.status === 200;
    } catch (error) {
      this.onFailure();
      logger.warn('SEFAZ health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Record successful request
   * Increments success count and may close circuit if HALF_OPEN
   */
  private onSuccess(): void {
    this.failureCount = 0;
    this.successCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successCount >= this.config.halfOpenRequests) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        logger.info('Circuit breaker CLOSED - service recovered');
      }
    }
  }

  /**
   * Record failed request
   * Increments failure count and may open circuit if threshold exceeded
   */
  private onFailure(): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;
    this.successCount = 0;

    if (this.failureCount >= this.config.failureThreshold && this.state !== CircuitState.OPEN) {
      this.state = CircuitState.OPEN;
      logger.error('Circuit breaker OPEN - failure threshold exceeded', {
        failureCount: this.failureCount,
        threshold: this.config.failureThreshold,
      });
    }
  }

  /**
   * Get current circuit state
   */
  getState(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  /**
   * Manual circuit reset (for testing/admin use)
   */
  resetCircuit(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    logger.info('Circuit breaker manually reset to CLOSED');
  }
}

// Singleton instance
let sefazConnectorInstance: SefazConnectorService | null = null;

export function getSefazConnector(): SefazConnectorService {
  if (!sefazConnectorInstance) {
    sefazConnectorInstance = new SefazConnectorService();
  }
  return sefazConnectorInstance;
}

export function initializeSefazConnector(
  baseURL?: string,
  config?: Partial<CircuitBreakerConfig>
): SefazConnectorService {
  sefazConnectorInstance = new SefazConnectorService(baseURL, config);
  return sefazConnectorInstance;
}
