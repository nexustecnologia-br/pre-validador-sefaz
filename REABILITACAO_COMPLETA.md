# 🔧 REABILITAÇÃO COMPLETA — PRE_VALIDADOR_SEFAZ V2.0

**Data**: 2026-05-21  
**Status**: PRONTO PARA EXECUÇÃO  
**Diagnóstico**: Backend não estava rodando + Frontend não conectava

---

## ❌ PROBLEMAS ENCONTRADOS (OBSERVAÇÃO GRATIDÃO)

### 1. Backend não estava ligado em localhost:3000
- Vite config tem proxy `/api` → `localhost:3000` ✅
- Mas ninguém respondía na porta 3000 ❌

### 2. API usando baseURL relativo
```typescript
baseURL: '/api'  // ← Relativo! Funciona em dev com proxy, quebra em produção
```

### 3. Frontend em Vercel sem `VITE_API_URL`
- Vercel não tem proxy local
- Frontend não sabe onde está o backend

### 4. Backend em Heroku nunca foi criado/deployado
- "No such app" no Heroku

---

## ✅ SOLUÇÃO COMPLETA (30 minutos)

### **PASSO 1: Abrir 2 Terminais**

**Terminal 1** → Backend  
**Terminal 2** → Frontend

---

### **PASSO 2: Terminal 1 - Rodar Backend (5 min)**

```bash
cd C:\Users\rodri\Desktop\01_DESENVOLVIMENTO\pre_validador_sefaz

# Verificar build
npm run build

# Rodar mock server (sem dependências de DB)
node dist/index-mock.js
```

**Esperado:**
```
🚀 PRE_VALIDADOR_SEFAZ V2.0 (Mock Server) rodando em http://localhost:3000

📝 Credenciais de teste:
   Email: user@example.com
   Senha: senha123

🧪 Teste rápido:
   curl http://localhost:3000/health
```

✅ **Backend está pronto quando vir essa mensagem!**

---

### **PASSO 3: Terminal 2 - Rodar Frontend (5 min)**

```bash
cd C:\Users\rodri\Desktop\01_DESENVOLVIMENTO\pre_validador_sefaz\frontend

# Instalar deps (se primeira vez)
npm install

# Rodar Vite dev server
npm run dev
```

**Esperado:**
```
  VITE v5.4.21  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

✅ **Frontend está pronto quando vir essa mensagem!**

---

## ✅ PASSO 4: Testar no Navegador

1. **Abra**: `http://localhost:5173/`
2. **Veja**: Página de Login
3. **Credenciais**:
   - Email: `user@example.com`
   - Senha: `senha123`
4. **Clique**: "Entrar"
5. **Veja**: Dashboard com histórico de validações

---

## 🧪 PASSO 5: Testar Validação

1. Clique em **"Validar NF-e"**
2. Copie/cole este XML:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <NFe>
     <infNFe>
       <ide>
         <cUF>43</cUF>
         <CNPJ>16716114000172</CNPJ>
         <assinaturaQRCode></assinaturaQRCode>
       </ide>
     </infNFe>
   </NFe>
   ```
3. **Clique**: "Validar"
4. **Veja**: Resultado ✅ ou ❌

---

## 🌐 PASSO 6: Deploy no Heroku + Vercel (15 min)

### **Backend → Heroku**

```bash
# Dentro do repo
heroku login
heroku create validador-sefaz-prod

# Add database (optional)
heroku addons:create heroku-postgresql:hobby-dev \
  -a validador-sefaz-prod

# Deploy
git push heroku main

# Verificar
curl https://validador-sefaz-prod.herokuapp.com/health
```

### **Frontend → Vercel**

```bash
cd frontend

# Deploy
npm run build
vercel --prod \
  --env VITE_API_URL=https://validador-sefaz-prod.herokuapp.com
```

**Importante**: Configure `VITE_API_URL` no Vercel Dashboard → Environment Variables

---

## 📋 CHECKLIST RÁPIDO

- [ ] **Terminal 1**: `node dist/index-mock.js` (porta 3000 rodando)
- [ ] **Terminal 2**: `npm run dev` no frontend (porta 5173 rodando)
- [ ] **Navegador**: `http://localhost:5173/` aparece
- [ ] **Login**: Entra com `user@example.com` / `senha123`
- [ ] **Dashboard**: Vê a lista de validações
- [ ] **Validar**: Upload de XML funciona
- [ ] **Resultado**: Vê erros ou aprovado

---

## 🚨 SE ALGO DER ERRADO

### "Port 5173 is in use"
```bash
# Mata tudo Node/Vite
taskkill /F /IM node.exe

# Recomeça do PASSO 2
```

### "Cannot GET /login"
- Vite não iniciou corretamente
- Verifique `npm run dev` output
- Tente `npm install` novamente no frontend

### "Backend não responde"
```bash
# Verifica se está rodando
curl http://localhost:3000/health

# Se não responder, recomeça Terminal 1
```

### "Login falha"
- Verifique que backend está rodando (curl health check)
- Tente limpar localStorage: F12 → Application → localStorage → Clear All
- Recomeça

---

## 🎯 RESULTADO ESPERADO

```
✅ Backend: http://localhost:3000 (rodando)
✅ Frontend: http://localhost:5173 (rodando)  
✅ Login: funcionando
✅ Validação: funcionando
✅ Sistema: 100% funcional localmente
```

---

**Próximo**: Após isso funcionar perfeitamente, podemos fazer deploy em Heroku + Vercel para staging/produção.

**Tempo**: ~30 minutos total
