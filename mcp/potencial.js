/* Potencial da Cidade (a "Calculadora de Franquias 2026" do Aladim) para o MCP.
   ⛔ NÃO reimplementa a conta: carrega o `potCalcular` REAL de js/potencial/potencial.js numa sandbox `vm` (o motor é puro,
   sem DOM nem rede — ver o cabeçalho do arquivo). Tela, slide e MCP leem a mesma aritmética. Tarifa/tickets/cidades vêm das tabelas
   luma.potencial_* pelo login do usuário (RLS: só a equipe comercial); nada sensível é guardado aqui. SOMENTE LEITURA. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const banco=require('./banco.js');

const ctx=vm.createContext({console});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/potencial/potencial.js'),'utf8'),ctx,{filename:'potencial.js'});
const M=vm.runInContext('({potCalcular,potCamposSlide,potBRL,potBRL2,potNumero,potPct,potMeses})',ctx);

let cache=null;
async function tarifa(){
  if(cache&&Date.now()-cache.t<600000) return cache.P;
  const [f,p]=await Promise.all([banco.ler('potencial_faixas','select=*&order=pop_min'),banco.ler('potencial_parametros','select=chave,valor')]);
  if(!f.length||!p.length) throw new Error('Tarifas do Potencial indisponíveis. '+banco.SEM_ACESSO);
  const param={}; p.forEach(r=>{ param[r.chave]=r.valor; }); cache={t:Date.now(),P:{faixas:f,param}}; return cache.P;
}
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[%_,()\/\-–]/g,' ').replace(/\s+/g,' ').trim();
async function buscar(termo,limite=12){
  const t=norm(termo); if(t.length<2) return [];
  return banco.ler('potencial_cidades',`select=*&busca=ilike.${encodeURIComponent('*'+t+'*')}&order=populacao.desc&limit=${limite}`);
}
/* uma cidade só: chave exata ou termo que resolve para UMA linha (senão devolve as candidatas) */
async function resolverCidade(ref){
  const r=String(ref||'').trim(); if(!r) throw new Error('informe a cidade');
  const ex=await banco.ler('potencial_cidades',`select=*&chave=eq.${encodeURIComponent(r)}&limit=1`).catch(()=>[]);
  if(ex.length) return {cidade:ex[0]};
  const l=await buscar(r,8); if(!l.length) throw new Error('nenhuma cidade encontrada para "'+r+'". '+banco.SEM_ACESSO);
  const nomeExato=l.filter(c=>norm(c.nome)===norm(r)); if(nomeExato.length===1) return {cidade:nomeExato[0]};
  if(l.length===1) return {cidade:l[0]};
  return {candidatas:l};
}
/* comissao/rebate/simples aceitam 0,15 ou 15 (%) */
function ajustes(a={}){ const o={}, fr=v=>v>1?v/100:v;
  if(a.concorrentes!=null) o.concorrentes=+a.concorrentes; if(a.ticket!=null) o.ticket=+a.ticket;
  for(const k of ['comissao','rebate','simples']) if(a[k]!=null) o[k]=fr(+a[k]); return o; }
const calcular=(c,P,ov)=>M.potCalcular(c,P,ov);
const cen=(calc,id)=>calc.cenarios.find(x=>x.id===id)||calc.cenarios[1]||calc.cenarios[0];
const linhaCidade=c=>`${c.chave} · ${c.nome}-${c.uf} · ${M.potNumero(c.populacao)} hab.${c.concorrentes!=null?' · '+c.concorrentes+' concorrente(s)':''}${c.operacao_fase?' · DM já opera ('+c.operacao_fase+')':''}${c.vender===false?' · NÃO VENDER':''}`;
function resumo(calc){
  const c=calc.cidade, L=[`${c.nome}-${c.uf} · ${M.potNumero(c.populacao)} hab. · região ${calc.regiao||'?'} · ${calc.conc} concorrente(s)`,
    `Investimento: taxa ${M.potBRL(calc.taxa)} + marketing ${M.potBRL(calc.mkt)} = ${M.potBRL(calc.inv)}`,
    `Premissas: ticket real ${M.potBRL2(calc.ticketReal)} · comissão ${M.potPct(calc.comissao,1)} · ${M.potPct(calc.rebate,0)} ao franqueado · Simples ${M.potPct(calc.simples,1)} · IPCA ${M.potPct(calc.ipca,2)}`];
  for(const s of calc.cenarios) L.push(`  ${s.id.padEnd(5)} ${M.potPct(s.pct,0)} da pop. → ${M.potNumero(s.usuarios)} usuários · GMV ${M.potBRL(s.gmv)}/mês · receita ${M.potBRL(s.receita)}/mês · lucro ${M.potBRL(s.lucro)}/ano · payback ${M.potMeses(s.payback)} · ROI ${M.potPct(s.roi,0)}`);
  if(calc.avisos.length) L.push('AVISOS:',...calc.avisos.map(x=>'  - '+x));
  return L.join('\n');
}
module.exports={M,tarifa,buscar,resolverCidade,ajustes,calcular,cen,linhaCidade,resumo};
