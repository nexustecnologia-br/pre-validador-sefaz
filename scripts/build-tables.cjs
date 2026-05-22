#!/usr/bin/env node
// Compila tabelas otimizadas em api/_tables.json (formato enxuto para serverless)
const fs = require('fs');
const path = require('path');

const REF = path.join(__dirname, '..', 'referencias');
const OUT = path.join(__dirname, '..', 'api', '_tables.json');

console.log('🔨 Compilando tabelas para serverless...\n');

// === 1. NCM VIGENTE ===
console.log('📦 NCM...');
const ncmRaw = JSON.parse(fs.readFileSync(path.join(REF, 'ncm.json'), 'utf8'));
const hoje = new Date();
const ncmVigentes = new Set();
let totalNcm = 0;
for (const item of ncmRaw.Nomenclaturas) {
  totalNcm++;
  const codigo = item.Codigo.replace(/\./g, ''); // remove pontos: "01.01.10.20" -> "01011020"
  // Aceitar só NCM completos de 8 dígitos (não capítulos/posições)
  if (codigo.length === 8) {
    // Verificar vigência
    const [d, m, y] = (item.Data_Fim || '31/12/9999').split('/');
    const fim = new Date(`${y}-${m}-${d}`);
    if (fim >= hoje) ncmVigentes.add(codigo);
  }
}
console.log(`   Total entradas: ${totalNcm} | NCM 8-dígitos vigentes: ${ncmVigentes.size}`);

// === 2. MUNICÍPIOS IBGE ===
console.log('📦 Municípios IBGE...');
const munRaw = JSON.parse(fs.readFileSync(path.join(REF, 'municipios.json'), 'utf8'));
const municipios = {}; // { "3550308": "SP", ... }
for (const m of munRaw) {
  const codigo = String(m.id);
  const uf = m['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla
    || m.microrregiao?.mesorregiao?.UF?.sigla;
  if (codigo && uf) municipios[codigo] = uf;
}
console.log(`   Municípios mapeados: ${Object.keys(municipios).length}`);

// === 3. CFOPS CONFAZ ===
console.log('📦 CFOPs...');
const cfopRaw = fs.readFileSync(path.join(REF, 'cfop.csv'), 'utf8');
const cfops = new Set();
const cfopDesc = {};
for (const linha of cfopRaw.split('\n')) {
  const m = linha.match(/^(\d{4});"?([^"]*)"?/);
  if (m) {
    cfops.add(m[1]);
    cfopDesc[m[1]] = m[2];
  }
}
console.log(`   CFOPs: ${cfops.size}`);

// === 4. cStat ===
console.log('📦 cStat (códigos retorno SEFAZ)...');
const cstatRaw = JSON.parse(fs.readFileSync(path.join(REF, 'cstat.json'), 'utf8'));
const cstat = {};
for (const c of cstatRaw) {
  cstat[c.cod] = { msg: c.msg, correct: c.correct, ok: c.status === '1' };
}
console.log(`   cStat: ${Object.keys(cstat).length} códigos`);

// === EMPACOTAR ===
const tabelas = {
  versao: new Date().toISOString().split('T')[0],
  ncm: Array.from(ncmVigentes).sort(),
  municipios,  // { codigo: uf }
  cfops: Array.from(cfops).sort(),
  cfopDesc,
  cstat,
  ncmTotal: totalNcm,
  ncmDataAtualizacao: ncmRaw.Data_Ultima_Atualizacao_NCM
};

fs.writeFileSync(OUT, JSON.stringify(tabelas));
const sz = fs.statSync(OUT).size;
console.log(`\n✅ ${OUT}`);
console.log(`   Tamanho: ${(sz / 1024).toFixed(1)} KB (${(sz / 1024 / 1024).toFixed(2)} MB)`);

// Versão minificada com Sets (gzipa melhor)
console.log('\n📊 Resumo:');
console.log(`   NCM vigentes: ${ncmVigentes.size}`);
console.log(`   Municípios: ${Object.keys(municipios).length}`);
console.log(`   CFOPs: ${cfops.size}`);
console.log(`   cStat: ${Object.keys(cstat).length}`);
