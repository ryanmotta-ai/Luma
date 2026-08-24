/**
 * js/video/legenda.js
 *
 * LEGENDA do vídeo — cartões de texto sobre o frame, com a cara da DM.
 *
 * REUSO, e por que ESTAS duas peças: o plano (docs/LUMA-VIDEO.md §4.2) previa
 * passar cada cartão por `fRenderTemplateLayers`. Lendo o motor, o caminho certo
 * é mais fundo e mais barato: `gFitTextLayer` (o encaixador — quebra inteligente
 * e encolhimento, o MESMO que decide o texto da arte estática) + `fRenderOneLayer`
 * (desenha UMA camada num ctx). Assim a legenda herda tipografia, quebra e
 * contorno do motor único, sem inventar material/campanha falsos e sem tocar em
 * png-generator.js, que é caminho crítico do franqueado.
 *
 * O CARTÃO VIVE EM TEMPO DA FONTE, não da linha do tempo. É o que faz a legenda
 * continuar certa depois de cortar, remover e reordenar trechos: o compositor
 * pergunta "que cartão vale no segundo X do arquivo?", e o corte não mexe nisso.
 *
 * COR FIXA de propósito: branco com contorno quase-preto, sem ler token de tema.
 * O vídeo exportado não pode mudar de aparência porque quem editou estava no tema
 * claro ou escuro — o arquivo sai igual para todo mundo.
 *
 * Depende de: 00-config.js (gFitTextLayer), franqueado/png-generator.js
 *   (fRenderOneLayer), video/projeto.js, core/ai.js (gAskAI) para a transcrição.
 */

/* Templates de legenda. Tudo em FRAÇÃO da saída, para o mesmo template servir
   9:16, 1:1 e 16:9 sem uma segunda definição. */
const VD_LEGENDA_TEMPLATES = {
  dm_cap_01: {
    rotulo: 'DM Legenda',
    fonte: 'Roboto Black',      // dTextFontParts resolve peso 900; sem ele, cai em Roboto
    tamanho: 0.048,             // fração da ALTURA da saída
    cor: '#FFFFFF',
    contorno: 0.08,             // fração do tamanho da fonte (11% fechava o vão entre letras)
    contornoCor: '#0A0A0A',
    baseSegura: 0.16,           // fração da altura reservada embaixo (a UI do Reels cobre)
    margem: 0.08,               // fração da largura em cada lado
    maxLinhas: 2,
    maxCaracteres: 38,
    maiuscula: true
  }
};

const VD_CARD_DUR_MAX = 3.5;    // cartão pendurado na tela mais que isso é peso morto
const VD_CARD_DUR_MIN = 0.6;

let _vdFitCache = new Map();    // texto|larg|tam → _fit do encaixador (objeto pequeno)
let _vdCtxAux = null;           // canvas de medição (o encaixador precisa de um ctx)

/* ── TRANSCRIÇÃO → CARTÕES (funções puras) ───────────────────────────── */

/**
 * Quebra um trecho falado em pedaços que caibam num cartão.
 * Prefere cortar depois de pontuação: cartão que termina no meio da oração
 * obriga a pessoa a ler duas telas para entender uma frase.
 * FUNÇÃO PURA.
 */
function vdQuebrarFala(texto, maxCh){
  const limpo = String(texto || '').replace(/\s+/g, ' ').trim();
  if(!limpo) return [];
  if(limpo.length <= maxCh) return [limpo];
  const palavras = limpo.split(' ');
  const pedacos = [];
  let atual = '';
  for(const p of palavras){
    const cand = atual ? atual + ' ' + p : p;
    if(cand.length > maxCh && atual){ pedacos.push(atual); atual = p; }
    else atual = cand;
    // Pontuação forte fecha o cartão se já há texto suficiente para valer a pena.
    if(/[.!?;:]$/.test(atual) && atual.length >= maxCh * 0.5){ pedacos.push(atual); atual = ''; }
  }
  if(atual) pedacos.push(atual);
  return pedacos;
}

/**
 * Transcrição (trechos com tempo, em segundos da FONTE) → cartões de legenda.
 * FUNÇÃO PURA.
 * @param {Array<{de:number,ate:number,texto:string}>} trechos
 */
function vdCardsDeTranscricao(trechos, opts){
  opts = opts || {};
  const maxCh = opts.maxCaracteres || VD_LEGENDA_TEMPLATES.dm_cap_01.maxCaracteres;
  const maxDur = opts.maxDur || VD_CARD_DUR_MAX;
  const cards = [];
  for(const t of (trechos || [])){
    const de = Number(t && t.de), ate = Number(t && t.ate);
    const pedacos = vdQuebrarFala(t && t.texto, maxCh);
    if(!pedacos.length || !isFinite(de) || !isFinite(ate) || ate <= de) continue;
    // Tempo dividido por número de caracteres: pedaço maior fica mais tempo na
    // tela. Dividir igualmente faria o cartão curto demorar e o longo sumir.
    const totalCh = pedacos.reduce((s, p) => s + p.length, 0) || 1;
    let cursor = de;
    for(const p of pedacos){
      const fatia = (ate - de) * (p.length / totalCh);
      const fim = Math.min(cursor + Math.max(fatia, VD_CARD_DUR_MIN), ate);
      cards.push({ de: cursor, ate: Math.min(fim, cursor + maxDur), texto: p });
      cursor = fim;
      if(cursor >= ate) break;
    }
  }
  return cards;
}

/** Qual cartão vale neste segundo do ARQUIVO (não da linha do tempo). */
function vdCardEm(tFonte){
  const l = vdProj && vdProj.legendas;
  if(!l || !l.ativo || !l.cards || !l.cards.length) return null;
  for(let i = 0; i < l.cards.length; i++){
    const c = l.cards[i];
    if(tFonte >= c.de && tFonte < c.ate) return c;
  }
  return null;
}

/* ── DESENHO ─────────────────────────────────────────────────────────── */

/**
 * A camada de texto do cartão, no idioma do motor de render. Geometria em pixels
 * da saída; o encaixador cuida da quebra e do encolhimento.
 * FUNÇÃO PURA (não desenha nada).
 */
function vdLegendaCamada(texto, W, H, tplId){
  const t = VD_LEGENDA_TEMPLATES[tplId] || VD_LEGENDA_TEMPLATES.dm_cap_01;
  const fontSize = Math.round(H * t.tamanho);
  const larg = Math.round(W * (1 - t.margem * 2));
  // Altura da caixa: duas linhas com folga. O encaixador encolhe se não couber.
  const alt = Math.round(fontSize * t.maxLinhas * 1.25);
  return {
    id: 'vd-cap', name: 'legenda', type: 'text',
    x: Math.round(W * t.margem),
    y: Math.round(H * (1 - t.baseSegura) - alt),
    w: larg, h: alt,
    content: t.maiuscula ? String(texto || '').toUpperCase() : String(texto || ''),
    font: t.fonte, fontSize: fontSize, lineHeight: 1.15,
    textBox: 'box', textAlign: 'center', vAlign: 'bottom',
    color: t.cor,
    strokeW: Math.max(2, Math.round(fontSize * t.contorno)), strokeColor: t.contornoCor,
    shadow: true, shadowColor: 'rgba(0,0,0,.55)', shadowBlur: Math.round(fontSize * 0.18),
    shadowDist: Math.round(fontSize * 0.06), shadowAngle: 90,
    visible: true, opacity: 100
  };
}

/**
 * Desenha o cartão no ctx. O `_fit` (medição) é CACHEADO e o desenho acontece a
 * cada frame — a medição é o caro (busca binária com measureText), o desenho é
 * strokeText/fillText. Guardar bitmap por cartão custaria ~1MB cada e não paga.
 *
 * ⚠ `fRenderOneLayer` é `async`, mas para camada de TEXTO não há await no
 * caminho (só imagem carrega arquivo): o desenho sai síncrono, o que é o que
 * permite chamá-la dentro do laço de frames. A bancada mede isso — se um dia
 * deixar de ser verdade, o teste cai.
 */
function vdDesenharLegenda(ctx, texto, W, H, tplId){
  if(typeof fRenderOneLayer !== 'function' || typeof gFitTextLayer !== 'function') return false;
  const l = vdLegendaCamada(texto, W, H, tplId);
  const chave = l.content + '|' + W + 'x' + H + '|' + (tplId || 'dm_cap_01');
  let fit = _vdFitCache.get(chave);
  if(!fit){
    if(!_vdCtxAux) _vdCtxAux = document.createElement('canvas').getContext('2d');
    fit = gFitTextLayer(l, l.content, _vdCtxAux, {});
    if(_vdFitCache.size > 200) _vdFitCache.clear();   // teto bobo, suficiente pra uma sessão
    _vdFitCache.set(chave, fit);
  }
  l._fit = fit;
  fRenderOneLayer(ctx, l, {}, 1, 1);
  return true;
}

/* ── TRANSCRIÇÃO (rede) ──────────────────────────────────────────────── */

const VD_PROMPT_TRANSCRICAO = 'Transcreva a fala deste áudio em português do Brasil. '
  + 'Devolva SOMENTE JSON no formato {"trechos":[{"de":segundos,"ate":segundos,"texto":"..."}]}, '
  + 'com um trecho por frase ou oração curta. Use os tempos reais do áudio, em segundos com uma decimal. '
  + 'Não invente fala que não está no áudio, não traduza, não comente. Se não houver fala, devolva {"trechos":[]}.';

/**
 * Transcreve o áudio já medido e devolve os cartões.
 *
 * Reutiliza o WAV que `vdMedirAudio` produziu (16kHz mono, ~32KB/s): uma
 * decodificação serve à detecção de silêncio E à transcrição. Mandar o vídeo
 * inteiro custaria dezenas de MB por chamada.
 *
 * @returns {Promise<{ok:boolean, cards?:Array, erro?:string}>}
 */
async function vdTranscrever(){
  if(typeof gAskAI !== 'function' || typeof gAiReady !== 'function' || !gAiReady()){
    return { ok:false, erro:'a IA não está disponível nesta sessão' };
  }
  const med = await vdMedirAudio();
  if(!med.ok) return { ok:false, erro:med.erro };
  if(!med.wav) return { ok:false, erro:'não consegui preparar o áudio para transcrição' };

  const parte = await gAiFileToPart(new File([med.wav], 'audio.wav', { type:'audio/wav' }));
  if(!parte) return { ok:false, erro:'não consegui ler o áudio preparado' };

  const bruto = await gAskAI('transcrever-audio', VD_PROMPT_TRANSCRICAO, { parts:[parte], json:true, cache:false });
  if(bruto == null) return { ok:false, erro:'a IA não respondeu' };
  const dados = (typeof gAiParseJson === 'function') ? gAiParseJson(bruto) : null;
  const trechos = dados && Array.isArray(dados.trechos) ? dados.trechos : null;
  if(!trechos) return { ok:false, erro:'a resposta da IA não veio no formato esperado' };
  if(!trechos.length) return { ok:false, erro:'não identifiquei fala neste áudio' };

  // Tempo fora do vídeo é alucinação de modelo: descarta em vez de exibir legenda
  // no lugar errado. O teto é a duração do arquivo, que o navegador mediu.
  const dur = (vdProj && vdProj.fonte.dur) || med.dur || 0;
  const limpos = trechos.filter(t => {
    const de = Number(t && t.de), ate = Number(t && t.ate);
    return isFinite(de) && isFinite(ate) && ate > de && de >= -0.5 && ate <= dur + 1;
  });
  if(!limpos.length) return { ok:false, erro:'a transcrição veio com tempos fora do vídeo' };

  const cards = vdCardsDeTranscricao(limpos);
  if(!cards.length) return { ok:false, erro:'a transcrição não gerou legenda' };
  return { ok:true, cards, descartados: trechos.length - limpos.length };
}
