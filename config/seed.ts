import 'reflect-metadata';
import { DataSource } from 'typeorm';
import bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import logger from '../src/utils/logger';

// Database connection
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'pre_validador_sefaz',
  entities: ['src/models/**/*.ts'],
  migrations: ['src/migrations/**/*.ts'],
  synchronize: true,
  logging: false,
});

async function seed() {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    logger.info('Database seeding started...');

    // Clear existing data (development only)
    await AppDataSource.query(`DELETE FROM validation_attempts;`);
    await AppDataSource.query(`DELETE FROM usuarios;`);
    await AppDataSource.query(`DELETE FROM empresas;`);
    await AppDataSource.query(`DELETE FROM audit_logs;`);

    // Insert test users
    const senhaHash = await bcrypt.hash('senha123', 10);

    const adminId = uuid();
    const usuarioId = uuid();

    await AppDataSource.query(
      `INSERT INTO usuarios (id, email, senha, nome, cpf, ativo, role, "criadoEm", "atualizadoEm")
       VALUES
       ($1, $2, $3, $4, $5, true, 'admin', NOW(), NOW()),
       ($6, $7, $8, $9, $10, true, 'usuario', NOW(), NOW())`,
      [
        adminId,
        'admin@example.com',
        senhaHash,
        'Administrador',
        '12345678901',
        usuarioId,
        'user@example.com',
        senhaHash,
        'Rodrigo Rafael',
        '98765432109',
      ]
    );

    logger.info('✅ 2 test users created');

    // Insert test companies
    const empresa1Id = uuid();
    const empresa2Id = uuid();

    await AppDataSource.query(
      `INSERT INTO empresas (
        id, cnpj, "razaoSocial", "nomeFantasia", regime,
        ativo, "totalValidacoes", "validacoesAprovadas", "validacoesRejeitadas",
        "criadoEm", "atualizadoEm"
      ) VALUES
      ($1, $2, $3, $4, $5, true, 0, 0, 0, NOW(), NOW()),
      ($6, $7, $8, $9, $10, true, 0, 0, 0, NOW(), NOW())`,
      [
        empresa1Id,
        '12345678901234',
        'Empresa Teste LTDA',
        'Empresa Teste',
        'lucro_real',
        empresa2Id,
        '98765432109876',
        'Outra Empresa SA',
        'Outra Empresa',
        'simples',
      ]
    );

    logger.info('✅ 2 test companies created');

    // Insert test validation attempts
    const validacaoId = uuid();

    const xmlSample = `<?xml version="1.0" encoding="UTF-8"?>
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
          <emit>
            <CNPJ>12345678901234</CNPJ>
          </emit>
          <dest>
            <CNPJ>98765432109876</CNPJ>
          </dest>
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

    await AppDataSource.query(
      `INSERT INTO validation_attempts (
        id, "empresaId", "usuarioId", "xmlContent", status, nfe, "dataEmissao",
        valor, "cnpjFornecedor", "cnpjComprador", cfop, cst, "icmsAliquota",
        "validoXSD", "validoRegras", "totalErros", "errosCriticos", "errosAvisos",
        "tempoProcessamento", "criadoEm", "atualizadoEm"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW())`,
      [
        validacaoId,
        empresa1Id,
        usuarioId,
        xmlSample,
        'aprovado',
        '123456/1',
        '2024-05-21',
        1000,
        '12345678901234',
        '98765432109876',
        5102,
        '00',
        18,
        true,
        true,
        0,
        0,
        0,
        5,
      ]
    );

    logger.info('✅ 1 test validation created');

    logger.info('✅✅✅ Database seeding completed successfully!');
  } catch (error) {
    logger.error('Database seeding failed', { error });
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

// Run seed
seed();
