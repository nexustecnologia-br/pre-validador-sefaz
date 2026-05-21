import { RulesEngineService, ParsedNF } from '../../src/services/RulesEngineService';

describe('RulesEngineService', () => {
  let rulesEngine: RulesEngineService;

  beforeEach(() => {
    rulesEngine = new RulesEngineService();
  });

  const createValidNF = (): ParsedNF => ({
    cfop: 5102,
    cst: '00',
    icmsAliquota: 18,
    csosn: '100',
    descricao: 'Produto válido',
    valor: 1000,
    baseCalculoIcms: 1000,
    regime: 'lucro_real',
    documentoFornecedor: '12345678901234',
    documentoComprador: '98765432109876',
  });

  describe('validate', () => {
    it('should return empty array for valid NF', () => {
      const nf = createValidNF();
      const errors = rulesEngine.validate(nf);

      expect(errors).toEqual([]);
    });

    it('should detect invalid CFOP', () => {
      const nf = createValidNF();
      nf.cfop = 9999;

      const errors = rulesEngine.validate(nf);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].id).toBe('CFOP_INVALIDO');
      expect(errors[0].severidade).toBe('critico');
    });

    it('should detect incompatible CST for CFOP', () => {
      const nf = createValidNF();
      nf.cfop = 6102;
      nf.cst = '00'; // Invalid CST for 6102 (should be 41, 50, or 51)

      const errors = rulesEngine.validate(nf);
      const cstError = errors.find((e) => e.id === 'CST_INCOMPATIVEL_CFOP');
      expect(cstError).toBeDefined();
      expect(cstError?.severidade).toBe('critico');
    });

    it('should detect invalid ICMS aliquota', () => {
      const nf = createValidNF();
      nf.icmsAliquota = 15; // Not in [0, 7, 12, 18, 19]

      const errors = rulesEngine.validate(nf);
      const aliquotaError = errors.find((e) => e.id === 'ICMS_ALIQUOTA_INVALIDA');
      expect(aliquotaError).toBeDefined();
      expect(aliquotaError?.valor).toBe(15);
    });

    it('should detect invalid CSOSN for Simples Nacional', () => {
      const nf = createValidNF();
      nf.csosn = '999'; // Invalid CSOSN

      const errors = rulesEngine.validate(nf, 'simples');
      const csosnError = errors.find((e) => e.id === 'CSOSN_INVALIDO');
      expect(csosnError).toBeDefined();
    });

    it('should skip CSOSN validation for non-Simples regime', () => {
      const nf = createValidNF();
      nf.csosn = '999'; // Invalid CSOSN

      const errors = rulesEngine.validate(nf, 'lucro_real');
      const csosnError = errors.find((e) => e.id === 'CSOSN_INVALIDO');
      expect(csosnError).toBeUndefined();
    });

    it('should detect empty documento fornecedor', () => {
      const nf = createValidNF();
      nf.documentoFornecedor = '';

      const errors = rulesEngine.validate(nf);
      const docError = errors.find((e) => e.id === 'DOCUMENTO_OBRIGATORIO_VAZIO');
      expect(docError).toBeDefined();
      expect(docError?.severidade).toBe('critico');
    });

    it('should detect negative valor', () => {
      const nf = createValidNF();
      nf.valor = -100;

      const errors = rulesEngine.validate(nf);
      const valorError = errors.find((e) => e.id === 'VALOR_NEGATIVO');
      expect(valorError).toBeDefined();
      expect(valorError?.severidade).toBe('critico');
    });

    it('should detect baseCalculoIcms > valor', () => {
      const nf = createValidNF();
      nf.valor = 100;
      nf.baseCalculoIcms = 200;

      const errors = rulesEngine.validate(nf);
      const baseError = errors.find((e) => e.id === 'BASE_CALCULO_INCONSISTENTE');
      expect(baseError).toBeDefined();
      expect(baseError?.severidade).toBe('critico');
    });

    it('should detect invalid regime', () => {
      const nf = createValidNF();
      nf.regime = 'regime_invalido' as any;

      const errors = rulesEngine.validate(nf);
      const regimeError = errors.find((e) => e.id === 'REGIME_INVALIDO');
      expect(regimeError).toBeDefined();
    });

    it('should allow valid aliquotas (0%, 7%, 12%, 18%, 19%)', () => {
      const validAliquotas = [0, 7, 12, 18, 19];

      validAliquotas.forEach((aliquota) => {
        const nf = createValidNF();
        nf.icmsAliquota = aliquota;
        const errors = rulesEngine.validate(nf);
        const aliquotaError = errors.find((e) => e.id === 'ICMS_ALIQUOTA_INVALIDA');
        expect(aliquotaError).toBeUndefined();
      });
    });

    it('should allow valid CFOP codes', () => {
      const validCfops = [5102, 5202, 5109, 6102, 6202];

      validCfops.forEach((cfop) => {
        const nf = createValidNF();
        nf.cfop = cfop;
        const errors = rulesEngine.validate(nf);
        const cfopError = errors.find((e) => e.id === 'CFOP_INVALIDO');
        expect(cfopError).toBeUndefined();
      });
    });

    it('should handle multiple validation errors', () => {
      const nf = createValidNF();
      nf.cfop = 9999; // Invalid CFOP
      nf.icmsAliquota = 15; // Invalid aliquota
      nf.valor = -100; // Negative value
      nf.documentoFornecedor = ''; // Empty document

      const errors = rulesEngine.validate(nf);
      expect(errors.length).toBeGreaterThanOrEqual(4);
      expect(errors.every((e) => e.severidade === 'critico')).toBe(true);
    });

    it('should include sugestoes in error responses', () => {
      const nf = createValidNF();
      nf.cfop = 9999;

      const errors = rulesEngine.validate(nf);
      const cfopError = errors[0];
      expect(cfopError.sugestao).toBeDefined();
      expect(cfopError.sugestao.length).toBeGreaterThan(0);
    });

    it('should include descricao in error responses', () => {
      const nf = createValidNF();
      nf.icmsAliquota = 15;

      const errors = rulesEngine.validate(nf);
      const aliquotaError = errors[0];
      expect(aliquotaError.descricao).toBeDefined();
      expect(aliquotaError.descricao.length).toBeGreaterThan(0);
    });

    it('should performance benchmark: validate < 10ms', () => {
      const nf = createValidNF();
      const iterations = 1000;

      const startTime = performance.now();
      for (let i = 0; i < iterations; i++) {
        rulesEngine.validate(nf);
      }
      const endTime = performance.now();

      const avgTime = (endTime - startTime) / iterations;
      expect(avgTime).toBeLessThan(10); // Average < 10ms per validation
    });

    it('should performance benchmark: validate complex NF < 15ms', () => {
      const nf = createValidNF();
      // Add many fields to make it more complex
      for (let i = 0; i < 100; i++) {
        (nf as any)[`field${i}`] = `value${i}`;
      }

      const startTime = performance.now();
      rulesEngine.validate(nf);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(15);
    });
  });

  describe('edge cases', () => {
    it('should handle zero valor', () => {
      const nf = createValidNF();
      nf.valor = 0;

      const errors = rulesEngine.validate(nf);
      const valorError = errors.find((e) => e.id === 'VALOR_NEGATIVO');
      expect(valorError).toBeUndefined(); // 0 is valid
    });

    it('should handle whitespace in documento', () => {
      const nf = createValidNF();
      nf.documentoFornecedor = '   '; // Only whitespace

      const errors = rulesEngine.validate(nf);
      const docError = errors.find((e) => e.id === 'DOCUMENTO_OBRIGATORIO_VAZIO');
      expect(docError).toBeDefined();
    });

    it('should handle baseCalculoIcms = valor (edge case)', () => {
      const nf = createValidNF();
      nf.valor = 100;
      nf.baseCalculoIcms = 100;

      const errors = rulesEngine.validate(nf);
      const baseError = errors.find((e) => e.id === 'BASE_CALCULO_INCONSISTENTE');
      expect(baseError).toBeUndefined(); // Equal is OK
    });

    it('should handle very large values', () => {
      const nf = createValidNF();
      nf.valor = 999999999.99;
      nf.baseCalculoIcms = 999999999.99;

      const errors = rulesEngine.validate(nf);
      const valorError = errors.find((e) => e.id === 'VALOR_NEGATIVO');
      expect(valorError).toBeUndefined();
    });
  });

  describe('regime detection', () => {
    it('should support simples regime', () => {
      const nf = createValidNF();
      nf.regime = 'simples';

      const errors = rulesEngine.validate(nf, 'simples');
      const regimeError = errors.find((e) => e.id === 'REGIME_INVALIDO');
      expect(regimeError).toBeUndefined();
    });

    it('should support lucro_real regime', () => {
      const nf = createValidNF();
      nf.regime = 'lucro_real';

      const errors = rulesEngine.validate(nf);
      const regimeError = errors.find((e) => e.id === 'REGIME_INVALIDO');
      expect(regimeError).toBeUndefined();
    });

    it('should support lucro_presumido regime', () => {
      const nf = createValidNF();
      nf.regime = 'lucro_presumido';

      const errors = rulesEngine.validate(nf);
      const regimeError = errors.find((e) => e.id === 'REGIME_INVALIDO');
      expect(regimeError).toBeUndefined();
    });
  });
});
