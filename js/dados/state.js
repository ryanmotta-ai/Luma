/**
 * js/dados/state.js
 *
 * Módulo 3 — Dados (analytics). Estado, mocks e helpers de agregação.
 * Tudo mockado em JS (sem backend). Prefixo p* (Pedro = backend futuro).
 * Os volumes têm "shape" determinístico (PRNG seeded) mas são ancorados no
 * tempo real (Date.now()), então o dashboard sempre parece atual.
 */

let pState = {
  visao: 'overview',          // 'overview'|'templates'|'heatmap'|'franqueados'|'timeline'|'comparador'|'funil'|'geo'
  periodo: '30d',             // '7d' | '30d' | '90d'
  campFiltro: 'all',
  fmtFiltro: 'all',
  tabelaSort: { col: '_score', dir: 'desc' },
  tabelaExpandida: null,      // id do template com histórico expandido
  // ── sub-estado das seções de análise (3–8) ──
  heatSel: null,              // 'sex-14' — célula selecionada do heatmap
  franqSort: { col: 'artes', dir: 'desc' },
  timelineCamp: 'all',
  timelinePagina: 1,          // "Ver mais" → +1 (10 itens por página)
  comparadorModo: 'mes',      // 'semana'|'mes'|'90d'
  geoRegiao: 'all',
  _built: false,              // shell montado?
};

/* ── constantes de domínio ── */
const P_FRANQUEADOS = [
  { id:'fr-01', nome:'Carlos Mendes' }, { id:'fr-02', nome:'Ana Beatriz' },
  { id:'fr-03', nome:'João Pedro' },    { id:'fr-04', nome:'Mariana Silva' },
  { id:'fr-05', nome:'Rafael Costa' },  { id:'fr-06', nome:'Juliana Souza' },
  { id:'fr-07', nome:'Bruno Almeida' }, { id:'fr-08', nome:'Patrícia Lima' },
];
const P_CAMPANHAS = [
  { id:'hamburguer-fest', nome:'Hamburguer Fest' },
  { id:'combao',          nome:'Combão com Desconto' },
  { id:'entrega-gratis',  nome:'Entrega Grátis' },
  { id:'cupons',          nome:'Aqui Tem Cupons' },
  { id:'promo-turbinada', nome:'Promo Turbinada' },
  { id:'novo-app',        nome:'Lançamento Novo App' },
];
const P_FMT_LABEL = { story:'Story', feed:'Feed', wide:'Wide' };
const P_FMT_COLOR = { story:'#FF9000', feed:'#FFB900', wide:'#7C6EFF' };

/* ── PRNG determinístico (mulberry32) ── */
function pRng(seed){
  return function(){
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── helpers de data ── */
const P_DAY = 86400000;
function pNow(){ return Date.now(); }
function pDayStart(ts){ const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime(); }
function pPeriodDays(periodo){ return periodo === '7d' ? 7 : periodo === '90d' ? 90 : 30; }
function pFmtDM(ts){ const d = new Date(ts); return ('0'+d.getDate()).slice(-2) + '/' + ('0'+(d.getMonth()+1)).slice(-2); }
function pFmtNum(n){ return (n||0).toLocaleString('pt-BR'); }
function pFmtPct(n){ return (Math.round((n||0)*10)/10).toString().replace('.', ',') + '%'; }

/* ══ TEMPLATES (14) — performance hardcoded p/ controlar casos de borda ══
   - tmpl-001 e tmpl-012 com tendência negativa (usos7d < usos7d_anterior)
   - tmpl-005 com score alto (>85): muito uso + alta conclusão
   - tmpl-009 com conclusão < 40% (problema de UX)
   historico (30 dias de usos diários) é gerado no boot (pBuildMocks). */
const P_TEMPLATES = [
  { id:'tmpl-001', nome:'Promoção Story',        campId:'hamburguer-fest', campNome:'Hamburguer Fest',     fmt:'story', usos:47, downloads:39, usos7d:8,  downloads7d:6,  usos7d_anterior:13 },
  { id:'tmpl-002', nome:'Combo Feed Quadrado',   campId:'combao',          campNome:'Combão com Desconto', fmt:'feed',  usos:38, downloads:29, usos7d:11, downloads7d:9,  usos7d_anterior:9  },
  { id:'tmpl-003', nome:'Banner Wide Topo',      campId:'entrega-gratis',  campNome:'Entrega Grátis',      fmt:'wide',  usos:21, downloads:14, usos7d:5,  downloads7d:4,  usos7d_anterior:5  },
  { id:'tmpl-004', nome:'Story Entrega Free',    campId:'entrega-gratis',  campNome:'Entrega Grátis',      fmt:'story', usos:44, downloads:36, usos7d:14, downloads7d:12, usos7d_anterior:10 },
  { id:'tmpl-005', nome:'Cupom Destaque',        campId:'cupons',          campNome:'Aqui Tem Cupons',     fmt:'story', usos:62, downloads:57, usos7d:18, downloads7d:17, usos7d_anterior:14 },
  { id:'tmpl-006', nome:'Feed Cupom Duplo',      campId:'cupons',          campNome:'Aqui Tem Cupons',     fmt:'feed',  usos:33, downloads:24, usos7d:9,  downloads7d:7,  usos7d_anterior:8  },
  { id:'tmpl-007', nome:'Turbo Story',           campId:'promo-turbinada', campNome:'Promo Turbinada',     fmt:'story', usos:51, downloads:43, usos7d:15, downloads7d:13, usos7d_anterior:12 },
  { id:'tmpl-008', nome:'Turbo Wide',            campId:'promo-turbinada', campNome:'Promo Turbinada',     fmt:'wide',  usos:18, downloads:12, usos7d:4,  downloads7d:3,  usos7d_anterior:4  },
  { id:'tmpl-009', nome:'App Novo — Hero',       campId:'novo-app',        campNome:'Lançamento Novo App', fmt:'story', usos:34, downloads:11, usos7d:10, downloads7d:3,  usos7d_anterior:9  },
  { id:'tmpl-010', nome:'App Novo — Feed',       campId:'novo-app',        campNome:'Lançamento Novo App', fmt:'feed',  usos:27, downloads:19, usos7d:7,  downloads7d:5,  usos7d_anterior:6  },
  { id:'tmpl-011', nome:'Hamburguer Combo Feed', campId:'hamburguer-fest', campNome:'Hamburguer Fest',     fmt:'feed',  usos:41, downloads:33, usos7d:12, downloads7d:10, usos7d_anterior:11 },
  { id:'tmpl-012', nome:'Combão Wide Promo',     campId:'combao',          campNome:'Combão com Desconto', fmt:'wide',  usos:23, downloads:16, usos7d:3,  downloads7d:2,  usos7d_anterior:8  },
  { id:'tmpl-013', nome:'Hamburguer Story Mega', campId:'hamburguer-fest', campNome:'Hamburguer Fest',     fmt:'story', usos:55, downloads:46, usos7d:16, downloads7d:14, usos7d_anterior:15 },
  { id:'tmpl-014', nome:'Cupom Wide Banner',     campId:'cupons',          campNome:'Aqui Tem Cupons',     fmt:'wide',  usos:16, downloads:9,  usos7d:4,  downloads7d:3,  usos7d_anterior:3  },
  { id:'tmpl-015', nome:'Banner Desconto Inativo', campId:'combao',          campNome:'Combão com Desconto', fmt:'wide',  usos:0,  downloads:0,  usos7d:0,  downloads7d:0,  usos7d_anterior:0  },
  { id:'tmpl-016', nome:'Black Friday Flyer',      campId:'promo-turbinada', campNome:'Promo Turbinada',     fmt:'feed',  usos:0,  downloads:0,  usos7d:0,  downloads7d:0,  usos7d_anterior:0  },
];

/* ══ ARTES GERADAS (≈200) — geradas no boot ══ */
let P_MOCK_ARTES = [];

function pBuildMocks(){
  if(P_MOCK_ARTES.length) return; // idempotente

  // 1) histórico de 30 dias por template (shape com picos de fim de semana)
  P_TEMPLATES.forEach((t, ti)=>{
    const rnd = pRng(1000 + ti * 7);
    const base = Math.max(1, Math.round(t.usos / 16));
    const hist = [];
    for(let d = 29; d >= 0; d--){
      const dow = (new Date(pNow() - d * P_DAY)).getDay(); // 0=dom..6=sáb
      const weekend = (dow === 5 || dow === 6) ? 1.7 : 1;
      const recencia = 0.6 + (29 - d) / 29 * 0.8; // produto crescendo
      hist.push(Math.max(0, Math.round(base * weekend * recencia * (0.5 + rnd()))));
    }
    t.historico = hist;
  });

  // 2) 200 artes nos últimos 90 dias, ponderadas (recência + fim de semana)
  const rnd = pRng(98765);
  const N = 200, now = pNow();
  // pesos por dia (0..89 atrás)
  const weights = [];
  let total = 0;
  for(let d = 0; d < 90; d++){
    const dow = (new Date(now - d * P_DAY)).getDay();
    const weekend = (dow === 5 || dow === 6) ? 2.0 : 1;
    const recencia = d < 14 ? 2.4 : d < 30 ? 1.3 : 0.7; // pico nas últimas 2 semanas
    const w = weekend * recencia;
    weights.push(w); total += w;
  }
  let n = 0;
  for(let i = 0; i < N; i++){
    // sorteia um dia conforme os pesos
    let r = rnd() * total, d = 0;
    while(r > weights[d] && d < 89){ r -= weights[d]; d++; }
    const dayStart = pDayStart(now - d * P_DAY);
    const ts = dayStart + Math.floor(rnd() * P_DAY);
    // formato ~60/30/10 → escolhe um template do formato
    const fr2 = rnd();
    const fmt = fr2 < 0.6 ? 'story' : fr2 < 0.9 ? 'feed' : 'wide';
    const pool = P_TEMPLATES.filter(t => t.fmt === fmt);
    const tmpl = pool[Math.floor(rnd() * pool.length)] || P_TEMPLATES[0];
    const fr = P_FRANQUEADOS[Math.floor(rnd() * P_FRANQUEADOS.length)];
    const status = rnd() < 0.70 ? 'baixada' : 'rascunho';
    P_MOCK_ARTES.push({
      id: 'arte-' + ('00' + (++n)).slice(-3),
      ts,
      franqueadoId: fr.id, franqueadoNome: fr.nome,
      campId: tmpl.campId, campNome: tmpl.campNome,
      templateId: tmpl.id, templateNome: tmpl.nome,
      fmtId: fmt, status,
    });
  }
  P_MOCK_ARTES.sort((a, b) => a.ts - b.ts);
}

/* ══ AGREGAÇÕES ══ */
// Artes no período atual (últimos N dias)
function pArtesNoPeriodo(periodo){
  const days = pPeriodDays(periodo);
  const min = pDayStart(pNow()) - (days - 1) * P_DAY;
  return P_MOCK_ARTES.filter(a => a.ts >= min);
}
// Artes no período anterior (janela imediatamente antes, mesmo tamanho)
function pArtesPeriodoAnterior(periodo){
  const days = pPeriodDays(periodo);
  const fim = pDayStart(pNow()) - (days - 1) * P_DAY;
  const ini = fim - days * P_DAY;
  return P_MOCK_ARTES.filter(a => a.ts >= ini && a.ts < fim);
}
// Série diária: array {ts, label, count} dos últimos `days` dias
function pSerieDiaria(artes, days, endTs){
  const today = (endTs != null) ? pDayStart(endTs) : pDayStart(pNow()); // âncora opcional p/ janela anterior
  const buckets = [];
  for(let i = days - 1; i >= 0; i--){
    const ds = today - i * P_DAY;
    buckets.push({ ts: ds, label: pFmtDM(ds), count: 0 });
  }
  const idxByDay = {};
  buckets.forEach((b, i) => { idxByDay[b.ts] = i; });
  artes.forEach(a => { const k = pDayStart(a.ts); if(idxByDay[k] != null) buckets[idxByDay[k]].count++; });
  return buckets;
}
function pPorCampanha(artes){
  const m = {};
  artes.forEach(a => {
    if(!m[a.campNome]){
      m[a.campNome] = { count: 0, id: a.campId };
    }
    m[a.campNome].count++;
  });
  return Object.keys(m).map(nome => ({ nome, id: m[nome].id, count: m[nome].count })).sort((a, b) => b.count - a.count);
}
function pPorFormato(artes){
  const m = { story:0, feed:0, wide:0 };
  artes.forEach(a => { if(m[a.fmtId] != null) m[a.fmtId]++; });
  return m;
}
function pFranqueadosAtivos(artes){
  return new Set(artes.map(a => a.franqueadoId)).size;
}
function pCampanhaTop(artes){
  const c = pPorCampanha(artes);
  return c.length ? c[0].nome : '—';
}
function pTaxaDownload(artes){
  if(!artes.length) return 0;
  const baixadas = artes.filter(a => a.status === 'baixada').length;
  return baixadas / artes.length * 100;
}
// variação % e direção entre dois valores
function pDelta(cur, prev){
  if(!prev) return { pct: cur ? 100 : 0, dir: cur ? 'up' : 'flat' };
  const pct = (cur - prev) / prev * 100;
  return { pct: Math.abs(pct), dir: pct > 1 ? 'up' : pct < -1 ? 'down' : 'flat' };
}

/* ══ TEMPLATES: score / conclusão / tendência ══ */
function pConclusao(t){ return t.usos ? t.downloads / t.usos : 0; } // 0..1
function pScore(t, maxUsos){
  const conc = pConclusao(t);                 // 0..1
  const usosNorm = maxUsos ? t.usos / maxUsos : 0; // 0..1
  return Math.round(conc * 60 + usosNorm * 40);
}
function pTendencia(t){
  const a = t.usos7d, b = t.usos7d_anterior || 0;
  if(b === 0) return a > 0 ? 'up' : 'flat';
  const diff = (a - b) / b;
  return diff > 0.08 ? 'up' : diff < -0.08 ? 'down' : 'flat';
}
// templates filtrados (campanha + formato) com score calculado sobre o conjunto filtrado
function pTemplatesFiltrados(){
  let arr = P_TEMPLATES.slice();
  if(pState.campFiltro !== 'all') arr = arr.filter(t => t.campId === pState.campFiltro);
  if(pState.fmtFiltro !== 'all') arr = arr.filter(t => t.fmt === pState.fmtFiltro);
  const maxUsos = arr.reduce((mx, t) => Math.max(mx, t.usos), 0);
  return arr.map(t => ({
    ...t,
    _conc: pConclusao(t),
    _score: pScore(t, maxUsos),
    _trend: pTendencia(t),
  }));
}

/* ════════════════════════════════════════════════════════════════════
   MOCKS + HELPERS DAS SEÇÕES DE ANÁLISE (3–8)
   Tudo derivado do P_MOCK_ARTES quando faz sentido (heatmap/franqueados/
   comparador) ou mock dedicado seeded (timeline/funil/geo). Sem backend.
   ════════════════════════════════════════════════════════════════════ */

/* tempo relativo legível ("hoje" / "ontem" / "há N dias") */
function pHaTempo(ts){
  if(!ts) return '—';
  const dias = Math.floor((pDayStart(pNow()) - pDayStart(ts)) / P_DAY);
  if(dias <= 0) return 'hoje';
  if(dias === 1) return 'ontem';
  if(dias < 30) return 'há ' + dias + ' dias';
  const m = Math.floor(dias / 30);
  return 'há ' + m + (m === 1 ? ' mês' : ' meses');
}

/* cor por campanha (pills/legendas das seções novas) */
const P_CAMP_COLOR = {
  'hamburguer-fest':'#FF9000', 'combao':'#22C55E', 'entrega-gratis':'#3B82F6',
  'cupons':'#8B5CF6', 'promo-turbinada':'#EC4899', 'novo-app':'#F59E0B',
};

/* ── SEÇÃO 3 · HEATMAP (7 dias × 24 horas) ── */
const P_DIAS = ['seg','ter','qua','qui','sex','sab','dom'];
const P_DIAS_LBL = { seg:'Seg', ter:'Ter', qua:'Qua', qui:'Qui', sex:'Sex', sab:'Sáb', dom:'Dom' };
let P_MOCK_HEATMAP = null;
// shape realista: zero 00–06h; pico sextas 12–15h e sábados 10–13h; dom/seg-cedo fracos.
function pBuildHeatmap(){
  if(P_MOCK_HEATMAP) return P_MOCK_HEATMAP;
  const rnd = pRng(424242), m = {};
  P_DIAS.forEach(d => {
    for(let h = 0; h < 24; h++){
      let base = 0;
      if(h >= 7){
        base = Math.max(0, 3 - Math.abs(h - 13) / 3);   // curva diurna (pico ~13h)
        if(d === 'sex' && h >= 12 && h <= 15) base += 3.8;
        if(d === 'sab' && h >= 10 && h <= 13) base += 3.2;
        if(d === 'dom') base *= 0.5;
        if(d === 'seg' && h < 10) base *= 0.4;
      }
      const v = Math.max(0, Math.round(base * (0.5 + rnd())));
      if(v > 0) m[d + '-' + h] = v;
    }
  });
  P_MOCK_HEATMAP = m;
  return m;
}
function pHeatGet(d, h){ return pBuildHeatmap()[d + '-' + h] || 0; }
function pHeatResumo(){
  const m = pBuildHeatmap();
  let pico = { v: -1, d: 'sex', h: 14 };
  const porDia = {}, porHora = {};
  P_DIAS.forEach(d => porDia[d] = 0);
  for(let h = 0; h < 24; h++) porHora[h] = 0;
  Object.keys(m).forEach(k => {
    const [d, hs] = k.split('-'), h = +hs, v = m[k];
    if(v > pico.v) pico = { v, d, h };
    porDia[d] += v; porHora[h] += v;
  });
  const diaTop = Object.keys(porDia).reduce((a, b) => porDia[b] > porDia[a] ? b : a, 'seg');
  const horaTop = Object.keys(porHora).reduce((a, b) => porHora[b] > porHora[a] ? b : a, '0');
  return { pico, diaTop, horaTop: +horaTop };
}
// breakdown determinístico de uma célula (p/ o painel de detalhe ao clicar)
function pHeatDetalhe(d, h){
  const total = pHeatGet(d, h);
  if(!total) return { total: 0, camps: [], franqs: [] };
  const rnd = pRng(d.charCodeAt(0) * 131 + h * 17 + 7);
  const pick = (arr, n) => {
    const pool = arr.slice(), out = [];
    for(let i = 0; i < n && pool.length; i++) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    return out;
  };
  // reparte o total entre 1–3 campanhas e 1–3 franqueados
  const reparte = (itens) => {
    let resto = total;
    return itens.map((it, i) => {
      const q = i === itens.length - 1 ? resto : Math.max(1, Math.round(total / itens.length * (0.6 + rnd() * 0.8)));
      const n = Math.min(resto, q); resto -= n;
      return { nome: it, n };
    }).filter(x => x.n > 0).sort((a, b) => b.n - a.n);
  };
  const camps = reparte(pick(P_CAMPANHAS, Math.min(3, Math.max(1, total))).map(c => c.nome));
  const franqs = reparte(pick(P_FRANQUEADOS, Math.min(3, Math.max(1, total))).map(f => f.nome));
  return { total, camps, franqs };
}

// agrega estatísticas gerais dos últimos 30 dias para o estado inicial
function pHeatOverallDetail(){
  const artes = pArtesNoPeriodo('30d');
  const total = artes.length;
  
  const campMap = {};
  const franqMap = {};
  
  artes.forEach(a => {
    campMap[a.campNome] = (campMap[a.campNome] || 0) + 1;
    franqMap[a.franqueadoNome] = (franqMap[a.franqueadoNome] || 0) + 1;
  });
  
  const camps = Object.keys(campMap).map(nome => ({
    nome: nome,
    n: campMap[nome]
  })).sort((a, b) => b.n - a.n).slice(0, 5);
  
  const franqs = Object.keys(franqMap).map(nome => ({
    nome: nome,
    n: franqMap[nome]
  })).sort((a, b) => b.n - a.n).slice(0, 5);
  
  return { total, camps, franqs };
}


/* ── SEÇÃO 4 · RANKING DE FRANQUEADOS (derivado do P_MOCK_ARTES) ── */
function pFranqStats(periodo){
  const artes = pArtesNoPeriodo(periodo);
  const prev = pArtesPeriodoAnterior(periodo);
  const linha = (f, fonte) => {
    const meus = fonte.filter(a => a.franqueadoId === f.id);
    const downloads = meus.filter(a => a.status === 'baixada').length;
    return {
      id: f.id, nome: f.nome,
      artes: meus.length,
      camps: new Set(meus.map(a => a.campId)).size,
      downloads,
      taxa: meus.length ? downloads / meus.length * 100 : 0,
      lastTs: meus.length ? Math.max.apply(null, meus.map(a => a.ts)) : 0,
    };
  };
  const stats = P_FRANQUEADOS.map(f => linha(f, artes));
  const prevStats = P_FRANQUEADOS.map(f => linha(f, prev));
  const rankBy = arr => arr.slice().sort((a, b) => b.artes - a.artes).map(x => x.id);
  const curRank = rankBy(stats), prevRank = rankBy(prevStats);
  const maxArtes = Math.max(1, ...stats.map(s => s.artes));
  stats.forEach(s => {
    s.pos = curRank.indexOf(s.id) + 1;
    const pp = prevRank.indexOf(s.id) + 1;
    s.posDelta = pp > 0 ? pp - s.pos : 0;          // +N subiu, -N caiu
    const diasInativo = s.lastTs ? Math.floor((pDayStart(pNow()) - pDayStart(s.lastTs)) / P_DAY) : 999;
    s.status = (s.artes === 0 || diasInativo > 15) ? 'inativo'
             : (s.pos <= 2 && s.artes >= maxArtes * 0.6) ? 'top' : 'ativo';
  });
  return stats;
}

/* ── SEÇÃO 5 · TIMELINE DE PUBLICAÇÕES (mock seeded, 20 itens em 60d) ── */
const P_DESIGNERS = ['Ryan', 'Marina Alves', 'Studio DM'];
let P_MOCK_PUBS = null;
function pBuildPubs(){
  if(P_MOCK_PUBS) return P_MOCK_PUBS;
  const rnd = pRng(70707), now = pNow(), arr = [];
  for(let i = 0; i < 20; i++){
    const t = P_TEMPLATES[Math.floor(rnd() * P_TEMPLATES.length)];
    const diasAtras = Math.floor(rnd() * 60);
    const ts = pDayStart(now - diasAtras * P_DAY) + Math.floor((9 + rnd() * 9) * 3600000);
    const usosDesde = Math.max(1, Math.round(t.usos * (0.3 + rnd() * 0.7) * (1 - diasAtras / 90)));
    const temVal = rnd() < 0.4;
    const expiraTs = temVal ? ts + Math.floor(3 + rnd() * 22) * P_DAY : null;

    // Simula lote de tempos em tempos (ex: i = 5 vira um lote de 4 peças idênticas)
    if(i === 5) {
      const batchId = 'batch-101';
      for(let k = 0; k < 4; k++) {
        arr.push({
          id: 'pub-' + i + '-' + k, ts, templateNome: t.nome, fmt: t.fmt,
          campId: t.campId, campNome: t.campNome,
          autor: P_DESIGNERS[Math.floor(rnd() * P_DESIGNERS.length)],
          usosDesde: Math.round(usosDesde * (0.8 + rnd() * 0.4)), expiraTs,
          batchId,
          batchNum: k + 1,
          batchTotal: 4
        });
      }
      continue;
    }

    arr.push({
      id: 'pub-' + i, ts, templateNome: t.nome, fmt: t.fmt,
      campId: t.campId, campNome: t.campNome,
      autor: P_DESIGNERS[Math.floor(rnd() * P_DESIGNERS.length)],
      usosDesde, expiraTs,
    });
  }
  arr.sort((a, b) => b.ts - a.ts);                 // cronológico reverso
  P_MOCK_PUBS = arr;
  return arr;
}
function pPubsFiltradas(camp){
  const arr = pBuildPubs();
  return camp && camp !== 'all' ? arr.filter(p => p.campId === camp) : arr;
}

/* ── SEÇÃO 6 · COMPARADOR — usa pSerieDiaria/pArtes* já existentes ── */
function pComparadorDias(modo){ return modo === 'semana' ? 7 : modo === '90d' ? 90 : 30; }
// série diária de "downloads" (status baixada) — complementa pSerieDiaria (artes)
function pSerieDownloads(artes, days){
  const s = pSerieDiaria(artes.filter(a => a.status === 'baixada'), days);
  return s;
}

/* ── SEÇÃO 7 · FUNIL DE CONVERSÃO (mock fixo; insight calculado) ── */
const P_MOCK_FUNIL = [
  { etapa: 'Campanha selecionada', n: 847, tempo: 12 },
  { etapa: 'Material escolhido',   n: 791, tempo: 18 },
  { etapa: 'Respondeu pergunta 1', n: 756, tempo: 29 },
  { etapa: 'Respondeu tudo',       n: 634, tempo: 41 },
  { etapa: 'Confirmou os dados',   n: 601, tempo: 15 },
  { etapa: 'Arte gerada',          n: 589, tempo: 204 }, // Alto tempo gasto na edição do canvas (Fricção)
  { etapa: 'Arte baixada',         n: 498, tempo: 8 },
];
// maior queda relativa entre etapas consecutivas (insight automático)
function pFunilInsight(){
  let worst = { drop: -1 };
  for(let i = 1; i < P_MOCK_FUNIL.length; i++){
    const a = P_MOCK_FUNIL[i - 1], b = P_MOCK_FUNIL[i];
    const drop = a.n ? (a.n - b.n) / a.n : 0;
    if(drop > worst.drop) worst = { drop, pct: drop * 100, de: a.etapa, para: b.etapa, perdidos: a.n - b.n };
  }
  return worst;
}

/* ── SEÇÃO 8 · DISTRIBUIÇÃO GEOGRÁFICA (5 regiões + ranking de estados) ── */
const P_REGIOES = {
  'Sul':          ['SC','RS','PR'],
  'Sudeste':      ['SP','MG','RJ','ES'],
  'Nordeste':     ['BA','PE','CE','MA','RN'],
  'Centro-Oeste': ['GO','MT','MS','DF'],
  'Norte':        ['AM','PA','TO'],
};
const P_UF_NOME = {
  SC:'Santa Catarina', RS:'Rio Grande do Sul', PR:'Paraná', SP:'São Paulo', MG:'Minas Gerais',
  RJ:'Rio de Janeiro', ES:'Espírito Santo', BA:'Bahia', PE:'Pernambuco', CE:'Ceará',
  MA:'Maranhão', RN:'Rio Grande do Norte', GO:'Goiás', MT:'Mato Grosso', MS:'Mato Grosso do Sul',
  DF:'Distrito Federal', AM:'Amazonas', PA:'Pará', TO:'Tocantins',
};
// distribuição realista da rede DM (HQ em Florianópolis → SC no topo; Sul/Sudeste pesados)
const P_MOCK_GEO = {
  SC:142, RS:96, PR:88, SP:81, MG:54, RJ:37, GO:29, BA:24, ES:21, PE:18,
  CE:15, MS:13, DF:12, MT:10, RN:8, MA:7, AM:6, PA:5, TO:4,
};
// Metas/Adoção Esperada por Região (Exemplo: Festival de Inverno alta no Sul, Verão no Nordeste)
const P_GEO_METAS = {
  SC: 0.95, RS: 0.90, PR: 0.88, SP: 0.82, MG: 0.78, RJ: 0.75, GO: 0.70, ES: 0.68, MS: 0.65, DF: 0.62, MT: 0.60, PR_n: 0.80,
  BA: 0.40, PE: 0.38, CE: 0.35, RN: 0.30, MA: 0.28, AM: 0.20, PA: 0.18, TO: 0.15
};

function pGeoUFRegiao(uf){
  for(const r in P_REGIOES) if(P_REGIOES[r].indexOf(uf) >= 0) return r;
  return '—';
}
function pGeoTotal(regiao){
  return Object.keys(P_MOCK_GEO).reduce((s, uf) =>
    s + ((!regiao || regiao === 'all' || pGeoUFRegiao(uf) === regiao) ? P_MOCK_GEO[uf] : 0), 0);
}
function pGeoRanking(regiao){
  return Object.keys(P_MOCK_GEO)
    .filter(uf => !regiao || regiao === 'all' || pGeoUFRegiao(uf) === regiao)
    .map(uf => ({ uf, nome: P_UF_NOME[uf] || uf, regiao: pGeoUFRegiao(uf), n: P_MOCK_GEO[uf] }))
    .sort((a, b) => b.n - a.n);
}
function pGeoPorRegiao(){
  const m = {}; Object.keys(P_REGIOES).forEach(r => m[r] = 0);
  Object.keys(P_MOCK_GEO).forEach(uf => { const r = pGeoUFRegiao(uf); if(m[r] != null) m[r] += P_MOCK_GEO[uf]; });
  return m;
}

/* ── NOVAS MÉTRICAS E MOCKS DO MÓDULO DE DADOS ── */
function pGetTempoMedioCriacao(periodo) {
  return periodo === '7d' ? 98 : periodo === '90d' ? 114 : 105; // em segundos
}
function pGetHealthScore(periodo) {
  return periodo === '7d' ? 91 : periodo === '90d' ? 84 : 88; // em %
}
function pGetLatenciaFila() {
  return 1.2; // em segundos
}
function pGetInsightsFeed(periodo) {
  return [
    { type: 'success', text: 'Campanha "Lançamento Novo App" atingiu 100% de adoção nas praças ativas.' },
    { type: 'warning', text: 'Taxa de abandono de 38% detectada nos templates de story da região Sudeste.' },
    { type: 'info', text: 'Volume de publicações diárias aumentou 14,2% em relação aos últimos 30 dias.' },
    { type: 'info', text: 'Templates do tipo Feed são os preferidos para ações rápidas de WhatsApp.' }
  ];
}
