/**
 * js/franqueado/motion-estudio.js
 *
 * O ESTÚDIO DE MOTION — a espera do "Virar motion" vira um motion designer trabalhando
 * (30/10/2026, pedido do Ryan; 1º mockup: docs/mockups/story-animado-motion-designer.html)
 * ---------------------------------------------------------------------------
 * Antes, quem pedia o vídeo encarava um aviso de "não saia" por 10–40 s. Agora a arte voa do
 * card para o centro da tela, PRONTA E PARADA, e as interfaces de trabalho se formam FLUTUANDO em
 * volta dela (Peças à esquerda, Movimento à direita, Timeline embaixo), com o app visível atrás.
 * Um cursor trabalha: seleciona a peça na lista (a seleção aparece sobre a arte), escolhe o
 * efeito (a curva se desenha), a barra entra na timeline, a peça dá um brilho. Só no fim a arte
 * ganha vida — é o MP4 de verdade tocando no lugar dela —, os painéis são sugados para dentro e
 * ela voa para o mockup (celular do palco, ou o card), que pula e solta faíscas.
 *
 * ⛔ SEGUNDA VERSÃO, NO MESMO DIA (Ryan: "muito lento, travado, o mouse está feio, ocupar a tela
 * toda eu sou contra"). A 1ª desenhava as peças num canvas a cada quadro, na MESMA thread do
 * encoder: cada quadro de vídeo caro congelava o teatro. Agora todo movimento é Web Animations
 * de transform/opacity, que o compositor toca sozinho mesmo com a thread presa; o JS só dispara
 * um passo de cada vez. E a arte é desenhada UMA vez (antes eram N sprites).
 *
 * ⛔ NADA AQUI É INVENTADO. As peças, os nomes, os efeitos e os tempos saem do `_fMotionPlano`
 * (motion.js); a arte do centro é o quadro final do motor único (`fRenderTemplateLayers` com
 * `resolvido:true`). A barra verde da timeline é o render real.
 *
 * ⛔ AO VIVO. O ritmo persegue o TEMPO ESTIMADO do render (custo medido de um quadro em
 * movimento e de um parado), não a contagem de quadros: os parados do fim voam. Adiantado, o
 * designer desacelera e, se acabar antes, revisa a timeline até a gravação terminar; atrasado
 * quando o vídeo fica pronto, aplica o resto de uma vez — o teatro nunca segura a entrega.
 *
 * O vídeo pronto mora em `_fMotionVideos[snapId]` e o mockup o mostra no lugar do canvas
 * (`fMotionMontaNoSlot`, chamado pelo `_fPostedMountArt` a cada troca de ambiente).
 * Movimento reduzido: o estúdio abre igual (é o conteúdo pedido); boia, voo, mola e faíscas saem.
 *
 * API: fMotionEstudio(origem, arte) → { prepara, progresso, entrega, falha }
 *      fMotionMontaNoSlot(holder, video?) · fMotionDestino(snapId)
 * Depende de: motion.js (_fMoSuave, _fMoAssenta, F_MOTION_SEG, F_MOTION_FPS),
 *   png-generator.js (fRenderTemplateLayers), live-preview.js (_fPostedCardAtual, _fLpMotionMs,
 *   _fLpMotionEase).
 */

let _fMotionVideos = {};   // snapId → { blob, fname, url } — o vídeo pronto de cada card

const _F_ME_EFEITO = { marca: 'Aparecer', titulo: 'Crescer e endireitar', texto: 'Do lado onde mora', foto: 'Deslizar e assentar',
  painel: 'Subir', forma: 'Chegar', faixa: 'Entrar pela borda', adesivo: 'Pop com giro', revela: 'Revelar por dentro', legal: 'Aparecer no fim' };
const _F_ME_NOME = { marca: 'Marca', titulo: 'Título', texto: 'Texto', foto: 'Foto', painel: 'Painel', forma: 'Forma',
  faixa: 'Faixa', adesivo: 'Selo', revela: 'Foto no card', legal: 'Texto legal' };
// Com mais peças que isto, as menos importantes viram um item "Detalhes" (um gesto só): 20 peças
// em fila fariam o designer correr no PC rápido, e a timeline não caberia em volta da arte.
const _F_ME_PRIO = { titulo: 1, texto: 2, foto: 2, painel: 3, forma: 4, faixa: 4, revela: 4, marca: 5, adesivo: 6, legal: 7 };
const _F_ME_MAX = 9;

const _F_ME_CSS = ':host{position:fixed;inset:0;z-index:9000;font-family:Roboto,system-ui,sans-serif;color:var(--d-text);-webkit-font-smoothing:antialiased;pointer-events:none}'
  // O app continua à vista: um véu leve, não um editor de parede a parede
  + '.ve{position:absolute;inset:0;background:rgba(10,12,16,.42);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);opacity:0;pointer-events:auto}'
  + '.pn,.status{position:absolute;left:0;top:0;box-sizing:border-box;background:color-mix(in srgb,var(--d-surf) 94%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);'
  + 'border:1px solid var(--d-border2);border-radius:14px;box-shadow:0 18px 44px rgba(0,0,0,.38),0 2px 6px rgba(0,0,0,.2);opacity:0;pointer-events:auto}'
  // A boia: cada painel flutua no seu tempo. `translate` (a propriedade) para não brigar com o
  // transform das entradas/saídas, que é Web Animations.
  + '.boia{animation:boia 5.6s ease-in-out infinite alternate}.boia.b2{animation-duration:6.4s;animation-delay:-2s}.boia.b3{animation-duration:7.2s;animation-delay:-4s}'
  + '@keyframes boia{from{translate:0 -3px}to{translate:0 3px}}'
  + '.status{display:flex;align-items:center;gap:10px;padding:8px 8px 8px 14px;border-radius:999px;white-space:nowrap;max-width:calc(100vw - 24px)}'
  + '.ponto{width:8px;height:8px;border-radius:50%;background:var(--dm-orange);flex:none;animation:pulsa 1.6s var(--ease-standard) infinite}'
  + '@keyframes pulsa{0%{box-shadow:0 0 0 0 rgba(255,144,0,.55)}70%,100%{box-shadow:0 0 0 8px rgba(255,144,0,0)}}'
  + '.fase{font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis}.sub{font-size:12px;color:var(--d-text3);overflow:hidden;text-overflow:ellipsis}'
  + '.pct{font:600 12px ui-monospace,Consolas,monospace;color:var(--green);font-variant-numeric:tabular-nums;margin-left:4px}'
  + '.fechar{width:28px;height:28px;border:0;border-radius:999px;background:transparent;color:var(--d-text2);display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;transition:background var(--dur-fast) var(--ease-standard)}'
  + '.fechar:hover{background:var(--d-surf2)}.fechar:focus-visible{outline:2px solid var(--d-sel);outline-offset:2px}'
  + '.arte{position:absolute;left:0;top:0;border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.06);transform-origin:0 0}'
  + '.arte canvas,.arte video{position:absolute;inset:0;width:100%;height:100%;border-radius:14px;display:block}.arte video{object-fit:cover}'
  + '.sel{position:absolute;border:1.5px solid var(--d-sel);border-radius:3px;opacity:0;pointer-events:none;transition:opacity var(--dur-fast) var(--ease-standard)}'
  + '.sel.on{opacity:1}.sel i{position:absolute;width:7px;height:7px;background:var(--white);border:1.5px solid var(--d-sel);box-sizing:border-box;border-radius:1px}'
  + '.sel i:nth-child(1){left:-4px;top:-4px}.sel i:nth-child(2){right:-4px;top:-4px}.sel i:nth-child(3){left:-4px;bottom:-4px}.sel i:nth-child(4){right:-4px;bottom:-4px}'
  + '.sel b{position:absolute;left:-1.5px;bottom:100%;margin-bottom:5px;padding:2px 7px;border-radius:4px;background:var(--d-sel);color:var(--white);font:600 10.5px/1.4 Roboto,sans-serif;white-space:nowrap}'
  + '.sel.cima b{bottom:auto;top:100%;margin:5px 0 0}'
  + '.brilho{position:absolute;border-radius:10px;box-shadow:0 0 0 2px var(--dm-orange),0 0 24px 6px rgba(255,144,0,.45);opacity:0;pointer-events:none}'
  + '.tit{font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--d-text3);padding:11px 12px 6px}'
  + '.lista{padding:0 6px 8px;overflow:hidden}'
  + '.it{display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:8px;font-size:12px;transition:background var(--dur-fast) var(--ease-standard),color var(--dur-fast) var(--ease-standard)}'
  + '.it.alvo{background:var(--d-sel-fill);color:var(--d-text)}.it.feita{color:var(--d-text3)}'
  + '.it span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1}'
  + '.th{width:28px;height:28px;border-radius:6px;background:var(--d-surf2);flex:none;display:flex;align-items:center;justify-content:center;overflow:hidden}'
  + '.th canvas{max-width:26px;max-height:26px;display:block}'
  + '.ok{flex:none;color:var(--green);opacity:0;scale:.4;transition:opacity var(--dur-fast) var(--ease-standard),scale var(--dur-base) var(--ease-spring)}.it.feita .ok{opacity:1;scale:1}'
  + '.alvo-n{margin:0 12px 8px;padding:7px 9px;border-radius:8px;background:var(--d-surf2);font-size:11.5px;color:var(--d-text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  + '.alvo-n b{color:var(--d-text);font-weight:600}'
  + '.chips{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:0 12px}'
  + '.chip{border-radius:8px;background:var(--d-surf2);font-size:10.5px;line-height:1.25;padding:6px 7px;color:var(--d-text3);box-shadow:inset 0 0 0 1px transparent;transition:background var(--dur-fast) var(--ease-standard),color var(--dur-fast) var(--ease-standard),box-shadow var(--dur-fast) var(--ease-standard)}'
  + '.chip.on{background:var(--d-sel-fill);color:var(--d-text);box-shadow:inset 0 0 0 1.5px var(--d-sel)}'
  + '.curva{margin:10px 12px 12px;border-radius:8px;background:var(--d-surf2);padding:7px 9px}'
  + '.curva-cab{display:flex;justify-content:space-between;gap:6px;font-size:10.5px;color:var(--d-text3);margin-bottom:3px}'
  + '.curva svg{display:block;width:100%;height:52px}.curva path{fill:none;stroke:var(--dm-orange);stroke-width:2;stroke-linecap:round}.curva .grade{stroke:var(--d-border);stroke-width:1}'
  + '.tl{padding:9px 12px 10px}'
  + '.tl-cab{display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--d-text3);padding-bottom:6px}.tl-cab b{color:var(--d-text);font-weight:600}'
  + '.tc{margin-left:auto;font:500 11px ui-monospace,Consolas,monospace;font-variant-numeric:tabular-nums}'
  + '.grade-tl{display:grid;grid-template-columns:132px minmax(0,1fr)}'
  + '.nome{height:18px;display:flex;align-items:center;gap:7px;padding-right:10px;font-size:11px;color:var(--d-text3);white-space:nowrap;overflow:hidden;transition:color var(--dur-fast) var(--ease-standard)}'
  + '.nome.on{color:var(--d-text)}.nome i{width:6px;height:6px;border-radius:2px;background:currentColor;opacity:.6;flex:none}'
  + '.area{position:relative;border-left:1px solid var(--d-border)}'
  + '.regua{position:relative;height:18px;border-bottom:1px solid var(--d-border);font:500 9.5px ui-monospace,Consolas,monospace;color:var(--d-text3)}'
  + '.regua span{position:absolute;top:2px;translate:-50% 0}.cab-n{height:18px}'
  + '.cache{position:absolute;left:0;right:0;bottom:-1px;height:3px;background:var(--green);border-radius:2px;transform-origin:0 50%;transform:scaleX(0);transition:transform var(--dur-base) var(--ease-standard)}'
  + '.parado{position:absolute;top:18px;bottom:0;right:0;background:repeating-linear-gradient(135deg,rgba(255,255,255,.035) 0 6px,transparent 6px 12px)}'
  + '.faixa{position:relative;height:18px}'
  + '.bar{position:absolute;top:4px;height:10px;border-radius:4px;background:var(--d-sel);opacity:0;transform-origin:0 50%;transform:scaleX(0);transition:opacity var(--dur-fast) var(--ease-standard),transform var(--dur-slow) var(--ease-out)}'
  + '.bar.on{opacity:1;transform:none}.bar.carona{background:transparent;box-shadow:inset 0 0 0 1.5px var(--d-sel)}'
  + '.bar::before,.bar::after{content:"";position:absolute;top:50%;width:6px;height:6px;background:var(--white);rotate:45deg;translate:-50% -50%}.bar::before{left:0}.bar::after{left:100%}'
  + '.ph{position:absolute;top:0;bottom:0;left:0;width:0;pointer-events:none;transition:transform var(--dur-base) var(--ease-standard)}'
  + '.ph::before{content:"";position:absolute;top:0;bottom:0;left:0;width:1.5px;background:var(--dm-orange);translate:-50% 0}'
  + '.ph::after{content:"";position:absolute;top:1px;left:0;width:10px;height:11px;background:var(--dm-orange);translate:-50% 0;clip-path:polygon(0 0,100% 0,100% 62%,50% 100%,0 62%)}'
  // O cursor: seta cheia na cor da marca com contorno branco e etiqueta — o cursor de quem está
  // trabalhando junto (multiplayer), não o ponteiro do sistema
  + '.cur{position:absolute;left:0;top:0;z-index:5;pointer-events:none;opacity:0;transition:opacity var(--dur-base) var(--ease-standard)}'
  + '.cur svg{display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));transform-origin:3px 3px;transition:scale var(--dur-micro) var(--ease-standard)}'
  + '.cur.aperta svg{scale:.84}'
  + '.cur span{position:absolute;left:14px;top:18px;padding:3px 9px;border-radius:999px 999px 999px 4px;background:var(--dm-orange);color:var(--white);font:700 10.5px/1.3 Roboto,sans-serif;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.25)}'
  + '.voo{position:fixed;left:0;top:0;transform-origin:0 0;border-radius:12px;overflow:hidden;z-index:4;box-shadow:0 18px 40px rgba(0,0,0,.35);pointer-events:none}'
  + '.voo canvas,.voo video{display:block;width:100%;height:100%;object-fit:cover}'
  + '.faisca{position:fixed;left:0;top:0;pointer-events:none;z-index:6}'
  + '.selo-pronto{position:fixed;left:0;top:0;z-index:7;pointer-events:none;padding:6px 12px;border-radius:999px;background:var(--dm-orange);color:var(--white);font:800 12px/1.2 Roboto,sans-serif;box-shadow:0 8px 20px rgba(255,144,0,.35);white-space:nowrap}'
  + '.cel .grade-tl{grid-template-columns:86px minmax(0,1fr)}.cel .nome{font-size:10px}.cel .it{font-size:10.5px;padding:3px 4px;gap:6px}.cel .th{width:22px;height:22px}'
  + '.cel .chips{gap:4px;padding:0 8px}.cel .chip{padding:4px 5px;font-size:9.5px}.cel .sub,.cel .tl-cab span.info{display:none}'
  // No celular a arte é estreita: os painéis viram tiras finas que mal tocam a borda dela
  + '.pecas.cel .tit,.pecas.cel .it>span:nth-child(2),.pecas.cel .ok{display:none}.pecas.cel .lista{padding:6px 4px}.pecas.cel .it{justify-content:center;padding:3px}'
  + '.pecas.cel .it.feita .th{box-shadow:inset 0 0 0 1.5px var(--green)}'
  + '.insp.cel .curva{display:none}.insp.cel .tit{padding:9px 8px 5px}.insp.cel .alvo-n{margin:0 8px 6px;font-size:10.5px}.insp.cel .chips{padding-bottom:8px}'
  + '@media (prefers-reduced-motion:reduce){.boia{animation:none}}';

const _fMeTok = t => (typeof _fLpMotionMs === 'function') ? _fLpMotionMs(t) : 260;
const _fMeEase = t => (typeof _fLpMotionEase === 'function') ? _fLpMotionEase(t) : 'ease-out';
/* "Reduzir movimento" NÃO pula o estúdio: ver o designer trabalhar é o que a pessoa pediu ao
   clicar (o Windows com "Efeitos de animação" desligado manda esse sinal para todo site, e foi
   assim que o estúdio sumiu para o Ryan em 30/10). O que o modo corta são os enfeites: boia,
   voo em arco, mola e faíscas viram aparecer/esmaecer. */
const _fMeReduz = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches);
const _fMeCorta = (s, n) => s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
const _fMeVirg = v => v.toFixed(2).replace('.', ',') + ' s';
const _fMeEspera = ms => new Promise(r => setTimeout(r, Math.max(0, ms)));

// O texto que a peça mostra (sem `{{campo}}` cru), para o nome dela na lista
function _fMeTexto(u){
  const txt = u.folhas.filter(f => f.type === 'text').map(f => String(f.content || '')).join(' ').replace(/\s+/g, ' ').trim();
  return (!txt || /\{\{/.test(txt)) ? '' : txt;
}
function _fMeNomeUnidade(u){
  const base = _F_ME_NOME[u.tipo] || 'Peça', txt = _fMeTexto(u);
  if(!txt) return base;
  return u.tipo === 'texto' ? _fMeCorta(txt, 22) : base + ' · ' + _fMeCorta(txt, 16);
}

// Itens do roteiro: uma peça principal + quem pega carona nela. Com peças demais, a cauda menos
// importante vira "Detalhes" (entra num gesto só).
function _fMeItens(plano){
  const vivos = plano.filter(u => u.papel !== 'fundo');
  let itens = vivos.filter(u => !u.carona).map(u => ({ unidades: [u, ...vivos.filter(o => o.carona === u)], tipo: u.tipo }));
  if(itens.length > _F_ME_MAX){
    const ordem = itens.slice().sort((a, b) => (_F_ME_PRIO[a.tipo] || 8) - (_F_ME_PRIO[b.tipo] || 8) || a.unidades[0].ini - b.unidades[0].ini);
    const fica = new Set(ordem.slice(0, _F_ME_MAX - 1));
    const resto = itens.filter(i => !fica.has(i));
    itens = itens.filter(i => fica.has(i));
    itens.push({ unidades: resto.flatMap(i => i.unidades), tipo: 'detalhes', detalhes: resto.length });
  }
  itens.forEach(i => {
    const us = i.unidades;
    i.ini = Math.min(...us.map(u => u.ini));
    i.fim = Math.max(...us.map(u => u.ini + (u.carona || u).dur));
    i.x0 = Math.min(...us.map(u => u.x0)); i.y0 = Math.min(...us.map(u => u.y0));
    i.x1 = Math.max(...us.map(u => u.x1)); i.y1 = Math.max(...us.map(u => u.y1));
    // Contêiner com carona se chama pelo que leva: "Placa · R$ 29,90", "Faixa · PEÇA NO APP"
    const caronas = us.slice(1).filter(u => u.carona === us[0]);
    const txtCarona = caronas.map(_fMeTexto).find(Boolean);
    i.nome = i.detalhes ? 'Detalhes (' + us.length + ')'
      : caronas.some(u => u.tipo === 'marca') ? 'Marca'
      : txtCarona ? (us[0].tipo === 'forma' ? 'Placa' : _F_ME_NOME[us[0].tipo] || 'Peça') + ' · ' + _fMeCorta(txtCarona, 16)
      : _fMeNomeUnidade(us[0]);
    i.efeito = i.detalhes ? 'Vários' : _F_ME_EFEITO[us[0].tipo] || 'Chegar';
  });
  itens.sort((a, b) => a.ini - b.ini);
  // Dois "Painel" seguidos não dizem qual é qual: numera os repetidos
  const vistos = {};
  itens.forEach(i => { vistos[i.nome] = (vistos[i.nome] || 0) + 1; if(vistos[i.nome] > 1) i.nome += ' ' + vistos[i.nome]; });
  return itens;
}

function _fMeHTML(){
  const x = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  return '<div class="ve"></div>'
    + '<div class="status"><span class="ponto" aria-hidden="true"></span><span class="fase">Abrindo o estúdio</span><span class="sub"></span><span class="pct">0%</span>'
    + '<button type="button" class="fechar" aria-label="Fechar (o vídeo continua sendo gerado)" title="Fechar (o vídeo continua sendo gerado)">' + x + '</button></div>'
    + '<div class="arte"><canvas class="cv"></canvas><div class="brilho"></div><div class="sel"><i></i><i></i><i></i><i></i><b></b></div></div>'
    + '<div class="pn pecas"><div class="boia"><div class="tit">Peças da sua arte</div><div class="lista"></div></div></div>'
    + '<div class="pn insp"><div class="boia b2"><div class="tit">Movimento</div><div class="alvo-n">Nenhuma peça selecionada</div><div class="chips"></div>'
    + '<div class="curva"><div class="curva-cab"><span>Curva</span><span class="curva-nome">—</span></div><svg viewBox="0 0 100 52" preserveAspectRatio="none" aria-hidden="true"><path class="grade" d="M0 46H100M0 8H100"/><path class="cp" d=""/></svg></div></div></div>'
    + '<div class="pn tlp"><div class="boia b3 tl"><div class="tl-cab"><b>Timeline</b><span class="info">· Story · ' + F_MOTION_SEG + ' s</span><span class="tc">00:00:00</span></div>'
    + '<div class="grade-tl"><div class="nomes"><div class="cab-n"></div></div><div class="area"><div class="regua"><div class="cache"></div></div><div class="parado"></div><div class="faixas"></div><div class="ph"></div></div></div></div></div>'
    + '<div class="cur"><svg width="20" height="22" viewBox="0 0 20 22" aria-hidden="true"><path d="M3 2.5v15.2l4.3-4 2.9 6.6 2.9-1.3-2.9-6.5h6z" fill="var(--dm-orange)" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg><span>Motion · Luma</span></div>';
}

/* ── O ESTÚDIO ─────────────────────────────────────────────────────────────────── */
// origem: o canvas do card (a arte voa dele). arte: { dados, camp, material } do snapshot.
function fMotionEstudio(origem, arte){
  const host = document.createElement('div');
  host.id = 'f-motion-estudio';
  const raiz = host.attachShadow({ mode: 'open' });
  raiz.innerHTML = '<style>' + _F_ME_CSS + '</style>' + _fMeHTML();
  document.body.appendChild(host);
  const $ = s => raiz.querySelector(s);
  const SEG = F_MOTION_SEG, reduz = _fMeReduz();
  const st = { fechado: false, feito: false, frac: 0, estSeg: 0, sRot: 0, L: 1, cx: 0, cy: 0, itens: [] };
  st.prontoFeito = new Promise(r => { st.marcaFeito = r; });
  const cur = $('.cur'), cv = $('.cv'), arteEl = $('.arte'), sel = $('.sel');
  const pecas = $('.pecas'), insp = $('.insp'), tlp = $('.tlp'), status = $('.status');
  const fase = (a, b) => { $('.fase').textContent = a; $('.sub').textContent = b ? '· ' + b : ''; };

  /* ── O LUGAR DE CADA COISA ─────────────────────────────────────────────────────
     A arte no centro; os painéis em volta, sem encostar nas bordas. A timeline reserva a altura
     do máximo de linhas desde a abertura, para a arte não pular quando as peças chegarem.
     Em tela estreita os painéis laterais avançam um pouco sobre a borda da arte — ela está
     parada, e o que eles cobrem é margem. */
  const W0 = origem && origem.width || 1080, H0 = origem && origem.height || 1920;
  const L = { W: W0, H: H0 };
  function posiciona(){
    const vw = innerWidth, vh = innerHeight, cel = vw < 760;
    raiz.querySelectorAll('.pn,.status').forEach(p => p.classList.toggle('cel', cel));
    const linhas = Math.max(st.itens.length, _F_ME_MAX);
    const tlH = 52 + linhas * 18, stH = 44;
    let A = cel ? Math.min(vh * .42, 420) : Math.min(vh * .58, 600);
    A = Math.max(200, Math.min(A, vh - stH - tlH - 52));
    const aw = A * L.W / L.H, ax = (vw - aw) / 2;
    const ay = Math.max(stH + 18, (vh - (stH + 12 + A + 14 + tlH)) / 2 + stH + 12);
    Object.assign(arteEl.style, { width: aw + 'px', height: A + 'px', transform: 'translate(' + ax + 'px,' + ay + 'px)' });
    L.ax = ax; L.ay = ay; L.aw = aw; L.ah = A;
    const sw = status.offsetWidth;
    status.style.transform = 'translate(' + Math.max(12, (vw - sw) / 2) + 'px,' + (ay - stH - 10) + 'px)';
    const tw = Math.min(cel ? vw - 16 : 760, vw - 16);
    tlp.style.width = tw + 'px';
    tlp.style.transform = 'translate(' + (vw - tw) / 2 + 'px,' + Math.min(ay + A + 14, vh - tlp.offsetHeight - 8) + 'px)';
    const pw = cel ? 46 : 212, iw = cel ? 140 : 228;
    pecas.style.width = pw + 'px'; insp.style.width = iw + 'px';
    const px = cel ? Math.max(6, ax - pw - 8) : Math.max(12, ax - pw - 24);
    const ix = cel ? Math.min(vw - iw - 6, ax + aw - iw * .3) : Math.min(vw - iw - 12, ax + aw + 24);
    pecas.style.transform = 'translate(' + px + 'px,' + (ay + (cel ? 10 : 18)) + 'px)';
    insp.style.transform = 'translate(' + ix + 'px,' + (ay + (cel ? A * .34 : 18)) + 'px)';
    st.areaW = $('.area').getBoundingClientRect().width;
  }
  posiciona();

  /* ── IDA: a arte do card voa até o centro; o status aparece em cima ─────────── */
  const durBase = _fMeTok('--dur-base'), durSlow = _fMeTok('--dur-slow'), durFast = _fMeTok('--dur-fast');
  cv.width = W0; cv.height = H0;
  try{ if(origem) cv.getContext('2d').drawImage(origem, 0, 0); }catch(e){}
  $('.ve').animate([{ opacity: 0 }, { opacity: 1 }], { duration: durSlow, easing: _fMeEase('--ease-out'), fill: 'forwards' });
  const r0 = (origem && origem.getBoundingClientRect().width > 4) ? origem.getBoundingClientRect() : null;
  const fim = 'translate(' + L.ax + 'px,' + L.ay + 'px)';
  if(r0 && !reduz){
    arteEl.animate([{ transform: 'translate(' + r0.left + 'px,' + r0.top + 'px) scale(' + (r0.width / L.aw) + ')' },
      { transform: 'translate(' + L.ax + 'px,' + (L.ay - 12) + 'px) scale(1.015)', offset: .78 }, { transform: fim }],
      { duration: durSlow + durFast, easing: _fMeEase('--ease-standard') });
  } else arteEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: durBase, easing: _fMeEase('--ease-out') });
  status.animate([{ opacity: 0, translate: '0 8px' }, { opacity: 1, translate: '0 0' }], { duration: durSlow, delay: durFast, easing: _fMeEase('--ease-out'), fill: 'forwards' });

  /* ── PEÇAS DO TEATRO (tudo Web Animations: o compositor toca mesmo com a thread presa) ── */
  const caixa = el => el.getBoundingClientRect();
  function vai(x1, y1, ms){   // o cursor anda num arco suave até (x1, y1)
    const x0 = st.cx, y0 = st.cy, mx = (x0 + x1) / 2 + (y1 - y0) * .12, my = (y0 + y1) / 2 - Math.abs(x1 - x0) * .1, kf = [];
    for(let n = 0; n <= 12; n++){ const q = n / 12, v = 1 - q; kf.push({ transform: 'translate(' + (v * v * x0 + 2 * v * q * mx + q * q * x1) + 'px,' + (v * v * y0 + 2 * v * q * my + q * q * y1) + 'px)' }); }
    st.cx = x1; st.cy = y1;
    const a = cur.animate(kf, { duration: Math.max(60, ms), easing: _fMeEase('--ease-standard'), fill: 'forwards' });
    return a.finished.then(() => { cur.style.transform = kf[kf.length - 1].transform; a.cancel(); }).catch(() => {});
  }
  const centroDe = el => { const r = caixa(el); return [r.left + r.width / 2, r.top + r.height / 2]; };
  function playhead(t){ $('.ph').style.transform = 'translateX(' + (Math.max(0, Math.min(SEG, t)) / SEG * (st.areaW || 0)) + 'px)';
    const s = Math.floor(t), f = Math.floor((t - s) * F_MOTION_FPS); $('.tc').textContent = '00:' + String(s).padStart(2, '0') + ':' + String(f).padStart(2, '0'); }
  function seleciona(i){
    if(!i){ sel.classList.remove('on'); return; }
    const k = L.aw / L.W;
    Object.assign(sel.style, { left: (i.x0 * k - 3) + 'px', top: (i.y0 * k - 3) + 'px', width: ((i.x1 - i.x0) * k + 6) + 'px', height: ((i.y1 - i.y0) * k + 6) + 'px' });
    sel.classList.toggle('cima', i.y0 * k < 28);
    sel.querySelector('b').textContent = i.nome; sel.classList.add('on');
    if(!reduz) sel.animate([{ transform: 'scale(.94)' }, { transform: 'scale(1)' }], { duration: durBase, easing: _fMeEase('--ease-spring-soft') });
  }
  function brilha(i){
    if(reduz) return;
    const k = L.aw / L.W, b = $('.brilho');
    Object.assign(b.style, { left: (i.x0 * k - 4) + 'px', top: (i.y0 * k - 4) + 'px', width: ((i.x1 - i.x0) * k + 8) + 'px', height: ((i.y1 - i.y0) * k + 8) + 'px' });
    b.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'scale(1)', offset: .3 }, { opacity: 0, transform: 'scale(1.04)' }],
      { duration: durSlow + durBase, easing: _fMeEase('--ease-out') });
  }
  function curva(i){
    const u = i.unidades[0], f = (u.carona || u).tipo === 'adesivo' ? _fMoAssenta : _fMoSuave, pts = [];
    for(let n = 0; n <= 32; n++){ const x = n / 32; pts.push((x * 100).toFixed(1) + ' ' + (46 - f(x) * 38).toFixed(1)); }
    const p = $('.cp'); p.setAttribute('d', 'M' + pts.join('L'));
    const comp = p.getTotalLength(); p.style.strokeDasharray = comp;
    p.animate([{ strokeDashoffset: comp }, { strokeDashoffset: 0 }], { duration: durSlow, easing: _fMeEase('--ease-out'), fill: 'forwards' });
    $('.curva-nome').textContent = (f === _fMoAssenta ? 'Assenta' : 'Suave') + ' · ' + _fMeVirg(i.ini) + ' → ' + _fMeVirg(i.fim);
  }

  /* ── O RITMO: quanto dura cada gesto agora ───────────────────────────────────
     `escala` faz o roteiro caber no tempo estimado; `err` corrige no caminho (atrasado acelera,
     adiantado desacelera). Pronto o vídeo, só corre. */
  function ms(seg){
    const escala = st.estSeg > 0 ? st.L / Math.max(3, st.estSeg * .85) : 1;
    const err = st.frac * st.L - st.sRot;
    let vel = Math.max(.6, Math.min(3, escala * (1 + err * .3)));
    if(st.feito) vel = 3;
    st.sRot += seg;
    return seg * 1000 / vel;
  }

  async function roteiro(){
    const tot = st.itens.length, G = { vai: .4, clica: .12, ver: .3 };
    st.L = tot * (2 * G.vai + 2 * G.clica + G.ver);
    st.cx = L.ax + L.aw / 2; st.cy = L.ay + L.ah * .55;
    cur.style.transform = 'translate(' + st.cx + 'px,' + st.cy + 'px)';
    cur.style.opacity = 1;
    for(let n = 0; n < tot; n++){
      if(st.fechado) return;
      // Vídeo pronto e ainda faltam várias: aplica o resto de uma vez (o teatro não segura a entrega)
      if(st.feito && tot - n > 2){
        fase('Aplicando o resto', (tot - n) + ' peças');
        st.itens.slice(n).forEach(i => { i.it.classList.add('feita'); i.nm.classList.add('on'); i.bars.forEach(b => b.classList.add('on')); });
        break;
      }
      const i = st.itens[n], cab = 'Peça ' + (n + 1) + ' de ' + tot;
      fase(cab, i.nome);
      i.it.classList.add('alvo');
      await vai(...centroDe(i.it.querySelector('.th')), ms(G.vai));
      cur.classList.add('aperta'); seleciona(i);
      $('.alvo-n').innerHTML = 'Selecionada: <b></b>'; $('.alvo-n b').textContent = i.nome;
      await _fMeEspera(ms(G.clica)); cur.classList.remove('aperta');
      await vai(...centroDe(st.chips[i.efeito]), ms(G.vai));
      cur.classList.add('aperta');
      Object.values(st.chips).forEach(c => c.classList.remove('on')); st.chips[i.efeito].classList.add('on'); curva(i);
      await _fMeEspera(ms(G.clica)); cur.classList.remove('aperta');
      i.bars.forEach(b => b.classList.add('on')); i.nm.classList.add('on'); playhead(i.ini);
      brilha(i);
      i.it.classList.remove('alvo'); i.it.classList.add('feita');
      await _fMeEspera(ms(G.ver));
    }
    seleciona(null);
    if(!st.feito && !st.fechado){
      fase('Revisando o motion', 'esperando o vídeo terminar de gravar');
      await vai(...centroDe($('.ph')), ms(G.vai));
      const ida = st.areaW * Math.min(1, (st.tAssenta + .4) / SEG);
      const loop = reduz ? null : $('.ph').animate([{ transform: 'translateX(0)' }, { transform: 'translateX(' + ida + 'px)' }],
        { duration: (st.tAssenta + .4) * 1000, iterations: Infinity });
      await st.prontoFeito;
      if(loop) loop.cancel();
    }
    playhead(SEG);
  }

  /* ── O QUE O motion.js CHAMA ───────────────────────────────────────────────── */
  const api = {
    /* Antes do encoder (é esperado — tem de ser rápido): o quadro final UMA vez no centro, as
       miniaturas recortadas dele, a lista, os chips e a timeline. Os painéis se formam saindo de
       trás da arte, e o roteiro começa sem ser esperado (o encoder segue). */
    async prepara(plano, resolvidas, W, H, tAssenta){
      st.tAssenta = tAssenta; L.W = W; L.H = H;
      st.itens = _fMeItens(plano);
      const grande = document.createElement('canvas'); grande.width = W; grande.height = H;
      await fRenderTemplateLayers(grande.getContext('2d'), resolvidas, W, H, arte.dados, arte.camp, arte.material,
        { scope: 'franqueado', purpose: 'export', resolvido: true });
      cv.width = W; cv.height = H; cv.getContext('2d').drawImage(grande, 0, 0);

      const efeitos = [...new Set(st.itens.map(i => i.efeito).concat(Object.values(_F_ME_EFEITO)))].slice(0, 8);
      if(st.itens.some(i => i.efeito === 'Vários') && !efeitos.includes('Vários')) efeitos[7] = 'Vários';
      st.chips = {};
      efeitos.forEach(n => { const c = document.createElement('div'); c.className = 'chip'; c.textContent = n; $('.chips').appendChild(c); st.chips[n] = c; });
      for(let s = 0; s <= SEG; s += 2){ const m = document.createElement('span'); m.style.left = (s / SEG * 100) + '%'; m.textContent = s + 's'; $('.regua').appendChild(m); }
      $('.parado').style.left = (tAssenta / SEG * 100) + '%';
      st.itens.forEach(i => {
        const it = document.createElement('div'); it.className = 'it';
        const m = document.createElement('canvas'), bw = Math.max(1, i.x1 - i.x0), bh = Math.max(1, i.y1 - i.y0), esc = 52 / Math.max(bw, bh);
        m.width = Math.max(1, Math.round(bw * esc)); m.height = Math.max(1, Math.round(bh * esc));
        try{ m.getContext('2d').drawImage(grande, i.x0, i.y0, bw, bh, 0, 0, m.width, m.height); }catch(e){}
        it.innerHTML = '<span class="th"></span><span></span><svg class="ok" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>';
        it.firstChild.appendChild(m); it.children[1].textContent = i.nome; $('.lista').appendChild(it); i.it = it;
        const nm = document.createElement('div'); nm.className = 'nome'; nm.innerHTML = '<i></i>'; nm.append(i.nome); $('.nomes').appendChild(nm); i.nm = nm;
        const fx = document.createElement('div'); fx.className = 'faixa';
        i.bars = i.unidades.map(u => { const br = document.createElement('div'); br.className = 'bar' + (u.carona ? ' carona' : '');
          br.style.left = (u.ini / SEG * 100) + '%'; br.style.width = ((u.carona || u).dur / SEG * 100) + '%'; fx.appendChild(br); return br; });
        $('.faixas').appendChild(fx);
      });
      posiciona();
      addEventListener('resize', () => { if(!st.fechado && host.isConnected) posiciona(); });
      // Os painéis se formam saindo de trás da arte
      const cx = L.ax + L.aw / 2, cy = L.ay + L.ah / 2;
      [pecas, insp, tlp].forEach((p, n) => {
        const r = caixa(p);
        p.animate(reduz ? [{ opacity: 0 }, { opacity: 1 }] : [
          { opacity: 0, translate: (cx - r.left - r.width / 2) * .7 + 'px ' + (cy - r.top - r.height / 2) * .7 + 'px', scale: '.55' },
          { opacity: 1, translate: '0 0', scale: '1' }],
          { duration: durSlow + durFast, delay: n * 70, easing: _fMeEase('--ease-spring-soft'), fill: 'forwards' });
      });
      fase('Peças separadas', st.itens.length + ' peças para animar');
      roteiro().then(() => { st.fimRoteiro = true; if(st.aoTerminar) st.aoTerminar(); });
    },

    // p = fração de quadros prontos (0..1). Estima o tempo total pelo custo medido.
    progresso(p, nMov, nTot){
      const agora = performance.now();
      if(!st.t0) st.t0 = agora;
      const f = p * nTot, gasto = (agora - st.t0) / 1000;
      if(f <= nMov){ st.cMov = gasto / Math.max(1, f); st.tMov = agora; st.fMov = f; }
      else if(st.tMov) st.cPar = (agora - st.tMov) / 1000 / Math.max(1, f - st.fMov);
      const cMov = st.cMov || .03, cPar = st.cPar || cMov * .15;
      st.estSeg = nMov * cMov + Math.max(0, nTot - nMov) * cPar;
      st.frac = Math.min(.99, gasto / Math.max(.5, st.estSeg));
      $('.cache').style.transform = 'scaleX(' + p + ')';
      $('.pct').textContent = Math.round(p * 100) + '%';
    },

    /* O MP4 ficou pronto: o roteiro fecha (corre ou aplica o resto), a arte GANHA VIDA — o vídeo
       de verdade toca no lugar dela —, os painéis são sugados para dentro e ela voa para o mockup. */
    async entrega(url, destino){
      st.feito = true; st.marcaFeito();
      $('.pct').textContent = '100%'; $('.cache').style.transform = 'scaleX(1)';
      if(st.fechado){ api._encerra(); _fMeAterrissa(null, destino, url); return; }
      if(!st.fimRoteiro) await Promise.race([new Promise(r => { st.aoTerminar = r; }), _fMeEspera(3000)]);
      if(st.fechado){ api._encerra(); _fMeAterrissa(null, destino, url); return; }
      cur.style.opacity = 0; seleciona(null);
      fase('Seu motion está pronto!', 'olha ela ganhando vida');
      const v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.src = url;
      arteEl.appendChild(v);
      try{ await v.play(); }catch(e){}
      _fMeFaiscas(raiz, caixa(arteEl), 10);
      /* Deixa a arte se montar no vídeo antes de levá-la (o quadro 0 é só o fundo), com teto. */
      await new Promise(r => { const t0 = performance.now(), alvo = Math.max(.5, (st.tAssenta || 2) * .9);
        const olha = () => (v.currentTime >= alvo || performance.now() - t0 > 2600) ? r() : requestAnimationFrame(olha); olha(); });
      // Os painéis são sugados para dentro da arte; o véu some
      const cx = L.ax + L.aw / 2, cy = L.ay + L.ah / 2, easeIn = _fMeEase('--ease-in');
      host.style.pointerEvents = 'none'; document.removeEventListener('keydown', esc, true);
      [status, pecas, insp, tlp].forEach((p, n) => {
        const r = caixa(p);
        p.animate(reduz ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, translate: '0 0', scale: '1' },
          { opacity: 0, translate: (cx - r.left - r.width / 2) * .8 + 'px ' + (cy - r.top - r.height / 2) * .8 + 'px', scale: '.4' }],
          { duration: durBase, delay: n * 40, easing: easeIn, fill: 'forwards' });
      });
      $('.ve').animate([{ opacity: 1 }, { opacity: 0 }], { duration: durSlow, delay: durFast, easing: _fMeEase('--ease-out'), fill: 'forwards' });
      await _fMeEspera(durBase + 120);
      const r0 = caixa(arteEl);
      arteEl.style.visibility = 'hidden';
      await _fMeAterrissa({ raiz, video: v, r0 }, destino, url);
      host.remove();
    },

    falha(){
      st.fechado = true; st.marcaFeito();
      host.animate([{ opacity: 1 }, { opacity: 0 }], { duration: durBase, easing: _fMeEase('--ease-in'), fill: 'forwards' })
        .finished.then(() => host.remove()).catch(() => host.remove());
      document.removeEventListener('keydown', esc, true);
    },

    _encerra(){ host.remove(); document.removeEventListener('keydown', esc, true); }
  };

  /* Fechar NÃO cancela o vídeo (o encoder não tem freio): só tira o teatro da frente. No fim,
     o vídeo pousa direto no mockup. */
  const fecha = () => {
    if(st.fechado) return;
    st.fechado = true; st.marcaFeito();
    host.animate([{ opacity: 1 }, { opacity: 0 }], { duration: durBase, easing: _fMeEase('--ease-in'), fill: 'forwards' })
      .finished.then(() => { host.style.display = 'none'; }).catch(() => { host.style.display = 'none'; });
    document.removeEventListener('keydown', esc, true);
    if(typeof gToast === 'function') gToast('O vídeo continua sendo gerado. Mantenha esta aba aberta.');
  };
  const esc = e => { if(e.key === 'Escape'){ e.preventDefault(); fecha(); } };
  document.addEventListener('keydown', esc, true);
  $('.fechar').addEventListener('click', fecha);
  return api;
}

/* ── A VOLTA PARA O MOCKUP ───────────────────────────────────────────────────────
   O vídeo voa num arco (sobe, gira um pouco, passa do ponto e assenta), entra no slot do
   mockup e continua tocando; o mockup dá um pulo de mola, saem faíscas da marca e um selo
   "Motion pronto!" pula em cima. Sem `voo` (estúdio fechado), só pousa e comemora. */
async function _fMeAterrissa(voo, destino, url){
  const easeStd = _fMeEase('--ease-standard'), durCel = _fMeTok('--dur-celebration');
  const alvoRect = destino ? _fMeRetanguloArte(destino) : null;
  let v = voo && voo.video;
  const reduz = _fMeReduz();
  if(voo && alvoRect && !reduz){
    const r0 = voo.r0, caixa = document.createElement('div');
    caixa.className = 'voo';
    Object.assign(caixa.style, { width: r0.width + 'px', height: r0.height + 'px' });
    caixa.appendChild(v); voo.raiz.appendChild(caixa);
    try{ v.play(); }catch(e){}
    const s1 = alvoRect.width / r0.width;
    const mx = (r0.left + alvoRect.left) / 2, my = Math.min(r0.top, alvoRect.top) - Math.max(40, r0.height * .12);
    const sm = (1 + s1) / 2 * 1.06;
    await caixa.animate([
      { transform: 'translate(' + r0.left + 'px,' + r0.top + 'px) scale(1) rotate(0deg)', easing: easeStd },
      { transform: 'translate(' + mx + 'px,' + my + 'px) scale(' + sm + ') rotate(-6deg)', offset: .45, easing: easeStd },
      { transform: 'translate(' + alvoRect.left + 'px,' + (alvoRect.top + 6) + 'px) scale(' + (s1 * .96) + ') rotate(3deg)', offset: .85, easing: easeStd },
      { transform: 'translate(' + alvoRect.left + 'px,' + alvoRect.top + 'px) scale(' + s1 + ') rotate(0deg)' }
    ], { duration: durCel + _fMeTok('--dur-base'), fill: 'forwards' }).finished.catch(() => {});
    caixa.remove();
  } else if(v && !reduz){ v = null; }
  if(!destino) return;
  const montado = fMotionMontaNoSlot(destino, v || undefined);
  if(reduz) return;   // modo reduzido: o vídeo só aparece no lugar, sem mola, faísca nem selo pulando
  // O pulo de mola no mockup + faíscas + selo
  // `scale` (a propriedade), não `transform`: o .pst-phone já usa transform no media query, e
  // animar transform o faria pular de tamanho. `scale` compõe com ele.
  const quem = destino.closest('.pst-phone') || destino.closest('.art-canvas-real') || destino;
  quem.animate([{ scale: '1' }, { scale: '.94', offset: .3 }, { scale: '1.04', offset: .65 }, { scale: '1' }],
    { duration: _fMeTok('--dur-slow') + _fMeTok('--dur-fast'), easing: _fMeEase('--ease-spring-soft') });
  const r = (montado || destino).getBoundingClientRect();
  const camada = document.createElement('div');
  camada.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9001';
  const sr = camada.attachShadow({ mode: 'open' });
  sr.innerHTML = '<style>' + _F_ME_CSS.replace(/:host\{[^}]*\}/, '') + '</style>';
  document.body.appendChild(camada);
  _fMeFaiscas(sr, r, 16);
  const selo = document.createElement('div'); selo.className = 'selo-pronto'; selo.textContent = 'Motion pronto!';
  sr.appendChild(selo);
  const sx = r.left + r.width / 2 - selo.offsetWidth / 2, sy = Math.max(8, r.top - selo.offsetHeight - 10);
  // Sem await: a comemoração corre sozinha numa camada que não pega clique; quem chamou segue.
  selo.animate([
    { transform: 'translate(' + sx + 'px,' + (sy + 16) + 'px) scale(.4)', opacity: 0 },
    { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(1)', opacity: 1, offset: .25 },
    { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(1)', opacity: 1, offset: .8 },
    { transform: 'translate(' + sx + 'px,' + (sy - 8) + 'px) scale(.96)', opacity: 0 }
  ], { duration: durCel * 2, easing: _fMeEase('--ease-spring') }).finished.catch(() => {}).then(() => camada.remove());
}

// Faíscas da marca: pontos e estrelinhas saindo do centro, com gravidade. Só transform e opacity.
function _fMeFaiscas(raiz, r, n){
  if(_fMeReduz()) return;
  const cores = ['var(--dm-orange)', 'var(--dm-yellow)', 'var(--dm-red)', 'var(--white)'];
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2, dur = _fMeTok('--dur-celebration');
  for(let i = 0; i < n; i++){
    const f = document.createElement('div'); f.className = 'faisca';
    const estrela = i % 3 === 0, tam = estrela ? 12 : 6 + (i % 2) * 3;
    f.style.cssText = 'width:' + tam + 'px;height:' + tam + 'px;background:' + cores[i % cores.length] + ';'
      + (estrela ? 'clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%)' : 'border-radius:50%');
    raiz.appendChild(f);
    const ang = (i / n) * Math.PI * 2 + (i % 2 ? .2 : -.1), dist = Math.max(r.width, r.height) * .35 + 40 + (i % 4) * 14;
    const x1 = cx + Math.cos(ang) * dist, y1 = cy + Math.sin(ang) * dist;
    f.animate([
      { transform: 'translate(' + cx + 'px,' + cy + 'px) scale(.3) rotate(0deg)', opacity: 1 },
      { transform: 'translate(' + (cx + (x1 - cx) * .75) + 'px,' + (cy + (y1 - cy) * .75 - 18) + 'px) scale(1) rotate(120deg)', opacity: 1, offset: .55 },
      { transform: 'translate(' + x1 + 'px,' + (y1 + 26) + 'px) scale(.2) rotate(200deg)', opacity: 0 }
    ], { duration: dur + (i % 3) * 80, easing: _fMeEase('--ease-out'), fill: 'forwards' }).finished.then(() => f.remove()).catch(() => f.remove());
  }
}

// O retângulo onde a arte aparece dentro do destino (contain na proporção do canvas que já está lá).
function _fMeRetanguloArte(destino){
  const cvs = destino.querySelector('canvas, video.f-motion-video');
  const r = (cvs && cvs.getBoundingClientRect().width > 4) ? cvs.getBoundingClientRect() : destino.getBoundingClientRect();
  return r.width > 4 ? r : null;
}

/* Onde o vídeo pousa: o celular do palco (desktop, arte concluída), o celular do "Ver como fica"
   se estiver aberto, ou o próprio card no chat. Só destino VISÍVEL — voar para um elemento
   escondido seria sumir no nada. */
function fMotionDestino(snapId){
  const visivel = el => !!(el && el.offsetParent !== null && el.getBoundingClientRect().width > 20);
  const card = (typeof _fPostedCardAtual === 'function') ? _fPostedCardAtual() : null;
  if(card && card.getAttribute('data-canvas-id') === snapId){
    const palco = document.querySelector('#lp-contextos .pst-artslot');
    if(visivel(palco)) return palco;
    const modal = document.querySelector('#f-posted-modal.open .pst-artslot');
    if(visivel(modal)) return modal;
  }
  const cv = document.getElementById(snapId);
  return visivel(cv) ? cv.parentElement : null;
}

/* Põe o vídeo pronto no lugar da arte parada. Chamado na volta do estúdio e pelo
   `_fPostedMountArt` a cada (re)montagem do celular — o chassi é refeito por innerHTML a cada
   troca de ambiente, então o vídeo precisa entrar de novo. O canvas fica (escondido por CSS):
   é dele que saem a proporção do slot e o fundo borrado do Story. */
function fMotionMontaNoSlot(holder, video){
  if(!holder) return null;
  let id = null;
  if(holder.classList.contains('pst-artslot')){
    const card = (typeof _fPostedCardAtual === 'function') ? _fPostedCardAtual() : null;
    id = card && card.getAttribute('data-canvas-id');
  } else {
    const c = holder.querySelector('canvas[id]'); id = c && c.id;
  }
  const reg = id && _fMotionVideos[id];
  if(!reg) return null;
  let v = video || holder.querySelector('video.f-motion-video');
  if(!v){
    v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.src = reg.url;
  }
  v.className = 'pst-art f-motion-video';
  v.removeAttribute('style');
  v.setAttribute('aria-label', 'Story animado');
  holder.appendChild(v);
  holder.classList.add('f-motion-tem-video');
  const tenta = v.play(); if(tenta && tenta.catch) tenta.catch(() => {});
  // A barra do Story anda junto com o vídeo
  const story = holder.closest('.pst-story');
  if(story){ story.style.setProperty('--f-motion-atraso', (-(v.currentTime || 0)) + 's'); story.classList.add('f-motion-tocando'); }
  return v;
}
