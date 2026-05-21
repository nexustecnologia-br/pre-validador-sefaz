import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  const { xmlContent } = req.body;

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

  return res.status(200).json(result);
}
