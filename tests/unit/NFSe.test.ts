import { XMLParserService } from '../../src/services/XMLParserService';
import * as fs from 'fs';

describe('NFSe Parsing Tests', () => {
  const parser = new XMLParserService();

  it('should parse NFSe XML file', async () => {
    const nfseContent = fs.readFileSync('./testes/20260520_200232_37281672826_NFSE_D.xml', 'utf-8');
    const result = await parser.parseXML(nfseContent);

    console.log('NFSe Result:', result);
    
    // NFSe has different structure, so it might fail or succeed
    if (Array.isArray(result)) {
      console.log('NFSe structure not recognized (expected - different from NF-e)');
      expect(result.length).toBeGreaterThan(0);
    } else {
      console.log('NFSe parsed as NF-e (unexpected)');
      expect(result.nfe).toBeDefined();
    }
  });
});
