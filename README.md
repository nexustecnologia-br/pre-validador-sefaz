# 🔍 PRE_VALIDADOR_SEFAZ — Especificação Técnica Completa

**Status**: 📋 Especificação | **Rodrigo Rafael** | **2026-05-21**

---

## 🎯 OBJETIVO

Garantir que as notas fiscais sejam **pré-validadas antes do validador oficial da SEFAZ-RS**, reduzindo falhas, reprovações e corrigindo erros ANTES do envio, eliminando reprocessamento.

**Benefício Principal**: Reduzir taxa de rejeição SEFAZ em 80%+ através de validação preventiva com regras atualizadas em tempo real.

---

## 📋 REQUISITOS FUNCIONAIS

### R1: Consulta SEFAZ em Tempo Real
- Conectar com Web Service SEFAZ-RS via SOAP/REST
- Obter regras de validação atualizadas (CFOP, CST, alíquotas, etc.)
- Cache de 24h para performance
- Fallback para últimas regras conhecidas se SEFAZ indisponível

### R2: Regras Customizáveis e Extensíveis
- Definir conjunto de regras específicas por usuário/empresa
- Regras por tipo de operação (CFOP)
- Regras por regime tributário (Simples/Normal/MEI)
- Regras por tipo de documento (NF-e/NFC-e)
- Permitir ativar/desativar regras individuais
- Versionamento de regras com rollback

### R3: Geração de Relatórios
- Relatório estruturado de erros encontrados
- Agrupamento por tipo de erro (CFOP inválido, CST inconsistente, alíquota errada)
- Sugestões de correção automáticas
- Export em JSON/XML/PDF
- Comparação antes/depois da correção

### R4: Execução sem Impacto de Prazo
- Validação em < 500ms (incluso consulta SEFAZ)
- Processamento assíncrono opcional
- Queue para validação em lote
- SLA: 99.9% uptime

### R5: Auditoria Completa
- Log de cada tentativa de validação
- Rastreamento de erros encontrados e corrigidos
- Identificação de usuário que corrigiu
- Timestamp de cada ação
- Rastreabilidade até envio à SEFAZ oficial
- Compliance: LGPD + fiscal requirements

---

## 🔄 FLUXO OPERACIONAL

```
┌─────────────────────────────────────────────────────────────┐
│  USUÁRIO SUBMETE NOTA FISCAL NO SISTEMA                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  PRÉ-VALIDADOR RECEBE NOTA (XML)                             │
│  • Parse XML                                                 │
│  • Extrai dados: CFOP, CST, ICMS, PIS, COFINS, etc          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  APLICA REGRAS DE VALIDAÇÃO                                  │
│  • Consulta cache/SEFAZ para regras atualizadas              │
│  • Valida CFOP contra lista oficial                          │
│  • Valida CST x CFOP x Regime Tributário                     │
│  • Valida alíquotas                                          │
│  • Verifica documentos obrigatórios                          │
│  • Verifica campos matemáticos (subtotais, totais)           │
└────────────────────┬────────────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
    ✅ VÁLIDA            ❌ COM ERROS
          │                     │
          ▼                     ▼
    ┌─────────┐        ┌────────────────┐
    │ RETORNA │        │ GERA RELATÓRIO │
    │ OK      │        │ COM ERROS +    │
    │         │        │ SUGESTÕES      │
    └────┬────┘        └────┬───────────┘
         │                  │
         │                  ▼
         │            ┌─────────────────┐
         │            │ USUÁRIO CORRIGE │
         │            │ NOTA (UI)       │
         │            └────┬────────────┘
         │                 │
         │                 ▼
         │            ┌─────────────────┐
         │            │ REVALIDAÇÃO     │
         │            └────┬────────────┘
         │                 │
         └─────────┬───────┘
                   │
                   ▼
    ┌──────────────────────────────┐
    │ LOG AUDITORIA                │
    │ • Tentativa X (data/hora)    │
    │ • Erros encontrados          │
    │ • Correções aplicadas        │
    │ • Usuário responsável        │
    └──────────────────────────────┘
                   │
                   ▼
    ┌──────────────────────────────┐
    │ NOTA SEGUE PARA SEFAZ        │
    │ (Validador Oficial)          │
    └──────────────────────────────┘
```

---

## ✅ CRITÉRIOS DE ACEITAÇÃO

### CA1: Validação de CFOP Incorreto
```
Entrada: CFOP 9999 (inválido)
Esperado: ❌ Erro "CFOP inválido. CFOPs válidos: 5102, 5101, 5202..."
Sugestão: "Você usou CFOP 9999. Operação de venda? Tente 5102."
```

### CA2: Validação de CST x CFOP Inconsistente
```
Entrada: 
  - CFOP: 5102 (Venda para outra UF)
  - CST: 60 (Tributada pelo Simples Nacional)
Esperado: ❌ Erro "CST 60 incompatível com CFOP 5102 em regime Normal"
Sugestão: "Para CFOP 5102, use CST: 00, 20, 70, 90"
```

### CA3: Validação de CST/ICMS
```
Entrada:
  - CST: 40 (Isento)
  - ICMS: R$ 500 (não pode ter valor se isento)
Esperado: ❌ Erro "CST 40 (Isento) não permite valor de ICMS"
Resultado: Sugere zekar ICMS
```

### CA4: Validação de Documento Fiscal
```
Entrada: NF-e sem Série
Esperado: ❌ Erro "Série é obrigatória em NF-e"
Sugestão: "Complete com série padrão (1, 2, etc)"
```

### CA5: Logs com Rastreamento Completo
```
Auditoria esperada:
  Tentativa #1 [2026-05-21 14:32:15]
  - Usuário: rodrigo.rafael@empresa.com
  - Nota: 123456 / Série: 1
  - Erros: 3 (CFOP, CST, ICMS)
  - Status: REJEITADA
  
  Tentativa #2 [2026-05-21 14:35:42]
  - Correções: CFOP 9999→5102, CST 60→00, ICMS zerado
  - Status: ✅ APROVADA
  - Enviada à SEFAZ em 2026-05-21 14:36:01
```

### CA6: Performance
```
Validação < 500ms (incluso SEFAZ)
Batch de 100 notas < 45 segundos
Cache hit: < 10ms
```

---

## 🏗️ ARQUITETURA TÉCNICA

### Stack
```
Frontend:
  • React 18 (Dashboard + Upload)
  • TypeScript
  • TailwindCSS

Backend:
  • Node.js (Express)
  • PostgreSQL (audit log + cache)
  • Redis (cache regras SEFAZ)
  • Queue: Bull (validação assíncrona)

Integração SEFAZ:
  • SOAP (WebService SEFAZ-RS)
  • REST API (fallback)
  • SDK: nfe-utils (parsing XML)

Deploy:
  • Vercel (Frontend + API)
  • AWS RDS (PostgreSQL)
  • AWS ElastiCache (Redis)
```

### Serviços Principais

```
1. XMLParser Service
   - Parse nota fiscal XML
   - Extrai CFOP, CST, ICMS, etc.
   - Valida estrutura XML básica

2. RulesEngine Service
   - Carrega regras SEFAZ (cache + real-time)
   - Aplica validações customizáveis
   - Retorna lista de erros + sugestões

3. SefazConnector Service
   - Conecta com WebService SEFAZ-RS
   - Consulta regras atualizadas
   - Cache com invalidação de 24h

4. AuditLogger Service
   - Log estruturado de cada tentativa
   - Rastreamento de correções
   - Compliance com LGPD

5. ReportGenerator Service
   - Gera relatório de erros
   - Sugestões de correção
   - Export JSON/XML/PDF

6. ValidationQueue Service
   - Processa validações em paralelo
   - Batch processing
   - Retry automático
```

---

## 📊 ESTRUTURA DE DADOS

### Tabela: validation_attempts
```sql
CREATE TABLE validation_attempts (
  id UUID PRIMARY KEY,
  empresa_id UUID NOT NULL,
  usuario_id UUID NOT NULL,
  nf_numero INT,
  nf_serie INT,
  nf_xml BYTEA,
  
  tentativa_numero INT,
  data_tentativa TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20), -- PENDENTE, VALIDANDO, APROVADA, REJEITADA
  
  erros_encontrados JSONB, -- [{tipo, campo, valor, mensagem, sugestao}]
  tempo_validacao_ms INT,
  
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);
```

### Tabela: validation_rules
```sql
CREATE TABLE validation_rules (
  id UUID PRIMARY KEY,
  empresa_id UUID,
  nome VARCHAR(255), -- ex: "CFOP válidos", "CST x CFOP"
  tipo VARCHAR(100), -- CFOP, CST, ICMS, DOCUMENTO, CAMPO
  descricao TEXT,
  
  regra_json JSONB, -- Estrutura da regra (flexível)
  ativa BOOLEAN DEFAULT TRUE,
  prioridade INT,
  
  versao INT,
  data_criacao TIMESTAMP DEFAULT NOW(),
  criado_por UUID
);
```

### Tabela: sefaz_cache
```sql
CREATE TABLE sefaz_cache (
  id UUID PRIMARY KEY,
  tipo_regra VARCHAR(100), -- CFOP, CST, etc
  dados JSONB, -- Regras em cache
  ultima_atualizacao TIMESTAMP DEFAULT NOW(),
  proxima_atualizacao TIMESTAMP,
  fonte VARCHAR(100) -- SEFAZ_LIVE, SEFAZ_FALLBACK, LOCAL
);
```

---

## 🔌 API ENDPOINTS

### POST /api/validar
Valida uma nota fiscal XML

```http
POST /api/validar
Content-Type: application/json

{
  "xml": "<NFe>...</NFe>",
  "empresa_id": "uuid",
  "modo": "sync|async"
}

Response 200:
{
  "status": "APROVADA" | "REJEITADA",
  "tentativa_id": "uuid",
  "tempo_ms": 245,
  "erros": [
    {
      "tipo": "CFOP",
      "campo": "CFOP",
      "valor_encontrado": "9999",
      "mensagem": "CFOP inválido",
      "sugestao": "Use CFOP 5102"
    }
  ],
  "relatorio_pdf": "https://..."
}
```

### GET /api/validacao/:id
Busca resultado de validação anterior

```http
GET /api/validacao/uuid-tentativa

Response 200:
{
  "id": "uuid",
  "status": "APROVADA",
  "tentativas": [
    {
      "numero": 1,
      "data": "2026-05-21T14:32:15Z",
      "erros": [...],
      "status": "REJEITADA"
    },
    {
      "numero": 2,
      "data": "2026-05-21T14:35:42Z",
      "erros": [],
      "status": "APROVADA"
    }
  ]
}
```

### GET /api/audit
Log de auditoria

```http
GET /api/audit?empresa_id=uuid&data_inicio=2026-05-01&data_fim=2026-05-31

Response 200:
{
  "total": 1234,
  "registros": [
    {
      "data": "2026-05-21T14:36:01Z",
      "usuario": "rodrigo.rafael@empresa.com",
      "nf": "123456/1",
      "acao": "validacao_aprovada",
      "detalhes": {...}
    }
  ]
}
```

### POST /api/regras/customizar
Define regras específicas da empresa

```http
POST /api/regras/customizar
Content-Type: application/json

{
  "empresa_id": "uuid",
  "regra": {
    "nome": "CFOP válidos para venda interestadual",
    "tipo": "CFOP",
    "valores_permitidos": [5102, 5202],
    "ativa": true
  }
}

Response 201:
{
  "id": "uuid",
  "versao": 1,
  "criada_em": "2026-05-21T14:32:15Z"
}
```

---

## 🧪 TESTES AUTOMATIZADOS

### Teste 1: CFOP Inválido
```javascript
describe('Validação CFOP', () => {
  it('deve rejeitar CFOP 9999', async () => {
    const xml = gerarXML({ cfop: '9999' });
    const resultado = await validador.validar(xml);
    
    expect(resultado.status).toBe('REJEITADA');
    expect(resultado.erros[0].tipo).toBe('CFOP');
    expect(resultado.erros[0].mensagem).toContain('inválido');
  });
});
```

### Teste 2: CST Inconsistente
```javascript
it('deve rejeitar CST 60 com CFOP 5102', async () => {
  const xml = gerarXML({ 
    cfop: '5102', 
    cst: '60',
    regime: 'NORMAL'
  });
  const resultado = await validador.validar(xml);
  
  expect(resultado.status).toBe('REJEITADA');
  expect(resultado.erros[0].tipo).toBe('CST_CFOP_INCONSISTENT');
});
```

### Teste 3: Auditoria
```javascript
it('deve logar tentativa de validação', async () => {
  const xml = gerarXML({ cfop: '5102' });
  await validador.validar(xml);
  
  const logs = await auditLog.buscar({ nf: '123456' });
  expect(logs.length).toBe(1);
  expect(logs[0].usuario).toBe('usuario@empresa.com');
  expect(logs[0].data).toBeDefined();
});
```

---

## 🚀 IMPLEMENTAÇÃO (ROADMAP)

### Sprint 1: Foundation (Semana 1)
- [ ] Setup Node.js + Express
- [ ] Integração PostgreSQL + Redis
- [ ] Parser XML básico
- [ ] Serviço de Auditoria

### Sprint 2: Validação Core (Semana 2)
- [ ] RulesEngine (CFOP, CST, ICMS)
- [ ] SEFAZ Connector (SOAP)
- [ ] ReportGenerator
- [ ] Testes unitários (20+)

### Sprint 3: UI + Integração (Semana 3)
- [ ] Dashboard React
- [ ] Upload de XML
- [ ] Visualização de erros
- [ ] API endpoints

### Sprint 4: Deploy (Semana 4)
- [ ] Vercel deployment
- [ ] AWS RDS + ElastiCache
- [ ] Testes E2E
- [ ] Documentação

---

## 📈 MÉTRICAS DE SUCESSO

| Métrica | Target | Crítico |
|---------|--------|---------|
| Taxa de detecção de erros SEFAZ | 85%+ | 70%+ |
| Tempo de validação | < 500ms | < 1000ms |
| Uptime | 99.9% | 99% |
| Taxa de falso positivo | < 5% | < 10% |
| Tempo de correção (usuário) | < 2 min | < 5 min |
| Auditoria: 100% rastreável | ✅ | ✅ |

---

## 📚 Referências

- SEFAZ-RS WebServices: https://www.sefaz.rs.gov.br/
- Manual NF-e: https://www1.nfe.fazenda.gov.br/
- CFOP: https://www.sefaz.rs.gov.br/legislacao/cfop/
- CST: https://www1.nfe.fazenda.gov.br/cst/

---

**Preparado por**: GRATIDÃO Sistema Cognitivo  
**Autoridade**: Rodrigo Rafael  
**Data**: 2026-05-21  
**Status**: 📋 Especificação Completa | 🚀 Pronta para Implementação
