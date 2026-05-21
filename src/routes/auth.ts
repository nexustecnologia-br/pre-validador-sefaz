import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * POST /api/auth/login
 * Login com email e senha
 */
router.post('/login', (req, res, next) => {
  AuthController.login(req, res, next);
});

/**
 * POST /api/auth/logout
 * Logout do usuário
 */
router.post('/logout', authMiddleware, (req, res, next) => {
  AuthController.logout(req, res, next);
});

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', (req, res, next) => {
  AuthController.refreshToken(req, res, next);
});

/**
 * GET /api/auth/me
 * Obter dados do usuário autenticado
 */
router.get('/me', authMiddleware, (req, res, next) => {
  AuthController.getMe(req, res, next);
});

export default router;
