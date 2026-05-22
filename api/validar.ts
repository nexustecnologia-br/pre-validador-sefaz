import { VercelRequest, VercelResponse } from '@vercel/node';
import { validarIE } from './_ie-validator.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// === ESTRUTURAS OTIMIZADAS (carregadas 1x no cold start) ===
const tabelas: any = JSON.parse(readFileSync(join(process.cwd(), 'api', '_tables.json'), 'utf8'));
const NCM_VIGENTES = new Set<string>(tabelas.ncm);
const MUNICIPIOS: Record<string, string> = tabelas.municipios;
const CFOPS_VALIDOS = new Set<string>(tabelas.cfops);
const CFOP_DESC: Record<string, string> = tabelas.cfopDesc;

const UFS_VALIDAS = new Set(['11','12','13','14','15','16','17','21','22','23','24','25','26','27','28','29','31','32','33','35','41','42','43','50','51','52','53']);
const UF_SIGLAS: Record<string, string> = {
  '11':'RO','12':'AC','13':'AM','14':'RR','15':'PA','16':'AP','17':'TO',
  '21':'MA','22':'PI','23':'CE','24':'RN','25':'PB','26':'PE','27':'AL','28':'SE','29':'BA',
  '31':'MG','32':'ES','33':'RJ','35':'SP',
  '41':'PR','42':'SC','43':'RS',
  '50':'MS','51':'MT','52':'GO','53':'DF'
};

type Erro = { id: string; tipo: string; descricao: string; severidade: 'critico'|'aviso'; campo?: string; valor?: string };

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}>([^<]*)</${name}>`));
  return m ? m[1].trim() : null;
}

function tagIn(xml: string, parent: string, child: string): string | null {
  const block = xml.match(new RegExp(`<${parent}>[\\s\\S]*?</${parent}>`));
  if (!block) return null;
  return tag(block[0], child);
}

function validarCNPJ(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj)) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;
  const calc = (base: string, pesos: number[]) => {
    const sum = base.split('').reduce((acc, d, i) => acc + parseInt(d) * pesos[i], 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(cnpj.substring(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]);
  const d2 = calc(cnpj.substring(0, 13), [6,5,4,3,2,9,8,7,6,5,4,3,2]);
  return d1 === parseInt(cnpj[12]) && d2 === parseInt(cnpj[13]);
}

function validarCPF(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;
  const calc = (base: string, fator: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += parseInt(base[i]) * (fator - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = calc(cpf.substring(0, 9), 10);
  const d2 = calc(cpf.substring(0, 10), 11);
  return d1 === parseInt(cpf[9]) && d2 === parseInt(cpf[10]);
}

function validarChaveAcesso(chave: string): { valido: boolean; motivo?: string } {
  if (!/^\d{44}$/.test(chave)) return { valido: false, motivo: 'Chave deve ter 44 dígitos numéricos' };
  const pesos = [4,3,2,9,8,7,6,5,4,3,2,9,8,7,6,5,4,3,2,9,8,7,6,5,4,3,2,9,8,7,6,5,4,3,2,9,8,7,6,5,4,3,2];
  let sum = 0;
  for (let i = 0; i < 43; i++) sum += parseInt(chave[i]) * pesos[i];
  const r = sum % 11;
  const dv = r < 2 ? 0 : 11 - r;
  if (dv !== parseInt(chave[43])) return { valido: false, motivo: `DV inválido (esperado ${dv}, recebido ${chave[43]})` };
  return { valido: true };
}

// === NOVA: Validação de Assinatura Digital (estrutura) ===
function validarAssinaturaDigital(xml: string): { valido: boolean; motivo?: string } {
  if (!/<Signature[\s>]/.test(xml)) return { valido: false, motivo: 'Assinatura digital <Signature> não encontrada' };

  const sigBlock = xml.match(/<Signature[\s\S]*?<\/Signature>/);
  if (!sigBlock) return { valido: false, motivo: 'Bloco <Signature> inválido ou incompleto' };

  const sig = sigBlock[0];
  if (!/<SignedInfo[\s\S]*?<\/SignedInfo>/.test(sig)) return { valido: false, motivo: 'SignedInfo ausente em Signature' };
  if (!/<SignatureValue[\s\S]*?<\/SignatureValue>/.test(sig)) return { valido: false, motivo: 'SignatureValue ausente' };
  if (!/<KeyInfo[\s\S]*?<\/KeyInfo>/.test(sig)) return { valido: false, motivo: 'KeyInfo ausente' };

  const digestMatch = sig.match(/<DigestValue>([A-Za-z0-9+/=]+)<\/DigestValue>/);
  if (!digestMatch) return { valido: false, motivo: 'DigestValue ausente em Reference' };
  if (digestMatch[1].length < 20) return { valido: false, motivo: 'DigestValue muito curto (hash inválido)' };

  return { valido: true };
}

// === NOVA: Validação Reforma Tributária 2026 (IBS/CBS) ===
function validarIBSCBS(xml: string, nItem?: string): { valido: boolean; motivos: string[] } {
  const motivos: string[] = [];

  // Se houver bloco IBSCBS, validar campos obrigatórios
  const ibscbsBlock = xml.match(/<IBSCBS[\s\S]*?<\/IBSCBS>/);
  if (!ibscbsBlock) {
    // Sem IBSCBS é OK (pode ser regime não sujeito)
    return { valido: true, motivos: [] };
  }

  const campos = ['cClassTrib','pIBSUF','pCBS'];
  for (const campo of campos) {
    if (!tag(ibscbsBlock[0], campo)) {
      motivos.push(`IBSCBS: campo obrigatório <${campo}> ausente`);
    }
  }

  // Validar valores numéricos
  const pIBSUF = tag(ibscbsBlock[0], 'pIBSUF');
  const pIBSMun = tag(ibscbsBlock[0], 'pIBSMun');
  const pCBS = tag(ibscbsBlock[0], 'pCBS');

  if (pIBSUF && (!/^\d+(\.\d{2,4})?$/.test(pIBSUF) || parseFloat(pIBSUF) > 100)) {
    motivos.push(`IBSCBS: pIBSUF "${pIBSUF}" deve ser 0-100 com até 4 casas`);
  }
  if (pIBSMun && (!/^\d+(\.\d{2,4})?$/.test(pIBSMun) || parseFloat(pIBSMun) > 100)) {
    motivos.push(`IBSCBS: pIBSMun "${pIBSMun}" deve ser 0-100 com até 4 casas`);
  }
  if (pCBS && (!/^\d+(\.\d{2,4})?$/.test(pCBS) || parseFloat(pCBS) > 100)) {
    motivos.push(`IBSCBS: pCBS "${pCBS}" deve ser 0-100 com até 4 casas`);
  }

  // Fórmula: vBCIBSCBS = vProd - vDesc + vST
  const vBCIBSCBS = tag(ibscbsBlock[0], 'vBCIBSCBS');
  const vIBS = tag(ibscbsBlock[0], 'vIBS');
  const vCBS = tag(ibscbsBlock[0], 'vCBS');

  if (vIBS && pIBSUF) {
    const calc = parseFloat(vBCIBSCBS || '0') * (parseFloat(pIBSUF) / 100);
    const actual = parseFloat(vIBS);
    if (Math.abs(calc - actual) > 0.01) {
      motivos.push(`IBSCBS: vIBS=${actual} inconsistente com cálculo=${calc.toFixed(2)}`);
    }
  }
  if (vCBS && pCBS) {
    const calc = parseFloat(vBCIBSCBS || '0') * (parseFloat(pCBS) / 100);
    const actual = parseFloat(vCBS);
    if (Math.abs(calc - actual) > 0.01) {
      motivos.push(`IBSCBS: vCBS=${actual} inconsistente com cálculo=${calc.toFixed(2)}`);
    }
  }

  return { valido: motivos.length === 0, motivos };
}

// === NOVA: Validação de Impostos (ICMS, IPI, PIS, COFINS) ===
function validarFormulasImpostos(xml: string, nItem: string): { valido: boolean; motivos: string[] } {
  const motivos: string[] = [];

  const detBlock = xml.match(new RegExp(`<det\\s+nItem="${nItem}">[\\s\\S]*?<\\/det>`));
  if (!detBlock) return { valido: true, motivos: [] };

  const prodBlock = detBlock[0].match(/<prod>[\s\S]*?<\/prod>/);
  if (!prodBlock) return { valido: true, motivos: [] };

  const imposto = detBlock[0].match(/<imposto>[\s\S]*?<\/imposto>/);
  if (!imposto) return { valido: true, motivos: [] };

  const imp = imposto[0];
  const num = (name: string) => {
    const v = tag(imp, name);
    if (!v) return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };

  // ICMS: vBC × aliq / 100 = vICMS (tolerance ±0.01)
  const icmsBlock = imp.match(/<ICMS\d+>[\s\S]*?<\/ICMS\d+>/);
  if (icmsBlock) {
    const vBC = tag(icmsBlock[0], 'vBC');
    const pICMS = tag(icmsBlock[0], 'pICMS');
    const vICMS = tag(icmsBlock[0], 'vICMS');

    if (vBC && pICMS && vICMS) {
      const calc = (parseFloat(vBC) * parseFloat(pICMS)) / 100;
      const actual = parseFloat(vICMS);
      if (Math.abs(calc - actual) > 0.01) {
        motivos.push(`Item ${nItem}: vICMS=${actual} ≠ cálculo (${vBC}×${pICMS}%)=${calc.toFixed(2)}`);
      }
    }
  }

  // IPI: vBC × pIPI / 100 = vIPI
  const ipiBlock = imp.match(/<IPI>[\s\S]*?<\/IPI>/);
  if (ipiBlock) {
    const vBC = tag(ipiBlock[0], 'vBC');
    const pIPI = tag(ipiBlock[0], 'pIPI');
    const vIPI = tag(ipiBlock[0], 'vIPI');

    if (vBC && pIPI && vIPI) {
      const calc = (parseFloat(vBC) * parseFloat(pIPI)) / 100;
      const actual = parseFloat(vIPI);
      if (Math.abs(calc - actual) > 0.01) {
        motivos.push(`Item ${nItem}: vIPI=${actual} ≠ cálculo=${calc.toFixed(2)}`);
      }
    }
  }

  // PIS/COFINS: vBC × aliq / 100 = vPIS/vCOFINS
  const pisBlock = imp.match(/<PIS\d+>[\s\S]*?<\/PIS\d+>/);
  if (pisBlock) {
    const vBC = tag(pisBlock[0], 'vBC');
    const pPIS = tag(pisBlock[0], 'pPIS');
    const vPIS = tag(pisBlock[0], 'vPIS');

    if (vBC && pPIS && vPIS) {
      const calc = (parseFloat(vBC) * parseFloat(pPIS)) / 100;
      const actual = parseFloat(vPIS);
      if (Math.abs(calc - actual) > 0.01) {
        motivos.push(`Item ${nItem}: vPIS=${actual} ≠ cálculo=${calc.toFixed(2)}`);
      }
    }
  }

  const cofinsBlock = imp.match(/<COFINS\d+>[\s\S]*?<\/COFINS\d+>/);
  if (cofinsBlock) {
    const vBC = tag(cofinsBlock[0], 'vBC');
    const pCOFINS = tag(cofinsBlock[0], 'pCOFINS');
    const vCOFINS = tag(cofinsBlock[0], 'vCOFINS');

    if (vBC && pCOFINS && vCOFINS) {
      const calc = (parseFloat(vBC) * parseFloat(pCOFINS)) / 100;
      const actual = parseFloat(vCOFINS);
      if (Math.abs(calc - actual) > 0.01) {
        motivos.push(`Item ${nItem}: vCOFINS=${actual} ≠ cálculo=${calc.toFixed(2)}`);
      }
    }
  }

  return { valido: motivos.length === 0, motivos };
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  const t0 = Date.now();
  const { xmlContent } = req.body || {};
  if (!xmlContent || typeof xmlContent !== 'string') {
    return res.status(400).json({ status: 'error', message: 'xmlContent obrigatório (string)' });
  }

  const xml = xmlContent.replace(/^﻿/, '').trim();
  const erros: Erro[] = [];
  const avisos: Erro[] = [];
  const push = (e: Erro) => (e.severidade === 'critico' ? erros : avisos).push(e);

  if (!xml.startsWith('<')) {
    push({ id: 'FMT001', tipo: 'FORMATO_INVALIDO', descricao: 'Conteúdo não é XML', severidade: 'critico' });
    return res.status(200).json({ status: 'rejeitado', erros, avisos, tempoProcessamento: Date.now() - t0 });
  }

  const isNFe = /<NFe[\s>]/.test(xml) || /<nfeProc[\s>]/.test(xml);
  const isCTe = /<CTe[\s>]/.test(xml) || /<cteProc[\s>]/.test(xml);
  const isNFSe = /<(Nfse|NFSe|CompNfse|InfNfse)[\s>]/i.test(xml);

  if (!isNFe && !isCTe && !isNFSe) {
    push({ id: 'TIPO001', tipo: 'TIPO_DESCONHECIDO', descricao: 'XML não identificado como NF-e, CT-e ou NFS-e', severidade: 'critico' });
  }

  // === VALIDAÇÃO DE ASSINATURA DIGITAL (ALL DOCS) ===
  const assinaturaVal = validarAssinaturaDigital(xml);
  if (!assinaturaVal.valido) {
    push({ id: 'SIG001', tipo: 'ASSINATURA_INVALIDA', descricao: `Assinatura digital inválida: ${assinaturaVal.motivo}`, severidade: 'critico', campo: 'Signature' });
  }

  // === VALIDAÇÕES NF-e ===
  if (isNFe) {
    // Chave de acesso
    const idMatch = xml.match(/Id="NFe(\d{44})"/);
    if (!idMatch) {
      push({ id: 'NFE001', tipo: 'CHAVE_AUSENTE', descricao: 'Atributo Id da infNFe ausente ou inválido', severidade: 'critico', campo: 'infNFe/@Id' });
    } else {
      const v = validarChaveAcesso(idMatch[1]);
      if (!v.valido) push({ id: 'NFE002', tipo: 'CHAVE_INVALIDA', descricao: `Chave de acesso inválida: ${v.motivo}`, severidade: 'critico', campo: 'infNFe/@Id', valor: idMatch[1] });
    }

    // Campos obrigatórios <ide>
    const obrigatoriosIde = ['cUF','cNF','natOp','mod','serie','nNF','dhEmi','tpNF','idDest','cMunFG','tpImp','tpEmis','cDV','tpAmb','finNFe','indFinal','indPres'];
    for (const campo of obrigatoriosIde) {
      const v = tagIn(xml, 'ide', campo);
      if (v === null) push({ id: `IDE_${campo}`, tipo: 'CAMPO_AUSENTE', descricao: `Campo obrigatório <${campo}> AUSENTE em <ide>`, severidade: 'critico', campo: `ide/${campo}` });
      else if (v === '') push({ id: `IDE_${campo}`, tipo: 'CAMPO_VAZIO', descricao: `Campo obrigatório <${campo}> está VAZIO em <ide>`, severidade: 'critico', campo: `ide/${campo}` });
    }

    const cUF = tagIn(xml, 'ide', 'cUF');
    if (cUF && !UFS_VALIDAS.has(cUF)) push({ id: 'IDE_cUF_INV', tipo: 'UF_INVALIDA', descricao: `cUF "${cUF}" não é código IBGE válido`, severidade: 'critico', campo: 'ide/cUF', valor: cUF });

    const mod = tagIn(xml, 'ide', 'mod');
    if (mod && mod !== '55' && mod !== '65') push({ id: 'IDE_MOD', tipo: 'MODELO_INVALIDO', descricao: `Modelo "${mod}" inválido (esperado 55 ou 65)`, severidade: 'critico', campo: 'ide/mod', valor: mod });

    const tpAmb = tagIn(xml, 'ide', 'tpAmb');
    if (tpAmb && tpAmb !== '1' && tpAmb !== '2') push({ id: 'IDE_AMB', tipo: 'AMBIENTE_INVALIDO', descricao: `tpAmb "${tpAmb}" inválido (1=produção, 2=homologação)`, severidade: 'critico', campo: 'ide/tpAmb', valor: tpAmb });
    else if (tpAmb === '2') push({ id: 'IDE_HOMOLOG', tipo: 'AMBIENTE_HOMOLOGACAO', descricao: 'NF-e em ambiente HOMOLOGAÇÃO (sem valor fiscal)', severidade: 'aviso', campo: 'ide/tpAmb' });

    // Consistência cUF na chave
    if (idMatch && cUF) {
      const cUFnaChave = idMatch[1].substring(0, 2);
      if (cUFnaChave !== cUF) push({ id: 'CHAVE_UF', tipo: 'INCONSISTENCIA', descricao: `cUF (${cUF}) diferente dos 2 primeiros dígitos da chave (${cUFnaChave})`, severidade: 'critico' });
    }

    // Município de fato gerador
    const cMunFG = tagIn(xml, 'ide', 'cMunFG');
    if (cMunFG) {
      if (!/^\d{7}$/.test(cMunFG)) push({ id: 'IDE_cMunFG_FMT', tipo: 'MUNICIPIO_FORMATO', descricao: `cMunFG "${cMunFG}" deve ter 7 dígitos`, severidade: 'critico', campo: 'ide/cMunFG', valor: cMunFG });
      else if (!MUNICIPIOS[cMunFG]) push({ id: 'IDE_cMunFG_INEX', tipo: 'MUNICIPIO_INEXISTENTE', descricao: `cMunFG ${cMunFG} não existe na tabela IBGE`, severidade: 'critico', campo: 'ide/cMunFG', valor: cMunFG });
      else if (cUF && UF_SIGLAS[cUF] && MUNICIPIOS[cMunFG] !== UF_SIGLAS[cUF]) push({ id: 'IDE_cMunFG_UF', tipo: 'MUNICIPIO_UF_INCONSISTENTE', descricao: `cMunFG ${cMunFG} pertence a ${MUNICIPIOS[cMunFG]}, mas cUF declara ${UF_SIGLAS[cUF]}`, severidade: 'critico' });
    }

    // Emitente
    const emitBlock = xml.match(/<emit>[\s\S]*?<\/emit>/);
    if (!emitBlock) {
      push({ id: 'EMIT001', tipo: 'CAMPO_OBRIGATORIO', descricao: 'Bloco <emit> ausente', severidade: 'critico', campo: 'emit' });
    } else {
      const cnpjEmit = tag(emitBlock[0], 'CNPJ');
      const cpfEmit = tag(emitBlock[0], 'CPF');
      if (!cnpjEmit && !cpfEmit) push({ id: 'EMIT_DOC', tipo: 'CAMPO_OBRIGATORIO', descricao: 'Emitente sem CNPJ nem CPF', severidade: 'critico', campo: 'emit/CNPJ' });
      else if (cnpjEmit && !validarCNPJ(cnpjEmit)) push({ id: 'EMIT_CNPJ', tipo: 'CNPJ_INVALIDO', descricao: 'CNPJ do emitente inválido (DV não confere)', severidade: 'critico', campo: 'emit/CNPJ', valor: cnpjEmit });
      else if (cpfEmit && !validarCPF(cpfEmit)) push({ id: 'EMIT_CPF', tipo: 'CPF_INVALIDO', descricao: 'CPF do emitente inválido (DV não confere)', severidade: 'critico', campo: 'emit/CPF', valor: cpfEmit });

      if (!tag(emitBlock[0], 'xNome')) push({ id: 'EMIT_NOME', tipo: 'CAMPO_OBRIGATORIO', descricao: 'Razão social <xNome> do emitente ausente', severidade: 'critico', campo: 'emit/xNome' });

      const enderEmit = emitBlock[0].match(/<enderEmit>[\s\S]*?<\/enderEmit>/);
      if (!enderEmit) {
        push({ id: 'EMIT_END', tipo: 'CAMPO_OBRIGATORIO', descricao: 'Endereço do emitente <enderEmit> ausente', severidade: 'critico', campo: 'emit/enderEmit' });
      } else {
        for (const campo of ['xLgr','nro','xBairro','cMun','xMun','UF','CEP']) {
          if (!tag(enderEmit[0], campo)) push({ id: `END_${campo}`, tipo: 'CAMPO_OBRIGATORIO', descricao: `Endereço do emitente sem <${campo}>`, severidade: 'critico', campo: `enderEmit/${campo}` });
        }
        const ufEmit = tag(enderEmit[0], 'UF');
        const cMunEmit = tag(enderEmit[0], 'cMun');
        if (ufEmit && !Object.values(UF_SIGLAS).includes(ufEmit)) push({ id: 'END_UF_INV', tipo: 'UF_INVALIDA', descricao: `Sigla UF "${ufEmit}" inválida`, severidade: 'critico', campo: 'enderEmit/UF', valor: ufEmit });
        if (cUF && ufEmit && UF_SIGLAS[cUF] && UF_SIGLAS[cUF] !== ufEmit) push({ id: 'UF_INCONSIST', tipo: 'INCONSISTENCIA', descricao: `UF emitente (${ufEmit}) ≠ cUF ${cUF} (${UF_SIGLAS[cUF]})`, severidade: 'critico' });

        // Município emitente vs IBGE
        if (cMunEmit) {
          if (!/^\d{7}$/.test(cMunEmit)) push({ id: 'END_cMun_FMT', tipo: 'MUNICIPIO_FORMATO', descricao: `cMun emitente "${cMunEmit}" deve ter 7 dígitos`, severidade: 'critico', campo: 'enderEmit/cMun', valor: cMunEmit });
          else if (!MUNICIPIOS[cMunEmit]) push({ id: 'END_cMun_INEX', tipo: 'MUNICIPIO_INEXISTENTE', descricao: `cMun emitente ${cMunEmit} não existe na tabela IBGE`, severidade: 'critico', campo: 'enderEmit/cMun', valor: cMunEmit });
          else if (ufEmit && MUNICIPIOS[cMunEmit] !== ufEmit) push({ id: 'END_cMun_UF', tipo: 'MUNICIPIO_UF_INCONSISTENTE', descricao: `cMun ${cMunEmit} pertence a ${MUNICIPIOS[cMunEmit]}, mas UF emitente é ${ufEmit}`, severidade: 'critico' });
        }

        const cep = tag(enderEmit[0], 'CEP');
        if (cep && !/^\d{8}$/.test(cep)) push({ id: 'END_CEP', tipo: 'CEP_INVALIDO', descricao: `CEP "${cep}" inválido`, severidade: 'critico', campo: 'enderEmit/CEP', valor: cep });

        // IE por UF
        const ieEmit = tag(emitBlock[0], 'IE');
        if (ieEmit && ufEmit) {
          const ieVal = validarIE(ieEmit, ufEmit);
          if (!ieVal.valido) push({ id: 'EMIT_IE', tipo: 'IE_INVALIDA', descricao: `IE "${ieEmit}" inválida para ${ufEmit}: ${ieVal.motivo}`, severidade: 'critico', campo: 'emit/IE', valor: ieEmit });
        }
      }
    }

    // Destinatário
    const destBlock = xml.match(/<dest>[\s\S]*?<\/dest>/);
    if (!destBlock) {
      push({ id: 'DEST001', tipo: 'CAMPO_OBRIGATORIO', descricao: 'Bloco <dest> ausente', severidade: 'critico', campo: 'dest' });
    } else {
      const cnpjDest = tag(destBlock[0], 'CNPJ');
      const cpfDest = tag(destBlock[0], 'CPF');
      if (cnpjDest && !validarCNPJ(cnpjDest)) push({ id: 'DEST_CNPJ', tipo: 'CNPJ_INVALIDO', descricao: 'CNPJ destinatário inválido', severidade: 'critico', campo: 'dest/CNPJ', valor: cnpjDest });
      if (cpfDest && !validarCPF(cpfDest)) push({ id: 'DEST_CPF', tipo: 'CPF_INVALIDO', descricao: 'CPF destinatário inválido', severidade: 'critico', campo: 'dest/CPF', valor: cpfDest });
    }

    // Itens
    const itens = [...xml.matchAll(/<det\s+nItem="(\d+)">([\s\S]*?)<\/det>/g)];
    if (itens.length === 0) push({ id: 'DET001', tipo: 'CAMPO_OBRIGATORIO', descricao: 'Nenhum item <det> encontrado', severidade: 'critico', campo: 'det' });

    let somaProd = 0;
    for (const it of itens) {
      const nItem = it[1];
      const prodBlock = it[2].match(/<prod>[\s\S]*?<\/prod>/);
      if (!prodBlock) { push({ id: `DET${nItem}_PROD`, tipo: 'CAMPO_OBRIGATORIO', descricao: `Item ${nItem}: bloco <prod> ausente`, severidade: 'critico' }); continue; }

      const cfop = tag(prodBlock[0], 'CFOP');
      if (!cfop) push({ id: `DET${nItem}_CFOP`, tipo: 'CAMPO_OBRIGATORIO', descricao: `Item ${nItem}: CFOP ausente`, severidade: 'critico' });
      else if (!CFOPS_VALIDOS.has(cfop)) push({ id: `DET${nItem}_CFOP_INV`, tipo: 'CFOP_INVALIDO', descricao: `Item ${nItem}: CFOP ${cfop} não consta na tabela CONFAZ (${CFOPS_VALIDOS.size} CFOPs)`, severidade: 'critico', valor: cfop });

      const vProd = parseFloat(tag(prodBlock[0], 'vProd') || '0');
      if (vProd < 0) push({ id: `DET${nItem}_VAL`, tipo: 'VALOR_NEGATIVO', descricao: `Item ${nItem}: vProd negativo (${vProd})`, severidade: 'critico' });
      somaProd += vProd;

      for (const campo of ['cProd','xProd','NCM','uCom','qCom','vUnCom','vProd']) {
        if (!tag(prodBlock[0], campo)) push({ id: `DET${nItem}_${campo}`, tipo: 'CAMPO_OBRIGATORIO', descricao: `Item ${nItem}: <${campo}> ausente`, severidade: 'critico' });
      }

      const ncm = tag(prodBlock[0], 'NCM');
      if (ncm) {
        if (!/^\d{8}$/.test(ncm) && ncm !== '00') {
          push({ id: `DET${nItem}_NCM_FMT`, tipo: 'NCM_FORMATO', descricao: `Item ${nItem}: NCM "${ncm}" deve ter 8 dígitos`, severidade: 'critico', valor: ncm });
        } else if (ncm !== '00' && !NCM_VIGENTES.has(ncm)) {
          push({ id: `DET${nItem}_NCM_INEX`, tipo: 'NCM_NAO_VIGENTE', descricao: `Item ${nItem}: NCM ${ncm} não consta na tabela vigente CAMEX (${NCM_VIGENTES.size} NCMs)`, severidade: 'critico', valor: ncm });
        }
      }

      // === NOVA: Validação de Impostos (ICMS, IPI, PIS, COFINS) ===
      const impostoVal = validarFormulasImpostos(it[2], nItem);
      if (!impostoVal.valido) {
        for (const motivo of impostoVal.motivos) {
          push({ id: `DET${nItem}_IMPOSTO`, tipo: 'FORMULA_IMPOSTO_INCONSISTENTE', descricao: motivo, severidade: 'critico' });
        }
      }

      // === NOVA: Validação IBS/CBS (Reforma Tributária 2026) ===
      const ibscbsVal = validarIBSCBS(it[2], nItem);
      if (!ibscbsVal.valido) {
        for (const motivo of ibscbsVal.motivos) {
          push({ id: `DET${nItem}_IBSCBS`, tipo: 'REFORMA_TRIBUTARIA_INVALIDA', descricao: motivo, severidade: 'aviso', campo: `det[${nItem}]/IBSCBS` });
        }
      }
    }

    // Totais
    const icmsTotBlock = xml.match(/<ICMSTot>[\s\S]*?<\/ICMSTot>/);
    const totBody = icmsTotBlock ? icmsTotBlock[0] : '';
    const num = (name: string): number | null => {
      const v = tag(totBody, name);
      if (v === null) return null;
      if (v === '') return NaN;
      const n = parseFloat(v);
      return isNaN(n) ? NaN : n;
    };
    const vNF = num('vNF');
    const vProdTot = num('vProd');
    const getV = (n: string) => { const x = num(n); return x === null || Number.isNaN(x) ? 0 : x; };
    const vDesc = getV('vDesc'), vST = getV('vST'), vFrete = getV('vFrete'), vSeg = getV('vSeg'), vOutro = getV('vOutro'), vII = getV('vII'), vIPI = getV('vIPI'), vFCP = getV('vFCP');

    if (vNF === null) push({ id: 'TOT_VNF', tipo: 'CAMPO_AUSENTE', descricao: 'Total <vNF> ausente', severidade: 'critico', campo: 'total/ICMSTot/vNF' });

    for (const name of ['vNF','vProd','vDesc','vST','vFrete','vSeg','vOutro','vII','vIPI','vFCP']) {
      const v = num(name);
      if (Number.isNaN(v)) push({ id: `TOT_${name}_VAZIO`, tipo: 'CAMPO_VAZIO_NUMERICO', descricao: `Campo numérico <${name}> está VAZIO (schema rejeita)`, severidade: 'critico', campo: `ICMSTot/${name}` });
    }

    if (vProdTot !== null && !Number.isNaN(vProdTot) && itens.length > 0 && Math.abs(vProdTot - somaProd) > 0.01) {
      push({ id: 'TOT_VPROD', tipo: 'INCONSISTENCIA', descricao: `Soma itens (${somaProd.toFixed(2)}) ≠ total vProd (${vProdTot.toFixed(2)})`, severidade: 'critico' });
    }

    // Fórmula oficial vNF
    if (vNF !== null && !Number.isNaN(vNF) && vProdTot !== null && !Number.isNaN(vProdTot)) {
      const calc = vProdTot - vDesc + vST + vFrete + vSeg + vOutro + vII + vIPI + vFCP;
      if (Math.abs(calc - vNF) > 0.05) {
        push({ id: 'TOT_VNF_CALC', tipo: 'FORMULA_VNF_INCONSISTENTE', descricao: `Fórmula vNF: ${vProdTot}-${vDesc}+${vST}+${vFrete}+${vSeg}+${vOutro}+${vII}+${vIPI}+${vFCP}=${calc.toFixed(2)} ≠ vNF declarado ${vNF.toFixed(2)} (diff ${Math.abs(calc-vNF).toFixed(2)})`, severidade: 'critico', campo: 'ICMSTot/vNF' });
      }
    }

    // CFOP × idDest
    const idDest = tagIn(xml, 'ide', 'idDest');
    if (idDest && itens.length > 0) {
      for (const it of itens) {
        const nItem = it[1];
        const cfop = tag(it[2], 'CFOP');
        if (!cfop) continue;
        const p = cfop[0];
        if (idDest === '1' && p !== '1' && p !== '5') push({ id: `CFOP_DEST_${nItem}`, tipo: 'CFOP_DESTINO_INCOMPATIVEL', descricao: `Item ${nItem}: idDest=1 (interna) mas CFOP ${cfop} não começa com 1 ou 5`, severidade: 'critico', valor: cfop });
        else if (idDest === '2' && p !== '2' && p !== '6') push({ id: `CFOP_DEST_${nItem}`, tipo: 'CFOP_DESTINO_INCOMPATIVEL', descricao: `Item ${nItem}: idDest=2 (interestadual) mas CFOP ${cfop} não começa com 2 ou 6`, severidade: 'critico', valor: cfop });
        else if (idDest === '3' && p !== '3' && p !== '7') push({ id: `CFOP_DEST_${nItem}`, tipo: 'CFOP_DESTINO_INCOMPATIVEL', descricao: `Item ${nItem}: idDest=3 (exterior) mas CFOP ${cfop} não começa com 3 ou 7`, severidade: 'critico', valor: cfop });
      }
    }

    // === NOVA: Validação de Totais de Impostos (vTotTrib) ===
    // vTotTrib = vII + vIPI + vICMS + vPIS + vCOFINS + vFCP
    const vTotTrib = num('vTotTrib');
    if (vTotTrib !== null && !Number.isNaN(vTotTrib)) {
      const vICMS = getV('vICMS'), vIPI = getV('vIPI');
      const vPIS = getV('vPIS'), vCOFINS = getV('vCOFINS');
      const calc = vII + vIPI + vICMS + vPIS + vCOFINS + vFCP;
      if (Math.abs(calc - vTotTrib) > 0.05) {
        push({ id: 'TOT_TOTRIB', tipo: 'FORMULA_TOTRIB_INCONSISTENTE', descricao: `Fórmula vTotTrib: ${vICMS}+${vIPI}+${vPIS}+${vCOFINS}+${vFCP}=${calc.toFixed(2)} ≠ ${vTotTrib.toFixed(2)} (diff ${Math.abs(calc-vTotTrib).toFixed(2)})`, severidade: 'critico', campo: 'ICMSTot/vTotTrib' });
      }
    }

    // === NOVA: Validação IBS/CBS no nível do documento ===
    const ibscbsDocVal = validarIBSCBS(xml);
    if (!ibscbsDocVal.valido) {
      for (const motivo of ibscbsDocVal.motivos) {
        push({ id: 'DOC_IBSCBS', tipo: 'REFORMA_TRIBUTARIA_INVALIDA', descricao: motivo, severidade: 'aviso', campo: 'total/IBSCBS' });
      }
    }
  }

  // === VALIDAÇÕES CT-e ===
  if (isCTe) {
    const idMatch = xml.match(/Id="CTe(\d{44})"/);
    if (!idMatch) push({ id: 'CTE001', tipo: 'CHAVE_AUSENTE', descricao: 'Atributo Id da infCte ausente', severidade: 'critico' });
    else {
      const v = validarChaveAcesso(idMatch[1]);
      if (!v.valido) push({ id: 'CTE002', tipo: 'CHAVE_INVALIDA', descricao: `Chave CT-e inválida: ${v.motivo}`, severidade: 'critico', valor: idMatch[1] });
    }
    const cfopCte = tagIn(xml, 'ide', 'CFOP');
    if (cfopCte && !CFOPS_VALIDOS.has(cfopCte)) push({ id: 'CTE_CFOP', tipo: 'CFOP_INVALIDO', descricao: `CFOP ${cfopCte} não consta na tabela`, severidade: 'critico', valor: cfopCte });
  }

  // Resposta
  const nNF = isNFe ? tagIn(xml, 'ide', 'nNF') : null;
  const cfop = isNFe ? (xml.match(/<det\s+nItem="1">[\s\S]*?<CFOP>(\d+)<\/CFOP>/)?.[1] || null) : tagIn(xml, 'ide', 'CFOP');
  const vNF = tagIn(xml, 'ICMSTot', 'vNF') || tagIn(xml, 'total', 'vNF');
  const dhEmi = tagIn(xml, 'ide', 'dhEmi');
  const emitCNPJ = xml.match(/<emit>[\s\S]*?<CNPJ>(\d+)<\/CNPJ>/)?.[1] || null;
  const destCNPJ = xml.match(/<dest>[\s\S]*?<CNPJ>(\d+)<\/CNPJ>/)?.[1] || null;

  return res.status(200).json({
    status: erros.length > 0 ? 'rejeitado' : 'aprovado',
    validacaoId: Math.random().toString(36).substr(2, 9),
    tipoDocumento: isNFe ? 'NFe' : isCTe ? 'CTe' : isNFSe ? 'NFSe' : 'desconhecido',
    nfe: nNF,
    valor: vNF ? parseFloat(vNF) : null,
    cfop,
    cfopDescricao: cfop ? CFOP_DESC[cfop] || null : null,
    dataEmissao: dhEmi,
    cnpjFornecedor: emitCNPJ,
    cnpjComprador: destCNPJ,
    totalErros: erros.length,
    totalAvisos: avisos.length,
    erros,
    avisos,
    tabelas: { ncm: NCM_VIGENTES.size, municipios: Object.keys(MUNICIPIOS).length, cfops: CFOPS_VALIDOS.size, atualizacaoNcm: tabelas.ncmDataAtualizacao },
    tempoProcessamento: Date.now() - t0
  });
}
