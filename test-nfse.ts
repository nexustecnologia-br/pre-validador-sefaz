import { XMLParserService } from './src/services/XMLParserService';
import * as fs from 'fs';

async function testNFSe() {
  const parser = new XMLParserService();
  
  try {
    const nfseXml = fs.readFileSync('./testes/20260520_200232_37281672826_NFSE_D.xml', 'utf-8');
    
    console.log('🔍 Testando arquivo NFSe...\n');
    
    const result = await parser.parseXML(nfseXml);
    
    if (Array.isArray(result)) {
      console.log('❌ Erros encontrados:');
      result.forEach(err => {
        console.log(`  - [${err.tipo}] ${err.descricao}`);
      });
    } else {
      console.log('✅ Parsing bem-sucedido!');
      console.log(`  NF-e: ${result.nfe}`);
      console.log(`  CFOP: ${result.cfop}`);
      console.log(`  Valor: ${result.valor}`);
    }
  } catch (error) {
    console.log('❌ Erro durante parsing:', error instanceof Error ? error.message : String(error));
  }
}

testNFSe();
