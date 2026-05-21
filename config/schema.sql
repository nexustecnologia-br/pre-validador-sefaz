-- ============================================================================
-- PRE_VALIDADOR_SEFAZ — Schema PostgreSQL
-- Auditoria + Validações + Regras + Cache
-- ============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- PHASE 1: Usuários e Autenticação
-- ============================================================================

CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    nome VARCHAR(255) NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,

    empresa_id UUID NOT NULL,
    role VARCHAR(50) DEFAULT 'VALIDADOR', -- ADMIN, VALIDADOR, VIEWER, RULES_EDITOR

    ativo BOOLEAN DEFAULT TRUE,
    ultimo_acesso TIMESTAMP,

    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT role_check CHECK (role IN ('ADMIN', 'VALIDADOR', 'VIEWER', 'RULES_EDITOR'))
);

CREATE TABLE empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    razao_social VARCHAR(255) NOT NULL,
    cnpj VARCHAR(14) NOT NULL UNIQUE,

    regime_tributario VARCHAR(50), -- NORMAL, SIMPLES, MEI
    estado VARCHAR(2), -- UF

    ativa BOOLEAN DEFAULT TRUE,
    data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE usuarios ADD CONSTRAINT fk_usuarios_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresas(id);

-- ============================================================================
-- PHASE 2: Validações
-- ============================================================================

CREATE TABLE validation_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),

    -- Identificação da NF
    nf_numero INT NOT NULL,
    nf_serie INT NOT NULL,
    nf_xml BYTEA NOT NULL, -- XML completo armazenado (importante para auditoria)

    -- Tentativa e status
    numero_tentativa INT NOT NULL, -- 1, 2, 3... (múltiplas tentativas para mesma NF)
    status VARCHAR(50) DEFAULT 'PENDENTE', -- PENDENTE, VALIDANDO, APROVADA, REJEITADA

    -- Dados extraídos
    cfop VARCHAR(4),
    cst VARCHAR(3),
    icms_valor NUMERIC(15, 2),
    icms_aliquota NUMERIC(5, 2),
    regime_tributario VARCHAR(50),

    -- Erros encontrados
    erros_encontrados JSONB, -- [{tipo, campo, valor, mensagem, sugestao, critico}]

    -- Performance
    tempo_validacao_ms INT,

    -- Timestamps
    data_tentativa TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_aprovacao TIMESTAMP,

    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT status_check CHECK (status IN ('PENDENTE', 'VALIDANDO', 'APROVADA', 'REJEITADA'))
);

CREATE INDEX idx_validation_attempts_empresa ON validation_attempts(empresa_id);
CREATE INDEX idx_validation_attempts_usuario ON validation_attempts(usuario_id);
CREATE INDEX idx_validation_attempts_nf ON validation_attempts(nf_numero, nf_serie);
CREATE INDEX idx_validation_attempts_status ON validation_attempts(status);
CREATE INDEX idx_validation_attempts_data ON validation_attempts(data_tentativa);

-- ============================================================================
-- PHASE 3: Regras de Validação
-- ============================================================================

CREATE TABLE validation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID, -- NULL = regra global

    -- Identificação
    nome VARCHAR(255) NOT NULL,
    tipo VARCHAR(100) NOT NULL, -- CFOP, CST, ICMS, DOCUMENTO, CAMPO, CUSTOM
    descricao TEXT,

    -- Configuração
    regra_json JSONB NOT NULL, -- Estrutura da regra (flexível por tipo)

    -- Status
    ativa BOOLEAN DEFAULT TRUE,
    prioridade INT DEFAULT 100,

    -- Versionamento
    versao INT DEFAULT 1,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    criado_por UUID REFERENCES usuarios(id),

    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT tipo_check CHECK (tipo IN ('CFOP', 'CST', 'ICMS', 'DOCUMENTO', 'CAMPO', 'CUSTOM'))
);

CREATE INDEX idx_rules_empresa ON validation_rules(empresa_id);
CREATE INDEX idx_rules_ativa ON validation_rules(ativa);
CREATE INDEX idx_rules_tipo ON validation_rules(tipo);

-- ============================================================================
-- PHASE 4: Cache SEFAZ
-- ============================================================================

CREATE TABLE sefaz_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- O que está em cache
    tipo_regra VARCHAR(100) NOT NULL, -- CFOP, CST, ALIQUOTA, etc

    -- Dados em cache
    dados JSONB NOT NULL,

    -- Controle de cache
    fonte VARCHAR(100) DEFAULT 'SEFAZ_LIVE', -- SEFAZ_LIVE, SEFAZ_FALLBACK, LOCAL
    hash_dados VARCHAR(64), -- SHA256 do JSON para deduplicação

    -- Timestamps de validade
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultima_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    proxima_atualizacao TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),

    CONSTRAINT fonte_check CHECK (fonte IN ('SEFAZ_LIVE', 'SEFAZ_FALLBACK', 'LOCAL'))
);

CREATE INDEX idx_cache_tipo ON sefaz_cache(tipo_regra);
CREATE INDEX idx_cache_proxima_atualizacao ON sefaz_cache(proxima_atualizacao);

-- ============================================================================
-- PHASE 5: Auditoria Completa
-- ============================================================================

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Quem fez
    usuario_id UUID REFERENCES usuarios(id),
    empresa_id UUID NOT NULL REFERENCES empresas(id),

    -- O que fez
    acao VARCHAR(100) NOT NULL, -- validacao_iniciada, validacao_aprovada, correcao_aplicada, regra_customizada

    -- Onde (contexto)
    nf_numero INT,
    nf_serie INT,
    validation_attempt_id UUID REFERENCES validation_attempts(id),

    -- Detalhes estruturados
    detalhes JSONB, -- {erros_encontrados: [...], correções: [...], etc}

    -- Rastreabilidade técnica
    ip_origem VARCHAR(45),
    user_agent TEXT,

    -- Timestamp
    data_acao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT acao_check CHECK (acao IN (
        'validacao_iniciada',
        'validacao_aprovada',
        'validacao_rejeitada',
        'correcao_aplicada',
        'regra_customizada',
        'export_relatorio',
        'login',
        'logout'
    ))
);

CREATE INDEX idx_audit_empresa ON audit_log(empresa_id);
CREATE INDEX idx_audit_usuario ON audit_log(usuario_id);
CREATE INDEX idx_audit_data ON audit_log(data_acao);
CREATE INDEX idx_audit_acao ON audit_log(acao);
CREATE INDEX idx_audit_nf ON audit_log(nf_numero, nf_serie);

-- Particionamento para audit_log (opcional, muito importante para escalabilidade)
-- CREATE TABLE audit_log_2026_05 PARTITION OF audit_log
--     FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- ============================================================================
-- PHASE 6: Relatórios Salvos
-- ============================================================================

CREATE TABLE relatorios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),

    -- Identificação
    titulo VARCHAR(255),
    descricao TEXT,

    -- Dados do relatório
    validation_attempt_id UUID NOT NULL REFERENCES validation_attempts(id),
    conteudo_json JSONB NOT NULL,

    -- Formatos gerados
    arquivo_pdf_url VARCHAR(500),
    arquivo_csv_url VARCHAR(500),

    -- Compartilhamento
    publica BOOLEAN DEFAULT FALSE,
    token_acesso VARCHAR(64) UNIQUE,

    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_relatorios_empresa ON relatorios(empresa_id);
CREATE INDEX idx_relatorios_usuario ON relatorios(usuario_id);

-- ============================================================================
-- VIEWS ANALÍTICAS
-- ============================================================================

-- Resumo de validações por empresa
CREATE OR REPLACE VIEW v_validacoes_resumo AS
SELECT
    e.id,
    e.razao_social,
    COUNT(va.id) as total_validacoes,
    COUNT(CASE WHEN va.status = 'APROVADA' THEN 1 END) as aprovadas,
    COUNT(CASE WHEN va.status = 'REJEITADA' THEN 1 END) as rejeitadas,
    ROUND(
        COUNT(CASE WHEN va.status = 'APROVADA' THEN 1 END)::NUMERIC /
        NULLIF(COUNT(va.id), 0) * 100,
        2
    ) as taxa_aprovacao,
    AVG(va.tempo_validacao_ms) as tempo_medio_ms,
    MAX(va.data_tentativa) as ultima_validacao
FROM empresas e
LEFT JOIN validation_attempts va ON e.id = va.empresa_id
GROUP BY e.id, e.razao_social;

-- Top erros encontrados
CREATE OR REPLACE VIEW v_erros_top AS
SELECT
    tipo_erro,
    COUNT(*) as total,
    ROUND(COUNT(*)::NUMERIC / (SELECT COUNT(*) FROM validation_attempts) * 100, 2) as percentual
FROM (
    SELECT jsonb_array_elements(va.erros_encontrados)->>'tipo' as tipo_erro
    FROM validation_attempts va
    WHERE va.erros_encontrados IS NOT NULL
) errors
GROUP BY tipo_erro
ORDER BY total DESC
LIMIT 10;

-- Taxa de aprovação por dia
CREATE OR REPLACE VIEW v_taxa_aprovacao_diaria AS
SELECT
    DATE(va.data_tentativa) as data,
    COUNT(*) as total,
    COUNT(CASE WHEN va.status = 'APROVADA' THEN 1 END) as aprovadas,
    ROUND(
        COUNT(CASE WHEN va.status = 'APROVADA' THEN 1 END)::NUMERIC /
        COUNT(*) * 100,
        2
    ) as taxa_aprovacao
FROM validation_attempts va
GROUP BY DATE(va.data_tentativa)
ORDER BY data DESC;

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Regras padrão (globais)
INSERT INTO validation_rules (nome, tipo, descricao, regra_json, ativa, prioridade)
VALUES
(
    'CFOP válidos',
    'CFOP',
    'Lista de CFOPs válidos de acordo com SEFAZ-RS',
    '{"cfops_validos": [5102, 5202, 6102, 6202, 5109, 6109]}',
    TRUE,
    100
),
(
    'CST x CFOP - Regime Normal',
    'CST',
    'CSTs permitidos por CFOP em Regime Normal',
    '{
        "5102": ["00", "20", "70", "90"],
        "5202": ["00", "20", "70", "90"],
        "6102": ["00", "20", "70", "90"]
    }',
    TRUE,
    90
),
(
    'ICMS Alíquota Válida',
    'ICMS',
    'Alíquotas válidas por estado',
    '{"aliquotas_validas": [0, 7, 12, 18, 19]}',
    TRUE,
    80
);

-- ============================================================================
-- ROLES E PERMISSÕES (RBAC básico)
-- ============================================================================

CREATE TABLE roles_permissoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role VARCHAR(50) NOT NULL UNIQUE,
    descricao TEXT,
    permissoes JSONB NOT NULL -- {"validar": true, "exportar": true, ...}
);

INSERT INTO roles_permissoes (role, descricao, permissoes) VALUES
(
    'ADMIN',
    'Acesso total ao sistema',
    '{"validar": true, "exportar": true, "customizar_regras": true, "gerenciar_usuarios": true, "auditoria": true}'
),
(
    'VALIDADOR',
    'Pode validar notas fiscais',
    '{"validar": true, "exportar": true, "customizar_regras": false, "gerenciar_usuarios": false, "auditoria": false}'
),
(
    'VIEWER',
    'Apenas consultar relatórios',
    '{"validar": false, "exportar": true, "customizar_regras": false, "gerenciar_usuarios": false, "auditoria": true}'
),
(
    'RULES_EDITOR',
    'Pode editar regras customizadas',
    '{"validar": false, "exportar": true, "customizar_regras": true, "gerenciar_usuarios": false, "auditoria": true}'
);

-- ============================================================================
-- TRIGGERS (Auditoria automática)
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_audit_validation_attempts()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'APROVADA' AND OLD.status != 'APROVADA' THEN
        INSERT INTO audit_log (usuario_id, empresa_id, acao, nf_numero, nf_serie, validation_attempt_id, detalhes)
        VALUES (
            NEW.usuario_id,
            NEW.empresa_id,
            'validacao_aprovada',
            NEW.nf_numero,
            NEW.nf_serie,
            NEW.id,
            jsonb_build_object('tempo_ms', NEW.tempo_validacao_ms)
        );
    END IF;

    IF NEW.status = 'REJEITADA' AND OLD.status != 'REJEITADA' THEN
        INSERT INTO audit_log (usuario_id, empresa_id, acao, nf_numero, nf_serie, validation_attempt_id, detalhes)
        VALUES (
            NEW.usuario_id,
            NEW.empresa_id,
            'validacao_rejeitada',
            NEW.nf_numero,
            NEW.nf_serie,
            NEW.id,
            jsonb_build_object('erros', NEW.erros_encontrados)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_validations
AFTER UPDATE ON validation_attempts
FOR EACH ROW
EXECUTE FUNCTION trigger_audit_validation_attempts();

-- ============================================================================
-- INDEXES CRÍTICOS
-- ============================================================================

-- Performance queries críticas
CREATE INDEX idx_validation_attempts_empresa_status ON validation_attempts(empresa_id, status);
CREATE INDEX idx_validation_attempts_data_empresa ON validation_attempts(data_tentativa DESC, empresa_id);
CREATE INDEX idx_audit_log_empresa_data ON audit_log(empresa_id, data_acao DESC);

-- GIN index para JSON (opcional, pode impactar escrita)
-- CREATE INDEX idx_validation_attempts_erros_gin ON validation_attempts USING GIN(erros_encontrados);

-- ============================================================================
-- PROCEDIMENTOS ARMAZENADOS
-- ============================================================================

-- Marcar validação como aprovada
CREATE OR REPLACE FUNCTION marcar_validacao_aprovada(
    p_validation_id UUID,
    p_usuario_id UUID
)
RETURNS TABLE(success BOOLEAN, mensagem TEXT) AS $$
BEGIN
    UPDATE validation_attempts
    SET status = 'APROVADA', data_aprovacao = CURRENT_TIMESTAMP, atualizado_em = CURRENT_TIMESTAMP
    WHERE id = p_validation_id;

    RETURN QUERY SELECT true, 'Validação marcada como aprovada'::TEXT;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT false, 'Erro ao marcar validação: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Contar validações por status (dashboard)
CREATE OR REPLACE FUNCTION contar_validacoes_por_status(p_empresa_id UUID)
RETURNS TABLE(status VARCHAR, total BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT va.status, COUNT(*) as total
    FROM validation_attempts va
    WHERE va.empresa_id = p_empresa_id
    GROUP BY va.status;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FINAL
-- ============================================================================

GRANT USAGE ON SCHEMA public TO public;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO public;

-- Comentários descritivos
COMMENT ON TABLE validation_attempts IS 'Registra cada tentativa de validação de uma NF-e';
COMMENT ON TABLE audit_log IS 'Log imutável de todas as ações (APPEND-ONLY, essencial para auditoria fiscal)';
COMMENT ON TABLE validation_rules IS 'Regras customizáveis por empresa';
COMMENT ON TABLE sefaz_cache IS 'Cache de regras SEFAZ com TTL de 24h';

COMMENT ON COLUMN validation_attempts.nf_xml IS 'Armazenar XML completo por razões de auditoria';
COMMENT ON COLUMN audit_log.dados_acao IS 'JSON estruturado com detalhes da ação';
COMMENT ON COLUMN validation_rules.regra_json IS 'Estrutura flexível: tipo 1 = {cfops_validos: [...]}, tipo 2 = {cfop: {csts: [...]}}';

-- ============================================================================
-- MIGRATIONS NOTES
-- ============================================================================
/*
Versionamento de schema:
- Version 1.0 (2026-05-21): Initial schema
- Future: Particionamento audit_log por mês (crescimento exponencial)
- Future: Sharding por empresa_id se > 10M validações/mês
*/
