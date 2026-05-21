/**
 * Mock Server — PRE_VALIDADOR_SEFAZ (sem dependência de banco)
 * Uso: Para testes rápidos sem PostgreSQL/Redis
 */

import express from 'express';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

// Mock data
const users: any = {
  'user@example.com': {
    id: '12345',
    email: 'user@example.com',
    nome: 'Test User',
    role: 'usuario'
  }
};

const validations: any = {};

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    version: '1.0.0',
    message: 'PRE_VALIDADOR_SEFAZ V2.0 (Mock Server)'
  });
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ status: 'error', message: 'Missing fields' });
  }

  if (email === 'user@example.com' && senha === 'senha123') {
    const token = jwt.sign({ email, id: '12345' }, JWT_SECRET, { expiresIn: '24h' });
    const refreshToken = jwt.sign({ email, id: '12345' }, JWT_SECRET, { expiresIn: '30d' });

    return res.json({
      status: 'sucesso',
      data: {
        token,
        refreshToken,
        usuario: users['user@example.com']
      }
    });
  }

  res.status(401).json({ status: 'error', message: 'Invalid credentials' });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.json({ status: 'sucesso', message: 'Logged out' });
});

// Get current user
app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  try {
    const decoded: any = jwt.verify(token!, JWT_SECRET);
    res.json({ status: 'sucesso', data: users[decoded.email] });
  } catch {
    res.status(401).json({ status: 'error', message: 'Unauthorized' });
  }
});

// Validate NF-e (mock) — SEM AUTENTICAÇÃO
app.post('/api/validar', (req, res) => {
  const { xmlContent, empresaId } = req.body;

  if (!xmlContent) {
    return res.status(400).json({ status: 'error', message: 'Missing xmlContent' });
  }

  const validacaoId = Math.random().toString(36).substr(2, 9);
  const erros: any[] = [];

  // Helper function to validate CFOP
  function validateCFOP(cfop: string): boolean {
    const validCFOPs = ['5102', '5103', '5104', '5105', '6102', '6103', '6104', '6105', '6949'];
    return validCFOPs.includes(cfop);
  }

  // Parse and validate XML
  try {
    // Check XML format
    if (!xmlContent.includes('<?xml')) {
      erros.push({
        id: '1',
        tipo: 'FORMATO_INVALIDO',
        descricao: 'XML malformado ou não começa com declaração XML',
        severidade: 'critico'
      });
    }

    // Extract CFOP if present
    const cfopMatch = xmlContent.match(/<CFOP>(\d+)<\/CFOP>/);
    const cfop = cfopMatch ? cfopMatch[1] : null;

    if (cfop && !validateCFOP(cfop)) {
      erros.push({
        id: '2',
        tipo: 'CFOP_INVALIDO',
        descricao: `CFOP ${cfop} não é válido`,
        severidade: 'critico',
        valor: cfop
      });
    }

    // Extract product value
    const vProdMatch = xmlContent.match(/<vProd>([-\d.]+)<\/vProd>/);
    const vProd = vProdMatch ? parseFloat(vProdMatch[1]) : null;

    if (vProd !== null && vProd < 0) {
      erros.push({
        id: '3',
        tipo: 'VALOR_NEGATIVO',
        descricao: 'Valor do produto não pode ser negativo',
        severidade: 'critico',
        valor: String(vProd)
      });
    }

    // Extract base value
    const vBCMatch = xmlContent.match(/<vBC>([-\d.]+)<\/vBC>/);
    const vBC = vBCMatch ? parseFloat(vBCMatch[1]) : null;

    if (vBC !== null && vProd !== null && vBC > vProd) {
      erros.push({
        id: '4',
        tipo: 'BASE_INVALIDA',
        descricao: 'Base de cálculo não pode ser maior que o valor do produto',
        severidade: 'aviso',
        valor: `Base: ${vBC}, Produto: ${vProd}`
      });
    }

    // Check for malformed XML patterns
    if (xmlContent.includes('invalid')) {
      erros.push({
        id: '5',
        tipo: 'XML_MALFORMADO',
        descricao: 'XML contém padrão inválido',
        severidade: 'critico'
      });
    }

  } catch (e) {
    erros.push({
      id: 'parse_error',
      tipo: 'ERRO_PARSING',
      descricao: 'Erro ao fazer parsing do XML',
      severidade: 'critico'
    });
  }

  const result = {
    status: erros.length > 0 ? 'rejeitado' : 'aprovado',
    validacaoId,
    nfe: '123456',
    valor: 1000,
    cfop: '5102',
    tempoProcessamento: Math.floor(Math.random() * 300) + 50,
    erros: erros,
    dataEmissao: new Date().toISOString(),
    cnpjFornecedor: '12345678901234',
    cnpjComprador: '98765432109876'
  };

  validations[validacaoId] = result;

  res.json(result);
});

// Get validation details — SEM AUTENTICAÇÃO
app.get('/api/validacao/:id', (req, res) => {
  const validation = validations[req.params.id];

  if (!validation) {
    return res.status(404).json({ status: 'error', message: 'Not found' });
  }

  res.json({ status: 'sucesso', data: validation });
});

// Get user validations — SEM AUTENTICAÇÃO
app.get('/api/validacoes/minhas', (req, res) => {
  res.json({
    status: 'sucesso',
    data: Object.values(validations),
    pagination: { page: 1, limit: 20, total: Object.keys(validations).length }
  });
});

// Download XML — SEM AUTENTICAÇÃO
app.get('/api/download/:id/xml', (req, res) => {
  const validation = validations[req.params.id];

  if (!validation) {
    return res.status(404).json({ status: 'error', message: 'Not found' });
  }

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', 'attachment; filename="validacao.xml"');
  res.send('<?xml version="1.0"?><nfeProc></nfeProc>');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 PRE_VALIDADOR_SEFAZ V2.0 (Mock Server) rodando em http://localhost:${PORT}`);
  console.log(`\n📝 Credenciais de teste:`);
  console.log(`   Email: user@example.com`);
  console.log(`   Senha: senha123`);
  console.log(`\n🧪 Teste rápido:`);
  console.log(`   curl http://localhost:${PORT}/health\n`);
});

export default app;
