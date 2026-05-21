import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { getDataSource } from '../index';
import { Usuario } from '../models/Usuario';
import { generateToken, generateRefreshToken } from '../utils/jwt';
import logger from '../utils/logger';
import { UnauthorizedError, ValidationError, NotFoundError, AppError } from '../utils/errors';
import { getAuditQueueService } from '../services/AuditQueueService';

export class AuthController {
  /**
   * POST /api/auth/login
   * Login com email e senha, retorna JWT token
   */
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, senha } = req.body;

      // Validação básica
      if (!email || !senha) {
        throw new ValidationError('Email e senha são obrigatórios');
      }

      const dataSource = getDataSource();
      const usuarioRepository = dataSource.getRepository(Usuario);

      // Buscar usuário
      const usuario = await usuarioRepository.findOne({
        where: { email },
      });

      if (!usuario) {
        logger.warn('Login attempt with non-existent email', { email });
        throw new UnauthorizedError('Email ou senha inválidos');
      }

      // Verificar status ativo
      if (!usuario.ativo) {
        logger.warn('Login attempt with inactive user', { usuarioId: usuario.id });
        throw new UnauthorizedError('Usuário inativo');
      }

      // Comparar senhas
      const senhaValida = await bcrypt.compare(senha, usuario.senha);

      if (!senhaValida) {
        logger.warn('Login attempt with invalid password', { usuarioId: usuario.id });
        throw new UnauthorizedError('Email ou senha inválidos');
      }

      // Gerar tokens
      const token = generateToken({
        id: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
        role: usuario.role,
      });

      const refreshToken = generateRefreshToken({
        id: usuario.id,
      });

      // Registrar audit
      const auditService = getAuditQueueService();
      await auditService.queueAudit({
        usuarioId: usuario.id,
        acao: 'login',
        entidade: 'Usuario',
        entidadeId: usuario.id,
        descricao: `Login bem-sucedido para ${usuario.email}`,
        statusSolicitacao: 'sucesso',
        ipOrigem: req.ip,
        userAgent: req.get('User-Agent'),
      });

      logger.info('User logged in successfully', {
        usuarioId: usuario.id,
        email: usuario.email,
      });

      res.status(200).json({
        status: 'sucesso',
        message: 'Login realizado com sucesso',
        data: {
          token,
          refreshToken,
          usuario: {
            id: usuario.id,
            email: usuario.email,
            nome: usuario.nome,
            role: usuario.role,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   * Logout do usuário (token-based, não requer ação no servidor)
   */
  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const usuario = (req as any).user;

      // Registrar audit
      const auditService = getAuditQueueService();
      await auditService.queueAudit({
        usuarioId: usuario.id,
        acao: 'logout',
        entidade: 'Usuario',
        entidadeId: usuario.id,
        descricao: `Logout para ${usuario.email}`,
        statusSolicitacao: 'sucesso',
        ipOrigem: req.ip,
        userAgent: req.get('User-Agent'),
      });

      logger.info('User logged out', { usuarioId: usuario.id });

      res.status(200).json({
        status: 'sucesso',
        message: 'Logout realizado com sucesso',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/refresh
   * Refresh JWT token usando refresh token
   */
  static async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken: token } = req.body;

      if (!token) {
        throw new ValidationError('Refresh token é obrigatório');
      }

      const dataSource = getDataSource();
      const usuarioRepository = dataSource.getRepository(Usuario);

      // Em um cenário real, armazenaríamos refresh tokens em banco de dados
      // Por agora, validamos o token JWT normalmente
      const decoded = require('jsonwebtoken').verify(
        token,
        process.env.JWT_SECRET || 'dev-secret-key'
      );

      const usuario = await usuarioRepository.findOne({
        where: { id: decoded.id },
      });

      if (!usuario || !usuario.ativo) {
        throw new UnauthorizedError('Token inválido ou usuário inativo');
      }

      // Gerar novo token
      const novoToken = generateToken({
        id: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
        role: usuario.role,
      });

      res.status(200).json({
        status: 'sucesso',
        data: {
          token: novoToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   * Obter dados do usuário autenticado
   */
  static async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const usuario = (req as any).user;

      const dataSource = getDataSource();
      const usuarioRepository = dataSource.getRepository(Usuario);

      const usuarioData = await usuarioRepository.findOne({
        where: { id: usuario.id },
        select: ['id', 'email', 'nome', 'cpf', 'role', 'ativo', 'criadoEm'],
      });

      if (!usuarioData) {
        throw new UnauthorizedError('Usuário não encontrado');
      }

      res.status(200).json({
        status: 'sucesso',
        data: usuarioData,
      });
    } catch (error) {
      next(error);
    }
  }
}
