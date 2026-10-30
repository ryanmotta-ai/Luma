/**
 * js/franqueado/motion-estudio.js
 *
 * O ESTÚDIO DE MOTION — a espera do "Virar motion" vira um motion designer trabalhando
 * (30/10/2026, pedido do Ryan; mockup aprovado: docs/mockups/story-animado-motion-designer.html)
 * ---------------------------------------------------------------------------
 * Antes, quem pedia o vídeo encarava um aviso de "não saia" por 10–40 s. Agora a arte voa do
 * card para um estúdio escuro e um cursor monta a animação dela, peça por peça: pega a peça na
 * lista "Peças da sua arte", arrasta para o lugar, escolhe o movimento no painel (a curva se
 * desenha), a barra entra na timeline e a peça é testada. Quando o MP4 fica pronto, o estúdio
 * se desmonta e o vídeo VOA para o mockup (o celular do palco, ou o card no celular), que dá um
 * pulo e solta faíscas da marca.
 *
 * ⛔ NADA AQUI É INVENTADO. As peças, os nomes, os efeitos e os tempos saem do `_fMotionPlano`
 * (motion.js); o estado de cada peça a cada instante é o `_fMotionEstado`, o mesmo do MP4. As
 * peças são desenhadas pelo motor único (`fRenderTemplateLayers` com `resolvido:true`), UMA
 * vez cada, como sprites; o teatro só compõe sprites com transform — barato o bastante para não
 * disputar o encoder, que continua desenhando os quadros de verdade.
 *
 * ⛔ AO VIVO DE VERDADE. O ritmo do roteiro persegue o TEMPO ESTIMADO do render (custo medido de
 * um quadro em movimento e de um parado), não a contagem de quadros: os quadros parados do fim
 * voam e deixariam o designer para trás. Adiantado, ele desacelera; acabou antes, revisa o vídeo
 * em loop até a gravação terminar. A barra verde da timeline é o render real.
 *
 * O vídeo pronto mora em `_fMotionVideos[snapId]` e o mockup o mostra no lugar do canvas
 * (`fMotionMontaNoSlot`, chamado pelo `_fPostedMountArt` a cada troca de ambiente).
 * Movimento reduzido: o estúdio abre igual (é o conteúdo pedido); só os enfeites viram fade.
 *
 * API: fMotionEstudio(origem, arte) → { prepara, progresso, entrega, falha }
 *      fMotionMontaNoSlot(holder, video?) · fMotionDestino(snapId)
 * Depende de: motion.js (_fMotionEstado, _fMoSuave, _fMoAssenta, F_MOTION_SEG, F_MOTION_FPS),
 *   png-generator.js (fRenderTemplateLayers), live-preview.js (_fPostedCardAtual, _fLpMotionMs,
 *   _fLpMotionEase).
 */

let _fMotionVideos = {};   // snapId → { blob, fname, url } — o vídeo pronto de cada card

const _F_ME_EFEITO = { marca: 'Aparecer', titulo: 'Crescer e endireitar', texto: 'Do lado onde mora', foto: 'Deslizar e assentar',
  painel: 'Subir', forma: 'Chegar', faixa: 'Entrar pela borda', adesivo: 'Pop com giro', revela: 'Revelar por dentro', legal: 'Aparecer no fim' };
const _F_ME_NOME = { marca: 'Marca', titulo: 'Título', texto: 'Texto', foto: 'Foto', painel: 'Painel', forma: 'Forma',
  faixa: 'Faixa', adesivo: 'Selo', revela: 'Foto no card', legal: 'Texto legal' };
// Com mais peças que isto, as menos importantes viram um item "Detalhes" (um gesto só): 20 peças
// em fila fariam o designer correr no PC rápido, e a fila de timeline não caberia na tela.
const _F_ME_PRIO = { titulo: 1, texto: 2, foto: 2, painel: 3, forma: 4, faixa: 4, revela: 4, marca: 5, adesivo: 6, legal: 7 };
const _F_ME_MAX = 9;
const _F_ME_ICONE = {
  titulo: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>', texto: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>', legal: '<path d="M5 9h14M5 13h14M5 17h9"/>',
  foto: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/>',
  revela: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M12 16V9M9 12l3-3 3 3"/>',
  forma: '<rect x="4" y="6" width="16" height="12" rx="3"/>', painel: '<rect x="3" y="4" width="18" height="16" rx="3"/>',
  faixa: '<rect x="3" y="14" width="18" height="6" rx="1.5"/>', adesivo: '<circle cx="12" cy="12" r="8"/>', marca: '<path d="M12 4l2.5 5 5.5.8-4 3.9.9 5.5L12 16.6 7.1 19.2l.9-5.5-4-3.9 5.5-.8z"/>'
};

const _F_ME_CSS = ':host{position:fixed;inset:0;z-index:9000;font-family:Roboto,system-ui,sans-serif;color:var(--d-text);-webkit-font-smoothing:antialiased}'
  + '.ve{position:absolute;inset:0;background:var(--d-dark);opacity:0}'
  + '.es{position:absolute;inset:0;display:grid;grid-template-columns:184px minmax(0,1fr) 232px;grid-template-rows:auto minmax(0,1fr) auto auto;user-select:none}'
  + '.topo{grid-column:1/-1;display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--d-border)}'
  + '.ponto{width:8px;height:8px;border-radius:50%;background:var(--dm-orange);flex:none;animation:pulsa 1.6s var(--ease-standard) infinite}'
  + '@keyframes pulsa{0%{box-shadow:0 0 0 0 rgba(255,144,0,.55)}70%,100%{box-shadow:0 0 0 8px rgba(255,144,0,0)}}'
  + '.fase{font-weight:700;font-size:14px}.sub{font-size:12px;color:var(--d-text3);min-height:15px}'
  + '.dir{margin-left:auto;display:flex;align-items:center;gap:8px}'
  + '.exp{border-radius:8px;background:var(--d-surf2);color:var(--d-text3);font:600 12px Roboto,sans-serif;padding:6px 12px;transition:background var(--dur-fast) var(--ease-standard),color var(--dur-fast) var(--ease-standard)}'
  + '.exp.on{background:var(--dm-orange);color:var(--white)}'
  + '.tc{font:500 12px ui-monospace,Consolas,monospace;background:var(--d-surf);padding:6px 10px;border-radius:8px;font-variant-numeric:tabular-nums}'
  + '.fechar{width:32px;height:32px;border:0;border-radius:8px;background:transparent;color:var(--d-text2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background var(--dur-fast) var(--ease-standard)}'
  + '.fechar:hover{background:var(--d-surf2)}.fechar:focus-visible{outline:2px solid var(--d-sel);outline-offset:2px}'
  + '.tit{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--d-text3);padding:12px 14px 8px}'
  + '.bib{border-right:1px solid var(--d-border);min-height:0;overflow:hidden;display:flex;flex-direction:column}'
  + '.lista{overflow:hidden;flex:1;scroll-behavior:smooth}'
  + '.it{display:flex;align-items:center;gap:8px;padding:5px 14px;font-size:12px;opacity:0;transform:translateX(-8px);transition:opacity var(--dur-base) var(--ease-out),transform var(--dur-base) var(--ease-out),background var(--dur-fast) var(--ease-standard)}'
  + '.it.vis{opacity:1;transform:none}.it.alvo{background:var(--d-sel-fill)}.it.usada{opacity:.38}'
  + '.it span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}'
  + '.th{width:30px;height:30px;border-radius:6px;background:var(--d-surf2);flex:none;display:flex;align-items:center;justify-content:center;overflow:hidden;color:var(--d-text3)}'
  + '.th canvas{max-width:26px;max-height:26px}.th svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2}'
  + '.ok{margin-left:auto;flex:none;color:var(--green);opacity:0;transition:opacity var(--dur-fast) var(--ease-standard)}.it.usada .ok{opacity:1}'
  + '.palco{position:relative;min-height:0;display:flex;align-items:center;justify-content:center;padding:18px}'
  + '.tela{position:relative;border-radius:12px;box-shadow:0 0 0 1px var(--d-border),0 14px 34px rgba(0,0,0,.5);overflow:visible}'
  + '.tela canvas,.tela video{position:absolute;inset:0;width:100%;height:100%;border-radius:12px;display:block}'
  + '.tela video{object-fit:cover}'
  + '.sel{position:absolute;border:1.5px solid var(--d-sel);border-radius:2px;opacity:0;pointer-events:none;transition:opacity var(--dur-micro) var(--ease-standard)}'
  + '.sel.on{opacity:1}.sel i{position:absolute;width:6px;height:6px;background:var(--white);border:1.5px solid var(--d-sel);box-sizing:border-box}'
  + '.sel i:nth-child(1){left:-4px;top:-4px}.sel i:nth-child(2){right:-4px;top:-4px}.sel i:nth-child(3){left:-4px;bottom:-4px}.sel i:nth-child(4){right:-4px;bottom:-4px}'
  + '.sel b{position:absolute;left:-1.5px;bottom:100%;margin-bottom:4px;padding:1px 6px;border-radius:3px;background:var(--d-sel);color:var(--white);font:600 10px/1.4 Roboto,sans-serif;white-space:nowrap}'
  + '.sel.cima b{bottom:auto;top:100%;margin:4px 0 0}'
  + '.insp{border-left:1px solid var(--d-border);min-height:0;overflow:hidden}'
  + '.alvo{margin:0 14px 10px;padding:8px 10px;border-radius:8px;background:var(--d-surf);font-size:12px;min-height:34px;display:flex;align-items:center;gap:6px;color:var(--d-text3);overflow:hidden;white-space:nowrap}'
  + '.alvo b{color:var(--d-text);font-weight:600;overflow:hidden;text-overflow:ellipsis}'
  + '.chips{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:0 14px}'
  + '.chip{border-radius:8px;background:var(--d-surf);font-size:11px;line-height:1.25;padding:7px 8px;color:var(--d-text3);box-shadow:inset 0 0 0 1px transparent;transition:background var(--dur-fast) var(--ease-standard),color var(--dur-fast) var(--ease-standard),box-shadow var(--dur-fast) var(--ease-standard)}'
  + '.chip.on{background:var(--d-sel-fill);color:var(--d-text);box-shadow:inset 0 0 0 1.5px var(--d-sel)}'
  + '.curva{margin:12px 14px 0;border-radius:8px;background:var(--d-surf);padding:8px 10px}'
  + '.curva-cab{display:flex;justify-content:space-between;gap:6px;font-size:11px;color:var(--d-text3);margin-bottom:4px}'
  + '.curva svg{display:block;width:100%;height:64px}.curva path{fill:none;stroke:var(--dm-orange);stroke-width:2;stroke-linecap:round}.curva .grade{stroke:var(--d-border);stroke-width:1}'
  + '.tempos{display:flex;gap:6px;margin:8px 14px 0}.tempos div{flex:1;border-radius:8px;background:var(--d-surf);padding:6px 8px;font-size:10px;color:var(--d-text3)}'
  + '.tempos b{display:block;font:500 13px ui-monospace,Consolas,monospace;color:var(--d-text);margin-top:2px}'
  + '.tl{grid-column:1/-1;border-top:1px solid var(--d-border);padding:10px 0 8px}'
  + '.tl-cab{display:flex;align-items:center;gap:8px;padding:0 16px 8px;font-size:12px;color:var(--d-text3)}.tl-cab b{color:var(--d-text);font-weight:600}'
  + '.rend{margin-left:auto;display:flex;align-items:center;gap:6px}.rend i{width:10px;height:3px;border-radius:2px;background:var(--green)}'
  + '.grade-tl{display:grid;grid-template-columns:184px minmax(0,1fr)}'
  + '.nomes{border-right:1px solid var(--d-border)}'
  + '.regua,.nome,.faixa{height:22px}'
  + '.nome{display:flex;align-items:center;gap:8px;padding:0 12px 0 16px;font-size:11.5px;color:var(--d-text3);white-space:nowrap;overflow:hidden;opacity:.4;transition:opacity var(--dur-base) var(--ease-standard),color var(--dur-fast) var(--ease-standard)}'
  + '.nome.on{opacity:1}.nome.foco{color:var(--d-text)}.nome i{width:7px;height:7px;border-radius:2px;background:currentColor;opacity:.6;flex:none}'
  + '.area{position:relative;margin-right:16px}'
  + '.regua{position:relative;border-bottom:1px solid var(--d-border);font:500 10px ui-monospace,Consolas,monospace;color:var(--d-text3)}'
  + '.regua span{position:absolute;top:4px;translate:-50% 0}'
  + '.cache{position:absolute;left:0;top:19px;height:3px;width:0;background:var(--green);border-radius:2px}'
  + '.parado{position:absolute;top:22px;bottom:0;right:0;background:repeating-linear-gradient(135deg,rgba(255,255,255,.035) 0 6px,transparent 6px 12px);display:flex;align-items:flex-end;justify-content:center;padding-bottom:4px;font-size:10.5px;color:var(--d-text3);overflow:hidden;white-space:nowrap}'
  + '.faixa{position:relative}'
  + '.bar{position:absolute;top:5px;height:12px;border-radius:4px;background:var(--d-sel);opacity:0;transform-origin:0 50%;transform:scaleX(0);transition:opacity var(--dur-fast) var(--ease-standard),transform var(--dur-base) var(--ease-out)}'
  + '.bar.on{opacity:1;transform:none}.bar.carona{background:transparent;box-shadow:inset 0 0 0 1.5px var(--d-sel)}'
  + '.bar::before,.bar::after{content:"";position:absolute;top:50%;width:7px;height:7px;background:var(--white);rotate:45deg;translate:-50% -50%}.bar::before{left:0}.bar::after{left:100%}'
  + '.ph{position:absolute;top:0;bottom:0;left:0;width:0;pointer-events:none}'
  + '.ph::before{content:"";position:absolute;top:0;bottom:0;left:0;width:1.5px;background:var(--dm-orange);translate:-50% 0}'
  + '.ph::after{content:"";position:absolute;top:1px;left:0;width:11px;height:12px;background:var(--dm-orange);translate:-50% 0;clip-path:polygon(0 0,100% 0,100% 62%,50% 100%,0 62%)}'
  + '.pe{grid-column:1/-1;display:flex;align-items:center;gap:12px;padding:10px 16px;border-top:1px solid var(--d-border);font-size:12px;color:var(--d-text3)}'
  + '.pe svg{flex:none}.prog{flex:1;max-width:220px;height:4px;border-radius:2px;background:var(--d-surf2);overflow:hidden}.prog i{display:block;height:100%;width:0;background:var(--green)}'
  + '.fant{position:fixed;left:0;top:0;pointer-events:none;opacity:0;filter:drop-shadow(0 8px 14px rgba(0,0,0,.45));z-index:3}'
  + '.voo{position:fixed;left:0;top:0;transform-origin:0 0;border-radius:12px;overflow:hidden;z-index:4;box-shadow:0 18px 40px rgba(0,0,0,.35);pointer-events:none}'
  + '.voo canvas,.voo video{display:block;width:100%;height:100%;object-fit:cover}'
  + '.cur{position:fixed;left:0;top:0;z-index:5;pointer-events:none;will-change:transform;transition:opacity var(--dur-base) var(--ease-standard)}'
  + '.cur svg{display:block;transform-origin:2px 2px;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.5));transition:scale var(--dur-micro) var(--ease-standard)}'
  + '.cur.aperta svg{scale:.82}'
  + '.cur span{position:absolute;left:15px;top:17px;padding:2px 8px;border-radius:999px;background:var(--d-sel);color:var(--white);font:600 10px/1.5 Roboto,sans-serif;white-space:nowrap}'
  + '.faisca{position:fixed;left:0;top:0;pointer-events:none;z-index:6}'
  + '.selo-pronto{position:fixed;left:0;top:0;z-index:7;pointer-events:none;padding:6px 12px;border-radius:999px;background:var(--dm-orange);color:var(--white);font:800 12px/1.2 Roboto,sans-serif;box-shadow:0 8px 20px rgba(255,144,0,.35);white-space:nowrap}'
  + '@media (max-height:760px){.regua,.nome,.faixa{height:17px}.bar{top:3px;height:11px}.cache{top:14px}.parado{top:17px}.regua span{top:2px}.tl{padding:6px 0 4px}.tl-cab{padding-bottom:4px}}'
  + '@media (max-width:760px){'
  + '.es{grid-template-columns:minmax(0,1fr) 140px;grid-template-rows:auto auto minmax(0,1fr) auto auto}'
  + '.bib{grid-column:1/-1;border-right:0;border-bottom:1px solid var(--d-border)}.bib .tit{display:none}'
  + '.lista{display:flex;overflow:hidden;padding:6px 6px 8px}'
  + '.it{flex-direction:column;gap:3px;padding:4px 2px 0;width:62px;flex:none;font-size:9.5px;text-align:center}.it span{max-width:58px}.ok{display:none}'
  + '.palco{padding:10px}.insp .tit{padding:10px 10px 6px}.alvo{margin:0 10px 8px;font-size:11px}'
  + '.chips{grid-template-columns:1fr;padding:0 10px;gap:4px}.chip{padding:5px 7px;font-size:10.5px}'
  + '.curva,.tempos{margin-left:10px;margin-right:10px}.tempos{flex-direction:column}'
  + '.grade-tl{grid-template-columns:96px minmax(0,1fr)}.nome{padding-left:10px;font-size:10.5px}.area{margin-right:10px}'
  + '.sub,.info,.exp{display:none}.topo{padding:10px 12px;gap:8px}.fase{font-size:12.5px}'
  + '}';

const _fMeTok = t => (typeof _fLpMotionMs === 'function') ? _fLpMotionMs(t) : 260;
const _fMeEase = t => (typeof _fLpMotionEase === 'function') ? _fLpMotionEase(t) : 'ease-out';
/* "Reduzir movimento" NÃO pula o estúdio: ver o designer trabalhar é o que a pessoa pediu ao
   clicar (o Windows com "Efeitos de animação" desligado manda esse sinal para todo site, e foi
   assim que o estúdio sumiu para o Ryan em 30/10). O que o modo corta são os enfeites: voo em
   arco, deslize dos painéis, mola e faíscas viram aparecer/esmaecer. */
const _fMeReduz = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches);
const _fMeSeno = u => (1 - Math.cos(Math.PI * u)) / 2;   // arranca e assenta sem tranco (o mesmo do making-of)
const _fMeCorta = (s, n) => s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
const _fMeVirg = v => v.toFixed(2).replace('.', ',') + ' s';

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

// Desenha UMA unidade no instante t, com o estado do MP4 (`_fMotionEstado`).
function _fMeDesenha(c, u, t, W, H, k){
  const e = _fMotionEstado(u, t, W, H);
  if(e.a <= 0.001 || !u.sprite) return;
  const ox = (e.ox != null ? e.ox : u.ox) * k, oy = (e.oy != null ? e.oy : u.oy) * k;
  c.save();
  c.globalAlpha = Math.min(1, e.a);
  if(e.geo){   // REVELA: a foto sobe por dentro da base — o recorte fica parado
    const b = u.base;
    if(b){ c.beginPath(); c.rect(b.x0 * k, b.y0 * k, (b.x1 - b.x0) * k, (b.y1 - b.y0) * k); c.clip(); }
    c.translate(0, e.geo * k);
  }
  c.translate(ox + e.dx * k, oy + e.dy * k);
  if(e.g) c.rotate(e.g * Math.PI / 180);
  if(e.s !== 1) c.scale(e.s, e.s);
  c.translate(-ox, -oy);
  c.drawImage(u.sprite, 0, 0);
  c.restore();
}

function _fMeHTML(){
  const x = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  return '<div class="ve"></div><div class="es">'
    + '<header class="topo"><span class="ponto" aria-hidden="true"></span><div><div class="fase">Abrindo o estúdio</div><div class="sub">Separando as peças da sua arte</div></div>'
    + '<div class="dir"><span class="exp">Exportar MP4</span><span class="tc">00:00:00</span><button type="button" class="fechar" aria-label="Fechar o estúdio (o vídeo continua sendo gerado)" title="Fechar (o vídeo continua sendo gerado)">' + x + '</button></div></header>'
    + '<aside class="bib"><div class="tit">Peças da sua arte</div><div class="lista"></div></aside>'
    + '<main class="palco"><div class="tela"><canvas class="cv"></canvas><div class="sel"><i></i><i></i><i></i><i></i><b></b></div></div></main>'
    + '<aside class="insp"><div class="tit">Movimento</div><div class="alvo">Nenhuma peça selecionada</div><div class="chips"></div>'
    + '<div class="curva"><div class="curva-cab"><span>Curva</span><span class="curva-nome">—</span></div><svg viewBox="0 0 100 64" preserveAspectRatio="none" aria-hidden="true"><path class="grade" d="M0 56H100M0 12H100"/><path class="cp" d=""/></svg></div>'
    + '<div class="tempos"><div>Início<b class="t-ini">—</b></div><div>Duração<b class="t-dur">—</b></div></div></aside>'
    + '<section class="tl"><div class="tl-cab"><b>Timeline</b><span class="info">· Story 1080×1920 · 60 fps · ' + F_MOTION_SEG + ' s</span><span class="rend"><i></i><span class="rend-t">render 0%</span></span></div>'
    + '<div class="grade-tl"><div class="nomes"><div class="regua"></div></div><div class="area"><div class="regua rg"><div class="cache"></div></div><div class="parado"><span>a oferta parada para ler</span></div><div class="faixas"></div><div class="ph"></div></div></div></section>'
    + '<footer class="pe"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>'
    + '<span class="pe-txt">Mantenha esta aba na frente até terminar</span><div class="prog"><i></i></div></footer></div>'
    + '<canvas class="fant"></canvas>'
    + '<div class="cur"><svg width="18" height="20" viewBox="0 0 18 20" aria-hidden="true"><path d="M2 2v14l4-3.6 2.7 6 2.5-1.1-2.7-6H15z" fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/></svg><span class="cur-et">Motion · Luma</span></div>';
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
  const SEG = F_MOTION_SEG;
  const st = { vis: new Map(), previas: [], passos: [], iP: 0, elP: 0, sRot: 0, L: 0, itens: [], vivos: [],
    fechado: false, vivo: true, feito: false, frac: 0, estSeg: 0, tGlobal: null, cx: 60, cy: 60, ultimo: 0, k: 1, kp: 1 };
  const cur = $('.cur'), cv = $('.cv'), tela = $('.tela'), sel = $('.sel'), fant = $('.fant');
  const fase = (a, b) => { $('.fase').textContent = a; $('.sub').textContent = b || ''; };
  const poe = (x, y) => { st.cx = x; st.cy = y; cur.style.transform = 'translate(' + x + 'px,' + y + 'px)'; };
  const vai = (x0, y0, x1, y1, u) => { const q = _fMeSeno(u), mx = (x0 + x1) / 2 + (y1 - y0) * .12, my = (y0 + y1) / 2 - Math.abs(x1 - x0) * .1, v = 1 - q;
    poe(v * v * x0 + 2 * v * q * mx + q * q * x1, v * v * y0 + 2 * v * q * my + q * q * y1); };
  const centro = (el, fx, fy) => { const r = el.getBoundingClientRect(); return [r.left + r.width * fx, r.top + r.height * fy]; };
  const playhead = t => { t = Math.max(0, Math.min(SEG, t)); $('.ph').style.left = (t / SEG * 100) + '%';
    const s = Math.floor(t), f = Math.floor((t - s) * F_MOTION_FPS); $('.tc').textContent = '00:' + String(s).padStart(2, '0') + ':' + String(f).padStart(2, '0'); };
  for(let s = 0; s <= SEG; s++){ const m = document.createElement('span'); m.style.left = (s / SEG * 100) + '%'; m.textContent = s + 's'; $('.rg').appendChild(m); }
  poe(innerWidth * .5, innerHeight * .2);

  /* A tela: o maior 9:16 (ou a proporção da arte) que cabe no palco. */
  const W0 = origem && origem.width || 1080, H0 = origem && origem.height || 1920;
  function encaixa(W, H){
    const p = $('.palco').getBoundingClientRect(), pad = innerWidth <= 760 ? 20 : 36;
    const esc = Math.min((p.width - pad) / W, (p.height - pad) / H);
    tela.style.width = Math.max(60, W * esc) + 'px'; tela.style.height = Math.max(100, H * esc) + 'px';
    st.k = W * esc / W;   // px de CSS por px da arte
  }
  encaixa(W0, H0);

  /* ── IDA: a arte do card voa até a tela, o estúdio entra em volta ───────────── */
  const durBase = _fMeTok('--dur-base'), durSlow = _fMeTok('--dur-slow'), durFast = _fMeTok('--dur-fast');
  $('.ve').animate([{ opacity: 0 }, { opacity: 1 }], { duration: durBase, easing: _fMeEase('--ease-out'), fill: 'forwards' });
  const reduz = _fMeReduz();
  [['.topo', '0,-14px'], ['.bib', '-28px,0'], ['.insp', '28px,0'], ['.tl', '0,28px'], ['.pe', '0,16px']].forEach(([s, d], i) => {
    $(s).animate([{ opacity: 0, transform: 'translate(' + (reduz ? '0,0' : d) + ')' }, { opacity: 1, transform: 'none' }],
      { duration: durSlow, delay: durFast * .6 + i * 40, easing: _fMeEase('--ease-out'), fill: 'backwards' });
  });
  const copia = document.createElement('canvas');
  copia.width = W0; copia.height = H0;
  try{ if(origem) copia.getContext('2d').drawImage(origem, 0, 0); }catch(e){}
  const voo = document.createElement('div'); voo.className = 'voo'; voo.appendChild(copia); raiz.appendChild(voo);
  const r1 = tela.getBoundingClientRect(), r0 = (origem && origem.getBoundingClientRect().width > 4) ? origem.getBoundingClientRect() : null;
  Object.assign(voo.style, { width: r1.width + 'px', height: r1.height + 'px', transform: 'translate(' + r1.left + 'px,' + r1.top + 'px)' });
  if(r0 && !reduz){
    const s0 = r0.width / r1.width;
    voo.animate([{ transform: 'translate(' + r0.left + 'px,' + r0.top + 'px) scale(' + s0 + ')' },
      { transform: 'translate(' + r1.left + 'px,' + (r1.top - 14) + 'px) scale(1.02)', offset: .8 },
      { transform: 'translate(' + r1.left + 'px,' + r1.top + 'px) scale(1)' }],
      { duration: durSlow + durFast, easing: _fMeEase('--ease-standard') });
  }

  /* ── O RELÓGIO: o roteiro persegue o render ────────────────────────────────── */
  const passo = (dur, fn, ini, ate) => st.passos.push({ dur, fn, ini, ate });
  function quadro(){
    const c = st.ctx; if(!c) return;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
    if(st.base) c.drawImage(st.base, 0, 0);
    st.vivos.forEach(u => {
      let t = st.tGlobal;
      if(t == null){ const m = st.vis.get(u); if(m == null) return; t = m === 'final' ? 99 : m; }
      _fMeDesenha(c, u, t, st.W, st.H, st.kp);
    });
  }
  function tick(agora){
    if(!st.vivo) return;
    const dt = Math.min(.05, (agora - (st.ultimo || agora)) / 1000); st.ultimo = agora;
    const p = st.p || 0;
    $('.cache').style.width = (p * 100) + '%'; $('.prog i').style.width = (p * 100) + '%';
    $('.rend-t').textContent = 'render ' + Math.round(p * 100) + '%';
    if(st.passos.length){
      /* `escala` = ritmo base para o roteiro caber no tempo estimado; `err` corrige no caminho:
         atrasado acelera, adiantado desacelera. Pronto o vídeo, só acelera. */
      const escala = st.estSeg > 0 ? st.L / Math.max(4, st.estSeg * .85) : 1;
      const err = st.frac * st.L - st.sRot;
      const vel = Math.max(.5, Math.min(2.6, (st.feito ? Math.max(escala, 2) : escala) * (1 + err * .25)));
      st.previas = st.previas.filter(v => { const t = v.t0 + (st.sRot - v.s0); v.us.forEach(u => st.vis.set(u, t)); playhead(Math.min(t, v.t1));
        if(t < v.t1) return true; v.us.forEach(u => st.vis.set(u, 'final')); v.fim(); return false; });
      const pp = st.passos[st.iP];
      if(pp){
        if(!pp._ok){ pp._ok = true; st.elP = 0; if(pp.ini) pp.ini(); }
        if(pp.ate){ st.elP += dt; pp.fn(st.elP); if(pp.ate()) st.iP++; }
        else {
          const adv = dt * vel; st.elP += adv; st.sRot += adv;
          const q = pp.dur > 0 ? Math.min(1, st.elP / pp.dur) : 1;
          if(pp.fn) pp.fn(q);
          if(q >= 1) st.iP++;
        }
      }
    }
    quadro();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  /* ── O ROTEIRO ─────────────────────────────────────────────────────────────── */
  function seleciona(i){
    if(!i){ sel.classList.remove('on'); return; }
    const k = st.k;
    Object.assign(sel.style, { left: (i.x0 * k - 2) + 'px', top: (i.y0 * k - 2) + 'px', width: ((i.x1 - i.x0) * k + 4) + 'px', height: ((i.y1 - i.y0) * k + 4) + 'px' });
    sel.classList.toggle('cima', i.y0 * k < 26);
    sel.querySelector('b').textContent = i.nome; sel.classList.add('on');
  }
  function fantasma(i){   // a peça "na mão": as sprites do item recortadas no retângulo dele
    const k = st.k, kp = st.kp, w = Math.max(4, (i.x1 - i.x0) * k), h = Math.max(4, (i.y1 - i.y0) * k);
    fant.width = Math.round(w * 2); fant.height = Math.round(h * 2);
    fant.style.width = w + 'px'; fant.style.height = h + 'px';
    const g = fant.getContext('2d'); g.clearRect(0, 0, fant.width, fant.height);
    i.unidades.forEach(u => { if(u.sprite) g.drawImage(u.sprite, i.x0 * kp, i.y0 * kp, (i.x1 - i.x0) * kp, (i.y1 - i.y0) * kp, 0, 0, fant.width, fant.height); });
  }
  const fantPoe = s => { fant.style.transform = 'translate(' + (st.cx - fant.offsetWidth / 2) + 'px,' + (st.cy - fant.offsetHeight / 2) + 'px) scale(' + s + ')'; };
  function curva(i){
    const u = i.unidades[0], f = (u.carona || u).tipo === 'adesivo' ? _fMoAssenta : _fMoSuave, pts = [];
    for(let n = 0; n <= 40; n++){ const x = n / 40; pts.push((x * 100).toFixed(1) + ' ' + (56 - f(x) * 44).toFixed(1)); }
    const p = $('.cp'); p.setAttribute('d', 'M' + pts.join('L'));
    const L = p.getTotalLength(); p.style.transition = 'none'; p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
    p.getBoundingClientRect(); p.style.transition = 'stroke-dashoffset var(--dur-slow) var(--ease-out)'; p.style.strokeDashoffset = 0;
    $('.curva-nome').textContent = f === _fMoAssenta ? 'Assenta (passa e volta)' : 'Suave (pousa devagar)';
    $('.t-ini').textContent = _fMeVirg(i.ini); $('.t-dur').textContent = _fMeVirg(i.fim - i.ini);
  }

  function roteiro(){
    const tot = st.itens.length;
    st.itens.forEach((i, n) => {
      const cab = 'Peça ' + (n + 1) + ' de ' + tot + ' · ' + i.nome;
      let a, b;
      passo(.38, q => vai(a[0], a[1], b[0], b[1], q), () => {
        fase(cab, 'Colocando na arte'); i.it.classList.add('alvo'); seleciona(null);
        const ls = $('.lista'); if(ls.scrollWidth > ls.clientWidth) ls.scrollLeft = i.it.offsetLeft - ls.clientWidth / 2;
        else ls.scrollTop = i.it.offsetTop - ls.clientHeight / 2;
        a = [st.cx, st.cy]; b = centro(i.it.querySelector('.th'), .5, .5);
      });
      passo(.12, () => {}, () => { cur.classList.add('aperta'); fantasma(i); fant.style.opacity = .92; fantPoe(.5); });
      passo(.55, q => { vai(a[0], a[1], b[0], b[1], q); fantPoe(.5 + .5 * _fMeSeno(q)); },
        () => { const r = tela.getBoundingClientRect(); a = [st.cx, st.cy]; b = [r.left + (i.x0 + i.x1) / 2 * st.k, r.top + (i.y0 + i.y1) / 2 * st.k]; });
      passo(.12, () => {}, () => { cur.classList.remove('aperta'); fant.style.opacity = 0; i.unidades.forEach(u => st.vis.set(u, 'final')); seleciona(i);
        i.it.classList.remove('alvo'); i.it.classList.add('usada'); i.nm.classList.add('on', 'foco');
        $('.alvo').innerHTML = 'Selecionada: <b></b>'; $('.alvo b').textContent = i.nome; });
      passo(.35, q => vai(a[0], a[1], b[0], b[1], q), () => { fase(cab, 'Escolhendo o movimento'); a = [st.cx, st.cy]; b = centro(st.chips[i.efeito], .5, .55); });
      passo(.15, () => {}, () => { cur.classList.add('aperta'); Object.values(st.chips).forEach(c => c.classList.remove('on')); st.chips[i.efeito].classList.add('on'); curva(i); });
      // Solta e TESTA: a peça anima enquanto o cursor já parte para a próxima
      passo(.1, () => {}, () => { cur.classList.remove('aperta'); i.bars.forEach(br => br.classList.add('on')); seleciona(null); $('.sub').textContent = 'Testando a animação';
        st.previas.push({ us: i.unidades, t0: i.ini, t1: i.fim + .1, s0: st.sRot, fim: () => i.nm.classList.remove('foco') }); });
    });
    st.L = st.passos.reduce((s, p) => s + p.dur, 0);
    // Terminou antes do render: revisa o vídeo inteiro em loop até a gravação acabar
    passo(0, el => { st.tGlobal = el % (st.tAssenta + 1.2); playhead(st.tGlobal); },
      () => { fase('Revisando o motion', 'Esperando o vídeo terminar de gravar'); $('.cur-et').textContent = 'revisando…'; seleciona(null); },
      () => st.feito);
    let a, b;
    passo(.4, q => vai(a[0], a[1], b[0], b[1], q), () => { st.tGlobal = null; st.vivos.forEach(u => st.vis.set(u, 'final'));
      fase('Exportando', 'Gravando o MP4'); $('.cur-et').textContent = 'Motion · Luma'; a = [st.cx, st.cy]; b = centro($('.exp'), .5, .55); });
    passo(.16, () => {}, () => { cur.classList.add('aperta'); $('.exp').classList.add('on'); });
    passo(.45, q => playhead(q * SEG), () => cur.classList.remove('aperta'));
    passo(.01, () => {}, () => { if(st.aoTerminar) st.aoTerminar(); });
  }

  /* ── O QUE O motion.js CHAMA ───────────────────────────────────────────────── */
  const api = {
    /* Antes do encoder: separa a arte em peças (uma sprite por unidade, pelo motor único) e
       monta a lista, a timeline e os chips. As miniaturas entram na lista uma a uma, conforme
       ficam prontas — é trabalho real acontecendo. */
    async prepara(plano, resolvidas, W, H, tAssenta){
      st.W = W; st.H = H; st.tAssenta = tAssenta; st.plano = plano;
      st.itens = _fMeItens(plano); st.vivos = st.itens.flatMap(i => i.unidades);
      $('.parado').style.left = (tAssenta / SEG * 100) + '%';

      const efeitos = [...new Set(st.itens.map(i => i.efeito).concat(Object.values(_F_ME_EFEITO)))].slice(0, 8);
      if(st.itens.some(i => i.efeito === 'Vários') && !efeitos.includes('Vários')) efeitos[7] = 'Vários';
      st.chips = {};
      efeitos.forEach(n => { const c = document.createElement('div'); c.className = 'chip'; c.textContent = n; $('.chips').appendChild(c); st.chips[n] = c; });
      st.itens.forEach(i => {
        const it = document.createElement('div'); it.className = 'it';
        it.innerHTML = '<span class="th"><svg viewBox="0 0 24 24">' + (_F_ME_ICONE[i.tipo] || _F_ME_ICONE.forma) + '</svg></span><span></span>'
          + '<svg class="ok" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>';
        it.children[1].textContent = i.nome; $('.lista').appendChild(it); i.it = it;
        const nm = document.createElement('div'); nm.className = 'nome'; nm.innerHTML = '<i></i>'; nm.append(i.nome); $('.nomes').appendChild(nm); i.nm = nm;
        const fx = document.createElement('div'); fx.className = 'faixa';
        i.bars = i.unidades.map(u => { const br = document.createElement('div'); br.className = 'bar' + (u.carona ? ' carona' : '');
          br.style.left = (u.ini / SEG * 100) + '%'; br.style.width = ((u.carona || u).dur / SEG * 100) + '%'; fx.appendChild(br); return br; });
        $('.faixas').appendChild(fx);
      });
      /* Só AGORA mede a tela: as linhas da timeline acabaram de entrar e encolheram o palco.
         Medida antes, a arte vazava por cima da timeline. */
      encaixa(W, H);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = tela.getBoundingClientRect();
      cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
      Object.assign(voo.style, { width: r.width + 'px', height: r.height + 'px', transform: 'translate(' + r.left + 'px,' + r.top + 'px)' });
      st.kp = cv.width / W; st.ctx = cv.getContext('2d');
      addEventListener('resize', () => { if(st.vivo) encaixa(W, H); });

      // As sprites. Um canvas grande reaproveitado; cada peça é desenhada sozinha (as outras
      // ficam `visible:false`) e reduzida ao tamanho da tela do estúdio.
      const grande = document.createElement('canvas'); grande.width = W; grande.height = H;
      const g = grande.getContext('2d');
      const transparente = Object.assign({}, arte.material, { bg: 'transparent' });
      const desenha = async (ids, opaco) => {
        g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
        const camadas = resolvidas.map(l => (!l || l.type === 'group' || ids.has(l.id)) ? l : Object.assign({}, l, { visible: false }));
        await fRenderTemplateLayers(g, camadas, W, H, arte.dados, arte.camp, opaco ? arte.material : transparente,
          { scope: 'franqueado', purpose: 'export', resolvido: true });
        const s = document.createElement('canvas'); s.width = cv.width; s.height = cv.height;
        s.getContext('2d').drawImage(grande, 0, 0, s.width, s.height);
        return s;
      };
      const idsDe = us => new Set(us.flatMap(u => u.folhas.map(f => f.id).concat(u.extras.map(f => f.id), [u.raiz.id])));
      const fundo = idsDe(plano.filter(u => u.papel === 'fundo'));
      resolvidas.forEach(l => { if(l && l.type === 'adjustment') fundo.add(l.id); });
      fase('Abrindo o estúdio', 'Separando as peças da sua arte');
      st.base = await desenha(fundo, true);
      for(let n = 0; n < st.itens.length; n++){
        const i = st.itens[n];
        for(const u of i.unidades) u.sprite = await desenha(idsDe([u]), false);
        // Miniatura real da peça na lista
        const th = i.it.querySelector('.th'), m = document.createElement('canvas');
        const bw = Math.max(1, (i.x1 - i.x0) * st.kp), bh = Math.max(1, (i.y1 - i.y0) * st.kp), esc = 52 / Math.max(bw, bh);
        m.width = Math.max(1, Math.round(bw * esc)); m.height = Math.max(1, Math.round(bh * esc));
        i.unidades.forEach(u => m.getContext('2d').drawImage(u.sprite, i.x0 * st.kp, i.y0 * st.kp, bw, bh, 0, 0, m.width, m.height));
        th.innerHTML = ''; th.appendChild(m);
        i.it.classList.add('vis');
        $('.sub').textContent = 'Separando as peças · ' + (n + 1) + ' de ' + st.itens.length;
      }
      // A arte inteira some do palco: fica o fundo, e o designer remonta peça por peça
      voo.animate([{ opacity: 1 }, { opacity: 0 }], { duration: durBase, easing: _fMeEase('--ease-in'), fill: 'forwards' }).finished
        .then(() => voo.remove()).catch(() => {});
      fase('Peças separadas', st.itens.length + ' peças prontas para animar');
      roteiro();
    },

    // p = fração de quadros prontos (0..1). Estima o tempo total pelo custo medido.
    progresso(p, nMov, nTot){
      const agora = performance.now();
      if(!st.t0) st.t0 = agora;
      st.p = p;
      const f = p * nTot, gasto = (agora - st.t0) / 1000;
      if(f <= nMov){ st.cMov = gasto / Math.max(1, f); st.tMov = agora; st.fMov = f; }
      else if(st.tMov) st.cPar = (agora - st.tMov) / 1000 / Math.max(1, f - st.fMov);
      const cMov = st.cMov || .03, cPar = st.cPar || cMov * .15;
      st.estSeg = nMov * cMov + Math.max(0, nTot - nMov) * cPar;
      st.frac = Math.min(.99, gasto / Math.max(.5, st.estSeg));
      if(p < 1) $('.pe-txt').textContent = 'Gravando quadro ' + Math.round(f) + ' de ' + nTot + ' · mantenha esta aba na frente';
      else $('.pe-txt').textContent = 'Vídeo gravado';
    },

    /* O MP4 ficou pronto: termina o roteiro (acelerando), mostra o vídeo tocando na tela e
       devolve para o mockup. `destino` = onde o vídeo pousa (null = só some). */
    async entrega(url, destino){
      st.feito = true; st.p = 1; st.frac = 1;
      if(st.fechado){ api._encerra(); _fMeAterrissa(null, destino, url); return; }
      if(st.passos.length && st.iP < st.passos.length){
        await new Promise(r => { st.aoTerminar = r; setTimeout(r, 6000); });   // teto: ninguém espera teatro
      }
      if(st.fechado){ api._encerra(); _fMeAterrissa(null, destino, url); return; }
      // O vídeo DE VERDADE toca na tela do estúdio
      const v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.src = url;
      tela.appendChild(v);
      try{ await v.play(); }catch(e){}
      cur.style.opacity = 0; sel.classList.remove('on');
      fase('Seu motion está pronto!', 'Levando para a sua arte');
      _fMeFaiscas(raiz, tela.getBoundingClientRect(), 10);
      /* O quadro 0 do vídeo é só o fundo: voar já seria levar um retângulo laranja. Espera o
         vídeo DE VERDADE montar a arte (até ~o assentar), com teto para ninguém ficar parado. */
      await new Promise(r => { const t0 = performance.now(), alvo = Math.max(.5, (st.tAssenta || 2) * .9);
        const olha = () => (v.currentTime >= alvo || performance.now() - t0 > 3000) ? r() : requestAnimationFrame(olha); olha(); });
      // Desmonta: cada painel sai para o seu lado; o vídeo voa até o mockup
      const durIn = _fMeTok('--dur-base'), easeIn = _fMeEase('--ease-in');
      [['.topo', '0,-20px'], ['.bib', '-40px,0'], ['.insp', '40px,0'], ['.tl', '0,40px'], ['.pe', '0,24px']].forEach(([s, d], n) => {
        $(s).animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate(' + d + ')' }], { duration: durIn, delay: n * 30, easing: easeIn, fill: 'forwards' });
      });
      $('.ve').animate([{ opacity: 1 }, { opacity: 0 }], { duration: _fMeTok('--dur-slow'), delay: durIn * .5, easing: _fMeEase('--ease-out'), fill: 'forwards' });
      const r0 = tela.getBoundingClientRect();
      tela.style.visibility = 'hidden';
      st.vivo = false;
      host.style.pointerEvents = 'none';   // o app volta a ser clicável já durante o voo
      document.removeEventListener('keydown', esc, true);
      await _fMeAterrissa({ raiz, video: v, r0 }, destino, url);
      host.remove();
    },

    falha(){
      st.vivo = false;
      host.animate([{ opacity: 1 }, { opacity: 0 }], { duration: _fMeTok('--dur-base'), easing: _fMeEase('--ease-in'), fill: 'forwards' })
        .finished.then(() => host.remove()).catch(() => host.remove());
      document.removeEventListener('keydown', esc, true);
    },

    _encerra(){ st.vivo = false; host.remove(); document.removeEventListener('keydown', esc, true); }
  };

  /* Fechar NÃO cancela o vídeo (o encoder não tem freio): só tira o teatro da frente. No fim,
     o vídeo pousa direto no mockup. */
  const fecha = () => {
    if(st.fechado) return;
    st.fechado = true; st.vivo = false;
    host.animate([{ opacity: 1 }, { opacity: 0 }], { duration: _fMeTok('--dur-base'), easing: _fMeEase('--ease-in'), fill: 'forwards' })
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
