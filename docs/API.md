# 🔌 API SPECIFICATION — pre_validador_sefaz

**Versão**: 1.0 | **Base URL**: `/api/v1` | **Auth**: JWT Bearer Token

---

## 📋 ÍNDICE

1. [Autenticação](#autenticacao)
2. [Validação](#validacao)
3. [Auditoria](#auditoria)
4. [Regras](#regras)
5. [Relatórios](#relatorios)
6. [Empresas](#empresas)

---

## 🔐 AUTENTICAÇÃO

### POST /auth/login
Faz login e obtém JWT token

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "usuario@empresa.com",
  "senha": "senha_secreta"
}

Response 200:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id": "uuid",
    "email": "usuario@empresa.com",
    "nome": "João Silva",
    "role": "VALIDADOR"
  },
  "expira_em": "2026-05-22T14:32:15Z"
}

Response 401:
{
  "erro": "Email ou senha incorretos"
}
```

### POST /auth/refresh
Renova JWT token usando refresh token

```http
POST /api/v1/auth/refresh
Content-Type: application/json
Authorization: Bearer {refresh_token}

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

Response 200:
{
  "token": "novo_token...",
  "expira_em": "2026-05-22T14:32:15Z"
}
```

### POST /auth/logout
Faz logout (invalida tokens se necessário)

```http
POST /api/v1/auth/logout
Authorization: Bearer {token}

Response 200:
{
  "mensagem": "Desconectado com sucesso"
}
```

---

## ✅ VALIDAÇÃO

### POST /validar
Valida uma nota fiscal XML

```http
POST /api/v1/validar
Content-Type: application/json
Authorization: Bearer {token}

{
  "xml": "<NFe>...</NFe>",
  "modo": "sync",
  "callback_url": "https://seu-sistema.com/webhook/validacao" // opcional para async
}

Response 200 (Síncrone):
{
  "id": "uuid-tentativa",
  "status": "APROVADA" | "REJEITADA",
  "nf": {
    "numero": 123456,
    "serie": 1,
    "cfop": "5102",
    "cst": "00"
  },
  "validacao": {
    "tempo_ms": 245,
    "data": "2026-05-21T14:32:15Z"
  },
  "erros": [
    {
      "tipo": "CFOP",
      "campo": "cfop",
      "valor_encontrado": "9999",
      "valor_esperado": ["5102", "5202"],
      "mensagem": "CFOP inválido",
      "sugestao": "Para venda interestadual, use CFOP 5102",
      "critico": true,
      "peso": 100
    }
  ],
  "relatorio": {
    "titulo": "Validação #uuid",
    "resumo": {
      "total_erros": 1,
      "erros_criticos": 1,
      "erros_avisos": 0
    },
    "link_pdf": "https://...",
    "link_json": "https://..."
  }
}

Response 202 (Assíncrono):
{
  "id": "uuid-tentativa",
  "status": "PROCESSANDO",
  "mensagem": "Validação iniciada. Resultado será entregue em {callback_url}",
  "poll_url": "/api/v1/validacao/uuid-tentativa"
}

Response 400 (Erro de validação):
{
  "erro": "XML malformado",
  "detalhes": "Erro ao fazer parse do XML: linhas 15-20"
}

Response 401:
{
  "erro": "Não autorizado"
}

Response 429:
{
  "erro": "Rate limit excedido",
  "retry_em": 60 // segundos
}
```

**Parâmetros**:
- `xml` (string, obrigatório): Conteúdo do XML da nota fiscal
- `modo` (string, opcional): "sync" (padrão) ou "async"
- `callback_url` (string, condicional): Obrigatório se modo = "async"

**Headers**:
- `Authorization: Bearer {token}` (obrigatório)
- `Content-Type: application/json`

---

### GET /validacao/:id
Busca o resultado de uma validação anterior

```http
GET /api/v1/validacao/uuid-tentativa
Authorization: Bearer {token}

Response 200:
{
  "id": "uuid-tentativa",
  "status": "APROVADA",
  "nf": {
    "numero": 123456,
    "serie": 1
  },
  "tentativas": [
    {
      "numero": 1,
      "data": "2026-05-21T14:32:15Z",
      "status": "REJEITADA",
      "tempo_ms": 245,
      "erros": [
        {
          "tipo": "CFOP",
          "mensagem": "CFOP inválido"
        }
      ]
    },
    {
      "numero": 2,
      "data": "2026-05-21T14:35:42Z",
      "status": "APROVADA",
      "tempo_ms": 198,
      "erros": []
    }
  ],
  "data_envio_sefaz": "2026-05-21T14:36:01Z"
}

Response 404:
{
  "erro": "Validação não encontrada"
}
```

---

### GET /validacoes/minhas
Lista validações do usuário logado

```http
GET /api/v1/validacoes/minhas?pagina=1&limite=20&status=REJEITADA&data_inicio=2026-05-01&data_fim=2026-05-31
Authorization: Bearer {token}

Response 200:
{
  "pagina": 1,
  "total": 156,
  "limite": 20,
  "validacoes": [
    {
      "id": "uuid",
      "nf": "123456/1",
      "status": "REJEITADA",
      "erros": 2,
      "data": "2026-05-21T14:32:15Z",
      "tempo_ms": 245
    }
  ]
}
```

**Query Parameters**:
- `pagina` (int, opcional): Página de resultados (padrão 1)
- `limite` (int, opcional): Itens por página (padrão 20, máximo 100)
- `status` (string, opcional): "APROVADA" | "REJEITADA"
- `data_inicio` (string, opcional): "2026-05-01"
- `data_fim` (string, opcional): "2026-05-31"

---

## 📊 AUDITORIA

### GET /audit
Log de auditoria (apenas ADMIN, VIEWER, RULES_EDITOR)

```http
GET /api/v1/audit?usuario_id=uuid&acao=validacao_aprovada&data_inicio=2026-05-01&limite=100
Authorization: Bearer {token}

Response 200:
{
  "total": 1234,
  "registros": [
    {
      "id": "uuid",
      "usuario": {
        "id": "uuid",
        "email": "usuario@empresa.com",
        "nome": "João Silva"
      },
      "acao": "validacao_aprovada",
      "nf": "123456/1",
      "detalhes": {
        "tempo_ms": 245,
        "erros_encontrados": 0
      },
      "ip_origem": "192.168.1.1",
      "data": "2026-05-21T14:32:15Z"
    }
  ],
  "proxima_pagina": "/api/v1/audit?offset=100&limite=100"
}

Response 403:
{
  "erro": "Acesso negado. Apenas ADMIN, VIEWER e RULES_EDITOR podem ver auditoria"
}
```

**Query Parameters**:
- `usuario_id` (uuid, opcional): Filtrar por usuário
- `acao` (string, opcional): Tipo de ação
- `nf` (string, opcional): Número da NF (123456/1)
- `data_inicio` (string, opcional)
- `data_fim` (string, opcional)
- `offset` (int, opcional): Paginação (padrão 0)
- `limite` (int, opcional): Itens por página (máximo 1000)

**Ações disponíveis**:
- `validacao_iniciada`
- `validacao_aprovada`
- `validacao_rejeitada`
- `correcao_aplicada`
- `regra_customizada`
- `export_relatorio`
- `login`
- `logout`

---

## 📋 REGRAS

### GET /regras
Lista regras de validação (globais + customizadas)

```http
GET /api/v1/regras?tipo=CFOP&ativa=true
Authorization: Bearer {token}

Response 200:
{
  "regras": [
    {
      "id": "uuid",
      "nome": "CFOP válidos",
      "tipo": "CFOP",
      "descricao": "Lista de CFOPs válidos",
      "ativa": true,
      "prioridade": 100,
      "escopo": "global" | "empresa",
      "versao": 1,
      "data_criacao": "2026-05-20T00:00:00Z",
      "regra": {
        "cfops_validos": [5102, 5202, 6102, 6202, 5109, 6109]
      }
    }
  ]
}
```

### POST /regras
Cria regra customizada (ADMIN, RULES_EDITOR)

```http
POST /api/v1/regras
Content-Type: application/json
Authorization: Bearer {token}

{
  "nome": "CFOP válidos para empresa X",
  "tipo": "CFOP",
  "descricao": "Apenas vendas interestadual permitidas",
  "ativa": true,
  "prioridade": 110,
  "regra": {
    "cfops_permitidos": [5102, 5202],
    "cfops_bloqueados": [1102]
  }
}

Response 201:
{
  "id": "uuid-nova-regra",
  "criada_em": "2026-05-21T14:32:15Z",
  "versao": 1
}

Response 403:
{
  "erro": "Acesso negado. Apenas RULES_EDITOR e ADMIN podem criar regras"
}
```

### PATCH /regras/:id
Atualiza regra existente

```http
PATCH /api/v1/regras/uuid
Content-Type: application/json
Authorization: Bearer {token}

{
  "ativa": false,
  "regra": {
    "cfops_permitidos": [5102]
  }
}

Response 200:
{
  "id": "uuid",
  "versao": 2,
  "atualizado_em": "2026-05-21T14:35:42Z"
}
```

### DELETE /regras/:id
Deleta (desativa) regra customizada

```http
DELETE /api/v1/regras/uuid
Authorization: Bearer {token}

Response 204:
(sem corpo)

Response 400:
{
  "erro": "Não é possível deletar regra global. Apenas desative com PATCH"
}
```

---

## 📄 RELATÓRIOS

### GET /relatorios
Lista relatórios salvos

```http
GET /api/v1/relatorios?data_inicio=2026-05-01&limite=50
Authorization: Bearer {token}

Response 200:
{
  "total": 45,
  "relatorios": [
    {
      "id": "uuid",
      "titulo": "Validação NF 123456/1",
      "validacao_id": "uuid",
      "data_criacao": "2026-05-21T14:32:15Z",
      "downloads": {
        "pdf": "https://...",
        "json": "https://...",
        "csv": "https://..."
      }
    }
  ]
}
```

### POST /relatorios/:validacao_id/exportar
Gera e salva relatório em múltiplos formatos

```http
POST /api/v1/relatorios/uuid-validacao/exportar
Content-Type: application/json
Authorization: Bearer {token}

{
  "formatos": ["pdf", "json", "csv"],
  "titulo": "Validação NF 123456/1",
  "incluir_auditoria": true
}

Response 201:
{
  "relatorio_id": "uuid",
  "arquivos": {
    "pdf": "https://...relatorio-uuid.pdf",
    "json": "https://...relatorio-uuid.json",
    "csv": "https://...relatorio-uuid.csv"
  },
  "criado_em": "2026-05-21T14:36:01Z"
}
```

---

## 🏢 EMPRESAS

### GET /empresa/dados
Dados da empresa logada

```http
GET /api/v1/empresa/dados
Authorization: Bearer {token}

Response 200:
{
  "id": "uuid",
  "razao_social": "Minha Empresa LTDA",
  "cnpj": "12345678000190",
  "regime_tributario": "NORMAL",
  "estado": "RS",
  "validacoes_mes": 1234,
  "validacoes_aprovadas": 1100,
  "taxa_aprovacao": 89.2,
  "tempo_medio_validacao_ms": 245
}
```

### GET /empresa/estatisticas
Dashboard de estatísticas da empresa

```http
GET /api/v1/empresa/estatisticas?periodo=30d
Authorization: Bearer {token}

Response 200:
{
  "periodo": "30 dias",
  "resumo": {
    "total_validacoes": 4500,
    "aprovadas": 4050,
    "rejeitadas": 450,
    "taxa_aprovacao": 90
  },
  "erros_top_10": [
    {
      "tipo": "CFOP_INVALIDO",
      "ocorrencias": 180,
      "percentual": 40
    },
    {
      "tipo": "CST_INCONSISTENTE",
      "ocorrencias": 90,
      "percentual": 20
    }
  ],
  "performance": {
    "tempo_medio_ms": 245,
    "tempo_maximo_ms": 1250,
    "tempo_minimo_ms": 50,
    "percentil_95_ms": 800
  },
  "validacoes_diarias": [
    { "data": "2026-05-21", "total": 150, "aprovadas": 135 },
    { "data": "2026-05-20", "total": 145, "aprovadas": 130 }
  ]
}
```

---

## 🔄 WEBHOOKS (Async Callbacks)

Quando modo = "async", resultado é enviado para seu `callback_url`:

```http
POST {callback_url}
Content-Type: application/json
X-Signature: sha256=hmac_signature

{
  "evento": "validacao_completa",
  "tentativa_id": "uuid",
  "nf": {
    "numero": 123456,
    "serie": 1
  },
  "status": "APROVADA" | "REJEITADA",
  "erros": [...],
  "tempo_ms": 245,
  "timestamp": "2026-05-21T14:32:15Z"
}
```

**Segurança**:
- `X-Signature`: HMAC SHA256 = `HMAC-SHA256(corpo + secret, api_key)`
- Você deve validar assinatura antes de processar

---

## ⚡ RATE LIMITS

| Endpoint | Limite | Janela |
|----------|--------|--------|
| /validar | 100 | 1 minuto |
| /validacoes/minhas | 1000 | 1 minuto |
| /audit | 500 | 1 minuto |
| /relatorios | 100 | 1 minuto |

**Resposta quando excedido**:
```json
{
  "erro": "Rate limit excedido",
  "limite": 100,
  "janela": "1m",
  "proxima_janela_em": 45,
  "retry_em": 45
}
```

---

## 🔍 CÓDIGOS DE ERRO

| Código | Meaning | Ação |
|--------|---------|------|
| 200 | OK | Sucesso |
| 201 | Created | Recurso criado |
| 202 | Accepted | Processamento async iniciado |
| 204 | No Content | Deletado com sucesso |
| 400 | Bad Request | Dados inválidos |
| 401 | Unauthorized | Falta autenticação |
| 403 | Forbidden | Sem permissão |
| 404 | Not Found | Recurso não existe |
| 429 | Too Many Requests | Rate limit |
| 500 | Server Error | Erro interno |

---

## 📚 EXEMPLOS COMPLETOS

### Fluxo 1: Validação Síncrona
```bash
# 1. Login
curl -X POST https://api.validador.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@empresa.com","senha":"senha"}'

# Retorna: {"token":"eyJ...", "refresh_token":"eyJ..."}

# 2. Validar NF
curl -X POST https://api.validador.com/api/v1/validar \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"xml":"<NFe>...</NFe>","modo":"sync"}'

# Retorna: {"id":"uuid","status":"APROVADA|REJEITADA","erros":[...]}

# 3. Exportar Relatório
curl -X POST https://api.validador.com/api/v1/relatorios/uuid/exportar \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"formatos":["pdf","json"]}'
```

---

**Versão**: 1.0  
**Data**: 2026-05-21  
**Status**: ✅ Especificação Completa
