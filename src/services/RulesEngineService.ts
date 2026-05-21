import logger from '../utils/logger';

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
}

export interface ValidationError {
  id: string;
  tipo: string;
  valor: any;
  descricao: string;
  severidade: 'critico' | 'aviso';
  sugestao: string;
  campo: string;
}

export class RulesEngineService {
  private cfopsValidos = new Set<number>([
    5102, 5202, 5109, 6102, 6202, 6109, 6101, 6103, 6104, 5201, 6201, 1200,
    1201, 1202, 1203, 1204, 3000, 3100, 3101, 3102, 3103, 3104,
  ]);

  private cstPorCfop = new Map<number, Set<string>>([
    [5102, new Set(['00', '20', '70', '90'])],
    [5202, new Set(['00', '20', '70', '90'])],
    [6102, new Set(['41', '50', '51'])],
    [6202, new Set(['41', '50', '51'])],
  ]);

  private aliquotasValidas = new Set<number>([0, 7, 12, 18, 19]);

  private csosnValidos = new Set<string>([
    '101', '102', '103', '201', '202', '203', '300', '400', '500', '900',
  ]);

  private regimesValidos = new Set<string>(['simples', 'lucro_real', 'lucro_presumido']);

  private descricoes = new Map<string, string>([
    ['CFOP_INVALIDO', 'CFOP não está na lista de operações fiscais permitidas'],
    ['CST_INCOMPATIVEL_CFOP', 'CST não é permitido para este CFOP'],
    ['ICMS_ALIQUOTA_INVALIDA', 'Alíquota de ICMS não está dentro dos valores permitidos'],
    ['CSOSN_INVALIDO', 'CSOSN inválido para Simples Nacional'],
    ['DOCUMENTO_OBRIGATORIO_VAZIO', 'Documento fornecedor é obrigatório'],
    ['VALOR_NEGATIVO', 'Valor da NF não pode ser negativo'],
    ['BASE_CALCULO_INCONSISTENTE', 'Base de cálculo ICMS inconsistente com valor'],
  ]);

  private sugestoes = new Map<string, string>([
    ['CFOP_INVALIDO', 'Operação interna deve usar CFOP 5102/6102'],
    ['CST_INCOMPATIVEL_CFOP', 'Para este CFOP, use CST: 00, 20, 70 ou 90'],
    ['ICMS_ALIQUOTA_INVALIDA', 'Alíquotas típicas: 0%, 7%, 12%, 18%, 19%'],
    ['CSOSN_INVALIDO', 'Se Simples Nacional, use CSOSN válido (101, 102, 201, etc)'],
  ]);

  public validate(nf: ParsedNF, empresaRegime?: string): ValidationError[] {
    const errors: ValidationError[] = [];
    const startTime = performance.now();

    if (!this.cfopsValidos.has(nf.cfop)) {
      errors.push({
        id: 'CFOP_INVALIDO',
        tipo: 'CFOP_INVALIDO',
        valor: nf.cfop,
        descricao: this.descricoes.get('CFOP_INVALIDO') || 'CFOP inválido',
        severidade: 'critico',
        sugestao: this.sugestoes.get('CFOP_INVALIDO') || '',
        campo: 'cfop',
      });
    }

    const cstParaCfop = this.cstPorCfop.get(nf.cfop);
    if (cstParaCfop && !cstParaCfop.has(nf.cst)) {
      errors.push({
        id: 'CST_INCOMPATIVEL_CFOP',
        tipo: 'CST_INCOMPATIVEL_CFOP',
        valor: { cfop: nf.cfop, cst: nf.cst },
        descricao: this.descricoes.get('CST_INCOMPATIVEL_CFOP') || 'CST incompatível',
        severidade: 'critico',
        sugestao: this.sugestoes.get('CST_INCOMPATIVEL_CFOP') || '',
        campo: 'cst',
      });
    }

    if (!this.aliquotasValidas.has(nf.icmsAliquota)) {
      errors.push({
        id: 'ICMS_ALIQUOTA_INVALIDA',
        tipo: 'ICMS_ALIQUOTA_INVALIDA',
        valor: nf.icmsAliquota,
        descricao: this.descricoes.get('ICMS_ALIQUOTA_INVALIDA') || 'Alíquota inválida',
        severidade: 'critico',
        sugestao: this.sugestoes.get('ICMS_ALIQUOTA_INVALIDA') || '',
        campo: 'icmsAliquota',
      });
    }

    if (empresaRegime === 'simples' && !this.csosnValidos.has(nf.csosn)) {
      errors.push({
        id: 'CSOSN_INVALIDO',
        tipo: 'CSOSN_INVALIDO',
        valor: nf.csosn,
        descricao: this.descricoes.get('CSOSN_INVALIDO') || 'CSOSN inválido',
        severidade: 'critico',
        sugestao: this.sugestoes.get('CSOSN_INVALIDO') || '',
        campo: 'csosn',
      });
    }

    if (!nf.documentoFornecedor || nf.documentoFornecedor.trim().length === 0) {
      errors.push({
        id: 'DOCUMENTO_OBRIGATORIO_VAZIO',
        tipo: 'DOCUMENTO_OBRIGATORIO',
        valor: null,
        descricao: this.descricoes.get('DOCUMENTO_OBRIGATORIO_VAZIO') || 'Documento vazio',
        severidade: 'critico',
        sugestao: 'CNPJ/CPF do fornecedor é obrigatório',
        campo: 'documentoFornecedor',
      });
    }

    if (nf.valor < 0) {
      errors.push({
        id: 'VALOR_NEGATIVO',
        tipo: 'VALOR_NEGATIVO',
        valor: nf.valor,
        descricao: this.descricoes.get('VALOR_NEGATIVO') || 'Valor negativo',
        severidade: 'critico',
        sugestao: 'Valor deve ser ≥ 0',
        campo: 'valor',
      });
    }

    if (nf.baseCalculoIcms > nf.valor) {
      errors.push({
        id: 'BASE_CALCULO_INCONSISTENTE',
        tipo: 'BASE_CALCULO_INCONSISTENTE',
        valor: { base: nf.baseCalculoIcms, valor: nf.valor },
        descricao: this.descricoes.get('BASE_CALCULO_INCONSISTENTE') || 'Base > Valor',
        severidade: 'critico',
        sugestao: 'Base de cálculo ICMS não pode ser maior que valor total da NF',
        campo: 'baseCalculoIcms',
      });
    }

    if (!this.regimesValidos.has(nf.regime)) {
      errors.push({
        id: 'REGIME_INVALIDO',
        tipo: 'REGIME_INVALIDO',
        valor: nf.regime,
        descricao: 'Regime tributário não reconhecido',
        severidade: 'critico',
        sugestao: 'Use: simples, lucro_real ou lucro_presumido',
        campo: 'regime',
      });
    }

    const duration = performance.now() - startTime;
    logger.debug(`Validação em ${duration.toFixed(2)}ms`, {
      totalErros: errors.length,
      severidade: errors.filter(e => e.severidade === 'critico').length,
    });

    return errors;
  }
}
