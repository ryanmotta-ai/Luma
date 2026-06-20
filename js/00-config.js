/**
 * js/00-config.js
 *
 * Constantes globais imutaveis: HIST_KEY, CAMPS_ATIVAS, CAMPS_OUTRAS, FMTS.
 * Deve ser carregado PRIMEIRO (todos os modulos dependem destas constantes).
 */

/* ══════════════════════════════════════════════════════════════
   FRANQUEADO — dados e estado
══════════════════════════════════════════════════════════════ */
const HIST_KEY='dm_artes_hist_v2';

/* ── CAMPANHAS ── */
const CAMPS_ATIVAS=[
  {id:'cdm26',name:'Copa Do Mundo 2026',color:'#1565C0',count:6,badge:'2026',expiraDias:60,popular:true,cover:'assets/covers/cdm26.png',
   previewProd:'COPA DO MUNDO',previewDe:'',previewPor:'',
   perguntas:[
    {id:'produto',texto:'Qual prato ou promoção você vai destacar na arte Copa do Mundo?',sugestoes:['Combo Copa','Bandeja da Torcida','X-Tudo','Burger Especial']},
    {id:'desconto',texto:'Tem algum desconto especial para os jogos?',sugestoes:['20% off','Frete grátis na hora do jogo','Brinde na compra','Promoção especial']},
    {id:'validade',texto:'Qual a validade da promoção?',sugestoes:['Durante os jogos','Este mês','Por tempo limitado','Sem validade']},
   ]},

  {id:'cd',name:'Combo Com Desconto',color:'#E35C00',count:4,badge:'',expiraDias:5,popular:false,cover:'assets/covers/cd.png',
   previewProd:'COMBO FAMÍLIA',previewDe:'',previewPor:'20% OFF',
   perguntas:[
    {id:'produto',texto:'Qual o nome do combo que vai estar em destaque?',sugestoes:['Combo Família','Combo Casal','Combo Executivo','Combo Especial']},
    {id:'desconto',texto:'Qual o percentual de desconto? Ex: 20% off.',sugestoes:['10% off','15% off','20% off','30% off']},
    {id:'precoPor',texto:'Qual o preço final do combo com desconto?',sugestoes:['R$ 24,90','R$ 29,90','R$ 34,90','R$ 39,90']},
    {id:'validade',texto:'Qual é a validade da promoção?',sugestoes:['Hoje só','Esta semana','Este mês','Sem validade']},
   ]},
  {id:'tr25',name:'Tudo até R$ 25 - Baratíssimo',color:'#E06000',count:3,badge:'',expiraDias:7,popular:false,cover:'assets/covers/tr25.png',
   previewProd:'CARDÁPIO TODO',previewDe:'',previewPor:'ATÉ R$ 25',
   perguntas:[
    {id:'produto',texto:'Quais pratos ou categorias entram no "tudo até R$ 25"?',sugestoes:['Hamburgueres','Porções','Combos leves','Lanches simples']},
    {id:'validade',texto:'Qual a validade da promoção?',sugestoes:['Hoje só','Este final de semana','Esta semana','Por tempo limitado']},
   ]},
  {id:'bsn',name:'Bora De Sushi Na Promo',color:'#C84B00',count:4,badge:'',expiraDias:7,popular:false,cover:'assets/covers/bsn.png',
   previewProd:'COMBO SUSHI',previewDe:'',previewPor:'NA PROMO',
   perguntas:[
    {id:'produto',texto:'Qual é o combo ou peça de sushi em destaque?',sugestoes:['Combo 20 peças','Temaki especial','Combo família','Zensai surpresa']},
    {id:'precoPor',texto:'Qual o preço promocional?',sugestoes:['R$ 29,90','R$ 34,90','R$ 49,90','R$ 59,90']},
    {id:'validade',texto:'Qual a validade?',sugestoes:['Hoje só','Este final de semana','Esta semana','Por tempo limitado']},
   ]},
  {id:'dd',name:'Desconto Em Dobro',color:'#C81818',count:3,badge:'',expiraDias:5,popular:false,cover:'assets/covers/dd.png',
   previewProd:'DOBRO DE DESCONTO',previewDe:'',previewPor:'2X OFF',
   perguntas:[
    {id:'produto',texto:'Qual produto ou categoria ganha desconto em dobro?',sugestoes:['Bebidas','Sobremesas','Porções','Combos']},
    {id:'desconto',texto:'Qual o desconto dobrado? Ex: 30% off.',sugestoes:['20% off','30% off','40% off','50% off']},
    {id:'validade',texto:'Qual a validade?',sugestoes:['Hoje só','Este final de semana','Esta semana','Por tempo limitado']},
   ]},
  {id:'rbp',name:'Rangos Que Baixaram O Preço',color:'#B8860B',count:3,badge:'',expiraDias:10,popular:false,cover:'assets/covers/rbp.png',
   previewProd:'PREÇOS BAIXOS',previewDe:'',previewPor:'DESCONTO REAL',
   perguntas:[
    {id:'produto',texto:'Quais pratos baixaram de preço?',sugestoes:['X-Burguer','Combo Frango','Pizza calabresa','Açaí 500ml']},
    {id:'precoDe',texto:'Qual era o preço antes?',sugestoes:['R$ 24,90','R$ 29,90','R$ 34,90','R$ 39,90']},
    {id:'precoPor',texto:'E o novo preço?',sugestoes:['R$ 14,90','R$ 19,90','R$ 22,90','R$ 24,90']},
    {id:'validade',texto:'Qual a validade?',sugestoes:['Hoje só','Esta semana','Este mês','Sem validade']},
   ]},
];
const CAMPS_OUTRAS=[
  {id:'pt',name:'Promo Turbinada',color:'#7B1FA2',count:4,badge:'',expiraDias:14,popular:false,cover:'assets/covers/pt.png',
   previewProd:'HAMBÚRGUERES',previewDe:'',previewPor:'LEVE 2 PAGUE 1',
   perguntas:[
    {id:'produto',texto:'Qual produto ou categoria está em promoção turbinada?',sugestoes:['Hambúrgueres','Pizzas','Porções','Bebidas']},
    {id:'oferta',texto:'Como é a promoção? Ex: leve 2 pague 1.',sugestoes:['Leve 2 pague 1','50% no 2º item','Frete grátis + desconto','Combo surpresa']},
    {id:'validade',texto:'Qual é a validade?',sugestoes:['Hoje','Este final de semana','Esta semana','Por tempo limitado']},
   ]},
  {id:'gb',name:'Bora Ganhar Brindes',color:'#C81818',count:4,badge:'',expiraDias:30,popular:false,cover:'assets/covers/gb.png',
   previewProd:'SOBREMESA',previewDe:'',previewPor:'GRÁTIS',
   perguntas:[
    {id:'brinde',texto:'Qual é o brinde que o cliente pode ganhar?',sugestoes:['Sobremesa grátis','Bebida grátis','Porção grátis','Cupom de desconto']},
    {id:'condicao',texto:'Qual a condição para ganhar o brinde?',sugestoes:['Pedido acima de R$ 30','Compra de combo','3ª compra no mês','Pedido pelo app']},
    {id:'validade',texto:'Qual é a validade da ação?',sugestoes:['Este final de semana','Esta semana','Este mês','Por tempo limitado']},
   ]},

  {id:'otp',name:'OFERTAS | Tudo no Precinho',color:'#854F0B',count:5,badge:'',expiraDias:8,popular:false,cover:'assets/covers/otp.png',
   previewProd:'OFERTAS',previewDe:'',previewPor:'NO PRECINHO',
   perguntas:[
    {id:'produto',texto:'Qual produto é a oferta do momento?',sugestoes:['X-Burguer','Pizza Calabresa','Frango Grelhado','Açaí 500ml']},
    {id:'precoDe',texto:'Qual o preço original (riscado)?',sugestoes:['R$ 24,90','R$ 29,90','R$ 34,90','R$ 39,90']},
    {id:'precoPor',texto:'E o preço da oferta?',sugestoes:['R$ 14,90','R$ 19,90','R$ 22,90','R$ 24,90']},
    {id:'validade',texto:'Qual a validade?',sugestoes:['Hoje','Esta semana','Este mês','Enquanto durar o estoque']},
   ]},
  {id:'eg',name:'Entrega Grátis',color:'#1A7A3C',count:3,badge:'',expiraDias:7,popular:false,cover:'assets/covers/eg.png',
   previewProd:'FRETE GRÁTIS',previewDe:'',previewPor:'R$ 0,00',
   perguntas:[
    {id:'pedidoMin',texto:'A partir de qual valor de pedido a entrega é grátis?',sugestoes:['R$ 20,00','R$ 25,00','R$ 30,00','Qualquer valor']},
    {id:'bairros',texto:'Vale pra toda a cidade ou bairros específicos?',sugestoes:['Toda a cidade','Centro','Bairros selecionados','Perguntar no app']},
    {id:'validade',texto:'Qual a validade dessa promoção de frete?',sugestoes:['Hoje só','Este final de semana','Esta semana','Por tempo limitado']},
   ]},
  {id:'ac',name:'Aqui Tem Cupons',color:'#E35C00',count:5,badge:'',expiraDias:10,popular:false,cover:'assets/covers/ac.png',
   previewProd:'CUPOM EXCLUSIVO',previewDe:'',previewPor:'15% OFF',
   perguntas:[
    {id:'codigo',texto:'Qual o código do cupom que vai aparecer na arte?',sugestoes:['BURGER10','DESCONTO15','PROMO20','OFERTA25']},
    {id:'desconto',texto:'Qual o desconto que o cupom dá?',sugestoes:['10% de desconto','15% de desconto','R$ 5,00 off','R$ 10,00 off']},
    {id:'condicao',texto:'Tem alguma condição para usar o cupom?',sugestoes:['Pedido mínimo R$ 20','Primeira compra','Qualquer pedido','Somente app']},
    {id:'validade',texto:'Qual é a validade do cupom?',sugestoes:['Hoje só','Esta semana','Este mês','Sem validade']},
   ]},
  {id:'aai',name:'Açaí Aqui',color:'#6A0DAD',count:3,badge:'',expiraDias:14,popular:false,cover:'assets/covers/aai.png',
   previewProd:'AÇAÍ',previewDe:'',previewPor:'NA PROMOÇÃO',
   perguntas:[
    {id:'produto',texto:'Qual é o açaí ou combo em destaque?',sugestoes:['Açaí 500ml','Combo 2 açaís','Açaí com granola','Bowl especial']},
    {id:'precoPor',texto:'Qual o preço promocional?',sugestoes:['R$ 9,90','R$ 14,90','R$ 19,90','R$ 24,90']},
    {id:'validade',texto:'Qual a validade?',sugestoes:['Hoje só','Este final de semana','Esta semana','Por tempo limitado']},
   ]},
  {id:'mna',name:'Mercado no App',color:'#2E7D32',count:3,badge:'',expiraDias:14,popular:false,cover:'assets/covers/mna.png',
   previewProd:'MERCADO',previewDe:'',previewPor:'USO EXCLUSIVO',
   perguntas:[
    {id:'produto',texto:'Qual categoria de mercado você quer divulgar?',sugestoes:['Hortifruti','Bebidas','Limpeza','Produtos básicos']},
    {id:'desconto',texto:'Tem algum desconto ou benefício exclusivo no app?',sugestoes:['10% off','Frete grátis','Entrega expressa','Produto gratuito']},
    {id:'validade',texto:'Qual a validade?',sugestoes:['Esta semana','Este mês','Por tempo limitado','Sem validade']},
   ]},
  {id:'cc',name:'Combos Coca',color:'#C81818',count:3,badge:'',expiraDias:14,popular:false,cover:'assets/covers/cc.png',
   previewProd:'COMBO COCA-COLA',previewDe:'',previewPor:'ESPECIAL',
   perguntas:[
    {id:'produto',texto:'Qual prato vem no combo Coca-Cola?',sugestoes:['Burguer + Coca','Pizza + Coca 2L','Frango + Coca','Combo família + Coca 2L']},
    {id:'precoPor',texto:'Qual o preço do combo?',sugestoes:['R$ 24,90','R$ 29,90','R$ 34,90','R$ 39,90']},
    {id:'validade',texto:'Qual a validade?',sugestoes:['Esta semana','Este mês','Por tempo limitado','Sem validade']},
   ]},
];

/* ── IMPLEMENTAÇÃO (novos franqueados) ── */
const CAMPS_IMPLEMENTACAO=[
  {id:'impl-pre',name:'Pré-lançamento',color:'#E35C00',count:3,badge:'NOVO',expiraDias:365,popular:false,
   previewProd:'PRÉ-LANÇAMENTO',previewDe:'',previewPor:'',
   perguntas:[
    {id:'nomeLoja',texto:'Qual é o nome da sua loja?',sugestoes:['Minha Loja','Burguer House','Pizza Express','Sushi Now']},
    {id:'cidade',texto:'Em qual cidade você vai abrir?',sugestoes:['São Paulo','Rio de Janeiro','Curitiba','Porto Alegre']},
    {id:'dataAbertura',texto:'Qual é a data prevista de abertura?',sugestoes:['Em breve!','Próxima semana','Este mês','Em breve']},
   ]},
  {id:'impl-dia',name:'Dia do lançamento',color:'#FF6B00',count:3,badge:'NOVO',expiraDias:365,popular:false,
   previewProd:'DIA DO LANÇAMENTO',previewDe:'',previewPor:'',
   perguntas:[
    {id:'nomeLoja',texto:'Qual é o nome da sua loja?',sugestoes:['Minha Loja','Burguer House','Pizza Express','Sushi Now']},
    {id:'cidade',texto:'Em qual cidade?',sugestoes:['São Paulo','Rio de Janeiro','Curitiba','Porto Alegre']},
    {id:'oferta',texto:'Tem alguma oferta especial de abertura?',sugestoes:['Frete grátis','10% off em tudo','Brinde na compra','Sem desconto']},
   ]},
  {id:'impl-pos',name:'Pós lançamento',color:'#C84B00',count:3,badge:'NOVO',expiraDias:365,popular:false,
   previewProd:'PÓS-LANÇAMENTO',previewDe:'',previewPor:'',
   perguntas:[
    {id:'nomeLoja',texto:'Qual é o nome da sua loja?',sugestoes:['Minha Loja','Burguer House','Pizza Express','Sushi Now']},
    {id:'destaquePos',texto:'O que você quer destacar no pós-lançamento?',sugestoes:['Obrigado pela abertura!','Novidades chegando','Promoção especial','Horários de funcionamento']},
    {id:'validade',texto:'Qual a validade dessa comunicação?',sugestoes:['Esta semana','Este mês','Primeiros 30 dias','Sem validade']},
   ]},
];
const FMTS=[{id:'story',name:'Story',dim:'1080×1920'},{id:'feed',name:'Feed',dim:'1080×1080'},{id:'post',name:'Post wide',dim:'1200×628'}];

/* ══════════════════════════════════════════════════════════════
   VARIÁVEIS — fonte de verdade única (3.1)
   UMA regex e UM interpolador, usados por designer (simulação/preview)
   e franqueado (PNG). Nome válido = [a-zA-Z0-9_] (sem espaço/acento).
══════════════════════════════════════════════════════════════ */
function gVarRegex(){ return /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g; }
// Valida nome de variável (sem espaço/acento). Mesma regra do token e da criação.
function gValidVarName(name){ return /^[a-zA-Z0-9_]+$/.test(String(name||'')); }
// Escapa texto para XML/SVG (& < > " ').
function gXmlEsc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c])); }

// ── Cantos arredondados em QUALQUER polígono (triângulo/polígono/estrela/linha),
//    estilo Photoshop. Compartilhado por canvas, png, preview e SVG.
// points: [[x,y],...] absolutos. r: raio do canto em px (clampado por aresta).
function _gRoundPolyCorners(points, r){
  const n=points.length, out=[];
  for(let i=0;i<n;i++){
    const prev=points[(i-1+n)%n], cur=points[i], next=points[(i+1)%n];
    const v1x=prev[0]-cur[0], v1y=prev[1]-cur[1];
    const v2x=next[0]-cur[0], v2y=next[1]-cur[1];
    const l1=Math.hypot(v1x,v1y)||1, l2=Math.hypot(v2x,v2y)||1;
    const rr=Math.max(0, Math.min(r, l1/2, l2/2));
    out.push({
      p1:[cur[0]+v1x/l1*rr, cur[1]+v1y/l1*rr],   // ponto na aresta de entrada
      cur:cur,
      p2:[cur[0]+v2x/l2*rr, cur[1]+v2y/l2*rr],    // ponto na aresta de saída
    });
  }
  return out;
}
// String de path SVG p/ polígono arredondado (fechado).
function gRoundPolyD(points, r){
  if(!points||points.length<3) return '';
  const c=_gRoundPolyCorners(points, r||0), n=c.length;
  let d='M '+c[0].p2[0].toFixed(2)+' '+c[0].p2[1].toFixed(2);
  for(let i=1;i<n;i++){ d+=' L '+c[i].p1[0].toFixed(2)+' '+c[i].p1[1].toFixed(2)
    +' Q '+c[i].cur[0].toFixed(2)+' '+c[i].cur[1].toFixed(2)+' '+c[i].p2[0].toFixed(2)+' '+c[i].p2[1].toFixed(2); }
  d+=' L '+c[0].p1[0].toFixed(2)+' '+c[0].p1[1].toFixed(2)
    +' Q '+c[0].cur[0].toFixed(2)+' '+c[0].cur[1].toFixed(2)+' '+c[0].p2[0].toFixed(2)+' '+c[0].p2[1].toFixed(2)+' Z';
  return d;
}
// Traça o mesmo polígono arredondado num contexto Canvas 2D (sem fill/stroke).
function gRoundPolyPath2D(ctx, points, r){
  if(!points||points.length<3) return;
  const c=_gRoundPolyCorners(points, r||0), n=c.length;
  ctx.beginPath();
  ctx.moveTo(c[0].p2[0], c[0].p2[1]);
  for(let i=1;i<n;i++){ ctx.lineTo(c[i].p1[0], c[i].p1[1]); ctx.quadraticCurveTo(c[i].cur[0], c[i].cur[1], c[i].p2[0], c[i].p2[1]); }
  ctx.lineTo(c[0].p1[0], c[0].p1[1]); ctx.quadraticCurveTo(c[0].cur[0], c[0].cur[1], c[0].p2[0], c[0].p2[1]);
  ctx.closePath();
}
// ── Efeitos de camada (sombra/glow): helpers compartilhados (designer + franqueado) ──
// Offset px a partir de distância + ângulo (convenção Photoshop: luz vem do ângulo,
// sombra cai no oposto). angle padrão 135°. dist em px.
function gFxOffset(dist, angle){
  const a=(angle==null?135:+angle)*Math.PI/180, d=+dist||0;
  return { x: Math.round(-d*Math.cos(a)), y: Math.round(d*Math.sin(a)) };
}
// color (#rrggbb ou rgb/rgba já pronto) + alpha(0..1) → rgba(). Se já vier rgb/rgba, retorna como está.
function gFxRgba(color, a){
  if(!color) return 'rgba(0,0,0,'+(a==null?1:a)+')';
  if(/^rgb/i.test(color)) return color;
  const h=String(color).replace('#',''); if(h.length<6) return color;
  return 'rgba('+parseInt(h.slice(0,2),16)+','+parseInt(h.slice(2,4),16)+','+parseInt(h.slice(4,6),16)+','+(a==null?1:+a).toFixed(2)+')';
}
// ── Gradientes: modelo Luma l.gradient = {type:'linear'|'radial', angle(°: 0=→, 90=↓), stops:[{color,pos:0..1,opacity}]}
// Convenção de ângulo (tela): 0=esquerda→direita, 90=cima→baixo. Compartilhado pelos 3 renderizadores.
function gGradStopsCss(g){
  return (g.stops||[]).map(s=>gFxRgba(s.color, s.opacity!=null?s.opacity:1)+' '+Math.round((s.pos||0)*100)+'%').join(',');
}
function gGradientCss(g){
  if(!g||!g.stops||!g.stops.length) return '';
  if(g.type==='radial') return 'radial-gradient(circle, '+gGradStopsCss(g)+')';
  return 'linear-gradient('+Math.round((g.angle!=null?g.angle:90)+90)+'deg, '+gGradStopsCss(g)+')'; // +90: ângulo de tela → ângulo CSS
}
function gGradientCanvas(ctx, g, x, y, w, h){
  let grad;
  if(g.type==='radial'){ grad=ctx.createRadialGradient(x+w/2,y+h/2,0, x+w/2,y+h/2, Math.max(w,h)/2); }
  else { const a=(g.angle!=null?g.angle:90)*Math.PI/180, cx=x+w/2, cy=y+h/2, dx=Math.cos(a)*w/2, dy=Math.sin(a)*h/2;
    grad=ctx.createLinearGradient(cx-dx,cy-dy,cx+dx,cy+dy); }
  (g.stops||[]).forEach(s=>{ try{ grad.addColorStop(Math.max(0,Math.min(1,s.pos||0)), gFxRgba(s.color, s.opacity!=null?s.opacity:1)); }catch(e){} });
  return grad;
}
function gGradientSvg(g, id){
  const stops=(g.stops||[]).map(s=>{ const c=gFxRgba(s.color,1).replace(/rgba?\(([^)]+)\)/i,(m,p)=>{const a=p.split(',');return 'rgb('+(+a[0])+','+(+a[1])+','+(+a[2])+')';});
    return `<stop offset="${Math.round((s.pos||0)*100)}%" stop-color="${c}" stop-opacity="${s.opacity!=null?s.opacity:1}"/>`; }).join('');
  if(g.type==='radial') return `<radialGradient id="${id}">${stops}</radialGradient>`;
  const a=(g.angle!=null?g.angle:90)*Math.PI/180;
  return `<linearGradient id="${id}" x1="${(0.5-Math.cos(a)/2).toFixed(4)}" y1="${(0.5-Math.sin(a)/2).toFixed(4)}" x2="${(0.5+Math.cos(a)/2).toFixed(4)}" y2="${(0.5+Math.sin(a)/2).toFixed(4)}">${stops}</linearGradient>`;
}
// Empacota um imgUrl para persistência: mantém data URLs PEQUENAS (sobrevivem ao reload)
// e descarta as grandes pra não estourar a quota → '__local__' (com aviso). (Robustez PSD/quota)
const G_IMG_KEEP_MAX = 70 * 1024; // ~70KB de bytes aproximados
function gPackImgUrl(url){
  if(!url || typeof url!=='string' || !url.startsWith('data:')) return {url:url, dropped:false};
  const approxBytes = url.length * 0.75; // base64 → bytes
  if(approxBytes <= G_IMG_KEEP_MAX) return {url:url, dropped:false};
  return {url:'__local__', dropped:true};
}
// Empacota uma MÁSCARA (dataURL alpha) para persistência. Máscaras são downscaladas no
// import do PSD, mas máscaras pintadas à mão (mask.js) podem ser grandes. Diferente de
// imgUrl: NÃO há placeholder '__local__' p/ máscara — se não couber, retorna url:null e o
// caller remove o campo (camada volta sem máscara), em vez de gravar uma referência quebrada.
const G_MASK_KEEP_MAX = 120 * 1024; // alpha PNG comprime bem; teto um pouco maior que imagem
function gPackMask(url){
  if(!url || typeof url!=='string' || !url.startsWith('data:')) return {url:url, dropped:false};
  if(url.length * 0.75 <= G_MASK_KEEP_MAX) return {url:url, dropped:false};
  return {url:null, dropped:true};
}
// Substitui {{nome}} por dados[nome]. onEmpty: 'remove' (default) → ''; 'keep' → mantém o token.
// opts.defaults: mapa {nome:valor} usado quando o dado está vazio (3.3 — defaultValue da var).
function gInterpolate(content, dados, opts){
  opts = opts || {};
  const keep = opts.onEmpty === 'keep';
  const defaults = opts.defaults;
  return String(content==null?'':content).replace(gVarRegex(), (m, name)=>{
    const v = dados ? dados[name] : undefined;
    if(v!=null && v!=='') return String(v);
    const d = defaults ? defaults[name] : undefined;
    if(d!=null && d!=='') return String(d);
    return keep ? m : '';
  });
}
// Mapa {nome:defaultValue} derivado do catálogo dVars (3.3). Usado pelo interpolador.
function gVarDefaults(){
  const m={};
  if(typeof dVars!=='undefined' && dVars){
    dVars.forEach(v=>{ if(v && v.defaultValue!=null && v.defaultValue!=='') m[v.name]=v.defaultValue; });
  }
  return m;
}
// Interpreta um valor como booleano (binding visible / rules). Vazio/0/false/não → falso.
function gTruthy(v){
  if(v==null) return false;
  const s=String(v).trim().toLowerCase();
  return !(s===''||s==='0'||s==='false'||s==='nao'||s==='não'||s==='no'||s==='off');
}
// Resolve o valor de uma variável (dado do franqueado → senão defaultValue).
function gResolveVar(varName, dados, defaults){
  let v = dados ? dados[varName] : undefined;
  if(v==null||v==='') v = defaults ? defaults[varName] : undefined;
  return v;
}
// Aplica bindings de propriedade (4.1): l.bindings = {fill:'corCampanha', visible:'mostrarSelo'}.
// Retorna um clone raso do layer com as props vinculadas resolvidas a partir de `dados`.
// Só deve ser chamado quando há dados (PNG do franqueado / simulação) — no editor sem
// simulação os bindings NÃO se aplicam pra o designer continuar vendo/editando o layer.
function gApplyBindings(layer, dados, opts){
  if(!layer || !layer.bindings) return layer;
  opts = opts || {};
  const defaults = opts.defaults;
  const out = {...layer};
  for(const prop in layer.bindings){
    const varName = layer.bindings[prop];
    if(!varName) continue;
    const val = gResolveVar(varName, dados, defaults);
    if(prop === 'visible'){
      out.visible = gTruthy(val);
    } else if(val != null && val !== ''){
      out[prop] = val;
    }
  }
  return out;
}
// Avalia regras condicionais declarativas (4.2) contra `dados`, ajustando visible/fontSize.
// l.rules = [{when:'empty'|'filled'|'maxLen', var, value?, then:'hide'|'show'|'shrinkFont'}]
// Vive no helper compartilhado — usado por png-generator e pela simulação do designer.
function gApplyRules(layer, dados, opts){
  if(!layer || !layer.rules || !layer.rules.length) return layer;
  opts = opts || {};
  const defaults = opts.defaults;
  let out = layer; // clona só quando uma regra dispara
  layer.rules.forEach(rule=>{
    if(!rule || !rule.var || !rule.then) return;
    const val = gResolveVar(rule.var, dados, defaults);
    const str = String(val==null?'':val);
    let cond = false;
    if(rule.when === 'empty')      cond = (str.trim() === '');
    else if(rule.when === 'filled')cond = (str.trim() !== '');
    else if(rule.when === 'maxLen')cond = (str.length > (parseInt(rule.value,10)||0));
    if(!cond) return;
    if(out === layer) out = {...layer};
    if(rule.then === 'hide')        out.visible = false;
    else if(rule.then === 'show')   out.visible = true;
    else if(rule.then === 'shrinkFont') out.fontSize = Math.max(8, Math.round((out.fontSize||24) * 0.7));
  });
  return out;
}
// true se o content tem ao menos um token {{}} e TODOS resolvem vazio (sem dado nem default).
// Política de var vazia (3.3): nesse caso o layer inteiro não é renderizado — evita rótulo
// órfão tipo "R$" sozinho quando {{precoPor}} fica em branco.
function gAllVarsEmpty(content, dados, defaults){
  let any=false, allEmpty=true;
  String(content==null?'':content).replace(gVarRegex(), (m,name)=>{
    any=true;
    const v=dados?dados[name]:undefined;
    const d=defaults?defaults[name]:undefined;
    if((v!=null&&v!=='')||(d!=null&&d!=='')) allEmpty=false;
    return m;
  });
  return any && allEmpty;
}

/* ══════════════════════════════════════════════════════════════
   CAMPOS (variáveis) — metadados de UI do redesign "Dados"
   O modelo interno (dVars, {{name}}, gInterpolate) NÃO muda. Estas
   constantes só dão nome/ícone/categoria amigáveis pra interface.
══════════════════════════════════════════════════════════════ */
// Categorias dos campos. `id` é gravado em dVars[].category.
const DFIELD_CATS=[
  {id:'produto', label:'Produto',  icon:'🏷'},
  {id:'preco',   label:'Preço',    icon:'💲'},
  {id:'campanha',label:'Campanha', icon:'📣'},
  {id:'midia',   label:'Mídia',    icon:'🖼'},
  {id:'outros',  label:'Outros',   icon:'▫️'},
];
// Metadados de cada tipo: rótulo humano + ícone (nada de "text"/"currency" cru na tela).
const DFIELD_TYPES={
  text:    {label:'Texto',   icon:'🔤'},
  number:  {label:'Número',  icon:'#️⃣'},
  currency:{label:'Preço',   icon:'💲'},
  date:    {label:'Data',    icon:'📅'},
  image:   {label:'Imagem',  icon:'🖼'},
  select:  {label:'Lista',   icon:'☰'},
  color:   {label:'Cor',     icon:'🎨'},
  boolean: {label:'Sim/Não', icon:'🔘'},
};
function gFieldTypeMeta(type){ return DFIELD_TYPES[type] || {label:type||'Texto', icon:'🔤'}; }
function gFieldCatMeta(id){ return DFIELD_CATS.find(c=>c.id===id) || DFIELD_CATS[DFIELD_CATS.length-1]; }

// Infere a categoria de um campo pelo tipo e pelo nome/rótulo (heurística da spec).
function gFieldGuessCategory(name, type){
  const s=String(name||'').toLowerCase();
  if(type==='image') return 'midia';
  if(type==='currency' || type==='number') return 'preco';
  if(/(preco|preço|desconto|valor|cupom|off|frete)/.test(s)) return 'preco';
  if(/(produto|marca|categoria|brinde|sabor|item)/.test(s)) return 'produto';
  if(/(validade|codigo|código|link|regra|campanha|bairro|condic)/.test(s)) return 'campanha';
  return 'outros';
}

// Gera um nome técnico (slug) único a partir do rótulo amigável. Nunca exibido ao usuário.
function gFieldSlugify(label, existingNames){
  let base=String(label||'').normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').toLowerCase();
  if(!base) base='campo';
  if(/^[0-9]/.test(base)) base='c_'+base;
  const taken=new Set((existingNames||[]).map(n=>String(n).toLowerCase()));
  if(!taken.has(base)) return base;
  let i=2; while(taken.has(base+'_'+i)) i++;
  return base+'_'+i;
}
