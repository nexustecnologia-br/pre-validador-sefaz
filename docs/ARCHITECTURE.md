# 🏗️ ARQUITETURA — pre_validador_sefaz

**Versão**: 1.0 | **Data**: 2026-05-21

---

## 📐 VISÃO GERAL DA ARQUITETURA

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                          │
│  • Dashboard                                                 │
│  • Upload XML                                                │
│  • Visualização Erros                                        │
│  • Relatórios                                                │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS/REST
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    API GATEWAY (Express)                     │
│  • Autenticação JWT                                          │
│  • Rate Limiting                                             │
│  • Logging HTTP                                              │
│  • CORS                                                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
    ┌────────┐  ┌──────────┐  ┌──────────┐
    │Validar │  │Audit Log │  │Rules Mgmt│
    │NF      │  │API       │  │API       │
    └────┬───┘  └──────────┘  └──────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│             CORE SERVICES LAYER                              │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐    │
│  │XMLParser    │  │RulesEngine   │  │SefazConnector  │    │
│  │Service      │  │Service       │  │Service         │    │
│  └─────────────┘  └──────────────┘  └────────────────┘    │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐   │
│  │AuditLogger   │  │ReportGen     │  │CacheManager    │   │
│  │Service       │  │Service       │  │Service         │   │
│  └──────────────┘  └──────────────┘  └────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
    ┌────────┐  ┌──────────┐  ┌──────────┐
    │PostgreSQL      │  │Redis (Cache)  │  │Bull Queue    │
    │Audit Log       │  │Regras SEFAZ   │  │Validações    │
    │Rules           │  │               │  │Async         │
    │Validações      │  │               │  │              │
    └────────┘  └──────────┘  └──────────┘
        │              │              │
        └──────────────┼──────────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │  SEFAZ WebServices   │
            │  (SOAP/REST)         │
            └──────────────────────┘
```

---

## 🔧 COMPONENTES PRINCIPAIS

### 1. XMLParser Service

**Responsabilidade**: Parse e extração de dados de NF-e XML

```typescript
class XMLParserService {
  parse(xmlBuffer: Buffer): NFDiscriminada {
    // Parse XML
    // Extrai: CFOP, CST, ICMS, PIS, COFINS
    // Validação estrutural básica
    // Retorna objeto estruturado
  }
  
  validate(nf: NFDiscriminada): ValidationError[] {
    // Validações estruturais
    // Campos obrigatórios
    // Tipos de dados
  }
}
```

**Entrada**: Buffer de XML bruto  
**Saída**: Objeto `NFDiscriminada` estruturado  
**Erros**: XML malformado, falta de campos obrigatórios

---

### 2. RulesEngine Service

**Responsabilidade**: Aplicar regras de validação

```typescript
class RulesEngineService {
  async validate(
    nf: NFDiscriminada, 
    rules: ValidationRule[]
  ): Promise<ValidationError[]> {
    const errors = [];
    
    for (const rule of rules) {
      const ruleErrors = await this.applyRule(nf, rule);
      errors.push(...ruleErrors);
    }
    
    return errors;
  }
  
  private async applyRule(
    nf: NFDiscriminada, 
    rule: ValidationRule
  ): Promise<ValidationError[]> {
    // Aplicar lógica específica da regra
    // CFOP: verificar lista válida
    // CST: verificar compatibilidade com CFOP
    // ICMS: verificar alíquotas
    // etc
  }
}
```

**Entrada**: NF + Array de regras  
**Saída**: Array de erros encontrados  
**Regras Suportadas**:
- CFOP válido
- CST x CFOP compatível
- CST x Regime tributário
- Alíquotas válidas
- Campos obrigatórios por tipo
- Validações matemáticas

---

### 3. SefazConnector Service

**Responsabilidade**: Conectar com SEFAZ em tempo real

```typescript
class SefazConnectorService {
  async fetchLatestRules(tipo: 'CFOP' | 'CST' | 'ALIQUOTA'): Promise<Rule[]> {
    // Consultar cache primeiro (Redis)
    // Se não existe ou expirou (24h):
    //   - Conectar com SEFAZ via SOAP
    //   - Obter regras atualizadas
    //   - Armazenar em cache
    // Retornar regras
  }
  
  async validateWithSefaz(nf: NFDiscriminada): Promise<SefazResponse> {
    // Opcional: pré-validação com SEFAZ
    // (feedback mais preciso, mas mais lento)
  }
}
```

**Cache Strategy**:
- TTL: 24 horas
- Key: `sefaz:cfop`, `sefaz:cst`, etc
- Fallback: Última cópia conhecida se SEFAZ indisponível

**Integração SEFAZ**:
```
SEFAZ-RS SOAP:
https://nfe.sefaz.rs.gov.br/webservices/NfeConsultaStatusServico/NfeConsultaStatusServico.asmx

WSDL: 
https://nfe.sefaz.rs.gov.br/webservices/NfeConsultaStatusServico/NfeConsultaStatusServico.asmx?wsdl
```

---

### 4. AuditLogger Service

**Responsabilidade**: Registrar toda atividade para compliance

```typescript
class AuditLoggerService {
  async log(event: AuditEvent): Promise<void> {
    // Registrar em PostgreSQL
    // Campos: usuario, acao, nf, data, detalhes
    // Imutável (append-only)
  }
  
  async queryAudit(
    filters: AuditFilter
  ): Promise<AuditEvent[]> {
    // Buscar logs com filtros
    // usuario, data_inicio, data_fim, nf, acao
  }
}

interface AuditEvent {
  id: UUID;
  usuario_id: UUID;
  empresa_id: UUID;
  nf_numero: number;
  nf_serie: number;
  acao: 'validacao_iniciada' | 'validacao_aprovada' | 'validacao_rejeitada' | 'correcao_aplicada';
  detalhes: JSON;
  timestamp: DateTime;
  ip_origem: string;
  user_agent: string;
}
```

**Retenção**: Mínimo 2 anos (requisito fiscal)

---

### 5. ReportGenerator Service

**Responsabilidade**: Gerar relatórios de validação

```typescript
class ReportGeneratorService {
  generateReport(validacao: Validacao): Report {
    return {
      titulo: `Relatório de Validação #${validacao.id}`,
      data: validacao.data,
      nf: `${validacao.nf_numero}/${validacao.nf_serie}`,
      
      erros: validacao.erros.map(e => ({
        campo: e.campo,
        valor: e.valor,
        mensagem: e.mensagem,
        sugestao: e.sugestao
      })),
      
      resumo: {
        total_erros: validacao.erros.length,
        erros_criticos: validacao.erros.filter(e => e.critico).length,
        tempo_validacao_ms: validacao.tempo_ms,
        status: validacao.status
      },
      
      proximos_passos: this.gerarProximosPassos(validacao.erros)
    };
  }
  
  exportPDF(report: Report): Buffer {
    // Usar puppeteer ou similar
    // Gerar PDF profissional
  }
}
```

**Formatos Suportados**: JSON, XML, PDF, CSV

---

## 📊 DATA FLOW — Validação Completa

```
1. USUÁRIO SUBMETE XML
   ├─ Upload arquivo
   ├─ Sistema recebe em /api/validar
   └─ Gera ID de tentativa

2. PARSER SERVICE
   ├─ Parse XML
   ├─ Extrai dados
   └─ Retorna objeto NF

3. CACHE MANAGER
   ├─ Busca regras em Redis
   ├─ Se miss → SefazConnector
   └─ Retorna regras atualizadas

4. RULES ENGINE
   ├─ Itera sobre cada regra
   ├─ Aplica lógica de validação
   └─ Acumula erros

5. RESULTADO
   ├─ Estrutura resposta
   ├─ Gera relatório
   └─ Retorna ao usuário

6. AUDITORIA
   ├─ Log da tentativa
   ├─ Erros encontrados
   └─ Usuário responsável
```

---

## 🔐 SEGURANÇA

### Autenticação
```
JWT Token:
- Válido por 24 horas
- Refresh token por 30 dias
- Payload: usuario_id, empresa_id, roles
```

### Autorização
```
Roles:
- ADMIN: Tudo
- VALIDADOR: Validar NFes
- VIEWER: Apenas consultar relatórios
- RULES_EDITOR: Customizar regras
```

### Rate Limiting
```
- 100 validações por minuto por usuário
- 1000 validações por minuto por empresa
- Burst: +50% por 10 segundos
```

### Criptografia
```
- Dados em repouso: AES-256
- Dados em trânsito: TLS 1.3
- Backup: Encrypted
```

---

## 📈 PERFORMANCE

### Benchmarks Alvo

```
Parse XML: < 50ms
RulesEngine: < 300ms
Cache hit: < 10ms
Cache miss (SEFAZ): < 200ms
Total: < 500ms (percentil 95)
```

### Batch Processing

```
Bull Queue:
- Consumidores paralelos: 5
- Timeout: 30 segundos
- Retry: 3 tentativas com backoff exponencial
- DLQ (Dead Letter Queue) para falhas críticas
```

### Caching Strategy

```
Redis:
- Regras SEFAZ: TTL 24h
- NF validadas: TTL 1h (opcional)
- Cache size: 100MB

PostgreSQL:
- Índices em: tentativa_numero, status, empresa_id
- Particionamento por data para audit_log (mensal)
```

---

## 🚀 DEPLOYMENT

### Arquitetura de Deploy

```
GitHub → CI/CD (GitHub Actions) → Vercel + AWS

Frontend:
  ├─ Vercel (React SPA)
  ├─ Auto-deploy em push para main
  └─ Preview builds para PRs

Backend:
  ├─ Vercel Serverless (Express)
  ├─ Cold start: ~500ms (aceitável)
  └─ Escalamento automático

Data Tier:
  ├─ AWS RDS (PostgreSQL 14+)
  ├─ Multi-AZ para HA
  └─ Backup automatizado

Cache:
  ├─ AWS ElastiCache (Redis)
  ├─ Standby para failover
  └─ Monitoring automático
```

### Environment Variables

```
.env:
  NODE_ENV=production
  DATABASE_URL=postgresql://...
  REDIS_URL=redis://...
  JWT_SECRET=...
  SEFAZ_ENDPOINT=...
  SEFAZ_CERT=...
  AWS_REGION=us-east-1
```

---

## 📚 Stack Decisões

| Decisão | Escolha | Razão |
|---------|---------|-------|
| **Linguagem** | TypeScript | Type safety + DX |
| **Framework Web** | Express | Simples, maduro |
| **ORM** | TypeORM | Type-safe + migrations |
| **Validation** | Joi + Custom | Flexible |
| **Queue** | Bull/Redis | Robusto, confiável |
| **Deploy** | Vercel + AWS | Escalável, custo eficiente |
| **Auth** | JWT | Stateless, escalável |
| **Cache** | Redis | Rápido, confiável |
| **SOAP** | node-soap | Bem mantido |

---

## 📞 Suporte + Troubleshooting

### "Validação muito lenta" → 
- Verificar hit rate do cache Redis
- Verificar latência de SEFAZ
- Aumentar consumidores Bull se batch

### "Erro de memória em SEFAZ parse" →
- NF muito grande (> 10MB)? Rejeitar
- XML malformado? Mensagem de erro clara

### "Auditoria fora de sync" →
- Verificar replicação PostgreSQL
- Logs duplicados? Deduplicação por ID

---

**Preparado por**: GRATIDÃO  
**Versão**: 1.0 | **Data**: 2026-05-21  
**Status**: ✅ Arquitetura Aprovada
