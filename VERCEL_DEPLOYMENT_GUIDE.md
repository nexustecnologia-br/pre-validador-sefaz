# 🚀 VERCEL DEPLOYMENT GUIDE - PRE_VALIDADOR_SEFAZ

**Status**: ✅ Pronto para Deploy  
**Domínio**: prevalidador_sefaz.nexus-tecnolog.ia.br  
**Última atualização**: 2026-05-21

---

## 📋 O que foi preparado

✅ `/public/index.html` - Interface do validador otimizada para Vercel  
✅ `/api/validar.ts` - Função serverless para validação  
✅ `vercel.json` - Configuração de roteamento e build  
✅ `.vercelignore` - Otimização de deployment  
✅ Todos os arquivos commitados no Git

---

## 🔑 PASSO 1: Autenticar com Vercel

### Opção A: Autenticação via CLI (Recomendado)

Execute no PowerShell (na pasta do projeto):

```powershell
cd "C:\Users\rodri\Desktop\01_DESENVOLVIMENTO\pre_validador_sefaz"
vercel login
```

Isso abrirá uma janela do navegador automaticamente. Você precisará:
1. Fazer login ou criar conta na Vercel (https://vercel.com)
2. Confirmar a autenticação no navegador
3. Voltará automaticamente para o terminal

### Opção B: Autenticação via Dashboard Web

Se o comando acima não abrir o navegador:
1. Visite: https://vercel.com/login
2. Faça login com sua conta (GitHub, GitLab, ou email)
3. Vá para Settings → Tokens
4. Crie um novo token
5. No PowerShell, execute: `$env:VERCEL_TOKEN = "seu-token-aqui"`

---

## 🚀 PASSO 2: Deploy para Vercel

Após autenticar, execute no PowerShell:

```powershell
cd "C:\Users\rodri\Desktop\01_DESENVOLVIMENTO\pre_validador_sefaz"
vercel --prod
```

**Você será perguntado:**
- `Set up project settings for "pre-validador-sefaz"?` → Digite: **y**
- `Which scope should contain your project?` → Escolha a conta pessoal (padrão)
- `Link to existing project?` → Digite: **n** (novo projeto)
- `What's your project's name?` → Digite: **pre-validador-sefaz**
- `In which directory is your code located?` → Pressione ENTER (default: .)

**Aguarde a conclusão:**
- Vercel fará build automático
- Mostrará a URL do seu projeto (ex: `https://pre-validador-sefaz.vercel.app`)
- Deployment concluído ✅

---

## 🌐 PASSO 3: Configurar Domínio Personalizado

### 3.1 No Dashboard Vercel (https://vercel.com/dashboard)

1. Clique no projeto **pre-validador-sefaz**
2. Vá para **Settings** → **Domains**
3. Clique em **Add Domain**
4. Digite o domínio: `prevalidador_sefaz.nexus-tecnolog.ia.br`
5. Clique em **Add**

Vercel mostrará os registros DNS necessários.

### 3.2 Configurar DNS no seu provedor (registrar.br ou Cloudflare)

Você recebará algo como:

```
Type: CNAME
Name: prevalidador_sefaz
Value: cname.vercel-dns.com
TTL: 3600
```

1. Acesse o painel de controle do seu domínio
2. Vá para DNS Settings
3. Adicione um registro CNAME com os valores fornecidos
4. Aguarde 10-30 minutos para propagação

### 3.3 Verificar no Vercel

Volte ao dashboard Vercel e clique em **Verify DNS Configuration**

Quando confirmado, você verá: ✅ **Status: Valid**

---

## ✅ PASSO 4: Testar Deployment

Uma vez que o domínio for validado:

1. Visite: **https://prevalidador_sefaz.nexus-tecnolog.ia.br**
2. Você deve ver a interface do validador
3. Arraste um arquivo XML ou clique para selecionar
4. Clique em "Validar XML"
5. Resultado deve aparecer em < 500ms

**Exemplos de teste:**
- Arquivo válido: `testes/NFE_43260400584835000136550210000143351705040506_0000001299_NFE.xml`
- Arquivo com erro: qualquer XML mal formado

---

## 🔧 VARIÁVEIS DE AMBIENTE (Opcional)

Se precisar adicionar variáveis de ambiente para a API:

1. No dashboard Vercel → Projeto → Settings → Environment Variables
2. Adicione conforme necessário
3. Redeploy: `vercel --prod`

---

## 📊 STATUS APÓS DEPLOYMENT

```
✅ Frontend: https://prevalidador_sefaz.nexus-tecnolog.ia.br
✅ API: /api/validar (endpoint serverless)
✅ Build: Automático a cada push para main
✅ SSL: Automático (HTTPS incluído)
✅ Performance: Globally distributed (CDN)
```

---

## 🆘 TROUBLESHOOTING

### Erro: "Invalid token"
```
$ vercel login
```
Autentique novamente.

### Erro: "CNAME not configured"
- Aguarde 30 minutos para propagação DNS
- Verifique os registros no seu provedor DNS
- Tente: `nslookup prevalidador_sefaz.nexus-tecnolog.ia.br`

### Validador não conecta à API
- Verifique em Chrome DevTools (F12) → Network
- A chamada deve ir para `/api/validar` (não localhost:3000)
- Vercel redireciona automaticamente para `api/validar.ts`

### Build falha
```
$ vercel logs --follow
```
Mostra logs de build em tempo real.

---

## 📝 PRÓXIMOS PASSOS

Após o deployment estar funcionando:

1. **Backup**: Faça git push para repositório remoto (GitHub)
2. **Monitoramento**: Configure alertas no Vercel Dashboard
3. **Analytics**: Viabilizar analytics na seção Monitoring
4. **CI/CD**: Configure GitHub Actions para auto-deploy
5. **Backend**: Caso precise fazer validações reais com SEFAZ, implemente conectores

---

## 🎉 CHECKLIST FINAL

- [ ] `vercel login` executado com sucesso
- [ ] `vercel --prod` executado e deployment concluído
- [ ] Projeto criado em Vercel Dashboard
- [ ] Domínio adicionado: `prevalidador_sefaz.nexus-tecnolog.ia.br`
- [ ] DNS configurado no registrador
- [ ] Domínio validado no Vercel
- [ ] Testado em https://prevalidador_sefaz.nexus-tecnolog.ia.br
- [ ] XMLs validam corretamente
- [ ] Performance < 500ms

---

**Precisa de ajuda?** Verifique:
- Logs Vercel: `vercel logs`
- Documentação: https://vercel.com/docs
- Status: https://www.vercel-status.com

---

**Versão**: 1.0  
**Pronto para**: Deploy Imediato  
**Estimado**: 10 minutos para conclusão

✨ Bom deployment! ✨
