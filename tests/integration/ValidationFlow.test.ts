import request from 'supertest';
import app from '../../src/index';

/**
 * Integration tests for main validation flow
 * Tests: Login → Validation → Fetch Results → Download
 */

describe('Integration: ValidationFlow', () => {
  let token: string;
  let refreshToken: string;
  let validacaoId: string;

  const testUser = {
    email: 'user@example.com',
    senha: 'senha123',
  };

  const validXML = `<?xml version="1.0" encoding="UTF-8"?>
    <nfeProc versao="4.00">
      <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
        <infNFe Id="NFe12345678901234567890123456789012345678901234" versao="4.00">
          <ide>
            <cUF>43</cUF>
            <nNF>123456</nNF>
            <serie>1</serie>
            <dEmi>2024-05-21</dEmi>
            <CFOP>5102</CFOP>
          </ide>
          <emit><CNPJ>12345678901234</CNPJ></emit>
          <dest><CNPJ>98765432109876</CNPJ></dest>
          <det nItem="1">
            <prod>
              <CFOP>5102</CFOP>
              <xProd>Produto teste</xProd>
              <vItem>1000.00</vItem>
            </prod>
            <imposto>
              <ICMS>
                <ICMS00>
                  <CST>00</CST>
                  <pICMS>18</pICMS>
                  <vBC>1000.00</vBC>
                </ICMS00>
              </ICMS>
            </imposto>
          </det>
          <total>
            <vNF>1000.00</vNF>
            <vBC>1000.00</vBC>
          </total>
        </infNFe>
      </NFe>
    </nfeProc>`;

  const invalidXML = `<?xml version="1.0"?>
    <root>
      <unclosed>
    </root>`;

  describe('POST /api/auth/login', () => {
    it('should login successfully and return token', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send(testUser)
        .expect(200);

      expect(response.body.status).toBe('sucesso');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.usuario.email).toBe(testUser.email);

      token = response.body.data.token;
      refreshToken = response.body.data.refreshToken;
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'invalid@example.com', senha: 'wrong' })
        .expect(401);

      expect(response.body.status).toBe('error');
    });

    it('should reject missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@example.com' })
        .expect(400);

      expect(response.body.status).toBe('error');
    });
  });

  describe('POST /api/validar', () => {
    it('should validate valid XML and return approved', async () => {
      const response = await request(app)
        .post('/api/validar')
        .set('Authorization', `Bearer ${token}`)
        .send({
          xmlContent: validXML,
          empresaId: '12345678-1234-1234-1234-123456789012',
        })
        .expect(200);

      expect(response.body.status).toBe('aprovado');
      expect(response.body.validacaoId).toBeDefined();
      expect(response.body.tempoProcessamento).toBeLessThan(500);
      expect(response.body.erros).toBeUndefined();

      validacaoId = response.body.validacaoId;
    });

    it('should validate invalid XML and return rejected', async () => {
      const response = await request(app)
        .post('/api/validar')
        .set('Authorization', `Bearer ${token}`)
        .send({
          xmlContent: invalidXML,
          empresaId: '12345678-1234-1234-1234-123456789012',
        })
        .expect(200);

      expect(response.body.status).toBe('rejeitado');
      expect(response.body.validacaoId).toBeDefined();
      expect(response.body.erros).toBeDefined();
      expect(response.body.erros.length).toBeGreaterThan(0);
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .post('/api/validar')
        .send({
          xmlContent: validXML,
          empresaId: '12345678-1234-1234-1234-123456789012',
        })
        .expect(401);

      expect(response.body.status).toBe('error');
    });

    it('should reject missing xmlContent', async () => {
      const response = await request(app)
        .post('/api/validar')
        .set('Authorization', `Bearer ${token}`)
        .send({ empresaId: '12345678-1234-1234-1234-123456789012' })
        .expect(400);

      expect(response.body.status).toBe('error');
    });

    it('should complete validation in less than 500ms', async () => {
      const start = Date.now();
      const response = await request(app)
        .post('/api/validar')
        .set('Authorization', `Bearer ${token}`)
        .send({
          xmlContent: validXML,
          empresaId: '12345678-1234-1234-1234-123456789012',
        })
        .expect(200);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
      expect(response.body.tempoProcessamento).toBeLessThan(300);
    });
  });

  describe('GET /api/validacao/:id', () => {
    it('should fetch validation details', async () => {
      const response = await request(app)
        .get(`/api/validacao/${validacaoId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.status).toBe('sucesso');
      expect(response.body.data.id).toBe(validacaoId);
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get(`/api/validacao/${validacaoId}`)
        .expect(401);

      expect(response.body.status).toBe('error');
    });

    it('should return 404 for non-existent validation', async () => {
      const response = await request(app)
        .get('/api/validacao/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /api/validacoes/minhas', () => {
    it('should fetch user validations with pagination', async () => {
      const response = await request(app)
        .get('/api/validacoes/minhas?page=1&limit=20')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.status).toBe('sucesso');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(20);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/validacoes/minhas?status=aprovado')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.status).toBe('sucesso');
      if (response.body.data.length > 0) {
        response.body.data.forEach((v: any) => {
          expect(v.status).toBe('aprovado');
        });
      }
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/validacoes/minhas')
        .expect(401);

      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /api/download/:id/xml', () => {
    it('should download XML file', async () => {
      const response = await request(app)
        .get(`/api/download/${validacaoId}/xml`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.get('Content-Type')).toContain('application/xml');
      expect(response.get('Content-Disposition')).toContain('attachment');
      expect(response.text).toContain('<?xml');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get(`/api/download/${validacaoId}/xml`)
        .expect(401);

      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /health', () => {
    it('should return health check', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.uptime).toBeGreaterThan(0);
      expect(response.body.version).toBeDefined();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.status).toBe('sucesso');
    });
  });
});
