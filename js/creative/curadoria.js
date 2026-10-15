/**
 * js/creative/curadoria.js
 *
 * CURADORIA do Luma Creative (frente 5, 15/10/2026) — só a gestão. A pessoa vê as 3 opções que o
 * motor entrega para os pedidos do banco (tests/creative-banco.js, carregado sob demanda), vota 👍/👎
 * com o motivo, e os votos viram:
 *   1. pesos sugeridos para a nota de design — busca coordenada simples nos multiplicadores das 6
 *      partes (sem IA): o melhor jeito de a nota ordenar as aprovadas acima das reprovadas, puxando
 *      as partes que os motivos apontam e voltando para 1 quando não há evidência;
 *   2. linhas de golden — a arte aprovada não pode piorar (tests/creative-golden.js).
 * Exporta tudo num JSON; `node scripts/catalogo-composicoes.js --curadoria=arquivo.json` leva os
 * aprovados ao golden. Os pesos só valem neste navegador quando a pessoa aplica (_crPesosCuradoria);
 * para valerem para todo mundo, entram no CR_NOTA_PESOS por commit. Carregado depois de creative.js.
 */

const CR_CUR_MOTIVOS = [['equilibrio', 'Peso'], ['vazio', 'Vazio'], ['eixos', 'Alinhamento'], ['escala', 'Hierarquia'], ['contraste', 'Contraste'], ['respiro', 'Margens']];
const CR_CUR_CHAVE = 'luma_creative_curadoria_v1', CR_CUR_PESOS = 'luma_creative_pesos_v1';
const CR_CUR_GRADE = [0.5, 0.63, 0.8, 1, 1.25, 1.6, 2];

/* ── Lógica pura (a suíte svg-import testa) ── */
// Os pesos de uma peça sem a curadoria (padrão × objetivo × formato), vezes os multiplicadores m
function _crCurPesos(objetivo, formato, m){
  const base = Object.assign({}, CR_NOTA_PESOS.padrao), o = CR_NOTA_PESOS.objetivo[objetivo] || {}, f = CR_NOTA_PESOS.formato[formato] || {};
  CR_NOTA_PARTES.forEach(k => { base[k] *= (o[k] || 1) * (f[k] || 1) * ((m && m[k]) || 1); });
  return base;
}
// A nota de um voto com os multiplicadores m — a mesma conta do crNotaDesign (média pesada × elo mais fraco)
function crCuradoriaNota(v, m){
  const w = _crCurPesos(v.objetivo, v.formato, m);
  let s = 0, t = 0;
  CR_NOTA_PARTES.forEach(k => { s += w[k] * (v.partes[k] || 0); t += w[k]; });
  const rel = CR_NOTA_PARTES.filter(k => w[k] >= 0.7).map(k => v.partes[k] || 0);
  return 100 * (s / t) * (0.7 + 0.3 * (rel.length ? Math.min(...rel) : 1));
}
// Acerto: a fração dos pares (aprovada, reprovada) que a nota ordena certo
function _crCurAcerto(sim, nao, m){
  if(!sim.length || !nao.length) return 1;
  const a = sim.map(v => crCuradoriaNota(v, m)), b = nao.map(v => crCuradoriaNota(v, m));
  let ok = 0; a.forEach(x => b.forEach(y => { ok += x > y + 1e-9 ? 1 : x > y - 1e-9 ? 0.5 : 0; }));
  return ok / (a.length * b.length);
}
/* Pesos sugeridos pelos votos: busca coordenada (3 passadas, ordem fixa das partes) na grade de
   multiplicadores, maximizando o acerto, com puxão para as partes que os motivos dos 👎 apontam e
   regularização para 1. Determinística; null se faltar voto (≥ 2 de cada). */
function crCuradoriaPesos(votos){
  const sim = (votos || []).filter(v => v.voto > 0), nao = (votos || []).filter(v => v.voto < 0);
  if(sim.length < 2 || nao.length < 2) return null;
  const cita = {};
  CR_NOTA_PARTES.forEach(k => { cita[k] = nao.filter(v => (v.motivos || []).indexOf(k) >= 0).length / nao.length; });
  const obj = m => _crCurAcerto(sim, nao, m) + CR_NOTA_PARTES.reduce((s, k) => s + 0.04 * cita[k] * Math.log(m[k]) - 0.03 * Math.pow(Math.log(m[k]), 2), 0);
  const m = {};
  CR_NOTA_PARTES.forEach(k => { m[k] = 1; });
  for(let passo = 0; passo < 3; passo++) CR_NOTA_PARTES.forEach(k => {
    let melhor = m[k], vm = obj(m);
    CR_CUR_GRADE.forEach(g => { const t = Object.assign({}, m, { [k]: g }), vt = obj(t); if(vt > vm + 1e-9){ vm = vt; melhor = g; } });
    m[k] = melhor;
  });
  const um = {}; CR_NOTA_PARTES.forEach(k => { um[k] = 1; });
  return { pesos: m, acerto: { antes: Math.round(1000 * _crCurAcerto(sim, nao, um)) / 1000, depois: Math.round(1000 * _crCurAcerto(sim, nao, m)) / 1000 }, sim: sim.length, nao: nao.length };
}
// O JSON da curadoria: os votos, os pesos sugeridos e as linhas de golden das aprovadas (formato do CR_GOLDEN)
function crCuradoriaExporta(votos){
  const vs = (votos || []).slice().sort((a, b) => (a.chave < b.chave ? -1 : 1)), p = crCuradoriaPesos(vs);
  return {
    versao: 1, exportado: new Date().toISOString(), votos: vs, pesosSugeridos: p ? p.pesos : null, acerto: p ? p.acerto : null,
    golden: vs.filter(v => v.voto > 0).map(v => ({ receita: v.familia, formato: v.formato, caso: v.caso, texto: v.texto, foto: v.foto, marca: v.marca, nota: v.nota, origem: 'curadoria' }))
  };
}

/* ── Guarda local (conveniência deste navegador; o que vale é o JSON exportado) ── */
function _crCurLe(chave){ try{ return JSON.parse(localStorage.getItem(chave) || 'null'); }catch(e){ return null; } }
function _crCurGrava(chave, v){ try{ if(v == null) localStorage.removeItem(chave); else localStorage.setItem(chave, JSON.stringify(v)); }catch(e){} }
// os pesos aplicados por esta pessoa valem desde o carregamento
(function(){ const p = _crCurLe(CR_CUR_PESOS); if(p && typeof p === 'object') _crPesosCuradoria = p; })();

/* ── Tela ── */
const _CR_CUR_ICO = {
  sim: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10v11"/><path d="M15 5.9 14 10h5.8a2 2 0 0 1 1.9 2.5l-2.3 8A2 2 0 0 1 17.5 22H7V10l4.5-7.5A2 2 0 0 1 15 5.9Z"/></svg>',
  nao: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 14V3"/><path d="M9 18.1 10 14H4.2a2 2 0 0 1-1.9-2.5l2.3-8A2 2 0 0 1 6.5 2H17v12l-4.5 7.5A2 2 0 0 1 9 18.1Z"/></svg>',
  x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'
};
let _crCur = null;   // { el, votos, pagina, casos, origem, urls }

async function _crCurBanco(){
  if(typeof CR_BANCO !== 'undefined') return true;
  const v = (/creative\.js\?v=(\d+)/.exec([...document.scripts].map(s => s.src).join(' ')) || [])[1] || '1';
  return new Promise(ok => { const s = document.createElement('script'); s.src = 'tests/creative-banco.js?v=' + v; s.onload = () => ok(true); s.onerror = () => ok(false); document.head.appendChild(s); });
}

async function crCuradoria(){
  const papel = typeof gCurrentRole === 'function' ? gCurrentRole() : null;
  if(papel && papel !== 'gestao' && papel !== 'superadmin') return gToast('A curadoria é só da gestão', 'error');
  if(_crCur) return;
  if(!(await _crCurBanco())) return gToast('Não consegui carregar o banco de pedidos', 'error');
  const votos = _crCurLe(CR_CUR_CHAVE) || {};
  const el = document.createElement('div');
  el.className = 'cr-cur'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Curadoria');
  el.innerHTML = '<header class="cr-cur-cab"><div class="cr-cur-tit"><b>Curadoria</b><span>Vote nas opções que o motor entrega para os pedidos do banco. Os votos sugerem os pesos da nota e as aprovadas viram regressão.</span></div>'
    + '<div class="cr-cur-acoes"><span class="cr-cur-conta" id="cr-cur-conta"></span>'
    + '<button type="button" class="cr-btn cr-btn-mini" data-ac="pesos">Pesos sugeridos</button>'
    + '<button type="button" class="cr-btn cr-btn-mini cr-prim" data-ac="exporta">Exportar JSON</button>'
    + '<button type="button" class="cr-btn cr-btn-mini cr-btn-leve cr-cur-x" data-ac="fecha" aria-label="Fechar a curadoria">' + _CR_CUR_ICO.x + '</button></div></header>'
    + '<div class="cr-cur-filtros"><label>Formato <select id="cr-cur-fmt"><option value="">todos</option>' + Object.keys(CR_FORMATOS).filter(f => f !== 'slide' && f !== 'emailRodape').map(f => '<option value="' + f + '">' + gEsc(CR_FORMATOS[f].nome) + '</option>').join('') + '</select></label>'
    + '<label>Grupo <select id="cr-cur-grp"><option value="">todos</option>' + 'ABCDEFG'.split('').map(g => '<option>' + g + '</option>').join('') + '</select></label>'
    + '<span class="cr-cur-pag"><button type="button" class="cr-btn cr-btn-mini" data-ac="ant">Anteriores</button><span id="cr-cur-pg"></span><button type="button" class="cr-btn cr-btn-mini" data-ac="prox">Próximos</button></span></div>'
    + '<div class="cr-cur-pesos" id="cr-cur-pesos" hidden></div><div class="cr-cur-lista" id="cr-cur-lista"></div>';
  (document.getElementById('view-creative') || document.body).appendChild(el);
  _crCur = { el, votos, pagina: 0, casos: [], origem: document.activeElement, urls: [], rodada: 0 };
  el.addEventListener('click', _crCurClique);
  el.addEventListener('keydown', e => { if(e.key === 'Escape'){ e.preventDefault(); crCuradoriaFecha(); } });
  el.querySelectorAll('select').forEach(s => s.addEventListener('change', () => { _crCur.pagina = 0; _crCurFiltra(); }));
  _crCurFiltra();
  setTimeout(() => { const b = el.querySelector('[data-ac="fecha"]'); if(b) b.focus({ preventScroll: true }); }, 30);
}
function crCuradoriaFecha(){
  if(!_crCur) return;
  _crCur.rodada++;
  _crCur.urls.forEach(u => URL.revokeObjectURL(u));
  const o = _crCur.origem; _crCur.el.remove(); _crCur = null;
  if(o && o.focus) o.focus({ preventScroll: true });
}
function _crCurFiltra(){
  const f = _crCur.el.querySelector('#cr-cur-fmt').value, g = _crCur.el.querySelector('#cr-cur-grp').value;
  _crCur.casos = crBancoCasos(f ? { formatos: [f] } : {}).filter(c => !g || c.pedido.grupo === g);
  _crCurPagina();
}
const CR_CUR_POR_PAGINA = 4;
async function _crCurPagina(){
  const c = _crCur, rodada = ++c.rodada, lista = c.el.querySelector('#cr-cur-lista'), n = Math.ceil(c.casos.length / CR_CUR_POR_PAGINA);
  c.urls.forEach(u => URL.revokeObjectURL(u)); c.urls = [];
  c.el.querySelector('#cr-cur-pg').textContent = (n ? c.pagina + 1 : 0) + ' de ' + n;
  lista.innerHTML = '';
  _crCurConta();
  for(const caso of c.casos.slice(c.pagina * CR_CUR_POR_PAGINA, (c.pagina + 1) * CR_CUR_POR_PAGINA)){
    const linha = document.createElement('section'); linha.className = 'cr-cur-pedido';
    const sp = caso.sp, rot = [sp.formato, ['curto', 'médio', 'longo', 'extremo'][caso.pedido.t.indexOf(sp.titulo)] || '', sp.foto ? 'com foto' : '', sp.marca === 'much' ? 'much+' : ''].filter(Boolean).join(' · ');
    linha.innerHTML = '<header><b>' + gEsc(caso.pedido.id) + '</b> <span>' + gEsc(rot) + '</span><p>' + gEsc(caso.pedido.pedido) + '</p></header><div class="cr-cur-ops"><span class="cr-cur-gerando">Gerando…</span></div>';
    lista.appendChild(linha);
    let tres = [];
    try{ const b = await crBuscar(caso.sp); tres = crEscolher3(b.cands); }catch(e){ tres = []; }
    if(rodada !== c.rodada) return;   // mudou de página no meio
    const ops = linha.querySelector('.cr-cur-ops');
    ops.innerHTML = tres.length ? '' : '<span class="cr-cur-gerando">O motor não achou opção para este pedido.</span>';
    for(const r of tres){
      const v = _crCurVoto(caso, r), card = document.createElement('article'); card.className = 'cr-cur-op'; card.dataset.chave = v.chave;
      const url = URL.createObjectURL(new Blob([await crEmbutir(r.svg)], { type: 'image/svg+xml' })); c.urls.push(url);
      if(rodada !== c.rodada) return;
      card.innerHTML = '<div class="cr-cur-arte"><img alt="' + gEsc(r.nomeReceita || r.receita) + '" src="' + url + '" style="aspect-ratio:' + r.w + '/' + r.h + '"></div>'
        + '<div class="cr-cur-info"><b>' + r.nota + '</b><span>' + gEsc(r.nomeReceita || r.receita) + '</span><small>' + gEsc(r.design ? r.design.porque : '') + '</small></div>'
        + '<div class="cr-cur-voto"><button type="button" class="cr-btn cr-btn-mini" data-ac="sim" aria-pressed="false" aria-label="Aprovar">' + _CR_CUR_ICO.sim + '</button>'
        + '<button type="button" class="cr-btn cr-btn-mini" data-ac="nao" aria-pressed="false" aria-label="Reprovar">' + _CR_CUR_ICO.nao + '</button></div>'
        + '<div class="cr-cur-motivos" role="group" aria-label="Motivo">' + CR_CUR_MOTIVOS.map(([k, t]) => '<button type="button" class="cr-cur-chip" data-ac="motivo" data-k="' + k + '" aria-pressed="false">' + t + '</button>').join('') + '</div>';
      card._voto = v;
      ops.appendChild(card);
      _crCurPinta(card);
    }
  }
}
// O voto de uma arte: tudo o que o JSON e o golden precisam, sem precisar gerar de novo
function _crCurVoto(caso, r){
  const ch = caso.id + '|' + r.familia + '|' + _crHash(r.svg).toString(36), salvo = _crCur.votos[ch];
  if(salvo) return salvo;
  const k = caso.pedido.t.indexOf(caso.sp.titulo);
  return { chave: ch, caso: caso.pedido.id, formato: caso.sp.formato, texto: k < 0 ? 0 : k, foto: !!caso.sp.foto, marca: caso.sp.marca, objetivo: r.spec.objetivo,
    receita: r.receita, familia: r.familia, nota: r.nota, partes: Object.assign({}, r.design.partes), voto: 0, motivos: [] };
}
function _crCurPinta(card){
  const v = card._voto;
  card.querySelector('[data-ac="sim"]').setAttribute('aria-pressed', v.voto > 0);
  card.querySelector('[data-ac="nao"]').setAttribute('aria-pressed', v.voto < 0);
  card.classList.toggle('cr-cur-sim', v.voto > 0); card.classList.toggle('cr-cur-nao', v.voto < 0);
  card.querySelectorAll('[data-ac="motivo"]').forEach(b => b.setAttribute('aria-pressed', v.motivos.indexOf(b.dataset.k) >= 0));
}
function _crCurConta(){
  const vs = Object.values(_crCur.votos), s = vs.filter(v => v.voto > 0).length, n = vs.filter(v => v.voto < 0).length;
  _crCur.el.querySelector('#cr-cur-conta').innerHTML = _CR_CUR_ICO.sim + ' ' + s + ' · ' + _CR_CUR_ICO.nao + ' ' + n;
}
function _crCurClique(e){
  const b = e.target.closest('[data-ac]');
  if(!b || !_crCur) return;
  const ac = b.dataset.ac, card = b.closest('.cr-cur-op');
  if(ac === 'fecha') return crCuradoriaFecha();
  if(ac === 'prox' || ac === 'ant'){
    const n = Math.ceil(_crCur.casos.length / CR_CUR_POR_PAGINA);
    _crCur.pagina = Math.max(0, Math.min(n - 1, _crCur.pagina + (ac === 'prox' ? 1 : -1)));
    return _crCurPagina();
  }
  if(ac === 'pesos') return _crCurPesosPainel();
  if(ac === 'exporta') return _crCurExporta();
  if(ac === 'aplica' || ac === 'zera'){
    const p = ac === 'aplica' ? crCuradoriaPesos(Object.values(_crCur.votos)) : null;
    _crPesosCuradoria = p ? p.pesos : null; _crCurGrava(CR_CUR_PESOS, _crPesosCuradoria);
    gToast(p ? 'Pesos aplicados neste navegador' : 'De volta aos pesos do código', 'success');
    return _crCurPesosPainel(true);
  }
  if(!card) return;
  const v = card._voto;
  if(ac === 'sim' || ac === 'nao'){ const x = ac === 'sim' ? 1 : -1; v.voto = v.voto === x ? 0 : x; if(!v.voto) v.motivos = []; }
  if(ac === 'motivo'){ const k = b.dataset.k, i = v.motivos.indexOf(k); if(i >= 0) v.motivos.splice(i, 1); else v.motivos.push(k); if(!v.voto) v.voto = -1; }
  if(v.voto) _crCur.votos[v.chave] = v; else delete _crCur.votos[v.chave];
  _crCurGrava(CR_CUR_CHAVE, _crCur.votos);
  _crCurPinta(card); _crCurConta();
}
function _crCurPesosPainel(manter){
  const pn = _crCur.el.querySelector('#cr-cur-pesos');
  if(!manter && !pn.hidden){ pn.hidden = true; return; }
  const p = crCuradoriaPesos(Object.values(_crCur.votos)), atual = _crPesosCuradoria || {};
  pn.hidden = false;
  if(!p){ pn.innerHTML = '<p>Vote em pelo menos 2 opções aprovadas e 2 reprovadas para a sugestão de pesos.</p>'; return; }
  pn.innerHTML = '<p>Com as suas ' + p.sim + ' aprovadas ' + _CR_CUR_ICO.sim + ' e ' + p.nao + ' reprovadas ' + _CR_CUR_ICO.nao + ', a nota ordena certo <b>' + Math.round(100 * p.acerto.antes) + '%</b> dos pares hoje e <b>' + Math.round(100 * p.acerto.depois) + '%</b> com os pesos sugeridos.</p>'
    + '<table><thead><tr><th>Parte</th><th>Aplicado</th><th>Sugerido</th></tr></thead><tbody>'
    + CR_CUR_MOTIVOS.map(([k, t]) => '<tr><td>' + t + '</td><td>× ' + (atual[k] || 1) + '</td><td' + (p.pesos[k] !== 1 ? ' class="cr-cur-muda"' : '') + '>× ' + p.pesos[k] + '</td></tr>').join('') + '</tbody></table>'
    + '<div class="cr-acoes"><button type="button" class="cr-btn cr-btn-mini cr-prim" data-ac="aplica">Aplicar neste navegador</button><button type="button" class="cr-btn cr-btn-mini" data-ac="zera">Voltar aos pesos do código</button></div>';
}
function _crCurExporta(){
  const vs = Object.values(_crCur.votos);
  if(!vs.length) return gToast('Nenhum voto ainda', 'error');
  const blob = new Blob([JSON.stringify(crCuradoriaExporta(vs), null, 1)], { type: 'application/json' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'luma-curadoria-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  gToast('Curadoria exportada (' + vs.length + ' votos)', 'success');
}
