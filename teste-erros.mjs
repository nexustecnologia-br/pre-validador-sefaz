import http from 'http';

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

async function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

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
  log.header('🧪 TESTE DE ERROS E VALIDAÇÃO');

  // Login
  const login = await makeRequest('POST', '/api/auth/login', {
    email: 'user@example.com',
    senha: 'senha123'
  });
  const token = login.data.data.token;
  log.info('Login realizado');

  const testCases = [
    {
      name: '❌ XML Malformado',
      xml: '<invalid>test',
      shouldFail: true
    },
    {
      name: '❌ XML com valores negativos',
      xml: `<?xml version="1.0"?>
        <nfeProc>
          <NFe>
            <infNFe>
              <det>
                <prod>
                  <vProd>-1000.00</vProd>
                </prod>
              </det>
            </infNFe>
          </NFe>
        </nfeProc>`,
      shouldFail: true
    },
    {
      name: '❌ XML com CFOP inválido',
      xml: `<?xml version="1.0"?>
        <nfeProc>
          <NFe>
            <infNFe>
              <det>
                <prod>
                  <CFOP>9999</CFOP>
                  <vProd>1000.00</vProd>
                </prod>
              </det>
            </infNFe>
          </NFe>
        </nfeProc>`,
      shouldFail: true
    },
    {
      name: '✅ XML vazio (válido para teste)',
      xml: '<?xml version="1.0"?><nfeProc></nfeProc>',
      shouldFail: false
    }
  ];

  for (const testCase of testCases) {
    log.info(`\n${testCase.name}`);
    
    try {
      const result = await makeRequest('POST', '/api/validar', {
        xmlContent: testCase.xml,
        empresaId: '12345678-1234-1234-1234-123456789012'
      }, token);

      if (result.status === 200) {
        const validation = result.data;
        if (testCase.shouldFail && validation.status === 'rejeitado') {
          log.success(`Erro detectado corretamente`);
          if (validation.erros && validation.erros.length > 0) {
            log.warn(`  Detalhes: ${validation.erros[0].descricao}`);
          }
        } else if (!testCase.shouldFail && validation.status === 'aprovado') {
          log.success(`Validação aprovada como esperado`);
        } else {
          log.warn(`Status inesperado: ${validation.status}`);
        }
      } else {
        log.error(`Erro HTTP ${result.status}`);
      }
    } catch (e) {
      log.error(`Erro na requisição: ${e.message}`);
    }
  }

  log.header('✅ TESTES DE ERRO CONCLUÍDOS');
}

runTests().catch(console.error);
