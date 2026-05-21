import Queue from 'bull';
import logger from '../utils/logger';
import { getDataSource } from '../index';
import { AuditLog } from '../models/AuditLog';

interface AuditEvent {
  usuarioId?: string;
  empresaId?: string;
  acao: 'criar' | 'ler' | 'atualizar' | 'deletar' | 'validar' | 'enviar' | 'login' | 'logout';
  entidade: string;
  entidadeId?: string;
  descricao?: string;
  dadosAntigos?: any;
  dadosNovos?: any;
  statusSolicitacao?: 'sucesso' | 'erro' | 'pendente';
  mensagemErro?: string;
  ipOrigem?: string;
  userAgent?: string;
}

export class AuditQueueService {
  private auditQueue: Queue.Queue<AuditEvent>;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    this.auditQueue = new Queue('audit-logs', redisUrl, {
      defaultJobOptions: {
        removeOnComplete: {
          age: 3600, // Remove completed jobs after 1 hour
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
        },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    // Process audit events
    this.auditQueue.process(async (job) => {
      return this.processAuditEvent(job.data);
    });

    // Handle queue events
    this.auditQueue.on('completed', (job) => {
      logger.debug(`Audit job ${job.id} completed`, { jobId: job.id });
    });

    this.auditQueue.on('failed', (job, err) => {
      logger.error(`Audit job ${job.id} failed`, {
        jobId: job.id,
        error: err.message,
        data: job.data,
      });
    });
  }

  /**
   * Queue an audit event for processing
   * Returns immediately (non-blocking)
   */
  async queueAudit(event: AuditEvent): Promise<void> {
    try {
      await this.auditQueue.add(event, {
        priority: 5,
        delay: 0, // Process immediately
      });
      logger.debug('Audit event queued', { acao: event.acao, entidade: event.entidade });
    } catch (error) {
      logger.error('Failed to queue audit event', { error, event });
      // Don't throw - audit failure should not block main operations
    }
  }

  /**
   * Process audit event and save to database
   */
  private async processAuditEvent(event: AuditEvent): Promise<void> {
    try {
      const dataSource = getDataSource();
      const auditLogRepository = dataSource.getRepository(AuditLog);

      const auditLog = new AuditLog();
      auditLog.usuarioId = event.usuarioId;
      auditLog.empresaId = event.empresaId;
      auditLog.acao = event.acao;
      auditLog.entidade = event.entidade;
      auditLog.entidadeId = event.entidadeId;
      auditLog.descricao = event.descricao;
      auditLog.dadosAntigos = event.dadosAntigos;
      auditLog.dadosNovos = event.dadosNovos;
      auditLog.statusSolicitacao = event.statusSolicitacao;
      auditLog.mensagemErro = event.mensagemErro;
      auditLog.ipOrigem = event.ipOrigem;
      auditLog.userAgent = event.userAgent;

      await auditLogRepository.save(auditLog);
      logger.debug('Audit event persisted to database', {
        acao: event.acao,
        entidade: event.entidade,
      });
    } catch (error) {
      logger.error('Failed to persist audit event', { error, event });
      throw error; // Retry on database errors
    }
  }

  /**
   * Get audit logs for an entity
   */
  async getAuditLogs(
    entidade?: string,
    entidadeId?: string,
    limit: number = 50
  ): Promise<AuditLog[]> {
    try {
      const dataSource = getDataSource();
      const auditLogRepository = dataSource.getRepository(AuditLog);

      let query = auditLogRepository.createQueryBuilder('audit');

      if (entidade) {
        query = query.where('audit.entidade = :entidade', { entidade });
      }

      if (entidadeId) {
        query = query.andWhere('audit.entidadeId = :entidadeId', { entidadeId });
      }

      return await query
        .orderBy('audit.criadoEm', 'DESC')
        .limit(limit)
        .getMany();
    } catch (error) {
      logger.error('Failed to fetch audit logs', { error });
      return [];
    }
  }

  /**
   * Get queue stats
   */
  async getQueueStats() {
    try {
      const counts = await this.auditQueue.getJobCounts();
      const delayed = await this.auditQueue.getDelayedCount();
      const completed = await this.auditQueue.getCompletedCount();
      const failed = await this.auditQueue.getFailedCount();

      return {
        active: counts.active,
        waiting: counts.waiting,
        delayed,
        completed,
        failed,
        isPaused: this.auditQueue.isPaused(),
      };
    } catch (error) {
      logger.error('Failed to get queue stats', { error });
      return null;
    }
  }

  /**
   * Close queue connection
   */
  async close(): Promise<void> {
    try {
      await this.auditQueue.close();
      logger.info('Audit queue closed');
    } catch (error) {
      logger.error('Failed to close audit queue', { error });
    }
  }
}

// Singleton instance
let auditQueueService: AuditQueueService;

export function getAuditQueueService(): AuditQueueService {
  if (!auditQueueService) {
    auditQueueService = new AuditQueueService();
  }
  return auditQueueService;
}
