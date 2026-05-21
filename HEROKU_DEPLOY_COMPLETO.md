# 🚀 HEROKU DEPLOY COMPLETO

**App já criado**: `validador-sefaz-prod.herokuapp.com`  
**Status**: Pronto para deploy (Procfile criado)  
**Tempo restante**: 3-5 minutos  

---

## ✅ PASSO 1: Adicionar Heroku Remote

```bash
cd /c/Users/rodri/Desktop/01_DESENVOLVIMENTO/pre_validador_sefaz

# Adicionar remote do Heroku
heroku git:remote -a validador-sefaz-prod

# Verificar
git remote -v
# Deve mostrar heroku remote apontando para seu app
```

---

## ✅ PASSO 2: Adicionar Banco de Dados & Cache

```bash
# PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev \
  -a validador-sefaz-prod

# Redis
heroku addons:create heroku-redis:premium-0 \
  -a validador-sefaz-prod

# Esperar ~2 minutos para provisionamento
# Verificar:
heroku addons -a validador-sefaz-prod
```

---

## ✅ PASSO 3: Configurar Variáveis de Ambiente

```bash
# Gerar JWT Secret
JWT_SECRET=$(openssl rand -base64 32)

# Configurar todas as variáveis
heroku config:set \
  NODE_ENV=production \
  JWT_SECRET="$JWT_SECRET" \
  LOG_LEVEL=info \
  SEFAZ_API_URL=https://sefaz.sefazrs.example.com/api \
  -a validador-sefaz-prod

# Verificar (DATABASE_URL e REDIS_URL devem estar já configuradas pelos add-ons)
heroku config -a validador-sefaz-prod
```

---

## ✅ PASSO 4: Deploy no Heroku

```bash
# Fazer deploy
git push heroku main

# Esperar a compilação (2-3 minutos)
# Output esperado:
# -----> Building on the Heroku-20 stack
# -----> Using buildpack: heroku/nodejs
# ...
# -----> Launching...
#        Released v1
#        https://validador-sefaz-prod.herokuapp.com/ deployed to Heroku
```

---

## ✅ PASSO 5: Migrar Banco de Dados

```bash
# Rodar migrations em produção
heroku run npm run db:migrate -a validador-sefaz-prod

# Seed com dados de teste
heroku run npm run db:seed -a validador-sefaz-prod

# Verificar logs
heroku logs -t -a validador-sefaz-prod
```

---

## 🧪 PASSO 6: Testar o Deployment

### 6a. Health Check
```bash
curl https://validador-sefaz-prod.herokuapp.com/health
```

**Resposta esperada**:
```json
{
  "status": "ok",
  "uptime": 12345,
  "version": "1.0.0",
  "database": { "connected": true },
  "cache": { "connected": true }
}
```

### 6b. Login
```bash
curl -X POST https://validador-sefaz-prod.herokuapp.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "senha": "senha123"
  }'
```

---

## 🌐 PASSO 7: Acessar Frontend

### Deploy Frontend em Vercel (Opcional)

```bash
# 1. Fazer login na Vercel
npm i -g vercel
vercel login

# 2. Deploy frontend
cd frontend
vercel --prod \
  --env VITE_API_URL=https://validador-sefaz-prod.herokuapp.com

# 3. Resultado:
# Vercel URL: https://seu-app.vercel.app
```

### OU Acessar pelo Heroku backend

A partir do Heroku, você pode servir o frontend também:

```bash
# Backend servindo frontend (ambos na mesma URL)
https://validador-sefaz-prod.herokuapp.com
```

---

## 📋 RESUMO DOS COMANDOS

```bash
# 1. Adicionar remote
heroku git:remote -a validador-sefaz-prod

# 2. Adicionar add-ons
heroku addons:create heroku-postgresql:hobby-dev -a validador-sefaz-prod
heroku addons:create heroku-redis:premium-0 -a validador-sefaz-prod

# 3. Configurar env
heroku config:set NODE_ENV=production JWT_SECRET="$(openssl rand -base64 32)" -a validador-sefaz-prod

# 4. Deploy
git push heroku main

# 5. Migrar BD
heroku run npm run db:migrate -a validador-sefaz-prod
heroku run npm run db:seed -a validador-sefaz-prod

# 6. Testar
curl https://validador-sefaz-prod.herokuapp.com/health
```

---

## ⚠️ TROUBLESHOOTING

### "Remote heroku not found"
```bash
heroku git:remote -a validador-sefaz-prod
```

### "Build failed"
```bash
heroku logs -t -a validador-sefaz-prod
# Procurar por "error" nos logs
```

### "Database connection error"
```bash
# Verificar DATABASE_URL foi criada pelo add-on
heroku config:get DATABASE_URL -a validador-sefaz-prod

# Se vazio, recrear add-on
heroku addons:create heroku-postgresql:hobby-dev -a validador-sefaz-prod
```

### "Redis connection timeout"
```bash
heroku config:set REDIS_TIMEOUT=30000 -a validador-sefaz-prod
```

---

## 🎯 RESULTADO FINAL

Após completar todos os passos:

```
✅ Backend: https://validador-sefaz-prod.herokuapp.com
✅ API: https://validador-sefaz-prod.herokuapp.com/api
✅ Health: https://validador-sefaz-prod.herokuapp.com/health
✅ Database: PostgreSQL (Heroku managed)
✅ Cache: Redis (Heroku managed)
✅ Logs: heroku logs -t -a validador-sefaz-prod

🎉 PRONTO PARA USO!
```

---

## 🔗 LINKS ÚTEIS

- App: https://validador-sefaz-prod.herokuapp.com
- Heroku Dashboard: https://dashboard.heroku.com
- App Settings: https://dashboard.heroku.com/apps/validador-sefaz-prod

---

**Próximo**: Após deploy bem-sucedido, envie a URL abaixo para testes:

```
https://validador-sefaz-prod.herokuapp.com
```

Credenciais de teste:
```
Email: user@example.com
Password: senha123
```
