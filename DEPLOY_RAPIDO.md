# 🚀 DEPLOY RÁPIDO — PRE_VALIDADOR_SEFAZ V2.0

**Tempo**: 5-10 minutos  
**Custo**: Gratuito (trial)  
**Resultado**: Link público para testar

---

## OPÇÃO 1: Railway (Recomendado - Mais Rápido)

### Passo 1: Setup
```bash
# 1. Criar conta em https://railway.app (GitHub sign-in)
# 2. Criar novo projeto
# 3. Conectar este repositório GitHub

# OU via CLI:
npm install -g @railway/cli
railway login
railway init
```

### Passo 2: Adicionar serviços
```bash
railway add          # Selecionar PostgreSQL 15
railway add          # Selecionar Redis 7
```

### Passo 3: Configurar env
```bash
railway variables set \
  NODE_ENV=production \
  JWT_SECRET=$(openssl rand -base64 32) \
  SEFAZ_API_URL=https://sefaz.example.com \
  LOG_LEVEL=info
```

### Passo 4: Deploy
```bash
railway up          # Deploy automático
railway domains     # Obter URL pública
```

**Resultado**: 
```
https://validador-sefaz-prod-xxxxx.railway.app
```

---

## OPÇÃO 2: Heroku (Alternativa)

### Passo 1: Setup
```bash
npm install -g heroku
heroku login
heroku create validador-sefaz-prod
```

### Passo 2: Adicionar add-ons
```bash
heroku addons:create heroku-postgresql:hobby-dev \
  --app validador-sefaz-prod
heroku addons:create heroku-redis:premium-0 \
  --app validador-sefaz-prod
```

### Passo 3: Deploy
```bash
git push heroku main
heroku open
```

**Resultado**:
```
https://validador-sefaz-prod.herokuapp.com
```

---

## OPÇÃO 3: Local Testing (Sem deploy)

### Passo 1: Start services
```bash
docker-compose up -d  # PostgreSQL + Redis
```

### Passo 2: Setup database
```bash
npm run db:migrate
npm run db:seed
```

### Passo 3: Start backend + frontend
```bash
# Terminal 1: Backend
npm run dev
# → http://localhost:3000

# Terminal 2: Frontend
cd frontend && npm run dev
# → http://localhost:5173
```

**URLs de Teste**:
```
Frontend: http://localhost:5173
API: http://localhost:3000

Credenciais Teste:
  Email: user@example.com
  Password: senha123
```

---

## 🧪 TESTE RÁPIDO (Qualquer opção)

### 1. Login
```bash
curl -X POST https://YOUR_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "senha": "senha123"
  }'
```

### 2. Validar NF-e
```bash
curl -X POST https://YOUR_URL/api/validar \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "xmlContent": "<?xml version=\"1.0\"?>...",
    "empresaId": "12345678-1234-1234-1234-123456789012"
  }'
```

### 3. Health Check
```bash
curl https://YOUR_URL/health
```

---

## 📋 CHECKLIST

- [ ] Conta criada (Railway/Heroku)
- [ ] Repositório conectado
- [ ] Variáveis de ambiente configuradas
- [ ] Serviços (PostgreSQL, Redis) criados
- [ ] Deploy iniciado
- [ ] URL pública gerada
- [ ] Login testado
- [ ] Validação testada
- [ ] Dashboard acessado

---

## ⚠️ TROUBLESHOOTING

**Erro: Database connection failed**
```bash
# Verificar URL de conexão
railway variables show DATABASE_URL
# ou
heroku config:get DATABASE_URL
```

**Erro: Build failed**
```bash
# Ler logs
railway logs
# ou
heroku logs -t
```

**Erro: Redis connection timeout**
```bash
# Aumentar timeout
railway variables set REDIS_TIMEOUT=30000
```

---

## 🔗 LINKS ÚTEIS

- Railway: https://railway.app
- Heroku: https://heroku.com
- Docker Desktop: https://docker.com/products/docker-desktop

---

**Próximo**: Após deploy bem-sucedido, compartilhe a URL para testes! 🚀
