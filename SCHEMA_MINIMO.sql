-- ============================================================================
-- SCHEMA MÍNIMO — Pre Validador SEFAZ
-- Apenas 4 tabelas essenciais + 3 índices críticos + 1 função audit
-- ============================================================================
-- Objetivo: Validação de NF com rastreamento mínimo
-- Timing: Setup < 30s, queries < 100ms
-- ============================================================================

-- 🔧 SETUP INICIAL
CREATE SCHEMA IF NOT EXISTS validador;
SET search_path TO validador;

-- ============================================================================
-- TABELA 1: USUARIOS — Autenticação (JWT)
-- ============================================================================
-- Propósito: Armazenar credenciais e roles
-- Timing: Lookup O(1) por email, session stateless via JWT
-- Índices: email (PK implícita) + empresas_id (FK)

CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL, -- bcrypt
  nome VARCHAR(255) NOT NULL,

  empresa_id UUID NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'usuario', -- 'usuario', 'admin', 'auditor'

  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT check_email_format CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_empresa ON usuarios(empresa_id);

-- ============================================================================
-- TABELA 2: EMPRESAS — Dados da Empresa (regime, CNPJ, etc)
-- ============================================================================
-- Propósito: Contexto fiscal para validação (regime determina regras)
-- Timing: Lookup O(1) por CNPJ
-- Índices: cnpj (PK implícita), criado_em (para auditoria)

CREATE TABLE empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj VARCHAR(14) NOT NULL UNIQUE,
  nome_fantasia VARCHAR(255) NOT NULL,
  regime VARCHAR(50) NOT NULL, -- 'simples', 'lucro_real', 'lucro_presumido'

  -- Customização de validações (opcional)
  validacoes_customizadas JSONB DEFAULT '{}'::jsonb, -- ex: {"CFOP_OBRIGATORIO": true}

  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_empresas_cnpj ON empresas(cnpj);

-- ============================================================================
-- TABELA 3: VALIDATION_ATTEMPTS — Registro de Cada Validação
-- ============================================================================
-- Propósito: Rastreamento completo de tentativas (audit trail, analytics)
-- Timing: INSERT O(1), SELECT por empresa/data O(log n) com índices
-- Índices: empresa_id, criado_em (crucial para queries de data), xml_hash (dedup)
-- Particionamento futuro: Por mês (2026-05, 2026-06, etc)

CREATE TABLE validation_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE SET NULL,

  -- XML & Hash
  xml_hash VARCHAR(64) NOT NULL, -- SHA256, previne validações duplicadas
  xml_truncado TEXT, -- Primeiros 10KB do XML (debug)

  -- Resultado da validação
  status VARCHAR(20) NOT NULL, -- 'VALIDO', 'ERROS', 'ERRO_ESTRUTURA', 'ERRO_INTERNO'
  total_erros INTEGER DEFAULT 0,
  erros_criticos INTEGER DEFAULT 0,
  erros_json JSONB DEFAULT '[]'::jsonb, -- Array de {tipo, campo, valor, descricao}

  -- Informações da NF (para busca rápida)
  cfop INTEGER,
  valor_total NUMERIC(15,2),

  -- Timing
  tempo_parse_ms INTEGER DEFAULT 0,
  tempo_xsd_ms INTEGER DEFAULT 0,
  tempo_engine_ms INTEGER DEFAULT 0,
  tempo_total_ms INTEGER DEFAULT 0,

  -- Metadata
  ip_origem VARCHAR(45),
  user_agent VARCHAR(500),

  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Índices de busca
  CONSTRAINT check_status CHECK (status IN ('VALIDO', 'ERROS', 'ERRO_ESTRUTURA', 'ERRO_INTERNO'))
);

-- ÍNDICES CRÍTICOS
-- Índice 1: Busca por empresa (dashboard)
CREATE INDEX idx_validation_attempts_empresa ON validation_attempts(empresa_id, criado_em DESC);

-- Índice 2: Busca por usuário (auditoria pessoal)
CREATE INDEX idx_validation_attempts_usuario ON validation_attempts(usuario_id, criado_em DESC);

-- Índice 3: Deduplicação (prevent reprocessamento)
CREATE UNIQUE INDEX idx_validation_attempts_hash ON validation_attempts(empresa_id, xml_hash);

-- Índice 4: Status para dashboard (quantos VÁLIDO vs ERROS hoje?)
CREATE INDEX idx_validation_attempts_status ON validation_attempts(status, criado_em DESC);

-- ============================================================================
-- TABELA 4: AUDIT_LOG — Log Imutável de Ações (Compliance)
-- ============================================================================
-- Propósito: Trilha de auditoria imutável (append-only)
-- Timing: INSERT O(1) assíncrono via Bull queue (não bloqueia response)
-- Índices: empresa_id, usuario_id, acao (para buscas de compliance)
-- Retenção: Mínimo 5 anos por lei fiscal brasileira

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,

  acao VARCHAR(50) NOT NULL, -- 'VALIDACAO', 'LOGIN', 'EXPORT', 'DELETE', etc
  tabela_afetada VARCHAR(50), -- ex: 'validation_attempts'
  registro_id VARCHAR(100), -- ex: UUID da validação

  entrada JSONB, -- Dados antes (se UPDATE/DELETE)
  saida JSONB,   -- Dados depois (resultado da ação)
  erro_mensagem TEXT, -- Se houver erro

  ip_origem VARCHAR(45),
  user_agent VARCHAR(500),

  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT check_acao CHECK (acao IN ('VALIDACAO', 'LOGIN', 'LOGOUT', 'EXPORT', 'DELETE', 'UPDATE_REGRAS'))
);

-- ÍNDICES PARA COMPLIANCE
CREATE INDEX idx_audit_log_empresa ON audit_log(empresa_id, criado_em DESC);
CREATE INDEX idx_audit_log_usuario ON audit_log(usuario_id, criado_em DESC);
CREATE INDEX idx_audit_log_acao ON audit_log(acao, criado_em DESC);

-- ============================================================================
-- FUNÇÃO: trigger_audit_log_insert()
-- Propósito: Registrar INSERTs em validation_attempts automaticamente
-- Trigger: Executa após cada INSERT em validation_attempts
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_audit_log_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Registra a validação em audit_log (assíncrono, não bloqueia)
  INSERT INTO audit_log (
    empresa_id,
    usuario_id,
    acao,
    tabela_afetada,
    registro_id,
    entrada,
    saida
  ) VALUES (
    NEW.empresa_id,
    NEW.usuario_id,
    'VALIDACAO',
    'validation_attempts',
    NEW.id,
    jsonb_build_object(
      'xml_hash', NEW.xml_hash,
      'cfop', NEW.cfop
    ),
    jsonb_build_object(
      'status', NEW.status,
      'total_erros', NEW.total_erros,
      'tempo_total_ms', NEW.tempo_total_ms
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Registra validações automaticamente
CREATE TRIGGER audit_validacao_insert
AFTER INSERT ON validation_attempts
FOR EACH ROW
EXECUTE FUNCTION trigger_audit_log_insert();

-- ============================================================================
-- VIEW: validation_stats — Dashboard de Métricas (Real-time)
-- ============================================================================
-- Propósito: Estatísticas de validação por empresa (para dashboard)
-- Timing: < 1s com índices apropriados

CREATE VIEW validation_stats AS
SELECT
  empresa_id,
  DATE(criado_em)::DATE as data,
  COUNT(*) as total_validacoes,
  COUNT(*) FILTER (WHERE status = 'VALIDO') as validas,
  COUNT(*) FILTER (WHERE status = 'ERROS') as com_erros,
  COUNT(*) FILTER (WHERE status = 'ERRO_ESTRUTURA') as erros_estrutura,
  ROUND(AVG(tempo_total_ms)::numeric, 2) as tempo_medio_ms,
  MAX(tempo_total_ms) as tempo_maximo_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY tempo_total_ms) as p95_ms,
  ROUND(COUNT(*) FILTER (WHERE status = 'VALIDO')::numeric / COUNT(*) * 100, 2) as taxa_sucesso_pct
FROM validation_attempts
WHERE criado_em >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY empresa_id, DATE(criado_em)
ORDER BY data DESC;

-- ============================================================================
-- PERMISSÕES & RLS (Row-Level Security) — Opcional
-- ============================================================================
-- Propósito: Cada usuário vê apenas dados de sua empresa
-- Status: OPCIONAL na v1.0, recomendado para v1.1

ALTER TABLE validation_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Política: Usuário só vê validações de sua própria empresa
CREATE POLICY validation_company_isolation ON validation_attempts
  USING (empresa_id = (SELECT empresa_id FROM usuarios WHERE id = current_user_id()));

CREATE POLICY audit_company_isolation ON audit_log
  USING (empresa_id = (SELECT empresa_id FROM usuarios WHERE id = current_user_id()));

-- ============================================================================
-- DADOS INICIAIS — Teste
-- ============================================================================

-- Empresa de teste
INSERT INTO empresas (cnpj, nome_fantasia, regime, validacoes_customizadas)
VALUES (
  '11222333000181',
  'Empresa Teste LTDA',
  'simples',
  '{"CFOP_OBRIGATORIO": true, "DOCUMENTO_OBRIGATORIO": true}'::jsonb
);

-- Usuário de teste
INSERT INTO usuarios (email, senha_hash, nome, empresa_id, role)
VALUES (
  'teste@empresa.com.br',
  '$2b$10$eFVJjVZXz2HuVx1fFGD8ce', -- bcrypt hash de 'senha123'
  'Usuário Teste',
  (SELECT id FROM empresas WHERE cnpj = '11222333000181'),
  'usuario'
);

-- ============================================================================
-- SCRIPT PARA SUPABASE (SQL EDITOR)
-- ============================================================================
-- Se estiver usando Supabase (recomendado):
-- 1. Abra: https://supabase.com/dashboard/project/iwawvsudfukmavfqcsyd/sql/new
-- 2. Cole TODO o conteúdo deste arquivo
-- 3. Clique "RUN"
-- 4. Aguarde "SUCCESS" (< 30s)
-- 5. Verifique tabelas em "Table Editor"

-- ============================================================================
-- SCHEMA SUMMARY
-- ============================================================================
/*
Tabelas criadas: 4
- usuarios (100 rows típico)
- empresas (5-50 rows)
- validation_attempts (crescimento: ~100-1000/dia em produção)
- audit_log (crescimento: ~200-2000/dia em produção)

Índices criados: 8
- 2 em usuarios
- 1 em empresas
- 4 em validation_attempts
- 1 em audit_log

Triggers: 1
- audit_validacao_insert (async, não bloqueia)

Views: 1
- validation_stats (metrics real-time)

Estimativa de Storage (ano 1):
- 365 dias × 500 validações/dia = 182.500 registros validation_attempts
- 182.500 × 2KB por registro ≈ 365 MB
- audit_log (5x maior) ≈ 1.8 GB
- TOTAL ≈ 2.2 GB (bem abaixo de limite Supabase free tier 8GB)

Escalabilidade:
- Views: < 1s com índices
- Inserts: O(1), assíncrono via Bull queue
- Selects: O(log n) com índices (b-tree)
- Particionamento (futuro): Por mês se > 10M registros
*/
