import { Request, Response, NextFunction } from 'express';
import { getDataSource } from '../index';
import { ValidationAttempt } from '../models/ValidationAttempt';
import { XMLParserService } from '../services/XMLParserService';
import { RulesEngineService } from '../services/RulesEngineService';
import logger from '../utils/logger';
import { ValidationError, NotFoundError, AppError } from '../utils/errors';
import { getAuditQueueService } from '../services/AuditQueueService';
import { v4 as uuid } from 'uuid';

export class ValidationController {
  private xmlParser: XMLParserService;
  private rulesEngine: RulesEngineService;

  constructor() {
    this.xmlParser = new XMLParserService();
    this.rulesEngine = new RulesEngineService();
  }

  /**
   * POST /api/validar
   * Validar nota fiscal XML
   * Fluxo: XSD Validation (< 10ms) → RulesEngine (< 300ms) → Persist (async)
   */
  async validar(req: Request, res: Response, next: NextFunction) {
    const startTime = performance.now();
    const usuario = (req as any).user;

    try {
      const { xmlContent, empresaId } = req.body;

      // Validação básica
      if (!xmlContent || typeof xmlContent !== 'string') {
        throw new ValidationError('xmlContent é obrigatório e deve ser string');
      }

      if (!empresaId) {
        throw new ValidationError('empresaId é obrigatório');
      }

      const dataSource = getDataSource();
      const validationAttemptRepository = dataSource.getRepository(ValidationAttempt);

      // 1. XSD Validation (< 10ms)
      const validoXSD = this.xmlParser.validateXSD(xmlContent);

      if (!validoXSD) {
        const duracao = performance.now() - startTime;

        const validacao = new ValidationAttempt();
        validacao.id = uuid();
        validacao.empresaId = empresaId;
        validacao.usuarioId = usuario.id;
        validacao.xmlContent = xmlContent;
        validacao.status = 'rejeitado';
        validacao.validoXSD = false;
        validacao.validoRegras = false;
        validacao.tempoProcessamento = Math.round(duracao);
        validacao.erros = [
          {
            id: 'XML_INVALIDO',
            tipo: 'XML_INVALIDO',
            valor: null,
            descricao: 'XML não passou na validação XSD',
            severidade: 'critico',
            sugestao: 'Valide o XML contra a XSD de NFe do Sefaz',
            campo: 'xmlContent',
          },
        ];
        validacao.totalErros = 1;
        validacao.errosCriticos = 1;

        await validationAttemptRepository.save(validacao);

        // Audit
        const auditService = getAuditQueueService();
        await auditService.queueAudit({
          usuarioId: usuario.id,
          empresaId,
          acao: 'validar',
          entidade: 'ValidationAttempt',
          entidadeId: validacao.id,
          descricao: 'Validação rejeitada na etapa XSD',
          statusSolicitacao: 'sucesso',
          ipOrigem: req.ip,
        });

        logger.warn('XML validation failed at XSD stage', {
          validacaoId: validacao.id,
          duracao,
        });

        return res.status(200).json({
          status: 'rejeitado',
          message: 'XML não passou na validação XSD',
          validacaoId: validacao.id,
          erros: validacao.erros,
          tempoProcessamento: validacao.tempoProcessamento,
        });
      }

      // 2. Parse XML (< 50ms)
      const parseResult = await this.xmlParser.parseXML(xmlContent);

      if (Array.isArray(parseResult)) {
        // XML parse error
        const erros = parseResult;
        const duracao = performance.now() - startTime;

        const validacao = new ValidationAttempt();
        validacao.id = uuid();
        validacao.empresaId = empresaId;
        validacao.usuarioId = usuario.id;
        validacao.xmlContent = xmlContent;
        validacao.status = 'rejeitado';
        validacao.validoXSD = true;
        validacao.validoRegras = false;
        validacao.tempoProcessamento = Math.round(duracao);
        validacao.erros = erros;
        validacao.totalErros = erros.length;
        validacao.errosCriticos = erros.filter((e) => e.severidade === 'critico').length;

        await validationAttemptRepository.save(validacao);

        logger.warn('XML parsing failed', { validacaoId: validacao.id });

        return res.status(200).json({
          status: 'rejeitado',
          message: 'Erro ao fazer parse do XML',
          validacaoId: validacao.id,
          erros: validacao.erros,
          tempoProcessamento: validacao.tempoProcessamento,
        });
      }

      // 3. Rules Engine Validation (< 300ms)
      const nf = parseResult;
      const rulesErrors = this.rulesEngine.validate(nf, nf.regime);

      const duracao = performance.now() - startTime;
      const validoRegras = rulesErrors.length === 0;

      // 4. Persist validation attempt (non-blocking)
      const validacao = new ValidationAttempt();
      validacao.id = uuid();
      validacao.empresaId = empresaId;
      validacao.usuarioId = usuario.id;
      validacao.xmlContent = xmlContent;
      validacao.status = validoRegras ? 'aprovado' : 'rejeitado';
      validacao.nfe = nf.nfe;
      validacao.dataEmissao = nf.dataEmissao ? new Date(nf.dataEmissao) : undefined;
      validacao.valor = nf.valor;
      validacao.cnpjFornecedor = nf.documentoFornecedor;
      validacao.cnpjComprador = nf.documentoComprador;
      validacao.cfop = nf.cfop;
      validacao.cst = nf.cst;
      validacao.icmsAliquota = nf.icmsAliquota;
      validacao.validoXSD = true;
      validacao.validoRegras = validoRegras;
      validacao.tempoProcessamento = Math.round(duracao);
      validacao.erros = rulesErrors.length > 0 ? rulesErrors : null;
      validacao.totalErros = rulesErrors.length;
      validacao.errosCriticos = rulesErrors.filter((e) => e.severidade === 'critico').length;
      validacao.errosAvisos = rulesErrors.filter((e) => e.severidade === 'aviso').length;

      // Save without await (non-blocking)
      validationAttemptRepository.save(validacao).catch((error) => {
        logger.error('Failed to persist validation attempt', {
          error,
          validacaoId: validacao.id,
        });
      });

      // Audit (non-blocking)
      const auditService = getAuditQueueService();
      auditService.queueAudit({
        usuarioId: usuario.id,
        empresaId,
        acao: 'validar',
        entidade: 'ValidationAttempt',
        entidadeId: validacao.id,
        descricao: `Validação ${validoRegras ? 'aprovada' : 'rejeitada'} (${rulesErrors.length} erros)`,
        statusSolicitacao: 'sucesso',
        ipOrigem: req.ip,
      });

      logger.info('Validation completed', {
        validacaoId: validacao.id,
        status: validacao.status,
        erros: validacao.totalErros,
        duracao: validacao.tempoProcessamento,
      });

      return res.status(200).json({
        status: validoRegras ? 'aprovado' : 'rejeitado',
        message: validoRegras
          ? 'Validação aprovada'
          : `Validação rejeitada com ${rulesErrors.length} erro(s)`,
        validacaoId: validacao.id,
        erros: rulesErrors.length > 0 ? rulesErrors : undefined,
        tempoProcessamento: validacao.tempoProcessamento,
        nf: {
          numero: nf.nfe,
          dataEmissao: nf.dataEmissao,
          valor: nf.valor,
          cfop: nf.cfop,
        },
      });
    } catch (error) {
      logger.error('Validation endpoint error', { error });
      next(error);
    }
  }

  /**
   * GET /api/validacao/:id
   * Obter detalhe de uma validação
   */
  async getValidacao(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const usuario = (req as any).user;

      const dataSource = getDataSource();
      const validationAttemptRepository = dataSource.getRepository(ValidationAttempt);

      const validacao = await validationAttemptRepository.findOne({
        where: { id },
        relations: ['empresa', 'usuario'],
      });

      if (!validacao) {
        throw new NotFoundError('Validação não encontrada');
      }

      // Verificar autorização (usuário só pode ver suas validações)
      if (validacao.usuarioId !== usuario.id && usuario.role !== 'admin') {
        throw new AppError(403, 'Acesso negado');
      }

      res.status(200).json({
        status: 'sucesso',
        data: validacao,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/validacoes/minhas
   * Listar validações do usuário com paginação
   */
  async getMinhasValidacoes(req: Request, res: Response, next: NextFunction) {
    try {
      const usuario = (req as any).user;
      const { page = 1, limit = 20, status, dataInicio, dataFim } = req.query;

      const pageNum = Math.max(1, parseInt(String(page), 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10)));
      const skip = (pageNum - 1) * limitNum;

      const dataSource = getDataSource();
      const validationAttemptRepository = dataSource.getRepository(ValidationAttempt);

      let query = validationAttemptRepository
        .createQueryBuilder('validacao')
        .where('validacao.usuarioId = :usuarioId', { usuarioId: usuario.id });

      if (status) {
        query = query.andWhere('validacao.status = :status', { status });
      }

      if (dataInicio) {
        query = query.andWhere('validacao.criadoEm >= :dataInicio', { dataInicio });
      }

      if (dataFim) {
        query = query.andWhere('validacao.criadoEm <= :dataFim', { dataFim });
      }

      const [data, total] = await query
        .orderBy('validacao.criadoEm', 'DESC')
        .take(limitNum)
        .skip(skip)
        .getManyAndCount();

      res.status(200).json({
        status: 'sucesso',
        data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/download/:validacao_id/xml
   * Download XML original da validação
   */
  async downloadXML(req: Request, res: Response, next: NextFunction) {
    try {
      const { validacao_id } = req.params;
      const usuario = (req as any).user;

      const dataSource = getDataSource();
      const validationAttemptRepository = dataSource.getRepository(ValidationAttempt);

      const validacao = await validationAttemptRepository.findOne({
        where: { id: validacao_id },
      });

      if (!validacao) {
        throw new NotFoundError('Validação não encontrada');
      }

      // Verificar autorização
      if (validacao.usuarioId !== usuario.id && usuario.role !== 'admin') {
        throw new AppError(403, 'Acesso negado');
      }

      // Audit
      const auditService = getAuditQueueService();
      await auditService.queueAudit({
        usuarioId: usuario.id,
        acao: 'ler',
        entidade: 'ValidationAttempt',
        entidadeId: validacao.id,
        descricao: 'Download XML',
        statusSolicitacao: 'sucesso',
      });

      res.setHeader('Content-Type', 'application/xml');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="validacao-${validacao.id}.xml"`
      );

      res.send(validacao.xmlContent);
    } catch (error) {
      next(error);
    }
  }
}
