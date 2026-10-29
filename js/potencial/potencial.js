/**
 * js/potencial/potencial.js
 *
 * POTENCIAL DA CIDADE — a tela (v2, 30/10/2026). A "Calculadora de Franquias 2026" do Aladim dentro do Luma.
 * ---------------------------------------------------------------------------
 * A equipe comercial escolhe a cidade, vê investimento, os 3 cenários e a projeção de 24 meses com os
 * mesmos números da planilha e clica em "Gerar slide": o Apps Script (scripts/apps-script/potencial-slides.gs)
 * copia o deck-modelo e troca os {{placeholders}}; o Luma abre o Google Slides pronto e guarda a proposta.
 *
 * Arquivos do módulo (um por assunto, todos com prefixo `pot*`):
 *   motor.js      a conta (pura) — UM motor: `potCalcular`
 *   graficos.js   SVG da projeção de 24 meses
 *   potencial.js  ESTE: estado, casca (abas), busca, Calcular, gerar slide
 *   comparar.js   até 4 cidades lado a lado + slides em lote
 *   historico.js  propostas já geradas (luma.potencial_propostas)
 *   tarifas.js    a gestão edita parâmetros, faixas e cadastra cidade (RLS: só `gestao`)
 *
 * ⛔ A tarifa (faixas, IPCA, multiplicadores, tickets, deltas) NÃO mora no JS: vem de `luma.potencial_*`
 *   (RLS). O JS é público no GitHub Pages; o que for sensível fica no banco.
 * ⛔ Dado de banco só entra em innerHTML por gEsc. Feedback ao usuário só por gToast.
 *
 * Depende de: motor.js, graficos.js, core/supabase.js (window.sb), core/toast.js (gToast/gEsc/gNormBusca/gBtnLoading),
 *   core/auth.js (gIsAdmin/gAreaRestrita/gIsSuperAdmin). Chamado de main.js (`potEntrar`).
 */

let _pot = {
  faixas:null, param:null, carregando:false, erro:'',
  aba:'calcular', montado:false,
  cidade:null, ov:{}, calc:null,
  resultados:[], truncou:false, seq:0, timer:0, sel:-1,
  gerando:false, ultimoSlide:'', abaBloqueada:false,
  comparar:[], historico:null, rede:null, prev:{}, raf:0
};

const POT_LIMITE_BUSCA = 60;
const POT_RECENTES_KEY = 'luma_pot_recentes';
const POT_ICO = {
  lupa:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  slide:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
  mais:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  menos:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
  alerta:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/></svg>',
  info:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
  check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>',
  x:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'
};

/* ═══ Dados (Supabase, RLS: só quem usa o Potencial) ═══ */
function _potSb(){ return (typeof gSupabase==='function' && gSupabase()) ? gSupabase().schema('luma') : null; }
function _potEl(id){ return document.getElementById(id); }
function _potTry(fn, def){ try{ return fn(); }catch(e){ return def; } }

async function potCarregar(forcar){
  if(!forcar && _pot.faixas && _pot.param) return true;
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
  // Primeiro quem COMEÇA pelo termo, depois quem só o contém (duas consultas, para uma cidade pequena que
  // começa pelo termo não perder o lugar para uma grande que só o contém), até POT_LIMITE_BUSCA; dentro de
  // cada grupo, a mais populosa primeiro. A lista avisa quando há mais.
  const consulta=padrao=>sb.from('potencial_cidades').select('*').ilike('busca',padrao).order('populacao',{ascending:false}).limit(POT_LIMITE_BUSCA);
  const [ini, cont] = await Promise.all([consulta(t+'%'), consulta('%'+t+'%')]);
  if(ini.error) throw ini.error; if(cont.error) throw cont.error;
  const vistos=new Set((ini.data||[]).map(c=>c.chave));
  const todas=(ini.data||[]).concat((cont.data||[]).filter(c=>!vistos.has(c.chave)));
  _pot.truncou = (ini.data||[]).length>=POT_LIMITE_BUSCA || (cont.data||[]).length>=POT_LIMITE_BUSCA || todas.length>POT_LIMITE_BUSCA;
  return todas.slice(0,POT_LIMITE_BUSCA);
}

async function potCidadePorChave(chave){
  const sb=_potSb(); if(!sb) return null;
  const { data } = await sb.from('potencial_cidades').select('*').eq('chave',chave).maybeSingle();
  return data||null;
}

// As cidades onde a DM já opera: atalhos da tela vazia (uma consulta, guardada).
async function potCidadesDaRede(){
  if(_pot.rede) return _pot.rede;
  const sb=_potSb(); if(!sb) return [];
  const { data } = await sb.from('potencial_cidades').select('chave,nome,uf,populacao').not('operacao_fase','is',null).order('populacao',{ascending:false}).limit(14);
  _pot.rede=data||[]; return _pot.rede;
}

/* Recentes: só no aparelho (conforto, não dado). */
function potRecentes(){ return _potTry(()=>JSON.parse(localStorage.getItem(POT_RECENTES_KEY)||'[]'),[]).filter(r=>r&&r.chave); }
function potLembra(c){
  _potTry(()=>{
    const lista=potRecentes().filter(r=>r.chave!==c.chave); lista.unshift({chave:c.chave,nome:c.nome,uf:c.uf});
    localStorage.setItem(POT_RECENTES_KEY,JSON.stringify(lista.slice(0,6)));
  });
}

/* ═══ Casca: barra, abas, vistas ═══ */
async function potEntrar(){
  const raiz=_potEl('view-potencial'); if(!raiz) return;
  if(!_pot.montado) potMontar(raiz);
  if(!_pot.faixas){
    _potEl('pot-palco').innerHTML='<div class="pot-esqueleto" aria-busy="true"><i></i><i></i><i></i></div>';
    const ok=await potCarregar();
    if(!ok){ _potEl('pot-palco').innerHTML='<p class="pot-vazio pot-erro" role="alert">'+gEsc(_pot.erro||'Não consegui carregar.')+'</p>'; return; }
  }
  potAba(_pot.aba);
  if(!_pot.cidade){
    const ultima=potRecentes()[0];
    if(ultima){ const c=await potCidadePorChave(ultima.chave); if(c) { potEscolherCidade(c,true); return; } }
    potRenderVazio();
  }
}

function potMontar(raiz){
  const eGestao=typeof gIsSuperAdmin==='function' && gIsSuperAdmin();
  raiz.innerHTML=
    '<header class="pot-barra">'
    +  '<div class="pot-marca"><span class="pot-marca-ico">'+POT_ICO.slide+'</span><h1>Potencial</h1></div>'
    +  '<nav class="pot-abas" role="tablist" aria-label="Áreas do Potencial">'
    +    '<button type="button" role="tab" id="pot-t-calcular" aria-controls="pot-v-calcular" onclick="potAba(\'calcular\')">Calcular</button>'
    +    '<button type="button" role="tab" id="pot-t-comparar" aria-controls="pot-v-comparar" onclick="potAba(\'comparar\')">Comparar <em id="pot-n-comparar" hidden></em></button>'
    +    '<button type="button" role="tab" id="pot-t-historico" aria-controls="pot-v-historico" onclick="potAba(\'historico\')">Histórico</button>'
    +    (eGestao?'<button type="button" role="tab" id="pot-t-tarifas" aria-controls="pot-v-tarifas" onclick="potAba(\'tarifas\')">Tarifas</button>':'')
    +  '</nav>'
    +  '<div class="pot-barra-fim">'
    +    '<p class="pot-status" id="pot-slide-link" aria-live="polite"></p>'
    +    '<button type="button" class="pot-cta" id="pot-gerar" onclick="potGerarSlide()" disabled>'+POT_ICO.slide+'<span>Gerar slide</span></button>'
    +  '</div>'
    +'</header>'
    +'<div class="pot-corpo">'
    +  '<section class="pot-vista pot-v-calcular" id="pot-v-calcular" role="tabpanel" aria-labelledby="pot-t-calcular">'
    +    '<aside class="pot-lateral" aria-label="Cidade e premissas">'
    +      '<div class="pot-busca"><label for="pot-q">Cidade</label>'
    +        '<div class="pot-busca-campo">'+POT_ICO.lupa
    +          '<input id="pot-q" type="text" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-controls="pot-lista" aria-autocomplete="list" placeholder="Digite a cidade (atalho: /)" oninput="potBuscaDigita(this)" onkeydown="potBuscaTecla(event)" onblur="potBuscaFecha()">'
    +        '</div>'
    +        '<ul id="pot-lista" role="listbox" aria-label="Cidades encontradas" hidden></ul></div>'
    +      '<div id="pot-recentes"></div>'
    +      '<div id="pot-premissas"></div>'
    +    '</aside>'
    +    '<div class="pot-palco" id="pot-palco"></div>'
    +  '</section>'
    +  '<section class="pot-vista" id="pot-v-comparar" role="tabpanel" aria-labelledby="pot-t-comparar" hidden></section>'
    +  '<section class="pot-vista" id="pot-v-historico" role="tabpanel" aria-labelledby="pot-t-historico" hidden></section>'
    +  (eGestao?'<section class="pot-vista" id="pot-v-tarifas" role="tabpanel" aria-labelledby="pot-t-tarifas" hidden></section>':'')
    +'</div>';
  _pot.montado=true;
  // "/" leva à busca, de qualquer ponto do módulo (menos de dentro de um campo).
  document.addEventListener('keydown',e=>{
    if(e.key!=='/' || !document.body.classList.contains('mode-potencial')) return;
    const t=e.target; if(t && /^(input|textarea|select)$/i.test(t.tagName)) return;
    e.preventDefault(); potAba('calcular'); const q=_potEl('pot-q'); if(q){ q.focus(); q.select(); }
  });
}

function potAba(nome){
  const abas=['calcular','comparar','historico','tarifas'];
  if(!_potEl('pot-v-'+nome)) nome='calcular';
  _pot.aba=nome;
  abas.forEach(a=>{
    const v=_potEl('pot-v-'+a), t=_potEl('pot-t-'+a); if(!v||!t) return;
    const ativa=a===nome; v.hidden=!ativa; t.setAttribute('aria-selected',String(ativa)); t.tabIndex=ativa?0:-1; t.classList.toggle('ativa',ativa);
  });
  const g=_potEl('pot-gerar'); if(g) g.hidden = nome!=='calcular';
  const sl=_potEl('pot-slide-link'); if(sl) sl.hidden = nome!=='calcular';
  if(nome==='comparar' && typeof potRenderComparar==='function') potRenderComparar();
  if(nome==='historico' && typeof potRenderHistorico==='function') potRenderHistorico();
  if(nome==='tarifas' && typeof potRenderTarifas==='function') potRenderTarifas();
}

/* ═══ Busca (combobox com teclado) ═══ */
function potBuscaDigita(el){
  clearTimeout(_pot.timer);
  const termo=el.value; const meu=++_pot.seq;
  _pot.timer=setTimeout(async()=>{
    try{
      const lista=await potBuscarCidades(termo);
      if(meu!==_pot.seq) return;   // chegou resposta velha: a pessoa já digitou mais
      _pot.resultados=lista; _pot.sel=lista.length?0:-1; potRenderLista(termo);
    }catch(e){ gToast('Não consegui buscar as cidades.'); }
  },180);
}

function potRenderLista(termo){
  const ul=_potEl('pot-lista'); if(!ul) return;
  const q=_potEl('pot-q');
  if(!_pot.resultados.length){
    ul.innerHTML = gNormBusca(termo).trim().length>=2 ? '<li class="pot-li-vazio" role="presentation">Nenhuma cidade com esse nome.</li>' : '';
    ul.hidden = !ul.innerHTML; if(q){ q.setAttribute('aria-expanded', String(!ul.hidden)); q.removeAttribute('aria-activedescendant'); } return;
  }
  ul.innerHTML=_pot.resultados.map((c,i)=>'<li role="option" id="pot-op-'+i+'" aria-selected="'+(i===_pot.sel)+'" class="'+(i===_pot.sel?'sel':'')+'">'
    +'<button type="button" tabindex="-1" onmousedown="event.preventDefault()" onclick="potEscolher('+i+')">'
    +'<span class="pot-li-nome">'+gEsc(c.nome)+' <em>'+gEsc(c.uf)+'</em>'+(c.operacao_fase?'<i class="pot-li-dm" title="A DM já opera aqui">DM</i>':'')+'</span>'
    +'<span class="pot-li-pop">'+potNumero(c.populacao)+' hab.</span></button></li>').join('')
    +(_pot.truncou?'<li class="pot-li-vazio" role="presentation">Mostrando as '+POT_LIMITE_BUSCA+' maiores. Digite mais letras para achar outras.</li>':'');
  ul.hidden=false;
  if(q){ q.setAttribute('aria-expanded','true'); q.setAttribute('aria-activedescendant','pot-op-'+_pot.sel); }
}

function potBuscaTecla(e){
  const ul=_potEl('pot-lista'); if(!ul || ul.hidden || !_pot.resultados.length){ if(e.key==='Escape') potBuscaFecha(); return; }
  const n=_pot.resultados.length;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    e.preventDefault(); _pot.sel=(_pot.sel+(e.key==='ArrowDown'?1:-1)+n)%n; potRenderLista(_potEl('pot-q').value);
    const el=_potEl('pot-op-'+_pot.sel); if(el && el.scrollIntoView) el.scrollIntoView({block:'nearest'});
  }else if(e.key==='Enter'){ e.preventDefault(); potEscolher(_pot.sel); }
  else if(e.key==='Escape'){ e.preventDefault(); potBuscaFecha(); }
}
function potBuscaFecha(){
  const ul=_potEl('pot-lista'); if(ul){ ul.hidden=true; }
  const q=_potEl('pot-q'); if(q) q.setAttribute('aria-expanded','false');
}

function potEscolher(i){ const c=_pot.resultados[i]; if(c) potEscolherCidade(c); }

function potEscolherCidade(c, silencioso){
  _pot.cidade=c; _pot.ov={}; _pot.ultimoSlide=''; _pot.abaBloqueada=false; _pot.prev={};
  potBuscaFecha();
  const q=_potEl('pot-q'); if(q) q.value=c.nome+' - '+c.uf;
  potLembra(c);
  potRenderRecentes(); potRenderPremissas(); potRecalcula();
  if(!silencioso && q) q.blur();
}

function potRenderRecentes(){
  const el=_potEl('pot-recentes'); if(!el) return;
  const r=potRecentes();
  el.innerHTML = r.length ? '<p class="pot-rot">Recentes</p><div class="pot-chips">'
    +r.map(x=>'<button type="button" class="pot-chip'+(_pot.cidade&&_pot.cidade.chave===x.chave?' on':'')+'" data-chave="'+gEsc(x.chave)+'" onclick="potAbrirChave(this.dataset.chave)">'+gEsc(x.nome)+' <em>'+gEsc(x.uf)+'</em></button>').join('')+'</div>' : '';
}
async function potAbrirChave(chave){
  const c=await potCidadePorChave(chave);
  if(!c){ gToast('Não achei essa cidade na base.'); return; }
  potAba('calcular'); potEscolherCidade(c,true);
}

/* ═══ Premissas (controles) ═══ */
// Um controle = rótulo + valor + a base ("Base: 2") para a pessoa saber o que mudou. `chave` é o ajuste (ov).
function _potBase(){
  const c=_pot.cidade, pr=_pot.param||{}, calc0=potCalcular(c,_pot,{});
  return { concorrentes:c.concorrentes!=null?c.concorrentes:0, ticket:calc0.ticketReal, comissao:pr.comissao, rebate:pr.rebate_franqueado,
    simples:pr.simples, parcelas:pr.parcelas_taxa, mktApos5:pr.mkt_apos_mes5, opcoes:calc0.ticketOpcoes };
}
const _potPc=v=>v==null?'':String(+(v*100).toFixed(2)).replace('.',',')+'%';

function potRenderPremissas(){
  const el=_potEl('pot-premissas'); if(!el || !_pot.cidade) return;
  const b=_potBase(), calc=potCalcular(_pot.cidade,_pot,_pot.ov);   // sempre fresco: _pot.calc pode ser da cidade anterior
  const slider=(k,rot,min,max,passo,val,base,dica)=>'<div class="pot-ctl" data-k="'+k+'"><div class="pot-ctl-topo"><label for="pot-c-'+k+'">'+rot+'</label>'
    +'<output id="pot-o-'+k+'" for="pot-c-'+k+'">'+_potPc(val)+'</output></div>'
    +'<input id="pot-c-'+k+'" type="range" min="'+min+'" max="'+max+'" step="'+passo+'" value="'+(val*100)+'" oninput="potAjustaPct(\''+k+'\',this)" aria-describedby="pot-d-'+k+'">'
    +'<small id="pot-d-'+k+'">'+dica+' <span class="pot-base">Base: '+_potPc(base)+'</span></small></div>';
  const opts=b.opcoes, preset=(id,rot,v)=>v==null?'':'<button type="button" class="pot-seg-b" data-v="'+v+'" aria-pressed="'+(Math.abs(calc.ticketReal-v)<0.005)+'" onclick="potTicketPreset('+v+')">'+rot+' <b>'+potBRL2(v)+'</b></button>';
  el.innerHTML=
    '<div class="pot-premissas-topo"><p class="pot-rot">Premissas</p><button type="button" class="pot-link" onclick="potRestaurar()">Voltar à base</button></div>'
    +'<div class="pot-ctl"><div class="pot-ctl-topo"><label for="pot-c-concorrentes">Concorrentes</label><span class="pot-base">Base: '+b.concorrentes+'</span></div>'
    +  '<div class="pot-step"><button type="button" aria-label="Menos um concorrente" onclick="potStep(-1)">'+POT_ICO.menos+'</button>'
    +  '<input id="pot-c-concorrentes" inputmode="numeric" value="'+calc.conc+'" onchange="potConcorrentes(this.value)" aria-describedby="pot-d-concorrentes">'
    +  '<button type="button" aria-label="Mais um concorrente" onclick="potStep(1)">'+POT_ICO.mais+'</button></div>'
    +  '<small id="pot-d-concorrentes">Muda o marketing de lançamento.</small></div>'
    +'<div class="pot-ctl"><div class="pot-ctl-topo"><label for="pot-c-ticket">Ticket médio</label></div>'
    +  '<div class="pot-in"><i>R$</i><input id="pot-c-ticket" inputmode="decimal" value="'+gEsc(String(calc.ticketReal==null?'':calc.ticketReal).replace('.',','))+'" onchange="potTicket(this.value)" aria-describedby="pot-d-ticket"></div>'
    +  '<div class="pot-seg" role="group" aria-label="Atalhos de ticket">'+preset('calc','Calculadora',opts.calculadora)+preset('apr','Apresentação',opts.apresentacao)+preset('reg','Região',opts.regiao)+'</div>'
    +  '<small id="pot-d-ticket">Os cenários aplicam ×0,975 / ×1 / ×1,025.</small></div>'
    +'<div class="pot-ctl"><div class="pot-ctl-topo"><label>Taxa de franquia em</label><span class="pot-base">Base: '+b.parcelas+'x</span></div>'
    +  '<div class="pot-seg pot-seg-n" role="group" aria-label="Parcelas da taxa de franquia">'
    +  [1,2,3,4,5].map(n=>'<button type="button" class="pot-seg-b" aria-pressed="'+(calc.parcelas===n)+'" onclick="potParcelas('+n+')">'+n+'x</button>').join('')+'</div></div>'
    +slider('comissao','Comissão sobre o GMV',5,20,0.5,calc.comissao,b.comissao,'Média da rede.')
    +slider('rebate','Parte do franqueado',30,70,5,calc.rebate,b.rebate,'Da comissão.')
    +slider('simples','Simples Nacional',0,15,0.5,calc.simples,b.simples,'Sobre a receita do franqueado.')
    +slider('mktApos5','Reinvestimento (mês 6 em diante)',0,40,1,calc.mktApos5,b.mktApos5,'% da comissão do mês anterior.');
}

function potAjusta(campo, v){ if(v==null||isNaN(v)) delete _pot.ov[campo]; else _pot.ov[campo]=v; potRecalcula(); }
function potAjustaPct(k, el){
  const v=parseFloat(el.value)/100; const o=_potEl('pot-o-'+k); if(o) o.textContent=_potPc(v);
  const base=_potBase()[k]; if(Math.abs(v-base)<1e-9) delete _pot.ov[k]; else _pot.ov[k]=v;
  potRecalcula(); potMarcaAlterados();
}
function potStep(d){
  const calc=potCalcular(_pot.cidade,_pot,_pot.ov), n=Math.max(0,Math.min(12,calc.conc+d));
  _potEl('pot-c-concorrentes').value=n; potConcorrentes(n);
}
function potConcorrentes(v){
  const n=Math.max(0,Math.min(12,parseInt(v,10)));
  if(isNaN(n)){ delete _pot.ov.concorrentes; }
  else if(n===_potBase().concorrentes) delete _pot.ov.concorrentes; else _pot.ov.concorrentes=n;
  const calc=potCalcular(_pot.cidade,_pot,_pot.ov); const i=_potEl('pot-c-concorrentes'); if(i) i.value=calc.conc;
  potRecalcula(); potMarcaAlterados();
}
function potTicket(s){ const n=potLerNumero(s); if(n==null||n<=0){ delete _pot.ov.ticket; } else _pot.ov.ticket=n; potTicketSincroniza(); potRecalcula(); potMarcaAlterados(); }
function potTicketPreset(v){ _pot.ov.ticket=v; potTicketSincroniza(); potRecalcula(); potMarcaAlterados(); }
function potTicketSincroniza(){
  const calc=potCalcular(_pot.cidade,_pot,_pot.ov), i=_potEl('pot-c-ticket'); if(i) i.value=String(calc.ticketReal==null?'':calc.ticketReal).replace('.',',');
  document.querySelectorAll('.pot-seg-b[data-v]').forEach(b=>b.setAttribute('aria-pressed',String(Math.abs(calc.ticketReal-parseFloat(b.dataset.v))<0.005)));
}
function potParcelas(n){
  if(n===_pot.param.parcelas_taxa) delete _pot.ov.parcelas; else _pot.ov.parcelas=n;
  document.querySelectorAll('.pot-seg-n .pot-seg-b').forEach((b,i)=>b.setAttribute('aria-pressed',String(i+1===n)));
  potRecalcula(); potMarcaAlterados();
}
function potRestaurar(){ _pot.ov={}; potRenderPremissas(); potRecalcula(); }
// Um pontinho laranja no controle que saiu da base: a pessoa vê de relance o que mexeu.
function potMarcaAlterados(){
  const ov=_pot.ov, mapa={concorrentes:'concorrentes',ticket:'ticket',parcelas:'parcelas',comissao:'comissao',rebate:'rebate',simples:'simples',mktApos5:'mktApos5'};
  const painel=_potEl('pot-premissas'); if(!painel) return;
  painel.querySelectorAll('.pot-ctl').forEach(c=>c.classList.remove('alterado'));
  Object.keys(ov).forEach(k=>{
    const alvo = k==='ticket' ? _potEl('pot-c-ticket') : k==='parcelas' ? painel.querySelector('.pot-seg-n') : _potEl('pot-c-'+mapa[k]);
    const ctl=alvo && alvo.closest('.pot-ctl'); if(ctl) ctl.classList.add('alterado');
  });
}

/* ═══ Recalcular e desenhar o palco (coalescido: um desenho por quadro) ═══ */
function potRecalcula(){
  if(!_pot.cidade) return;
  if(_pot.raf) return;
  _pot.raf=requestAnimationFrame(()=>{ _pot.raf=0; potDesenha(); });
}

function _potN(chave, valor, fmt){
  // Número que anima do valor anterior ao novo (ver potAnima). O texto já nasce certo: sem JS de animação, nada quebra.
  return '<span class="pot-n" data-k="'+chave+'" data-n="'+(valor==null?'':valor)+'" data-f="'+fmt+'">'+_potFmt(fmt,valor)+'</span>';
}
function _potFmt(f,v){ return ({brl:potBRL,brlc:potBRLc,num:potNumero,meses:potMeses,pct:x=>potPct(x,0)}[f]||String)(v); }

function potAnima(raiz){
  const reduz=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  raiz.querySelectorAll('.pot-n').forEach(el=>{
    const k=el.dataset.k, para=el.dataset.n===''?null:parseFloat(el.dataset.n), de=_pot.prev[k];
    _pot.prev[k]=para;
    if(reduz || para==null || de==null || de===para || isNaN(de)) return;
    const t0=performance.now(), dur=420;
    (function quadro(t){
      const p=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-p,3);
      el.textContent=_potFmt(el.dataset.f, de+(para-de)*e);
      if(p<1 && document.body.contains(el)) requestAnimationFrame(quadro); else el.textContent=_potFmt(el.dataset.f,para);
    })(t0);
  });
}

function potDesenha(){
  const palco=_potEl('pot-palco'); if(!palco || !_pot.cidade) return;
  const calc=potCalcular(_pot.cidade,_pot,_pot.ov); _pot.calc=calc;
  const c=calc.cidade, m=calc.modelo, r=m&&m.resumo;
  const pesoTaxa=calc.inv>0 && calc.taxa!=null ? calc.taxa/calc.inv*100 : 0;

  const aviso=(a)=>'<p class="pot-aviso" role="status">'+POT_ICO.info+'<span>'+gEsc(a)+'</span></p>';
  const kpi=(rot,html,dica,tom)=>'<div class="pot-kpi'+(tom?' '+tom:'')+'"><dt>'+rot+'</dt><dd>'+html+'</dd>'+(dica?'<small>'+dica+'</small>':'')+'</div>';

  const cenarios='<div class="pot-cenarios">'+calc.cenarios.map(s=>{
    const maior=Math.max.apply(null,calc.cenarios.map(x=>x.gmv||0))||1;
    const linha=(rot,v,forte)=>'<div class="pot-lin'+(forte?' forte':'')+'"><span>'+rot+'</span><strong>'+v+'</strong></div>';
    return '<article class="pot-cen pot-'+gEsc(s.id)+'"><header><h3>'+gEsc(POT_ROTULO[s.id]||s.id)+'</h3><p>'+potPct(s.pct,0)+' da população</p></header>'
      +'<div class="pot-cen-gmv"><small>GMV mensal</small><b>'+_potN('gmv-'+s.id,s.gmv,'brl')+'</b>'
      +'<span class="pot-cen-barra" aria-hidden="true"><i style="width:'+Math.max(3,((s.gmv||0)/maior)*100).toFixed(1)+'%"></i></span></div>'
      +linha('Usuários ativos',_potN('usu-'+s.id,s.usuarios,'num'))+linha('Receita franqueado/mês',_potN('rec-'+s.id,s.receita,'brl'),true)
      +linha('Lucro líquido anual',_potN('luc-'+s.id,s.lucro,'brl'))+linha('Payback',potMeses(s.payback),true)+linha('ROI anual',potPct(s.roi,0))+'</article>';
  }).join('')+'</div>';

  const projecao = m
    ? '<div class="pot-proj">'+potProjecaoHTML(m)+'</div>'
      +'<details class="pot-det"><summary>Ver a tabela mês a mês</summary>'+potTabelaMeses(m)+'</details>'
    : '<p class="pot-vazio">A projeção de 24 meses precisa de parâmetros que ainda não estão no banco'+(calc.parametrosFaltando.length?' ('+calc.parametrosFaltando.map(gEsc).join(', ')+')':'')+'. Aplique a migration do Potencial v2.</p>';

  palco.innerHTML=
    '<section class="pot-hero" aria-label="Cidade">'
    +  '<div class="pot-hero-id"><p class="pot-eyebrow">'+gEsc(calc.regiao||'')+' · '+gEsc(c.uf)+(calc.faixa?' · faixa de '+potNumero(calc.faixa.pop_min)+' a '+(calc.faixa.pop_max?potNumero(calc.faixa.pop_max):'mais')+' hab.':'')+'</p>'
    +    '<h2>'+gEsc(c.nome)+'</h2>'
    +    '<ul class="pot-fatos"><li><b>'+potNumero(c.populacao)+'</b> habitantes</li><li><b>'+potBRL(c.pib_per_capita)+'</b> PIB per capita</li><li><b>'+calc.conc+'</b> concorrente'+(calc.conc===1?'':'s')+'</li>'
    +    (c.operacao_fase?'<li class="dm"><b>DM</b> '+gEsc(c.operacao_fase)+'</li>':'')+(c.vender===false?'<li class="nao"><b>Não vender</b> na base</li>':'')+'</ul>'
    +    '<button type="button" class="pot-btn-sec" onclick="potComparaAdd()">'+POT_ICO.mais+'Comparar com outra cidade</button></div>'
    +  '<div class="pot-hero-inv"><p class="pot-eyebrow">Investimento total</p><p class="pot-hero-num">'+_potN('inv',calc.inv,'brl')+'</p>'
    +    '<div class="pot-comp" role="img" aria-label="Taxa de franquia '+potBRL(calc.taxa)+' e marketing de lançamento '+potBRL(calc.mkt)+'">'
    +      '<span class="pot-comp-taxa" style="flex:'+pesoTaxa.toFixed(2)+'"><i>Taxa de franquia</i><b>'+potBRL(calc.taxa)+'</b></span>'
    +      '<span class="pot-comp-mkt" style="flex:'+(100-pesoTaxa).toFixed(2)+'"><i>Marketing (5 meses)</i><b>'+potBRL(calc.mkt)+'</b></span></div></div>'
    +'</section>'
    +(calc.avisos.length?'<div class="pot-avisos">'+calc.avisos.map(aviso).join('')+'</div>':'')
    +(r?'<dl class="pot-kpis">'
      +kpi('Payback',r.paybackMes?'mês '+_potN('pay',r.paybackMes,'num'):'além de 24 meses','quando o caixa acumulado volta a zero',r.paybackMes?'bom':'ruim')
      +kpi('Fundo do caixa',_potN('pico',r.pico,'brlc'),'mês '+r.mesPico+' · o máximo que fica exposto','ruim')
      +kpi('Resultado em 12 meses',_potN('r12',r.resultado12,'brlc'),'caixa acumulado no mês 12',r.resultado12>=0?'bom':'ruim')
      +kpi('Resultado em 24 meses',_potN('r24',r.resultado24,'brlc'),'caixa acumulado no mês 24',r.resultado24>=0?'bom':'ruim')
      +kpi('GMV no mês 24',_potN('g24',r.gmv24,'brlc'),potBRL2(r.gmvHab24)+' por habitante')
      +'</dl>':'')
    +'<section class="pot-sec"><header><h3>Cenários de mercado</h3><p>Quanto da população vira usuário ativo — os números do slide.</p></header>'+cenarios+'</section>'
    +'<section class="pot-sec"><header><h3>Projeção de 24 meses</h3><p>Modelo da planilha: o marketing gera GMV, o GMV gera comissão e o caixa mostra quando o investimento volta.</p></header>'+projecao+'</section>'
    +'<section class="pot-sec">'+potRegrasHTML(calc)+'</section>';
  potAnima(palco);
  if(m) potLigaProjecao(m);
  const g=_potEl('pot-gerar'); if(g) g.disabled=!(calc.inv!=null && calc.cenarios.every(s=>s.gmv!=null));
  potRenderSlideLink();
}

function potRenderVazio(){
  const palco=_potEl('pot-palco'); if(!palco) return;
  palco.innerHTML='<section class="pot-vazio-tela"><div class="pot-vazio-arte" aria-hidden="true">'+POT_ICO.lupa+'</div>'
    +'<h2>Qual cidade vamos estudar?</h2><p>Busque pelo nome na lateral. Você vê o investimento, os três cenários e a projeção de 24 meses, e gera o slide da apresentação em um clique.</p>'
    +'<div id="pot-rede"></div></section>';
  potCidadesDaRede().then(l=>{
    const el=_potEl('pot-rede'); if(!el||!l.length) return;
    el.innerHTML='<p class="pot-rot">Cidades onde a DM já opera</p><div class="pot-chips">'
      +l.map(x=>'<button type="button" class="pot-chip" data-chave="'+gEsc(x.chave)+'" onclick="potAbrirChave(this.dataset.chave)">'+gEsc(x.nome)+' <em>'+gEsc(x.uf)+'</em></button>').join('')+'</div>';
  }).catch(()=>{});
}

/* Regras e fontes: de onde vem cada número e o que ainda precisa de confirmação do comercial. */
function potRegrasHTML(calc){
  const R=[
    ['ok','Investimento total','Taxa de franquia (a negociada da cidade, senão a da faixa de população) + marketing de lançamento = base da faixa × (1 + IPCA) × multiplicador de concorrentes, arredondado para cima de 50 em 50. Aba Calculadora, células C5, C6 e C8.'],
    ['ok','Cenários, payback e ROI','Usuários = população × %. GMV = usuários × ticket. Receita = GMV × comissão × parte do franqueado. Lucro anual = receita × 12 × (1 − Simples). Payback = investimento ÷ (lucro ÷ 12). Aba Cenários da planilha.'],
    ['ok','Projeção de 24 meses','Reproduzida célula a célula da aba Calculadora (linhas 26 a 50): 24 meses × 11 linhas, diferença menor que R$ 0,0001.'],
    ['ver','Ticket médio','R$ 70 é o da aba Calculadora (fonte Getnet/Ticket 2025 + IPCA). A aba Cenários e o slide antigo traziam R$ 45 digitados. Os dois ficam como atalho; confirmar qual vale.'],
    ['ass','3 ou mais concorrentes','A planilha só tem multiplicador até 2 e devolvia erro acima disso. Aqui vale o de 2, com aviso. Confirmar com o comercial.'],
    ['ver','Inadimplência','A planilha aplica 2% só no mês 2 (a referência da fórmula "anda" para células vazias). Seguimos a planilha; a gestão pode aplicar todo mês em Tarifas.'],
    ['ok','Royalties (1,35%)','Aparecem na planilha mas não entram no caixa do franqueado. Seguimos igual.']
  ];
  const rot={ok:'Confirmada na planilha',ass:'Regra assumida',ver:'A confirmar'};
  return '<details class="pot-det pot-regras"><summary>Regras e fontes <span>'+R.filter(x=>x[0]!=='ok').length+' a confirmar</span></summary><ul>'
    +R.map(x=>'<li class="'+x[0]+'"><span class="pot-sel">'+(x[0]==='ok'?POT_ICO.check:POT_ICO.alerta)+rot[x[0]]+'</span><b>'+x[1]+'</b><p>'+x[2]+'</p></li>').join('')+'</ul></details>';
}

/* ═══ Slide ═══ */
async function potGerarSlide(){
  const calc=_pot.calc; if(!calc || _pot.gerando) return;
  const url=_pot.param && _pot.param.slides_webapp_url;
  if(!url){ gToast('O gerador de slide ainda não foi configurado. Fale com a gestão.'); return; }
  if(calc.inv==null){ gToast('Sem o investimento total não dá para gerar o slide. Ajuste os concorrentes.'); return; }
  const btn=_potEl('pot-gerar'); const solta=gBtnLoading(btn,'Gerando…');
  // A aba abre AGORA, no clique: depois do await o navegador trata window.open como popup e bloqueia.
  const aba=window.open('','_blank');
  _pot.gerando=true;
  try{
    const j=await potChamaGerador(calc);
    _pot.ultimoSlide=j.url; _pot.abaBloqueada=!aba;
    if(aba){ aba.location.href=j.url; gToast('Slide pronto. Abrindo no Google Slides.'); }
    else gToast('Slide pronto. Seu navegador bloqueou a aba nova: use o link "Abrir no Google Slides".');
    potRenderSlideLink();
    potRegistrarProposta(calc,j.url);
  }catch(e){
    if(aba) aba.close();
    gToast(String((e && e.message) || 'Não consegui gerar o slide. Tente de novo.'));
  }finally{ _pot.gerando=false; solta(); }
}

// Uma chamada ao Apps Script. Compartilhada com o lote (comparar.js): UM caminho para o gerador.
async function potChamaGerador(calc){
  const url=_pot.param && _pot.param.slides_webapp_url;
  if(!url) throw new Error('O gerador de slide ainda não foi configurado.');
  const sess=await gSupabase().auth.getSession();
  const token=sess && sess.data && sess.data.session && sess.data.session.access_token;
  if(!token) throw new Error('Sessão expirada. Entre de novo no Luma.');
  // text/plain evita o preflight de CORS (o Apps Script não responde OPTIONS).
  const r=await fetch(url,{ method:'POST', redirect:'follow', headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify({ token, cidade:calc.cidade.chave, campos:potCamposSlide(calc) }) });
  const j=await r.json();
  if(!j || !j.ok || !j.url) throw new Error((j && j.erro) || 'O gerador não respondeu.');
  if(!/^https:\/\/docs\.google\.com\//.test(j.url)) throw new Error('O gerador devolveu um endereço inesperado.');
  return j;
}

// O histórico nunca atrapalha o slide: se a tabela ainda não existe ou o banco recusa, só segue.
async function potRegistrarProposta(calc, url, ov){
  try{
    const sb=_potSb(); if(!sb) return;
    const { error } = await sb.from('potencial_propostas').insert({
      cidade_chave:calc.cidade.chave, cidade_nome:calc.cidade.nome, uf:calc.cidade.uf,
      ajustes:ov||_pot.ov, resumo:potResumo(calc), slide_url:url });
    if(error) throw error;
    _pot.historico=null;
  }catch(e){ _potTry(()=>console.warn('[potencial] proposta não registrada:',e.message||e)); }
}

function potRenderSlideLink(){
  const el=_potEl('pot-slide-link'); if(!el) return;
  el.innerHTML = _pot.ultimoSlide ? (_pot.abaBloqueada?'O navegador bloqueou a aba nova. ':'Slide gerado. ')+'<a href="'+gEsc(_pot.ultimoSlide)+'" target="_blank" rel="noopener">Abrir no Google Slides</a>' : '';
}
