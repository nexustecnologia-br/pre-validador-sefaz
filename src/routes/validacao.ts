import { Router } from 'express';
import { ValidationController } from '../controllers/ValidationController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const validationController = new ValidationController();

/**
 * POST /api/validar
 * Validar nota fiscal XML
 */
router.post('/validar', authMiddleware, (req, res, next) => {
  validationController.validar(req, res, next);
});

/**
 * GET /api/validacao/:id
 * Obter detalhe de uma validação
 */
router.get('/validacao/:id', authMiddleware, (req, res, next) => {
  validationController.getValidacao(req, res, next);
});

/**
 * GET /api/validacoes/minhas
 * Listar validações do usuário
 */
router.get('/validacoes/minhas', authMiddleware, (req, res, next) => {
  validationController.getMinhasValidacoes(req, res, next);
});

/**
 * GET /api/download/:validacao_id/xml
 * Download XML da validação
 */
router.get('/download/:validacao_id/xml', authMiddleware, (req, res, next) => {
  validationController.downloadXML(req, res, next);
});

export default router;
