# 🔍 DIAGNÓSTICO — Por que a senha não funciona

## 1️⃣ VERIFICAR NO NAVEGADOR (F12)

Abra seu navegador em http://localhost:5173/

Pressione **F12** para abrir Developer Tools

### Passo 1: Vá em **Console**
- Digite isto e pressione Enter:
```javascript
fetch('http://localhost:3000/health').then(r => r.json()).then(d => console.log(d))
```

**Esperado**: Verá `{status: 'ok', ...}`

Se vir erro de **CORS**, o problema é aí.

---

### Passo 2: Teste o login
```javascript
fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({email: 'user@example.com', senha: 'senha123'})
}).then(r => r.json()).then(d => console.log(d))
```

**Esperado**: Vê um token JWT (começa com `eyJ...`)

**Se vir erro**: Copie e cole aqui para eu analisar

---

## 2️⃣ VERIFICAR ABA "NETWORK"

1. Abra **F12 → Network**
2. Tente fazer login no formulário
3. Veja a requisição `/api/auth/login`
4. Clique nela
5. Veja:
   - **Status**: Deve ser 200
   - **Response**: Deve ter `token` e `usuario`
   - **Error**: Se houver, mostra qual é

---

## 3️⃣ VERIFICAR ERRO EXATO

No **Console** (F12), após tentar login, procure por:
- ❌ "CORS error"
- ❌ "404 Not Found"
- ❌ "Cannot POST /api/auth/login"
- ❌ "Network error"

**Copie a mensagem de erro exata e me passa!**

---

## 4️⃣ CHECKLIST RÁPIDO

- [ ] Backend está rodando em localhost:3000?
  ```
  curl http://localhost:3000/health
  ```

- [ ] Frontend está rodando em localhost:5173?
  ```
  http://localhost:5173/ → vê página?
  ```

- [ ] Consegue fazer fetch para health check?
  ```
  F12 → Console → fetch('/api/health')
  ```

- [ ] Erro é CORS, 404, ou timeout?
  ```
  F12 → Network → vê o erro?
  ```

---

## 🆘 ME PASSA:

Quando você tentar fazer login:

1. **Erro exato** que aparece (screenshot ou texto)
2. **Status code** na aba Network (200, 404, 500, etc)
3. **Resposta da API** (se houver)
4. **Console error** (F12 → Console)

Com isso eu consigo arrumar em 5 minutos! 🎯
