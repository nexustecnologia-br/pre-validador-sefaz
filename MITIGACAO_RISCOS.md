# 🛡️ MITIGAÇÃO DE RISCOS — Fallbacks & Contingências

**Objetivo**: Identificar os 10 maiores riscos do projeto e ter planos de contingência prontos.

**Filosofia**: "Esperamos pelo melhor, planejamos pelo pior."

---

## 🎯 FRAMEWORK DE RISCOS

Cada risco tem:
- **Probabilidade**: Alta / Média / Baixa
- **Impacto**: Crítico / Alto / Médio / Baixo
- **Mitigação**: Ações preventivas (pré-risco)
- **Contingência**: Plano B se risco ocorrer
- **Owner**: Quem monitora

---

## 🔴 RISCO 1: SEFAZ API Muda Regras (Crítico)

**Descrição**: SEFAZ-RS altera lista de CFOPs, alíquotas ou CSTs válidos no meio do projeto

**Probabilidade**: Média (acontece ~2x/ano)  
**Impacto**: Crítico (valida incorretamente após mudança)

### Mitigação (Preventiva)

```typescript
// 1. Versionamento de regras
interface RuleVersion {
  version: string; // "2026-05-21"
  cfopsValidos: number[];
  cstPorCfop: Record<number, string[]>;
  dataVigencia: string;
  dataFim?: string;
}

// 2. Store múltiplas versões
const rulesHistory = new Map<string, RuleVersion>([
  ["2026-05-21", { cfopsValidos: [...], ... }],
  ["2026-04-01", { cfopsValidos: [...], ... }],
  ["2026-03-15", { cfopsValidos: [...], ... }],
]);

// 3. Validação com versão
public validateWithVersion(nf, version = "latest") {
  const rules = version === "latest" 
    ? this.rulesHistory.get(this.latestVersion)
    : this.rulesHistory.get(version);
  
  if (!rules) throw new Error(`Rules version ${version} not found`);
  return this.validate(nf, rules);
}

// 4. Webhooks SEFAZ (subscribe to changes)
POST /webhook/sefaz-rules-changed
{
  timestamp: "2026-05-21T14:30:00Z",
  changes: {
    added: { cfops: [9900], ... },
    removed: { cfops: [...], ... },
    modified: { aliquotas: [...], ... }
  }
}
```

### Contingência (Se Risco Ocorrer)

```bash
# PASSO 1: Detecta mudança (webhook dispara, ou Dev 1 avisou)
# PASSO 2: Gera nova RuleVersion
npm run rules:update --source sefaz-api

# PASSO 3: Valida todas as NFs pendentes com nova versão
npm run rules:revalidate-pending --old-version 2026-05-21 --new-version 2026-05-22

# PASSO 4: Notifica clientes (email)
npm run notifications:send --to all-users --subject "Regras SEFAZ atualizadas"

# PASSO 5: Marca versão antiga como deprecated
npm run rules:deprecate --version 2026-05-21

# PASSO 6: Monitorar 24h
- Se taxa de erro sobe > 5% → rollback imediato
- Se OK → commit nova versão para main
```

### Monitoramento

```sql
-- Query: Monitorar mudanças de taxa de erro por versão de regra
SELECT 
  rule_version,
  DATE(criado_em) as data,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'ERROS') as erros,
  ROUND(COUNT(*) FILTER (WHERE status = 'ERROS')::numeric / COUNT(*) * 100, 2) as taxa_erro_pct
FROM validation_attempts
WHERE criado_em >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY rule_version, DATE(criado_em)
ORDER BY data DESC, taxa_erro_pct DESC;
```

---

## 🔴 RISCO 2: SEFAZ API Offline (Crítico)

**Descrição**: SEFAZ-RS fica offline durante validação

**Probabilidade**: Média (manutenção ~2x/mês, duração ~1-4 horas)  
**Impacto**: Crítico (usuários não conseguem enviar NFs)

### Mitigação (Preventiva)

```typescript
// 1. Circuit breaker pattern
class SefazConnectorWithCircuitBreaker {
  private circuitState = 'CLOSED'; // CLOSED -> OPEN -> HALF_OPEN
  private failureCount = 0;
  private lastFailureTime = null;
  private threshold = 5; // 5 falhas = abre circuito
  private timeout = 60000; // 60s espera antes de tentar HALF_OPEN

  async call(request) {
    // Se circuito ABERTO, falha rápido
    if (this.circuitState === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.circuitState = 'HALF_OPEN'; // Tenta recuperar
      } else {
        throw new Error('SEFAZ temporariamente indisponível');
      }
    }

    try {
      const response = await this.sefazApi.call(request);
      this.circuitState = 'CLOSED'; // Reset
      this.failureCount = 0;
      return response;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.threshold) {
        this.circuitState = 'OPEN';
      }
      throw error;
    }
  }
}

// 2. Retry com exponential backoff
async callSefazWithRetry(request, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await this.sefazConnector.call(request);
    } catch (error) {
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      console.log(`Retry ${attempt + 1} em ${delay}ms`);
      await sleep(delay);
    }
  }
  throw new Error('SEFAZ indisponível após 3 tentativas');
}

// 3. Cache + fallback
async validateWithSefaz(nf) {
  try {
    // Tenta SEFAZ primeiro
    return await this.callSefazWithRetry(nf);
  } catch (error) {
    // Se falha, usa último cache válido
    const cachedResponse = await redis.get(`sefaz_response:${nf.hash}`);
    if (cachedResponse) {
      console.log('SEFAZ offline, usando cache de 24h atrás');
      return JSON.parse(cachedResponse);
    }

    // Se nem cache, retorna PENDENTE
    return {
      status: 'PENDENTE',
      motivo: 'SEFAZ offline, tente novamente em 5 minutos',
      retentarEm: new Date(Date.now() + 5 * 60000)
    };
  }
}

// 4. Fila de retry assíncrona
// Se SEFAZ falha, job entra em fila para tentar de novo
queue.on('failed', async (job, error) => {
  if (error.message.includes('SEFAZ')) {
    // Re-queue com backoff exponencial
    const nextAttempt = job.attemptsMade ? Math.pow(2, job.attemptsMade) * 60000 : 60000;
    await job.log(`Retentando em ${nextAttempt}ms`);
    await job.updateProgress(0);
    // Bull automatically retries com delay
  }
});
```

### Contingência (Se Risco Ocorrer)

```bash
# OPÇÃO 1: SEFAZ offline, mas validação local OK
# Usuário vê: "Validação local OK ✅ | Envio SEFAZ adiado (offline)"
{
  "status": "PENDENTE",
  "validacao_local": "VALIDO",
  "envio_sefaz": "ADIADO",
  "motivo": "SEFAZ temporariamente indisponível",
  "retentar_em": "2026-05-21T15:30:00Z",
  "sugestao": "Clique 'Reenviar para SEFAZ' em 5 minutos"
}

# OPÇÃO 2: Auto-resubmit quando SEFAZ voltar
# Job fica em fila, automaticamente resubmete quando circuito fecha
SELECT COUNT(*) FROM validation_attempts 
WHERE status = 'PENDENTE' AND motivo LIKE '%SEFAZ%';
-- Output: 152 validações aguardando SEFAZ

# OPÇÃO 3: Manual trigger se necessário
npm run jobs:resubmit-pending --filter "status=PENDENTE AND motivo LIKE '%SEFAZ%'"
-- Output: 152 jobs resubmitted

# Monitore dashboard
- [Dashboard] Validações Pendentes: 152
- [Alert] SEFAZ offline há 2h - Page on-call
```

### Monitoramento

```typescript
// Sentry/DataDog alert
if (sefazErrorRate > 50%) {
  alert("SEFAZ error rate > 50%", {
    severity: "CRITICAL",
    action: "Page SRE, open war room",
    fallback: "Circuit breaker ativado, users veem PENDENTE"
  });
}

// Metrics dashboard
- SEFAZ latency (p50, p95, p99)
- SEFAZ error rate (%)
- Circuit breaker state (CLOSED, HALF_OPEN, OPEN)
- Queue size (pending retries)
```

---

## 🟠 RISCO 3: Database Lento/Locked (Alto)

**Descrição**: PostgreSQL fica lento ou queries ficam bloqueadas (lock contention)

**Probabilidade**: Média (pode acontecer sob carga alta)  
**Impacto**: Alto (resposta > 2s, users veem timeout)

### Mitigação (Preventiva)

```sql
-- 1. Índices adequados (já em SCHEMA_MINIMO.sql)
CREATE INDEX idx_validation_attempts_empresa ON validation_attempts(empresa_id, criado_em DESC);
CREATE INDEX idx_validation_attempts_status ON validation_attempts(status, criado_em DESC);

-- 2. EXPLAIN para queries lentas
EXPLAIN ANALYZE SELECT * FROM validation_attempts 
WHERE empresa_id = $1 AND criado_em > NOW() - INTERVAL '7 days'
ORDER BY criado_em DESC LIMIT 20;
-- Expected: < 100ms

-- 3. Particionamento por data (future, se > 10M rows)
CREATE TABLE validation_attempts_2026_05 PARTITION OF validation_attempts
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- 4. Query timeout
SET statement_timeout = 5000; -- 5s max per query

-- 5. Connection pooling
MAX_CONNECTIONS = 100
DATABASE_POOL_MIN = 2
DATABASE_POOL_MAX = 20 (não esgota limite do servidor)

-- 6. Read replicas para dashboard queries (future)
SELECT * FROM validation_attempts -- reads from replica
WHERE empresa_id = $1 AND status = 'VALIDO';
```

### Contingência (Se Risco Ocorrer)

```typescript
// Fallback para cache se database lento
async function getValidationsDashboard(empresaId, {forceCache = false} = {}) {
  const cacheKey = `dashboard:${empresaId}`;
  
  // Tenta cache primeiro se database suspeito
  if (forceCache) {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  }

  try {
    const startTime = Date.now();
    const data = await database.query(`
      SELECT ... FROM validation_attempts 
      WHERE empresa_id = $1
      LIMIT 20
    `, [empresaId]);
    
    const queryTime = Date.now() - startTime;
    
    if (queryTime > 2000) {
      console.warn(`Slow query detected (${queryTime}ms), caching result`);
      await redis.setex(cacheKey, 300, JSON.stringify(data)); // Cache 5 min
    }
    
    return data;
  } catch (error) {
    if (error.code === 'STATEMENT_TIMEOUT') {
      // Database muito lento, usa cache
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.warn('Database timeout, falling back to cache (30s old)');
        return JSON.parse(cached);
      }
    }
    throw error;
  }
}

// Alerta se database problema
if (queryTime > 1000) {
  slack.notify({
    channel: "#alerts",
    text: `⚠️ Slow query detected: ${queryTime}ms`,
    action: "Check database CPU/IO, consider adding index"
  });
}
```

---

## 🟠 RISCO 4: XMLParser Crashes (Alto)

**Descrição**: XML malformado causa crash do parser (out of memory, malicious entity expansion)

**Probabilidade**: Média (sempre há usuários com XMLs corrompidos)  
**Impacto**: Alto (endpoint retorna 500, perda de dados se não logger)

### Mitigação (Preventiva)

```typescript
// 1. Sandbox XML parsing
import { parseString } from 'xml2js';

const options = {
  // Prevent entity expansion attacks (Billion Laughs)
  strict: true,
  emptyTag: undefined,
  normalize: true,
  normalizeTags: true,
  
  // Limits
  maxParseSize: 10 * 1024 * 1024, // 10MB max
  preserveChildrenOrder: false,
};

// 2. Timeout no parser
async function parseXMLWithTimeout(xmlContent, timeoutMs = 5000) {
  return Promise.race([
    parseString(xmlContent, options),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('XML parsing timeout')), timeoutMs)
    )
  ]);
}

// 3. Schema validation FIRST (before deep parsing)
function validateXMLStructure(xmlContent) {
  // Check size
  if (xmlContent.length > 10 * 1024 * 1024) {
    throw new Error('XML muito grande (>10MB)');
  }

  // Check for XML bomb patterns
  if (xmlContent.includes('<!ENTITY') || xmlContent.includes('SYSTEM')) {
    throw new Error('XML com entidades suspeitas (XXE vulnerability)');
  }

  // Basic structure check
  if (!xmlContent.includes('<?xml') || !xmlContent.includes('</')) {
    throw new Error('XML estrutura inválida');
  }
}

// 4. Error handling
try {
  validateXMLStructure(xmlContent);
  const parsed = await parseXMLWithTimeout(xmlContent);
  return parsed;
} catch (error) {
  if (error.message.includes('timeout')) {
    return {
      status: 'ERRO_ESTRUTURA',
      erro: 'XML muito complexo ou parsing lento',
      codigo: 'XML_TIMEOUT'
    };
  }

  return {
    status: 'ERRO_ESTRUTURA',
    erro: error.message,
    codigo: 'XML_PARSE_ERROR'
  };
}
```

### Contingência (Se Risco Ocorrer)

```bash
# 1. Isolate problematic XML
npm run debug:analyze-xml --hash abc123def456

# 2. Re-parse com debug mode
LOG_LEVEL=debug npm run validate --xml-hash abc123def456

# 3. Se XML realmente ruim, descarte e notifique user
npm run notifications:send-to-user --user-id xyz --subject "XML rejeitado" \
  --message "Seu XML falhou no parser. Verifique formato e tente novamente."

# 4. Rollback parser se versão quebrada
git revert abc123 (revert parser change)
npm run db:update-failed-validations --parser-version old
```

---

## 🟠 RISCO 5: RulesEngine Performance Degrada (Alto)

**Descrição**: RulesEngine começa retornando > 500ms (memory leak? cache corruption?)

**Probabilidade**: Baixa (engine é stateless, não tem state que degrada)  
**Impacto**: Alto (POST /validar timeout)

### Mitigação (Preventiva)

```typescript
// 1. Memory profiling
import { performance } from 'perf_hooks';

class RulesEngineWithMetrics {
  private metrics = {
    totalValidations: 0,
    totalTime: 0,
    slowValidations: [],
  };

  public validate(nf, regime) {
    const start = performance.now();
    const result = this._validate(nf, regime);
    const duration = performance.now() - start;

    this.metrics.totalValidations++;
    this.metrics.totalTime += duration;

    if (duration > 300) {
      this.metrics.slowValidations.push({
        duration,
        nf: nf.cfop,
        timestamp: new Date()
      });
    }

    return result;
  }

  public getMetrics() {
    return {
      avgTime: this.metrics.totalTime / this.metrics.totalValidations,
      maxTime: Math.max(...this.metrics.slowValidations.map(s => s.duration)),
      slowCount: this.metrics.slowValidations.length,
      slowValidations: this.metrics.slowValidations.slice(-10) // Last 10
    };
  }
}

// 2. Alert se performance degrad
setInterval(() => {
  const metrics = rulesEngine.getMetrics();
  if (metrics.avgTime > 250) {
    console.warn('⚠️ RulesEngine degrading', metrics);
    // Possible causes:
    // - JavaScript garbage collection
    // - Node memory pressure
    // - Load spike
  }
}, 60000); // Check every 60s

// 3. Heap snapshot (memory leak detection)
if (process.memoryUsage().heapUsed > 500 * 1024 * 1024) {
  const snapshot = heapdump.writeSnapshot();
  console.warn(`Heap dump written to ${snapshot}`);
  // Analyze with Chrome DevTools
}

// 4. Load testing
npm run load-test --concurrency 100 --duration 60s --target-rps 1000
```

### Contingência (Se Risco Ocorrer)

```bash
# 1. Detect degradation
curl http://localhost:3000/health/metrics
{
  "rulesEngine": {
    "avgTime": 450, // ⚠️ > 300ms target
    "maxTime": 2100,
    "slowCount": 15
  }
}

# 2. Immediate action
# Option A: Restart process (quick fix, temporary)
pm2 restart app

# Option B: Investigate root cause
node --inspect=:9229 src/index.ts
# Connect Chrome DevTools, profiler, find memory leak

# Option C: Revert if recent change
git log --oneline -10
git revert abc123 # Revert suspected change

# 3. Post-mortem
# - Was it memory leak? (Node memory grew unbounded?)
# - Was it GC? (Pause > 300ms during collection?)
# - Was it load spike? (check concurrent requests at time of slowness)
# - Was it data corruption? (was rules data valid?)
```

---

## 🟡 RISCO 6: Desenvolvimento Behind Schedule (Médio)

**Descrição**: Dev 1 ou Dev 2 fica atrasado na semana 1-2

**Probabilidade**: Média (sempre há surpresas)  
**Impacto**: Médio (afeta integração e timeline)

### Mitigação (Preventiva)

```markdown
## Timeline com buffer

**Semana 1**: 5 endpoints
- Dev 1: seg-ter (XMLParser + RulesEngine)
  - **Buffer**: Qua-qui reserved para bugs/debugging
  - **Minimum viable**: 3 endpoints pronto for Dev 2 by Thursday
  - **Fallback**: Se atrasado, dev 2 continua com mocks

**Semana 2**: SEFAZ real + E2E
- Dev 1: seg-ter SEFAZ connector
  - **Buffer**: Qua-qui for fallback implementation (@nfe/utils library)
  - **Minimum viable**: Mock SEFAZ working by Friday
  - **Fallback**: Usar mock SEFAZ response, deploy sem real integration

**Semana 3**: Production
- Dev 1-2: seg-ter hardening + optimization
  - **Buffer**: Qua-qui for last-minute fixes
  - **Minimum viable**: Production deploy with warnings on Slack
  - **Fallback**: Deploy to staging, not production yet
```

### Contingência (Se Risco Ocorrer)

```bash
# OPÇÃO 1: Descope non-critical features
# Semana 1 prioridades:
# MUST: XMLParser, RulesEngine, POST /validar, GET /validacoes
# CAN SKIP: GET /validacao/:id detail page, export feature

# Reroute skipped tasks para v1.1
git commit -m "SKIP: Export feature #123 - moved to v1.1"

# OPÇÃO 2: Pair programming (conhecimento transfer)
# Dev 2 ajuda Dev 1 debuggar XMLParser no meio da qua
# Dev 1 ajuda Dev 2 integração frontend no meio da qui

# OPÇÃO 3: Extend timeline (honest conversation)
# Se Dev 1 está 3 dias atrasado na semana 1:
#  - Tuesday evening: "Aviso, XMLParser + RulesEngine não sai terça"
#  - Wednesday: Renegotiate timeline
#  - Maybe: Extend semana 1 para quarta, push semana 2 para quinta

# OPÇÃO 4: Reduce scope
# Se não consegue integração SEFAZ na semana 2:
# Deploy com validação local apenas (RulesEngine)
# SEFAZ integration = hotfix na semana 3
```

---

## 🟡 RISCO 7: Deploy Falha (Médio)

**Descrição**: GitHub Actions falha, Vercel deploy broken, database migration error

**Probabilidade**: Média (sempre há surpresas em produção)  
**Impacto**: Médio (se rápido fix, < 30 min downtime)

### Mitigação (Preventiva)

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npm run test:unit
      - run: npm run test:integration
      # REQUIRE ALL TESTS TO PASS
  
  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - run: npm run build
      - run: npm run db:migrate --env staging
      - run: npm run seed --env staging
      - run: npm run test:e2e --env staging
      - run: vercel deploy --token=$VERCEL_TOKEN (frontend)
      - run: heroku deploy (backend)
      # ONLY IF ALL TESTS PASS

  deploy-production:
    needs: deploy-staging
    # MANUAL APPROVAL BEFORE PRODUCTION
    environment: production
    steps:
      - run: vercel deploy --prod (frontend)
      - run: heroku scale (backend)
      # Blue-green deploy if possible
```

### Contingência (Se Risco Ocorrer)

```bash
# CENÁRIO 1: Database migration fails in production
# -> Rollback imediato
npm run db:rollback --version previous
git revert abc123

# CENÁRIO 2: Frontend Vercel deploy broken
# -> Rollback em Vercel
vercel rollback --to production-stable

# CENÁRIO 3: Backend API completely down
# -> Switch to previous version
heroku releases:rollback v123

# CENÁRIO 4: Partial outage (some regions down)
# -> Blue-green deploy
# Current version runs as "blue"
# New version starts as "green"
# If green fails health check, kill it, stay on blue
```

---

## 🟡 RISCO 8: User Data Loss (Crítico)

**Descrição**: Validação processada mas não registrada em audit_log (usuário pensa que foi enviado, mas não)

**Probabilidade**: Baixa (ambas operações são atômicas)  
**Impacto**: Crítico (compliance/fiscal issue)

### Mitigação (Preventiva)

```typescript
// 1. Transactional atomicity
async function validarComAuditoria(xmlContent, usuarioId, empresaId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 1. Insert validation attempt
    const resultadoValidacao = await executeRulesEngine(xmlContent);
    const validacaoId = await client.query(`
      INSERT INTO validation_attempts (
        empresa_id, usuario_id, xml_hash, status, erros_json, ...
      ) VALUES ($1, $2, $3, $4, $5, ...)
      RETURNING id
    `, [empresaId, usuarioId, xmlHash, status, errors]);

    // 2. Insert audit log (SAME transaction)
    await client.query(`
      INSERT INTO audit_log (
        empresa_id, usuario_id, acao, tabela_afetada, registro_id, saida
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [empresaId, usuarioId, 'VALIDACAO', 'validation_attempts', validacaoId, resultadoValidacao]);

    // 3. Commit tudo junto (all or nothing)
    await client.query('COMMIT');

    return { success: true, validacaoId };
  } catch (error) {
    await client.query('ROLLBACK');
    return { success: false, error };
  } finally {
    client.release();
  }
}

// 2. Double-write (backup)
// Além de PostgreSQL, também escreve em S3 (imutável)
async function backupValidacao(validacaoId, dados) {
  await s3.putObject({
    Bucket: 'validador-backups',
    Key: `2026-05/${validacaoId}.json`,
    Body: JSON.stringify(dados),
    ServerSideEncryption: 'AES256'
  });
}

// 3. Verification query
// Nightly check: confirma que audit_log matches validation_attempts
SELECT COUNT(*) as audit_count FROM audit_log WHERE tabela_afetada = 'validation_attempts' AND DATE(criado_em) = CURRENT_DATE;
SELECT COUNT(*) as validation_count FROM validation_attempts WHERE DATE(criado_em) = CURRENT_DATE;
-- Should be equal
```

### Contingência (Se Risco Ocorrer)

```bash
# Detectado discrepância
audit_count = 100
validation_count = 102 # 2 validações sem audit log!

# AÇÃO 1: Identifica validações órfãs
SELECT id, usuario_id, empresa_id FROM validation_attempts va
LEFT JOIN audit_log al ON va.id = al.registro_id AND al.tabela_afetada = 'validation_attempts'
WHERE al.id IS NULL AND va.criado_em > NOW() - INTERVAL '1 day';

# AÇÃO 2: Cria audit logs retroativos
INSERT INTO audit_log (empresa_id, usuario_id, acao, tabela_afetada, registro_id, criado_em)
SELECT empresa_id, usuario_id, 'VALIDACAO', 'validation_attempts', id, criado_em
FROM validation_attempts
WHERE id IN (orphaned_ids);

# AÇÃO 3: Notifica compliance officer
# "2 validações teve registros faltantes em auditoria, agora restaurados."

# AÇÃO 4: Investigação root cause
# - Era transaction falha?
# - Era trigger não-executado?
# - Era conexão perdida?
```

---

## 📊 DASHBOARD DE RISCOS

```typescript
// Real-time risk dashboard (for team)
interface RiskMetrics {
  sefazAvailability: number; // 0-100%
  databaseLatencyP95: number; // ms
  memoryUsage: number; // %
  errorRate: number; // %
  pendingValidations: number; // count
  circuitBreakerState: 'CLOSED' | 'HALF_OPEN' | 'OPEN';
}

// Alert thresholds
const THRESHOLDS = {
  sefazAvailability: 95, // < 95% = alert
  databaseLatencyP95: 500, // > 500ms = alert
  memoryUsage: 80, // > 80% = alert
  errorRate: 1, // > 1% = alert
  pendingValidations: 100, // > 100 = alert
};

// Webhook to Slack
for (const [metric, value] of Object.entries(currentMetrics)) {
  const threshold = THRESHOLDS[metric];
  if (value > threshold) {
    slack.notify({
      channel: '#alerts',
      text: `🚨 ALERT: ${metric} = ${value} (threshold: ${threshold})`,
      color: 'red'
    });
  }
}
```

---

## ✅ PRÉ-DEPLOYMENT CHECKLIST

Antes de cada deploy (Staging ou Production):

- [ ] Todos os testes passando (unit + integration + E2E)
- [ ] Database migrations testados em staging
- [ ] Rollback procedure documentado + testado
- [ ] Monitoring + alerts configurados
- [ ] Oncall SRE disponível (se production)
- [ ] Feature flags preparadas (para rollout gradual)
- [ ] Notificações para usuários prontas
- [ ] Runbook para incident response atualizado
- [ ] Backup status verificado
- [ ] Load test passou em staging
- [ ] Security audit passou (OWASP Top 10)
- [ ] Performance targets atingidos (P95 < 500ms)

---

## 📞 ESCALATION MATRIX

```
SEVERIDADE          | RESPOSTA TIME | OWNER
=====================================
Crítico (P1)        | 15 min        | Dev 1 + Dev 2 + Manager
Alto (P2)           | 1 hora        | Dev 1 ou Dev 2 (on-rotation)
Médio (P3)          | 4 horas       | Dev on-call
Baixo (P4)          | Next sprint   | Backlog
```

---

## 🎯 SUCCESS CRITERIA FOR RISK MITIGATION

- [ ] Risco 1 (SEFAZ Rules Change): Rule versioning implementado, tested
- [ ] Risco 2 (SEFAZ Offline): Circuit breaker + cache fallback working
- [ ] Risco 3 (DB Slow): Índices em place, query < 100ms
- [ ] Risco 4 (XML Parser): Sandbox + timeout working
- [ ] Risco 5 (RulesEngine Perf): Metrics tracked, alerts configured
- [ ] Risco 6 (Schedule Slip): Buffer time in timeline, contingency plans documented
- [ ] Risco 7 (Deploy Fails): Blue-green deploy, rollback tested
- [ ] Risco 8 (Data Loss): Atomicity verified, backup system working

---

**Status**: ✅ PREPARADO PARA CONTINGÊNCIAS  
**Review**: A cada semana durante desenvolvimento  
**Última atualização**: 2026-05-21
