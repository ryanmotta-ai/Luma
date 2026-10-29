/**
 * js/potencial/potencial.js
 *
 * POTENCIAL DA CIDADE (29/10/2026) — a "Calculadora de Franquias 2026" do Aladim dentro do Luma.
 * ---------------------------------------------------------------------------
 * A equipe comercial escolhe a cidade, vê os 3 cenários (ruim / real / top) com os mesmos números
 * da planilha e clica em "Gerar slide": o Apps Script (scripts/apps-script/potencial-slides.gs)
 * copia o deck-modelo e troca os {{placeholders}}; o Luma abre o Google Slides pronto.
 *
 * ⛔ UM motor de cálculo: `potCalcular`. Tela, painel e slide leem o MESMO objeto — se um
 *   número muda na tela e não no slide, é porque alguém calculou em dois lugares.
 * ⛔ A tarifa (faixas, IPCA, multiplicadores, tickets) NÃO mora aqui: vem das tabelas
 *   `luma.potencial_*` (RLS: só a equipe). O JS é público no GitHub Pages; o que for sensível
 *   fica no banco. Aqui só mora a ARITMÉTICA, que é a mesma da planilha:
 *     investimento  = taxa da faixa (ou a negociada da cidade) + CEILING(base·(1+IPCA)·mult(conc), 50)
 *     usuários      = ROUND(população · % do cenário)
 *     GMV           = usuários · ticket do cenário
 *     receita/mês   = GMV · comissão · % do franqueado
 *     lucro anual   = receita/mês · 12 · (1 − Simples)
 *     payback       = investimento ÷ (lucro anual ÷ 12)      · ROI = lucro anual ÷ investimento
 *   O lucro líquido e o payback não estão escritos na planilha: foram reconstruídos dos números
 *   do slide do Aruanã (R$ 5.175 · 58 meses · 21% bate com esta fórmula) — se o comercial usar
 *   outra regra, é só `potCalcular` que muda.
 *
 * Depende de: core/supabase.js (window.sb), core/toast.js (gToast/gEsc/gNormBusca),
 *   core/auth.js (gIsAdmin). Chamado de main.js (`potEntrar`).
 */

let _pot = { faixas:null, param:null, carregando:false, erro:'', cidade:null, ov:{}, calc:null, resultados:[], seq:0, timer:0, gerando:false, ultimoSlide:'' };

const POT_REGIAO_UF = {
  AC:'Norte', AP:'Norte', AM:'Norte', PA:'Norte', RO:'Norte', RR:'Norte', TO:'Norte',
  AL:'Nordeste', BA:'Nordeste', CE:'Nordeste', MA:'Nordeste', PB:'Nordeste', PE:'Nordeste', PI:'Nordeste', RN:'Nordeste', SE:'Nordeste',
  DF:'Centro-Oeste', GO:'Centro-Oeste', MT:'Centro-Oeste', MS:'Centro-Oeste',
  ES:'Sudeste', MG:'Sudeste', RJ:'Sudeste', SP:'Sudeste',
  PR:'Sul', RS:'Sul', SC:'Sul'
};
const POT_ROTULO = { ruim:'Cenário ruim', real:'Cenário real e esperado', top:'Cenário top' };

/* ═══ MOTOR DE CÁLCULO (puro: sem DOM, sem rede) ═══ */

// Última faixa cujo mínimo cabe na população — o MATCH(pop, mínimos, 1) da planilha.
function potFaixaPara(pop, faixas){
  let achada=null;
  (faixas||[]).forEach(f=>{ if(pop>=f.pop_min && (!achada || f.pop_min>=achada.pop_min)) achada=f; });
  return achada;
}

// CEILING(x, 50) do Excel, para valor positivo. O arredondamento a 1e-6 evita que 10750.000000001 vire 10800.
function potTeto50(x){ return Math.ceil(Math.round(x*1e6)/1e6/50)*50; }

/**
 * c  = linha de luma.potencial_cidades
 * P  = { faixas:[…], param:{ chave: valor } }
 * ov = ajustes da tela: { concorrentes, ticket, comissao, rebate, simples } (todos opcionais)
 * Devolve tudo que a tela e o slide mostram; `avisos` diz o que a pessoa precisa saber antes de usar o número.
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
  const ticketReal = ov.ticket!=null ? ov.ticket : ((pr.ticket_regional||{})[regiao]);

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
  if(ticketReal==null) avisos.push('Sem ticket médio para a região desta cidade — informe o ticket.');

  const inv = (taxa!=null && mkt!=null) ? taxa+mkt : null;

  const cenarios=(pr.cenarios||[]).map(cn=>{
    const fator=(pr.fator_ticket||{})[cn.id]; const ticket = ticketReal!=null && fator!=null ? ticketReal*fator : null;
    const usuarios=Math.round(c.populacao*cn.pct);
    const gmv = ticket!=null ? usuarios*ticket : null;
    const receita = gmv!=null ? gmv*comissao*rebate : null;
    const lucro = receita!=null ? receita*12*(1-simples) : null;
    const ok = lucro!=null && inv!=null && inv>0;
    return { id:cn.id, pct:cn.pct, usuarios, ticket, gmv, receita, lucro,
      payback: ok && lucro>0 ? inv/(lucro/12) : null,
      roi: ok ? lucro/inv : null };
  });
  return { cidade:c, faixa, regiao, conc, taxa, mkt, inv, ticketReal, comissao, rebate, simples, cenarios, avisos, ipca:pr.ipca };
}

/* ═══ FORMATAÇÃO (pt-BR) ═══ */
function potNumero(n){ return n==null||isNaN(n) ? '—' : Math.round(n).toLocaleString('pt-BR'); }
function potBRL(n){ return n==null||isNaN(n) ? '—' : 'R$ '+Math.round(n).toLocaleString('pt-BR'); }
function potBRL2(n){ return n==null||isNaN(n) ? '—' : 'R$ '+Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function potPct(f,casas){ return f==null||isNaN(f) ? '—' : (f*100).toLocaleString('pt-BR',{maximumFractionDigits:casas==null?0:casas})+'%'; }
function potMeses(n){ if(n==null||isNaN(n)) return '—'; const m=Math.round(n); return m+(m===1?' mês':' meses'); }
function potLerNumero(s){ const n=parseFloat(String(s).trim().replace(/\./g,'').replace(',','.')); return isNaN(n)?null:n; }

/* ═══ DADOS (Supabase, RLS: só a equipe) ═══ */
function _potSb(){ return (typeof gSupabase==='function' && gSupabase()) ? gSupabase().schema('luma') : null; }

async function potCarregar(){
  if(_pot.faixas && _pot.param) return true;
  const sb=_potSb();
  if(!sb){ _pot.erro='Sem conexão com o banco. O Potencial precisa do Supabase.'; return false; }
  if(_pot.carregando) return false;
  _pot.carregando=true; _pot.erro='';
  try{
    const [f,p]=await Promise.all([
      sb.from('potencial_faixas').select('*').order('pop_min'),
      sb.from('potencial_parametros').select('chave,valor')
    ]);
    if(f.error) throw f.error; if(p.error) throw p.error;
    if(!f.data.length || !p.data.length) throw new Error('vazio');
    _pot.faixas=f.data;
    _pot.param={}; p.data.forEach(r=>{ _pot.param[r.chave]=r.valor; });
    return true;
  }catch(e){
    _pot.erro='Não consegui carregar as tarifas. Confira se as migrations do Potencial foram aplicadas no Supabase.';
    return false;
  }finally{ _pot.carregando=false; }
}

async function potBuscarCidades(termo){
  const sb=_potSb(); if(!sb) return [];
  const t=gNormBusca(termo).replace(/[%_,()\/\-–]/g,' ').replace(/\s+/g,' ').trim();
  if(t.length<2) return [];
  const { data, error } = await sb.from('potencial_cidades').select('*').ilike('busca','%'+t+'%').order('populacao',{ascending:false}).limit(12);
  if(error) throw error;
  return data||[];
}

/* ═══ SLIDE ═══ */
// Tudo que o deck-modelo espera em {{chave}}. Os valores já vão formatados: o Apps Script só troca texto.
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

async function potGerarSlide(){
  const calc=_pot.calc; if(!calc || _pot.gerando) return;
  const url=_pot.param && _pot.param.slides_webapp_url;
  if(!url){ gToast('O gerador de slide ainda não foi configurado. Fale com a gestão.'); return; }
  if(calc.inv==null){ gToast('Sem o investimento total não dá para gerar o slide. Ajuste os concorrentes.'); return; }
  const btn=document.getElementById('pot-gerar'); const solta=gBtnLoading(btn,'Gerando…');
  // A aba abre AGORA, no clique: depois do await o navegador trata window.open como popup e bloqueia.
  const aba=window.open('','_blank');
  _pot.gerando=true;
  try{
    const sess=await gSupabase().auth.getSession();
    const token=sess && sess.data && sess.data.session && sess.data.session.access_token;
    if(!token) throw new Error('Sessão expirada. Entre de novo no Luma.');
    // text/plain evita o preflight de CORS (o Apps Script não responde OPTIONS).
    const r=await fetch(url,{ method:'POST', redirect:'follow', headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({ token, cidade:calc.cidade.chave, campos:potCamposSlide(calc) }) });
    const j=await r.json();
    if(!j || !j.ok || !j.url) throw new Error((j && j.erro) || 'O gerador não respondeu.');
    if(!/^https:\/\/docs\.google\.com\//.test(j.url)) throw new Error('O gerador devolveu um endereço inesperado.');
    _pot.ultimoSlide=j.url;
    if(aba) aba.location.href=j.url;
    gToast('Slide pronto. Abrindo no Google Slides.');
    potRenderSlideLink();
  }catch(e){
    if(aba) aba.close();
    gToast(String((e && e.message) || 'Não consegui gerar o slide. Tente de novo.'));
  }finally{ _pot.gerando=false; solta(); }
}

/* ═══ TELA ═══ */
function _potEl(id){ return document.getElementById(id); }

async function potEntrar(){
  const raiz=_potEl('pot-corpo'); if(!raiz) return;
  if(!_pot.faixas){
    raiz.innerHTML='<p class="pot-vazio">Carregando as tarifas…</p>';
    const ok=await potCarregar();
    if(!ok){ raiz.innerHTML='<p class="pot-vazio pot-erro">'+gEsc(_pot.erro||'Não consegui carregar.')+'</p>'; return; }
  }
  if(_pot.cidade) potRender(); else raiz.innerHTML='<p class="pot-vazio">Busque uma cidade para ver o potencial.</p>';
  const q=_potEl('pot-q'); if(q) q.focus();
}

function potBuscaDigita(el){
  clearTimeout(_pot.timer);
  const termo=el.value; const meu=++_pot.seq;
  _pot.timer=setTimeout(async()=>{
    try{
      const lista=await potBuscarCidades(termo);
      if(meu!==_pot.seq) return;   // chegou resposta velha: a pessoa já digitou mais
      _pot.resultados=lista; potRenderLista(termo);
    }catch(e){ gToast('Não consegui buscar as cidades.'); }
  },220);
}

function potRenderLista(termo){
  const ul=_potEl('pot-lista'); if(!ul) return;
  const q=_potEl('pot-q');
  if(!_pot.resultados.length){
    ul.innerHTML = gNormBusca(termo).trim().length>=2 ? '<li class="pot-li-vazio">Nenhuma cidade com esse nome.</li>' : '';
    ul.hidden = !ul.innerHTML; if(q) q.setAttribute('aria-expanded', String(!ul.hidden)); return;
  }
  ul.innerHTML=_pot.resultados.map((c,i)=>'<li role="option" tabindex="-1"><button type="button" onclick="potEscolher('+i+')">'
    +'<span class="pot-li-nome">'+gEsc(c.nome)+' <em>'+gEsc(c.uf)+'</em></span>'
    +'<span class="pot-li-pop">'+potNumero(c.populacao)+' hab.</span></button></li>').join('');
  ul.hidden=false; if(q) q.setAttribute('aria-expanded','true');
}

function potEscolher(i){
  const c=_pot.resultados[i]; if(!c) return;
  _pot.cidade=c; _pot.ov={}; _pot.ultimoSlide='';
  const ul=_potEl('pot-lista'); if(ul){ ul.hidden=true; ul.innerHTML=''; }
  const q=_potEl('pot-q'); if(q){ q.value=c.nome+' - '+c.uf; q.setAttribute('aria-expanded','false'); }
  potRender();
}

// Um campo editável da tela vira ajuste: vazio = volta ao valor da base.
function potAjusta(campo, el, ehPercentual){
  const n=potLerNumero(el.value);
  if(n==null) delete _pot.ov[campo]; else _pot.ov[campo]= ehPercentual ? n/100 : n;
  potRecalcula();
}
function potRestaurar(){ _pot.ov={}; potRender(); }

function potRender(){
  const raiz=_potEl('pot-corpo'); if(!raiz || !_pot.cidade) return;
  const c=_pot.cidade;
  const calc=potCalcular(c,_pot,_pot.ov); const pr=_pot.param;
  const campo=(rot,id,val,suf,dica)=>'<label class="pot-campo"><span>'+rot+'</span><span class="pot-in"><input id="pot-ov-'+id+'" inputmode="decimal" value="'+gEsc(val)+'" '
    +'oninput="potAjusta(\''+id+'\',this,'+(suf==='%')+')" aria-describedby="pot-d-'+id+'">'+(suf?'<i>'+suf+'</i>':'')+'</span><small id="pot-d-'+id+'">'+gEsc(dica)+'</small></label>';
  const pc=v=>v==null?'':String(+(v*100).toFixed(2)).replace('.',',');
  raiz.innerHTML=
    '<section class="pot-cidade" aria-label="Cidade">'
    +  '<div class="pot-cid-id"><h2>'+gEsc(c.nome)+' - '+gEsc(c.uf)+'</h2><p>'+gEsc(calc.regiao||'')+(calc.faixa?' · faixa de '+potNumero(calc.faixa.pop_min)+' a '+(calc.faixa.pop_max?potNumero(calc.faixa.pop_max):'mais')+' hab.':'')+'</p></div>'
    +  '<dl class="pot-fatos">'
    +    '<div><dt>População</dt><dd>'+potNumero(c.populacao)+'</dd></div>'
    +    '<div><dt>PIB per capita</dt><dd>'+potBRL(c.pib_per_capita)+'</dd></div>'
    +    '<div><dt>Taxa de franquia</dt><dd>'+potBRL(calc.taxa)+'</dd></div>'
    +    '<div><dt>Marketing de lançamento</dt><dd>'+potBRL(calc.mkt)+'</dd></div>'
    +    '<div class="pot-total"><dt>Investimento total</dt><dd id="pot-inv">'+potBRL(calc.inv)+'</dd></div>'
    +  '</dl>'
    +'</section>'
    +'<div id="pot-avisos"></div>'
    +'<section class="pot-premissas" aria-label="Premissas">'
    +  '<header><h3>Premissas</h3><button type="button" class="pot-link" onclick="potRestaurar()">Voltar aos valores da base</button></header>'
    +  '<div class="pot-campos">'
    +    campo('Concorrentes','concorrentes',String(calc.conc),'', 'Base: '+(c.concorrentes!=null?c.concorrentes:'sem dado')+'. Muda o marketing.')
    +    campo('Ticket médio (cenário real)','ticket',calc.ticketReal!=null?String(calc.ticketReal).replace('.',','):'','R$','Base: média da região.')
    +    campo('Comissão','comissao',pc(calc.comissao),'%','Sobre o GMV.')
    +    campo('Parte do franqueado','rebate',pc(calc.rebate),'%','Da comissão.')
    +    campo('Simples Nacional','simples',pc(calc.simples),'%','Sobre a receita do franqueado.')
    +  '</div>'
    +'</section>'
    +'<div id="pot-res"></div>'
    +'<div id="pot-slide-link"></div>';
  potRecalcula();
}

// Re-renderiza SÓ o resultado: reconstruir os inputs a cada tecla tira o foco de quem digita.
function potRecalcula(){
  if(!_pot.cidade) return;
  const calc=potCalcular(_pot.cidade,_pot,_pot.ov); _pot.calc=calc;
  const inv=_potEl('pot-inv'); if(inv) inv.textContent=potBRL(calc.inv);
  const av=_potEl('pot-avisos');
  if(av) av.innerHTML=calc.avisos.map(a=>'<p class="pot-aviso" role="status">'+gEsc(a)+'</p>').join('');
  const res=_potEl('pot-res');
  if(res) res.innerHTML='<div class="pot-cenarios">'+calc.cenarios.map(s=>{
    const linha=(rot,val,forte)=>'<div class="pot-lin'+(forte?' forte':'')+'"><span>'+rot+'</span><strong>'+val+'</strong></div>';
    return '<article class="pot-cen pot-'+gEsc(s.id)+'"><header><h3>'+gEsc(POT_ROTULO[s.id]||s.id)+'</h3></header>'
      +'<p class="pot-cen-pct">'+potPct(s.pct,0)+' da população</p>'
      +linha('Usuários ativos',potNumero(s.usuarios))+linha('GMV mensal',potBRL(s.gmv),true)+linha('Receita franqueado/mês',potBRL(s.receita),true)
      +linha('Lucro líquido anual',potBRL(s.lucro))+linha('Payback',potMeses(s.payback),true)+linha('ROI anual',potPct(s.roi,0))+'</article>';
  }).join('')+'</div>';
  const b=_potEl('pot-gerar'); if(b) b.disabled = !(calc.inv!=null && calc.cenarios.every(s=>s.gmv!=null));
  potRenderSlideLink();
}

function potRenderSlideLink(){
  const el=_potEl('pot-slide-link'); if(!el) return;
  el.innerHTML = _pot.ultimoSlide ? '<p class="pot-pronto">Slide gerado. <a href="'+gEsc(_pot.ultimoSlide)+'" target="_blank" rel="noopener">Abrir no Google Slides</a></p>' : '';
}
