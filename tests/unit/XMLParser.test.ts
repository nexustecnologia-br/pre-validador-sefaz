import { XMLParserService, ParsedNF } from '../../src/services/XMLParserService';

describe('XMLParserService', () => {
  let xmlParser: XMLParserService;

  beforeEach(() => {
    xmlParser = new XMLParserService();
  });

  describe('parseXML', () => {
    it('should parse valid NFe XML', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
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

      const result = await xmlParser.parseXML(xmlContent);
      expect(result).not.toBeInstanceOf(Array);
      const nf = result as ParsedNF;
      expect(nf.cfop).toBe(5102);
      expect(nf.valor).toBe(1000);
      expect(nf.icmsAliquota).toBe(18);
    });

    it('should return error for malformed XML', async () => {
      const xmlContent = `<?xml version="1.0"?>
        <root>
          <unclosed>
        </root>`;

      const result = await xmlParser.parseXML(xmlContent);
      expect(result).toBeInstanceOf(Array);
      const errors = result as any[];
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].tipo).toBe('XML_PARSE_ERROR');
    });

    it('should return error for XML exceeding size limit', async () => {
      const largeXML = '<?xml version="1.0"?><root>' + 'x'.repeat(6 * 1024 * 1024) + '</root>';

      const result = await xmlParser.parseXML(largeXML);
      expect(result).toBeInstanceOf(Array);
      const errors = result as any[];
      expect(errors[0].id).toBe('XML_SIZE_EXCEEDS_LIMIT');
    });

    it('should extract default values for missing fields', async () => {
      const minimalXML = `<?xml version="1.0"?>
        <nfeProc>
          <NFe>
            <infNFe>
              <ide></ide>
              <emit><CNPJ>12345678901234</CNPJ></emit>
              <dest><CNPJ>98765432109876</CNPJ></dest>
              <det>
                <prod></prod>
                <imposto><ICMS></ICMS></imposto>
              </det>
              <total></total>
            </infNFe>
          </NFe>
        </nfeProc>`;

      const result = await xmlParser.parseXML(minimalXML);
      const nf = result as ParsedNF;
      expect(nf.cfop).toBe(5102); // default CFOP
      expect(nf.cst).toBe('00');
      expect(nf.regime).toBe('lucro_real');
    });
  });

  describe('validateXSD', () => {
    it('should validate correct NFe structure', () => {
      const xml = `<?xml version="1.0"?>
        <nfeProc>
          <NFe>
            <infNFe>
              <ide></ide>
            </infNFe>
          </NFe>
        </nfeProc>`;

      expect(xmlParser.validateXSD(xml)).toBe(true);
    });

    it('should reject XML missing NFe root', () => {
      const xml = `<?xml version="1.0"?>
        <root>
          <data></data>
        </root>`;

      expect(xmlParser.validateXSD(xml)).toBe(false);
    });

    it('should detect unbalanced tags', () => {
      const xml = `<?xml version="1.0"?>
        <root>
          <unbalanced>
        </root>`;

      expect(xmlParser.validateXSD(xml)).toBe(false);
    });
  });

  describe('extractCST', () => {
    it('should extract CST from ICMS00', async () => {
      const xml = `<?xml version="1.0"?>
        <nfeProc>
          <NFe>
            <infNFe>
              <ide><CFOP>5102</CFOP></ide>
              <emit><CNPJ>12345678901234</CNPJ></emit>
              <dest><CNPJ>98765432109876</CNPJ></dest>
              <det>
                <prod><CFOP>5102</CFOP></prod>
                <imposto>
                  <ICMS>
                    <ICMS00>
                      <CST>00</CST>
                      <pICMS>18</pICMS>
                    </ICMS00>
                  </ICMS>
                </imposto>
              </det>
            </infNFe>
          </NFe>
        </nfeProc>`;

      const result = await xmlParser.parseXML(xml);
      const nf = result as ParsedNF;
      expect(nf.cst).toBe('00');
    });
  });

  describe('parseMultipleItems', () => {
    it('should parse multiple invoice items', async () => {
      const xml = `<?xml version="1.0"?>
        <nfeProc>
          <NFe>
            <infNFe>
              <ide><CFOP>5102</CFOP></ide>
              <emit><CNPJ>12345678901234</CNPJ></emit>
              <dest><CNPJ>98765432109876</CNPJ></dest>
              <det nItem="1"><prod><xProd>Item 1</xProd><vItem>100</vItem></prod><imposto><ICMS></ICMS></imposto></det>
              <det nItem="2"><prod><xProd>Item 2</xProd><vItem>200</vItem></prod><imposto><ICMS></ICMS></imposto></det>
            </infNFe>
          </NFe>
        </nfeProc>`;

      const items = await xmlParser.parseMultipleItems(xml);
      expect(items.length).toBe(2);
      expect(items[0].descricao).toBe('Item 1');
      expect(items[1].descricao).toBe('Item 2');
    });
  });
});
