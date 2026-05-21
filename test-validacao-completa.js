const fs = require('fs');
const http = require('http');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}\n${colors.cyan}${msg}${colors.reset}\n${colors.cyan}${'='.repeat(60)}${colors.reset}\n`)
};

async function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  log.header('🧪 TESTE COMPLETO — PRE_VALIDADOR_SEFAZ');

  // Test 1: Health Check
  log.header('1️⃣  HEALTH CHECK');
  try {
    const health = await makeRequest('GET', '/health');
    if (health.status === 200) {
      log.success('Backend respondendo');
      log.info(`Versão: ${health.data.message}`);
    }
  } catch (e) {
    log.error(`Backend não respondeu: ${e.message}`);
    process.exit(1);
  }

  // Test 2: Login
  log.header('2️⃣  LOGIN');
  let token = null;
  try {
    const login = await makeRequest('POST', '/api/auth/login', {
      email: 'user@example.com',
      senha: 'senha123'
    });
    if (login.status === 200 && login.data.data.token) {
      token = login.data.data.token;
      log.success('Login bem-sucedido');
      log.info(`Usuário: ${login.data.data.usuario.nome}`);
    } else {
      throw new Error('Login falhou');
    }
  } catch (e) {
    log.error(`Login error: ${e.message}`);
    process.exit(1);
  }

  // Test 3: Load and validate XMLs
  log.header('3️⃣  TESTE DE VALIDAÇÕES');
  
  const testFiles = [
    'NFE_43260400584835000136550210000143351705040506_0000001299_NFE.xml',
    'CTE_43260400584835000136570140000300451770260000_0000001044_CTE.xml',
    '20260520_200232_37281672826_NFSE_D.xml'
  ];

  for (const file of testFiles) {
    const filePath = `testes/${file}`;
    if (!fs.existsSync(filePath)) {
      log.warn(`Arquivo não encontrado: ${file}`);
      continue;
    }

    log.info(`\nTestando: ${file}`);
    const xmlContent = fs.readFileSync(filePath, 'utf-8');
    
    try {
      const validation = await makeRequest('POST', '/api/validar', {
        xmlContent: xmlContent,
        empresaId: '12345678-1234-1234-1234-123456789012'
      }, token);

      if (validation.status === 200) {
        const result = validation.data;
        const status = result.status === 'aprovado' ? '✅' : '❌';
        log.success(`${status} Validação completa`);
        log.info(`Status: ${result.status}`);
        log.info(`Tempo: ${result.tempoProcessamento}ms`);
        
        if (result.erros && result.erros.length > 0) {
          log.warn(`Erros encontrados: ${result.erros.length}`);
          result.erros.forEach(err => {
            console.log(`  - ${err.tipo}: ${err.descricao}`);
          });
        } else {
          log.success('Nenhum erro de validação');
        }
      } else {
        log.error(`Status ${validation.status}`);
        console.log(validation.data);
      }
    } catch (e) {
      log.error(`Erro na validação: ${e.message}`);
    }
  }

  log.header('✅ TESTE COMPLETO FINALIZADO');
}

runTests().catch(console.error);
