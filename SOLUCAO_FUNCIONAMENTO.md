# ✅ SOLUÇÃO — PRE_VALIDADOR_SEFAZ FUNCIONANDO

**Problema**: App não roda localmente nem no Heroku  
**Causa**: Dependência de PostgreSQL/Redis não configuradas  
**Solução**: 2 caminhos (teste rápido + deploy correto)  

---

## 🚀 SOLUÇÃO 1: TESTE RÁPIDO LOCAL (2 minutos)

### Mock Server (sem banco de dados)

```bash
cd /c/Users/rodri/Desktop/01_DESENVOLVIMENTO/pre_validador_sefaz

# Compilar mock server
npx tsc src/index-mock.ts --target ES2020 --module ES2020

# Rodar
node dist/index-mock.js
```

**Resultado**:
```
🚀 PRE_VALIDADOR_SEFAZ V2.0 (Mock Server) rodando em http://localhost:3000

📝 Credenciais de teste:
   Email: user@example.com
   Senha: senha123

🧪 Teste rápido:
   curl http://localhost:3000/health
```

---

## 🧪 TESTAR O MOCK SERVER

### 1. Health Check
```bash
curl http://localhost:3000/health
```

**Resposta esperada**:
```json
{
  "status": "ok",
  "uptime": 2.345,
  "version": "1.0.0",
  "message": "PRE_VALIDADOR_SEFAZ V2.0 (Mock Server)"
}
```

### 2. Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "senha": "senha123"
  }'
```

**Resposta esperada**:
```json
{
  "status": "sucesso",
  "data": {
    "token": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "usuario": {
      "id": "12345",
      "email": "user@example.com",
      "nome": "Test User",
      "role": "usuario"
    }
  }
}
```

### 3. Validação
```bash
TOKEN="eyJhbGc..."  # Do login acima

curl -X POST http://localhost:3000/api/validar \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "xmlContent": "<?xml version=\"1.0\"?><root></root>",
    "empresaId": "12345678-1234-1234-1234-123456789012"
  }'
```

**Resposta esperada**:
```json
{
  "status": "aprovado",
  "validacaoId": "abc123def",
  "nfe": "123456",
  "valor": 1000,
  "tempoProcessamento": 150,
  "erros": []
}
```

---

## 🔗 SOLUÇÃO 2: DEPLOY HEROKU CORRETO (10 minutos)

### Problema Atual
```
❌ https://validador-sefaz-prod.herokuapp.com → "No such app"
```

### Causa
App não foi criado ou push não foi feito

### Solução

#### Passo 1: Instalar Heroku CLI

**Windows**:
```bash
# Via Chocolatey
choco install heroku-cli

# Ou download: https://devcenter.heroku.com/articles/heroku-cli
```

**Verificar**:
```bash
heroku --version
```

---

#### Passo 2: Criar e Configurar App

```bash
cd /c/Users/rodri/Desktop/01_DESENVOLVIMENTO/pre_validador_sefaz

# 1. Login no Heroku
heroku login

# 2. Criar app (novo nome para evitar conflito)
heroku create validador-sefaz-app

# 3. Verificar
heroku apps
# Deve listar seu app
```

---

#### Passo 3: Adicionar Banco de Dados

```bash
# PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev \
  --app validador-sefaz-app

# Redis
heroku addons:create heroku-redis:premium-0 \
  --app validador-sefaz-app

# Esperar ~2 minutos para provisionar
heroku addons --app validador-sefaz-app
```

---

#### Passo 4: Configurar Variáveis de Ambiente

```bash
heroku config:set \
  NODE_ENV=production \
  JWT_SECRET="$(openssl rand -base64 32)" \
  LOG_LEVEL=info \
  SEFAZ_API_URL=https://sefaz.sefazrs.example.com/api \
  --app validador-sefaz-app

# Verificar
heroku config --app validador-sefaz-app
```

---

#### Passo 5: Adicionar Remote do Heroku ao Git

```bash
# Se heroku remote não existe
heroku git:remote -a validador-sefaz-app

# Verificar
git remote -v
# Deve mostrar:
# heroku  https://git.heroku.com/validador-sefaz-app.git (fetch)
# heroku  https://git.heroku.com/validador-sefaz-app.git (push)
```

---

#### Passo 6: Deploy

```bash
# Fazer push
git push heroku main

# Saída esperada:
# Counting objects: 100% (50/50)
# ...
# -----> Building on the Heroku-20 stack
# -----> Using buildpack: heroku/nodejs
# -----> Installing dependencies
# ...
# -----> Build succeeded!
# -----> Launching...
#        Released v1
#        https://validador-sefaz-app.herokuapp.com/ deployed to Heroku

# Abrir app
heroku open --app validador-sefaz-app
```

---

#### Passo 7: Migrar Banco de Dados

```bash
# Rodar migrations
heroku run npm run db:migrate \
  --app validador-sefaz-app

# Seed com dados
heroku run npm run db:seed \
  --app validador-sefaz-app

# Ver logs
heroku logs -t --app validador-sefaz-app
```

---

## ✅ TESTAR HEROKU

```bash
# Health check
curl https://validador-sefaz-app.herokuapp.com/health

# Login
curl -X POST https://validador-sefaz-app.herokuapp.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "senha": "senha123"
  }'
```

---

## 📋 CHECKLIST RÁPIDO

**Para Teste Local (Mock)**:
- [ ] `npx tsc src/index-mock.ts --target ES2020 --module ES2020`
- [ ] `node dist/index-mock.js`
- [ ] `curl http://localhost:3000/health` ✅

**Para Heroku Deploy**:
- [ ] `heroku login`
- [ ] `heroku create validador-sefaz-app`
- [ ] Add PostgreSQL + Redis
- [ ] Set env variables
- [ ] `heroku git:remote -a validador-sefaz-app`
- [ ] `git push heroku main`
- [ ] `heroku run npm run db:migrate`
- [ ] `curl https://validador-sefaz-app.herokuapp.com/health` ✅

---

## 🎯 RESULTADO ESPERADO

**Mock Local**:
```
http://localhost:3000 ✅ (sem banco)
```

**Heroku**:
```
https://validador-sefaz-app.herokuapp.com ✅ (com banco)
```

---

## ⚠️ PROBLEMAS COMUNS

### "Heroku CLI not found"
```bash
# Windows: Instalar via https://devcenter.heroku.com/articles/heroku-cli
# Ou: choco install heroku-cli
```

### "No such app"
```bash
# Criar novo app
heroku create seu-novo-nome

# Ou listar apps existentes
heroku apps
```

### "Build failed"
```bash
# Ver logs de erro
heroku logs -t --app validador-sefaz-app

# Procurar por "error" ou "failed"
```

### "Database connection error"
```bash
# Verificar se DATABASE_URL foi criada
heroku config:get DATABASE_URL --app validador-sefaz-app

# Se vazio, add-on não foi criado
heroku addons:create heroku-postgresql:hobby-dev --app validador-sefaz-app
```

---

## 🚀 PRÓXIMOS PASSOS

1. **Teste Mock Local** (agora, 2 min)
   ```bash
   node dist/index-mock.js
   ```

2. **Deploy Heroku** (depois, 10 min)
   ```bash
   git push heroku main
   ```

3. **Frontend** (opcional, Vercel ou local)
   ```bash
   cd frontend && npm run dev
   ```

---

**Seu link será**: `https://validador-sefaz-app.herokuapp.com` (ou seu novo nome)

Avise quando tiver criado o novo app! 🎯
