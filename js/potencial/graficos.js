/**
 * js/potencial/graficos.js
 *
 * POTENCIAL — gráficos em SVG puro (v2, 30/10/2026). Sem biblioteca: o Luma não tem build.
 * ---------------------------------------------------------------------------
 * Duas séries do MESMO modelo de 24 meses, empilhadas e com o eixo X compartilhado — nunca num eixo
 * duplo (GMV na casa das centenas de milhares e caixa acumulado negativo/positivo não dividem escala):
 *   1. GMV mensal          — colunas (≤ 24 px, ponta de 4 px arredondada, base reta)
 *   2. Caixa acumulado     — área/linha com a linha do zero, o fundo do poço e o mês de payback marcados
 * A leitura é a mesma do resto da tela: valores em texto neutro (`--cr-text*`), a cor só nas marcas.
 * Hover: um cursor vertical segue o ponteiro nos DOIS gráficos e um balão mostra o mês inteiro; o teclado
 * (setas, Home/End) faz o mesmo. Tudo que o balão mostra também está na tabela mês a mês (<details>).
 *
 * ⛔ Nada calcula aqui: o desenho só lê o objeto de `potModelo24` (motor.js).
 * ⛔ Texto vindo de fora entra por textContent; os poucos rótulos do SVG são números formatados por nós.
 * Depende de: potencial/motor.js (potBRL, potBRLc, potNumero).
 */

const POT_G = { w:760, hGmv:200, hCaixa:230, ml:58, mr:14, mt:14, mb:26 };

function _potEscala(min, max, alto, mt){
  const span=(max-min)||1;
  return v=>mt+alto*(1-(v-min)/span);
}

// Ticks "redondos": 4–5 degraus entre min e max, em múltiplos de 1/2/5 × 10^n.
function _potTicks(min, max){
  const span=max-min; if(span<=0) return [min];
  const bruto=span/4, mag=Math.pow(10,Math.floor(Math.log10(bruto))), norm=bruto/mag;
  const passo=(norm<1.5?1:norm<3?2:norm<7?5:10)*mag;
  const t=[]; for(let v=Math.ceil(min/passo)*passo; v<=max+1e-9; v+=passo) t.push(Math.round(v/passo)*passo);
  return t;
}

function _potX(m){ const w=POT_G.w-POT_G.ml-POT_G.mr, slot=w/POT_MESES; return POT_G.ml+slot*(m-1)+slot/2; }

// Coluna com a ponta de 4 px arredondada e a base reta, ancorada no zero.
function _potColuna(x, y, larg, base, raio){
  const h=base-y; if(h<=0) return '';
  const r=Math.min(raio,h,larg/2);
  return 'M'+(x-larg/2)+' '+base+'V'+(y+r)+'Q'+(x-larg/2)+' '+y+' '+(x-larg/2+r)+' '+y+'H'+(x+larg/2-r)+'Q'+(x+larg/2)+' '+y+' '+(x+larg/2)+' '+(y+r)+'V'+base+'Z';
}

function _potEixoX(altoTotal){
  let s=''; [1,6,12,18,24].forEach(m=>{
    s+='<text class="pot-g-tick" x="'+_potX(m)+'" y="'+(altoTotal-8)+'" text-anchor="middle">'+(m===1?'mês 1':m)+'</text>';
  });
  return s;
}

/* 1 · GMV mensal (colunas) */
function potGraficoGMV(modelo){
  const G=POT_G, H=G.hGmv, ar=H-G.mt-G.mb, base=G.mt+ar;
  const max=Math.max.apply(null,modelo.meses.map(r=>r.gmv))*1.08;
  const y=_potEscala(0,max,ar,G.mt);
  let grade='', cols='';
  _potTicks(0,max).forEach(t=>{
    grade+='<line class="pot-g-grade" x1="'+G.ml+'" x2="'+(G.w-G.mr)+'" y1="'+y(t)+'" y2="'+y(t)+'"/>'
      +'<text class="pot-g-tick" x="'+(G.ml-8)+'" y="'+(y(t)+4)+'" text-anchor="end">'+(t===0?'0':potBRLc(t).replace('R$ ',''))+'</text>';
  });
  const slot=(G.w-G.ml-G.mr)/POT_MESES, larg=Math.min(18,slot-6);
  modelo.meses.forEach(r=>{ cols+='<path class="pot-g-col" d="'+_potColuna(_potX(r.m),y(r.gmv),larg,base,4)+'"/>'; });
  // Faixa do lançamento (meses 1–5), atrás das colunas.
  const lanc='<rect class="pot-g-faixa" x="'+(G.ml)+'" y="'+G.mt+'" width="'+(slot*5)+'" height="'+ar+'"/>'
    +'<text class="pot-g-rot" x="'+(G.ml+6)+'" y="'+(G.mt+12)+'">Lançamento</text>';
  const ult=modelo.meses[POT_MESES-1];
  return '<svg class="pot-g-svg" viewBox="0 0 '+G.w+' '+H+'" role="img" aria-label="GMV mensal em 24 meses: de '+potBRLc(modelo.meses[0].gmv)+' no mês 1 a '+potBRLc(ult.gmv)+' no mês 24" data-g="gmv">'
    +lanc+grade+'<line class="pot-g-zero" x1="'+G.ml+'" x2="'+(G.w-G.mr)+'" y1="'+base+'" y2="'+base+'"/>'+cols
    +'<text class="pot-g-fim" x="'+(_potX(24)+larg/2)+'" y="'+(y(ult.gmv)-6)+'" text-anchor="end">'+potBRLc(ult.gmv)+'</text>'
    +_potEixoX(H)+'<line class="pot-g-cx" y1="'+G.mt+'" y2="'+base+'" hidden/></svg>';
}

/* 2 · Caixa acumulado do franqueado (área + linha, com zero, fundo do poço e payback) */
function potGraficoCaixa(modelo){
  const G=POT_G, H=G.hCaixa, ar=H-G.mt-G.mb;
  const vals=modelo.meses.map(r=>r.acumulado);
  const max=Math.max(0,Math.max.apply(null,vals))*1.12, min=Math.min(0,Math.min.apply(null,vals))*1.18;
  const y=_potEscala(min,max,ar,G.mt), y0=y(0);
  let grade='';
  _potTicks(min,max).forEach(t=>{
    grade+='<line class="pot-g-grade" x1="'+G.ml+'" x2="'+(G.w-G.mr)+'" y1="'+y(t)+'" y2="'+y(t)+'"/>'
      +'<text class="pot-g-tick" x="'+(G.ml-8)+'" y="'+(y(t)+4)+'" text-anchor="end">'+(t===0?'0':potBRLc(t).replace('R$ ',''))+'</text>';
  });
  const pts=modelo.meses.map(r=>[_potX(r.m),y(r.acumulado)]);
  const linha=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join('');
  const area=linha+'L'+pts[pts.length-1][0].toFixed(1)+' '+y0.toFixed(1)+'L'+pts[0][0].toFixed(1)+' '+y0.toFixed(1)+'Z';
  const r=modelo.resumo, pico=modelo.meses[r.mesPico-1], pay=r.paybackMes?modelo.meses[r.paybackMes-1]:null;
  const x0=G.ml, x1=G.w-G.mr;
  // Duas metades do mesmo desenho: abaixo do zero (vermelho) e acima (verde), recortadas pela linha do zero.
  const defs='<defs><clipPath id="pot-cp-neg"><rect x="'+x0+'" y="'+y0+'" width="'+(x1-x0)+'" height="'+(H)+'"/></clipPath>'
    +'<clipPath id="pot-cp-pos"><rect x="'+x0+'" y="0" width="'+(x1-x0)+'" height="'+y0+'"/></clipPath></defs>';
  const rot=(x,yy,txt,ancora)=>'<text class="pot-g-rot-forte" x="'+x+'" y="'+yy+'" text-anchor="'+ancora+'">'+txt+'</text>';
  const clampX=(x,larg)=>Math.max(x0+larg/2,Math.min(x1-larg/2,x));
  // Os rótulos ficam do lado vazio de cada ponto: o fundo do caixa à direita dele, abaixo da curva que sobe; o
  // payback acima do zero, à esquerda — nada pousa sobre a linha nem sobre o eixo.
  let marcas='<circle class="pot-g-ponto pot-g-neg" cx="'+_potX(pico.m)+'" cy="'+y(pico.acumulado)+'" r="5"/>'
    +(_potX(pico.m)<G.w*0.62 ? rot(_potX(pico.m)+12,y(pico.acumulado)+4,'Fundo do caixa: '+potBRLc(pico.acumulado)+' · mês '+pico.m,'start')
                             : rot(_potX(pico.m)-12,y(pico.acumulado)+4,'Fundo do caixa: '+potBRLc(pico.acumulado)+' · mês '+pico.m,'end'));
  if(pay) marcas+='<circle class="pot-g-ponto pot-g-pos" cx="'+_potX(pay.m)+'" cy="'+y(pay.acumulado)+'" r="5"/>'
    +rot(_potX(pay.m)-10,y(pay.acumulado)-10,'Payback: mês '+pay.m,'end');
  const ult=modelo.meses[POT_MESES-1];
  return '<svg class="pot-g-svg" viewBox="0 0 '+G.w+' '+H+'" role="img" aria-label="Caixa acumulado do franqueado: fundo de '+potBRLc(pico.acumulado)+' no mês '+pico.m+(pay?', payback no mês '+pay.m:', sem payback em 24 meses')+', '+potBRLc(ult.acumulado)+' no mês 24" data-g="caixa">'
    +defs+grade
    +'<path class="pot-g-area-neg" clip-path="url(#pot-cp-neg)" d="'+area+'"/><path class="pot-g-area-pos" clip-path="url(#pot-cp-pos)" d="'+area+'"/>'
    +'<line class="pot-g-zero" x1="'+x0+'" x2="'+x1+'" y1="'+y0+'" y2="'+y0+'"/>'
    +'<path class="pot-g-linha" d="'+linha+'"/>'+marcas
    +'<text class="pot-g-fim" x="'+x1+'" y="'+(y(ult.acumulado)-10)+'" text-anchor="end">'+potBRLc(ult.acumulado)+'</text>'
    +_potEixoX(H)+'<line class="pot-g-cx" y1="'+G.mt+'" y2="'+(G.mt+ar)+'" hidden/></svg>';
}

/* Os dois gráficos + balão + legenda (HTML) */
function potProjecaoHTML(modelo){
  return '<div class="pot-g" id="pot-g" tabindex="0" role="group" aria-label="Projeção de 24 meses. Use as setas para percorrer os meses." data-m="0">'
    +'<div class="pot-g-bloco"><p class="pot-g-tit">GMV mensal <span>cresce todo mês: a planilha não tem perda de base</span></p>'+potGraficoGMV(modelo)+'</div>'
    +'<div class="pot-g-bloco"><p class="pot-g-tit">Caixa acumulado do franqueado <span>repasse − marketing − taxa de franquia</span></p>'+potGraficoCaixa(modelo)+'</div>'
    +'<div class="pot-tip" id="pot-tip" hidden role="status"></div></div>';
}

// Liga o cursor e o balão. Chamado depois de inserir potProjecaoHTML no DOM.
function potLigaProjecao(modelo){
  const raiz=document.getElementById('pot-g'); if(!raiz) return;
  const tip=document.getElementById('pot-tip'), svgs=[].slice.call(raiz.querySelectorAll('.pot-g-svg'));
  const slot=(POT_G.w-POT_G.ml-POT_G.mr)/POT_MESES;
  function mostra(m){
    if(m<1||m>POT_MESES){ oculta(); return; }
    raiz.dataset.m=m;
    svgs.forEach(s=>{ const l=s.querySelector('.pot-g-cx'); l.setAttribute('x1',_potX(m)); l.setAttribute('x2',_potX(m)); l.removeAttribute('hidden'); });
    const r=modelo.meses[m-1];
    const lin=(rot,v,forte)=>'<div class="pot-tip-l'+(forte?' f':'')+'"><span>'+rot+'</span><b>'+v+'</b></div>';
    tip.innerHTML='<p class="pot-tip-m">Mês '+m+(m<=5?' · lançamento':'')+'</p>'
      +lin('GMV',potBRL(r.gmv),true)+lin('Comissão bruta',potBRL(r.comissao))+lin('Repasse ao franqueado',potBRL(r.repasse))
      +lin('Marketing do franqueado',potBRL(-r.mktFranqueado))+(r.taxa?lin('Taxa de franquia',potBRL(-r.taxa)):'')
      +lin('Saldo do mês',potBRL(r.saldo))+lin('Caixa acumulado',potBRL(r.acumulado),true);
    tip.hidden=false;
    // Balão à direita do cursor; vira para a esquerda na segunda metade para não sair da tela.
    const caixa=raiz.getBoundingClientRect(), s0=svgs[0].getBoundingClientRect();
    const px=(_potX(m)/POT_G.w)*s0.width+(s0.left-caixa.left);
    const larg=tip.offsetWidth||200;
    tip.style.left=Math.max(4,Math.min(caixa.width-larg-4, m>12 ? px-larg-14 : px+14))+'px';
  }
  function oculta(){ tip.hidden=true; svgs.forEach(s=>s.querySelector('.pot-g-cx').setAttribute('hidden','')); raiz.dataset.m=0; }
  function doPonteiro(e){
    const s=svgs[0].getBoundingClientRect(); const x=(e.clientX-s.left)/s.width*POT_G.w;
    mostra(Math.max(1,Math.min(POT_MESES,Math.floor((x-POT_G.ml)/slot)+1)));
  }
  raiz.addEventListener('pointermove',doPonteiro);
  raiz.addEventListener('pointerdown',doPonteiro);
  raiz.addEventListener('pointerleave',()=>{ if(document.activeElement!==raiz) oculta(); });
  raiz.addEventListener('blur',oculta);
  raiz.addEventListener('keydown',e=>{
    const m=+raiz.dataset.m||0;
    if(e.key==='ArrowRight'){ e.preventDefault(); mostra(Math.min(POT_MESES,m+1)); }
    else if(e.key==='ArrowLeft'){ e.preventDefault(); mostra(Math.max(1,m-1)); }
    else if(e.key==='Home'){ e.preventDefault(); mostra(1); }
    else if(e.key==='End'){ e.preventDefault(); mostra(POT_MESES); }
    else if(e.key==='Escape'){ oculta(); }
  });
}

/* Tabela mês a mês: o caminho sem mouse para todo número do balão. */
function potTabelaMeses(modelo){
  const th=['Mês','GMV','Comissão bruta','Repasse','Marketing','Taxa','Saldo do mês','Caixa acumulado'];
  const cel=(v,neg)=>'<td class="'+(neg&&v<0?'neg':'')+'">'+potBRL(v)+'</td>';
  return '<div class="pot-tab-rolo"><table class="pot-tab"><thead><tr>'+th.map(t=>'<th scope="col">'+t+'</th>').join('')+'</tr></thead><tbody>'
    +modelo.meses.map(r=>'<tr><th scope="row">'+r.m+'</th>'+cel(r.gmv)+cel(r.comissao)+cel(r.repasse)+cel(-r.mktFranqueado,1)+cel(-r.taxa,1)+cel(r.saldo,1)+cel(r.acumulado,1)+'</tr>').join('')
    +'</tbody></table></div>';
}
