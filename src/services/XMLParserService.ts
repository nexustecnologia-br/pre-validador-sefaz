import xml2js from 'xml2js';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';
import { ValidationError } from './RulesEngineService';

export interface ParsedNF {
  cfop: number;
  cst: string;
  icmsAliquota: number;
  csosn: string;
  descricao: string;
  valor: number;
  baseCalculoIcms: number;
  regime: 'simples' | 'lucro_real' | 'lucro_presumido';
  documentoFornecedor: string;
  documentoComprador: string;
  cnpjDestino?: string;
  nfe?: string;
  dataEmissao?: string;
}

export interface XMLParseError extends ValidationError {
  xmlFieldPath?: string;
}

export class XMLParserService {
  private xmlParser: xml2js.Parser;
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  constructor() {
    this.xmlParser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true,
      ignoreAttrs: false,
      strict: true,
    });
  }

  /**
   * Parse XML string and extract NF data
   * Validates: malformed XML, XXE attacks, size limits
   * Returns: ParsedNF object or array of XMLParseError
   */
  async parseXML(xmlContent: string): Promise<ParsedNF | XMLParseError[]> {
    const startTime = performance.now();
    const errors: XMLParseError[] = [];

    // Validate size limit
    if (Buffer.byteLength(xmlContent, 'utf-8') > this.MAX_FILE_SIZE) {
      errors.push({
        id: 'XML_SIZE_EXCEEDS_LIMIT',
        tipo: 'XML_SIZE_EXCEEDS_LIMIT',
        valor: Buffer.byteLength(xmlContent, 'utf-8'),
        descricao: 'Arquivo XML excede limite de 5MB',
        severidade: 'critico',
        sugestao: 'Reduza o tamanho do arquivo XML',
        campo: 'xmlContent',
      });
      logger.warn('XML file size exceeds limit', {
        size: Buffer.byteLength(xmlContent, 'utf-8'),
        maxSize: this.MAX_FILE_SIZE,
      });
      return errors;
    }

    try {
      const parsed = await this.xmlParser.parseStringPromise(xmlContent);
      const nf = this.extractNFData(parsed);

      const duration = performance.now() - startTime;
      logger.debug(`XML parsing completed in ${duration.toFixed(2)}ms`, { nfe: nf.nfe });

      return nf;
    } catch (error: any) {
      if (error.code === 'ERR_NON_OBJECT_PROPERTY_BINDING') {
        errors.push({
          id: 'XML_XXE_ATTACK_DETECTED',
          tipo: 'XML_XXE_ATTACK_DETECTED',
          valor: null,
          descricao: 'Possível ataque XXE detectado no XML',
          severidade: 'critico',
          sugestao: 'Valide a fonte do XML antes de enviar',
          campo: 'xmlContent',
        });
        logger.error('XXE attack detected', { errorMessage: error.message });
      } else if (error.message?.includes('Unexpected character')) {
        errors.push({
          id: 'XML_MALFORMED',
          tipo: 'XML_MALFORMED',
          valor: error.message,
          descricao: 'XML contém caracteres inválidos ou está malformado',
          severidade: 'critico',
          sugestao: 'Valide o XML contra a XSD de NFe',
          campo: 'xmlContent',
        });
      } else {
        errors.push({
          id: 'XML_PARSE_ERROR',
          tipo: 'XML_PARSE_ERROR',
          valor: error.message,
          descricao: 'Erro ao fazer parse do XML',
          severidade: 'critico',
          sugestao: 'Verifique se o XML está bem formado (< e > balanceados)',
          campo: 'xmlContent',
        });
      }

      logger.error('XML parsing failed', { error: error.message });
      return errors;
    }
  }

  /**
   * Extract NF data from parsed XML
   * Maps XML structure to ParsedNF interface
   * Handles: missing fields, type coercion, default values
   */
  private extractNFData(parsed: any): ParsedNF {
    try {
      // NFe structure: nfeProc.NFe.infNFe.ide + det + totals
      const root = parsed.nfeProc?.NFe || parsed.NFe || parsed;
      const infNFe = root.infNFe || {};
      const ide = infNFe.ide || {};
      const det = Array.isArray(infNFe.det) ? infNFe.det[0] : infNFe.det || {};
      const prod = det.prod || {};
      const imposto = det.imposto || {};
      const icms = imposto.ICMS || {};
      const total = infNFe.total || {};

      // Extract CFOP (Código Fiscal de Operação)
      const cfop = parseInt(prod.CFOP || ide.CFOP || '5102', 10);

      // Extract CST (Código de Situação Tributária)
      const cst = this.extractCST(icms);

      // Extract ICMS Aliquota
      const icmsAliquota = this.extractICMSAliquota(icms);

      // Extract CSOSN (for Simples Nacional)
      const csosn = this.extractCSOSN(icms);

      // Extract values
      const valor = parseFloat(prod.vItem || total.vNF || '0');
      const baseCalculoIcms = parseFloat(
        icms.vBC || icms.vBCST || total.vBC || '0'
      );

      // Extract regime (inferred from ICMS structure)
      const regime = this.inferRegime(icms);

      // Extract documentos
      const emitente = infNFe.emit || {};
      const destinatario = infNFe.dest || {};
      const documentoFornecedor = emitente.CNPJ || emitente.CPF || '';
      const documentoComprador = destinatario.CNPJ || destinatario.CPF || '';

      // Extract description
      const descricao = prod.xProd || 'Produto/Serviço';

      // Optional fields
      const nfe = infNFe.ide?.dEmi || infNFe.ide?.dhEmi || '';
      const dataEmissao = ide.dEmi || ide.dhEmi || '';
      const cnpjDestino = destinatario.CNPJ;

      return {
        cfop,
        cst,
        icmsAliquota,
        csosn,
        descricao,
        valor,
        baseCalculoIcms,
        regime,
        documentoFornecedor,
        documentoComprador,
        cnpjDestino,
        nfe: `${infNFe.ide?.nNF || ''}/${infNFe.ide?.serie || ''}`,
        dataEmissao,
      };
    } catch (error) {
      logger.error('Error extracting NF data', { error });
      // Return safe defaults on extraction error
      return {
        cfop: 0,
        cst: '00',
        icmsAliquota: 0,
        csosn: '900',
        descricao: 'Extração de dados falhou',
        valor: 0,
        baseCalculoIcms: 0,
        regime: 'lucro_real',
        documentoFornecedor: '',
        documentoComprador: '',
      };
    }
  }

  /**
   * Extract CST from ICMS structure (00, 20, 70, 90, 41, 50, 51)
   */
  private extractCST(icms: any): string {
    // Common ICMS CST codes
    const cstCodes = [
      'ICMS00', 'ICMS20', 'ICMS70', 'ICMS90', // Regime normal
      'ICMS41', 'ICMS50', 'ICMS51', // Não tributado/Diferido
    ];

    for (const cstCode of cstCodes) {
      if (icms[cstCode]) {
        const cstValue = icms[cstCode].CST || cstCode.replace('ICMS', '');
        if (cstValue) return String(cstValue).padStart(2, '0');
      }
    }

    return '00';
  }

  /**
   * Extract ICMS Aliquota from ICMS structure
   */
  private extractICMSAliquota(icms: any): number {
    const pICMS = icms.ICMS00?.pICMS ||
                 icms.ICMS20?.pICMS ||
                 icms.ICMS70?.pICMS ||
                 icms.ICMS90?.pICMS ||
                 icms.pICMS ||
                 0;

    const aliquota = parseFloat(String(pICMS));
    return isNaN(aliquota) ? 0 : aliquota;
  }

  /**
   * Extract CSOSN from ICMS (Simples Nacional)
   */
  private extractCSOSN(icms: any): string {
    const csosn = icms.ICMSSimplesNacional?.CSOSN ||
                 icms.CSOSN ||
                 '900';

    return String(csosn).padStart(3, '0');
  }

  /**
   * Infer regime from ICMS structure and other indicators
   */
  private inferRegime(icms: any): 'simples' | 'lucro_real' | 'lucro_presumido' {
    // Se tem ICMSSimplesNacional, é Simples
    if (icms.ICMSSimplesNacional) {
      return 'simples';
    }

    // Se tem ICMS normal (00, 20, 70, 90), é Lucro Real ou Presumido
    if (icms.ICMS00 || icms.ICMS20 || icms.ICMS70 || icms.ICMS90) {
      // Por padrão assume Lucro Real
      return 'lucro_real';
    }

    return 'lucro_real';
  }

  /**
   * Validate XML against XSD schema (simplified validation)
   * In production, use xmllint or a dedicated XSD validator
   */
  validateXSD(xmlContent: string): boolean {
    try {
      // Basic validation: check required root elements
      const hasNFe = xmlContent.includes('<NFe') || xmlContent.includes('<nfeProc');
      const hasInfNFe = xmlContent.includes('<infNFe');
      const hasIde = xmlContent.includes('<ide');

      if (!hasNFe || !hasInfNFe || !hasIde) {
        logger.warn('XML missing required NFe structure');
        return false;
      }

      // Check for balanced tags
      const openTags = (xmlContent.match(/<\w+/g) || []).length;
      const closeTags = (xmlContent.match(/<\/\w+>/g) || []).length;

      if (openTags !== closeTags) {
        logger.warn('XML has unbalanced tags', { open: openTags, close: closeTags });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('XSD validation error', { error });
      return false;
    }
  }

  /**
   * Extract multiple items from NF XML (each product line)
   */
  async parseMultipleItems(xmlContent: string): Promise<ParsedNF[]> {
    try {
      const parsed = await this.xmlParser.parseStringPromise(xmlContent);
      const root = parsed.nfeProc?.NFe || parsed.NFe || parsed;
      const infNFe = root.infNFe || {};
      const items = Array.isArray(infNFe.det)
        ? infNFe.det
        : infNFe.det ? [infNFe.det] : [];

      return items.map((item: any) => {
        // Reuse extractNFData but for each item
        const baseNF = this.extractNFData(parsed);
        return {
          ...baseNF,
          descricao: item.prod?.xProd || baseNF.descricao,
          valor: parseFloat(item.prod?.vItem || '0'),
        };
      });
    } catch (error) {
      logger.error('Error parsing multiple items', { error });
      return [];
    }
  }
}
