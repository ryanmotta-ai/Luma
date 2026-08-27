/**
 * js/video/projeto.js
 *
 * O PROJETO DE VÍDEO (o EDL) — a verdade da edição, e o único lugar que a muta.
 *
 * O Luma não tem servidor nem FFmpeg: quem edita é o navegador (ver
 * docs/LUMA-VIDEO.md §1). Então a edição NUNCA toca no arquivo de vídeo — ela
 * descreve o que fica, em segundos, num objeto pequeno e serializável. O
 * compositor lê isto para desenhar a prévia E para exportar; um caminho só.
 *
 * ⛔ O arquivo de vídeo NÃO mora aqui. `vdProj.fonte` guarda só nome/duração/
 * tamanho (texto). O File e o objectURL vivem em `vdFonte` (js/video/video.js),
 * fora do que é serializado — é o que permite guardar o projeto sem estourar
 * cota e sem carregar 150MB de base64 no estado.
 *
 * ⚠ Resolva sempre por ID (`vdSegIdx`), nunca por referência viva: desfazer e
 * aplicar plano TROCAM os objetos por clones, e uma referência guardada aponta
 * para objeto morto. É a armadilha nº 1 desta base (03_ENGINEERING §3).
 *
 * Não depende de DOM — por isso a suíte tests/video-edl.html exercita isto no
 * navegador sem montar a interface.
 */

/* Tolerância de tempo, em segundos. Um frame a 30fps é 33ms; comparar tempo de
   vídeo com igualdade exata falha sempre (o navegador entrega 4,799999). */
const VD_TOL = 0.04;
/* Teto de ações num plano de IA. Defesa contra plano delirante travar a aba. */
const VD_MAX_ACOES = 40;
/* Tetos de entrada — decisão de produto (docs/LUMA-VIDEO.md §14): desktop, até
   3 min de entrada. Acima disso a memória do navegador vira o problema. */
const VD_MAX_ENTRADA_SEG = 180;
const VD_MAX_ENTRADA_MB = 300;

/* Ações que o compositor SABE executar hoje. O validador descarta o resto com
   motivo em vez de aceitar calado e não fazer nada — plano aceito que não
   acontece é o pior dos dois mundos. Legenda, overlay, SFX e vinheta entram
   aqui quando as fases 4 e 5 existirem. */
const VD_ACOES_SUPORTADAS = ['segmentos', 'reframe'];

let vdProj = null;          // o EDL em edição (null = nenhum vídeo carregado)
let _vdHist = [];           // pilha de snapshots JSON (desfazer/refazer)
let _vdHistPos = -1;
const VD_HIST_MAX = 40;

/* ── CRIAÇÃO ─────────────────────────────────────────────────────────── */

let _vdSeq = 0;
function vdNovoId(pre){ return pre + (++_vdSeq) + '_' + Math.random().toString(36).slice(2, 7); }

/**
 * Projeto novo a partir de uma fonte. Nasce com UM segmento cobrindo o vídeo
 * inteiro — abrir um arquivo não é editar, e o usuário precisa ver o material
 * intacto antes de cortar.
 * @param {{nome:string,dur:number,w:number,h:number,mb:number}} fonte
 */
function vdNovoProjeto(fonte){
  const dur = Math.max(0, Number(fonte && fonte.dur) || 0);
  vdProj = {
    id: vdNovoId('vp'),
    nome: (fonte && fonte.nome) || 'Vídeo',
    formato: '9:16',
    alvo_seg: 30,
    fonte: { nome:(fonte&&fonte.nome)||'', dur:dur, w:(fonte&&fonte.w)||0, h:(fonte&&fonte.h)||0, mb:(fonte&&fonte.mb)||0 },
    segmentos: dur > 0 ? [{ id: vdNovoId('s'), de: 0, ate: dur, zoom: 1, motivo: 'material original' }] : [],
    versao: 1
  };
  _vdHist = []; _vdHistPos = -1;
  vdRegistrar('material original');
  return vdProj;
}

/* ── LEITURA ─────────────────────────────────────────────────────────── */

function vdSegs(){ return (vdProj && vdProj.segmentos) || []; }
function vdSegIdx(id){ return vdSegs().findIndex(s => s.id === id); }
function vdSegDur(s){ return Math.max(0, s.ate - s.de); }
function vdDuracaoFinal(){ return vdSegs().reduce((t, s) => t + vdSegDur(s), 0); }

/** Onde o segmento de índice `idx` começa na linha do tempo editada. */
function vdInicioLinha(idx){
  let t = 0;
  const segs = vdSegs();
  for(let i = 0; i < idx && i < segs.length; i++) t += vdSegDur(segs[i]);
  return t;
}

/**
 * Traduz tempo da LINHA DO TEMPO (o que o usuário vê) para tempo da FONTE (o
 * que o <video> precisa). É a função que faz o corte existir sem cortar bytes.
 * @returns {{idx:number,seg:object,tFonte:number,inicioLinha:number}|null}
 */
function vdSegNoTempo(tLinha){
  const segs = vdSegs();
  let acc = 0;
  for(let i = 0; i < segs.length; i++){
    const d = vdSegDur(segs[i]);
    // `<` e não `<=`: no limite exato o tempo pertence ao segmento SEGUINTE,
    // senão o playhead no fim de um corte fica preso no anterior.
    if(tLinha < acc + d || i === segs.length - 1){
      const dentro = Math.min(Math.max(tLinha - acc, 0), d);
      return { idx:i, seg:segs[i], tFonte: segs[i].de + dentro, inicioLinha: acc };
    }
    acc += d;
  }
  return null;
}

function vdFmtTempo(s){
  s = Math.max(0, Number(s) || 0);
  const m = Math.floor(s / 60), seg = Math.floor(s % 60), d = Math.floor((s % 1) * 10);
  return m + ':' + String(seg).padStart(2, '0') + '.' + d;
}

/* ── EDIÇÃO (cada uma tira snapshot ANTES de mudar) ───────────────────── */

/**
 * Divide o segmento no ponto da linha do tempo. Não remove nada: dividir é o
 * gesto seguro (o usuário decide depois qual lado morre).
 * @returns {boolean} false quando o ponto não gera dois pedaços úteis
 */
function vdDividir(tLinha){
  const hit = vdSegNoTempo(tLinha);
  if(!hit) return false;
  const s = hit.seg;
  // Divisão a menos de um frame da borda não cria pedaço editável — só sujeira.
  if(hit.tFonte - s.de < VD_TOL || s.ate - hit.tFonte < VD_TOL) return false;
  const novo = { id: vdNovoId('s'), de: hit.tFonte, ate: s.ate, zoom: s.zoom, motivo: s.motivo };
  s.ate = hit.tFonte;
  vdProj.segmentos.splice(hit.idx + 1, 0, novo);
  vdRegistrar('dividir');
  return true;
}

/** Remove um segmento. O último não sai: projeto sem segmento não tem prévia. */
function vdRemoverSeg(id){
  const i = vdSegIdx(id);
  if(i < 0 || vdSegs().length <= 1) return false;
  vdProj.segmentos.splice(i, 1);
  vdRegistrar('remover trecho');
  return true;
}

/** Move o segmento uma casa (-1 antes, +1 depois) — reordenar sem arrastar. */
function vdMoverSeg(id, dir){
  const i = vdSegIdx(id), j = i + (dir < 0 ? -1 : 1);
  if(i < 0 || j < 0 || j >= vdSegs().length) return false;
  const arr = vdProj.segmentos;
  const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  vdRegistrar('mover trecho');
  return true;
}

/** Foco do enquadramento (0 = borda inicial, 1 = borda final, 0,5 = centro).
 *  Só tem efeito no eixo que o formato de saída está cortando. */
function vdFocoSeg(id, foco){
  const i = vdSegIdx(id);
  if(i < 0) return false;
  const f = Math.min(Math.max(Number(foco), 0), 1);
  if(!isFinite(f)) return false;
  const atual = vdProj.segmentos[i].foco;
  if(atual != null && Math.abs(f - atual) < 0.005) return false;
  vdProj.segmentos[i].foco = f;
  vdRegistrar('enquadramento');
  return true;
}

/** Zoom do segmento (1 = enquadramento cheio). Teto baixo de propósito: acima
 *  de 1,6 o vídeo do celular vira mosaico. */
function vdZoomSeg(id, zoom){
  const i = vdSegIdx(id);
  if(i < 0) return false;
  const z = Math.min(Math.max(Number(zoom) || 1, 1), 1.6);
  if(Math.abs(z - vdProj.segmentos[i].zoom) < 0.005) return false;
  vdProj.segmentos[i].zoom = z;
  vdRegistrar('zoom');
  return true;
}

/* ── DESFAZER / REFAZER ──────────────────────────────────────────────────
   O histórico guarda o estado DEPOIS de cada edição, com `_vdHistPos` apontando
   para o estado atual. Guardar o estado ANTERIOR parece equivalente e não é: o
   resultado da última edição nunca entrava na pilha, então refazer parava uma
   casa antes do fim. (Foi exatamente o que a suíte pegou.)

   Snapshot do EDL inteiro em JSON é viável porque o EDL é minúsculo (dezenas de
   números) — o arquivo de vídeo não está dentro dele. */

/** Registra o estado ATUAL como ponto do histórico. Chame DEPOIS de mutar. */
function vdRegistrar(rotulo){
  if(!vdProj) return;
  // Editar a partir do meio do histórico descarta o futuro — comportamento
  // esperado de editor: o que foi desfeito e sobrescrito não volta.
  if(_vdHistPos < _vdHist.length - 1) _vdHist = _vdHist.slice(0, _vdHistPos + 1);
  _vdHist.push({ rotulo: rotulo || 'edição', json: JSON.stringify(vdProj) });
  if(_vdHist.length > VD_HIST_MAX){ _vdHist.shift(); }
  _vdHistPos = _vdHist.length - 1;
}

/**
 * Regrava o snapshot ATUAL do histórico com o vdProj de agora.
 *
 * ⚠ POR QUE EXISTE: `vdRegistrar` congela o projeto em JSON. Quem escreve no
 * vdProj DEPOIS de registrar (é o caso do log da IA, que só existe quando o
 * plano já foi aplicado) grava fora do snapshot — e um desfazer/refazer apagava
 * o log de um corte que continuava lá. Isto costura o estado ao mesmo ponto do
 * histórico, sem criar uma segunda entrada que o usuário teria de desfazer duas
 * vezes. Não use para mudança de edição: para isso é `vdRegistrar`.
 */
function vdReRegistrar(){
  if(!vdProj || _vdHistPos < 0) return false;
  _vdHist[_vdHistPos].json = JSON.stringify(vdProj);
  return true;
}

function vdPodeDesfazer(){ return _vdHistPos > 0; }
function vdPodeRefazer(){ return _vdHistPos >= 0 && _vdHistPos < _vdHist.length - 1; }
function vdRotuloHist(){ return (_vdHist[_vdHistPos] && _vdHist[_vdHistPos].rotulo) || ''; }

function vdDesfazer(){
  if(!vdPodeDesfazer()) return false;
  _vdHistPos--;
  vdProj = JSON.parse(_vdHist[_vdHistPos].json);
  return true;
}

function vdRefazer(){
  if(!vdPodeRefazer()) return false;
  _vdHistPos++;
  vdProj = JSON.parse(_vdHist[_vdHistPos].json);
  return true;
}

/* ── VALIDADOR DO PLANO DE IA ────────────────────────────────────────────
   NUNCA executar o que o modelo devolveu. Contrato igual ao de gAskAI: nunca
   lança; devolve o que sobrou e o que foi descartado, com motivo legível.

   ⛔ Isto NÃO é segurança — é honestidade e defesa contra plano inválido. Quem
   protege dado (asset não aprovado, por exemplo) é a RLS. */

/**
 * @param {object} plano  EditPlan cru do modelo
 * @returns {{ok:boolean, segmentos:Array, descartes:Array<{acao:string,porque:string}>}}
 */
function vdValidarPlano(plano){
  const descartes = [];
  const fora = (acao, porque) => descartes.push({ acao: String(acao || '?'), porque: porque });
  const dur = (vdProj && vdProj.fonte.dur) || 0;

  if(!plano || typeof plano !== 'object' || !Array.isArray(plano.acoes)){
    return { ok:false, segmentos:[], descartes:[{ acao:'plano', porque:'resposta não é um plano com lista de ações' }] };
  }
  if(!dur){
    return { ok:false, segmentos:[], descartes:[{ acao:'plano', porque:'não há vídeo carregado para validar contra' }] };
  }

  const acoes = plano.acoes.slice(0, VD_MAX_ACOES);
  if(plano.acoes.length > VD_MAX_ACOES) fora('plano', 'mais de ' + VD_MAX_ACOES + ' ações — o excedente foi ignorado');

  let segmentos = null;
  const reframes = [];

  for(const a of acoes){
    const tipo = a && a.tipo;
    if(!tipo){ fora('?', 'ação sem tipo'); continue; }
    if(VD_ACOES_SUPORTADAS.indexOf(tipo) < 0){ fora(tipo, 'ação ainda não suportada pelo editor'); continue; }
    // Motivo é obrigatório de propósito: é o que o log mostra ao usuário e o
    // que força o modelo a justificar em vez de enfeitar.
    if(!a.motivo || String(a.motivo).trim().length < 3){ fora(tipo, 'ação sem motivo'); continue; }

    if(tipo === 'segmentos'){
      if(segmentos){ fora(tipo, 'plano trouxe duas listas de segmentos — vale a primeira'); continue; }
      if(!Array.isArray(a.manter) || !a.manter.length){ fora(tipo, 'lista de trechos a manter vazia'); continue; }
      const limpos = [];
      let ultimoFim = -1;
      for(const t of a.manter){
        const de = Number(t && t.de), ate = Number(t && t.ate);
        if(!isFinite(de) || !isFinite(ate)){ fora(tipo, 'trecho com tempo inválido'); continue; }
        if(ate - de < VD_TOL){ fora(tipo, 'trecho de ' + vdFmtTempo(de) + ' curto demais'); continue; }
        if(de < -VD_TOL || ate > dur + VD_TOL){ fora(tipo, 'trecho ' + vdFmtTempo(de) + '–' + vdFmtTempo(ate) + ' cai fora do vídeo'); continue; }
        // Sobreposição: o modelo devolve trechos em ordem; cruzar é sinal de
        // plano confuso, e aceitar duplicaria o mesmo áudio na exportação.
        if(de < ultimoFim - VD_TOL){ fora(tipo, 'trecho em ' + vdFmtTempo(de) + ' sobrepõe o anterior'); continue; }
        limpos.push({ id: vdNovoId('s'), de: Math.max(0, de), ate: Math.min(dur, ate), zoom: 1, motivo: String(a.motivo).slice(0, 160) });
        ultimoFim = ate;
      }
      if(!limpos.length){ fora(tipo, 'nenhum trecho sobreviveu à validação'); continue; }
      segmentos = limpos;
    }

    if(tipo === 'reframe'){
      const de = Number(a.de), ate = Number(a.ate);
      // zoom e foco são opcionais: um reframe pode ser só pan (achar o produto no
      // quadro) sem aproximar, e aproximar sem mudar o lado que sobrevive.
      const zoom = a.zoom == null ? 1 : Number(a.zoom);
      const foco = a.foco == null ? null : Number(a.foco);
      if(!isFinite(de) || !isFinite(ate) || ate <= de){ fora(tipo, 'intervalo inválido'); continue; }
      if(!isFinite(zoom) || zoom < 1 || zoom > 1.6){ fora(tipo, 'zoom fora da faixa de 1 a 1,6'); continue; }
      if(foco !== null && (!isFinite(foco) || foco < 0 || foco > 1)){ fora(tipo, 'foco fora da faixa de 0 a 1'); continue; }
      reframes.push({ de, ate, zoom, foco });
    }
  }

  if(!segmentos) return { ok:false, segmentos:[], descartes: descartes.concat([{ acao:'plano', porque:'o plano não define quais trechos manter' }]) };

  // Reframe casa por interseção com o segmento — o modelo fala em tempo da
  // FONTE, e o segmento é o dono do zoom na hora de desenhar.
  for(const r of reframes){
    let bateu = false;
    for(const s of segmentos){
      if(r.de < s.ate - VD_TOL && r.ate > s.de + VD_TOL){
        s.zoom = r.zoom;
        if(r.foco !== null) s.foco = r.foco;
        bateu = true;
      }
    }
    if(!bateu) fora('reframe', 'intervalo ' + vdFmtTempo(r.de) + '–' + vdFmtTempo(r.ate) + ' não cai em nenhum trecho mantido');
  }

  // Duração acima do alvo não invalida o plano: o alvo é intenção, e cortar por
  // conta própria aqui esconderia do usuário que a IA errou o tamanho.
  const total = segmentos.reduce((t, s) => t + (s.ate - s.de), 0);
  const alvo = (vdProj && vdProj.alvo_seg) || 0;
  if(alvo && total > alvo * 1.35) fora('duração', 'a edição ficou em ' + vdFmtTempo(total) + ', acima do alvo de ' + alvo + 's');

  return { ok:true, segmentos, descartes };
}

/** Aplica um plano já validado. Uma edição só (um snapshot só) no histórico. */
function vdAplicarPlano(plano){
  const r = vdValidarPlano(plano);
  if(!r.ok) return r;
  vdProj.segmentos = r.segmentos;
  vdProj.versao = (vdProj.versao || 1) + 1;
  vdRegistrar('edição da IA');
  return r;
}
