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

// Validate NF-e (mock)
app.post('/api/validar', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const { xmlContent, empresaId } = req.body;

  try {
    jwt.verify(token!, JWT_SECRET);
  } catch {
    return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  }

  if (!xmlContent) {
    return res.status(400).json({ status: 'error', message: 'Missing xmlContent' });
  }

  const validacaoId = Math.random().toString(36).substr(2, 9);

  // Mock validation
  const hasError = xmlContent.includes('invalid');

  const result = {
    status: hasError ? 'rejeitado' : 'aprovado',
    validacaoId,
    nfe: '123456',
    valor: 1000,
    cfop: '5102',
    tempoProcessamento: Math.floor(Math.random() * 300) + 50,
    erros: hasError ? [{
      id: '1',
      tipo: 'FORMATO_INVALIDO',
      descricao: 'XML malformado',
      severidade: 'critico',
      valor: 'invalid'
    }] : [],
    dataEmissao: new Date().toISOString(),
    cnpjFornecedor: '12345678901234',
    cnpjComprador: '98765432109876'
  };

  validations[validacaoId] = result;

  res.json(result);
});

// Get validation details
app.get('/api/validacao/:id', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  try {
    jwt.verify(token!, JWT_SECRET);
  } catch {
    return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  }

  const validation = validations[req.params.id];

  if (!validation) {
    return res.status(404).json({ status: 'error', message: 'Not found' });
  }

  res.json({ status: 'sucesso', data: validation });
});

// Get user validations
app.get('/api/validacoes/minhas', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  try {
    jwt.verify(token!, JWT_SECRET);
  } catch {
    return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  }

  res.json({
    status: 'sucesso',
    data: Object.values(validations),
    pagination: { page: 1, limit: 20, total: Object.keys(validations).length }
  });
});

// Download XML
app.get('/api/download/:id/xml', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  try {
    jwt.verify(token!, JWT_SECRET);
  } catch {
    return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  }

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
