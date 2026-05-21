# 🚀 SETUP & DEVELOPMENT GUIDE

**pre_validador_sefaz** — Guia para executar localmente

---

## 📋 PRÉ-REQUISITOS

```bash
Node.js: 18+
PostgreSQL: 14+
Redis: 7+
npm: 9+
Git: 2.40+
```

### Windows (via Chocolatey)
```powershell
# Install Node.js
choco install nodejs -y

# Install PostgreSQL
choco install postgresql14 -y

# Install Redis
choco install redis-64 -y

# Verify installations
node --version
psql --version
redis-cli --version
```

### macOS (via Homebrew)
```bash
# Install Node.js
brew install node

# Install PostgreSQL
brew install postgresql

# Install Redis
brew install redis

# Start services
brew services start postgresql
brew services start redis
```

### Ubuntu/Debian
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Install Redis
sudo apt-get install -y redis-server

# Start services
sudo service postgresql start
sudo service redis-server start
```

---

## 🔧 SETUP INICIAL

### 1. Clone o Repositório

```bash
cd C:\Users\rodri\Desktop\01_DESENVOLVIMENTO\pre_validador_sefaz
# ou
git clone <repo-url> pre_validador_sefaz
cd pre_validador_sefaz
```

### 2. Instale Dependências

```bash
npm install
```

### 3. Configure Variáveis de Ambiente

Crie arquivo `.env.local`:

```env
# === NODE ===
NODE_ENV=development
PORT=3000

# === DATABASE ===
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/validador_sefaz
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# === REDIS ===
REDIS_URL=redis://localhost:6379

# === JWT ===
JWT_SECRET=seu-secret-muito-seguro-aqui
JWT_EXPIRE_IN=24h
JWT_REFRESH_EXPIRE_IN=30d

# === SEFAZ ===
SEFAZ_ENDPOINT=https://nfe.sefaz.rs.gov.br/webservices
SEFAZ_TIMEOUT_MS=5000
SEFAZ_CACHE_TTL_HOURS=24

# === LOGS ===
LOG_LEVEL=debug
LOG_FORMAT=json

# === CORS ===
CORS_ORIGIN=http://localhost:3000,http://localhost:5173

# === S3 (Optional, para armazenar PDFs) ===
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=seu-access-key
AWS_SECRET_ACCESS_KEY=seu-secret-key
S3_BUCKET=relatorios-validador
```

### 4. Crie Database PostgreSQL

```bash
# Via psql
psql -U postgres -c "CREATE DATABASE validador_sefaz;"

# Via Node.js script (automático)
npm run db:init
```

### 5. Execute Migrations

```bash
# Aplica o schema
npm run db:migrate

# Seed dados iniciais (regras padrão)
npm run db:seed
```

Ou manualmente:

```bash
psql -U postgres -d validador_sefaz -f config/schema.sql
```

### 6. Inicie Serviços Localmente

```bash
# Terminal 1: Backend
npm run dev

# Terminal 2: Frontend (React)
cd frontend && npm run dev

# Terminal 3: Redis (se não estiver como serviço)
redis-server

# Terminal 4: Queue Worker (Bull)
npm run queue:worker
```

---

## 🗂️ ESTRUTURA DO PROJETO

```
pre_validador_sefaz/
├── src/
│   ├── controllers/        # Request handlers
│   │   ├── auth.ts
│   │   ├── validacao.ts
│   │   ├── auditoria.ts
│   │   └── regras.ts
│   │
│   ├── services/           # Business logic
│   │   ├── XMLParserService.ts
│   │   ├── RulesEngineService.ts
│   │   ├── SefazConnectorService.ts
│   │   ├── AuditLoggerService.ts
│   │   └── ReportGeneratorService.ts
│   │
│   ├── models/             # Database models
│   │   ├── ValidationAttempt.ts
│   │   ├── AuditLog.ts
│   │   ├── ValidationRule.ts
│   │   └── Empresa.ts
│   │
│   ├── middleware/         # Express middleware
│   │   ├── auth.ts
│   │   ├── errorHandler.ts
│   │   ├── rateLimit.ts
│   │   └── logger.ts
│   │
│   ├── routes/             # API routes
│   │   ├── auth.ts
│   │   ├── validacao.ts
│   │   ├── auditoria.ts
│   │   └── regras.ts
│   │
│   ├── utils/              # Utility functions
│   │   ├── logger.ts
│   │   ├── errors.ts
│   │   ├── validators.ts
│   │   └── jwt.ts
│   │
│   └── index.ts            # App entry point
│
├── frontend/               # React SPA
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── tests/                  # Testes
│   ├── unit/
│   │   ├── XMLParser.test.ts
│   │   ├── RulesEngine.test.ts
│   │   └── Services.test.ts
│   │
│   ├── integration/
│   │   ├── ValidationFlow.test.ts
│   │   └── API.test.ts
│   │
│   └── e2e/
│       └── FullFlow.test.ts
│
├── config/
│   ├── schema.sql          # Database schema
│   ├── jest.config.js      # Jest configuration
│   └── ormconfig.ts        # TypeORM config
│
├── docs/
│   ├── README.md           # Visão geral
│   ├── ARCHITECTURE.md     # Arquitetura técnica
│   ├── API.md              # Endpoints
│   └── SEFAZ_INTEGRATION.md
│
├── .env.local              # Variables (local)
├── .env.example            # Template
├── package.json
├── tsconfig.json
└── docker-compose.yml      # Para rodar com Docker
```

---

## 📦 PACKAGE.JSON SCRIPTS

```json
{
  "scripts": {
    "dev": "ts-node src/index.ts --watch",
    "build": "tsc",
    "start": "node dist/index.js",
    
    "db:init": "npm run db:migrate && npm run db:seed",
    "db:migrate": "psql $DATABASE_URL < config/schema.sql",
    "db:seed": "ts-node config/seed.ts",
    "db:reset": "psql $DATABASE_URL -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' && npm run db:migrate",
    
    "queue:worker": "ts-node src/queue-worker.ts",
    
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:e2e": "jest tests/e2e",
    "test:coverage": "jest --coverage",
    
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    
    "format": "prettier --write 'src/**/*.ts'",
    
    "docker:build": "docker build -t validador-sefaz .",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down"
  }
}
```

---

## 🧪 TESTES

### Unit Tests

```bash
npm run test:unit

# Exemplos
npm run test:unit -- XMLParser.test.ts
npm run test:unit -- RulesEngine.test.ts
```

### Integration Tests

```bash
# Requer database local
npm run test:integration

# Teste fluxo completo de validação
npm run test:integration -- ValidationFlow.test.ts
```

### E2E Tests

```bash
# Requer serviços rodando (npm run dev)
npm run test:e2e

# Teste flow completo: upload → validação → export
npm run test:e2e -- FullFlow.test.ts
```

### Coverage

```bash
npm run test:coverage

# Gera relatório em coverage/
open coverage/index.html
```

---

## 🐛 DEBUG

### VS Code Launch Configuration

Crie `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Launch Backend",
      "program": "${workspaceFolder}/src/index.ts",
      "preLaunchTask": "tsc: build",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

### Logs

```bash
# Ver logs em tempo real
tail -f logs/app.log

# Filtrar por erro
grep ERROR logs/app.log | tail -20

# Debug completo
LOG_LEVEL=debug npm run dev
```

---

## 📱 FRONTEND SETUP

### Instale dependências

```bash
cd frontend
npm install
```

### Rode desenvolvimento local

```bash
npm run dev

# Acesso: http://localhost:5173
```

### Build para produção

```bash
npm run build

# Output: dist/
# Deploy para Vercel: vercel --prod
```

---

## 🚀 DEPLOYMENT

### Build para Produção

```bash
npm run build
npm start
```

### Docker

```bash
# Build imagem
docker build -t validador-sefaz .

# Rode container
docker run -p 3000:3000 --env-file .env.prod validador-sefaz
```

### Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Deploy para produção
vercel --prod
```

### AWS EC2

```bash
# SSH into instance
ssh -i key.pem ubuntu@ec2-ip

# Install dependencies
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql redis-server

# Clone repo
git clone <repo-url>
cd pre_validador_sefaz

# Install & run
npm install
npm run build
npm start
```

---

## 🔐 Segurança em Desenvolvimento

### Generate JWT Secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Certificado SSL para SEFAZ

```bash
# Gerar certificado auto-assinado (apenas DEV)
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365

# Para produção, obter certificado válido de CA
```

### .env.example

Sempre mantenha `.env.example` com variáveis sem valores secretos:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/validador_sefaz
REDIS_URL=redis://localhost:6379
JWT_SECRET=seu-secret-aqui
# ... resto das variáveis sem valores reais
```

---

## ✅ CHECKLIST PÓS-SETUP

- [ ] Node.js 18+ instalado
- [ ] PostgreSQL rodando e database criado
- [ ] Redis rodando
- [ ] `.env.local` configurado
- [ ] `npm install` completado
- [ ] `npm run db:init` executado
- [ ] `npm run dev` iniciando backend corretamente
- [ ] `npm run test:unit` passando
- [ ] API respondendo em `http://localhost:3000/health`
- [ ] Frontend rodando em `http://localhost:5173`

---

## 🆘 TROUBLESHOOTING

### "PostgreSQL connection refused"
```bash
# Verifique se está rodando
psql -U postgres -c "SELECT 1"

# Se não: start service
sudo service postgresql start
```

### "Redis connection refused"
```bash
# Verifique se está rodando
redis-cli ping

# Se não: start service
redis-server
# ou
sudo service redis-server start
```

### "Port 3000 already in use"
```bash
# Mude em .env
PORT=3001

# Ou mate processo
lsof -i :3000
kill -9 <PID>
```

### "Migrations failed"
```bash
# Reset database
npm run db:reset

# Re-run migrations
npm run db:init
```

---

## 📚 Recursos Adicionais

- [Node.js Documentation](https://nodejs.org/en/docs/)
- [Express.js Guide](https://expressjs.com/)
- [TypeORM Documentation](https://typeorm.io/)
- [Jest Testing](https://jestjs.io/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Redis Docs](https://redis.io/docs/)

---

**Próximos Passos**:
1. ✅ Setup completo
2. 🔨 Começar implementação em `src/`
3. 🧪 Escrever testes em `tests/`
4. 🚀 Deploy em Vercel

**Status**: ✅ Pronto para desenvolvimento

---

**Data**: 2026-05-21 | **Rodrigo Rafael**
