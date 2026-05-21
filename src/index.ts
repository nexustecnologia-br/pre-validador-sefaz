import 'reflect-metadata';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { DataSource } from 'typeorm';

import logger from './utils/logger';
import { requestLogger } from './middleware/logger';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';

// Load environment variables
dotenv.config({ path: process.env.NODE_ENV === 'production' ? '.env' : '.env.local' });

const app: Express = express();
const port = process.env.PORT || 3000;
const nodeEnv = process.env.NODE_ENV || 'development';

// ============================================
// SECURITY & MIDDLEWARE
// ============================================

// Helmet for security headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // requests per windowMs
  message: 'Muitas requisições deste IP, tente novamente mais tarde.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Request logging
app.use(requestLogger);

// ============================================
// DATABASE INITIALIZATION
// ============================================

// Database source will be initialized later
let AppDataSource: DataSource;

export async function initializeDatabase() {
  try {
    AppDataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'pre_validador_sefaz',
      entities: [
        'src/models/**/*.ts',
      ],
      migrations: [
        'src/migrations/**/*.ts',
      ],
      synchronize: nodeEnv === 'development',
      logging: nodeEnv === 'development',
      maxQueryExecutionTime: 1000,
    });

    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      logger.info('Database initialized successfully');
    }

    return AppDataSource;
  } catch (error) {
    logger.error('Database initialization failed', { error });
    process.exit(1);
  }
}

// Export for use in services
export function getDataSource(): DataSource {
  return AppDataSource;
}

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================

app.get('/health', (req: Request, res: Response) => {
  const uptime = process.uptime();
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    environment: nodeEnv,
    version: '2.0.0',
    database: AppDataSource?.isInitialized ? 'connected' : 'disconnected',
  });
});

// ============================================
// SWAGGER API DOCUMENTATION
// ============================================

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'PRE_VALIDADOR_SEFAZ API',
    description: 'Sistema de pré-validação de notas fiscais SEFAZ-RS',
    version: '2.0.0',
    contact: {
      name: 'Rodrigo Rafael',
      email: 'dev@example.com',
    },
  },
  servers: [
    {
      url: `http://localhost:${port}`,
      description: 'Development server',
    },
    {
      url: 'https://api.example.com',
      description: 'Production server',
    },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check endpoint',
        responses: {
          200: {
            description: 'Server is healthy',
          },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login and get JWT token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  senha: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Login successful',
          },
        },
      },
    },
    '/api/validar': {
      post: {
        tags: ['Validacao'],
        summary: 'Validar nota fiscal XML',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  xmlContent: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Validação completa',
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ============================================
// API ROUTES
// ============================================

import authRoutes from './routes/auth';
import validacaoRoutes from './routes/validacao';

// Wire up routes
app.use('/api/auth', authRoutes);
app.use('/api', validacaoRoutes);

// ============================================
// 404 HANDLER
// ============================================

app.use((req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: 'Rota não encontrada',
    path: req.path,
    method: req.method,
  });
});

// ============================================
// ERROR HANDLER (MUST BE LAST)
// ============================================

app.use(errorHandler);

// ============================================
// SERVER STARTUP
// ============================================

async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();

    // Start server
    const server = app.listen(port, () => {
      logger.info(`🚀 Server running on port ${port}`, {
        environment: nodeEnv,
        database: 'connected',
        apiDocs: `http://localhost:${port}/api-docs`,
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        logger.info('HTTP server closed');
        if (AppDataSource?.isInitialized) {
          AppDataSource.destroy();
        }
        process.exit(0);
      });
    });

    // Handle unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', {
        promise,
        reason,
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', { error });
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
