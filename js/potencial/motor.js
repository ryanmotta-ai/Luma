/**
 * js/potencial/motor.js
 *
 * POTENCIAL DA CIDADE — o MOTOR (v2, 30/10/2026). Puro: sem DOM, sem rede, sem estado.
 * ---------------------------------------------------------------------------
 * ⛔ UM motor. Tela (potencial.js), gráficos (graficos.js), comparação, histórico e o slide leem o
 *   MESMO objeto devolvido por `potCalcular`. Se um número difere entre duas telas, alguém calculou
 *   em dois lugares.
 * ⛔ Nenhuma tarifa nem alavanca de negócio mora aqui (o JS é público no GitHub Pages): faixas, IPCA,
 *   multiplicadores, tickets, deltas e % de reinvestimento vêm de `luma.potencial_*` (RLS: só a equipe).
 *   Aqui só há ARITMÉTICA — a da planilha "Aladim Calculadora DM 2026 COMERCIAL":
 *
 *   INVESTIMENTO (aba Calculadora C5/C6/C8 + "Calcular taxas aqui!")
 *     taxa      = taxa negociada da cidade, senão a da faixa de população
 *     marketing = CEILING(base da faixa · (1 + IPCA) · mult(concorrentes), 50)
 *     total     = taxa + marketing
 *
 *   CENÁRIOS (aba "Cenários" — a mesma conta do slide)
 *     usuários = população · %   (SEM arredondar na conta; só na exibição)
 *     GMV = usuários · ticket · fator do cenário · receita/mês = GMV · comissão · % do franqueado
 *     lucro anual = receita · 12 · (1 − Simples) · payback = ROUND(total ÷ (lucro ÷ 12)) · ROI = lucro ÷ total
 *
 *   PROJEÇÃO DE 24 MESES (aba Calculadora, linhas 26–50) — `potModelo24`
 *     marketing no mês m: 1–5 = lançamento ÷ 5 (franqueado) ·  6+ = % de reinvestimento · comissão do mês anterior
 *                         1–3 = + marketing da franqueadora (50% da taxa ÷ 3)
 *     GMV do investimento = marketing total · delta (mês 1–5: delta de lançamento · 6+: delta ongoing)
 *     GMV total(m) = GMV total(m−1) + GMV do investimento(m)      ← acumula: não há perda de base
 *     comissão = GMV · comissão % · NFe 5,65% · inadimplência · receita líquida(m) = comissão(m−1) − NFe(m−1) − inadimplência(m)
 *     repasse = receita líquida · % do franqueado · saldo = repasse − marketing do franqueado − taxa (parcelada)
 *
 *   REFERÊNCIA DA REDE (v2.1, 30/10/2026) — `potRedeEstatisticas`, `potCalibraModelo`
 *     A planilha não tem variância: o modelo é UMA curva. A Base Ops traz o GMV REAL das cidades que a DM já opera
 *     (luma.potencial_rede). Para cada cidade, as K operadas (fase Ongoing) de população mais parecida dão a
 *     distribuição de GMV por habitante (P10/P25/P50/P75/P90). Daí saem (1) em que percentil cai cada cenário e
 *     cada ponto do modelo e (2) a projeção CALIBRADA: as mesmas contas da planilha com o delta de marketing
 *     escalado até o GMV do mês 24 igualar população × GMV/hab do percentil escolhido.
 *     Achado que motivou isto (jun–set/2026, 69 cidades Ongoing): o "cenário real" do slide (20% × ticket) está acima
 *     de ~85% da rede; a mediana real é ~R$ 6,5/hab. Ver docs/POTENCIAL-CALIBRACAO.md.
 *
 *   ⚠ Fiel à planilha, inclusive onde ela parece errada — com o ajuste escondido num parâmetro:
 *     · inadimplência: a planilha só aplica no mês 2 (a referência da fórmula "anda" para células vazias).
 *       `inadimplencia_todos_meses` = true aplica todo mês.
 *     · 3+ concorrentes: a planilha devolvia FALSE; aqui vale o multiplicador do maior nível, com aviso.
 *
 * Depende de: nada (puro). Carregar antes de potencial.js e graficos.js.
 */

const POT_REGIAO_UF = {
  AC:'Norte', AP:'Norte', AM:'Norte', PA:'Norte', RO:'Norte', RR:'Norte', TO:'Norte',
  AL:'Nordeste', BA:'Nordeste', CE:'Nordeste', MA:'Nordeste', PB:'Nordeste', PE:'Nordeste', PI:'Nordeste', RN:'Nordeste', SE:'Nordeste',
  DF:'Centro-Oeste', GO:'Centro-Oeste', MT:'Centro-Oeste', MS:'Centro-Oeste',
  ES:'Sudeste', MG:'Sudeste', RJ:'Sudeste', SP:'Sudeste',
  PR:'Sul', RS:'Sul', SC:'Sul'
};
const POT_ROTULO = { ruim:'Cenário ruim', real:'Cenário real e esperado', top:'Cenário top' };
const POT_MESES = 24;

// Chaves de `luma.potencial_parametros` que o modelo de 24 meses exige. Faltou uma = o modelo não calcula
// (e a tela diz por quê), em vez de cair num número que alguém digitou no JS.
const POT_PARAM_MODELO = ['mkt_apos_mes5','delta_mkt','delta_ongoing','parcelas_taxa','nfe','inadimplencia','mkt_franqueadora_pct'];

/* ═══ Faixa, arredondamento ═══ */

// Última faixa cujo mínimo cabe na população — o MATCH(pop, mínimos, 1) da planilha.
function potFaixaPara(pop, faixas){
  let achada=null;
  (faixas||[]).forEach(f=>{ if(pop>=f.pop_min && (!achada || f.pop_min>=achada.pop_min)) achada=f; });
  return achada;
}

// CEILING(x, 50) do Excel, para valor positivo. O arredondamento a 1e-6 evita que 10750.000000001 vire 10800.
function potTeto50(x){ return Math.ceil(Math.round(x*1e6)/1e6/50)*50; }

/* ═══ Projeção de 24 meses ═══ */

/**
 * in = { pop, taxa, mkt, comissao, rebate, parcelas, mktApos5, deltaMkt, deltaOngoing, nfe, inadimplencia,
 *        inadTodos, mktFranqueadoraPct }
 * Devolve { meses:[{m, mktFranqueado, mktFranqueadora, mktTotal, gmvInvest, gmvOrganico, gmv, comissao, nfe,
 *   inadimplencia, receitaLiquida, repasse, taxa, saldo, acumulado}], resumo }.
 */
function potModelo24(x){
  const meses=[]; let acum=0, gmvAnt=0;
  for(let m=1;m<=POT_MESES;m++){
    const ant=meses[m-2]||null;
    const mktFranqueado = m<=5 ? x.mkt/5 : x.mktApos5*(ant?ant.comissao:0);
    const mktFranqueadora = m<=3 ? (x.mktFranqueadoraPct*x.taxa)/3 : 0;
    const mktTotal = mktFranqueado+mktFranqueadora;
    const gmvInvest = mktTotal*(m<=5 ? x.deltaMkt : x.deltaOngoing);
    const gmvOrganico = gmvAnt;                       // o GMV de ontem é a base de hoje (a planilha não tem perda)
    const gmv = gmvOrganico+gmvInvest;
    const comissao = gmv*x.comissao;
    const nfe = x.nfe*comissao;
    const inadimplencia = (m>=2 && (x.inadTodos || m===2)) ? x.inadimplencia*ant.comissao : 0;
    const receitaLiquida = m>=2 ? ant.comissao-ant.nfe-inadimplencia : 0;
    const repasse = receitaLiquida*x.rebate;
    const taxa = m<=x.parcelas ? x.taxaTotal/x.parcelas : 0;
    const saldo = repasse-mktFranqueado-taxa;
    acum+=saldo; gmvAnt=gmv;
    meses.push({ m, mktFranqueado, mktFranqueadora, mktTotal, gmvInvest, gmvOrganico, gmv, comissao, nfe, inadimplencia, receitaLiquida, repasse, taxa, saldo, acumulado:acum });
  }
  let pico=meses[0]; meses.forEach(r=>{ if(r.acumulado<pico.acumulado) pico=r; });
  // payback = primeiro mês em que o caixa acumulado volta a zero DEPOIS do fundo do poço (null = não volta em 24 meses).
  let paybackMes=null;
  for(let i=pico.m;i<meses.length;i++){ if(meses[i].acumulado>=0){ paybackMes=meses[i].m; break; } }
  const m12=meses[11], m24=meses[23];
  return { meses, resumo:{
    pico:pico.acumulado, mesPico:pico.m, paybackMes,
    gmv12:m12.gmv, gmv24:m24.gmv, gmvHab24:x.pop>0 ? m24.gmv/x.pop : null,
    resultado12:m12.acumulado, resultado24:m24.acumulado,
    repasse12:meses.slice(0,12).reduce((s,r)=>s+r.repasse,0), repasse24:meses.reduce((s,r)=>s+r.repasse,0)
  } };
}

/* ═══ O cálculo inteiro de uma cidade ═══ */

/**
 * c  = linha de luma.potencial_cidades
 * P  = { faixas:[…], param:{ chave: valor } }
 * ov = ajustes da tela (todos opcionais): { concorrentes, ticket, comissao, rebate, simples, parcelas, mktApos5 }
 * `avisos` diz o que a pessoa precisa saber antes de usar o número. `modelo` é null quando falta parâmetro.
 */
function potCalcular(c, P, ov){
  ov=ov||{};
  const pr=P.param||{};
  const avisos=[];
  const faixa=potFaixaPara(c.populacao, P.faixas);
  const regiao=POT_REGIAO_UF[c.uf]||null;
  const conc = ov.concorrentes!=null ? ov.concorrentes : (c.concorrentes!=null ? c.concorrentes : 0);
  const comissao = ov.comissao!=null ? ov.comissao : pr.comissao;
  const rebate   = ov.rebate!=null   ? ov.rebate   : pr.rebate_franqueado;
  const simples  = ov.simples!=null  ? ov.simples  : pr.simples;
  const parcelas = ov.parcelas!=null ? ov.parcelas : pr.parcelas_taxa;
  const mktApos5 = ov.mktApos5!=null ? ov.mktApos5 : pr.mkt_apos_mes5;

  // Ticket: o da tela > o médio da calculadora (aba Calculadora C13, fonte Getnet/Ticket 2025 + IPCA) > o da região.
  const ticketRegiao=(pr.ticket_regional||{})[regiao];
  const ticketReal = ov.ticket!=null ? ov.ticket : (pr.ticket_medio!=null ? pr.ticket_medio : ticketRegiao);
  const ticketOpcoes = { calculadora:pr.ticket_medio, apresentacao:pr.ticket_apresentacao, regiao:ticketRegiao };

  // Taxa: a negociada da cidade vence a da faixa (VLOOKUP na coluna "Taxa de franquia" da base).
  const taxa = c.taxa_franquia_override!=null ? Number(c.taxa_franquia_override) : (faixa ? Number(faixa.taxa_franquia) : null);

  // Marketing de lançamento. A planilha só tem multiplicador para 0, 1 e 2 concorrentes; com 3+ a fórmula
  // devolvia FALSE, que somava como zero (investimento subestimado, e sem aviso). 429 cidades da base
  // têm 3+ — 45 delas a DM já opera (ex.: Tupã) — e travar o slide era o pior dos dois mundos. Decisão
  // (29/10): vale o multiplicador do MAIOR nível que a planilha conhece, com aviso à vista.
  const tabela=pr.mult_concorrencia||{};
  const niveis=Object.keys(tabela).map(Number).filter(n=>!isNaN(n)).sort((a,b)=>a-b);
  const teto=niveis.length ? niveis[niveis.length-1] : null;
  let mult=tabela[String(conc)];
  if(mult==null && teto!=null && conc>teto){
    mult=tabela[String(teto)];
    avisos.push('A planilha só tem regra de marketing até '+teto+' concorrentes. Com '+conc+', usei a de '+teto+' (×'+String(mult).replace('.',',')+'). Confirme com o comercial.');
  }
  let mkt=null;
  if(faixa && mult!=null) mkt=potTeto50(Number(faixa.mkt_base)*(1+Number(pr.ipca))*Number(mult));
  if(c.operacao_fase) avisos.push('A Delivery Much já tem operação aqui ('+c.operacao_fase+').');
  if(c.vender===false) avisos.push('Na base, esta cidade está marcada como "não vender".');
  if(!faixa) avisos.push('Nenhuma faixa de população cobre esta cidade.');
  if(ticketReal==null) avisos.push('Sem ticket médio para esta cidade — informe o ticket.');

  const inv = (taxa!=null && mkt!=null) ? taxa+mkt : null;

  const cenarios=(pr.cenarios||[]).map(cn=>{
    const fator=(pr.fator_ticket||{})[cn.id]; const ticket = ticketReal!=null && fator!=null ? ticketReal*fator : null;
    const usuarios=c.populacao*cn.pct;                 // a aba "Cenários" não arredonda; a tela arredonda ao mostrar
    const gmv = ticket!=null ? usuarios*ticket : null;
    const receita = gmv!=null ? gmv*comissao*rebate : null;
    const lucro = receita!=null ? receita*12*(1-simples) : null;
    const ok = lucro!=null && inv!=null && inv>0;
    return { id:cn.id, pct:cn.pct, usuarios, ticket, gmv, receita, lucro,
      payback: ok && lucro>0 ? inv/(lucro/12) : null,
      roi: ok ? lucro/inv : null };
  });

  // Modelo de 24 meses: só com TODOS os parâmetros vindos do banco.
  let modelo=null, entradaModelo=null; const faltam=POT_PARAM_MODELO.filter(k=>pr[k]==null);
  if(!faltam.length && taxa!=null && mkt!=null && comissao!=null && rebate!=null){
    entradaModelo={ pop:c.populacao, taxaTotal:taxa, taxa, mkt, comissao, rebate, parcelas, mktApos5,
      deltaMkt:pr.delta_mkt, deltaOngoing:pr.delta_ongoing, nfe:pr.nfe, inadimplencia:pr.inadimplencia,
      inadTodos:pr.inadimplencia_todos_meses===true, mktFranqueadoraPct:pr.mkt_franqueadora_pct };
    modelo=potModelo24(entradaModelo);
  }
  const calc={ cidade:c, faixa, regiao, conc, taxa, mkt, inv, ticketReal, ticketOpcoes, comissao, rebate, simples, parcelas, mktApos5,
    cenarios, modelo, entradaModelo, parametrosFaltando:faltam, avisos, ipca:pr.ipca, referencia:null, calibrados:null };

  // Referência da rede: só com os dados reais carregados (P.rede) e cidades parecidas suficientes.
  const ref=potRedeEstatisticas(c, P.rede);
  if(ref){
    calc.referencia=ref;
    cenarios.forEach(sc=>{ if(sc.gmv!=null) sc.percentil=potPosicaoNaRede(ref, sc.gmv/c.populacao); });
    if(modelo){
      const hab=g=>g/c.populacao;
      calc.modeloPercentil={ m12:potPosicaoNaRede(ref,hab(modelo.meses[11].gmv)), m24:potPosicaoNaRede(ref,hab(modelo.meses[23].gmv)) };
    }
    // % da população que, a 1 pedido/mês × ticket (a conta do slide), entregaria o GMV/hab de cada percentil.
    if(ticketReal>0) calc.equivalente={ p25:ref.hab.p25/ticketReal, p50:ref.hab.p50/ticketReal, p75:ref.hab.p75/ticketReal };
    if(entradaModelo) calc.calibrados={
      p25:potCalibraModelo(entradaModelo, ref.hab.p25*c.populacao),
      p50:potCalibraModelo(entradaModelo, ref.hab.p50*c.populacao),
      p75:potCalibraModelo(entradaModelo, ref.hab.p75*c.populacao) };
  }
  return calc;
}

/* ═══ Referência da rede: cidades reais parecidas, percentis e projeção calibrada ═══ */

const POT_REDE_K = 15;          // quantas cidades operadas, as mais parecidas em população, formam a referência
const POT_REDE_MIN = 6;         // menos que isso não é amostra: a tela não mostra percentil

// Percentil p (0–1) de uma lista, com interpolação linear.
function potPercentil(lista, p){
  const v=lista.slice().sort((a,b)=>a-b); if(!v.length) return null;
  const i=(v.length-1)*p, lo=Math.floor(i), hi=Math.ceil(i);
  return v[lo]+(v[hi]-v[lo])*(i-lo);
}

/**
 * rede = linhas de luma.potencial_rede ({chave, nome, uf, populacao, fase, curva, gmv_set, …}).
 * Só entram cidades Ongoing com GMV: Implementação ainda está subindo e Operação Própria é outra conta.
 * A própria cidade fica de fora da amostra (e volta em `propria`, para comparar com o que ela entrega hoje).
 */
function potRedeEstatisticas(c, rede){
  if(!rede || !rede.length || !(c.populacao>0)) return null;
  const propria=rede.find(r=>r.chave===c.chave)||null;
  const sim=rede.filter(r=>r.fase==='Operação Ongoing' && r.gmv_set>0 && r.populacao>0 && r.chave!==c.chave)
    .map(r=>({r, d:Math.abs(Math.log(r.populacao/c.populacao))})).sort((a,b)=>a.d-b.d).slice(0,POT_REDE_K).map(x=>x.r);
  if(sim.length<POT_REDE_MIN) return null;
  const habs=sim.map(r=>r.gmv_set/r.populacao), P=p=>potPercentil(habs,p);
  const hab={ p10:P(.1), p25:P(.25), p50:P(.5), p75:P(.75), p90:P(.9) };
  const gmv={}; Object.keys(hab).forEach(k=>{ gmv[k]=hab[k]*c.populacao; });
  return { similares:sim, habs, hab, gmv, n:sim.length, propria };
}

// Em que percentil da referência cai um GMV/hab: a fração das cidades parecidas que entrega MENOS que isso (0–100).
function potPosicaoNaRede(ref, gmvHab){
  if(!ref || gmvHab==null || isNaN(gmvHab)) return null;
  return Math.round(100*ref.habs.filter(h=>h<=gmvHab).length/ref.habs.length);
}

/**
 * Projeção calibrada: as MESMAS contas da planilha (`potModelo24`) com os dois deltas de marketing multiplicados
 * por um fator `escala`, achado por bisseção até o GMV do mês 24 igualar `alvoGmv24`. A conta não é linear (o
 * reinvestimento depende da comissão), por isso a busca numérica. `null` = não dá para igualar (alvo ≤ 0).
 */
function potCalibraModelo(x, alvoGmv24){
  if(!(alvoGmv24>0)) return null;
  const roda=s=>potModelo24(Object.assign({},x,{ deltaMkt:x.deltaMkt*s, deltaOngoing:x.deltaOngoing*s }));
  let lo=0, hi=1; while(roda(hi).meses[23].gmv<alvoGmv24 && hi<64) hi*=2;
  for(let i=0;i<48;i++){ const mid=(lo+hi)/2; if(roda(mid).meses[23].gmv<alvoGmv24) lo=mid; else hi=mid; }
  const escala=(lo+hi)/2, modelo=roda(escala);
  return { escala, modelo, deltaMkt:x.deltaMkt*escala, deltaOngoing:x.deltaOngoing*escala };
}

// Linha achatada para a tabela de comparação e o histórico: o que importa de cada cidade em uma passada.
function potResumo(calc){
  const real=calc.cenarios.find(s=>s.id==='real')||calc.cenarios[0]||{};
  const m=calc.modelo&&calc.modelo.resumo||{};
  return { inv:calc.inv, taxa:calc.taxa, mkt:calc.mkt, gmvReal:real.gmv, receitaReal:real.receita, lucroReal:real.lucro,
    paybackReal:real.payback, roiReal:real.roi, pico:m.pico, paybackMes:m.paybackMes, resultado24:m.resultado24, gmv24:m.gmv24 };
}

/* ═══ Formatação (pt-BR) ═══ */
function potNumero(n){ return n==null||isNaN(n) ? '—' : Math.round(n).toLocaleString('pt-BR'); }
function potBRL(n){ return n==null||isNaN(n) ? '—' : (n<0?'−':'')+'R$ '+Math.abs(Math.round(n)).toLocaleString('pt-BR'); }
function potBRL2(n){ return n==null||isNaN(n) ? '—' : 'R$ '+Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
// Compacto para eixos e cartões estreitos: R$ 1,2 mi · R$ 85 mil · R$ 900
function potBRLc(n){
  if(n==null||isNaN(n)) return '—';
  const a=Math.abs(n), s=n<0?'−':'';
  if(a>=1e6) return s+'R$ '+(a/1e6).toLocaleString('pt-BR',{maximumFractionDigits:a>=1e7?0:1})+' mi';
  if(a>=1e3) return s+'R$ '+(a/1e3).toLocaleString('pt-BR',{maximumFractionDigits:a>=1e5?0:1})+' mil';
  return s+'R$ '+Math.round(a).toLocaleString('pt-BR');
}
function potPct(f,casas){ return f==null||isNaN(f) ? '—' : (f*100).toLocaleString('pt-BR',{maximumFractionDigits:casas==null?0:casas})+'%'; }
function potMeses(n){ if(n==null||isNaN(n)) return '—'; const m=Math.round(n); return m+(m===1?' mês':' meses'); }
function potLerNumero(s){ const n=parseFloat(String(s).trim().replace(/\./g,'').replace(',','.')); return isNaN(n)?null:n; }

/* ═══ Slide: tudo que o deck-modelo espera em {{chave}} (valores já formatados; o Apps Script só troca texto) ═══ */
function potCamposSlide(calc){
  const c=calc.cidade;
  const campos={
    cidade:c.nome, cidade_uf:c.nome+' - '+c.uf, populacao:potNumero(c.populacao), pib_per_capita:potBRL(c.pib_per_capita),
    taxa_franquia:potBRL(calc.taxa), mkt_lancamento:potBRL(calc.mkt), inv_total:potBRL(calc.inv),
    premissas:'Premissas: ticket médio '+potBRL2(calc.ticketReal)+' (cenário real) · comissão '+potPct(calc.comissao,1)
      +' · '+potPct(calc.rebate,0)+' ao franqueado · Simples Nacional '+potPct(calc.simples,1)
  };
  calc.cenarios.forEach(s=>{
    campos[s.id+'_pct']=potPct(s.pct,0)+' da população';
    campos[s.id+'_usuarios']=potNumero(s.usuarios);
    campos[s.id+'_gmv']=potBRL(s.gmv);
    campos[s.id+'_receita']=potBRL(s.receita);
    campos[s.id+'_lucro']=potBRL(s.lucro);
    campos[s.id+'_payback']=potMeses(s.payback);
    campos[s.id+'_roi']=potPct(s.roi,0);
  });
  return campos;
}
