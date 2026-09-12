/**
 * js/designer/psd-parse.js
 *
 * LEITURA e FIDELIDADE do .psd — a metade do importador que não toca a tela.
 * Carrega o ag-psd, roda o parse em Web Worker (com rebuild fatiado no main thread),
 * e converte cada camada do Photoshop no item intermediário do Luma: texto, forma,
 * gradiente, máscara composta, efeitos, e a decisão de quando rasterizar fiel.
 * Termina em dItemToLayer (item → camada do Luma).
 *
 * A UI de revisão (abas de prancheta, lista de camadas, prévia, relatório de fidelidade)
 * mora em `psd-import.js`, que carrega DEPOIS deste arquivo.
 * Split feito porque o arquivo único passou de 2.400 linhas — parse e UI mudam por
 * motivos diferentes e quase nunca no mesmo commit.
 *
 * FRONTEIRA (10/09/2026): a pergunta "o Luma representa esta camada?" tem UM dono neste
 * arquivo — o ESTÁGIO DE CAPACIDADE (`_dPsdCapNode` no decode, `_dPsdCapItem` depois da
 * interpretação, `_dPsdCapPerdeFx` na conversão). Ele grava um livro-caixa por camada em
 * `it.capability` com nível (native / native_lossy / raster / unsupported), motivo NOMEADO e
 * a etapa em que a decisão aconteceu. Antes essa decisão vivia em seis lugares e a revisão
 * remontava o veredito a partir de doze booleanos soltos.
 * ⛔ Capacidade nova entra em `_DPSD_CAP_MOTIVOS` + uma linha no estágio — nunca como um
 *    booleano novo decidido no meio do walk.
 * Arquitetura, problemas abertos e próximas fronteiras: docs/PSD-ARQUITETURA-2026-09-10.md
 */

/* ── carrega o ag-psd: vendorizado (local, offline) → fallback CDN ── */
let _agPsdPromise=null;
function dLoadAgPsd(){
  if(window.agPsd) return Promise.resolve(window.agPsd);
  if(_agPsdPromise) return _agPsdPromise;
  const sources=['assets/vendor/ag-psd.js','https://cdn.jsdelivr.net/npm/ag-psd/dist/bundle.js'];
  _agPsdPromise=new Promise((resolve,reject)=>{
    let i=0;
    (function tryNext(){
      if(i>=sources.length){ _agPsdPromise=null; reject(new Error('Não foi possível carregar a biblioteca de PSD')); return; }
      const s=document.createElement('script'); s.async=true; s.src=sources[i++];
      s.onload=()=> window.agPsd ? resolve(window.agPsd) : tryNext();
      s.onerror=tryNext;
      document.head.appendChild(s);
    })();
  });
  return _agPsdPromise;
}

/* ── helpers de leitura ── */
// ag-psd devolve o blend mode como chave separada por ESPAÇO ('color burn', 'soft light',
// 'linear dodge'…). O motor de blend (blending.js) e o CSS usam camelCase ('colorBurn'). Sem
// normalizar, modos de 2+ palavras não eram aplicados (nem na arte final nem no preview) —
// dBlendToComposite('color burn') caía em undefined. DBLEND_PSD_MAP faz a ponte.
function _dPsdBlendMode(bm){
  if(!bm || bm==='normal' || bm==='passThrough') return undefined;
  if(typeof DBLEND_PSD_MAP==='undefined') return undefined;
  if(DBLEND_PSD_MAP[bm]) return DBLEND_PSD_MAP[bm];           // nome com espaço ("color burn") → camelCase
  // ag-psd já em camelCase: aceita SÓ se for um modo conhecido. Um modo sem render (ex.: "dissolve")
  // vira Normal explícito — senão o badge "Mesclagem · dissolve" mentia (renderizava normal).
  return (Object.values(DBLEND_PSD_MAP).indexOf(bm)>=0) ? bm : undefined;
}
function _dPsdHex(c){
  if(!c||c.r==null) return null;
  const h=v=>('0'+Math.max(0,Math.min(255,Math.round(v))).toString(16)).slice(-2);
  return '#'+h(c.r)+h(c.g)+h(c.b);
}
function _dPsdTextStyle(t){
  if(!t) return {};
  if(t.style && typeof t.style==='object') return t.style;
  if(t.styleRuns && t.styleRuns[0] && t.styleRuns[0].style) return t.styleRuns[0].style;
  return {};
}
// Estilo de PARÁGRAFO efetivo (paragraphStyle ou o 1º run) — a fonte do alinhamento e do
// fator de auto-entrelinha. Um só leitor para os dois (não duplicar a mesma navegação).
function _dPsdParaStyle(t){
  return (t&&t.paragraphStyle)||(t&&t.paragraphStyleRuns&&t.paragraphStyleRuns[0]&&t.paragraphStyleRuns[0].style)||{};
}
// Alinhamento. ag-psd devolve 7 valores: left|right|center|justify-left|justify-right|
// justify-center|justify-all. Os quatro "justify-*" já carregam o alinhamento da ÚLTIMA linha —
// é esse que usamos, porque NENHUM dos renderizadores do Luma distribui palavras na largura da
// caixa. Devolve `justified` junto para a revisão avisar (perda calada é pior que perda avisada).
function _dPsdAlign(t){
  const p=_dPsdParaStyle(t);
  const j=String(p.justification||p.align||'left').toLowerCase();
  const justified=j.indexOf('justify')>=0;
  const justifyAll=(j==='justify-all'); // estica TODAS as linhas, inclusive a última
  if(j.includes('center')||j.includes('middle')) return {align:'center', justified, justifyAll};
  if(j.includes('right')) return {align:'right', justified, justifyAll};
  return {align:'left', justified, justifyAll};
}
// Escala vertical do transform de texto. Robusta a rotação/cisalhamento: usa a magnitude do
// vetor-y da matriz (c,d) em vez de só |d|. Fallback 1.
function _dPsdFontScale(tr){
  if(!tr || tr.length<4) return 1;
  const c=+tr[2]||0, d=+tr[3]||0, s=Math.sqrt(c*c+d*d);
  return (isFinite(s)&&s>0)?s : (Math.abs(d)||1);
}
/* ══ ESCALA EFETIVA DE UM TEXTO — as TRÊS fontes de escala, num lugar só ══════════════════
   O Photoshop guarda a escala de um texto em três lugares independentes, e o parser lia um:
     1. a matriz `text.transform` — a transformação da CAMADA (o que o Ctrl+T faz);
     2. `style.horizontalScale` / `style.verticalScale` — os campos de % do painel Caractere,
        que o designer usa para condensar ou esticar a letra sem mudar o corpo. Default 100,
        e o parser NUNCA os leu: um título condensado a 85% importava em 100%;
     3. a resolução do documento — o corpo vem em PONTOS e a prancheta vive em PIXEL.
   Devolve os dois eixos separados, porque `sx≠sy` é informação (§6 do briefing) e não pode ser
   normalizada em corpo de fonte: achatar as duas num número é perder o estiramento. */
function _dPsdTextScale(t){
  const st=_dPsdTextStyle(t);
  const tr=(t&&t.transform&&t.transform.length>=4)?t.transform:[1,0,0,1,0,0];
  const a=+tr[0]||0,b=+tr[1]||0,c=+tr[2]||0,d=+tr[3]||0;
  // Magnitude de cada vetor-coluna: imune a rotação e a cisalhamento, ao contrário de |a|/|d|.
  const trX=Math.sqrt(a*a+b*b)||1, trY=Math.sqrt(c*c+d*d)||1;
  // % do painel Caractere. `!=null` e não `||`: 0 é valor inválido, mas 100 é o default e
  // precisa passar; e um `verticalScale:0` num arquivo torto não pode zerar o corpo.
  const chX=(st.horizontalScale!=null&&+st.horizontalScale>0)?(+st.horizontalScale/100):1;
  const chY=(st.verticalScale!=null&&+st.verticalScale>0)?(+st.verticalScale/100):1;
  const sx=trX*chX, sy=trY*chY;
  // Rotação e cisalhamento vêm da mesma matriz — quem decide o que fazer com eles é
  // `_dPsdCapNode` (rotação → raster fiel), aqui só se mede.
  const rot=Math.atan2(b,a)*180/Math.PI;
  return {
    sx, sy,
    trX, trY, chX, chY,
    // Tolerância de 1%: arredondamento de matriz não é estiramento intencional.
    uniforme: Math.abs(sx-sy) <= Math.max(sx,sy)*0.01,
    razao: sy>0 ? sx/sy : 1,
    rotacao: Math.round(rot*100)/100
  };
}
/* ══ CORPO EFETIVO EM PIXEL DE DOCUMENTO ══════════════════════════════════════════════════
   A fórmula explícita que substitui a heurística:

       corpoPx = style.fontSize × escalaY × fatorDeResolucao

   `escalaY` sai de `_dPsdTextScale` (transform × painel Caractere). O terceiro fator é o que
   não era determinístico: o corpo vem em PONTOS, a prancheta em PIXEL, e em documento hi-res
   (300dpi) o mesmo "24 pt" do painel são 100 px. O código antigo decidia isso com um limiar —
   `if(res>90 && _tScale<1.5) fs*=res/72` — cujo `1.5` era um palpite sobre "o transform já
   trouxe a resolução?". Palpite errado dobrava o corpo ou o deixava 4× pequeno.
   O DISCRIMINADOR AGORA É O PRÓPRIO ARQUIVO: `text.bounds` é a caixa do texto em text-space
   (descritor TySh, em pontos) e o transform a leva para o espaço do documento. Se a altura
   já mapeada explica a caixa de pixels da camada, a resolução JÁ está no transform e o fator
   é 1; se falta justamente ~res/72, o fator é res/72.
   ⚠ `text.bounds` é a caixa do MOTOR DE TEXTO: não cresce com sombra nem contorno, ao
   contrário de `node.top/bottom`. É por isso que serve de régua e o bbox de pixels não serve.
   Sem `bounds` utilizável, cai na regra anterior (res/72 quando o documento é hi-res) — que
   é o caso dominante e agora é o FALLBACK, não a regra. */
function _dPsdFatorResolucao(t, node, res, sy){
  const r=+res||72;
  const dpi=(r>90)?(r/72):1;
  if(dpi===1) return {fator:1, fonte:'documento a 72dpi'};
  const bb=t&&t.bounds;
  const st=_dPsdTextStyle(t);
  const corpo=+(st.fontSize||st.size||0);
  if(bb && corpo>0 && node){
    const hTexto=Math.abs((+bb.bottom||0)-(+bb.top||0));           // text-space (pontos)
    const hPixel=Math.abs((+node.bottom||0)-(+node.top||0));        // documento (pixels)
    if(hTexto>0.5 && hPixel>0.5){
      // Escala real text-space → documento, medida no arquivo.
      const medida=hPixel/hTexto;
      // Ela combina com `sy` sozinho, ou só com `sy × dpi`? Vence a hipótese mais próxima.
      const semDpi=Math.abs(medida-sy), comDpi=Math.abs(medida-sy*dpi);
      return comDpi<semDpi
        ? {fator:dpi, fonte:'bounds do motor de texto pediram res/72'}
        : {fator:1,   fonte:'bounds do motor de texto já em pixel (transform carrega a resolução)'};
    }
  }
  return {fator:dpi, fonte:'sem bounds utilizável — regra res/72 do documento hi-res'};
}
/* ══ TRACKING → PIXEL: uma função, três consumidores ══════════════════════════════════════
   O Photoshop mede tracking em MILÉSIMOS DE EM: `tracking:-20` é −0,02 em, e em em depende do
   corpo. A conversão é `px = tracking/1000 × corpoPx` — e ela estava escrita duas vezes (a
   camada e cada trecho de `_dPsdRichRuns`), com `Math.round` nas duas.
   ⚠ Sem arredondar: em corpo pequeno, −0,4px arredondava para 0 e o aperto do designer
   desaparecia; em corpo grande, o erro de meio pixel por letra somava na linha. Os três
   renderizadores aceitam fracionário (`ctx.letterSpacing` e `letter-spacing` em CSS).
   `0` é resultado legítimo e precisa ser gravado: ele impede o respiro automático que os
   títulos nativos do Luma aplicam. */
function _dPsdTracking(tracking, corpoPx){
  const t=+tracking||0;
  if(!t) return 0;
  return Math.round((t/1000)*(+corpoPx||12)*100)/100;
}
/* ══ ENTRELINHA → FATOR: uma função ═══════════════════════════════════════════════════════
   O modelo do Luma guarda entrelinha como FATOR do corpo (`l.lineHeight`), o Photoshop como
   medida absoluta (`leading`, em pontos) ou como "Auto".
   AUTO é o padrão do Photoshop e o caso mais comum: aí `style.leading` guarda LIXO — sobra de
   um estado anterior do arquivo — e ler esse valor trazia entrelinhas absurdas. O fator do
   Auto mora em `paragraphStyle.autoLeading` (1.2 no Photoshop).
   EXPLÍCITO: `leading/fontSize`, ambos em pontos, então a razão é adimensional e a resolução
   se cancela — nenhum fator de DPI entra aqui, e é por isso que esta função não recebe `res`.
   O ramo antigo tinha um `leading*(res/72)` para o caso "sem fontSize", que dividia px por px;
   virou o mesmo caminho, porque a razão não muda. */
function _dPsdLeading(t, corpoPx){
  const st=_dPsdTextStyle(t);
  if(st.autoLeading===true || !st.leading){
    const f=+_dPsdParaStyle(t).autoLeading;
    return (isFinite(f)&&f>0.5&&f<5)?+f.toFixed(3):1.2;
  }
  // Razão em PONTOS quando o corpo em pontos existe (o caso normal).
  const ptCorpo=+st.fontSize||+st.size||0;
  if(ptCorpo>0){ const r=+st.leading/ptCorpo; return (isFinite(r)&&r>0.3&&r<6)?+r.toFixed(3):1.2; }
  // Sem corpo em pontos: razão contra o corpo em pixel. Mesma adimensionalidade.
  const r2=+st.leading/(+corpoPx||12);
  return (isFinite(r2)&&r2>0.3&&r2<6)?+r2.toFixed(3):1.2;
}
/* ══ MÉTRICA DE TEXTO — a fonte da verdade de escala, corpo, entrelinha e tracking ════════
   Um lugar, uma fórmula, e o mesmo caminho para point e para box (antes divergiam):

       corpoPx = style.fontSize × escalaY × fatorDeResolucao

   Tudo o que entra é explícito do arquivo: `style.fontSize` (pontos), `escalaY` de
   `_dPsdTextScale` (transform × painel Caractere), e o fator de resolução decidido por
   `_dPsdFatorResolucao` contra os `bounds` do motor de texto.
   ⛔ NENHUM número mágico decide o corpo. A antiga cascata usava seis: o limiar `1.5` para
   adivinhar se o transform já tinha a resolução, o `1.25` de entrelinha presumida, o teto
   `180`, e a faixa de plausibilidade `0.4`–`2.5` que TROCAVA o corpo do designer pelo
   estimado a partir da caixa. Esse último era o pior: um "R$" de 12px num bbox alto era
   considerado implausível e virava outro tamanho — o Photoshop dizia um número e o Luma
   usava outro, sem registrar.
   A ÚNICA queda que sobrou é para quando o arquivo não traz corpo nenhum, e ela é registrada
   em `origem` para o diagnóstico dizer que o valor é estimado e não autorado. */
function _dPsdTextMetrics(t, node, res, content){
  const st=_dPsdTextStyle(t);
  const esc=_dPsdTextScale(t);
  const corpoPt=+(st.fontSize||st.size||0);
  let corpoPx=0, origem='', fatorRes=1, fonteRes='';
  if(corpoPt>0){
    const fr=_dPsdFatorResolucao(t, node, res, esc.sy);
    fatorRes=fr.fator; fonteRes=fr.fonte;
    corpoPx=corpoPt*esc.sy*fatorRes;
    origem='autorado';
  }
  if(!(corpoPx>=1)){
    /* Arquivo sem corpo utilizável. A estimativa pela caixa é a única saída, e fica marcada
       como estimativa: 1.2 é o Auto do Photoshop, não um número escolhido aqui. */
    const h=Math.max(1,Math.abs((+((node&&node.bottom))||0)-(+((node&&node.top))||0)));
    const nLinhas=Math.max(1, String(content||'').split('\n').filter(x=>x.trim()).length);
    corpoPx=h/(nLinhas*1.2);
    origem='estimado pela caixa (o arquivo não trouxe corpo)';
  }
  // Piso 8px: abaixo disso nenhum renderizador desenha algo legível. Sem teto: um título de
  // 220pt a 300dpi são ~917px e é isso que o designer desenhou — o teto antigo o encolhia.
  const corpo=Math.max(8, Math.round(corpoPx));
  return {
    corpo,
    corpoPt, escala:esc, fatorResolucao:fatorRes, fonteResolucao:fonteRes, origem,
    entrelinha:_dPsdLeading(t, corpo),
    tracking:_dPsdTracking(st.tracking, corpo),
    // Deslocamento de baseline do painel Caractere (sobrescrito/subscrito), em pontos → px.
    // É o que levanta os centavos em "R$ 29,90" — dado explícito que ninguém lia.
    baselineShift:st.baselineShift ? Math.round((+st.baselineShift)*esc.sy*fatorRes*100)/100 : 0
  };
}
/* Contrato antigo preservado (a suíte e `_dPsdRichRuns` chamam por este nome), agora derivado
   da métrica única em vez de ter a sua própria cascata. */
function _dPsdFontSize(t,h,content,res){
  return _dPsdTextMetrics(t, {top:0,bottom:h||0}, res, content).corpo;
}
// Caixa de PARÁGRAFO (box text): deriva {x,y,w,h} em px ABSOLUTOS do doc — a caixa 1:1 que o
// designer desenhou no Photoshop, para NÃO reencaixar/encolher o texto na importação.
// ag-psd expõe a caixa em text-space por duas vias (boxBounds via EngineData e bounds via
// descriptor TySh), mais o transform afim. O espaço de cada uma varia entre versões/arquivos,
// então geramos TODOS os candidatos (cada fonte × {transform, cru}) e escolhemos por SCORE
// (o quão bem a caixa "abraça" o bbox de glifos do layer) em vez de aceitar/rejeitar no grito.
// Isso recupera a caixa real mesmo quando ela é maior que os glifos (caso comum) — o antigo
// teste de contenção estrita rejeitava e caía no bbox apertado, quebrando a hierarquia textual.
function _dPsdParagraphBox(node){
  try{
    const t=node.text; if(!t) return null;
    const tr=(t.transform&&t.transform.length>=6)?t.transform:[1,0,0,1,0,0];
    const a=tr[0],b=tr[1],c=tr[2],d=tr[3],e=tr[4],f=tr[5];
    const gx0=node.left||0, gy0=node.top||0, gx1=node.right||0, gy1=node.bottom||0;
    const gw=Math.max(1,gx1-gx0), gh=Math.max(1,gy1-gy0), gArea=gw*gh;
    // Normaliza as fontes de caixa em {left,top,right,bottom}
    const norm=bb=>{
      if(!bb) return null;
      if(Array.isArray(bb)) bb={left:bb[0],top:bb[1],right:bb[2],bottom:bb[3]};
      if(bb.left==null||bb.right==null||bb.top==null||bb.bottom==null) return null;
      return bb;
    };
    const sources=[norm(t.boxBounds), norm(t.bounds)].filter(Boolean);
    if(!sources.length) return null;
    const corners=(bb,map)=>{
      const p=[map(bb.left,bb.top),map(bb.right,bb.top),map(bb.right,bb.bottom),map(bb.left,bb.bottom)];
      let mnX=Infinity,mnY=Infinity,mxX=-Infinity,mxY=-Infinity;
      p.forEach(q=>{ if(q[0]<mnX)mnX=q[0]; if(q[0]>mxX)mxX=q[0]; if(q[1]<mnY)mnY=q[1]; if(q[1]>mxY)mxY=q[1]; });
      return {x:mnX,y:mnY,w:mxX-mnX,h:mxY-mnY};
    };
    const cands=[];
    sources.forEach(bb=>{
      cands.push(Object.assign(corners(bb,(x,y)=>[a*x+c*y+e, b*x+d*y+f]), {isTransformed:true})); // text-space → doc (transform)
      cands.push(Object.assign(corners(bb,(x,y)=>[x,y]), {isTransformed:false})); // já em px de doc (cru)
    });
    const maxW=Math.max(gw*8,6000), maxH=Math.max(gh*8,6000);
    // Score: exige dimensão sã e que a caixa contenha ao menos metade do bbox de glifos.
    // Prefere caixa transformada (com escala) se cobrir a mesma área que a crua,
    // desempata priorizando o canto superior-esquerdo, ignorando a penalidade pura de área.
    const score=box=>{
      if(!box||!isFinite(box.w)||!isFinite(box.h)||box.w<=1||box.h<=1) return -Infinity;
      if(box.w>maxW||box.h>maxH) return -Infinity;
      const ix=Math.max(0, Math.min(box.x+box.w,gx1)-Math.max(box.x,gx0));
      const iy=Math.max(0, Math.min(box.y+box.h,gy1)-Math.max(box.y,gy0));
      const cover=(ix*iy)/gArea;             // 1.0 = contém todo o bbox de glifos
      if(cover<0.5) return -Infinity;        // caixa longe/torta dos glifos → descarta
      /* Alguns PSDs clonados carregam um `boxBounds` VELHO compartilhado por várias layers
         independentes (R$, inteiro, centavos, "POR"). Ele contém os glifos e por isso passava
         no teste de cobertura, mas seu ponto de texto vive em outra parte da caixa: importar
         essa origem empilhava todos os fragmentos no mesmo x/y. O Luma ainda não representa a
         matriz interna do Photoshop; quando a âncora diverge demais, o bbox dos glifos é a única
         geometria 1:1 segura. A tolerância usa o corpo efetivo e honra left/center/right. */
      const st=_dPsdTextStyle(t), fs=Math.max(8,(+(st.fontSize||st.size)||12)*_dPsdFontScale(tr));
      const align=_dPsdAlign(t).align;
      const ancoraGlifo=align==='center'?(gx0+gx1)/2:align==='right'?gx1:gx0;
      const ancoraBox=align==='center'?box.x+box.w/2:align==='right'?box.x+box.w:box.x;
      if(Math.abs(ancoraGlifo-ancoraBox)>Math.max(8,fs*0.55))return -Infinity;
      if(Math.abs(gy0-box.y)>Math.max(8,fs*1.25))return -Infinity;
      const dCorner=Math.abs(box.x-gx0)+Math.abs(box.y-gy0);
      return cover*1000 - dCorner*0.01 + (box.isTransformed ? 50 : 0);
    };
    let best=null,bestScore=-Infinity;
    cands.forEach(box=>{ const s=score(box); if(s>bestScore){ bestScore=s; best=box; } });
    if(!best || bestScore===-Infinity) return null;
    return {x:Math.round(best.x),y:Math.round(best.y),w:Math.round(best.w),h:Math.round(best.h)};
  }catch(e){ return null; }
}
// Ângulo da LUZ GLOBAL do documento (psd.imageResources.globalAngle). No Photoshop "Usar luz
// global" vem LIGADO por padrão: nesse caso o ângulo que vale é este, não o gravado no efeito
// (que fica defasado). Sem isto, as sombras importavam apontando pro lado errado.
let _dPsdGlobalLight=null;
function _dPsdReadGlobalLight(psd){
  try{
    const g=(psd&&psd.imageResources&&psd.imageResources.globalAngle);
    const v=(g!=null)?g:(psd&&psd.globalAngle);
    return (v!=null && isFinite(+v)) ? +v : null;
  }catch(e){ return null; }
}
// #2 — efeitos de camada (layer.effects) → props da Luma. Lê sombra projetada, sombra interna,
// brilho externo, sobreposição de cor e contorno (com alinhamento). _u: parseUnits → {value} ou número.
function _dPsdEffects(node){
  const fx=node.effects||{}; const out={};
  const _u=v=>{ if(v==null) return 0; return (v.value!=null)?+v.value:+v; };
  // Ângulo efetivo do efeito: luz global vence quando o efeito pede por ela.
  const _ang=e=>{
    if(e.useGlobalLight && _dPsdGlobalLight!=null) return Math.round(_dPsdGlobalLight);
    return (e.angle!=null)?Math.round(e.angle):null;
  };
  // O modelo legado continua recebendo o 1º efeito para compatibilidade. Quando há 2+ instâncias,
  // a pilha completa é criada mais abaixo; _fxOverflow só permanece ligado se algo dessa pilha
  // não puder ser descrito pelo Luma.
  const _first=x=>{ if(Array.isArray(x)){ const on=x.filter(e=>e&&e.enabled!==false); if(on.length>1) out._fxOverflow=true; return on[0]||x[0]; } return x; };
  // Sombra projetada
  let ds=_first(fx.dropShadow);
  if(ds && ds.enabled!==false){
    out.shadow=true;
    out.shadowColor=gFxRgba(_dPsdHex(ds.color)||'#000000', ds.opacity!=null?ds.opacity:.5);
    out.shadowBlur=Math.round(_u(ds.size));
    out.shadowDist=Math.round(_u(ds.distance));
    const _a=_ang(ds); if(_a!=null) out.shadowAngle=_a;
    // choke = "propagação" do PS: dilata a silhueta ANTES do desfoque. Sem ela, sombra
    // dura/marcada importava difusa demais.
    if(_u(ds.choke)>0) out.shadowSpread=Math.round(_u(ds.choke));
  }
  // Sombra interna
  let is=_first(fx.innerShadow);
  if(is && is.enabled!==false){
    out.innerShadow=true;
    out.innerShadowColor=gFxRgba(_dPsdHex(is.color)||'#000000', is.opacity!=null?is.opacity:.5);
    out.innerShadowBlur=Math.round(_u(is.size));
    out.innerShadowDist=Math.round(_u(is.distance));
    const _ai=_ang(is); if(_ai!=null) out.innerShadowAngle=_ai;
    if(_u(is.choke)>0) out.innerShadowSpread=Math.round(_u(is.choke));
  }
  // Brilho externo
  let og=_first(fx.outerGlow);
  if(og && og.enabled!==false){
    out.glow=true;
    out.glowColor=gFxRgba(_dPsdHex(og.color)||'#ffffff', og.opacity!=null?og.opacity:.6);
    out.glowSize=Math.max(1,Math.round(_u(og.size)));
    if(_u(og.choke)>0) out.glowSpread=Math.round(_u(og.choke));
  }
  // Brilho interno (inner glow)
  let ig=_first(fx.innerGlow);
  if(ig && ig.enabled!==false){
    out.innerGlow=true;
    out.innerGlowColor=gFxRgba(_dPsdHex(ig.color)||'#ffffff', ig.opacity!=null?ig.opacity:.6);
    out.innerGlowSize=Math.max(1,Math.round(_u(ig.size)));
  }
  // Chanfro/relevo (bevel & emboss) → aprox.: realce + sombra internos
  let bv=_first(fx.bevel);
  if(bv && bv.enabled!==false){
    out.bevel=true;
    out.bevelSize=Math.max(1,Math.round(_u(bv.size)));
    if(bv.angle!=null) out.bevelAngle=Math.round(bv.angle);
    out.bevelHighlight=gFxRgba(_dPsdHex(bv.highlightColor)||'#ffffff', bv.highlightOpacity!=null?bv.highlightOpacity:.75);
    out.bevelShadow=gFxRgba(_dPsdHex(bv.shadowColor)||'#000000', bv.shadowOpacity!=null?bv.shadowOpacity:.75);
  }
  // Sobreposição de cor (color overlay / solidFill)
  let so=_first(fx.solidFill);
  if(so && so.enabled!==false && so.color){
    out.overlay=true;
    out.overlayColor=_dPsdHex(so.color)||'#000000';
    out.overlayOpacity=(so.opacity!=null?+so.opacity:1);
    // blendMode do efeito (multiply/screen/etc). O overlay simples (substituição de cor) falsearia →
    // overlayBlend é consumido no fim do parse e força rasterização fiel da camada.
    if(so.blendMode && so.blendMode!=='normal') out.overlayBlend=so.blendMode;
  }
  // Sobreposição de gradiente (gradient overlay)
  let go2=_first(fx.gradientOverlay);
  if(go2 && go2.enabled!==false && go2.gradient && go2.gradient.colorStops){
    const src=go2.gradient;
    let goStops=src.colorStops.map(s=>({color:_dPsdHex(s.color)||'#000000', pos:Math.max(0,Math.min(1,s.location||0)), opacity:_dPsdOpacityAt(src.opacityStops, s.location||0)}));
    if(src.reverse){ goStops=goStops.map(s=>({...s,pos:1-s.pos})).reverse(); }
    const _gs=_dPsdGradStyle(go2.type||src.style, goStops);
    out.gradientOverlay={
      type:_gs.type,
      angle:Math.round(-(go2.angle!=null?go2.angle:90)), // PS anti-horário → Luma horário
      opacity:(go2.opacity!=null?+go2.opacity:1),
      stops:_gs.stops
    };
    // Efeito ≠ preenchimento: o pixel do node.canvas NÃO traz a sobreposição, então rasterizar
    // não salvaria o cônico/losango. Só resta avisar.
    if(_gs.unsupported) out.gradientOverlayApprox=_gs.unsupported;
    if(go2.blendMode && go2.blendMode!=='normal') out.gradientOverlay.blendMode=go2.blendMode;
  }
  // Contorno (frame FX) + alinhamento
  let st=_first(fx.stroke);
  if(st && st.enabled!==false){
    // +_sv||2: size pode vir {value:0}/unidade estranha — sem o guard, Math.round(objeto)=NaN
    const _sv=(st.size&&st.size.value!=null)?st.size.value:st.size;
    out.strokeW=Math.max(1,Math.round(+_sv||2));
    // Traço com GRADIENTE/PADRÃO: o modelo só tem cor sólida e st.color vem vazio — o traço
    // virava PRETO, que é pior que qualquer aproximação. Usa o 1º stop do gradiente e avisa.
    let _stHex=_dPsdHex((st.color&&(st.color.color||st.color)));
    if(!_stHex && st.gradient && st.gradient.colorStops && st.gradient.colorStops.length){
      _stHex=_dPsdHex(st.gradient.colorStops[0].color); out.strokeApprox=true;
    }
    if(!_stHex && st.fillType && st.fillType!=='color') out.strokeApprox=true; // padrão: sem cor amostrável
    out.strokeColor=_stHex||'#000000';
    if(st.position) out.strokeAlign=({inside:'inside',insetFrame:'inside',center:'center',centeredFrame:'center',outside:'outside',outsetFrame:'outside'}[st.position])||'outside';
  }
  // Efeitos que o Luma NÃO representa. Rasterizar não adianta: efeito de camada é vetorial no PS
  // e NÃO está no node.canvas — a imagem sairia sem ele do mesmo jeito. Então a saída honesta é
  // registrar e avisar na revisão, em vez de sumir calado.
  const _sat=_first(fx.satin);
  if(_sat && _sat.enabled!==false) out.fxSatin=true;                       // Cetim: sem equivalente
  // Atenção à unidade: sem unidade o ag-psd devolve FRAÇÃO (1 = 100%, o padrão). Ler isso como
  // porcentagem fazia todo PSD com efeito acusar "escala a 1%".
  const _sclRaw=(fx.scale&&fx.scale.value!=null)?+fx.scale.value:+fx.scale;
  if(isFinite(_sclRaw) && _sclRaw>0){
    const _pct=(fx.scale&&fx.scale.units==='Percent')?_sclRaw:_sclRaw*100;
    if(Math.round(_pct)!==100) out.fxScale=Math.round(_pct);
  }
  // Contorno customizado muda o PERFIL do fade (curva !== linear padrão).
  const _hasCont=e=>!!(e && e.enabled!==false && e.contour && ((e.contour.curve && e.contour.curve.length>2) || (e.contour.name&&!/^linear$/i.test(e.contour.name))));
  if(_hasCont(ds)||_hasCont(is)||_hasCont(og)||_hasCont(ig)) out.fxContour=true;
  // Photoshop aceita várias instâncias de sombra/overlay/traço na MESMA camada. Preservamos a
  // pilha só quando ela realmente é múltipla; camadas comuns continuam no modelo legado enxuto.
  // A ordem do array é mantida para o renderer compor como no painel Layer Style.
  const many=k=>Array.isArray(fx[k])?fx[k].filter(e=>e&&e.enabled!==false):[];
  const multiKeys=['dropShadow','innerShadow','solidFill','gradientOverlay','stroke'];
  if(multiKeys.some(k=>many(k).length>1)){
    const stack=[];let complete=true;
    many('dropShadow').forEach(e=>{const a=_ang(e);stack.push({type:'dropShadow',color:gFxRgba(_dPsdHex(e.color)||'#000000',e.opacity!=null?e.opacity:.5),blur:Math.round(_u(e.size)),distance:Math.round(_u(e.distance)),angle:a!=null?a:120,spread:Math.round(_u(e.choke)||0),blendMode:_dPsdBlendMode(e.blendMode)});});
    many('innerShadow').forEach(e=>{const a=_ang(e);stack.push({type:'innerShadow',color:gFxRgba(_dPsdHex(e.color)||'#000000',e.opacity!=null?e.opacity:.5),blur:Math.round(_u(e.size)),distance:Math.round(_u(e.distance)),angle:a!=null?a:120,spread:Math.round(_u(e.choke)||0),blendMode:_dPsdBlendMode(e.blendMode)});});
    many('solidFill').forEach(e=>stack.push({type:'colorOverlay',color:_dPsdHex(e.color)||'#000000',opacity:e.opacity!=null?+e.opacity:1,blendMode:_dPsdBlendMode(e.blendMode)}));
    many('gradientOverlay').forEach(e=>{
      if(!e.gradient||!e.gradient.colorStops){complete=false;return;}
      const src=e.gradient;let stops=src.colorStops.map(s=>({color:_dPsdHex(s.color)||'#000000',pos:Math.max(0,Math.min(1,s.location||0)),opacity:_dPsdOpacityAt(src.opacityStops,s.location||0)}));
      if(src.reverse)stops=stops.map(s=>({...s,pos:1-s.pos})).reverse();const gs=_dPsdGradStyle(e.type||src.style,stops);if(gs.unsupported){complete=false;return;}
      stack.push({type:'gradientOverlay',gradient:{type:gs.type,angle:Math.round(-(e.angle!=null?e.angle:90)),opacity:e.opacity!=null?+e.opacity:1,stops:gs.stops},blendMode:_dPsdBlendMode(e.blendMode)});
    });
    many('stroke').forEach(e=>{
      const fillType=e.fillType||'color';if(fillType!=='color'||!e.color){complete=false;return;}
      const sv=(e.size&&e.size.value!=null)?e.size.value:e.size;
      stack.push({type:'stroke',width:Math.max(1,Math.round(+sv||2)),color:_dPsdHex(e.color.color||e.color)||'#000000',align:({inside:'inside',insetFrame:'inside',center:'center',centeredFrame:'center',outside:'outside',outsetFrame:'outside'}[e.position])||'outside',opacity:e.opacity!=null?+e.opacity:1,blendMode:_dPsdBlendMode(e.blendMode)});
    });
    if(stack.length)out.layerEffects=stack;
    out.layerEffectsComplete=complete;
    out.layerEffectsApprox=stack.some(e=>e.blendMode&&e.blendMode!=='normal');
    out._fxOverflow=!complete;
  }
  return out;
}
// Cor sólida EXATA de uma camada de forma/preenchimento (vectorFill type='color').
// É a cor que o designer definiu — fiel 1:1, sem o erro de amostrar pixels (anti-aliasing,
// opacidade, blend). Retorna hex ou null (aí cai na amostragem de pixels como fallback).
function _dPsdVectorSolidColor(node){
  try{ const vf=node&&node.vectorFill; if(vf && vf.type==='color' && vf.color) return _dPsdHex(vf.color); }catch(e){}
  return null;
}
// Tipo de forma EXATO via vectorOrigination.keyOriginType (1=retângulo, 2=retângulo arredondado,
// 4=elipse). Mais fiel que inferir por pixels. Retorna {kind,radius} ou null (cai no heurístico).
function _dPsdVectorShapeKind(node, w, h){
  try{
    const list=node&&node.vectorOrigination&&node.vectorOrigination.keyDescriptorList;
    if(!list||!list.length) return null;
    let ot=null; for(let i=0;i<list.length;i++){ if(list[i]&&list[i].keyOriginType!=null){ ot=list[i].keyOriginType; break; } }
    if(ot==null) return null;
    if(ot===4){ const r=w/h; return {kind:(r>0.85&&r<1.18)?'circle':'ellipse', radius:0}; } // elipse/círculo
    if(ot===1||ot===2) return {kind:'rect', radius:0}; // retângulo (raio por-canto vem de _dPsdCornerRadii)
    return null; // linha/custom → deixa o heurístico de pixel decidir
  }catch(e){ return null; }
}
/* O ID de uma camada importada do PSD nasce AQUI e em nenhum outro lugar. A fórmula estava
   escrita duas vezes — em `dItemToLayer` e no `clipBaseId` do pós-processamento — e o dia em que
   as duas divergissem o clipping editável quebraria EM SILÊNCIO: `_layerById.get(clipBaseId)`
   devolveria undefined, o recorte sumiria do PNG e nenhum erro apareceria. */
function _dPsdItemId(it){ return 'l-psd-'+it.n+'-'+(it.x+it.y); }
// Caixa do CAMINHO vetorial, diferente de node.left/top/right/bottom (que inclui a expansão do
// stroke). Usar o bounds do layer como path deslocava um contorno de 5px ~4px para fora.
function _dPsdVectorShapeBox(node, ox, oy){
  try{
    const list=node&&node.vectorOrigination&&node.vectorOrigination.keyDescriptorList;
    if(!list)return null;
    for(const d of list){
      const b=d&&d.keyOriginShapeBoundingBox; if(!b)continue;
      const v=x=>(x&&x.value!=null)?+x.value:+x;
      const l=v(b.left),t=v(b.top),r=v(b.right),bt=v(b.bottom);
      if([l,t,r,bt].every(Number.isFinite)&&r>l&&bt>t)return{x:Math.round(l-(ox||0)),y:Math.round(t-(oy||0)),w:Math.max(1,Math.round(r-l)),h:Math.max(1,Math.round(bt-t))};
    }
  }catch(e){}
  return null;
}
// #2 — detecta cor sólida uniforme num canvas → hex (ou null)
function _dPsdSolidColor(canvas){
  try{
    const w=canvas.width,h=canvas.height; if(w<2||h<2) return null;
    const data=canvas.getContext('2d').getImageData(0,0,w,h).data;
    const sx=Math.max(1,Math.floor(w/40)), sy=Math.max(1,Math.floor(h/40));
    let r0=-1,g0=0,b0=0,opaque=0,total=0;
    for(let y=0;y<h;y+=sy) for(let x=0;x<w;x+=sx){
      const i=(y*w+x)*4, a=data[i+3]; total++;
      if(a<200) continue; opaque++;
      if(r0<0){ r0=data[i];g0=data[i+1];b0=data[i+2]; }
      else if(Math.abs(data[i]-r0)>10||Math.abs(data[i+1]-g0)>10||Math.abs(data[i+2]-b0)>10) return null;
    }
    if(r0<0 || opaque/total<0.6) return null;
    return _dPsdHex({r:r0,g:g0,b:b0});
  }catch(e){ return null; }
}
// #4c — raster comprimido: downscale + PNG p/ transparência (e p/ o pixel que é fonte única).
// A detecção de alpha é EXATA, não amostrada. A grade antiga de 50×50 pulava até 64px de cada
// vez num raster de 3200: recorte de borda fina, furo pequeno ou fade sutil passava por "opaco",
// virava JPEG — que não tem canal alpha — e a transparência morria sem volta (estudo de
// fidelidade 05/09 §5.2). Custo medido no Edge, pior caso (10 MP 100% opaco, sem saída
// antecipada): 43ms de varredura contra os 159ms do `getImageData` que já se pagava.
// Limiar 255, não 250: alpha 254 é transparência de verdade (antialias da borda do Photoshop).
function _dPsdHasAlpha(canvas){
  try{
    const d=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    for(let i=3;i<d.length;i+=4){ if(d[i]<255) return true; }
    return false;
  }catch(e){ return true; }   // na dúvida, PNG: preserva alpha e não inventa fundo
}
/* A CAIXA DO ASSUNTO dentro da foto — o que o Auto-layout precisa proteger de verdade.
   A moldura da imagem podia estar "segura" enquanto o texto cobria justamente o rosto ou o
   produto; e o contrário também custava caro, porque um PNG recortado tem metade da caixa
   transparente e tratá-la inteira como obstáculo roubava espaço que existe.
   Só faz sentido com alpha: foto retangular não tem assunto delimitável por transparência, e
   aí devolver `null` é a resposta honesta (o solver segue usando a caixa inteira).
   Amostra em 160px: 1px de precisão no palpite não vale 40ms a mais na importação. */
function _dPsdInkBox(canvas){
  try{
    if(!canvas||!canvas.width||!canvas.height) return null;
    if(!_dPsdHasAlpha(canvas)) return null;
    const MAX=160, s=Math.min(1,MAX/Math.max(canvas.width,canvas.height));
    const w=Math.max(1,Math.round(canvas.width*s)), h=Math.max(1,Math.round(canvas.height*s));
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    const cx=c.getContext('2d'); cx.drawImage(canvas,0,0,w,h);
    const d=cx.getImageData(0,0,w,h).data;
    let x1=w,y1=h,x2=-1,y2=-1;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      if(d[(y*w+x)*4+3]>24){ if(x<x1)x1=x; if(x>x2)x2=x; if(y<y1)y1=y; if(y>y2)y2=y; }
    }
    if(x2<x1||y2<y1) return null;
    const bx=x1/w, by=y1/h, bw=(x2-x1+1)/w, bh=(y2-y1+1)/h;
    // Assunto que ocupa quase a caixa toda não é informação nova — não vale gravar o dado.
    if(bw>0.96&&bh>0.96) return null;
    const r=(n)=>Math.round(n*1000)/1000;
    return {x:r(bx),y:r(by),w:r(bw),h:r(bh)};
  }catch(e){ return null; }
}
// Teto do raster SEM PERDAS. Acima disto o PNG deixa de ser razoável para o franqueado baixar
// no 4G e a camada cai no JPEG — mas aí a perda fica registrada no próprio dataURL
// (`data:image/jpeg`) e a revisão avisa, em vez de acontecer em silêncio.
const _DPSD_RASTER_LOSSLESS_MAX = 3 * 1024 * 1024;
// opts opcional {maxPx, q, lossless}: camadas que SÓ existem como raster fiel (warp, smart
// object, padrão, camada recuperada) pedem mais resolução E `lossless` — nelas o pixel é a
// ÚNICA fonte de verdade, então passar por JPEG já entrega a arte alterada pelo importador
// (estudo de fidelidade §5.2). Foto comum segue em JPEG: ali o pixel do Photoshop também é
// uma foto, e o custo de banda do franqueado é real.
// Default 1600/0.82 mantém as chamadas existentes intactas.
// O peso extra é absorvido pelo IndexedDB (idb://), então não estoura o localStorage.
function _dPsdRasterURL(canvas, opts){
  try{
    opts=opts||{};
    const MAX=opts.maxPx||1600, q=(opts.q!=null?opts.q:0.82), w=canvas.width, h=canvas.height;
    const scale=Math.min(1, MAX/Math.max(w,h));
    const hasAlpha=_dPsdHasAlpha(canvas);
    let src=canvas;
    if(scale<1){
      const tw=Math.max(1,Math.round(w*scale)), th=Math.max(1,Math.round(h*scale));
      const c=document.createElement('canvas'); c.width=tw; c.height=th;
      const cx=c.getContext('2d'); cx.imageSmoothingQuality='high'; cx.drawImage(canvas,0,0,tw,th); src=c;
    }
    if(hasAlpha) return src.toDataURL('image/png');   // JPEG não tem alpha: nem se cogita
    if(opts.lossless){
      const png=src.toDataURL('image/png');
      if(png.length<=_DPSD_RASTER_LOSSLESS_MAX) return png;
      console.warn('[psd] raster fiel acima do teto sem perdas ('+Math.round(png.length/1048576)+'MB) — caiu para JPEG');
    }
    return src.toDataURL('image/jpeg',q);
  }catch(e){ try{ return canvas.toDataURL('image/png'); }catch(_){ return null; } }
}
// Dimensões/origem da caixa de um node
function _dPsdBox(node){ return { x:Math.round(node.left||0), y:Math.round(node.top||0),
  w:Math.max(1,Math.round((node.right||0)-(node.left||0))), h:Math.max(1,Math.round((node.bottom||0)-(node.top||0))) }; }
// Máscara de CAMADA (raster) do PSD → canvas alpha do tamanho do layer (luminância→alpha)
// Projeta uma máscara do PSD (que vive em coords do DOC) na caixa de QUALQUER camada →
// canvas alpha do tamanho da caixa. Genérico de propósito: a mesma máscara de um grupo
// precisa ser reprojetada na caixa de cada filho (o Luma não tem grupo).
/* `b` é a caixa DESTINO em coordenadas de documento. `origem` (opcional) é a caixa da camada
   dona da máscara, também em documento: é ela que define o espaço quando o Photoshop marcou
   a máscara como RELATIVA à camada. Sem esse parâmetro, o espaço é o do documento. */
function _dPsdMaskToBox(mk, b, origem){
  if(!mk || mk.disabled || !mk.canvas || !b || b.w<1 || b.h<1) return null;
  const def=(mk.defaultColor!=null?mk.defaultColor:0);
  /* ESPAÇO DA MÁSCARA (§4 do briefing: "não assumir que a máscara tem a mesma origem da
     camada"). `positionRelativeToLayer` é uma flag do próprio arquivo: quando ligada, o
     left/top da máscara é medido a partir do canto da CAMADA, não do documento. Somar a
     origem da camada põe os dois no mesmo espaço antes de subtrair a caixa destino. */
  const ox=(mk.relativa&&origem)?(origem.x||0):0, oy=(mk.relativa&&origem)?(origem.y||0):0;
  const mx=Math.round((mk.left||0)+ox-b.x), my=Math.round((mk.top||0)+oy-b.y);
  const tmp=document.createElement('canvas'); tmp.width=b.w; tmp.height=b.h;
  const tctx=tmp.getContext('2d');
  tctx.fillStyle='rgb('+def+','+def+','+def+')'; tctx.fillRect(0,0,b.w,b.h);
  /* SUAVIZAÇÃO (feather): o cursor "Difusão" do Photoshop é um desfoque gaussiano do alpha da
     máscara, e é exatamente o que `filter:blur()` do Canvas faz. Sem isto, toda máscara suave
     entrava com borda dura — a diferença mais visível de uma foto recortada com difusão.
     O raio vem em px do documento; `sigma ≈ raio/2` é a relação que o Photoshop usa entre o
     valor do cursor e o desvio do gaussiano. */
  const feather=+mk.feather||0;
  if(feather>0.5){ try{ tctx.filter='blur('+(feather/2).toFixed(2)+'px)'; }catch(e){} }
  tctx.drawImage(mk.canvas, mx, my);
  try{ tctx.filter='none'; }catch(e){}
  const id=tctx.getImageData(0,0,b.w,b.h), d=id.data;
  /* DENSIDADE: o cursor "Densidade" é a OPACIDADE da máscara — 100% esconde por completo,
     50% esconde metade. Ausente = 1 (o default). Era ignorado, então uma máscara a 50%
     escondia o conteúdo inteiro. Entra como fator sobre o alpha, junto da luminância. */
  const dens=(mk.density!=null && isFinite(+mk.density))?Math.max(0,Math.min(1,+mk.density)):1;
  for(let i=0;i<d.length;i+=4){
    const lum=d[i]*.299+d[i+1]*.587+d[i+2]*.114;
    // Densidade < 1 levanta o piso: a área escondida deixa de ser 0 e passa a 255×(1−dens).
    d[i]=0;d[i+1]=0;d[i+2]=0;
    d[i+3]=(dens>=1)?lum:Math.round(lum*dens+255*(1-dens));
  }
  tctx.putImageData(id,0,0); return tmp;
}
// A caixa da camada é ao mesmo tempo o destino e a ORIGEM do espaço relativo — por isso ela
// entra duas vezes: `_dPsdMaskToBox` precisa saber de onde medir quando a máscara é relativa.
function _dPsdLayerMaskCanvas(node){ const b=_dPsdBox(node); return _dPsdMaskToBox(node.mask, b, b); }
// CLIPPING mask: a cobertura (alpha) da camada-base recortada na caixa do layer atual → canvas alpha
function _dPsdClipMaskCanvas(node, base){
  if(!base || !base.canvas) return null;
  const b=_dPsdBox(node), bb=_dPsdBox(base);
  const tmp=document.createElement('canvas'); tmp.width=b.w; tmp.height=b.h;
  const tctx=tmp.getContext('2d');
  tctx.drawImage(base.canvas, bb.x-b.x, bb.y-b.y); // base no espaço do layer
  const id=tctx.getImageData(0,0,b.w,b.h), d=id.data;
  for(let i=0;i<d.length;i+=4){ d[i]=0;d[i+1]=0;d[i+2]=0; } // mantém alpha (cobertura), zera rgb
  tctx.putImageData(id,0,0); return tmp;
}
// Downscale de um canvas (mantém proporção) → dataURL PNG. Usado p/ máscaras: elas são
// esticadas pro box no render (maskSize 100% 100% / preserveAspectRatio none), então perder
// resolução é seguro e evita máscaras gigantes furando a quota do localStorage.
function _dPsdDownscaleMaskURL(canvas, max){
  try{
    const w=canvas.width, h=canvas.height, scale=Math.min(1, max/Math.max(w,h));
    if(scale>=1) return canvas.toDataURL('image/png');
    const tw=Math.max(1,Math.round(w*scale)), th=Math.max(1,Math.round(h*scale));
    const c=document.createElement('canvas'); c.width=tw; c.height=th;
    const cx=c.getContext('2d'); cx.imageSmoothingQuality='high'; cx.drawImage(canvas,0,0,tw,th);
    return c.toDataURL('image/png');
  }catch(e){ try{ return canvas.toDataURL('image/png'); }catch(_){ return null; } }
}
/* Compõe as TRÊS máscaras que incidem sobre uma camada, multiplicando os alphas — elas se
   somam em vez de uma sobrescrever a outra (antes a vetorial era exclusiva e quem tivesse as
   duas perdia uma). Os três mecanismos são distintos e continuam distintos aqui (§3):
     · MÁSCARA DE CAMADA (`node.mask`)  — raster, controla a visibilidade da própria camada;
     · RECORTE VETORIAL (`vectorMask`)  — geometria Bézier, chega pronto em `extra.vecCanvas`;
     · MÁSCARA DE RECORTE (`clipping`)  — o alpha de OUTRA camada, a base da cadeia.

   ⛔ MÁSCARA DE GRUPO NÃO ENTRA AQUI — e o parâmetro `extra.groupMasks` que existia para isso
   era CÓDIGO MORTO: `inh.masks` nascia `[]` nos dois pontos do walk e nunca recebia um push,
   então o ramo nunca executou. Ele é da era em que o Luma não tinha grupo e a máscara do
   grupo precisava ser reprojetada em cada filho. Hoje o grupo É uma camada (`type:'group'`
   com `parentId`) e a máscara vive em `gd.mask`, aplicada UMA vez ao composto do grupo por
   `_fRenderGroup` — que é mais correto que por filho: no Photoshop a máscara do grupo incide
   sobre o resultado da composição, não sobre cada camada isolada. Removido em 10/09. */
function _dPsdComputeMask(node, base, extra){
  try{
    extra=extra||{};
    const b=_dPsdBox(node);
    const parts=[];
    const lm=_dPsdLayerMaskCanvas(node); if(lm) parts.push(lm);
    if(node.clipping){ const cm=_dPsdClipMaskCanvas(node, base); if(cm) parts.push(cm); }
    if(extra.vecCanvas) parts.push(extra.vecCanvas);
    if(!parts.length) return null;
    const out=document.createElement('canvas'); out.width=b.w; out.height=b.h;
    const octx=out.getContext('2d');
    octx.drawImage(parts[0],0,0);
    if(parts.length>1){
      const acc=octx.getImageData(0,0,b.w,b.h), ad=acc.data;
      for(let p=1;p<parts.length;p++){
        const pd=parts[p].getContext('2d').getImageData(0,0,b.w,b.h).data;
        for(let i=3;i<ad.length;i+=4) ad[i]=Math.round(ad[i]*pd[i]/255);
      }
      for(let i=0;i<ad.length;i+=4){ ad[i]=0;ad[i+1]=0;ad[i+2]=0; } // só o alpha importa
      octx.putImageData(acc,0,0);
    }
    // Resolução ADAPTATIVA: a máscara é esticada de volta pro tamanho da caixa no render, então
    // 700px basta numa caixa pequena/média — mas num fundo de 1080²+ ela era ampliada ~1,5× e a
    // borda do recorte serrilhava. Acompanha o lado maior da caixa, teto 1400 (acima disso o
    // ganho não se enxerga e o PNG dobra de peso). Nunca AMPLIA: _dPsdDownscaleMaskURL só reduz.
    return _dPsdDownscaleMaskURL(out, Math.max(700, Math.min(1400, Math.max(b.w, b.h))));
  }catch(e){ return null; }
}
// Máscara VETORIAL (node.vectorMask): rasteriza os paths bézier num canvas alpha do tamanho
// do layer (opaco dentro do recorte). Ex.: fundo com mordida/onda nas bordas. Devolve o CANVAS
// (não dataURL) para poder ser multiplicado com as outras máscaras em _dPsdComputeMask.
// Os knots vêm em pixels ABSOLUTOS do documento (ag-psd multiplica por width/height do PSD),
// então deslocamos pela origem da caixa do layer. Retorna null em qualquer falha (fallback seguro).
function _dPsdVectorMaskCanvas(node){
  try{
    const vm=node.vectorMask;
    if(!vm || vm.disable || !vm.paths || !vm.paths.length || typeof Path2D==='undefined') return null;
    const b=_dPsdBox(node);
    const p2d=new Path2D(); let drew=false; let rule='nonzero';
    vm.paths.forEach(path=>{
      const k=path&&path.knots; if(!k||k.length<2) return;
      if(path.fillRule==='even-odd') rule='evenodd';
      const px=(i,o)=>k[i].points[o]-b.x, py=(i,o)=>k[i].points[o+1]-b.y; // o=0 in-handle, 2 âncora, 4 out-handle
      p2d.moveTo(px(0,2), py(0,2));
      const last=path.open?k.length-1:k.length;
      for(let i=0;i<last;i++){
        const j=(i+1)%k.length;
        p2d.bezierCurveTo(px(i,4),py(i,4), px(j,0),py(j,0), px(j,2),py(j,2));
      }
      if(!path.open) p2d.closePath();
      drew=true;
    });
    if(!drew) return null;
    const c=document.createElement('canvas'); c.width=b.w; c.height=b.h;
    const ctx=c.getContext('2d'); ctx.fillStyle='#000';
    if(vm.invert){ // inverte: tudo opaco, depois fura o recorte (path vira transparente)
      ctx.fillRect(0,0,b.w,b.h);
      ctx.globalCompositeOperation='destination-out'; ctx.fill(p2d, rule);
      ctx.globalCompositeOperation='source-over';
    } else {       // padrão: dentro do path → alpha 255 (visível), fora → transparente
      ctx.fill(p2d, rule);
    }
    return c;
  }catch(e){ return null; }
}
// Promove uma vectorMask do Photoshop a geometria editável do Luma sem perder curvas.
// Operações booleanas (subtract/intersect/exclude) e máscaras invertidas permanecem no
// pipeline raster: Canvas/SVG não reproduzem esses operadores por subpath de forma geral.
function _dPsdEditableVectorPath(node, allowOpen){
  try{
    const vm=node&&node.vectorMask, b=_dPsdBox(node);
    if(!vm||vm.disable||vm.invert||!b.w||!b.h||!Array.isArray(vm.paths)||!vm.paths.length)return null;
    let fillRule=null; const paths=[]; let temSubtract=false;
    for(const p of vm.paths){
      if(!p||!Array.isArray(p.knots)||p.knots.length<2)return null;
      if(p.open&&!allowOpen)return null;
      /* CAMINHO COMPOSTO — anel, letra vazada, forma com buraco (§21 do briefing).
         O Photoshop guarda o buraco como um subcaminho com `operation:'subtract'`. Antes
         QUALQUER operação diferente de 'combine' reprovava a forma inteira e ela caía no
         recorte raster — então toda forma com furo perdia a geometria editável.
         `subtract` de um subcaminho contido no outro é exatamente o que a regra de
         preenchimento **evenodd** produz: cruzar duas bordas volta a ser "fora". Não é uma
         aproximação, é a mesma definição — e o `evenodd` já é suportado pelos três
         renderizadores (`gVectorPathFillRule`).
         ⛔ `intersect` e `exclude` continuam reprovando: não têm equivalente em regra de
         preenchimento, e fingir que têm encheria buracos ou apagaria áreas. */
      const op=p.operation||'combine';
      if(op!=='combine'){
        if(op!=='subtract')return null;
        temSubtract=true;
      }
      const rule=p.fillRule==='even-odd'?'evenodd':'nonzero';
      if(fillRule&&fillRule!==rule)return null;
      fillRule=rule;
      const knots=p.knots.map(k=>{
        const a=k&&k.points;
        if(!a||a.length<6||!a.every(Number.isFinite))throw new Error('invalid vector knot');
        const pt=o=>[+(Math.round(((a[o]-b.x)/b.w)*1e6)/1e6), +(Math.round(((a[o+1]-b.y)/b.h)*1e6)/1e6)];
        return {in:pt(0),anchor:pt(2),out:pt(4),linked:k.linked!==false};
      });
      paths.push({closed:!p.open,knots});
    }
    // Um subcaminho subtraído exige evenodd para o furo aparecer, mesmo que o arquivo
    // declarasse nonzero: com nonzero as duas bordas somam e o buraco fecha.
    const out={fillRule:(temSubtract?'evenodd':(fillRule||'nonzero')),paths};
    if(temSubtract) out.compound=true;   // vira motivo na revisão: geometria composta preservada
    return typeof gVectorPathValid==='function'&&gVectorPathValid(out)?out:null;
  }catch(e){ return null; }
}
// Traçado vetorial (node.vectorStroke) → {strokeW, strokeColor} ou {} (sem traçado).
function _dPsdShapeStroke(node){
  const vs=node.vectorStroke; const out={};
  try{
    if(vs && vs.strokeEnabled!==false){
      const lwRaw=vs.lineWidth; const lw=(lwRaw&&lwRaw.value!=null)?lwRaw.value:lwRaw;
      if(lw>0){
        out.strokeW=Math.max(1,Math.round(lw));
        const c=vs.content&&(vs.content.color||vs.content);
        out.strokeColor=_dPsdHex(c)||'#000000';
        if(vs.lineAlignment) out.strokeAlign=({inside:'inside',center:'center',outside:'outside'}[vs.lineAlignment])||'center';
        if(vs.lineCapType) out.strokeCap=({butt:'butt',round:'round',square:'square'}[vs.lineCapType])||'butt';
        if(vs.lineJoinType) out.strokeJoin=({miter:'miter',round:'round',bevel:'bevel'}[vs.lineJoinType])||'miter';
        if(Array.isArray(vs.lineDashSet)&&vs.lineDashSet.length){ // dash em múltiplos da espessura → px
          const dash=vs.lineDashSet.map(d=>Math.max(0,Math.round(((d&&d.value!=null)?d.value:d)*(out.strokeW||1))));
          if(dash.some(x=>x>0)) out.strokeDash=dash;
        }
      }
    }
  }catch(e){}
  return out;
}
// Raios por canto (node.vectorOrigination.keyOriginRRectRadii) → {tl,tr,br,bl} ou null.
// Valores vêm em px; clampamos a min(w,h)/2. Se todos forem 0, retorna null (usa raio uniforme).
function _dPsdCornerRadii(node, w, h){
  try{
    const vo=node.vectorOrigination; const list=vo&&vo.keyDescriptorList; if(!list||!list.length) return null;
    let rr=null; for(let i=0;i<list.length;i++){ if(list[i]&&list[i].keyOriginRRectRadii){ rr=list[i].keyOriginRRectRadii; break; } }
    if(!rr) return null;
    const m=Math.max(0,Math.min(w,h)/2);
    const v=u=>{ const n=(u&&u.value!=null)?u.value:u; return Math.min(m, Math.max(0, Math.round(+n||0))); };
    const out={ tl:v(rr.topLeft), tr:v(rr.topRight), br:v(rr.bottomRight), bl:v(rr.bottomLeft) };
    if(!(out.tl||out.tr||out.br||out.bl)) return null;
    return out;
  }catch(e){ return null; }
}
// Estilo de gradiente do PS (GrdT: linear|radial|angle|reflected|diamond) → primitiva do Luma.
// Antes TODOS que não fossem 'radial' viravam linear em silêncio — um cônico ou um losango
// importava como uma faixa reta, sem aviso nenhum.
//  • reflected → LINEAR com os stops espelhados no centro. É equivalente exato e não exige
//    primitiva nova em nenhum dos três renderizadores.
//  • angle (cônico) / diamond → sem equivalente; devolve `unsupported` e quem chama decide
//    (num PREENCHIMENTO o pixel do PS é fiel → rasteriza; num EFEITO, só dá pra avisar).
function _dPsdGradStyle(style, stops){
  const s=String(style||'linear').toLowerCase();
  if(s==='reflected'){
    const half=stops.map(t=>Object.assign({},t,{pos:0.5+t.pos/2}));
    const mirror=stops.map(t=>Object.assign({},t,{pos:0.5-t.pos/2})).reverse();
    const merged=mirror.concat(half);
    // O centro sai duplicado quando o 1º stop está em 0 (o caso comum). Descarta vizinho
    // idêntico em vez de fatiar às cegas — com o 1º stop deslocado não há duplicata a remover.
    return {type:'linear', stops:merged.filter((t,i)=>i===0||t.pos!==merged[i-1].pos||t.color!==merged[i-1].color)};
  }
  if(s==='radial') return {type:'radial', stops};
  if(s==='angle'||s==='diamond') return {type:'linear', stops, unsupported:s};
  return {type:'linear', stops};
}
// Gradiente do PSD (vectorFill de GdFl, ou effects.gradientOverlay) → modelo Luma l.gradient.
// Opacidade de um gradiente na posição loc (0..1), INTERPOLADA linearmente entre os dois
// opacityStops vizinhos (antes pegava o vizinho mais próximo, o que serrilhava a transição).
function _dPsdOpacityAt(opacityStops, loc){
  const os=opacityStops||[];
  if(!os.length) return 1;
  const sorted=os.slice().sort((a,b)=>(a.location||0)-(b.location||0));
  const op=s=>s.opacity!=null?s.opacity:1;
  if(loc<=(sorted[0].location||0)) return op(sorted[0]);
  const last=sorted[sorted.length-1];
  if(loc>=(last.location||0)) return op(last);
  for(let i=0;i<sorted.length-1;i++){
    const a=sorted[i], b=sorted[i+1], la=a.location||0, lb=b.location||0;
    if(loc>=la && loc<=lb){ if(lb===la) return op(a); return op(a)+(op(b)-op(a))*((loc-la)/(lb-la)); }
  }
  return 1;
}
function _dPsdGradient(node){
  try{
    let src=null;
    if(node.vectorFill && node.vectorFill.colorStops) src=node.vectorFill;            // camada de gradiente (GdFl)
    else { let go=node.effects&&node.effects.gradientOverlay; if(Array.isArray(go)) go=go[0];
      if(go && go.enabled!==false && go.gradient && go.gradient.colorStops){ src=go.gradient; src.angle=go.angle; src.style=go.type||src.style; } }
    if(!src||!src.colorStops||!src.colorStops.length) return null;
    let stops=src.colorStops.map(s=>({ color:_dPsdHex(s.color)||'#000000', pos:Math.max(0,Math.min(1,s.location||0)), opacity:_dPsdOpacityAt(src.opacityStops, s.location||0) }));
    if(src.reverse){ stops=stops.map(s=>({...s,pos:1-s.pos})).reverse(); } // PS "Reverse" → espelha os stops
    const _st=_dPsdGradStyle(src.style, stops);
    // Convenção de ângulo: o Photoshop mede o ângulo do gradiente no sentido ANTI-horário; o
    // renderizador do Luma (gGradientCanvas/Css) progride em (cos θ, sin θ) = sentido HORÁRIO.
    // Negar o ângulo do PS converte para a convenção do Luma (θ=0 e horizontais ficam iguais).
    const g={ type:_st.type, angle: Math.round(-(src.angle!=null?src.angle:90)), stops:_st.stops };
    if(_st.unsupported) g.psStyle=_st.unsupported; // consumido no walk → rasteriza a camada
    return g;
  }catch(e){ return null; }
}
// Rich text: styleRuns do PSD → l.runs[{text,color,fontSize,font,letterSpacing}]. Só quando há >1 estilo.
function _dPsdRichRuns(t, res, h){
  try{
    const runs=Array.isArray(t.styleRuns)?t.styleRuns:null; if(!runs||runs.length<2) return null;
    // Fatia o texto CRU: r.length conta os caracteres do EngineData, onde a quebra de linha é
    // '\r'. Normalizar ANTES encurtava a string em cada '\r\n' e todos os runs seguintes saíam
    // deslocados (trecho com a cor/tamanho do vizinho). Normaliza depois, por trecho.
    const full=String(t.text||'');
    // Cor do estilo DOMINANTE como fallback: um run que só muda o tamanho costuma herdar a cor
    // (sem fillColor no EngineData) — cair em #000 fixo apagava trecho branco sobre fundo escuro.
    const _domStyle=(typeof _dPsdDominantStyle==='function'&&_dPsdDominantStyle(t))||null;
    const _domColor=(_domStyle&&_domStyle.style&&_dPsdHex(_domStyle.style.fillColor||_domStyle.style.color))||'#000000';
    const out=[]; let pos=0;
    for(const r of runs){
      const len=r.length||0; const seg=full.substr(pos,len).replace(/\r\n?/g,'\n'); pos+=len; if(!seg) continue;
      const st=r.style||{};
      const fname=(st.font&&st.font.name)||'';
      const remap=_dPsdRemapFont(fname);
      // shapeType vai junto: sem ele um run de caixa de PARÁGRAFO caía no caminho "point" e podia
      // ter o tamanho real trocado pelo estimado da caixa — enquanto o tamanho da própria camada
      // (calculado com shapeType) era respeitado 1:1. Os dois lados agora usam a mesma regra.
      const _rfs=_dPsdFontSize({style:st,transform:t.transform,shapeType:t.shapeType}, h, seg, res);
      out.push({
        text:seg,
        color:_dPsdHex(st.fillColor||st.color)||_domColor,
        fontSize:_rfs,
        font: remap||_dPsdRobotoFont(fname),
        _fontName:fname, // nome original — permite remap posterior (upload de fonte na revisão)
        // Tracking pela MESMA função da camada (`_dPsdTracking`) — era a segunda cópia da
        // fórmula 1/1000 em, e as duas arredondavam para inteiro. Sem arredondar, o aperto
        // do designer sobrevive em corpo pequeno.
        letterSpacing: _dPsdTracking(st.tracking, _rfs),
        // Sobrescrito/subscrito POR TRECHO — é assim que "R$ 29,⁹⁰" é feito no Photoshop, e o
        // render de texto rico já consome `yOffset` (png-generator). O parser nunca o gravava,
        // então os centavos elevados voltavam para a linha do inteiro.
        yOffset: st.baselineShift? -Math.round((+st.baselineShift)*100)/100 : 0
      });
    }
    return out.length>1?out:null;
  }catch(e){ return null; }
}
// Função auxiliar de singularização para heurísticas de auto-sugestão de variáveis do PSD.
// Reduz variações de plurais comuns em português e inglês para melhorar a correspondência semântica.
function _dSingularize(word){
  if(!word) return '';
  if(word.endsWith('oes')) return word.slice(0, -3) + 'ao'; // condicoes -> condicao
  if(word.endsWith('ns')) return word.slice(0, -2) + 'm';   // cupons -> cupom
  if(word.endsWith('ies')) return word.slice(0, -3) + 'y';   // validities -> validity
  if(word.endsWith('es')){
    if(word.endsWith('res')) return word.slice(0, -2); // valores -> valor
    if(word.endsWith('hes')) return word.slice(0, -2); // detalhes -> detalhe
    return word.slice(0, -1);
  }
  if(word.endsWith('s') && word.length > 2){
    return word.slice(0, -1); // produtos -> produto, prices -> price
  }
  return word;
}

/* Adaptador do vocabulário do PSD para o motor semântico ÚNICO.
   Era um resolvedor paralelo: cinco camadas de palpite (um mapa fixo de ~40 sinônimos, uma
   lista de campos "conhecidos", um casamento com o catálogo e uma heurística de "tem R$ no
   texto") escritas aqui, ao lado das MESMAS regras em `gFieldInfer`. Duas fontes de
   sinônimos = duas verdades, e a daqui decidia com `confidence:'high'` por conta própria.
   Agora existe UM lugar onde alias, conceito canônico e evidência de conteúdo moram
   (`G_FIELD_CONCEPTS` + `gFieldInfer`, em `00-config.js`), e esta função só traduz a saída
   para o formato que o importador consome. Sem sinal suficiente, devolve `null` — que é
   diferente de devolver um nome inventado a partir do nome da camada, o que era o antigo
   `return {name:clean||'variavel'}`.
   Chamadores: o parse (aqui), o linter e a dica do painel de propriedades — todos leem
   `.name` e já tratam ausência. */
function _dPsdSuggestVar(name, content){
  const raw=String(name||'');
  // `{{campo}}` escrito no nome da camada no Photoshop não é palpite, é instrução — e é o
  // único caminho que o import honra sem nenhuma outra evidência.
  const m=raw.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/);
  if(m) return {name:m[1], auto:true, explicit:true, confidence:'high', source:'explicit',
    alternatives:[], reason:'Campo escrito no nome da camada no Photoshop'};
  if(typeof gFieldInfer!=='function') return null;
  const inf=gFieldInfer({layerName:raw, content:content||'', target:'text'});
  if(!inf || !inf.field) return null;
  return {name:inf.field.name, field:inf.field, auto:inf.confidence==='high',
    explicit:!!inf.explicit, confidence:inf.confidence, source:inf.source,
    reason:inf.reason, alternatives:inf.alternatives||[]};
}

// Sugere variável e modo moldura para camadas de imagem baseando-se no nome
function _dPsdSuggestImgVar(name, opts){
  if(typeof gFieldInfer==='function'){
    const inf=gFieldInfer(Object.assign({layerName:name||'',content:'',target:'imagem'},opts||{}));
    if(inf&&inf.field){
      return {name:inf.field.name,field:inf.field,mode:'frame',auto:inf.confidence==='high',
        explicit:!!inf.explicit,confidence:inf.confidence,source:inf.source,
        reason:inf.reason,alternatives:inf.alternatives||[]};
    }
  }
  const clean=String(name||'').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  const sing=_dSingularize(clean);
  
  // Campo de IMAGEM já existente no catálogo vence o nome genérico — mesma razão do texto:
  // é o vocabulário deste template, não um chute. Filtra por type:'image' pra não ligar uma
  // moldura de foto num campo de texto que por acaso tem o mesmo nome.
  try{
    if(typeof dVars!=='undefined' && Array.isArray(dVars)){
      const imgs=dVars.filter(v=>v&&v.type==='image');
      if(imgs.length){
        const norm=s=>String(s||'').trim().toLowerCase().normalize('NFD')
          .replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
        const hit=imgs.find(v=>{ const n=norm(v.name), l=norm(v.label);
          return n===clean||n===sing||(l&&(l===clean||l===sing)); });
        if(hit) return {name:hit.name, mode:'frame'};
      }
    }
  }catch(e){}
  if(/logo|logomarca|marca|brand|logotipo/i.test(clean) || /logo|logomarca|marca|brand|logotipo/i.test(sing)){
    return {name:'logo_loja', mode:'frame'};
  }
  // ⛔ "fundo"/"background"/"bg" ficaram FORA de propósito: o fundo é a arte, não um espaço de
  // foto. Ligá-lo em `foto_produto` fazia a foto do produto cobrir o fundo do designer (e, numa
  // forma de cor sólida, a cor sumia de vez). O designer marca "Moldura de foto" na revisão se
  // quiser — o que não pode é o padrão destruir o fundo.
  const _fotoRe=/foto|imagem|img|photo|picture|pic|product|prod|banner|campanha/i;
  if(_fotoRe.test(clean) || _fotoRe.test(sing)){
    return {name:'foto_produto', mode:'frame'};
  }
  return null;
}

/* Teto de tamanho do arquivo. O gargalo real não é o disco: é a MEMÓRIA. Um .psd de X MB
   vira, no pico, várias vezes X — o ArrayBuffer, a cópia transferida pro worker, e o
   ImageData descomprimido de cada camada (que é o que pesa de verdade: 4 bytes por pixel,
   por camada). 500MB de arquivo já pede alguns GB de RAM no parse.
   _DPSD_NO_COPY_MB: acima disto o buffer vai pro worker SEM duplicar — ver _dPsdReadPsd. */
const _DPSD_MAX_MB=500;
const _DPSD_NO_COPY_MB=150;

/* FONTE ÚNICA dos campos do nó do ag-psd que o parse consome.
   Antes esta lista existia DUAS vezes — escrita à mão dentro da string do worker (`strip`) e
   de novo em `_dPsdRebuildNode`. Elas divergiram de verdade: `smartObject` faltava no worker,
   então o mesmo PSD dava resultado diferente com e sem worker. Agora a lista viaja por
   postMessage e os dois lados leem daqui.
   `clippingLayer` fica fora: é derivado (`clippingLayer || clipping`), não copiado. */
const _DPSD_NODE_FIELDS=['name','left','top','right','bottom','hidden','opacity','fillOpacity',
  'blendMode','text','effects','artboard','clipping','vectorMask','vectorStroke',
  'vectorOrigination','vectorFill','adjustment','placedLayer','smartObject'];

/* ── #4e — parse: Web Worker (offload) com fallback main-thread ── */
const _DPSD_WORKER_SRC = ""
  + "self.onmessage=function(e){try{"
  + "try{importScripts(e.data.lib);}catch(_){importScripts(e.data.cdn);}"
  // Sem isto o worker SEMPRE morria em "Canvas not initialized" (não há document aqui) e todo
  // PSD caía no main thread — o offload nunca acontecia de fato e a UI travava no parse.
  // OffscreenCanvas é o document.createElement do worker; sem ele, cai no fallback como antes.
  + "if(typeof OffscreenCanvas!=='undefined')self.agPsd.initializeCanvas(function(w,h){return new OffscreenCanvas(w,h);});"
  + "var psd=self.agPsd.readPsd(e.data.buffer,{useImageData:true,skipLayerImaging:false});"
  // Leitura terminou (a parte lenta): avisa a main thread quantas camadas vêm. Serve de
  // sinal de vida — lá o prazo do timeout é renovado a cada progresso.
  + "var nL=0;(function cnt(a){(a||[]).forEach(function(x){nL++;if(x.children)cnt(x.children);});})(psd.children);"
  + "self.postMessage({progress:true,layers:nL});"
  + "var transfers=[];"
  // strip() é a LISTA BRANCA do que atravessa o worker. A lista vem de _DPSD_NODE_FIELDS via
  // postMessage (e.data.fields) — não é mais escrita à mão aqui, que era a origem da divergência.
  + "var FIELDS=e.data.fields||[];"
  + "function strip(n){var o={},i;for(i=0;i<FIELDS.length;i++){o[FIELDS[i]]=n[FIELDS[i]];}"
  + "o.clippingLayer=n.clippingLayer||n.clipping;"
  + "if(n.imageData&&n.imageData.data){o._img={w:n.imageData.width,h:n.imageData.height,buf:n.imageData.data.buffer};transfers.push(n.imageData.data.buffer);}"
  // A máscara atravessa o worker com TODOS os parâmetros que o Photoshop grava, não só a
  // geometria: `userMaskDensity` (o cursor Densidade — máscara a 50% escondia 100% aqui),
  // `userMaskFeather` (o raio de suavização — borda suave entrava dura) e
  // `positionRelativeToLayer` (quando ligado, left/top são RELATIVOS à camada, não ao
  // documento, e o offset era calculado no espaço errado).
  + "if(n.mask&&n.mask.imageData&&n.mask.imageData.data){o._mask={w:n.mask.imageData.width,h:n.mask.imageData.height,buf:n.mask.imageData.data.buffer,left:n.mask.left,top:n.mask.top,defaultColor:n.mask.defaultColor,disabled:n.mask.disabled,density:n.mask.userMaskDensity,feather:n.mask.userMaskFeather,relativa:n.mask.positionRelativeToLayer,deVetor:n.mask.fromVectorData};transfers.push(n.mask.imageData.data.buffer);}"
  + "if(n.children)o.children=n.children.map(strip);return o;}"
  + "var res=(psd.imageResources&&psd.imageResources.resolutionInfo&&psd.imageResources.resolutionInfo.horizontalResolution)||72;"
  + "if(res&&res.value)res=res.value;"
  + "var ga=(psd.imageResources&&psd.imageResources.globalAngle);"
  + "var out={width:psd.width,height:psd.height,res:res,globalAngle:(ga==null?null:ga),children:(psd.children||[]).map(strip)};"
  // Composto do documento: só é usado quando não sobra camada utilizável (PSD achatado).
  + "if(psd.imageData&&psd.imageData.data){out._img={w:psd.imageData.width,h:psd.imageData.height,buf:psd.imageData.data.buffer};transfers.push(psd.imageData.data.buffer);}"
  + "self.postMessage({ok:true,tree:out},transfers);"
  + "}catch(err){self.postMessage({ok:false,error:String(err)});}};";

function _dPsdRebuildNode(node){
  // Mesma lista do strip() do worker, lida da MESMA constante — não há mais duas cópias.
  const n={};
  for(const f of _DPSD_NODE_FIELDS) n[f]=node[f];
  n.clippingLayer=node.clippingLayer||node.clipping;
  if(node._img && node._img.buf){
    try{
      const c=document.createElement('canvas'); c.width=node._img.w; c.height=node._img.h;
      const id=new ImageData(new Uint8ClampedArray(node._img.buf), node._img.w, node._img.h);
      c.getContext('2d').putImageData(id,0,0); n.canvas=c;
    }catch(e){}
  }
  if(node._mask && node._mask.buf){
    try{
      const mc=document.createElement('canvas'); mc.width=node._mask.w; mc.height=node._mask.h;
      const mid=new ImageData(new Uint8ClampedArray(node._mask.buf), node._mask.w, node._mask.h);
      mc.getContext('2d').putImageData(mid,0,0);
      // Espelho EXATO da lista branca do worker (a divergência entre as duas já custou o
      // `smartObject` faltando de um lado; ver _DPSD_NODE_FIELDS).
      n.mask={canvas:mc, left:node._mask.left, top:node._mask.top,
        defaultColor:node._mask.defaultColor, disabled:node._mask.disabled,
        density:node._mask.density, feather:node._mask.feather,
        relativa:node._mask.relativa, deVetor:node._mask.deVetor};
    }catch(e){}
  }
  if(node.children) n.children=node.children.map(_dPsdRebuildNode);
  return n;
}
/* Rebuild FATIADO da árvore que o worker devolveu.
   O worker resolve a parte lenta do parse, mas remontar os canvases é main-thread por
   natureza (não existe `document` no worker): um canvas + putImageData POR CAMADA. Numa arte
   de 200 camadas isso congelava a aba justo no fim, e o texto do overlay parava de mudar —
   parecia travado. Aqui o trabalho cede o controle ao navegador a cada _DPSD_REBUILD_LOTE
   camadas, o que mantém a UI viva e permite mostrar progresso e atender o Cancelar.
   `onProgress(feitas,total)` é chamado entre lotes; devolve null se o usuário cancelou. */
const _DPSD_FATIA_MS=16;   // ~1 frame de trabalho antes de devolver a vez ao navegador
function _dPsdCountNodes(nodes){
  let n=0; (function c(a){ (a||[]).forEach(x=>{ n++; if(x.children) c(x.children); }); })(nodes);
  return n;
}
/* Cede o controle via MessageChannel, não setTimeout: em aba sem foco o navegador limita
   setTimeout a ~1s, então um rebuild de 240 camadas gastaria ~20s só ESPERANDO — medido.
   MessageChannel entrega no próximo macrotask sem esse teto. */
let _dPsdYieldChan=null;
function _dPsdYield(){
  return new Promise(res=>{
    try{
      if(!_dPsdYieldChan) _dPsdYieldChan=new MessageChannel();
      const ch=_dPsdYieldChan;
      ch.port1.onmessage=()=>{ ch.port1.onmessage=null; res(); };
      ch.port2.postMessage(0);
    }catch(e){ setTimeout(res,0); }
  });
}
async function _dPsdRebuildTree(nodes, onProgress, isCancelled){
  const total=_dPsdCountNodes(nodes);
  let feitas=0, inicioFatia=performance.now();
  const passo=async(lista)=>{
    const out=[];
    for(const node of lista||[]){
      if(isCancelled&&isCancelled()) return null;
      const n=_dPsdRebuildNode(Object.assign({}, node, {children:null}));
      feitas++;
      if(node.children && node.children.length){
        const filhos=await passo(node.children);
        if(filhos===null) return null;
        n.children=filhos;
      }
      out.push(n);
      // Fatia por TEMPO, não por contagem: o custo de uma camada varia com a área dela
      // (putImageData de 4000×4000 é ordens de grandeza mais caro que de 60×60), então
      // "a cada 12 camadas" tanto travava em arte grande quanto pausava demais em arte pequena.
      if(performance.now()-inicioFatia>=_DPSD_FATIA_MS){
        if(onProgress) onProgress(feitas,total);
        await _dPsdYield();
        inicioFatia=performance.now();
      }
    }
    return out;
  };
  const arvore=await passo(nodes);
  if(arvore && onProgress) onProgress(total,total);
  return arvore;
}
function _dPsdResolution(psd){
  let r=(psd.imageResources&&psd.imageResources.resolutionInfo&&psd.imageResources.resolutionInfo.horizontalResolution)||psd.res||72;
  if(r&&r.value) r=r.value;
  return (+r)||72;
}
/* Cancelamento. Um PSD de 400MB pode levar minutos; sem isto, quem abriu o arquivo errado
   ficava preso olhando o overlay, sem botão e sem como interromper o worker.
   _dPsdCancelled é lido pelo rebuild fatiado entre lotes; _dPsdActiveWorker permite matar o
   worker na hora (terminate é o único jeito de parar um parse já em andamento). */
let _dPsdCancelled=false;
let _dPsdActiveWorker=null;
function dPsdCancelLoad(){
  _dPsdCancelled=true;
  if(_dPsdActiveWorker){ try{ _dPsdActiveWorker.terminate(); }catch(e){} _dPsdActiveWorker=null; }
  _dPsdBusyUpdate('Cancelando…');
}
// resolve { psd } com canvases prontos; tenta worker, cai pro main thread
function _dPsdReadPsd(buffer, agPsd){
  return new Promise((resolve)=>{
    let done=false;
    // Ligado quando o buffer foi TRANSFERIDO pro worker (arquivo grande): o ArrayBuffer local
    // fica detached (byteLength 0) e tentar ler dele daria um erro sem sentido pro usuário.
    let noFallback=false;
    const mainParse=()=>{ if(done)return; done=true;
      if(_dPsdCancelled){ resolve({cancelled:true}); return; }
      // O parse no main thread é um bloco só e não dá pra interromper — então nem começa se
      // o usuário já pediu pra cancelar.
      if(noFallback || !buffer.byteLength){
        resolve({error:new Error('worker falhou e o buffer já foi transferido (arquivo grande)')});
        return;
      }
      try{ const psd=agPsd.readPsd(buffer,{useImageData:false,skipLayerImaging:false}); resolve({psd:psd, res:_dPsdResolution(psd), worker:false}); }
      catch(e){ resolve({error:e}); } };
    let worker, to, workerUrl;
    try{
      const blob=new Blob([_DPSD_WORKER_SRC],{type:'application/javascript'});
      workerUrl = URL.createObjectURL(blob);
      worker=new Worker(workerUrl);
      _dPsdActiveWorker=worker; // dPsdCancelLoad precisa alcançá-lo pra dar terminate
      const cleanup = () => { if(workerUrl){URL.revokeObjectURL(workerUrl);workerUrl=null;} try{worker.terminate();}catch(e){} if(_dPsdActiveWorker===worker) _dPsdActiveWorker=null; };
      // Prazo proporcional ao arquivo: 25s fixos derrubavam PSDs grandes pro main thread — que
      // trava a UI e refaz TODO o trabalho — mesmo com o worker progredindo bem. ~1s/MB.
      // Teto 10min (era 3min): com o limite em 500MB, um arquivo de 400MB pedia ~7min e o
      // teto antigo o cortava no meio do caminho — justamente o caso que o worker existe pra
      // atender. O prazo é renovado a cada sinal de progresso, então travado de verdade ele
      // ainda cai fora; o teto só evita desistir de quem está trabalhando.
      const _mb=(buffer.byteLength||0)/(1024*1024);
      const _limit=Math.min(600000, Math.max(25000, Math.round(25000+_mb*1000)));
      // Arquivo grande: transfere o ORIGINAL, sem duplicar. Duplicar 400MB é meio giga a mais
      // no pico, e o fallback que a cópia protegia (parse no main thread) travaria a aba por
      // minutos nesse tamanho — não é um plano B utilizável, é um segundo problema.
      const _semCopia=_mb>=_DPSD_NO_COPY_MB;
      to=setTimeout(()=>{ cleanup(); mainParse(); }, _limit);
      worker.onmessage=(ev)=>{
        const d=ev.data||{};
        // Sinal de vida: leitura concluída, N camadas à vista. Renova o prazo e informa o usuário.
        if(d.progress){
          clearTimeout(to); to=setTimeout(()=>{ cleanup(); mainParse(); }, _limit);
          if(d.layers) _dPsdBusyUpdate('Preparando '+d.layers+' camada'+(d.layers===1?'':'s')+'…');
          return;
        }
        clearTimeout(to); cleanup();
        if(done) return;
        if(d.ok&&d.tree){ done=true;
          const tree=d.tree;
          // Rebuild fatiado: mantém a UI viva, mostra progresso e escuta o Cancelar.
          _dPsdRebuildTree(tree.children, (f,t)=>{
            _dPsdBusyUpdate('Montando camadas… '+f+' de '+t);
          }, ()=>_dPsdCancelled).then(children=>{
            if(children===null){ resolve({cancelled:true}); return; }
            const root={width:tree.width,height:tree.height,children:children};
            // Reusa o mesmo rebuild de canvas das camadas para o composto do doc.
            if(tree._img&&tree._img.buf){ const rc=_dPsdRebuildNode({_img:tree._img}); if(rc.canvas) root.canvas=rc.canvas; }
            if(tree.globalAngle!=null) root.imageResources={globalAngle:tree.globalAngle}; // luz global p/ as sombras
            resolve({psd:root, res:(+tree.res)||72, worker:true});
          }).catch(e=>resolve({error:e}));
        } else mainParse();
      };
      worker.onerror=()=>{ clearTimeout(to); cleanup(); mainParse(); };
      // Pequeno/médio: cópia (o original fica pro fallback). Grande: o próprio buffer.
      const enviar=_semCopia?buffer:buffer.slice(0);
      if(_semCopia) noFallback=true; // buffer transferido: mainParse não tem mais o que ler
      worker.postMessage({buffer:enviar, fields:_DPSD_NODE_FIELDS, lib:new URL('assets/vendor/ag-psd.js',location.href).href, cdn:'https://cdn.jsdelivr.net/npm/ag-psd/dist/bundle.js'}, [enviar]);
    }catch(e){ if(to)clearTimeout(to); mainParse(); }
  });
}

/* ── detecção de formato pela proporção da prancheta ── */
function dPsdDetectFmt(w, h){
  // Match exato (±2px) tem prioridade sobre proporção — distingue wide de horizontal etc.
  const _tol=2;
  const exact=Object.keys(DFMT_SIZES).find(k=>Math.abs(DFMT_SIZES[k].w-w)<=_tol&&Math.abs(DFMT_SIZES[k].h-h)<=_tol);
  if(exact) return exact;
  const ratio=w/h;
  if(ratio<0.7) return 'story';
  if(ratio>1.4) return 'wide';
  return 'feed';
}
// Formato APENAS por match exato (±2px) → senão 'orig' (preserva o tamanho REAL do PSD, 1:1).
// Diferente de dPsdDetectFmt (que faz snap por proporção, usado em prancheta custom/SVG):
// aqui não queremos forçar uma prancheta 1080×1350 a virar 'feed' (1080×1080).
function _dPsdExactFmt(w, h){
  const _tol=2;
  return Object.keys(DFMT_SIZES).find(k=>Math.abs(DFMT_SIZES[k].w-w)<=_tol&&Math.abs(DFMT_SIZES[k].h-h)<=_tol)||'orig';
}

// Tenta mapear um nome de fonte do PSD para fontes bundled (dBuiltinFonts) ou enviadas
// (dCustomFonts). Normaliza ambos (lowercase, só alfanum) e aceita correspondência
// exata ou por prefixo. Retorna 'custom:Family' ou null se não encontrar.
/* ══ RESOLUÇÃO DE FONTE — quatro respostas, não um booleano ═══════════════════════════════
   POR QUE: até 10/09 isto devolvia "achei" ou "não achei" e o item guardava um `fontRemapped`
   booleano. Casar EXATO com uma família e casar POR PREFIXO ("ObviouslyWideBold" batendo
   "Obviously Wide") chegavam na revisão com o mesmo selo verde "Fonte vinculada" — e são
   coisas diferentes: a segunda é outro arquivo de fonte, com outras métricas, o que muda a
   largura de cada linha. Sem separar, um erro de FONTE era diagnosticado como erro de
   GEOMETRIA — e a tentação era corrigir posição para compensar tipografia, que é justamente
   o conserto errado (§5 do briefing desta rodada).
   Os quatro estados, em ordem de fidelidade:
     'exact'        a família do Photoshop existe aqui, mesmo nome → métrica é a real;
     'approximated' casou por prefixo: outra família, provavelmente da mesma linha;
     'substituted'  não existe, mas o nome carrega o PESO (Black/Bold/Medium/Light/Thin) e a
                    variante Roboto correspondente foi usada → peso preservado, desenho não;
     'missing'      não existe e o nome não diz o peso → Roboto Regular, peso adivinhado.
   Devolve {status, font, family}. `font` é o valor que vai para `l.font`, no formato que os
   três renderizadores já entendem — nada de modelo novo. */
function _dPsdFontResolve(fontName){
  const nome=String(fontName||'');
  if(!nome) return {status:'missing', font:"'Roboto'", family:'', face:_dPsdFontFace(''), pesoPedido:null, pesoUsado:400};
  const face=_dPsdFontFace(nome);
  const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const alvoCheio=norm(nome);          // "montserratsemibold"
  const alvoFamilia=norm(face.familia); // "montserrat"
  // Fontes bundled (dBuiltinFonts) têm prioridade pois não requerem upload do usuário
  const builtin=(typeof dBuiltinFonts!=='undefined'&&dBuiltinFonts)||[];
  const custom=(typeof dCustomFonts!=='undefined'&&dCustomFonts)||[];
  const todas=[
    ...builtin.map(f=>({family:f.family, peso:f.weight||400})),
    ...custom.map(f=>({family:f.family, peso:f.weight||400, apelido:f.name}))
  ];
  if(todas.length){
    /* A FAMÍLIA vem antes do PESO, que é a ordem que a definição de APPROXIMATED pede:
       "achou a família, mas não exatamente o mesmo peso/estilo". Casa com o nome cheio
       (uma fonte enviada como "Montserrat SemiBold" é uma família própria aqui) ou com a
       família limpa (o arquivo é "Montserrat" e o PSD pediu a variante SemiBold). */
    const porNomeCheio=todas.find(f=>norm(f.family)===alvoCheio||norm(f.apelido)===alvoCheio);
    if(porNomeCheio) return {status:'exact', font:'custom:'+porNomeCheio.family, family:porNomeCheio.family,
      face, pesoPedido:face.peso, pesoUsado:porNomeCheio.peso};
    const porFamilia=alvoFamilia && todas.find(f=>norm(f.family)===alvoFamilia||norm(f.apelido)===alvoFamilia);
    if(porFamilia){
      // Família certa. O peso bate? Sem peso declarado no nome, 400 é o que o PSD pediu.
      const pedido=face.peso!=null?face.peso:400;
      const bate=Math.abs((porFamilia.peso||400)-pedido)<=50;
      return {status:bate?'exact':'approximated', font:'custom:'+porFamilia.family, family:porFamilia.family,
        face, pesoPedido:pedido, pesoUsado:porFamilia.peso||400};
    }
    /* Prefixo é o último recurso e NUNCA é exato: "ObviouslyWideBold" bater "Obviously Wide"
       é outro arquivo de fonte, com outras métricas. Dizer "vinculada" aqui era o que fazia
       uma diferença de LARGURA parecer erro de posição. */
    const porPrefixo=todas.find(f=>{ const ff=norm(f.family), fa=norm(f.apelido);
      return (ff&&(alvoCheio.startsWith(ff)||ff.startsWith(alvoCheio)))
          || (fa&&(alvoCheio.startsWith(fa)||fa.startsWith(alvoCheio))); });
    if(porPrefixo) return {status:'approximated', font:'custom:'+porPrefixo.family, family:porPrefixo.family,
      face, pesoPedido:face.peso, pesoUsado:porPrefixo.peso||400};
  }
  /* Sem família equivalente: cai no Roboto, que é a substituição CONHECIDA do Luma. Preservar
     o peso é o que separa "substituída" (o peso do nome sobreviveu) de "ausente" (o nome não
     declara peso, então o 400 é palpite nosso, não escolha do designer). */
  return {status:face.pesoDeclarado?'substituted':'missing', font:_dPsdRobotoFont(nome), family:'',
    face, pesoPedido:face.peso, pesoUsado:face.peso!=null?face.peso:400};
}
/* Compatibilidade: o nome antigo continua respondendo, agora derivado da resolução.
   Devolve 'custom:Family' quando há família equivalente (exata OU por prefixo), null quando
   não há — exatamente o contrato de antes. */
function _dPsdRemapFont(fontName){
  const r=_dPsdFontResolve(fontName);
  return (r.status==='exact'||r.status==='approximated') ? r.font : null;
}

// Preserva as variantes da família Roboto já empacotadas no Luma. O fallback antigo
// distinguia apenas Bold/Black e transformava Light/Thin/Medium em Regular.
/* ══ NOME POSTSCRIPT → FAMÍLIA + PESO + ESTILO ════════════════════════════════════════════
   O Photoshop entrega o nome que a fonte declara, não a família limpa:
     Montserrat-SemiBold · Montserrat SemiBold · MontserratRoman-SemiBoldItalic ·
     Obviously-Black · Gotham-BookItalic
   O navegador quer as três coisas separadas: família, `font-weight` numérico, `font-style`.
   ⛔ ANTES o peso saía de `s.includes('bold')`. Isso erra por um degrau em toda a faixa
   intermediária, que é justamente a que o designer usa: "SemiBold" contém "bold" → 700,
   quando SemiBold é 600; "ExtraLight" contém "light" → 300, quando é 200. Um título
   importado nascia mais pesado do que o desenhado, e a largura de cada linha ia com ele.
   A tabela é ordenada do MAIS ESPECÍFICO para o menos: 'extrabold' tem de ser testado antes
   de 'bold', e 'semibold' antes dos dois — senão o substring mais curto captura primeiro. */
const _DPSD_PESOS=[
  [/\b(?:extra|ultra)[\s._-]*black\b|\bextrablack\b/i, 950],
  [/\bblack\b|\bheavy\b|\bfat\b|\b900\b/i,             900],
  [/\b(?:extra|ultra)[\s._-]*bold\b|\bextrabold\b|\bultrabold\b|\b800\b/i, 800],
  [/\b(?:semi|demi)[\s._-]*bold\b|\bsemibold\b|\bdemibold\b|\b600\b/i,     600],
  [/\bbold\b|\b700\b/i,                                700],
  [/\bmedium\b|\b500\b/i,                              500],
  [/\bbook\b|\bregular\b|\bnormal\b|\broman\b|\b400\b/i,400],
  [/\b(?:extra|ultra)[\s._-]*light\b|\bextralight\b|\bultralight\b|\b200\b/i, 200],
  [/\blight\b|\b300\b/i,                               300],
  [/\bthin\b|\bhairline\b|\b100\b/i,                   100]
];
// Palavras que são ESTILO/PESO, não família — saem do nome para sobrar a família.
const _DPSD_LIMPA_FAM=/[\s._-]*(?:extra|ultra|semi|demi)?[\s._-]*(?:black|heavy|fat|bold|medium|book|regular|normal|roman|light|thin|hairline|italic|oblique|it)\b/gi;
/* Quebra o nome do Photoshop nas três informações que o navegador usa.
   `\b` sobre o nome com separadores normalizados: "Montserrat-SemiBold" vira
   "Montserrat SemiBold", então as bordas de palavra funcionam em PostScript e em nome legível. */
function _dPsdFontFace(fontName){
  const bruto=String(fontName||'');
  // camelCase → espaço ("MontserratSemiBold" → "Montserrat Semi Bold") e separadores → espaço,
  // para as bordas de palavra da tabela valerem em qualquer uma das quatro grafias.
  const legivel=bruto.replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[._-]+/g,' ').replace(/\s+/g,' ').trim();
  let peso=null;
  for(const [re,w] of _DPSD_PESOS){ if(re.test(legivel)){ peso=w; break; } }
  const italico=/\b(?:italic|oblique|it)\b/i.test(legivel);
  const familia=legivel.replace(_DPSD_LIMPA_FAM,'').replace(/\s+/g,' ').trim();
  return {
    postScriptName:bruto,
    familia:familia||legivel||'',
    peso:peso,                 // null = o nome não declara peso (≠ 400 assumido)
    italico:italico,
    pesoDeclarado:peso!=null
  };
}
/* Variante Roboto correspondente ao PESO pedido. O formato de retorno é o contrato que
   `dTextFontParts` já lê ("'Roboto',600"), então nada muda nos renderizadores.
   Antes esta função caçava substring e por isso herdava os mesmos erros de degrau. */
function _dPsdRobotoFont(fontName){
  const f=_dPsdFontFace(fontName);
  if(f.peso==null) return "'Roboto'";
  if(f.peso>=900) return "'Roboto Black'";
  return "'Roboto',"+f.peso;
}

// Extrai o estilo DOMINANTE de um nó de texto considerando todos os styleRuns.
// Run dominante = maior comprimento de texto. isMultiStyle=true quando há cores ou
// tamanhos distintos entre runs (indica ao usuário que o layer era estilo misto).
function _dPsdDominantStyle(t){
  if(!t) return {style:{}, isMultiStyle:false};
  const runs=Array.isArray(t.styleRuns)&&t.styleRuns.length?t.styleRuns:null;
  if(!runs) return {style:_dPsdTextStyle(t), isMultiStyle:false};
  const dominant=runs.reduce((best,r)=>(r.length||0)>(best.length||0)?r:best, runs[0]);
  const colors=new Set(runs.map(r=>{const c=r.style&&(r.style.fillColor||r.style.color);
    return c?Math.round(c.r||0)+','+Math.round(c.g||0)+','+Math.round(c.b||0):null;}));
  const sizes=new Set(runs.map(r=>Math.round((r.style&&(r.style.fontSize||r.style.size))||0)));
  return {style:dominant.style||{}, isMultiStyle:colors.size>1||sizes.size>1};
}
// Detecta o tipo de shape a partir do canvas rasterizado.
// Se os cantos forem transparentes e o centro opaco → é circular/elíptico.
function _dPsdDetectShapeKind(canvas){
  try{
    const w=canvas.width, h=canvas.height; if(w<8||h<8) return {kind:'rect',radius:0};
    const ctx=canvas.getContext('2d');
    if(ctx.getImageData(Math.floor(w/2),Math.floor(h/2),1,1).data[3]<200) return {kind:'rect',radius:0};
    const data=ctx.getImageData(0,0,w,h).data;
    let d=0;
    const limit=Math.min(w,h);
    for(let i=0;i<limit;i++){
      if(data[(i*w+i)*4+3]>=128){
        d=i;
        break;
      }
    }
    const ratio=w/h;
    if(d>=limit*0.12){
      const kind=(ratio>0.85&&ratio<1.18)?'circle':'ellipse';
      return {kind,radius:0};
    }else{
      return {kind:'rect',radius:Math.round(d*3.4)};
    }
  }catch(e){ return {kind:'rect',radius:0}; }
}

// Detecta ROTAÇÃO significativa da camada. O modelo do Luma não tem rotação, então uma camada
// rotacionada, se importada como texto/shape editável, viria eixo-alinhada (torta/errada). Detectar
// aqui permite rasterizar o pixel já rotacionado (1:1). Texto: ângulo do transform (a,b). Forma:
// cantos da caixa de origem (keyOriginBoxCorners) fora do eixo. Threshold ~1.5° evita falso positivo.
function _dPsdIsRotatedLayer(node){
  try{
    const tt=node.text&&node.text.transform;
    if(tt&&tt.length>=2 && Math.abs(Math.atan2(+tt[1]||0, +tt[0]||1))>0.0262) return true; // texto rotacionado
    const list=node.vectorOrigination&&node.vectorOrigination.keyDescriptorList;
    if(list) for(let i=0;i<list.length;i++){
      const c=list[i]&&list[i].keyOriginBoxCorners;
      if(c&&c.length===4){
        const dyTop=Math.abs((c[0].y||0)-(c[1].y||0));   // aresta superior deveria ser horizontal
        const dxLeft=Math.abs((c[0].x||0)-(c[3].x||0));  // aresta esquerda deveria ser vertical
        const wRef=Math.abs((c[1].x||0)-(c[0].x||0))||1, hRef=Math.abs((c[3].y||0)-(c[0].y||0))||1;
        if(dyTop>Math.max(2,wRef*0.02) || dxLeft>Math.max(2,hRef*0.02)) return true; // caixa girada
      }
    }
  }catch(e){}
  return false;
}
// Texto em CURVA (type on path). O Photoshop guarda o caminho da baseline na MÁSCARA VETORIAL
// da própria camada de texto (ag-psd não expõe isso de outro jeito: shapeType só distingue
// point/box). Detectar é duplamente necessário: além de o Luma não ter texto em curva, o caminho
// aberto era tratado como RECORTE por _dPsdVectorMaskCanvas e comia o texto na importação.
function _dPsdTextOnPath(node){
  const vm=node&&node.text&&node.vectorMask;
  return !!(vm && !vm.disable && vm.paths && vm.paths.length);
}
// Camada ESPELHADA (flip horizontal/vertical) ou girada 180°. O modelo do Luma não tem espelho
// nem rotação, então importar editável devolveria a camada desvirada — silenciosamente errada.
//  • Texto: determinante negativo do transform (a·d − b·c) = a matriz inverte a orientação.
//  • Forma: na caixa de origem, o canto superior-DIREITO à esquerda do superior-esquerdo
//    (flip H) ou o inferior-ESQUERDO acima do superior-esquerdo (flip V).
// Complementa _dPsdIsRotatedLayer, que não pega 180° (as arestas continuam alinhadas ao eixo).
function _dPsdIsFlippedLayer(node){
  try{
    const tt=node.text&&node.text.transform;
    if(tt&&tt.length>=4){
      const det=(+tt[0]||0)*(+tt[3]||0)-(+tt[1]||0)*(+tt[2]||0);
      if(det<0) return true;
    }
    const list=node.vectorOrigination&&node.vectorOrigination.keyDescriptorList;
    if(list) for(let i=0;i<list.length;i++){
      const c=list[i]&&list[i].keyOriginBoxCorners;
      if(c&&c.length===4){
        if(((c[1].x||0)-(c[0].x||0))<0) return true; // espelhada na horizontal
        if(((c[3].y||0)-(c[0].y||0))<0) return true; // espelhada na vertical
      }
    }
  }catch(e){}
  return false;
}
/* ══════════════════════════════════════════════════════════════════════════════════════════
   ESTÁGIO DE CAPACIDADE — a ÚNICA decisão de fidelidade do importador
   ------------------------------------------------------------------------------------------
   POR QUE EXISTE. A pergunta "o Luma consegue representar esta camada?" era respondida em
   seis lugares diferentes deste arquivo, cada um escrevendo o seu próprio booleano:
   `_dPsdNeedsRaster` (gatilhos do nó cru), o bloco `_fxUnsup` no fim do walk, o par
   fillOpacity+efeitos em `dItemToLayer` (a MESMA regra do `_fxUnsup`, escrita de novo),
   `_dPsdAdjustmentInfo`, `_dPsdGradStyle` e `_dPsdEffects`. A revisão então remontava o
   veredito a partir de doze campos soltos (`fxSatin`, `strokeApprox`, `gradientUnsupported`,
   `layerEffectsApprox`, `textOnPath`, `flipped`, …). Consequências reais:
     · não havia como responder "o dado veio errado do decoder ou nós interpretamos errado?";
     · a regra duplicada de fillOpacity podia divergir no primeiro conserto de um dos lados;
     · `dItemToLayer` MUTAVA `it.needsRaster` durante a conversão — e a prévia da revisão
       chama `dItemToLayer`, então ver a prévia alterava o estado que o import leria depois;
     · perda sem nome: a camada guardava o motivo em booleano, nunca em texto auditável.

   O QUE ESTE ESTÁGIO É. Um livro-caixa por camada (`it.capability`), preenchido em três
   momentos que já existiam no pipeline — só passaram a ter nome:

     _dPsdCapNode(node)    estágio DECODE      o nó cru já obriga raster? (smart object,
                                               padrão, rotação, espelho, warp, texto em curva)
     _dPsdCapItem(it)      estágio CAPACIDADE  o que interpretamos é representável? (pilha de
                                               efeitos, gradiente sem primitiva, blend de
                                               overlay, fillOpacity com efeito, fonte ausente…)
     _dPsdCapMarca(...)    qualquer estágio    registra um motivo nomeado, com nível e etapa

   NÍVEIS (o vocabulário do §14 do briefing):
     'native'       representável 1:1 e editável;
     'native_lossy' representável, com uma diferença CONHECIDA e nomeada;
     'raster'       não é representável editável — o pixel do Photoshop é a fonte fiel;
     'unsupported'  nem editável nem rasterizável (não há pixel) — perda declarada.

   ⛔ O estágio NÃO rasteriza e NÃO converte: ele só decide e explica. Quem chama é que
   pega o pixel (`_dPsdRasterURL`) e quem converte é `dItemToLayer`. Assim a decisão fica
   testável sem canvas e sem DOM.
   ⛔ Os booleanos antigos continuam sendo escritos: a revisão, os testes e os três
   renderizadores os leem. O livro-caixa é a fonte da DECISÃO; os booleanos passam a ser
   derivados dela, não decisões paralelas.                                                */
const _DPSD_CAP_NIVEIS={native:0, native_lossy:1, raster:2, unsupported:3};
/* Vocabulário fechado de motivos. `etapa` responde "em que fase isto se decidiu" — é o que
   permite classificar um defeito sem depurar por tentativa e erro (§29 do briefing).
   `rotulo` é PT-BR porque vai para a revisão e para o diagnóstico, não só para o console. */
const _DPSD_CAP_MOTIVOS={
  /* ── etapa DECODE: o formato PSD já não entrega algo interpretável ── */
  smart_object:        {nivel:'raster',       etapa:'decode',     atencao:'info', visual:'preservado', rotulo:'Objeto inteligente deformado — o Photoshop entrega só o composto achatado'},
  /* Uma FOTO colocada reta (sem perspectiva, warp, rotação ou cisalhamento) é visualmente
     uma imagem comum: o pixel continua sendo a única fonte que o ag-psd entrega, mas trocar
     o conteúdo por outra foto reproduz o mesmo resultado. Separar os dois casos é o que
     permite a revisão oferecer "Moldura de foto" com honestidade num, e não no outro. */
  smart_object_substituivel:{nivel:'raster',  etapa:'decode',     atencao:'info', visual:'preservado', rotulo:'Objeto inteligente com foto reta — o conteúdo pode ser substituído'},
  adjustment_layer:    {nivel:'raster',       etapa:'decode',     atencao:'info', visual:'preservado', rotulo:'Camada de ajuste sem pixels próprios'},
  pattern_fill:        {nivel:'raster',       etapa:'decode',     atencao:'info', visual:'preservado', rotulo:'Preenchimento por padrão — o Luma não tem modelo de padrão'},
  pattern_overlay:     {nivel:'raster',       etapa:'decode',     atencao:'info', visual:'preservado', rotulo:'Sobreposição de padrão — o Luma não tem modelo de padrão'},
  rotated:             {nivel:'raster',       etapa:'geometria',  atencao:'info', visual:'preservado', rotulo:'Camada rotacionada — o modelo do Luma não tem rotação'},
  flipped:             {nivel:'raster',       etapa:'geometria',  atencao:'info', visual:'preservado', rotulo:'Camada espelhada ou girada 180°'},
  text_on_path:        {nivel:'raster',       etapa:'geometria',  atencao:'review', visual:'preservado', rotulo:'Texto em curva (type on path)'},
  text_warp:           {nivel:'raster',       etapa:'geometria',  atencao:'review', visual:'preservado', rotulo:'Texto deformado (warp) — a deformação está nos pixels'},
  /* ── etapa CAPACIDADE: interpretamos certo, mas o Luma não representa ── */
  fx_stack_partial:    {nivel:'raster',       etapa:'capacidade', atencao:'info', visual:'preservado', rotulo:'Parte da pilha de efeitos não tem equivalente editável'},
  fx_stack_non_shape:  {nivel:'raster',       etapa:'capacidade', atencao:'info', visual:'preservado', rotulo:'Pilha de efeitos múltiplos só é dinâmica em formas'},
  gradient_style:      {nivel:'raster',       etapa:'capacidade', atencao:'info', visual:'preservado', rotulo:'Gradiente cônico ou losango — sem primitiva no Luma'},
  overlay_blend:       {nivel:'raster',       etapa:'capacidade', atencao:'info', visual:'preservado', rotulo:'Sobreposição de cor com mesclagem'},
  gradient_ovl_blend:  {nivel:'raster',       etapa:'capacidade', atencao:'info', visual:'preservado', rotulo:'Sobreposição de gradiente com mesclagem'},
  text_fx_unsupported: {nivel:'raster',       etapa:'capacidade', atencao:'review', visual:'preservado', rotulo:'Efeito interno em texto (sombra interna, brilho interno, relevo ou gradiente)'},
  fill_opacity_with_fx:{nivel:'raster',       etapa:'capacidade', atencao:'info', visual:'preservado', rotulo:'Opacidade de preenchimento com efeitos — o modelo tem um canal só'},
  parse_recovered:     {nivel:'raster',       etapa:'decode',     atencao:'review', visual:'preservado', rotulo:'Camada não interpretável — recuperada do pixel composto'},
  flattened_document:  {nivel:'raster',       etapa:'decode',     atencao:'review', visual:'preservado', rotulo:'Arquivo sem camadas editáveis — arte achatada'},
  /* ── perdas CONHECIDAS que não pedem raster (o pixel também não as carrega) ── */
  fx_satin:            {nivel:'native_lossy', etapa:'capacidade', atencao:'info', visual:'aproximado', rotulo:'Cetim não tem equivalente'},
  fx_contour:          {nivel:'native_lossy', etapa:'capacidade', atencao:'info', visual:'aproximado', rotulo:'Contorno customizado de efeito ignorado'},
  fx_scale:            {nivel:'native_lossy', etapa:'capacidade', atencao:'info', visual:'aproximado', rotulo:'Escala de efeitos diferente de 100%'},
  stroke_approx:       {nivel:'native_lossy', etapa:'capacidade', atencao:'info', visual:'aproximado', rotulo:'Traço com gradiente ou padrão aproximado por cor sólida'},
  gradient_ovl_approx: {nivel:'native_lossy', etapa:'capacidade', atencao:'review', visual:'aproximado', rotulo:'Sobreposição de gradiente cônica ou losango aproximada'},
  fx_stack_blend:      {nivel:'native_lossy', etapa:'capacidade', atencao:'info', visual:'aproximado', rotulo:'Mesclagem da pilha de efeitos aproximada'},
  group_blend_flat:    {nivel:'native_lossy', etapa:'dependencia',atencao:'info', visual:'aproximado', rotulo:'Mesclagem de grupo aplicada camada a camada'},
  blend_dropped:       {nivel:'native_lossy', etapa:'capacidade', atencao:'review', visual:'aproximado', rotulo:'Modo de mesclagem sem render no Luma — entrou como Normal'},
  adjust_unsupported:  {nivel:'native_lossy', etapa:'capacidade', atencao:'review', visual:'aproximado', rotulo:'Tipo de ajuste que o Luma ainda não recalcula'},
  adjust_approx:       {nivel:'native_lossy', etapa:'capacidade', atencao:'info', visual:'aproximado', rotulo:'Ajuste com matemática aproximada do Photoshop'},
  /* Os três estados de fonte que NÃO são 'exact'. Separados de propósito: cada um tem uma
     consequência diferente na largura da linha, e nenhum deles é erro de geometria. */
  font_approximated:   {nivel:'native_lossy', etapa:'fonte',      atencao:'review', visual:'aproximado', rotulo:'Fonte parecida pelo nome, mas é outro arquivo — a métrica difere'},
  font_substituted:    {nivel:'native_lossy', etapa:'fonte',      atencao:'review', visual:'aproximado', rotulo:'Fonte ausente — Roboto no mesmo peso; o desenho da letra difere'},
  font_missing:        {nivel:'native_lossy', etapa:'fonte',      atencao:'review', visual:'aproximado', rotulo:'Fonte ausente e sem peso no nome — Roboto Regular, peso adivinhado'},
  text_multi_style:    {nivel:'native_lossy', etapa:'texto',      atencao:'review', visual:'aproximado', rotulo:'Estilos mistos reduzidos ao estilo dominante'},
  text_justify_all:    {nivel:'native_lossy', etapa:'texto',      atencao:'info', visual:'aproximado', rotulo:'Justificado total — a última linha não estica'},
  text_box_approx:     {nivel:'native_lossy', etapa:'geometria',  atencao:'review', visual:'aproximado', rotulo:'Caixa de parágrafo não derivável — usando o contorno dos glifos'},
  /* Escala não uniforme: o painel Caractere do Photoshop condensa/estica a letra num eixo só,
     e o modelo do Luma tem UM corpo de fonte. O corpo segue o eixo vertical e o estiramento
     horizontal é perda conhecida — nomeada, porque compensá-la com tracking seria falseá-la
     (tracking afasta letras; escala horizontal deforma o glifo). */
  text_scale_nao_unif: {nivel:'native_lossy', etapa:'texto',      atencao:'review', visual:'aproximado', rotulo:'Letra condensada ou esticada num eixo só — o Luma tem um corpo de fonte'},
  text_size_estimado:  {nivel:'native_lossy', etapa:'texto',      atencao:'review', visual:'aproximado', rotulo:'O arquivo não trouxe o corpo da fonte — estimado pela altura da caixa'},
  vector_mask_failed:  {nivel:'native_lossy', etapa:'mascara',    atencao:'review', visual:'aproximado', rotulo:'Recorte vetorial não rasterizável — forma simplificada'},
  clip_base_fallback:  {nivel:'native_lossy', etapa:'dependencia',atencao:'info', visual:'aproximado', rotulo:'Base de recorte complexa — recorte simplificado'},
  /* ── a perda que NENHUM aviso cobria (achado desta rodada) ─────────────────────────────
     `_dPsdApplyFx` copia sombra/brilho/contorno/sobreposição para camadas que a conversão
     entrega como `type:'image'` ou `type:'frame'` — e NENHUM dos três renderizadores lê
     efeito nesses tipos (`fRenderOneLayer` ramo image/frame, o DOM de `canvas.js`, o SVG).
     Ou seja: objeto inteligente com sombra projetada, e todo texto que virou imagem fiel
     JUSTAMENTE por causa de um efeito, perdiam o efeito em silêncio — o dado era gravado e
     ninguém o consumia. Enquanto os renderizadores não lerem efeito em imagem, a saída
     honesta é declarar a perda em vez de fingir que ela não existe (§51 do briefing). */
  /* O ÚNICO bloqueante: a camada pediu raster fiel e não existe pixel para preservar. Nem
     editável, nem imagem — a aparência foi perdida e o Luma não tem como recuperá-la. É a
     diferença entre "recuperado" e "perdido" (§39), e é o que não pode ser anunciado como
     importação bem-sucedida. */
  sem_representacao:   {nivel:'unsupported',  etapa:'capacidade', atencao:'blocking', visual:'perdido', rotulo:'Não foi possível preservar esta camada — nem editável, nem como imagem'},
  fx_only_native:      {nivel:'native_lossy', etapa:'conversao',  atencao:'info', visual:'aproximado', rotulo:'Efeito que só sai em texto ou forma — em imagem fiel ele não é aplicado'}
};
/* ══ CADEIA DE DIAGNÓSTICO — desligada por padrão ═════════════════════════════════════════
   Para achar em QUE PONTO a informação divergiu, o livro-caixa de capacidade não basta: ele
   diz o que se perdeu, não onde a caixa mudou de valor. Este é o registro por etapa:

     PHOTOSHOP → decode (o que o ag-psd entregou) → normalize (o que lemos)
     → geometry (a caixa resolvida e de ONDE ela veio) → dependencies (grupo, recorte, máscara)
     → capability (o veredito) → convert (o tipo Luma final)

   ⛔ Desligada por padrão e sem custo quando desligada: cada ponto de registro é um `if` de
   booleano. Nada de `console.log` solto — ligar é `dPsdTrace(true)` antes de abrir o arquivo,
   e ler é `dPsdDiagnostico()`. Não persiste: o registro morre com o item. */
let _dPsdTraceOn=false;
function dPsdTrace(on){ _dPsdTraceOn=(on!==false); return _dPsdTraceOn; }
function _dPsdTrace(it, etapa, dados){
  if(!_dPsdTraceOn || !it) return;
  (it.trace||(it.trace=[])).push(Object.assign({etapa}, dados||{}));
}
// Caixa em texto curto, o formato que a cadeia usa para "de onde para onde" ficar legível.
function _dPsdCx(b){ return b?(Math.round(b.x)+','+Math.round(b.y)+' '+Math.round(b.w)+'×'+Math.round(b.h)):'—'; }
// Livro-caixa novo. `raster` é o que o walk consulta; `motivos` é o que a revisão explica.
function _dPsdCapNovo(){ return {nivel:'native', raster:false, motivos:[]}; }
/* Registra um motivo. Idempotente por código: o mesmo motivo marcado duas vezes (o walk e o
   pós-processamento podem ver a mesma condição) não duplica a linha da revisão. */
function _dPsdCapMarca(cap, code, detalhe){
  if(!cap || !_DPSD_CAP_MOTIVOS[code]) return cap;
  if(cap.motivos.some(m=>m.code===code)) return cap;
  const def=_DPSD_CAP_MOTIVOS[code];
  cap.motivos.push({code, nivel:def.nivel, etapa:def.etapa, rotulo:def.rotulo, detalhe:detalhe||''});
  if(_DPSD_CAP_NIVEIS[def.nivel] > _DPSD_CAP_NIVEIS[cap.nivel]) cap.nivel=def.nivel;
  if(def.nivel==='raster') cap.raster=true;
  return cap;
}
// Garante o livro-caixa no item (itens vindos de `_dPsdParseFail`/`_dPsdFlatItem` nascem sem).
function _dPsdCapDe(it){ if(!it.capability) it.capability=_dPsdCapNovo(); return it.capability; }
/* "Este motivo vale para esta camada?" — a pergunta que a conversão e a revisão fazem, em vez
   de recalcular a condição por conta própria. Item sem livro-caixa (chamada direta a
   `dItemToLayer`, como na suíte) é avaliado na hora: a regra vale para todo caller, sempre. */
function _dPsdCapTem(it, code){
  if(!it) return false;
  const cap=it.capability||_dPsdCapItem(it);
  return !!(cap && cap.motivos.some(m=>m.code===code));
}
/* ══ OBJETO INTELIGENTE — a leitura que faltava ═══════════════════════════════════════════
   `_dPsdCapNode` mandava todo smart object para raster fiel e nunca olhava o que ele é. Mas o
   ag-psd entrega bastante: `placedLayer.type` ('raster' | 'vector' | 'image stack'), os
   **4 cantos** da colocação em `transform` (8 números: x,y × 4), `nonAffineTransform` — que
   só existe quando DIFERE do transform, ou seja, é a assinatura de PERSPECTIVA —, `warp`,
   `crop` e a dimensão ORIGINAL do conteúdo (`width`/`height`).
   Isso separa dois casos que eram um só (§13 do briefing):
     · uma FOTO colocada reta — quadrilátero alinhado ao eixo, sem perspectiva nem warp. É o
       hambúrguer do PSD: visualmente é uma imagem comum e continua substituível;
     · um MOCKUP — perspectiva, rotação, cisalhamento ou warp. Aí o pixel composto é a única
       verdade e reconstruir não faz sentido.
   ⛔ NÃO decide campo nem modo: só descreve. Quem decide fidelidade é o estágio de
   capacidade, e quem escolhe o vínculo é o designer na revisão (§39/§47).
   A ordem dos cantos no `transform` do Photoshop é superior-esquerdo, superior-direito,
   inferior-direito, inferior-esquerdo. */
function _dPsdSmartObject(node){
  const pl=node&&(node.placedLayer||node.smartObject);
  if(!pl) return null;
  const t=Array.isArray(pl.transform)&&pl.transform.length>=8?pl.transform.map(Number):null;
  const out={
    tipo:pl.type||'unknown',
    larguraOriginal:+pl.width||0, alturaOriginal:+pl.height||0,
    temCrop:!!pl.crop,
    // `nonAffineTransform` presente ⟺ a colocação tem perspectiva (o Photoshop só grava a
    // segunda matriz quando ela difere da afim).
    perspectiva:!!pl.nonAffineTransform,
    warp:false, eixoAlinhado:true, rotacao:0, cisalhado:false
  };
  const w=pl.warp;
  if(w && w.style && w.style!=='none' && w.style!=='warpNone' && ((+w.value||0)!==0||(+w.perspective||0)!==0)) out.warp=true;
  if(t){
    const [x0,y0,x1,y1,x2,y2,x3,y3]=t;
    // Aresta superior e aresta esquerda: num quadrilátero alinhado ao eixo, a superior é
    // horizontal (dy≈0) e a esquerda é vertical (dx≈0).
    const larg=Math.hypot(x1-x0,y1-y0), alt=Math.hypot(x3-x0,y3-y0);
    const tol=Math.max(1, Math.max(larg,alt)*0.01);
    out.eixoAlinhado=(Math.abs(y1-y0)<=tol && Math.abs(x3-x0)<=tol);
    out.rotacao=Math.round(Math.atan2(y1-y0,x1-x0)*180/Math.PI*100)/100;
    // Cisalhamento: as duas arestas deveriam ser perpendiculares. O produto escalar
    // normalizado mede o desvio, e é imune a rotação (ao contrário de comparar com o eixo).
    const dot=((x1-x0)*(x3-x0)+(y1-y0)*(y3-y0))/Math.max(1e-6,larg*alt);
    out.cisalhado=Math.abs(dot)>0.02;
    out.larguraColocada=Math.round(larg); out.alturaColocada=Math.round(alt);
    // Escala da colocação: quanto do conteúdo original está sendo mostrado. É o que diz se o
    // raster precisa de mais resolução do que a caixa da camada sugere.
    if(out.larguraOriginal>0) out.escala=+(larg/out.larguraOriginal).toFixed(4);
  }
  /* SUBSTITUÍVEL = a colocação é uma imagem reta. Só nesse caso a camada é, visualmente, uma
     foto comum — e portanto trocar o conteúdo por outra foto reproduz o mesmo resultado. */
  out.substituivel=(out.tipo==='raster'||out.tipo==='unknown')
    && out.eixoAlinhado && !out.perspectiva && !out.warp && !out.cisalhado;
  return out;
}
/* ESTÁGIO 1 (DECODE) — o veredito que só depende do nó cru do ag-psd. É a antiga
   `_dPsdNeedsRaster`, agora devolvendo o PORQUÊ junto com o sim/não. */
function _dPsdCapNode(node){
  const cap=_dPsdCapNovo();
  if(!node) return cap;
  /* OBJETO INTELIGENTE: o veredito passou a depender do QUE ele é, não só de que é um.
     Uma foto colocada reta continua raster (o ag-psd só entrega o composto achatado, então o
     pixel é a única fonte) mas ganha o motivo `smart_object_substituivel` — que diz à revisão
     que trocar por outra foto reproduz o mesmo resultado. Perspectiva, warp, rotação e
     cisalhamento ganham o motivo específico: são os casos em que reconstruir não faz sentido
     e nem substituir o conteúdo é seguro. */
  const _so=_dPsdSmartObject(node);
  if(_so){
    const _det=[];
    if(_so.perspectiva) _det.push('perspectiva');
    if(_so.warp) _det.push('warp');
    if(_so.cisalhado) _det.push('cisalhamento');
    if(!_so.eixoAlinhado && Math.abs(_so.rotacao)>0.5) _det.push('rotação '+_so.rotacao+'°');
    if(_so.tipo==='vector') _det.push('conteúdo vetorial colocado');
    _dPsdCapMarca(cap, _so.substituivel?'smart_object_substituivel':'smart_object',
      _det.join(' · ')||(_so.tipo||''));
  }
  if(node.adjustment) _dPsdCapMarca(cap,'adjustment_layer');
  if(node.vectorFill && node.vectorFill.type==='pattern') _dPsdCapMarca(cap,'pattern_fill');
  let po=node.effects && node.effects.patternOverlay; if(Array.isArray(po)) po=po[0];
  if(po && po.enabled!==false) _dPsdCapMarca(cap,'pattern_overlay');
  if(_dPsdIsRotatedLayer(node)) _dPsdCapMarca(cap,'rotated');
  if(_dPsdIsFlippedLayer(node)) _dPsdCapMarca(cap,'flipped');
  if(_dPsdTextOnPath(node)) _dPsdCapMarca(cap,'text_on_path');
  // texto com WARP (arco/onda/bandeira/etc): a deformação faz parte dos PIXELS do node.canvas,
  // não dá pra reproduzir como texto editável → raster preserva o visual deformado 1:1.
  if(node.text && node.text.warp){
    const ws=node.text.warp.style;                       // ag-psd DECODIFICA: sem warp = 'none' (não 'warpNone')
    const bent=(node.text.warp.value||0)!==0 || (node.text.warp.perspective||0)!==0; // bend 0% = sem deformação visível
    if(ws && ws!=='none' && ws!=='warpNone' && bent) _dPsdCapMarca(cap,'text_warp');
  }
  return cap;
}
/* Compatibilidade: a pergunta booleana continua respondida, agora derivada do estágio.
   Mantida porque é o nome que a suíte e o histórico usam para este conceito. */
function _dPsdNeedsRaster(node){ return _dPsdCapNode(node).raster; }
/* ESTÁGIO 2 (CAPACIDADE) — o veredito sobre o que JÁ interpretamos. Recebe o item pronto
   (kind/efeitos/texto/gradiente decididos) e devolve o livro-caixa completo.
   ⚠ Só DECIDE: não escreve `imgUrl` nem muta `kind`/`mode` — quem chama faz isso, porque só
   ele sabe se há `node.canvas` utilizável e qual o teto de resolução da prancheta. */
function _dPsdCapItem(it){
  const cap=_dPsdCapDe(it);
  const _fx=it.shadow||it.innerShadow||it.glow||it.innerGlow||it.bevel||it.overlay||it.gradientOverlay||it.strokeW||it.layerEffects;
  /* ── as sete condições que exigem raster fiel (eram o bloco `_fxUnsup`) ── */
  if(it._fxOverflow) _dPsdCapMarca(cap,'fx_stack_partial');
  if(it.layerEffects && it.kind!=='shape') _dPsdCapMarca(cap,'fx_stack_non_shape');
  if(it.gradientUnsupported) _dPsdCapMarca(cap,'gradient_style', it.gradientUnsupported==='angle'?'cônico':'losango');
  if(it.overlayBlend) _dPsdCapMarca(cap,'overlay_blend', it.overlayBlend);
  if(it.gradientOverlay && it.gradientOverlay.blendMode) _dPsdCapMarca(cap,'gradient_ovl_blend', it.gradientOverlay.blendMode);
  if(it.kind==='text' && (it.innerShadow||it.innerGlow||it.bevel||it.gradientOverlay)) _dPsdCapMarca(cap,'text_fx_unsupported');
  /* fillOpacity ≠ opacity: o Photoshop atenua só o preenchimento, não os efeitos. Sem efeito a
     conversão dobra os dois num canal (equivalente exato); COM efeito não é representável.
     Esta era a regra escrita duas vezes — aqui e em `dItemToLayer` — que agora tem um dono. */
  if(it.fillOpacity!=null && it.fillOpacity<1 && _fx) _dPsdCapMarca(cap,'fill_opacity_with_fx');
  /* ── perdas conhecidas que o pixel também não resolve: registra, não rasteriza ── */
  if(it.fxSatin) _dPsdCapMarca(cap,'fx_satin');
  if(it.fxContour) _dPsdCapMarca(cap,'fx_contour');
  if(it.fxScale) _dPsdCapMarca(cap,'fx_scale', it.fxScale+'%');
  if(it.strokeApprox) _dPsdCapMarca(cap,'stroke_approx');
  if(it.gradientOverlayApprox) _dPsdCapMarca(cap,'gradient_ovl_approx', it.gradientOverlayApprox==='angle'?'cônica':'losango');
  if(it.layerEffectsApprox) _dPsdCapMarca(cap,'fx_stack_blend');
  if(it.groupBlendApprox) _dPsdCapMarca(cap,'group_blend_flat');
  if(it.adjustmentSupported===false) _dPsdCapMarca(cap,'adjust_unsupported', it.adjustmentType||'');
  if(it.adjustmentApprox) _dPsdCapMarca(cap,'adjust_approx', it.adjustmentType||'');
  if(it.multiStyle) _dPsdCapMarca(cap,'text_multi_style');
  if(it.textJustifyAll) _dPsdCapMarca(cap,'text_justify_all');
  if(it.textBoxApprox) _dPsdCapMarca(cap,'text_box_approx');
  if(it.textScaleRazao) _dPsdCapMarca(cap,'text_scale_nao_unif', it.textScaleRazao+'% na horizontal');
  if(it.fontSizeEstimado) _dPsdCapMarca(cap,'text_size_estimado');
  if(it.vectorMaskFailed) _dPsdCapMarca(cap,'vector_mask_failed');
  /* Fonte: quatro estados, quatro consequências diferentes de fidelidade. Registrar o estado
     em vez de um "ausente" genérico é o que impede um erro de TIPOGRAFIA de ser investigado
     como erro de POSIÇÃO — a métrica de outra família muda a largura de cada linha, e
     compensar isso movendo x/y é o conserto errado. 'exact' não gera motivo: não há perda. */
  if(it.kind==='text' && it.fontName && !/roboto/i.test(it.fontName)){
    const _fs=it.fontStatus || (it.fontRemapped?'exact':'missing'); // item de fora do parse
    if(_fs==='approximated') _dPsdCapMarca(cap,'font_approximated', it.fontName);
    else if(_fs==='substituted') _dPsdCapMarca(cap,'font_substituted', it.fontName);
    else if(_fs==='missing') _dPsdCapMarca(cap,'font_missing', it.fontName);
  }
  /* Efeito que a camada carrega E que só texto/forma renderizam. Desde 10/09 o motor Canvas,
     o SVG e o DOM consomem SOMBRA, BRILHO e SOBREPOSIÇÃO em `type:'image'`/`'frame'` — então
     esses três deixaram de ser perda e saíram desta conta. Continuam de fora do raster, por
     dependerem da borda real do recorte (dilatação/erosão do alpha) e não da caixa:
     contorno, sombra interna, brilho interno e relevo.
     Registrar só o que REALMENTE se perde é o ponto: um aviso que descreve perda inexistente
     ensina o designer a ignorar os avisos. */
  if(_DPSD_FX_SO_NATIVO.some(k=>it[k])) _dPsdCapMarca(cap,'fx_only_native',
    _DPSD_FX_SO_NATIVO.filter(k=>it[k]).map(k=>_DPSD_FX_NOME[k]||k).join(', '));
  return cap;
}
/* Os efeitos que NENHUM renderizador aplica em imagem/moldura, e o nome de cada um em PT-BR
   para o aviso dizer QUAL efeito se perde em vez de "os efeitos". Um lugar só: se um deles
   passar a ser suportado, sai desta lista e o aviso deixa de aparecer — sem caçar condição. */
const _DPSD_FX_SO_NATIVO=['strokeW','innerShadow','innerGlow','bevel'];
const _DPSD_FX_NOME={strokeW:'contorno',innerShadow:'sombra interna',innerGlow:'brilho interno',bevel:'relevo'};
/* A camada, NO MODO ATUAL, vai perder efeito? Regra única para a revisão e para o diagnóstico.
   Os modos 'raster' e 'frame' e o veredito de raster fiel terminam todos em
   `type:'image'`/`'frame'`, onde a lista acima não é renderizada. */
function _dPsdCapPerdeFx(it){
  if(!it || !it.capability) return false;
  if(!it.capability.motivos.some(m=>m.code==='fx_only_native')) return false;
  if(it.mode==='raster' || it.mode==='frame') return true;
  return !!it.needsRaster;
}
/* ══════════════════════════════════════════════════════════════════════════════════════════
   ATENÇÃO — o segundo eixo, e o que separa esta rodada das anteriores
   ------------------------------------------------------------------------------------------
   O livro-caixa de capacidade responde COMO a camada foi convertida. Isso não é a mesma
   pergunta que o designer faz, que é: PRECISO FAZER ALGO?

   As duas se confundiam, e a confusão tem um custo concreto nos dois sentidos: uma textura
   decorativa que virou raster fiel aparecia como aviso (trabalho inventado), e uma headline
   com a fonte trocada aparecia com o mesmo peso de um aviso de cetim (atenção diluída).
   `RASTER_FALLBACK` não é problema — é ferramenta de fidelidade. Fonte ausente numa headline
   é problema, mesmo sendo `native`.

   Por isso cada motivo declara os dois eixos, no MESMO lugar onde declara o nível:
     · `atencao` : ok | info | review | blocking
     · `visual`  : preservado | aproximado | perdido

   E são independentes de propósito: `visual:'preservado'` com `atencao:'review'` é exatamente
   o caso do texto que virou imagem — a arte está igual, mas aquela camada deixou de poder
   ser um campo, e isso o designer precisa saber.                                            */
const _DPSD_ATENCAO_ORDEM={ok:0, info:1, review:2, blocking:3};
/* RELEVÂNCIA ESTRUTURAL (§12) — uma diferença numa textura de fundo não pesa como uma
   diferença numa headline. Não é semântica de campo (isso é a fase seguinte, §13/§49): são
   características REAIS da camada que já estão na mão.
   `escalaTipo` é o conjunto ordenado dos corpos de fonte da arte — a mesma ideia de "degraus"
   que o `gCompileLayoutRoles` usa. Vem calculado da própria lista de itens, então não há
   limiar absoluto em px inventado aqui.
   ⛔ Só ELEVA por prominência; a única redução é para letra miúda de rodapé em aviso de
   fonte, onde a diferença de desenho realmente não muda a peça. Esconder é mais perigoso que
   mostrar, então a redução é estreita e explícita. */
function _dPsdAtencao(it, ctx){
  const cap=it&&it.capability;
  if(!cap||!cap.motivos.length) return {nivel:'ok', motivos:[]};
  ctx=ctx||{};
  let pior='ok'; const relevantes=[];
  cap.motivos.forEach(m=>{
    const def=_DPSD_CAP_MOTIVOS[m.code]||{};
    let at=def.atencao||'info';
    /* ELEVA: camada já vinculada a um campo é conteúdo por definição — quem ligou o campo
       disse que aquilo varia. Sinal que JÁ existe; não é classificação nova. */
    const temCampo=(it.mode==='var'||it.mode==='frame')&&it.varName;
    if(at==='info' && temCampo) at='review';
    /* ELEVA: texto no topo da escala tipográfica da arte é a headline/preço, onde qualquer
       diferença é a primeira coisa que se vê. */
    const esc=ctx.escalaTipo||[];
    const grande=it.kind==='text' && esc.length>=2 && (it.fontSize||0)>=esc[0];
    if(at==='info' && grande) at='review';
    /* REDUZ (o único caso): aviso de FONTE em letra miúda de rodapé, sem campo ligado. O
       desenho da letra difere, mas num regulamento de 3 linhas isso não é o que exige a
       atenção de ninguém — e ocupar o lugar de um aviso real é o custo. */
    if(at==='review' && def.etapa==='fonte' && !temCampo
       && it.kind==='text' && esc.length>=3 && (it.fontSize||0)<=esc[esc.length-1]) at='info';
    if(_DPSD_ATENCAO_ORDEM[at]>_DPSD_ATENCAO_ORDEM[pior]) pior=at;
    if(at!=='ok') relevantes.push(Object.assign({}, m, {atencao:at, visual:def.visual||'preservado'}));
  });
  return {nivel:pior, motivos:relevantes};
}
/* CATEGORIAS DE ATENÇÃO — a tradução de motivo técnico para o que o designer lê. Uma
   categoria agrupa os motivos que pedem a MESMA ação, e é ela que decide título, explicação
   e botão (§26: ação contextual, não o mesmo botão para tudo).
   ⛔ Nenhuma string aqui menciona `NATIVE_WITH_LOSS`, `raster` ou nome de código. O designer
   entende o problema sem aprender o vocabulário do motor (§54). */
const _DPSD_ATENCAO_CATS=[
  {id:'fonte', codes:['font_approximated','font_substituted','font_missing'],
   titulo:'A fonte do Photoshop não está disponível',
   texto:it=>'“'+(it.fontName||'a fonte original')+'” não existe no Luma. O texto está usando '
     +(it.fontPesoUsado?('um peso '+it.fontPesoUsado):'uma fonte parecida')
     +', então a largura de cada linha pode diferir do arquivo original.',
   acao:'fonte'},
  {id:'texto_imagem', codes:['text_on_path','text_warp','text_fx_unsupported'],
   titulo:'Este texto entrou como imagem',
   texto:()=>'O Photoshop deformou este texto de um jeito que o Luma não reproduz como texto. '
     +'A aparência foi mantida, mas ele não pode ser editado nem virar um campo do franqueado.',
   acao:'ciente'},
  {id:'tipografia', codes:['text_multi_style','text_box_approx','text_scale_nao_unif','text_size_estimado'],
   titulo:'A tipografia deste texto foi adaptada',
   texto:()=>'O Photoshop usa um recurso de texto que o Luma representa de forma aproximada. '
     +'Vale conferir a quebra de linha e o tamanho.',
   acao:'ver'},
  {id:'cor', codes:['adjust_unsupported','blend_dropped','gradient_ovl_approx'],
   titulo:'A cor deste elemento pode diferir',
   texto:()=>'O Photoshop usa um tratamento de cor ou uma mesclagem que o Luma não reproduz '
     +'exatamente. O resto da camada entrou fiel.',
   acao:'ver'},
  {id:'recorte', codes:['vector_mask_failed'],
   titulo:'O recorte deste elemento foi simplificado',
   texto:()=>'A forma do recorte não pôde ser preservada com precisão. Vale conferir se a '
     +'borda está onde devia.',
   acao:'ver'},
  {id:'achatado', codes:['flattened_document'],
   titulo:'O arquivo não tinha camadas editáveis',
   texto:()=>'A arte entrou como uma imagem única, fiel ao que o Photoshop mostrava. Nada '
     +'dentro dela pode ser editado ou virar campo.',
   acao:'ciente'},
  {id:'recuperada', codes:['parse_recovered'],
   titulo:'Esta camada não pôde ser interpretada',
   texto:()=>'O Luma não conseguiu ler a estrutura desta camada e preservou os pixels que o '
     +'Photoshop já tinha composto. A aparência está mantida; a edição, não.',
   acao:'ver'},
  {id:'perdida', codes:['sem_representacao'],
   titulo:'Não foi possível preservar este elemento',
   texto:()=>'O Photoshop usa recursos que não puderam ser reconstruídos nem preservados como '
     +'imagem. Esta parte da arte não está fiel ao original.',
   acao:'ver'},
  {id:'imagem', codes:['smart_object','smart_object_substituivel','pattern_fill','pattern_overlay',
    'rotated','flipped','fx_stack_partial','fx_stack_non_shape','gradient_style','overlay_blend',
    'gradient_ovl_blend','fill_opacity_with_fx','adjustment_layer'],
   titulo:'Este elemento foi preservado como imagem',
   texto:()=>'Ele usa recursos do Photoshop que o Luma não reproduz separadamente. A aparência '
     +'foi mantida; ele não pode ser editado em partes.',
   acao:'ciente'},
  /* A única categoria que NÃO nasce do livro-caixa: existe para a divergência medida na tela
     que NENHUMA decisão conhecida explica. Ficar calado aqui seria o pior dos mundos — a arte
     está diferente e o motor não sabe por quê; dizer isso é mais honesto que não dizer nada. */
  {id:'divergencia', codes:['__divergencia__'],
   titulo:'Esta área ficou diferente do Photoshop',
   texto:()=>'A comparação com o arquivo original acusou diferença nesta região e nenhuma '
     +'adaptação conhecida explica isso. Vale conferir esta área na arte.',
   acao:'ver'},
  {id:'efeito', codes:['fx_satin','fx_contour','fx_scale','stroke_approx','fx_stack_blend',
    'group_blend_flat','adjust_approx','text_justify_all','clip_base_fallback','fx_only_native'],
   titulo:'Um efeito foi adaptado',
   texto:()=>'O Photoshop aplica este efeito de um jeito que o Luma aproxima. O resto da '
     +'camada entrou fiel.',
   acao:'ciente'}
];
function _dPsdCatDe(code){
  for(const c of _DPSD_ATENCAO_CATS){ if(c.codes.indexOf(code)>=0) return c; }
  return null;
}
/* ══ IMPORT RESULT — a fonte única de verdade do que aconteceu na importação ═══════════════
   Produzido pelo MOTOR, a partir do livro-caixa que já existe: nenhum PSD é reprocessado e a
   tela não recalcula regra nenhuma (§46 — a engine produz o resultado exista ou não tela).
   `pranchetas` é sempre um array, mesmo no caso de prancheta única: assim a revisão
   multi-prancheta e a de uma só leem a MESMA estrutura (§32).
   Cada prancheta entra como {nome, items}. `meta` traz o que a tela precisa para navegar.
   ⛔ TRANSITÓRIO (§30): nada disto é persistido no template. Morre quando o modal fecha. */
function dPsdImportResult(pranchetas, meta){
  meta=meta||{};
  const res={status:'ok', resumo:{camadas:0,native:0,lossy:0,raster:0,unsupported:0},
    pranchetas:[], atencoes:[]};
  (pranchetas||[]).forEach((pr,pi)=>{
    const itens=(pr.items||[]).filter(it=>it && it.include && !it.isMaskBase);
    /* A escala tipográfica desta prancheta: os corpos distintos, do maior para o menor. É o
       que dá relevância estrutural sem inventar semântica — a mesma ideia dos "degraus" do
       gCompileLayoutRoles, calculada aqui porque é aqui que a lista inteira está na mão. */
    const escalaTipo=[...new Set(itens.filter(i=>i.kind==='text').map(i=>Math.round(i.fontSize||0)).filter(Boolean))]
      .sort((a,b)=>b-a);
    const ctx={escalaTipo};
    itens.forEach(it=>{
      res.resumo.camadas++;
      const nivelCap=(it.capability&&it.capability.nivel)||'native';
      if(nivelCap==='native') res.resumo.native++;
      else if(nivelCap==='native_lossy') res.resumo.lossy++;
      else if(nivelCap==='raster') res.resumo.raster++;
      else res.resumo.unsupported++;
      const at=_dPsdAtencao(it, ctx);
      if(at.nivel==='ok') return;
      /* UM item de atenção por CATEGORIA por camada — não um por motivo. Uma camada com
         cetim, contorno e escala de efeito é UM aviso de "efeito adaptado", não três. */
      const porCat=new Map();
      at.motivos.forEach(m=>{
        const cat=_dPsdCatDe(m.code); if(!cat) return;
        const ja=porCat.get(cat.id);
        if(!ja || _DPSD_ATENCAO_ORDEM[m.atencao]>_DPSD_ATENCAO_ORDEM[ja.atencao]) porCat.set(cat.id,{cat,m,atencao:m.atencao,visual:m.visual});
      });
      porCat.forEach(({cat,m,atencao,visual})=>{
        res.atencoes.push({
          id:'at-'+pi+'-'+it.n+'-'+cat.id,
          prancheta:pi, pranchetaNome:pr.nome||meta.nome||'',
          itemN:it.n, camada:it.name, kind:it.kind,
          caixa:{x:it.x,y:it.y,w:it.w,h:it.h},
          nivel:atencao, categoria:cat.id, acao:cat.acao,
          titulo:cat.titulo, explicacao:cat.texto(it),
          // Os dois eixos, separados (§10): a arte pode estar 100% e a edição reduzida.
          /* Três estados, não dois: `achatada` é a camada que virou pixel fiel (a arte está
             lá, a edição não), e `perdida` é a que não foi preservada NEM como imagem.
             Chamar as duas de "entrou como imagem" mentiria justamente no caso pior. */
          visual:visual,
          editabilidade:(nivelCap==='unsupported')?'perdida':(nivelCap==='raster'?'achatada':'preservada'),
          // O código técnico viaja para a engenharia, nunca para a tela.
          _code:m.code, _detalhe:m.detalhe||''
        });
      });
    });
    res.pranchetas.push({nome:pr.nome||meta.nome||'', camadas:itens.length, atencoes:0, revisao:0});
  });
  /* DIVERGÊNCIA LIGADA A REGIÃO (§28) — a MEDIÇÃO de pixels mora na tela, porque precisa de
     canvas e do composto do Photoshop; a EXPLICAÇÃO é do motor. Chega como
     `meta.divergencias` = [{prancheta, itemN, pct}] e é opcional: sem ela o resultado sai
     completo do mesmo jeito (§46 — a engine não depende da tela).
     ⛔ Divergência com causa conhecida NÃO abre aviso novo. Ela vira o número DENTRO do aviso
     que já existe naquela camada — senão a mesma fonte trocada apareceria duas vezes, uma
     como decisão e outra como surpresa. Só o que nenhuma decisão explica ganha item próprio. */
  (meta.divergencias||[]).forEach(d=>{
    const mesmos=res.atencoes.filter(a=>a.prancheta===(d.prancheta||0) && a.itemN===d.itemN);
    if(mesmos.length){
      mesmos.sort((a,b)=>_DPSD_ATENCAO_ORDEM[b.nivel]-_DPSD_ATENCAO_ORDEM[a.nivel]);
      mesmos[0].divergencia=d.pct;
      return;
    }
    const cat=_dPsdCatDe('__divergencia__');
    res.atencoes.push({
      id:'at-'+(d.prancheta||0)+'-'+d.itemN+'-divergencia',
      prancheta:d.prancheta||0, pranchetaNome:d.pranchetaNome||'',
      itemN:d.itemN, camada:d.camada||'', kind:d.kind||'',
      caixa:d.caixa||null,
      nivel:'review', categoria:cat.id, acao:cat.acao,
      titulo:cat.titulo, explicacao:cat.texto(),
      visual:'aproximado', editabilidade:'preservada',
      divergencia:d.pct, semCausa:true,
      _code:'__divergencia__', _detalhe:d.pct+'% dos pixels da caixa'
    });
  });
  /* Ordena por severidade e depois pela ordem natural: o designer resolve o que importa
     primeiro, e a numeração "1 de N" segue essa prioridade. */
  res.atencoes.sort((a,b)=>(_DPSD_ATENCAO_ORDEM[b.nivel]-_DPSD_ATENCAO_ORDEM[a.nivel])
    || (a.prancheta-b.prancheta) || (a.itemN-b.itemN));
  /* As contagens por prancheta saem da lista FINAL, não do laço: os itens de divergência
     entram depois dele, e contar antes deixaria a aba sem o que ela mesma tem (§32 — as
     exceções são organizadas por prancheta, e é essa conta que a aba mostra). */
  res.pranchetas.forEach((pr,i)=>{
    const suas=res.atencoes.filter(a=>a.prancheta===i);
    pr.atencoes=suas.length;
    pr.revisao=suas.filter(a=>a.nivel==='review'||a.nivel==='blocking').length;
  });
  res.resumo.preservadas=res.resumo.camadas-res.resumo.unsupported;
  const revisar=res.atencoes.filter(a=>a.nivel==='review'||a.nivel==='blocking').length;
  res.status=res.atencoes.some(a=>a.nivel==='blocking')?'bloqueado':(revisar?'atencao':'ok');
  res.precisaRevisao=revisar;   // o número que a tela mostra: só review+blocking contam
  return res;
}
/* Resumo do livro-caixa de uma lista de itens — a bancada de diagnóstico do §29. Sem DOM: serve
   ao console da equipe, à suíte e a qualquer relatório futuro da revisão. */
function dPsdCapReport(items){
  return (items||[]).filter(it=>it&&it.capability&&it.capability.motivos.length).map(it=>({
    camada:it.name, tipo:it.kind, modo:it.mode, nivel:it.capability.nivel,
    perdeEfeitos:_dPsdCapPerdeFx(it),
    motivos:it.capability.motivos.map(m=>m.etapa+':'+m.code+(m.detalhe?('('+m.detalhe+')'):''))
  }));
}

// Ajustes que o motor Canvas canônico consegue recalcular sobre a composição abaixo. Eles
// continuam como CAMADAS (não viram pixels congelados), então editar foto/texto por baixo
// preserva o tratamento de cor do PSD. Tipos fora desta lista entram visíveis na revisão,
// mas marcados como não suportados em vez de desaparecerem silenciosamente.
const _DPSD_ADJUST_SUPPORTED=new Set([
  'brightness/contrast','levels','curves','exposure','vibrance','hue/saturation',
  'invert','posterize','threshold'
]);
function _dPsdAdjustmentInfo(adj){
  if(!adj||!adj.type)return null;
  const data=JSON.parse(JSON.stringify(adj));
  const type=String(data.type).toLowerCase();
  // Estes algoritmos são dinâmicos e editáveis, mas o Photoshop usa curvas internas que não
  // publica para Brilho moderno/Vibração e spline própria em Curvas. Marcamos a aproximação na
  // revisão; melhor uma capacidade explícita do que vender "1:1" onde a matemática não é aberta.
  let approximate=(type==='brightness/contrast'&&!data.useLegacy)||type==='vibrance'||(type==='curves'&&['rgb','red','green','blue'].some(k=>(data[k]||[]).length>2));
  // O master de Hue/Saturation é reproduzido; faixas seletivas (reds/yellows/…) ainda não.
  if(type==='hue/saturation'){
    const ranged=['reds','yellows','greens','cyans','blues','magentas'];
    approximate=ranged.some(k=>{const c=data[k]||{};return !!(+c.hue||+c.saturation||+c.lightness);});
  }
  return {data,type,supported:_DPSD_ADJUST_SUPPORTED.has(type),approximate};
}

// (_dPsdImgSig saiu em 05/09: era a assinatura de raster do dedupe por aparência, que agora
//  é por identidade de nó. Nenhum outro caminho a usava.)

/* ── PSD → itens intermediários (modo escolhível na revisão) ──
   dPsdItems/dPsdMeta/_dPsdAdjustCount vivem só em psd-import.js (estado real da revisão,
   30+ leituras/escritas lá); aqui eram declaração órfã, nunca lida — só colidia o `let`. */
// Nº de camadas que EXPLODIRAM no parse do último arquivo (viram aviso na revisão).
let _dPsdErrorCount=0;
// Uma camada com efeito malformado, path inválido ou texto corrompido NÃO pode derrubar o
// arquivo inteiro (antes: exceção → catch genérico do dImportPSD → "não foi possível
// interpretar as camadas", e o designer perdia 100% por causa de 1 camada). Aqui salvamos o
// pixel que o Photoshop já compôs e marcamos pra revisão; sem canvas, pula só ela.
function _dPsdParseFail(node, items, n, ox, oy, err, parentName, inh){
  _dPsdErrorCount++;
  console.warn('[psd] camada não parseável:', (node&&node.name)||'?', err);
  try{
    if(!node || !node.canvas || !node.canvas.width || !node.canvas.height) return;
    const url=_dPsdRasterURL(node.canvas,{maxPx:2400,q:0.92,lossless:true});
    if(!url) return;
    const it={ n, name:String(node.name||('Camada '+n)).slice(0,48),
      x:Math.round((node.left||0)-(ox||0)), y:Math.round((node.top||0)-(oy||0)),
      w:Math.max(1,Math.round((node.right||0)-(node.left||0))),
      h:Math.max(1,Math.round((node.bottom||0)-(node.top||0))),
      visible:!node.hidden, opacity:Math.round((node.opacity!=null?node.opacity:1)*100),
      include:!node.hidden, mask:null, group:parentName||'', kind:'raster', mode:'raster',
      imgUrl:url, parseError:true, _psdNode:node };
    // A camada falhou, mas o RECORTE do grupo continua valendo — sem isto ela reaparece
    // por fora da máscara do grupo, que é pior que a falha original.
    if(inh && inh.blend) it.blendMode=inh.blend;
    // A exceção é um dado de fidelidade, não só um console.warn: entra no livro-caixa com a
    // mensagem original, para o diagnóstico dizer QUAL camada falhou e por quê.
    _dPsdCapMarca(_dPsdCapDe(it),'parse_recovered',String((err&&err.message)||err||'').slice(0,80));
    items.push(it);
  }catch(e){}
}
// PSD achatado (sem camadas) ou com todas as camadas inutilizáveis: em vez de recusar o
// arquivo, importa o COMPOSTO que o Photoshop já renderizou como imagem única. O designer
// perde a edição por camada, mas recebe a arte fiel e pode trabalhar em cima dela.
// w/h opcionais: numa prancheta única, a arte precisa caber na caixa da prancheta, não do doc.
function _dPsdFlatItem(psd, w, h){
  try{
    if(!psd || !psd.canvas || !psd.canvas.width || !psd.canvas.height) return null;
    const url=_dPsdRasterURL(psd.canvas,{maxPx:2400,q:0.92,lossless:true});
    if(!url) return null;
    const flat={ n:1, name:'Arte (PSD achatado)', x:0, y:0,
      w:Math.max(1, w||psd.width||psd.canvas.width),
      h:Math.max(1, h||psd.height||psd.canvas.height),
      visible:true, opacity:100, include:true, mask:null, group:'',
      kind:'raster', mode:'raster', imgUrl:url, flattened:true, _defaultMode:'raster' };
    _dPsdCapMarca(_dPsdCapDe(flat),'flattened_document');
    return flat;
  }catch(e){ return null; }
}
// ox/oy: offset de origem (usado em artboards p/ normalizar coords pra (0,0) da prancheta).
function dPsdParseItems(psd, res, ox, oy){
  ox=ox||0; oy=oy||0;
  _dPsdAdjustCount=0; _dPsdErrorCount=0;
  // Só sobrescreve quando o objeto recebido carrega o ângulo: no fluxo multi-prancheta o psd
  // aqui é sintético ({children:[…]}) e perderíamos a luz global lida do documento real.
  const _gl=_dPsdReadGlobalLight(psd); if(_gl!=null) _dPsdGlobalLight=_gl;
  const items=[]; let n=0, gseq=0;
  // Teto de raster ADAPTATIVO à prancheta. O PNG final renderiza a 2× o tamanho da prancheta,
  // então uma imagem grande precisa de até 2×maxDim px pra não sair mole no export — o teto fixo
  // de 1600 borrava herói de PSD grande. Piso 1600 (comportamento antigo p/ prancheta pequena,
  // sem regressão), teto 3200 (protege o IndexedDB de PSD gigante). psd.width/height vem dos
  // chamadores (incluído no objeto passado ao parse); sem eles cai no piso.
  const _artMax=Math.max((psd&&psd.width)||0, (psd&&psd.height)||0);
  const _rasterCap=Math.min(3200, Math.max(1600, 2*_artMax));
  // Camadas que SÓ existem como raster (warp, smart object, padrão, camada recuperada) não têm
  // segunda chance: o piso é o 2400 de antes, mas acompanham a prancheta quando ela pede mais.
  const _fidCap=Math.max(2400, _rasterCap);
  // Grupos do PSD viram os grupos que o Luma JÁ possui (`parentId`). Além de organização, agora
  // eles carregam composição (isolamento/opacidade/máscara/blend) no motor Canvas canônico.
  (function walk(nodes, parentOp, parentHidden, parentName, inh){
    // `masks` saiu de inh em 10/09: a herança de máscara de grupo nunca foi populada (ver
    // _dPsdComputeMask) e hoje o grupo é uma camada com a própria máscara.
    inh=inh||{groups:[], blend:null, blendApprox:false};
    // try//catch por CAMADA: uma camada quebrada vira imagem fiel (ou é pulada) em vez de
    // derrubar o PSD inteiro. O corpo abaixo mantém a indentação original de propósito —
    // re-indentar 150 linhas esconderia as mudanças reais no diff.
    (nodes||[]).forEach(node=>{
      try{
      if(node.adjustment) _dPsdAdjustCount++; // camada de ajuste (dropada; afeta cor → aviso na revisão)
      const nodeOp=node.opacity!=null?node.opacity:1;
      const accOp=parentOp*nodeOp;
      const accHidden=parentHidden||(node.hidden?true:false);
      if(node.children && node.children.length){
        if(node.artboard){ walk(node.children,accOp,accHidden,'',inh); return; }
        const parentGroup=inh.groups.length?inh.groups[inh.groups.length-1]:null;
        const rawGroupBlend=String(node.blendMode||'').toLowerCase();
        const gd={id:'g-psd-'+(++gseq),type:'group',name:String(node.name||('Grupo '+gseq)).slice(0,48),visible:!accHidden,locked:false,collapsed:false,
          opacity:Math.round(nodeOp*(node.fillOpacity!=null?node.fillOpacity:1)*100),isolation:!!rawGroupBlend&&rawGroupBlend!=='pass through'&&rawGroupBlend!=='passthrough'};
        if(parentGroup)gd.parentId=parentGroup.id;
        const gb=_dPsdBlendMode(node.blendMode); if(gb)gd.blendMode=gb;
        Object.assign(gd,_dPsdEffects(node));
        const start=items.length;
        const gInh={groups:inh.groups.concat([gd]),blend:null,blendApprox:false};
        walk(node.children,1,accHidden,node.name||parentName||'',gInh);
        const kids=items.slice(start);
        if(kids.length){
          const x0=Math.min.apply(null,kids.map(k=>k.x)), y0=Math.min.apply(null,kids.map(k=>k.y));
          const x1=Math.max.apply(null,kids.map(k=>k.x+k.w)), y1=Math.max.apply(null,kids.map(k=>k.y+k.h));
          gd.x=x0;gd.y=y0;gd.w=Math.max(1,x1-x0);gd.h=Math.max(1,y1-y0);
          if(node.mask&&!node.mask.disabled&&node.mask.canvas){
            // A caixa do grupo em coordenadas de DOCUMENTO (os filhos vivem em coordenadas de
            // prancheta, daí o +ox/+oy) é destino e origem: uma máscara de grupo marcada como
            // relativa mede a partir do canto do próprio grupo.
            const _gb={x:x0+ox,y:y0+oy,w:gd.w,h:gd.h};
            const gm=_dPsdMaskToBox(node.mask,_gb,_gb);
            if(gm)gd.mask=_dPsdDownscaleMaskURL(gm,Math.max(700,Math.min(1400,Math.max(gd.w,gd.h))));
          }
        }
        return;
      }
      if(node.adjustment){
        const ai=_dPsdAdjustmentInfo(node.adjustment); if(!ai)return;
        // Camada de ajuste não possui caixa de pixels própria no PSD: ela atua sobre toda a
        // composição do contexto (prancheta ou grupo). Uma caixa integral também permite que a
        // máscara de camada seja reprojetada pelo mesmo pipeline das demais camadas.
        const aw=Math.max(1,(psd&&psd.width)||1), ah=Math.max(1,(psd&&psd.height)||1);
        const an=Object.assign({},node,{left:ox,top:oy,right:ox+aw,bottom:oy+ah});
        const ait={n:++n,name:(node.name||ai.type).toString().slice(0,48),x:0,y:0,w:aw,h:ah,
          visible:!accHidden,opacity:Math.round(accOp*100),include:true,kind:'adjustment',mode:'adjustment',
          adjustment:ai.data,adjustmentType:ai.type,adjustmentSupported:ai.supported,
          adjustmentApprox:ai.approximate,clippingLayer:node.clippingLayer||node.clipping,
          blendMode:_dPsdBlendMode(node.blendMode),group:parentName||'',_psdNode:an};
        if(inh.groups&&inh.groups.length)ait._groupChain=inh.groups.slice();
        // Ajuste também passa pelo estágio: 'adjust_unsupported'/'adjust_approx' viram motivo
        // nomeado em vez de dois booleanos que só a revisão sabia traduzir.
        _dPsdCapItem(ait);
        items.push(ait); return;
      }
      const x=Math.round((node.left||0)-ox), y=Math.round((node.top||0)-oy);
      const w=Math.max(1,Math.round((node.right||0)-(node.left||0)));
      const h=Math.max(1,Math.round((node.bottom||0)-(node.top||0)));
      const it={ n:++n, name:(node.name||('Camada '+n)).toString().slice(0,48),
        x,y,w,h, visible:!accHidden, opacity:Math.round(accOp*100),
        include:!accHidden, mask:null, // resolvido no pós-processamento 
        clippingLayer: node.clippingLayer || node.clipping,
        blendMode:_dPsdBlendMode(node.blendMode),
        group:parentName||'', _psdNode:node }; // guarda p/ recorte correto
      /* ESTÁGIO DE CAPACIDADE, parte 1 (decode) — abre o livro-caixa da camada com o que se
         decide olhando SÓ o nó cru do ag-psd. Fica aqui, no nascimento do item, para que os
         motivos de decode e os de interpretação se acumulem no mesmo registro. */
      it.capability=_dPsdCapNode(node);
      /* ETAPA 1 — DECODE: o que o ag-psd entregou, ANTES de qualquer interpretação nossa.
         É a linha que separa "o dado veio errado" de "nós lemos errado". */
      _dPsdTrace(it,'decode',{
        caixaDoc:_dPsdCx({x:node.left||0,y:node.top||0,w:(node.right||0)-(node.left||0),h:(node.bottom||0)-(node.top||0)}),
        offsetPrancheta:ox+','+oy,
        temPixel:!!(node.canvas&&node.canvas.width),
        temTexto:!!(node.text&&node.text.text!=null),
        temVetor:!!(node.vectorFill||node.vectorMask||node.vectorOrigination),
        objetoInteligente:!!(node.placedLayer||node.smartObject),
        mesclagemCrua:String(node.blendMode||'normal'),
        opacidade:Math.round((node.opacity!=null?node.opacity:1)*100),
        preenchimento:node.fillOpacity!=null?Math.round(node.fillOpacity*100):100
      });
      /* ETAPA 4 — DEPENDÊNCIAS: as relações que precisam estar resolvidas antes de a camada ser
         tratada como objeto independente. O recorte só ganha `clipBaseId` no pós-processamento,
         por isso aqui aparece a intenção (`clippingLayer`) e lá o resultado. */
      _dPsdTrace(it,'dependencias',{
        cadeiaGrupos:(it._groupChain||[]).map(g=>g.name).join(' › ')||'—',
        // A máscara do grupo NÃO é herdada pelo filho: ela vive na camada do grupo e incide
        // sobre o composto. O que interessa aqui é se a camada tem máscara PRÓPRIA e de que
        // tipo — os três mecanismos, separados (§3 do briefing).
        mascaraDeCamada:!!(node.mask&&!node.mask.disabled&&node.mask.canvas),
        mascaraDensidade:(node.mask&&node.mask.density!=null)?Math.round(node.mask.density*100)+'%':'100%',
        mascaraDifusao:(node.mask&&+node.mask.feather)||0,
        mascaraRelativa:!!(node.mask&&node.mask.relativa),
        recorteVetorial:!!(node.vectorMask&&!node.vectorMask.disable),
        mascaraPropria:!!(node.mask&&!node.mask.disabled&&node.mask.canvas),
        recorteEmCima:!!it.clippingLayer,
        mesclagemDoGrupo:inh.blend||'—'
      });
      /* Mesclagem que o Luma reconhece mas não renderiza (ex.: 'dissolve'): `_dPsdBlendMode`
         devolve undefined DE PROPÓSITO, para o selo não prometer um modo que sai Normal. Isso
         era uma perda muda; agora ela tem nome. */
      const _bmRaw=String(node.blendMode||'').toLowerCase();
      if(_bmRaw && _bmRaw!=='normal' && _bmRaw!=='passthrough' && _bmRaw!=='pass through' && !it.blendMode){
        _dPsdCapMarca(it.capability,'blend_dropped',_bmRaw);
      }
      if(inh.groups&&inh.groups.length)it._groupChain=inh.groups.slice();
      // Herança dos grupos-pai: máscaras entram na composição do pós-processamento; mesclagem
      // só se aplica quando a própria camada não define a dela (a de baixo é mais específica).
      if(!it.blendMode && inh.blend){ it.blendMode=inh.blend; if(inh.blendApprox) it.groupBlendApprox=true; }
      // fillOpacity (preenchimento) ≠ opacity: PS atenua só o fill, não os efeitos. Guardado p/
      // dobrar na opacity quando não há efeitos (dItemToLayer); com efeitos, P3 rasteriza fiel.
      if(node.fillOpacity!=null && node.fillOpacity<1) it.fillOpacity=node.fillOpacity;
      // Recorte vetorial (vectorMask) — ex.: fundo com mordida/onda. Guardado como CANVAS e
      // multiplicado com as demais máscaras no pós-processamento: antes ele era exclusivo
      // ("só quando não há máscara raster/clipping") e uma das duas era perdida.
      if(node.vectorMask && !node.vectorMask.disable){
        const vmc=_dPsdVectorMaskCanvas(node);
        if(vmc) it._vecMaskCanvas=vmc;
        else { it.vectorMaskFailed=true; console.warn('[psd] vectorMask não rasterizável, importando shape simplificado:', it.name); }
      }
      /* Aplica o veredito de decode aberto no nascimento do item: só este ponto sabe se há
         `node.canvas` utilizável e qual o teto de resolução da prancheta. */
      if(it.capability.raster && node.canvas && node.canvas.width>0 && node.canvas.height>0){
        it.kind='raster'; it.mode='raster';
        // Motivo do raster que o designer NÃO adivinha olhando a lista (um texto que virou
        // imagem parece bug). Rotação/warp/smart object já se explicam pelo próprio visual.
        if(_dPsdTextOnPath(node)) it.textOnPath=true;
        else if(_dPsdIsFlippedLayer(node)) it.flipped=true;
        it.imgUrl=_dPsdRasterURL(node.canvas,{maxPx:_fidCap,q:0.92,lossless:true}); // única fonte de fidelidade → sem perdas
        if(it.imgUrl){
          // node.canvas NÃO traz os efeitos de camada (são vetoriais no PS) → re-aplica os simples
          // (sombra/glow/contorno/overlay — 1º de cada) sobre o pixel, p/ a sombra do smart object etc.
          Object.assign(it,_dPsdEffects(node));
          /* ⚠ Este ramo dá `return` — sem passar por aqui, a camada mais comum do problema
             (objeto inteligente COM sombra) saía sem nenhum registro de capacidade, e a perda
             de efeito em imagem fiel continuava invisível. */
          _dPsdCapItem(it);
          items.push(it); return;
        }
        // sem raster utilizável → segue o fluxo normal (pode virar texto/shape ou ser dropado)
      }
      if(node.text && node.text.text!=null && String(node.text.text).trim()!==''){
        const t=node.text, sv=_dPsdSuggestVar(node.name, t.text);
        const {style:st, isMultiStyle}=_dPsdDominantStyle(t);
        it.kind='text';
        it.content=String(t.text).replace(/\r\n?/g,'\n');
        it.multiStyle=isMultiStyle;
        // Ancoragem vertical pelo TOPO (origem do texto no Photoshop): o topo da tinta encosta no
        // node.top. Substitui a centralização genérica do editor → posição vertical 1:1 com o PS.
        it.vAlign='top';
        it.fontName=(st.font&&st.font.name)||'';
        // Uma resolução, quatro respostas (exact/approximated/substituted/missing). `fontStatus`
        // é o que o estágio de capacidade e a revisão leem; `fontRemapped` fica como o booleano
        // que a tela e a suíte já consomem, agora DERIVADO em vez de decidido aqui.
        const _fr=_dPsdFontResolve(it.fontName);
        it.font=_fr.font;
        it.fontStatus=_fr.status;
        // Peso PEDIDO × peso USADO: dois conceitos, porque a diferença entre eles é uma causa
        // de divergência de LARGURA que não se conserta mexendo em posição (§10 do briefing).
        it.fontPesoPedido=_fr.pesoPedido;
        it.fontPesoUsado=_fr.pesoUsado;
        it.fontFamiliaPedida=_fr.face.familia;
        it.fontRemapped=(_fr.status==='exact'||_fr.status==='approximated');
        // fontCaps: 0=normal, 1=small-caps, 2=all-caps (PS "All Caps" character style)
        if(st.fontCaps===2) it.textTransform='uppercase';
        else if(st.fontCaps===1) it.textTransform='uppercase'; // small-caps (versaletes) ≈ maiúsculas; NUNCA lowercase (invertia a caixa)
        // fauxBold: PS "Faux Bold" — eleva o peso quando a fonte não tem variante bold
        if(st.fauxBold) it.fontWeightOverride=/black|heavy|900/i.test(it.fontName)?900:700;
        /* Itálico: faux italic do PS, ou a variante declarada no nome PostScript. A leitura do
           nome vem de `_dPsdFontFace` — o mesmo lugar que decide família e peso — em vez de um
           regex próprio aqui, que era a segunda gramática de nome de fonte no arquivo.
           ⛔ Itálico é `font-style`, não outra família: o navegador resolve pelo estilo. */
        if(st.fauxItalic || _fr.face.italico) it.italic=true;
        /* MÉTRICA ÚNICA: corpo, entrelinha, tracking, escala e deslocamento de baseline saem
           todos de `_dPsdTextMetrics`, com o nó REAL como régua de resolução. Antes eram
           quatro cálculos independentes espalhados por 15 linhas aqui, e o corpo passava a
           altura da caixa (`h`) para uma cascata que podia trocar o valor do designer. */
        const _tm=_dPsdTextMetrics(t, node, res, it.content);
        it.fontSize=_tm.corpo;
        // Corpo estimado (o arquivo não trouxe fontSize) é um dado de fidelidade, não um
        // detalhe: o número na tela deixa de ser a escolha do designer.
        if(_tm.origem!=='autorado') it.fontSizeEstimado=true;
        it.color=_dPsdHex(st.fillColor||st.color)||'#000000';
        it.strikethrough=st.strikethrough===true; // tachado (DE: R$..) — render já suportado
        it.underline=st.underline===true;          // sublinhado — render espelha o strikethrough
        const _al=_dPsdAlign(t);
        // O motor agora justifica de verdade (_fJustifySegs em png-generator). 'justify-all'
        // não tem equivalente (justificaria até a última linha) — cai no justificado normal,
        // e é o único caso que segue merecendo aviso.
        it.textAlign=_al.justified ? 'justify' : _al.align;
        if(_al.justifyAll) it.textJustifyAll=true;
        // `0` também é informação: impede o respiro automático usado pelos títulos nativos do
        // Luma. Sem gravá-lo, todo Roboto Black do PSD ganhava tracking extra e ficava mais largo.
        it.letterSpacing=_tm.tracking;
        it.lineHeight=_tm.entrelinha;
        /* ⛔ O deslocamento de baseline NÃO é gravado na camada de estilo único — de propósito.
           `node.top/bottom` é o bbox dos PIXELS, que já saiu do Photoshop com o deslocamento
           aplicado; somá-lo de novo na geometria seria aplicar a mesma transformação duas
           vezes (§5 do briefing). Onde ele importa de verdade é POR TRECHO, no texto rico —
           é assim que "R$ 29,⁹⁰" é composto — e lá ele entra como `yOffset` em
           `_dPsdRichRuns`, relativo ao bbox comum. `_tm.baselineShift` fica só no
           diagnóstico, para explicar de onde veio a altura da caixa. */
        /* ESCALA NÃO UNIFORME (§6): o painel Caractere do Photoshop condensa ou estica a letra
           num eixo só, e o modelo do Luma tem UM corpo de fonte — não há como representar
           `sx≠sy` sem uma transformação de texto que não existe. O corpo segue o eixo VERTICAL
           (é ele que define a altura da letra) e o estiramento horizontal fica registrado como
           perda conhecida, com o número. ⛔ Não se compensa mexendo em tracking: tracking
           afasta letras, escala horizontal DEFORMA o glifo — são coisas diferentes. */
        if(!_tm.escala.uniforme){
          it.textScaleX=+( _tm.escala.razao.toFixed(4) );
          it.textScaleRazao=Math.round(_tm.escala.razao*100);
        }
        const _runs=_dPsdRichRuns(t,res,h);
        if(_runs){
          it.runs=_runs;
          // Os runs PRESERVAM cada trecho com seu estilo — então o aviso "Estilos mistos"
          // (que diz "o estilo dominante será preservado", ou seja, avisa de PERDA) mente
          // aqui: não houve perda. Só continua marcado quando o rich text não resolveu.
          it.multiStyle=false;
        }
        const _tg=_dPsdGradient(node); if(_tg) it.gradient=_tg;        // preenchimento por gradiente no texto
        Object.assign(it,_dPsdEffects(node));
/* ── HISTÓRICO DESTA DECISÃO, porque ela mudou duas vezes ──────────────────────
           03/09 (Ryan): o import PAROU de adivinhar campo. O motivo era real — as cinco
           camadas de palpite do `_dPsdSuggestVar` erravam CALADO (um rodapé que cita um
           valor virava `{{precoPor}}` e o texto original ia embora), e acertar metade era
           pior que não acertar nada: obrigava a auditar a arte inteira para descobrir qual
           metade estava errada.
           HOJE (rodada 6, 10/09): volta a decidir sozinho, mas o que mudou não é a coragem
           — é o mecanismo. Os palpites paralelos morreram (existe UM resolvedor,
           `gFieldInfer` + a passada relacional `gFieldInferBatch`); alta confiança exige
           sinal específico com vantagem clara sobre a segunda leitura; o texto autorado não
           se perde mais (vira o EXEMPLO do campo, em `dLayerBindField`); e nenhuma decisão
           fica escondida — a revisão por exceção mostra as ambíguas como pergunta e a
           personalização da camada mostra o estado resultante de cada uma. Média confiança
           NÃO aplica: fica pendente e vira UMA pergunta.
           A ordem de autoridade que protege o designer: decisão dele > memória aprovada >
           convenção `{{campo}}`/`@campo` no Photoshop > regra determinística > IA. */
        if(sv && (sv.confidence==='high'||sv.explicit)){
          it.varName=sv.name; it.mode='var'; it._fieldInference=sv;
        } else if(sv && sv.confidence==='medium'){
          it.varName=sv.name; it.mode='text'; it._fieldInference=sv;
        } else { it.varName=''; it.mode='text'; }
        // Tipo de caixa. Campo real do ag-psd: text.shapeType ('box'|'point'). Só PARAGRAPH (box)
        // substitui x/y/w/h pela caixa do designer; POINT mantém o bbox de glifos 1:1 (posição real).
        it.textBox=(t.shapeType==='box')?'box':'point';
        /* ETAPA 2 — NORMALIZE: o que lemos do EngineData, antes de a geometria decidir nada.
           Separado da geometria de propósito: corpo/entrelinha/tracking errados são erro de
           LEITURA; caixa errada é erro de GEOMETRIA. Consertar um mexendo no outro é o
           conserto errado, e é o que a cadeia existe para impedir. */
        _dPsdTrace(it,'normalize',{
          // FONTE — o que o Photoshop pediu × o que vai renderizar (§42: dois conceitos)
          fontePedida:it.fontName||'—', familia:_fr.face.familia||'—',
          pesoPedido:_fr.pesoPedido==null?'não declarado':_fr.pesoPedido,
          pesoUsado:_fr.pesoUsado, italico:!!it.italic, fonteStatus:_fr.status,
          // CORPO — a fórmula, com cada fator visível
          corpoPt:_tm.corpoPt, escalaTransformY:+_tm.escala.trY.toFixed(4),
          escalaPainelY:+_tm.escala.chY.toFixed(4), fatorResolucao:+_tm.fatorResolucao.toFixed(4),
          porqueResolucao:_tm.fonteResolucao, corpoPx:_tm.corpo, origemDoCorpo:_tm.origem,
          // Os demais atributos tipográficos
          entrelinha:_tm.entrelinha, tracking:_tm.tracking,
          baselineShift:_tm.baselineShift, escalaHorizontalPct:Math.round(_tm.escala.razao*100),
          alinhamento:it.textAlign, tipoDeCaixa:t.shapeType||'—',
          linhas:String(it.content||'').split('\n').length,
          trechosDeEstilo:(Array.isArray(t.styleRuns)?t.styleRuns.length:1)
        });
        if(it.textBox==='box'){
          // Caixa 1:1 do Photoshop → NÃO reencaixa/encolhe o texto na importação.
          const _cxGlifos={x:it.x,y:it.y,w:it.w,h:it.h};
          const pb=_dPsdParagraphBox(node);
          if(pb){ it.x=Math.round(pb.x-ox); it.y=Math.round(pb.y-oy); it.w=Math.max(1,pb.w); it.h=Math.max(1,pb.h); }
          /* ETAPA 3 — GEOMETRIA: a distinção que o briefing pede entre *authoring bounds* (a
             caixa que o designer desenhou) e *visual/glyph bounds* (o contorno da tinta). São
             as duas geometrias legítimas de um texto; qual venceu, e por quê, é a informação
             que faltava para diagnosticar "texto mudou de posição". */
          _dPsdTrace(it,'geometria',{
            caixaGlifos:_dPsdCx(_cxGlifos),
            caixaAutorada:pb?_dPsdCx({x:pb.x-ox,y:pb.y-oy,w:pb.w,h:pb.h}):'não derivável',
            venceu:pb?'caixa autorada (parágrafo do Photoshop)':'contorno dos glifos (point text)',
            porque:pb?'boxBounds/bounds coerente com a âncora dos glifos'
                     :'nenhum candidato passou no score — usar a caixa velha empilharia os fragmentos'
          });
          if(!pb){
            /* Sem caixa confiável, a geometria que sobrou é o bbox justo dos glifos — semântica
               de point text. Mantê-la como `box` fazia o Auto-layout quebrar "R$" em R + $ e
               "POR" em três linhas dentro da caixa estreita. */
            it.textBox='point';it.textBoxApprox=true;
            console.warn('[psd] caixa de parágrafo não derivável — usando bbox de glifos:', it.name);
          }
        }
        if(node.canvas && node.canvas.width>0){ it.imgUrl=_dPsdRasterURL(node.canvas,{maxPx:_rasterCap}); } // p/ "imagem fiel"
      } else if(node.canvas && node.canvas.width>0 && node.canvas.height>0){
        // Camada de GRADIENTE (GdFl: tem vectorFill com colorStops) → shape com gradiente editável,
        // mesmo não sendo cor sólida (senão cairia em raster).
        const grad=(node.vectorFill && node.vectorFill.colorStops)?_dPsdGradient(node):null;
        // Cor: preferir a EXATA do vetor (vectorFill), cair na amostragem de pixels só se faltar.
        // Photoshop permite forma só-contorno: vectorFill ainda pode carregar a última cor,
        // mas `vectorStroke.fillEnabled:false` manda NÃO pintá-la. Ignorar a flag inventava um
        // retângulo sólido por cima do fundo/textura (caso dos cards laranja deste PSD real).
        const fillDisabled=!!(node.vectorStroke&&node.vectorStroke.fillEnabled===false);
        const solid=fillDisabled?null:(_dPsdVectorSolidColor(node)||_dPsdSolidColor(node.canvas));
        // Contorno vetorial (vectorStroke) — inclui formas SÓ-CONTORNO (sem preenchimento): molduras
        // vazadas, divisores e linhas TRACEJADAS. Antes, sem fill/gradiente, essas caíam no raster e o
        // tracejado virava imagem chapada (o dash lido em _dPsdShapeStroke nem era alcançado). Agora um
        // traçado real (lineWidth>0) também qualifica a camada como FORMA editável.
        const stroke=_dPsdShapeStroke(node);
        const hasStroke=stroke.strokeW>0;
        if(grad || solid || hasStroke){
          // Forma: preferir o tipo EXATO do vetor (keyOriginType), cair no heurístico de pixel.
          const vectorShape=_dPsdVectorShapeKind(node,w,h);
          const shapeInfo=vectorShape||_dPsdDetectShapeKind(node.canvas);
          // Custom shape/path: conserva âncoras e alças em vez de fingir que é um retângulo.
          // Caminho aberto só é promovido quando a layer é apenas traço.
          const vectorPath=!vectorShape?_dPsdEditableVectorPath(node,hasStroke&&!solid&&!grad):null;
          it.kind='shape';
          const vectorBox=vectorShape&&_dPsdVectorShapeBox(node,ox,oy);
          if(vectorBox)Object.assign(it,vectorBox);
          // Retângulo/elipse já são a própria primitiva vetorial do Luma. Reaplicar a mesma
          // vectorMask como bitmap cortava o meio externo do stroke (formas só-contorno sumiam).
          if((vectorShape&&fillDisabled)||vectorPath)delete it._vecMaskCanvas;
          // Só-contorno (sem fill sólido/gradiente) → fundo TRANSPARENTE, não a cor padrão laranja.
          it.fill=solid || (grad && grad.stops[0] && grad.stops[0].color) || (hasStroke ? 'transparent' : '#FF9000');
          if(grad) it.gradient=grad;
          it.shapeKind=vectorPath?'path':shapeInfo.kind;
          if(vectorPath){
            /* `compound` é um fato da LEITURA, não do modelo: viaja no item (para a revisão
               dizer que a geometria com furo foi preservada) e sai do caminho antes de ele
               ser gravado na camada — o modelo persistido do Luma não ganha chave nova. */
            if(vectorPath.compound){ it.vectorCompound=true; delete vectorPath.compound; }
            it.vectorPath=vectorPath; delete it.vectorMaskFailed;
          }
          it.radius=shapeInfo.radius;
          /* ⚠ O RAIO SE CLAMPA NA CAIXA FINAL, não na do nó. `node.left/right/top/bottom`
             inclui a expansão do TRAÇO; `_dPsdVectorShapeBox` devolve a caixa do CAMINHO, que
             é menor, e o `Object.assign(it,vectorBox)` acima já trocou x/y/w/h por ela.
             Calcular o clamp `min(w,h)/2` com a caixa do nó dava um teto maior que o real:
             numa forma baixa com traço grosso, o canto arredondado saía maior do que cabe e a
             silhueta deixava de bater com a do Photoshop. Uma linha, mas é o tipo de offset
             duplicado que o briefing manda centralizar. */
          const _bw=Math.max(1,+it.w||w), _bh=Math.max(1,+it.h||h);
          if(it.radius) it.radius=Math.min(it.radius, Math.floor(Math.min(_bw,_bh)/2));
          /* ETAPA 3 — GEOMETRIA (forma): a caixa do NÓ inclui a expansão do traço; a do
             CAMINHO é a geometria real. Qual venceu é o que explica um contorno deslocado. */
          _dPsdTrace(it,'geometria',{
            caixaDoNo:_dPsdCx({x:x,y:y,w:w,h:h}),
            caixaDoCaminho:vectorBox?_dPsdCx(vectorBox):'não exposta pelo PSD',
            venceu:vectorBox?'caixa do caminho (sem a expansão do traço)':'caixa do nó',
            forma:it.shapeKind, origem:vectorShape?'keyOriginType (exato)':(vectorPath?'path Bézier':'heurística de pixel'),
            raioClampado:it.radius||0
          });
          Object.assign(it,_dPsdEffects(node));        // sombra/glow/overlay/contorno-fx
          Object.assign(it,stroke);                    // traçado do shape (vectorStroke, incl. tracejado)
          // Cantos por-canto: mesma correção do raio uniforme — o clamp usa a caixa FINAL do
          // item (a do caminho, quando existe), não a do nó inflada pelo traço.
          const _rr=_dPsdCornerRadii(node,_bw,_bh); if(_rr) it.radii=_rr;
          // Linha/divisor fino SÓ-CONTORNO: um retângulo de altura ~traço viraria uma MOLDURA de 4
          // lados no lugar de um traço único. Converte em barra sólida fina (= a linha do PSD).
          if(hasStroke && !solid && !grad && Math.min(w,h) <= Math.max(stroke.strokeW*1.5, 4)){
            it.fill=stroke.strokeColor||'#000000'; it.shapeKind='rect';
            it.strokeW=0; delete it.strokeDash; delete it.strokeCap; delete it.strokeJoin; delete it.strokeAlign; delete it.radii;
          }

          // Heurística de auto-frame para shapes (se o nome da camada contiver imagem/foto)
          const _area=(Math.max(1,w*h)/Math.max(1,(psd.width||1)*(psd.height||1)));
          const imgSug = _dPsdSuggestImgVar(it.name,{areaRatio:_area,isBackground:_area>=0.7||/^(background|fundo|bg|base)$/i.test(String(it.name||'').trim())});
          if (imgSug&&imgSug.confidence==='high') {
            it.mode = imgSug.mode;
            it.varName = imgSug.name;
            it._fieldInference=imgSug;
          } else if(imgSug&&imgSug.confidence==='medium'){
            it.mode='shape'; it.varName=imgSug.name; it._fieldInference=imgSug;
          } else {
            it.mode = 'shape';
          }
        }
        else {
          it.kind='raster';
          it.imgUrl=_dPsdRasterURL(node.canvas,{maxPx:_rasterCap});
          if(!it.imgUrl) return;
          // Zona segura da foto: o assunto recortado, medido enquanto os pixels ainda estão
          // na memória. Depois do import só existe a URL, e recalcular sairia caro.
          it.inkBox=_dPsdInkBox(node.canvas);
          
          // Heurística de auto-frame para imagens raster
          const _area=(Math.max(1,w*h)/Math.max(1,(psd.width||1)*(psd.height||1)));
          const imgSug = _dPsdSuggestImgVar(it.name,{areaRatio:_area,isBackground:_area>=0.7||/^(background|fundo|bg|base)$/i.test(String(it.name||'').trim())});
          if (imgSug&&imgSug.confidence==='high') {
            it.mode = imgSug.mode;
            it.varName = imgSug.name;
            it._fieldInference=imgSug;
          } else if(imgSug&&imgSug.confidence==='medium'){
            it.mode='raster'; it.varName=imgSug.name; it._fieldInference=imgSug;
          } else {
            it.mode = 'raster';
          }
        }
      } else { return; }
      // Fidelidade: combinações que o modelo EDITÁVEL não representa → rasteriza fiel (há pixels no
      // node.canvas). Mesma filosofia de warp/rotação/smart-object. Sem isto, esses efeitos sumiam
      // silenciosamente (o dado era gravado mas nenhum renderizador o consumia).
      // Gradiente cônico/losango: o motor não tem a primitiva, MAS aqui é preenchimento — o
      // pixel que o PS compôs está no node.canvas, então rasterizar sai 1:1 (bem melhor que
      // fingir que é uma faixa linear, que era o comportamento antigo e mudo).
      if(it.gradient && it.gradient.psStyle){ it.gradientUnsupported=it.gradient.psStyle; delete it.gradient.psStyle; }
      if(it.layerEffects && it.opacity<100) it.layerEffectsApprox=true;     // opacity da camada × pilha exige isolamento completo
      /* ESTÁGIO DE CAPACIDADE, parte 2: as sete condições que exigiam raster fiel — e as
         quinze perdas conhecidas que não pedem raster — saíram deste ponto e passaram a viver
         em `_dPsdCapItem`. Aqui fica só a APLICAÇÃO: pegar o pixel, que é o que depende do
         `node.canvas` e do teto da prancheta. */
      const _cap=_dPsdCapItem(it);
      const _pn=it._psdNode;
      if(_cap.raster){
        if(_pn && _pn.canvas && _pn.canvas.width>0){
          it.needsRaster=true;
          if(!it.imgUrl) it.imgUrl=_dPsdRasterURL(_pn.canvas,{maxPx:_fidCap,q:0.92,lossless:true});
        } else {
          /* Pediu raster fiel e NÃO existe pixel para preservar: nem editável, nem imagem.
             É o único caso realmente `unsupported`, e o único BLOQUEANTE — a distinção do §39
             do briefing: "native falhou mas o raster salvou" é aceitável; "native falhou e não
             há nada confiável" é atenção alta. Antes ele se confundia com `native`, porque o
             bloco inteiro vivia dentro do `if(canvas)` e nada era registrado. */
          _dPsdCapMarca(_cap,'sem_representacao',
            _cap.motivos.map(m=>m.code).filter(c=>c!=='sem_representacao').join(', '));
        }
      }
      items.push(it);
      }catch(err){ _dPsdParseFail(node, items, ++n, ox, oy, err, parentName, inh); }
    });
  })(psd.children, 1, false, '', null);
  // Dedupe defensivo (NÃO altera grupos): 1 layer no Photoshop deve virar 1 item.
  // A chave é a IDENTIDADE do nó do PSD, nunca a aparência. Duas camadas INTENCIONAIS podem ser
  // iguais em tipo, nome, caixa e conteúdo e diferir só em opacity/blend/grupo — a assinatura por
  // atributos apagava a segunda em silêncio (estudo de fidelidade 05/09 §5.7: dois textos iguais,
  // um a 100% e outro a 50%, voltavam como UM item). Só é duplicata quando o MESMO nó foi
  // percorrido duas vezes; aí é bug de parsing, não decisão do designer.
  // Assimetria que manda aqui: camada perdida é invisível e irreversível; camada sobrando o
  // designer vê na revisão e desmarca.
  const _seen=new Set(); const out=[];
  items.forEach(it=>{
    const node=it._psdNode;
    if(node && _seen.has(node)){ console.warn('[psd] nó do PSD percorrido duas vezes, item duplicado descartado:', it.name); return; }
    if(node) _seen.add(node);
    out.push(it);
  });
  // Aviso (NÃO remove): textos com mesmo nome+conteúdo em caixas diferentes — pode ser sombra/contorno
  // manual do designer (2 layers reais) ou duplicação inesperada. Mantém ambas para decisão na revisão.
  const _soft={};
  out.forEach(it=>{ if(it.kind==='text'&&it.content){ const k=it.name+'|'+it.content; _soft[k]=(_soft[k]||0)+1; } });
  Object.keys(_soft).forEach(k=>{ if(_soft[k]>1) console.warn('[psd] possível layer de texto duplicada mantida (nome+conteúdo iguais, caixas diferentes):', k.split('|')[0]); });

  /* ══ GRAFO DE DEPENDÊNCIA — as cadeias de recorte, resolvidas UMA VEZ ═════════════════════
     No Photoshop um recorte é uma CADEIA, não uma propriedade de camada:

         FORMA BASE          ← quem define o alpha
         ↑ FOTO   recortada
         ↑ TEXTURA recortada
         ↑ LUZ     recortada  ← todas recortam pela MESMA base

     Antes, cada camada recortada redescobria a própria base andando para trás no array. Duas
     consequências: a relação nunca existia como dado (o conversor tinha de reinferi-la) e o
     limite da busca era o **nome** do grupo (`out[j].group`, que é `parentName`) — então dois
     grupos de nome igual, que é o caso comum num PSD real ("Grupo 1", "Camada 5 cópia"),
     deixavam a busca atravessar a fronteira e uma camada podia recortar por uma base de OUTRO
     grupo. Aqui a fronteira passa a ser a IDENTIDADE do grupo (`_groupChain`, que carrega ids
     únicos), e a cadeia inteira é montada de uma vez.
     ⚠ ag-psd entrega os filhos BASE-PRIMEIRO: a base vem antes e as recortadas logo depois. */
  const _grupoId=(it)=>{
    const c=it&&it._groupChain;
    return (c&&c.length)?c[c.length-1].id:'';
  };
  const _clipGroups=[];       // [{baseIdx, clipped:[idx…]}]
  const _clipBaseDe=new Map(); // idx da recortada → idx da base
  for(let i=0;i<out.length;i++){
    if(!out[i].clippingLayer) continue;
    if(_clipBaseDe.has(i)) continue;          // já pertence a uma cadeia montada
    // Anda para trás sobre as recortadas do MESMO grupo até achar quem não é recortada.
    const gid=_grupoId(out[i]);
    let j=i-1;
    while(j>=0 && out[j].clippingLayer && _grupoId(out[j])===gid) j--;
    if(j<0 || _grupoId(out[j])!==gid) continue; // cadeia sem base no grupo → nada a recortar
    // A cadeia é a corrida CONTÍNUA de recortadas logo acima da base.
    const cadeia={baseIdx:j, clipped:[]};
    for(let k=j+1;k<out.length && out[k].clippingLayer && _grupoId(out[k])===gid;k++){
      cadeia.clipped.push(k); _clipBaseDe.set(k,j);
    }
    if(cadeia.clipped.length) _clipGroups.push(cadeia);
  }
  /* A relação passa a viajar no ITEM, para a revisão e o diagnóstico não precisarem
     redescobri-la — e para o §1 do briefing valer: ninguém converte antes de saber quem
     depende de quem. `clipRole` é o vocabulário: 'base' ou 'clipped'. */
  _clipGroups.forEach(g=>{
    out[g.baseIdx].clipRole='base';
    out[g.baseIdx].clipChainSize=g.clipped.length;
    g.clipped.forEach((k,ordem)=>{
      out[k].clipRole='clipped';
      out[k].clipChainIndex=ordem;
      out[k].clipChainSize=g.clipped.length;
      out[k].clipBaseName=out[g.baseIdx].name;
    });
  });
  const _clipBaseIndex=(idx)=>_clipBaseDe.has(idx)?_clipBaseDe.get(idx):-1;

  // Resolve TODAS as máscaras de uma vez (camada + clipping + vetorial + grupos-pai), com a
  // base de clipping correta. _dPsdComputeMask multiplica os alphas, então elas se somam em
  // vez de uma sobrescrever a outra. Atribuição condicional: null não apaga o que já existe.
  for(let i=0; i<out.length; i++){
    const _extra={ vecCanvas: out[i]._vecMaskCanvas };
    let _m=null;
    if(out[i].clippingLayer){
      const baseIdx=_clipBaseIndex(i);
      if(baseIdx>=0){
        const base=out[baseIdx];
        // `mask` fica como snapshot de compatibilidade para o DOM do editor; o Canvas final usa
        // clipBaseId e redesenha o alpha da base a cada render. Máscaras próprias ficam separadas.
        out[i].clipBaseId=_dPsdItemId(base);
        out[i].clipBaseSnapshot={x:base.x,y:base.y,w:base.w,h:base.h,shapeKind:base.shapeKind||'rect',radius:base.radius||0,radii:base.radii||null,points:base.points||null,sides:base.sides||null,inner:base.inner||null,vectorPath:base.vectorPath||null,maskSize:base.mask?base.mask.length:0};
        out[i].clipOwnMask=_dPsdComputeMask(out[i]._psdNode, null, _extra);
        _m = _dPsdComputeMask(out[i]._psdNode, base._psdNode, _extra);
      }
    } else {
      _m = _dPsdComputeMask(out[i]._psdNode, null, _extra);
    }
    if(_m) out[i].mask = _m;
    delete out[i]._vecMaskCanvas;
    // _psdNode NÃO é apagado aqui: o laço de clipping abaixo ainda precisa do canvas da
    // camada-base. Apagar antes matava esse caminho (base raster caía sempre em maskFallback).
  }

  // Fallback do clipping: reconstrói o alpha da base quando a composição acima não conseguiu.
  // A base continua visível — no Photoshop ela participa da pilha, não é uma máscara descartável.
  for(let i=0; i<out.length; i++) {
    if(out[i].clippingLayer) {
      const baseIdx=_clipBaseIndex(i);
      if(baseIdx>=0) {
        const base = out[baseIdx];
        const b = out[i];
        if(!b.mask) { // Se o Luma não gerou máscara via layerMaskCanvas
          const c = document.createElement('canvas');
          c.width = Math.max(1, b.w); c.height = Math.max(1, b.h);
          const ctx = c.getContext('2d');
          ctx.fillStyle = base.fill || '#000000';
          const ox = base.x - b.x, oy = base.y - b.y;
          let success = false;
          if (base.kind === 'shape' && (base.shapeKind === 'ellipse' || base.shapeKind === 'circle')) {
            ctx.beginPath();
            ctx.ellipse(ox + base.w/2, oy + base.h/2, base.w/2, base.h/2, 0, 0, 2*Math.PI);
            ctx.fill();
            success = true;
          } else if (base.kind === 'shape') {
            // Honra cantos arredondados (radius uniforme ou radii por-canto) — antes o fillRect reto
            // recortava com quebra de canto sobre uma base arredondada.
            const _rr=base.radii||{}, tl=+_rr.tl||base.radius||0, tr=+_rr.tr||base.radius||0, br=+_rr.br||base.radius||0, bl=+_rr.bl||base.radius||0;
            if(tl||tr||br||bl){
              ctx.beginPath();
              ctx.moveTo(ox+tl,oy);
              ctx.lineTo(ox+base.w-tr,oy); ctx.arcTo(ox+base.w,oy,ox+base.w,oy+tr,tr);
              ctx.lineTo(ox+base.w,oy+base.h-br); ctx.arcTo(ox+base.w,oy+base.h,ox+base.w-br,oy+base.h,br);
              ctx.lineTo(ox+bl,oy+base.h); ctx.arcTo(ox,oy+base.h,ox,oy+base.h-bl,bl);
              ctx.lineTo(ox,oy+tl); ctx.arcTo(ox,oy,ox+tl,oy,tl);
              ctx.closePath(); ctx.fill();
            } else { ctx.fillRect(ox, oy, base.w, base.h); }
            success = true;
          } else if (base._psdNode && base._psdNode.canvas && base._psdNode.canvas.width>0) {
            // Base RASTER (foto/forma complexa): usa o ALPHA dos pixels da base como recorte, em vez
            // de desistir (antes o clipping era totalmente ignorado e a camada importava cheia).
            ctx.drawImage(base._psdNode.canvas, ox, oy, base.w, base.h);
            success = true;
          }
          if(success) {
            try { b.mask = c.toDataURL('image/png'); }
            catch(e) { b.maskFallback = true; }
          } else {
            b.maskFallback = true;
          }
          // O recorte se resolve DEPOIS do estágio de capacidade (precisa da lista inteira p/
          // achar a base), então este motivo é marcado aqui, no ponto que realmente decide.
          if(b.maskFallback) _dPsdCapMarca(_dPsdCapDe(b),'clip_base_fallback',base.name||'');
        }
      }
    }
  }

  /* ETAPA 5/6 — CAPACIDADE e DEPENDÊNCIA RESOLVIDA: fecha a cadeia com o veredito e com o
     resultado real do recorte (que só existe depois do pós-processamento acima). */
  if(_dPsdTraceOn) out.forEach(it=>{
    _dPsdTrace(it,'dependencias-resolvidas',{
      mascaraComposta:!!it.mask, baseDeRecorte:it.clipBaseId||'—',
      recorteSimplificado:!!it.maskFallback
    });
    _dPsdTrace(it,'capacidade',{
      nivel:(it.capability&&it.capability.nivel)||'native',
      motivos:((it.capability&&it.capability.motivos)||[]).map(m=>m.etapa+':'+m.code).join(' · ')||'—',
      rasterFiel:!!it.needsRaster
    });
  });
  // Nó cru do ag-psd cumpriu o papel (máscaras + recorte); solta a referência antes de devolver.
  out.forEach(it=>{ delete it._psdNode; });

  // Photoshop = Top-Down; Luma = Bottom-Up
  out.reverse();

  // Modo PADRÃO do parser (antes da memória/usuário) — referência p/ _dPsdMemSave
  // distinguir decisão real de default e só persistir o que o usuário mudou.
  out.forEach(it=>{ it._defaultMode=it.mode; });

  return out;
}

// Copia efeitos do item intermediário → layer (sombra/inner/glow/overlay/contorno+align).
// Só grava o que existe, p/ não inflar o layer nem mudar camadas sem efeito.
function _dPsdApplyFx(L, it){
  if(it.layerEffects){L.layerEffects=JSON.parse(JSON.stringify(it.layerEffects));L.layerEffectsComplete=it.layerEffectsComplete!==false;if(it.layerEffectsApprox)L.layerEffectsApprox=true;}
  if(it.shadow){ L.shadow=true; L.shadowColor=it.shadowColor;
    if(it.shadowBlur!=null) L.shadowBlur=it.shadowBlur; if(it.shadowDist!=null) L.shadowDist=it.shadowDist; if(it.shadowAngle!=null) L.shadowAngle=it.shadowAngle;
    if(it.shadowSpread) L.shadowSpread=it.shadowSpread; }
  if(it.innerShadow){ L.innerShadow=true; L.innerShadowColor=it.innerShadowColor;
    if(it.innerShadowBlur!=null) L.innerShadowBlur=it.innerShadowBlur; if(it.innerShadowDist!=null) L.innerShadowDist=it.innerShadowDist; if(it.innerShadowAngle!=null) L.innerShadowAngle=it.innerShadowAngle;
    if(it.innerShadowSpread) L.innerShadowSpread=it.innerShadowSpread; }
  if(it.glow){ L.glow=true; L.glowColor=it.glowColor; if(it.glowSize!=null) L.glowSize=it.glowSize;
    if(it.glowSpread) L.glowSpread=it.glowSpread; }
  if(it.overlay){ L.overlay=true; L.overlayColor=it.overlayColor; if(it.overlayOpacity!=null) L.overlayOpacity=it.overlayOpacity; }
  if(it.innerGlow){ L.innerGlow=true; L.innerGlowColor=it.innerGlowColor; if(it.innerGlowSize!=null) L.innerGlowSize=it.innerGlowSize; }
  if(it.bevel){ L.bevel=true; L.bevelSize=it.bevelSize; L.bevelHighlight=it.bevelHighlight; L.bevelShadow=it.bevelShadow; if(it.bevelAngle!=null) L.bevelAngle=it.bevelAngle; }
  if(it.gradientOverlay){ L.gradientOverlay=it.gradientOverlay; }
  if(it.strokeW){ L.strokeW=it.strokeW; L.strokeColor=it.strokeColor||'#000000'; if(it.strokeAlign) L.strokeAlign=it.strokeAlign;
    if(it.strokeDash) L.strokeDash=it.strokeDash; if(it.strokeCap) L.strokeCap=it.strokeCap; if(it.strokeJoin) L.strokeJoin=it.strokeJoin; }
  return L;
}
function dItemToLayer(it){
  /* ETAPA 7 — CONVERSÃO: o último elo da cadeia. Registrado no ENTRA (não no sai) porque
     `dItemToLayer` tem seis ramos de retorno; o par modo+veredito determina qual deles roda,
     e é isso que responde "por que esta camada virou imagem em vez de texto". */
  _dPsdTrace(it,'conversao',{
    caixaFinal:_dPsdCx(it), tipoLido:it.kind, modoEscolhido:it.mode,
    rasterFiel:!!it.needsRaster, campo:it.varName||'—',
    perdeEfeito:_dPsdCapPerdeFx(it)
  });
  const base={ id:_dPsdItemId(it), name:it.name, x:it.x,y:it.y,w:it.w,h:it.h, visible:it.visible, opacity:it.opacity };
  if(it._groupChain&&it._groupChain.length)base.parentId=it._groupChain[it._groupChain.length-1].id;
  /* fillOpacity SEM efeitos ≡ opacity: dobrar os dois num canal é equivalência exata, e é a
     única coisa que a conversão decide aqui.
     ⛔ O caso COM efeitos (não representável) NÃO se decide mais neste ponto: era a mesma regra
     do antigo bloco `_fxUnsup`, escrita duas vezes, e mutava `it.needsRaster` DURANTE a
     conversão — o que fazia a prévia da revisão (que chama `dItemToLayer`) alterar o estado
     que o import leria depois. Agora quem decide é `_dPsdCapItem` (motivo
     `fill_opacity_with_fx`), no estágio de capacidade, uma vez por camada. */
  if(it.fillOpacity!=null && it.fillOpacity<1 && !_dPsdCapTem(it,'fill_opacity_with_fx')){
    base.opacity=Math.round((it.opacity!=null?it.opacity:100)*it.fillOpacity);
  }
  if(it.mask) base.mask=it.mask;
  // Zona segura (assunto opaco da foto) — vale para moldura, imagem fiel e raster comum, então
  // mora na base em vez de repetida em cada ramo de retorno.
  if(it.inkBox) base.inkBox=it.inkBox;
  if(it.clipBaseId){ base.clipBaseId=it.clipBaseId; if(it.clipBaseSnapshot)base.clipBaseSnapshot=it.clipBaseSnapshot; if(it.clipOwnMask)base.clipOwnMask=it.clipOwnMask; }
  if(it.blendMode) base.blendMode=it.blendMode;
  if(it.kind==='adjustment'){
    return Object.assign(base,{type:'adjustment',adjustment:JSON.parse(JSON.stringify(it.adjustment||{})),adjustmentSupported:it.adjustmentSupported!==false,adjustmentApprox:!!it.adjustmentApprox});
  }
  // Modo MOLDURA DE FOTO (escolhido na revisão): a camada — forma ou imagem — vira um frame que o
  // franqueado preenche com foto. Preserva x/y/w/h; formato do frame herdado da forma original.
  if(it.mode==='frame'){
    // imgUrl da própria camada como conteúdo PADRÃO da moldura: o renderizador do franqueado e o
    // do editor caem em l.imgUrl quando não há foto no campo (png-generator.js:708, canvas.js:1212),
    // então a arte do PSD continua aparecendo e a foto do franqueado só a SUBSTITUI. Antes a
    // moldura nascia vazia e virar moldura APAGAVA a imagem importada — perda silenciosa.
    const F=Object.assign(base,{type:'frame', imgUrl:it.imgUrl||'', imgVar:it.varName||'foto_produto', objectFit:'cover', shapeKind:it.shapeKind||'rect'});
    if(it.radius) F.radius=it.radius;
    if(it.radii) F.radii=it.radii;
    if(it.points) F.points=it.points;
    if(it.sides) F.sides=it.sides;
    if(it.inner) F.inner=it.inner;
    if(it.vectorPath) F.vectorPath=JSON.parse(JSON.stringify(it.vectorPath));
    return _dPsdApplyFx(F, it);
  }
  if(it.needsRaster && it.imgUrl){
    return _dPsdApplyFx(Object.assign(base,{type:'image',imgUrl:it.imgUrl,imgVar:'',objectFit:'cover',frameShape:'rect'}), it);
  }
  if(it.kind==='text'){
    if(it.mode==='raster' && it.imgUrl) return _dPsdApplyFx(Object.assign(base,{type:'image',imgUrl:it.imgUrl,imgVar:'',objectFit:'cover',frameShape:'rect'}), it);
    const isVar=it.mode==='var';
    const L=Object.assign(base,{ type:'text',
      content: isVar ? '{{'+(it.varName||'variavel')+'}}' : it.content,
      font:it.font, fontSize:it.fontSize, color:it.color, textAlign:it.textAlign, isVar:isVar });
    _dPsdApplyFx(L, it);
    if(it.strikethrough){ L.strikethrough=true; }
    if(it.underline){ L.underline=true; }
    if(it.textTransform) L.textTransform=it.textTransform;
    if(it.fontWeightOverride) L.fontWeightOverride=it.fontWeightOverride;
    if(it.textBox==='box'){ L.textBox='box'; } // paragraph → editor encaixa na caixa
    if(it.vAlign) L.vAlign=it.vAlign;           // ancoragem vertical (top) importada do PSD
    if(it.italic) L.italic=true;                // font-style itálico
    if(it.letterSpacing!=null) L.letterSpacing=it.letterSpacing;
    if(it.lineHeight) L.lineHeight=it.lineHeight;
    if(it.runs && !isVar) L.runs=it.runs;       // texto multi-estilo (não p/ variável)
    if(it.gradient) L.gradient=it.gradient;     // preenchimento por gradiente no texto
    /* BASELINE AUTORADO — a referência determinística do desenho original: o texto que o
       designer compôs, a geometria, as métricas e uma sonda da fonte. Não aparece para o
       franqueado e não substitui conteúdo/variável; serve para medir crescimento REAL e para
       o Auto-layout decidir igual em qualquer aparelho (ver `core/auto-layout.js`).
       ⚠ Carimbado DEPOIS de todas as propriedades: medir antes de `textBox`/`lineHeight`/
       `letterSpacing` produziria uma referência que não é a arte que foi importada. */
    if(isVar&&it.content){
      if(typeof gStampLayoutBaseline==='function') gStampLayoutBaseline(L, it.content);
      else L.layoutRefText=it.content;
    }
    return L;
  }
  if(it.kind==='shape' && it.mode==='shape'){
    const S=Object.assign(base,{type:'shape',fill:it.fill||'#FF9000',radius:it.radius||0,shapeKind:it.shapeKind||'rect'});
    if(it.vectorPath) S.vectorPath=JSON.parse(JSON.stringify(it.vectorPath)); // Bézier editável/responsivo
    if(it.radii) S.radii=it.radii;                                  // cantos por canto
    if(it.gradient) S.gradient=it.gradient;                         // gradiente
    _dPsdApplyFx(S, it);                                            // traçado(+align)/sombra/glow/overlay
    return S;
  }
  return _dPsdApplyFx(Object.assign(base,{type:'image',imgUrl:it.imgUrl,imgVar:'',objectFit:'cover',frameShape:'rect'}), it);
}

// Converte folhas + árvore estrutural numa lista plana compatível com `dLayers`. O marcador do
// grupo entra logo após seu último descendente (mesma convenção de dGroupSelected), preservando
// z-order e permitindo grupos aninhados sem expô-los como falsas "imagens" na revisão do PSD.
function dPsdItemsToLayers(items, previewOriginalText, canvas){
  const src=items||[], leaves=[], groups=new Map();
  src.forEach((it,idx)=>{
    const use=(previewOriginalText&&it.kind==='text'&&it.mode==='var')?Object.assign({},it,{mode:'text'}):it;
    const layer=dItemToLayer(use); if(!layer)return;
    leaves.push({layer,item:it,idx});
    (it._groupChain||[]).forEach((g,depth)=>{
      let rec=groups.get(g.id);
      if(!rec){rec={g,depth,last:-1};groups.set(g.id,rec);}
      rec.last=leaves.length-1;
    });
  });
  const ends={}; groups.forEach(rec=>{(ends[rec.last]||(ends[rec.last]=[])).push(rec);});
  const out=[];
  leaves.forEach((rec,i)=>{
    out.push(rec.layer);
    const close=ends[i]; if(!close)return;
    close.sort((a,b)=>b.depth-a.depth).forEach(({g})=>out.push(JSON.parse(JSON.stringify(g))));
  });
  /* COMPILADOR SEMÂNTICO — a importação é o melhor momento para classificar: os nomes de camada
     do PSD ainda estão inteiros (é assim que o designer batiza por função) e a arte inteira está
     na mão. Compilado uma vez, viaja no template. Invisível: nenhum passo a mais na revisão. */
  if(typeof gCompileLayoutRoles==='function') gCompileLayoutRoles(out, canvas||null);
  return out;
}
