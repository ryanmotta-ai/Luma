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
window.LUMA_CONFIG = window.LUMA_CONFIG || { geminiApiKey: 'AQ.Ab8RN6KTNTMzdzlSMSzfDFPk9Jx0raAvkQ-HAgUkeVlU1ft4Vw' };
window.LUMA_GEMINI_API_KEY = window.LUMA_GEMINI_API_KEY || 'AQ.Ab8RN6KTNTMzdzlSMSzfDFPk9Jx0raAvkQ-HAgUkeVlU1ft4Vw';
// Modelo dos 2 agentes, em UM lugar só (já divergiu entre chat.js e help-widget.js antes).
// 'gemini-flash-latest' é APELIDO: o Google aponta pro Flash atual, então uma aposentadoria
// de versão não quebra os agentes de novo — foi exatamente o que matou o 'gemini-1.5-flash'.
window.LUMA_GEMINI_MODEL = window.LUMA_GEMINI_MODEL || 'gemini-flash-latest';

/* ── CAMPANHAS ── */
const CAMPS_ATIVAS=[
  {id:'muchplus',name:'Much+ Benefícios',color:'#FFB900',count:4,badge:'',expiraDias:90,popular:true,theme:'muchplus',cover:'assets/covers/muchplus.png',
   previewProd:'CLUBE MUCH+',previewDe:'',previewPor:'MAIS BENEFÍCIOS',
   perguntas:[
    {id:'produto',texto:'Qual benefício exclusivo do Much+ você vai destacar na arte?',sugestoes:['Frete Grátis Ilimitado','Cupom de R$ 15 OFF','Cashback em Dobro','Desconto Exclusivo no Prato']},
    {id:'desconto',texto:'Qual a vantagem especial para o assinante?',sugestoes:['Assinantes não pagam entrega','Exclusivo para membros Much+','Economize em todos os pedidos']},
    {id:'precoPor',texto:'Qual o valor promocional da assinatura ou código do cupom?',sugestoes:['R$ 14,90/mês','Grátis no 1º mês','CUPOM MUCH15','R$ 9,90/mês']},
    {id:'validade',texto:'Qual a validade da oferta Much+?',sugestoes:['Para todos os membros','Válido este mês','Por tempo limitado','Exclusivo do Clube']}
   ]},

  {id:'cdm26',name:'Copa Do Mundo 2026',color:'#1565C0',count:6,badge:'',expiraDias:60,popular:true,cover:'assets/covers/cdm26.png',
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
const FMTS=[{id:'story',name:'Story',dim:'1080×1920'},{id:'feed',name:'Feed',dim:'1080×1350'},{id:'post',name:'Post wide',dim:'1200×628'}];

/* ══════════════════════════════════════════════════════════════
   VARIÁVEIS — fonte de verdade única (3.1)
   UMA regex e UM interpolador, usados por designer (simulação/preview)
   e franqueado (PNG). Nome válido = [a-zA-Z0-9_] (sem espaço/acento).
══════════════════════════════════════════════════════════════ */
function gVarRegex(){ return /\{\{\s*([a-zA-Z0-9_]+)(?::([a-zA-Z0-9_]+))?\s*\}\}/g; }
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
// Caminho Bézier normalizado compartilhado por importador PSD, editor, Canvas final e SVG.
// Modelo: {fillRule:'nonzero'|'evenodd',paths:[{closed,knots:[{in:[x,y],anchor:[x,y],out:[x,y]}]}]}.
// Todas as coordenadas ficam em 0..1 relativas à caixa da layer: redimensionar a forma não
// rasteriza nem deforma o arquivo por depender da resolução original do PSD.
function gVectorPathFillRule(v){ return v&&v.fillRule==='evenodd'?'evenodd':'nonzero'; }
function gVectorPathValid(v){
  if(!v||!Array.isArray(v.paths)||!v.paths.length)return false;
  return v.paths.every(p=>p&&Array.isArray(p.knots)&&p.knots.length>=2&&p.knots.every(k=>{
    const pts=[k.in,k.anchor,k.out];
    return pts.every(a=>Array.isArray(a)&&a.length===2&&Number.isFinite(+a[0])&&Number.isFinite(+a[1]));
  }));
}
function gTraceVectorPath(ctx,v,x,y,w,h){
  if(!ctx||!gVectorPathValid(v))return false;
  const X=n=>(+x||0)+(+n||0)*(+w||0), Y=n=>(+y||0)+(+n||0)*(+h||0);
  ctx.beginPath();
  v.paths.forEach(p=>{
    const k=p.knots, first=k[0];
    ctx.moveTo(X(first.anchor[0]),Y(first.anchor[1]));
    const end=p.closed===false?k.length-1:k.length;
    for(let i=0;i<end;i++){
      const a=k[i],b=k[(i+1)%k.length];
      ctx.bezierCurveTo(X(a.out[0]),Y(a.out[1]),X(b.in[0]),Y(b.in[1]),X(b.anchor[0]),Y(b.anchor[1]));
    }
    if(p.closed!==false)ctx.closePath();
  });
  return true;
}
function gVectorPathD(v,x,y,w,h){
  if(!gVectorPathValid(v))return '';
  const n=a=>Number((+a||0).toFixed(3)), X=a=>n((+x||0)+(+a||0)*(+w||0)), Y=a=>n((+y||0)+(+a||0)*(+h||0));
  return v.paths.map(p=>{
    const k=p.knots, first=k[0]; let d='M '+X(first.anchor[0])+' '+Y(first.anchor[1]);
    const end=p.closed===false?k.length-1:k.length;
    for(let i=0;i<end;i++){
      const a=k[i],b=k[(i+1)%k.length];
      d+=' C '+X(a.out[0])+' '+Y(a.out[1])+' '+X(b.in[0])+' '+Y(b.in[1])+' '+X(b.anchor[0])+' '+Y(b.anchor[1]);
    }
    return d+(p.closed===false?'':' Z');
  }).join(' ');
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
  // Imagem grande → guarda no IndexedDB e persiste só a referência curta 'idb://<chave>'.
  // Sobrevive ao reload (re-hidratada por gHydrateLayers/gHydrateFolders no boot) em vez de
  // virar '__local__' e sumir. Fallback p/ '__local__' só se o IndexedDB não estiver disponível.
  if(typeof gImgHash==='function' && typeof gIdbPut==='function' && typeof indexedDB!=='undefined'){
    try{
      const key = gImgHash(url);
      gIdbPut(key, url); // fire-and-forget: a cópia em memória segue com o dataURL real
      return {url:'idb://'+key, dropped:false};
    }catch(e){ /* cai no fallback abaixo */ }
  }
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
// UUID v4 válido — sempre, em qualquer contexto. crypto.randomUUID só existe em
// contexto seguro (https/localhost); em file:// ou IP de LAN ele é undefined, e um id
// não-uuid (ex.: 't-123') faz o upsert numa PK uuid falhar PARA SEMPRE, em silêncio.
// Por isso o fallback aqui também produz um uuid de formato válido (getRandomValues; e,
// no pior caso, Math.random — não-cripto, mas aceito pela coluna).
function gUuid(){
  try{ if(window.crypto && crypto.randomUUID) return crypto.randomUUID(); }catch(e){}
  try{
    if(window.crypto && crypto.getRandomValues){
      const b=crypto.getRandomValues(new Uint8Array(16));
      b[6]=(b[6]&0x0f)|0x40; b[8]=(b[8]&0x3f)|0x80;
      const h=[]; for(let i=0;i<16;i++) h.push(b[i].toString(16).padStart(2,'0'));
      return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
    }
  }catch(e){}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0; return (c==='x'?r:(r&0x3|0x8)).toString(16);});
}
// Substitui {{nome}} por dados[nome]. onEmpty: 'remove' (default) → ''; 'keep' → mantém o token.
// opts.defaults: mapa {nome:valor} usado quando o dado está vazio (3.3 — defaultValue da var).
function gInterpolate(content, dados, opts){
  opts = opts || {};
  const keep = opts.onEmpty === 'keep';
  const defaults = opts.defaults;
  return String(content==null?'':content).replace(gVarRegex(), (m, name, format)=>{
    let v = dados ? dados[name] : undefined;
    if(v==null || v==='') v = defaults ? defaults[name] : undefined;
    if(v==null || v==='') return keep ? m : '';
    
    // Suporte a split de preços
    if(format === 'inteiro'){
      return gSplitPrice(v).inteiro;
    }
    if(format === 'centavos'){
      return gSplitPrice(v).centavos;
    }
    
    return String(v);
  });
}

// Separa um preço em inteiros e centavos de forma robusta
function gSplitPrice(v) {
  const s = String(v==null?'':v).trim();
  const m = s.match(/(\d+)[.,](\d{2})/);
  if (m) {
    return { inteiro: m[1], centavos: m[2] };
  }
  const num = s.replace(/[^\d]/g, '');
  if (num) {
    return { inteiro: num, centavos: '00' };
  }
  return { inteiro: s, centavos: '' };
}

// Converte um texto contendo split-tokens em runs (trechos ricos) temporários para formatação avançada
function gBuildVirtualRuns(layer, dados, scale, defaults) {
  if (!layer) return null;
  const content = layer.content || '';
  const fontSize = layer.fontSize || 24;
  
  // Só gera se houver tokens de split de preço
  if (!/:\s*(?:inteiro|centavos)/.test(content)) return null;
  
  const re = /(\{\{\s*[a-zA-Z0-9_]+(?::[a-zA-Z0-9_]+)?\s*\}\}|R\$\s*|\$\s*|[,.]|[^${]+)/g;
  let match;
  const runs = [];
  
  while ((match = re.exec(content)) !== null) {
    const part = match[1];
    if (!part) continue;
    
    let isSymbol = /^(?:R\$|\$)\s*$/i.test(part);
    let isComma = /^[.,]$/.test(part);
    let isToken = /^\{\{/.test(part);
    
    let run = {
      text: part,
      font: layer.font,
      fontSize: fontSize,
      color: layer.color,
      letterSpacing: layer.letterSpacing
    };
    
    if (isToken) {
      const tokenMatch = part.match(/\{\{\s*([a-zA-Z0-9_]+)(?::([a-zA-Z0-9_]+))?\s*\}\}/);
      if (tokenMatch) {
        const varName = tokenMatch[1];
        const format = tokenMatch[2];
        
        let val = dados ? dados[varName] : undefined;
        if (val == null || val === '') val = defaults ? defaults[varName] : undefined;
        if (val == null || val === '') {
          val = varName;
        }
        
        const split = gSplitPrice(val);
        if (format === 'inteiro') {
          run.text = split.inteiro;
          run.fontSize = fontSize;
        } else if (format === 'centavos') {
          run.text = split.centavos || '00';
          run.fontSize = Math.round(fontSize * 0.55);
          run.yOffset = -Math.round(fontSize * 0.35); // suspenso ao topo
        } else {
          run.text = String(val);
        }
      }
    } else {
      if (isSymbol) {
        run.fontSize = Math.round(fontSize * 0.55);
        run.yOffset = -Math.round(fontSize * 0.35);
      } else if (isComma) {
        run.fontSize = Math.round(fontSize * 0.55);
        run.yOffset = -Math.round(fontSize * 0.35);
      }
    }
    
    if (run.text) {
      runs.push(run);
    }
  }
  return runs.length > 0 ? runs : null;
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
    // Registra a ativação da regra no tracker global do debugger se definido
    if (typeof window !== 'undefined' && window._dActiveRules) {
      window._dActiveRules.push({
        layerId: layer.id,
        rule: rule
      });
    }
    if(out === layer) out = {...layer};
    if(rule.then === 'hide')        out.visible = false;
    else if(rule.then === 'show')   out.visible = true;
    else if(rule.then === 'shrinkFont') out.fontSize = Math.max(8, Math.round((out.fontSize||24) * 0.7));
    else if(rule.then === 'shiftX') out.x = (out.x || 0) + (parseInt(rule.value,10)||0);
    else if(rule.then === 'shiftY') out.y = (out.y || 0) + (parseInt(rule.value,10)||0);
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
// `svg` = ícone vetorial do painel Campos (herda cor via currentColor);
// `icon` (emoji) mantido por compat com os pickers antigos.
const _gFieldSvg=p=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const DFIELD_TYPES={
  text:    {label:'Texto',   icon:'🔤', svg:_gFieldSvg('<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>')},
  number:  {label:'Número',  icon:'#️⃣', svg:_gFieldSvg('<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>')},
  currency:{label:'Preço',   icon:'💲', svg:_gFieldSvg('<line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>')},
  date:    {label:'Data',    icon:'📅', svg:_gFieldSvg('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>')},
  image:   {label:'Imagem',  icon:'🖼', svg:_gFieldSvg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>')},
  select:  {label:'Lista',   icon:'☰', svg:_gFieldSvg('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>')},
  color:   {label:'Cor',     icon:'🎨', svg:_gFieldSvg('<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>')},
  boolean: {label:'Sim/Não', icon:'🔘', svg:_gFieldSvg('<rect x="2" y="6" width="20" height="12" rx="6"/><circle cx="16" cy="12" r="3"/>')},
};
function gFieldTypeMeta(type){ return DFIELD_TYPES[type] || Object.assign({}, DFIELD_TYPES.text, {label:type||'Texto'}); }
/* REGRA ÚNICA de compatibilidade campo × alvo.
   Um campo de IMAGEM só cabe onde uma foto pode entrar; qualquer outro tipo só em texto.
   Vive aqui porque DOIS lugares perguntam a mesma coisa em vocabulários diferentes — o
   importador de PSD (`it.kind`: text/shape/raster) e a prancheta (`l.type`:
   text/shape/image/frame) — e a regra estava escrita duas vezes, com duas mensagens de recusa
   que divergiriam na primeira mudança. Cada chamador normaliza para 'text' | 'imagem' e
   pergunta aqui; as guardas de contexto (camada travada, base de recorte) ficam com eles.
   @param {object} field  item de dVars
   @param {string} alvo   'text' = mostra texto · 'imagem' = comporta foto · outro = não recebe
   @returns {{ok:boolean, why?:string}} `why` é a mensagem pronta pro usuário (diz o que fazer) */
function gFieldFitCheck(field, alvo){
  if(!field) return {ok:false, why:'Campo não encontrado no catálogo'};
  const rot=field.label||field.name;
  if(field.type==='image'){
    if(alvo!=='imagem') return {ok:false, why:'“'+rot+'” é campo de imagem — use uma imagem, moldura ou forma'};
  } else if(alvo!=='text'){
    return {ok:false, why:'“'+rot+'” é campo de texto — use uma camada de texto'};
  }
  return {ok:true};
}
function gFieldCatMeta(id){ return DFIELD_CATS.find(c=>c.id===id) || DFIELD_CATS[DFIELD_CATS.length-1]; }
// Valor de exemplo p/ exibir um campo no canvas (modo edição, sem simulação ativa).
// Mostra algo realista no lugar do nome do campo em caixa-alta gigante — mesma
// prioridade do card de campo (example → defaultValue), com fallback por tipo.
function gFieldSampleValue(v){
  if(!v) return 'exemplo';
  if(v.example!=null && v.example!=='') return String(v.example);
  if(v.defaultValue!=null && v.defaultValue!=='') return String(v.defaultValue);
  switch(v.type){
    case 'currency': return 'R$ 19,90';
    case 'number':   return '99';
    case 'date':     return '31/12/2026';
    case 'color':    return '#FF9000';
    case 'boolean':  return 'Sim';
    case 'select':   return (Array.isArray(v.options)&&v.options.length)?String(v.options[0]):'Opção';
    default:         return v.label||v.name||'exemplo';
  }
}

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

// Infere o TIPO de um campo pelo nome técnico — o par simétrico de gFieldGuessCategory.
// Existe porque a auto-criação (digitar {{preco_por}} numa camada, via dSyncVarsFromContent)
// nascia sempre 'text': o designer tinha de reabrir o campo e corrigir o tipo na mão, o que
// derrotava o ganho da auto-criação. O sinal do NOME é independente do sinal do TEXTO
// (_dGuessTypeFromText lê "R$ 19,90"); os dois se complementam, nome primeiro.
// A ordem dos testes importa: mídia e cupom vêm antes de preço para não serem capturados
// pela regra ampla de valor ("logo_loja" é imagem; "cupom_desconto" é código, não R$).
function gFieldGuessType(name){
  const s=String(name||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  if(!s) return 'text';
  if(/(^|_)(foto|imagem|img|logo|banner|capa|thumb|arte)($|_)/.test(s)) return 'image';
  if(/(^|_)cupom($|_)/.test(s)) return 'text'; // "MUCH10" é código, não valor monetário
  if(/(^|_)(validade|vencimento|data|inicio|fim)($|_)/.test(s)) return 'date';
  if(/(^|_)cor($|_)/.test(s)) return 'color';
  // Prefixo de flag ANTES da regra ampla de valor: "tem_desconto" é um sim/não, não um R$.
  // O prefixo é sinal mais específico que o substring solto ("desconto" em qualquer posição).
  if(/^(tem|is|ativo|mostrar|exibir|possui)_/.test(s)) return 'boolean';
  if(/(preco|valor|taxa|frete|desconto|cashback)/.test(s)) return 'currency';
  if(/(^|_)(tempo|qtd|quantidade|minutos|prazo|estoque|itens|numero)($|_)/.test(s)) return 'number';
  return 'text';
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

// Mede a largura real de uma camada de texto pós-interpolação
function gMeasureLayerWidth(layer, text, ctxAux) {
  if (!layer || layer.type !== 'text') return layer.w || 0;
  
  // Utiliza um canvas auxiliar para medir a largura do texto com fontes aplicadas
  const canvas = ctxAux ? ctxAux.canvas : document.createElement('canvas');
  const ctx = ctxAux || canvas.getContext('2d');
  
  const fp = (typeof dTextFontParts === 'function') ? dTextFontParts(layer.font) : { family: "'Roboto',sans-serif", weight: 700 };
  const fontSize = layer.fontSize || 24;
  const ital = layer.italic ? 'italic ' : '';
  
  ctx.font = `${ital}${fp.weight} ${fontSize}px ${fp.family}`;
  ctx.letterSpacing = layer.letterSpacing ? (layer.letterSpacing) + 'px' : '0px';
  
  // Se contiver split-tokens, a largura total é a soma das larguras de cada run virtual
  const runs = gBuildVirtualRuns(layer, null, 1, null);
  if (runs && runs.length) {
    let totalW = 0;
    runs.forEach(r => {
      const rFp = (typeof dTextFontParts === 'function') ? dTextFontParts(r.font) : fp;
      ctx.font = `${ital}${rFp.weight} ${r.fontSize}px ${rFp.family}`;
      ctx.letterSpacing = r.letterSpacing ? (r.letterSpacing) + 'px' : '0px';
      totalW += ctx.measureText(r.text || '').width;
    });
    return totalW;
  }
  
  const lines = String(text || '').split('\n');
  let maxW = 0;
  lines.forEach(line => {
    const w = ctx.measureText(line).width;
    if (w > maxW) maxW = w;
  });
  return maxW;
}

// Mede a altura real de uma camada de texto (multilinhas)
function gMeasureLayerHeight(layer, text) {
  if (!layer || layer.type !== 'text') return layer.h || 0;
  const fontSize = layer.fontSize || 24;
  const lineHeight = fontSize * (layer.lineHeight || 1.25);
  const lines = String(text || '').split('\n').filter(l => l.trim() !== '').length;
  return Math.max(1, lines) * lineHeight;
}

/* ══════════════════════════════════════════════════════════════
   ENCAIXE DE TEXTO — a ÚNICA resposta para "como este texto ocupa esta caixa"
   ──────────────────────────────────────────────────────────────
   PROBLEMA QUE ISTO RESOLVE: medir e desenhar eram caminhos separados, e divergiam.
   `gApplyRelativeAnchors` media a altura com `gMeasureLayerHeight`, que conta só as quebras
   MANUAIS (`split('\n')`) — mas o render quebra o texto depois (`gSmartWrapText`) e pode
   encolher a fonte. Resultado: a cascata media 1 linha, empurrava 1 linha, e o render
   desenhava 3. O mecanismo criado para evitar a colisão era quem a entregava.
   Havia mais duas divergências da mesma família: a medida usava `lineHeight` 1.25 e o render
   1.2; e a medida ignorava o tracking extra que o render dá a fonte black (peso ≥900).

   Esta função é o MODELO FIEL das decisões de geometria do render (png-generator.js), e o
   render passou a chamá-la — não existem duas cópias da regra.

   A ESCADA DE ACOMODAÇÃO (a ordem importa, e é a do render):
     1. cabe na caixa?        → devolve como está;
     2. QUEBRA a linha        → `gSmartWrapText` (só caixa de parágrafo tem largura p/ quebrar);
     3. CRESCE para baixo     → quem resolve é a cascata, fora daqui: a caixa fica mais alta e
                                o bloco ancorado abaixo desce (gApplyRelativeAnchors);
     4. só então ENCOLHE      → e nunca abaixo do piso da hierarquia (gStampPisosHierarquia);
     5. nem assim coube       → marca `estourou`. Sem aviso na tela do franqueado (decisão de
                                produto): o Estúdio é que mostra isso antes de publicar.
   AUMENTAR não existe por desenho: a fonte parte do tamanho que o designer deu e só pode
   descer. Crescer além dele inverteria a hierarquia pelo outro lado.
   Encolher pela ALTURA também não: com o layout vivo, passar da altura da caixa é o gatilho
   do passo 3 (empurrar), não de reduzir a fonte — reduzir mataria o crescimento que é a feature.
   ⚠ A caixa-alta é aplicada DEPOIS da quebra porque é o que o render faz hoje. Trocar a
   ordem daria quebras melhores (texto em caixa-alta é mais largo), mas mudaria arte já
   publicada — é decisão de produto, não de refactor.
   @param {object} layer  camada de texto
   @param {string} texto  conteúdo JÁ interpolado (sem {{ }})
   @param {CanvasRenderingContext2D} [ctxAux] canvas de medição reaproveitável
   @param {object} [opts] {escala:1, encolher:true, pisoFonte:null, runs:null}
   @returns {{text,lines,fontSize,letterSpacing,altura,larguraMax,estourou}}
══════════════════════════════════════════════════════════════ */
/* PISO DE ENCOLHIMENTO POR HIERARQUIA.
   O encolhimento resolve o encaixe DESTRUINDO o que ele deveria proteger: o piso é 50% do
   próprio tamanho, isolado, sem olhar ninguém. Um título de 92px vira 46px e fica MENOR que o
   subtítulo de 48px — a peça não "estoura", fica errada em silêncio, que é pior porque
   ninguém percebe para reclamar.
   A hierarquia do template é o conjunto de tamanhos que o designer usou. Uma camada nunca
   encolhe abaixo do degrau imediatamente menor: o título pode chegar a 48, nunca a 46.
   O piso antigo (50%) continua valendo quando ele é MAIS restritivo — um título de 92 com um
   subtítulo de 20 não desce a 20, para em 46.
   Carimbado nos clones por `gApplyRelativeAnchors`, que é quem enxerga a arte inteira; o
   render lê do mesmo clone, então medida e desenho continuam com o mesmo piso. */
function _gLayoutVisivel(l){
  if(!l || l.visible===false)return false;
  const op=Number(l.opacity);
  return l.opacity==null || !Number.isFinite(op) || op>0;
}

function gStampPisosHierarquia(layers, canvas){
  const degraus=[...new Set((layers||[])
    .filter(l => l && l.type==='text' && _gLayoutVisivel(l))
    .map(l => Math.round(l.fontSize||24)))].sort((a,b)=>b-a);
  const ladoCurto=canvas&&canvas.w&&canvas.h?Math.min(canvas.w,canvas.h):0;
  (layers||[]).forEach(l => {
    if(!l || l.type!=='text' || !_gLayoutVisivel(l)) return;
    const s=Math.round(l.fontSize||24);
    const abaixo=degraus.find(t => t < s);
    l._pisoFonte = (abaixo!=null) ? Math.max(abaixo, Math.round(s*0.5)) : null;
    /* O piso de hierarquia impede INVERSÃO, mas sozinho ainda autorizava 8px numa arte de
       1080px. Isso tecnicamente cabe e visualmente falha. O segundo piso é de legibilidade:
       destaque/campo comercial não desce de 2,2% do lado curto; apoio pode chegar a 1,35%.
       Nunca AUMENTA o que o designer desenhou — só limita até onde a automação pode destruir. */
    const sinal=String((l.name||'')+' '+(l.content||'')).toLowerCase();
    const destaque=/(pre[cç]o|valor|produto|t[ií]tulo|oferta|desconto|cupom|cta)/.test(sinal);
    const proporcao=destaque?0.022:0.0135;
    l._pisoLegivel=ladoCurto?Math.min(s,Math.max(8,Math.round(ladoCurto*proporcao))):8;
  });
}

/* Onde a TINTA começa dentro da caixa desenhada.
   O render só encosta o texto no topo da caixa com `vAlign:'top'` (a âncora que vem do PSD).
   Nos demais ele CENTRALIZA verticalmente — e aí um texto mais alto que a caixa transborda
   metade para baixo e metade para CIMA, comendo a margem que o designer deixou no topo.
   Com o layout vivo a regra é: TEXTO NÃO SOBE. Enquanto cabe na caixa segue centralizado
   (é o desenho do designer); quando passa dela, ancora no topo e cresce só para baixo — que é
   justamente o que a corrente sabe absorver. Devolve o topo da caixa → topo da tinta. */
function _gInkDy(l, altura) {
  if (!l || l.type !== 'text') return 0;
  /* No texto vertical, `textAlign` governa o eixo dos caracteres (topo/centro/base). */
  if(l.vertical){
    if(l.textAlign==='center')return ((l.h||0)-(altura||0))/2;
    if(l.textAlign==='right')return (l.h||0)-(altura||0);
    return 0;
  }
  if(l.vAlign === 'top') return 0;
  return Math.max(0, ((l.h || 0) - (altura || 0)) / 2);
}

/* O render precisa ancorar no topo exatamente quando a medida acima decidiu isso — senão
   volta a divergir medida × desenho, que é a raiz de todo este trabalho. */
function _gStampVTop(l, altura) {
  if (!l || l.type !== 'text') return;
  l._vTopAuto = (altura || 0) > (l.h || 0);
}

/* ══ RICH TEXT → HTML: um lugar só ══
   O `<span style="…">` de cada run estava montado em TRÊS cópias (canvas.js ×2, templates.js),
   e as três injetavam os valores de estilo CRUS dentro do atributo. `runs` vem do import de
   PSD — arquivo de fora — então uma cor como `red" onmouseover="…` fechava o atributo e
   pendurava um handler. Comprovado no navegador antes de fechar.
   ⚠ Aqui SANITIZA, não só escapa: número vira número, cor e família passam por allowlist.
   Escapar resolveria o HTML, mas não o CSS (um `url(...)` no meio exfiltra). Três cópias
   também eram o bug: corrigi uma e as outras duas seguiram vulneráveis — daí o motor único. */
function _gCssNum(v, fb){ const n = Number(v); return isFinite(n) && n > 0 ? n : fb; }
function _gCssCor(v){
  const s = String(v == null ? '' : v).trim();
  return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|[a-z]+)$/i.test(s) ? s : 'inherit';
}
function _gCssFam(v){ return String(v == null ? '' : v).replace(/[^\w\s,'\-]/g, '') || 'inherit'; }

/**
 * @param {Array} runs   trechos {text,color,fontSize,font,letterSpacing,yOffset}
 * @param {number} fsBase tamanho de fallback quando o run não traz o próprio
 * @param {function} [escala] (r)=>fontSize final; sem ela usa r.fontSize||fsBase
 * @param {function} [extra]  (r)=>CSS adicional já sanitizado (ex.: o translateY do preço)
 */
function gRichTextHtml(runs, fsBase, escala, extra){
  return (runs || []).map(r => {
    const fp = (typeof dTextFontParts === 'function') ? dTextFontParts(r.font) : {family:'inherit', weight:400};
    const fs = escala ? _gCssNum(escala(r), fsBase) : _gCssNum(r.fontSize, fsBase);
    const ls = _gCssNum(r.letterSpacing, 0);
    const mais = extra ? (extra(r) || '') : '';
    return `<span style="color:${_gCssCor(r.color)};font-size:${fs}px;font-family:${_gCssFam(fp.family)};`
         + `font-weight:${_gCssNum(fp.weight, 400)};${ls ? 'letter-spacing:' + ls + 'px;' : ''}${mais}">`
         + `${gEsc(r.text || '').replace(/\n/g, '<br>')}</span>`;
  }).join('');
}

/* A ENTRELINHA efetiva — um lugar só, lido pela medida e pelo desenho.
   `_entrelinha` é o degrau que a escada aperta ANTES de mexer no tamanho da fonte: designer
   fecha o espaçamento antes de diminuir a letra, porque a hierarquia mora no tamanho. Sem o
   carimbo, devolve exatamente o que o render sempre usou (1.2), então arte de hoje não muda. */
function gLineHeightDe(l) {
  if (!l) return 1.2;
  if (l._entrelinha != null) return l._entrelinha;
  return l.lineHeight || 1.2;
}

/* Onde a TINTA começa dentro da caixa no eixo X — o irmão do `_gInkDy`.
   A caixa de parágrafo tem largura fixa, então a tinta começa onde a caixa começa. Point text
   abraça os glifos e o render o posiciona pelo `textAlign` (`png-generator.js`): centralizado
   cresce para os dois lados, à direita cresce para a esquerda. Sem isto a cascata acha que
   todo texto começa em `l.x`, e um preço centralizado que cresceu "não teria" saído da arte.
   ⚠ Diferente do eixo Y, aqui NÃO se força âncora à esquerda quando o texto passa da caixa:
   centralizar horizontalmente é intenção de desenho, não acidente. */
function _gInkDx(l, largura) {
  if (!l || l.type !== 'text') return 0;
  if(l.vertical)return ((l.w||0)-(largura||0))/2;
  if(l.textBox === 'box') return 0;
  /* `_layoutW/_layoutDx` são a caixa TRANSITÓRIA criada pelo guardião de composição quando
     há um obstáculo à frente do texto (preço, CTA, selo, foto). O template continua intacto;
     só o clone do render ganha um corredor menor. A tinta e o clique precisam usar a mesma
     origem, por isso este deslocamento mora na régua única do retângulo visual. */
  const boxW=(l._layoutW!=null)?l._layoutW:(l.w||0);
  const baseDx=l._layoutDx||0;
  const sobra=boxW-(largura||0);
  if(l.textAlign==='center') return baseDx+sobra/2;
  if(l.textAlign==='right') return baseDx+sobra;
  return baseDx;
}

/* O retângulo que a TINTA ocupa de fato — o que colide, o que sai da prancheta, o que o olho
   vê. Diferente da caixa desenhada sempre que o texto não a preenche (ou passa dela).
   `fit` é o `gFitTextLayer` já resolvido (`l._fit` depois da cascata); sem ele cai na caixa. */
function gInkRect(l, fit) {
  if (!l) return { x:0, y:0, w:0, h:0 };
  const f = fit || l._fit;
  if (l.type !== 'text' || !f) return { x:l.x||0, y:l.y||0, w:l.w||0, h:l.h||0 };
  const alt = f.altura || 0;
  const larg = (l.textBox === 'box'&&!l.vertical) ? (l.w || 0) : (f.larguraMax || 0);
  let x = l.x || 0;
  if(l.textBox!=='box'||l.vertical) x += _gInkDx(l,larg);
  return { x, y: (l.y||0) + _gInkDy(l, alt), w: larg, h: alt };
}

/* ══ PIOR CASO PERMITIDO — o teste de estresse do Estúdio ══
   `maxLen` limita CARACTERE e o layout quebra em PIXEL: a pergunta que o designer não
   consegue responder olhando a prancheta é "com os 32 caracteres que eu mesmo autorizei, esta
   arte ainda fica de pé?". Aqui a resposta é construída — o texto mais longo que o franqueado
   PODE digitar, nunca um caractere a mais.
   Testar além do `maxLen` seria alarme falso (ele não consegue digitar); testar aquém seria
   não testar. Sem `maxLen` no campo, vai a frase inteira — é o que o formulário permite.
   ⚠ Frase realista, não `WWWW…`: a string mais larga possível reprovaria toda arte e o
   designer aprenderia a ignorar o aviso. Precisão acima de recall, como no resto do checklist. */
const G_STRESS_FRASES = {
  produto:   'Super Combo Duplo Mega Burger Artesanal com Batata Frita e Molho Especial da Casa',
  descricao: 'Delicioso blend de carne bovina grelhada no fogo com muito queijo cheddar derretido, alface crespa, tomate fresco colhido no dia e molho secreto.',
  validade:  'Válido de segunda a quinta-feira exceto feriados e vésperas',
  generico:  'Edição especial limitada até durarem os estoques de hoje'
};

function gStressTexto(base, maxLen) {
  const s = String(base || '');
  if (!maxLen || maxLen <= 0) return s;
  let out = s;
  while (out.length < maxLen) out += ' ' + s;   // frase curta demais para o limite: repete
  return out.slice(0, maxLen);                  // corta EXATO no limite, mesmo no meio da palavra
}

function gStressValues(usados, vars, opts) {
  const dados = {};
  (usados || []).forEach(vn => {
    const v = (vars || []).find(x => x && x.name === vn) || { name: vn };
    const tipo = v.type || 'text';
    const maxLen = (v.maxLen > 0) ? v.maxLen : 0;
    if (tipo === 'image') { dados[vn] = (opts && opts.imagem) || ''; return; }
    if (tipo === 'currency') { dados[vn] = gStressTexto('R$ 1.249,00', maxLen); return; }
    if (tipo === 'number')   { dados[vn] = gStressTexto('9.999', maxLen); return; }
    if (tipo === 'boolean')  { dados[vn] = 'Sim'; return; }
    if (tipo === 'date')     { dados[vn] = '31/12/2026'; return; }
    if (tipo === 'color')    { dados[vn] = '#FF9000'; return; }
    if (tipo === 'select' && Array.isArray(v.options) && v.options.length) {
      dados[vn] = v.options.reduce((a, b) => String(b).length > String(a).length ? b : a);
      return;
    }
    const s = (vn + ' ' + (v.label || '')).toLowerCase();
    const frase = /(prod|combo|item|sabor)/.test(s) ? G_STRESS_FRASES.produto
                : /(desc|detalhe|texto|ingred)/.test(s) ? G_STRESS_FRASES.descricao
                : /(valid|data|prazo|regra)/.test(s) ? G_STRESS_FRASES.validade
                : G_STRESS_FRASES.generico;
    dados[vn] = gStressTexto(frase, maxLen);
  });
  return dados;
}

function gFitTextLayer(layer, texto, ctxAux, opts) {
  opts = opts || {};
  const l = layer || {};
  const esc = opts.escala != null ? opts.escala : 1;
  // `_tetoFonte`: teto imposto pela escada quando o empurrão não cabia mais na prancheta.
  // Carimbado no clone por gApplyRelativeAnchors, então medida e render partem do mesmo lugar.
  const _desenhada = (l._tetoFonte != null) ? Math.min(l._tetoFonte, l.fontSize || 24) : (l.fontSize || 24);
  let base = Math.round(_desenhada * esc);
  const vazio = { text:'', lines:[], fontSize:base, letterSpacing:null, altura:0, larguraMax:0, estourou:false };
  if (l.type !== 'text') return vazio;

  let txt = String(texto == null ? '' : texto);
  /* 1) QUEBRA. Normalmente só caixa de parágrafo quebra. `_layoutW` é a exceção transitória:
     quando o texto de ponto cresceu rumo a uma área protegida, o guardião cria uma caixa SÓ
     no clone renderizado. O PSD/template não é reescrito, mas a arte final ganha a linha que
     evita atravessar preço/CTA/foto — exatamente o comportamento esperado pelo franqueado. */
  const ehCaixa = (l.textBox === 'box' || l._layoutW != null);
  const larguraLayout=(l._layoutW!=null)?l._layoutW:(l.w||0);
  // A quebra tem que usar o tamanho EFETIVO. Com o teto da escada, quebrar no tamanho
  // desenhado e desenhar menor gera linha demais (7 onde cabiam 3) — a arte encolhe e cresce
  // em altura ao mesmo tempo, que é o oposto do que a escada quer. Sem teto (`_tetoFonte`
  // nulo), o clone nem existe e o caminho é byte a byte o de hoje.
  let _wrapL = (_desenhada !== (l.fontSize || 24)) ? Object.assign({}, l, { fontSize: _desenhada }) : l;
  if(ehCaixa&&!l.vertical&&typeof gSmartWrapText==='function')txt=gSmartWrapText(txt,larguraLayout,_wrapL,null,null);
  /* Corredor estreito não pode transformar um título em seis linhas. Antes de reduzir por
     colisão, procura o maior tamanho que respeita o teto de linhas do próprio corredor. */
  const maxLinhas=l._layoutMaxLines||0;
  if(maxLinhas && txt.split('\n').filter(s=>s.trim()!=='').length>maxLinhas){
    const pisoBase=Math.max(8,l._pisoLegivel||0,l._pisoFonte||0,Math.round((l.fontSize||24)*0.5));
    let tentativa=_desenhada, melhorTxt=txt, melhorFonte=_desenhada;
    while(tentativa>pisoBase){
      const prox=Math.max(pisoBase,Math.floor(tentativa*0.92));
      if(prox===tentativa) break;
      tentativa=prox;
      _wrapL=Object.assign({},l,{fontSize:tentativa,_tetoFonte:tentativa});
      const candidato=gSmartWrapText(String(texto==null?'':texto),larguraLayout,_wrapL,null,null);
      melhorTxt=candidato; melhorFonte=tentativa;
      if(candidato.split('\n').filter(s=>s.trim()!=='').length<=maxLinhas) break;
    }
    txt=melhorTxt; base=Math.round(melhorFonte*esc);
  }
  const excedeuLinhas=!!(maxLinhas
    &&txt.split('\n').filter(s=>s.trim()!=='').length>maxLinhas);
  // 2) CAIXA-ALTA do PSD (o canvas 2D não tem text-transform)
  if (l.textTransform === 'uppercase') txt = txt.toUpperCase();
  else if (l.textTransform === 'lowercase') txt = txt.toLowerCase();
  const linhas = txt.split('\n').filter(s => s.trim() !== '');
  if (!linhas.length) return Object.assign({}, vazio, { text: txt });

  // 3) MEDIDA com a mesma fonte que o render monta — incluindo o tracking de fonte display,
  //    que o render aplica e a medida antiga esquecia.
  const cv = ctxAux ? ctxAux.canvas : document.createElement('canvas');
  const ctx = ctxAux || cv.getContext('2d');
  const fp = (typeof dTextFontParts === 'function') ? dTextFontParts(l.font)
           : { family:"'Roboto', sans-serif", weight: /black|realce/i.test(l.font||'') ? 900 : 700 };
  const peso = String(l.fontWeightOverride || fp.weight);
  const ital = l.italic ? 'italic ' : '';
  const display = fp.weight >= 900;
  let fs = base;
  let ls = (l.letterSpacing != null)
    ? (l.letterSpacing * esc * (base/Math.max(1,(l.fontSize||24)*esc))) : null;
  const aplicar = () => {
    ctx.font = ital + peso + ' ' + fs + 'px ' + fp.family;
    ctx.letterSpacing = (ls != null) ? (ls + 'px') : (display ? Math.max(0.5, fs * 0.02) + 'px' : '0px');
  };
  /* Preço fracionado usa runs (inteiro grande + centavos menores). Medir a string toda com a
     fonte principal superestimava a tinta em até 44% e fazia o guardião encolher um preço que
     já cabia. Esta régua reproduz o mesmo cálculo do render: soma trechos por linha, honra a
     fonte/tamanho/tracking de cada run e escala todos pelo teto decidido pela hierarquia. */
  const runsMedida=Array.isArray(opts.runs)&&opts.runs.length&&!l.vertical?opts.runs:null;
  const _xf=t=>l.textTransform==='uppercase'?t.toUpperCase():l.textTransform==='lowercase'?t.toLowerCase():t;
  const linhasRuns=runsMedida?[[]]:null;
  if(runsMedida){
    runsMedida.forEach(r=>{
      String(r.text||'').split('\n').forEach((part,pi)=>{
        if(pi>0)linhasRuns.push([]);
        if(part!=='')linhasRuns[linhasRuns.length-1].push(Object.assign({},r,{text:_xf(part)}));
      });
    });
  }
  const medirRuns=()=>{
    const originalEsc=Math.max(1,(l.fontSize||24)*esc);
    const ratio=fs/originalEsc;
    let largura=0,altura=0;
    const textos=[];
    (linhasRuns||[]).forEach(segs=>{
      let wLinha=0,maxFs=segs.length?0:fs;
      let textoLinha='';
      segs.forEach(r=>{
        const rFp=(typeof dTextFontParts==='function')?dTextFontParts(r.font):fp;
        const rFs=Math.max(1,Math.round((r.fontSize||l.fontSize||24)*esc*ratio));
        const rPeso=String(r.fontWeightOverride||rFp.weight);
        ctx.font=ital+rPeso+' '+rFs+'px '+rFp.family;
        const rLs=(r.letterSpacing!=null)?r.letterSpacing*esc*ratio:0;
        ctx.letterSpacing=rLs+'px';
        const parte=String(r.text||'');
        wLinha+=ctx.measureText(parte).width;
        textoLinha+=parte;
        if(rFs>maxFs)maxFs=rFs;
      });
      largura=Math.max(largura,wLinha);
      altura+=maxFs*gLineHeightDe(l);
      textos.push(textoLinha);
    });
    return {largura,altura,linhas:textos.filter(s=>s.trim()!=='')};
  };
  /* Vertical também usa esta régua. Antes a cascata media como texto horizontal e o render
     executava outro auto-fit, por isso o solver e o PNG discordavam justamente nas artes
     orientais/faixas verticais. */
  if(l.vertical){
    const medirVertical=()=>{
      const maxChars=linhas.reduce((m,ln)=>Math.max(m,[...ln].length),0);
      return {altura:maxChars*fs*1.1,largura:linhas.length*fs*1.2};
    };
    let m=medirVertical();
    const boxW=Math.max(1,(l.w||0)*esc),boxH=Math.max(1,(l.h||0)*esc);
    const _pisoBase=(opts.pisoFonte!=null)?opts.pisoFonte
      :Math.max(l._pisoLegivel||0,(l._pisoFonte!=null)?l._pisoFonte:((l.fontSize||24)*0.5));
    const piso=Math.max(8,Math.round(_pisoBase*esc));
    if(opts.encolher!==false&&(m.altura>boxH||m.largura>boxW)){
      const ratio=Math.min(boxH/Math.max(1,m.altura),boxW/Math.max(1,m.largura));
      fs=Math.max(piso,Math.floor(fs*ratio));
      if(ls!=null)ls=l.letterSpacing*esc*(fs/Math.max(1,(l.fontSize||24)*esc));
      m=medirVertical();
    }
    return {text:txt,lines:linhas,fontSize:fs,
      letterSpacing:(ls!=null)?(ls+'px'):null,
      altura:Math.round(m.altura),larguraMax:Math.round(m.largura),
      estourou:m.altura>boxH+1||m.largura>boxW+1};
  }
  const medir = () => {
    if(runsMedida)return medirRuns().largura;
    aplicar(); let m = 0;
    for (const ln of linhas) { const w = ctx.measureText(ln).width; if (w > m) m = w; }
    return m;
  };
  let maxL = medir();

  // 4) ENCOLHER — só caixa, um passo, com piso. O piso padrão é 50% do tamanho desenhado
  //    (regra atual do render); `opts.pisoFonte` existe para a hierarquia virar o piso real.
  const largura = Math.round(larguraLayout * esc);
  const pad = Math.round(fs * 0.08);
  const disp = Math.max(10, largura - pad * 2);
  let estourou = excedeuLinhas;
  if (opts.encolher !== false && ehCaixa && maxL > disp) {
    // Prioridade: piso explícito > piso da hierarquia (carimbado) > o antigo 50% isolado.
    const _pisoBase = (opts.pisoFonte != null) ? opts.pisoFonte
                    : Math.max(l._pisoLegivel||0,
                        (l._pisoFonte != null) ? l._pisoFonte : ((l.fontSize || 24) * 0.5));
    const piso = Math.max(8, Math.round(_pisoBase * esc));
    const ratio = disp / maxL;
    fs = Math.max(piso, Math.floor(fs * ratio));
    if (ls != null) ls = l.letterSpacing * esc * ratio;
    maxL = medir();
    if (maxL > disp) estourou = true;   // chegou no piso e ainda não cabe
  } else if (!ehCaixa && largura > 0 && maxL > largura) {
    estourou = true;                     // point text transborda por desenho; só informa
  }

  // lineHeight 1.2 — o do RENDER. `gMeasureLayerHeight` usava 1.25 e por isso a cascata
  // errava a altura mesmo quando acertava o número de linhas. `gLineHeightDe` é a régua única:
  // se a escada apertou a entrelinha, medida e desenho apertam juntos.
  const medidaRuns=runsMedida?medirRuns():null;
  const lh = fs * gLineHeightDe(l);
  return { text: txt, lines: medidaRuns?medidaRuns.linhas:linhas, fontSize: fs,
    letterSpacing: (ls != null) ? (ls + 'px') : null,
    altura: Math.round(medidaRuns?medidaRuns.altura:lh * linhas.length),
    larguraMax: Math.round(maxL), estourou };
}

/* O interruptor do layout vivo — DOIS em série.
   `franqueado.layout-vivo` (Controle do produto) governa a REDE, para a gestão poder desligar
   sem deploy; `gLayoutVivoOff` é o botão **Auto-layout** da prévia ao vivo, a preferência de
   quem está OLHANDO a arte agora. Essa preferência só mostra a composição original quando ela
   é segura; se o valor real quebrar a arte, o motor mantém a acomodação e protege a exportação.
   NÃO existe chave por template: todo template nasce com o layout vivo ligado (decisão do
   Ryan, 2026-08-06). Não é escolha de design peça a peça, é o comportamento do produto — o
   designer não precisa decidir nada no publicar.
   ⚠ SÓ VALE DO LADO DO FRANQUEADO: prévia ao vivo e PNG baixado, que saem do MESMO motor
   (`fRenderTemplateLayers`) — prévia que mente sobre o arquivo final é o defeito que este
   projeto mais evita. O Estúdio, a prévia do designer e o Simular dados reais mostram a
   geometria DESENHADA: bloco escorregando sob o cursor de quem está posicionando camada é o
   oposto de uma ferramenta de autoria.
   Fail-safe como o resto do Controle do produto — na dúvida, geometria original. */
let gLayoutVivoOff = false;

/* A REDE permite reacomodar? (sem a chave de quem olha)
   É o que decide se o botão da prévia aparece: com a feature desligada na gestão, um botão
   ali seria interruptor ligado em nada. */
function gLayoutVivoDisponivel(){
  /* `render` é propositalmente preservado pelo registro quando uma feature é desligada (a UI
     existente não pode sumir no meio da sessão). Para este interruptor isso significava que a
     gestão NUNCA conseguia desligar o motor. A disponibilidade é capacidade de EXECUTAR. */
  if(typeof gFeatureEnabled === 'function'){
    try{ return gFeatureEnabled('franqueado.layout-vivo') !== false; }catch(e){ return true; }
  }
  if(typeof gFeatureCan === 'function'){
    try{ return gFeatureCan('franqueado.layout-vivo','execute') !== false; }catch(e){ return true; }
  }
  return true;
}

function gLayoutVivoAtivo(){
  return !gLayoutVivoOff && gLayoutVivoDisponivel();
}

/* Contrato do solver para os consumidores do franqueado. A comparação é feita entre dois
   CLONES temporários: a composição original (com âncoras manuais) e a acomodada. Nenhum dos
   carimbos abaixo é persistido no template do designer. */
function gDescribeFranchiseeLayout(original, solved){
  const antes=new Map((original||[]).filter(Boolean).map(l=>[l.id,l]));
  const changes=[];
  const invalidIds=[];
  const quaseIgual=(a,b)=>Math.abs((Number(a)||0)-(Number(b)||0))<0.5;
  (solved||[]).forEach(l=>{
    if(!l)return;
    const o=antes.get(l.id)||{};
    if(l._foraDaArte||l._layoutInvalido||(l._fit&&l._fit.estourou))invalidIds.push(l.id);
    const geometry=!quaseIgual(l.x,o.x)||!quaseIgual(l.y,o.y)
      ||!quaseIgual(l.w,o.w)||!quaseIgual(l.h,o.h);
    const typography=l._layoutW!=null||l._tetoFonte!=null||l._entrelinha!=null;
    if(geometry||typography){
      changes.push({id:l.id,geometry,typography,
        moved:!quaseIgual(l.x,o.x)||!quaseIgual(l.y,o.y),
        resized:!quaseIgual(l.w,o.w)||!quaseIgual(l.h,o.h)});
    }
  });
  const invalid=invalidIds.length>0;
  const adapted=changes.length>0;
  return {status:invalid?'unsafe':(adapted?'adapted':'original'),adapted,invalid,
    requiresAdaptation:adapted||invalid,forced:false,changes,invalidIds};
}

function gHandleLayoutUnsafeError(err){
  if(!err||err.code!=='LUMA_LAYOUT_UNSAFE')return false;
  if(typeof gToast==='function')gToast('Esse texto não cabe com segurança nesta arte. Encurte o conteúdo ou escolha outro material.','error');
  return true;
}

/* ══ CORRENTES INFERIDAS — ler o respiro da arte em vez de pedir ao designer ══
   `relativeAnchor` existe há tempos, mas é marcado camada a camada, à mão — e por isso a
   cascata quase nunca entrava em ação numa arte real. Aqui as correntes saem do próprio
   desenho: bloco alinhado logo abaixo de outro, com espaço de "mesmo grupo", vira filho dele.

   O GAP é a parte sutil. O motor posiciona por `pai.y + pai.altura MEDIDA + gap`, então usar
   a distância visual como gap deslocaria o filho já no estado normal (a caixa do designer é
   quase sempre maior que o texto de uma linha). A régua é a CAIXA DESENHADA: o gap sai da
   geometria publicada (`B.y − (A.y + A.h)`), e a corrente inferida só EMPURRA, nunca puxa
   para cima (`Math.max` com a posição original). Lê-se assim:
     · o texto cabe na caixa que o designer deu  → nada se move, arte idêntica à publicada;
     · o texto passa da caixa                    → o de baixo desce exatamente o excedente.
   Escolhida por ser estável e IGUAL nos dois contextos: não depende de medir um "estado de
   referência" nem do catálogo `dVars`, que pode estar vazio na sessão do franqueado — e
   referência diferente entre Estúdio e franqueado seria a divergência de sempre.

   Só entra quem PODE se mexer: fundo, travada, com posição travada, filha de grupo e grupo
   ficam fora — é assim que logo e selo não são empurrados por texto, e o caminho real para
   isso é TRAVAR a camada.
   ⚠ `layoutRole` ('background'/'protected') é lido aqui e em `core/layout.js`, mas NENHUMA UI
   ou importador o escreve — a varredura pró-1.0 confirmou 6 leituras e zero escritas. Fica
   como reserva para quando existir; hoje quem protege é `locked`/`lockPosition`.
   Âncora explícita do designer SEMPRE vence a inferida. */
function _gCorrenteMovivel(l, cloned){
  if(!l || l.type==='group' || !_gLayoutVisivel(l)) return false;
  if(l.locked || l.lockPosition) return false;
  if(l.layoutRole==='background' || l.layoutRole==='protected') return false;
  /* ⚠ TER PAI NÃO IMOBILIZA. A regra antiga barrava toda camada com `parentId` — o que fazia
     sentido quando grupo só nascia à mão no Estúdio. Desde a importação de PSD com grupos
     (`psd-parse.js`), quase toda camada de arte de agência tem pai, e a regra desligava a
     corrente inferida do template inteiro EM SILÊNCIO: o franqueado digitava um nome longo e
     nada descia. Quem imobiliza é o GRUPO travado/protegido — resolvido por ID a cada consulta,
     porque undo/simulação trocam os objetos por clones e uma referência guardada morreria. */
  let paiId=l.parentId, guarda=0;
  while(paiId && Array.isArray(cloned) && guarda++ < 16){
    const g=cloned.find(x=>x && x.id===paiId);
    if(!g) break;
    if(g.locked || g.lockPosition || g.layoutRole==='background' || g.layoutRole==='protected') return false;
    paiId=g.parentId;
  }
  return true;
}
function _gCorrenteEhFundo(l, cv){
  if(!l) return true;
  if(l.layoutRole==='background') return true;
  const nome=String(l.name||'').trim().toLowerCase();
  if(nome==='background'||nome==='bg'||nome==='fundo') return true;
  if(cv && cv.w && cv.h && l.type==='shape' && (l.x||0)<=1 && (l.y||0)<=1
     && (l.w||0)>=cv.w*0.9 && (l.h||0)>=cv.h*0.9) return true;
  return false;
}
function _gInferirCorrentes(cloned, opts, resolved){
  const cv=(opts&&opts.canvas)||null;
  const _vazio=(l)=>!!(resolved && resolved[l.id] && resolved[l.id].vazio);
  // Candidatos a PAI: qualquer camada visível que não seja o fundo (um fundo de tela cheia
  // "termina" no rodapé e adotaria a arte inteira). Texto que saiu VAZIO também fica fora:
  // ele não ocupa nada na tela, e adotá-lo como pai congelaria o buraco que ele deixou.
  const nós=cloned.filter(l=>l && _gLayoutVisivel(l) && l.type!=='group'
                             && !_gCorrenteEhFundo(l,cv) && !_vazio(l));
  // Faixa que sumiu entre dois blocos: campo opcional que o franqueado deixou em branco (ou
  // que uma regra ocultou). A altura DESENHADA dela é o quanto o de baixo pode subir — e é a
  // única exceção ao "só empurra", porque aqui não se recompõe nada: fecha-se um vão que só
  // existe quando o conteúdo existe.
  const _colapsoEntre=(fundoA, topoB, x1B, x2B)=>{
    let soma=0;
    cloned.forEach(v=>{
      if(!v || v.type==='group' || v.type!=='text') return;
      const some = (v.visible===false) || _vazio(v);
      if(!some) return;
      const t=v.y||0, f=t+(v.h||0);
      if(t < fundoA-2 || f > topoB+2) return;                 // tem que estar ENTRE os dois
      const x1=v.x||0, x2=x1+(v.w||0);
      const cruz=Math.min(x2,x2B)-Math.max(x1,x1B);
      if(cruz/Math.max(1,Math.min(x2-x1, x2B-x1B)) < 0.3) return;   // mesma coluna
      soma += (v.h||0);
    });
    return soma;
  };
  nós.forEach(B=>{
    if(B.relativeAnchor || !_gCorrenteMovivel(B, cloned)) return;   // manual vence; imóvel não entra
    const topoB=B.y||0, x1B=B.x||0, x2B=x1B+(B.w||0);
    let pai=null, fundoPai=-Infinity;
    nós.forEach(A=>{
      if(A===B) return;
      const fundoA=(A.y||0)+(A.h||0);   // a CAIXA desenhada, não a medida
      if(fundoA > topoB + 2) return;                        // tem que estar ACIMA (sem sobrepor)
      // Mesma coluna: as faixas horizontais precisam se cruzar de verdade, senão uma coluna
      // da esquerda viraria pai de outra da direita que só encosta.
      const x1A=A.x||0, x2A=x1A+(A.w||0);
      const cruz=Math.min(x2A,x2B)-Math.max(x1A,x1B);
      const menor=Math.max(1, Math.min(x2A-x1A, x2B-x1B));
      if(cruz/menor < 0.3) return;
      // Perto o bastante para ser o MESMO bloco. Medida na escala tipográfica da própria arte:
      // mais de duas linhas de distância é quebra de seção, não respiro entre irmãos.
      const respiro=topoB-fundoA;
      const linha=Math.max(A.fontSize||0, B.fontSize||0, 16)*1.2;
      if(respiro < -2 || respiro > linha*2) return;
      if(fundoA > fundoPai){ fundoPai=fundoA; pai=A; }       // o vizinho imediato acima
    });
    if(pai){
      // auto:true marca a corrente inferida — é ela que só empurra e nunca puxa.
      // `colapso` é o único crédito de subida: a altura das faixas que sumiram no meio.
      const colapso=_colapsoEntre(fundoPai, topoB, x1B, x2B);
      B._anchorAuto={ type:'top-to-bottom', layerId:pai.id,
                      gap: Math.round(topoB-fundoPai-colapso), auto:true, colapso };
      return;
    }

    /* CORRENTE LATERAL — o mesmo raciocínio deitado.
       Só entra quem não achou pai acima: a leitura manda de cima para baixo, e uma camada com
       dois pais automáticos teria duas verdades. O caso real é "De R$ 149,90 por" ao lado do
       preço: o de trás cresce e passa por cima do da frente.
       Mais exigente que a vertical de propósito — empurrar para o lado tem menos espaço para
       errar do que empurrar para baixo, porque a arte é mais estreita que alta:
       · o pai tem que ser TEXTO (só texto cresce com o que o franqueado digita);
       · sobreposição vertical forte (≥60%), não o roçar de 30% que basta na coluna;
       · o vão até o vizinho não passa de uma linha de texto. */
    let paiL=null, direitaPai=-Infinity;
    const y1B=B.y||0, y2B=y1B+(B.h||0);
    nós.forEach(A=>{
      if(A===B || A.type!=='text') return;
      const direitaA=(A.x||0)+(A.w||0);
      if(direitaA > x1B + 2) return;                          // tem que estar À ESQUERDA
      const y1A=A.y||0, y2A=y1A+(A.h||0);
      const cruz=Math.min(y2A,y2B)-Math.max(y1A,y1B);
      const menor=Math.max(1, Math.min(y2A-y1A, y2B-y1B));
      if(cruz/menor < 0.6) return;                            // mesma LINHA, não só encostando
      const respiro=x1B-direitaA;
      const linha=Math.max(A.fontSize||0, B.fontSize||0, 16)*1.2;
      if(respiro < -2 || respiro > linha) return;
      if(direitaA > direitaPai){ direitaPai=direitaA; paiL=A; }
    });
    if(!paiL) return;
    B._anchorAuto={ type:'left-to-right', layerId:paiL.id, gap: Math.round(x1B-direitaPai), auto:true };
  });
}

/* ══ PLACAS — a forma atrás do texto cresce junto ══
   O padrão "card": retângulo colorido com o preço ou o título em cima. A escada empurrava e
   encolhia o TEXTO, mas nunca a forma que servia de fundo pra ele — e a cor saía debaixo da
   letra (62px de transbordo medidos numa placa de 140px). É dos erros mais visíveis numa arte
   de promo, porque a placa é justamente o que dá contraste ao texto.

   Inferida como as correntes, do próprio desenho, e com regras apertadas para não adotar
   decoração que só por acaso está atrás:
   · só RETÂNGULO — esticar círculo, elipse ou polígono deformaria a forma;
   · tem que estar ATRÁS no z-order (a ordem do array é a ordem de desenho);
   · tem que ENVOLVER a caixa do texto pelos quatro lados;
   · no máximo 6× a área do texto — painel de seção inteira não é placa de um título;
   · UM texto só dentro dela: com dois, crescer por causa de um seria arbitrário;
   · fundo, protegida e travada ficam de fora, como em toda a cascata. */
function _gInferirPlacas(cloned, opts) {
  const cv = (opts && opts.canvas) || null;
  const textos = cloned.filter(l => l && l.type === 'text' && _gLayoutVisivel(l));
  cloned.forEach((p, iP) => {
    if (!p || p.type !== 'shape' || !_gLayoutVisivel(p)) return;
    if (p.shapeKind && p.shapeKind !== 'rect') return;
    if (!_gCorrenteMovivel(p, cloned)) return;
    if (p.layoutRole === 'protected' || _gCorrenteEhFundo(p, cv)) return;
    const px1 = p.x || 0, py1 = p.y || 0, px2 = px1 + (p.w || 0), py2 = py1 + (p.h || 0);
    const dentro = textos.filter(t => {
      if (cloned.indexOf(t) < iP) return false;                 // texto tem que estar NA FRENTE
      // Em PSDs agrupados, placa e texto podem se mover juntos, mas nunca adotamos um texto
      // de outro grupo só porque as caixas coincidem visualmente.
      if ((p.parentId||null)!==(t.parentId||null)) return false;
      const tx1 = t.x || 0, ty1 = t.y || 0;
      return tx1 >= px1 - 1 && ty1 >= py1 - 1
          && tx1 + (t.w || 0) <= px2 + 1 && ty1 + (t.h || 0) <= py2 + 1;
    });
    if (dentro.length !== 1) return;
    const t = dentro[0];
    const areaT = Math.max(1, (t.w || 0) * (t.h || 0));
    if ((p.w || 0) * (p.h || 0) > areaT * 6) return;             // painel, não placa
    p._placa = { alvo: t.id, padTopo: (t.y || 0) - py1,
                 hDesenhada: p.h || 0, yDesenhado: py1,
                 wDesenhada: p.w || 0, xDesenhado: px1 };
  });
}

/* ══ CORREDORES E RESPIRO — o espaço que o texto PODE ocupar ══
   Correntes respondem "quem segue quem"; não respondem "até onde este título pode crescer".
   É por isso que um nome longo ainda atravessava um círculo de preço sem sair da prancheta.

   O contrato vem da composição ORIGINAL: se título e obstáculo não se tocavam, o intervalo
   entre eles vira respiro protegido. Quando o valor real ultrapassa esse corredor, um point
   text ganha uma caixa transitória e pode quebrar linha. Sobreposição que já existia no desenho
   continua intocada (texto sobre placa/foto, selo, decoração). */
function _gLayoutTemCampo(l){
  return !!(l&&l.type==='text'&&(l.isVar||/\{\{/.test(l.content||'')));
}
function _gRectIntersecao(a,b){
  if(!a||!b)return 0;
  const w=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x);
  const h=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);
  return w>0&&h>0?w*h:0;
}
function _gRectContem(a,b,margem){
  margem=margem||0;
  return !!(a&&b&&b.x>=a.x-margem&&b.y>=a.y-margem
    &&b.x+b.w<=a.x+a.w+margem&&b.y+b.h<=a.y+a.h+margem);
}
function _gLayoutMaxLinhas(l){
  const s=String((l&&l.name||'')+' '+(l&&l.content||'')).toLowerCase();
  if(/(pre[cç]o|valor|cupom|c[oó]digo|desconto)/.test(s))return 2;
  if(/(produto|t[ií]tulo|oferta|brinde|sabor|item)/.test(s))return 3;
  return 4;
}
function _gLayoutTextoReferencia(l,defaults,dadosRef){
  if(!l||!_gLayoutTemCampo(l))return l&&l.content||'';
  const dados={};
  const re=typeof gVarRegex==='function'?gVarRegex():/\{\{\s*([a-zA-Z0-9_]+)(?::[a-zA-Z0-9_]+)?\s*\}\}/g;
  let m;
  while((m=re.exec(l.content||''))!==null){
    const nome=m[1];
    const def=(typeof dVars!=='undefined'&&Array.isArray(dVars))?dVars.find(v=>v&&v.name===nome):null;
    const fallback={name:nome,label:nome,type:typeof gFieldGuessType==='function'?gFieldGuessType(nome):'text'};
    dados[nome]=typeof gFieldSampleValue==='function'?gFieldSampleValue(def||fallback):nome;
  }
  if(dadosRef)Object.assign(dadosRef,dados);
  return typeof gInterpolate==='function'?gInterpolate(l.content||'',dados,{defaults,onEmpty:'remove'}):(l.content||'');
}
function _gLayoutBaseVisual(cloned,defaults,ctxAux){
  const out={};
  (cloned||[]).forEach(l=>{
    if(!l)return;
    if(l.type!=='text'){
      out[l.id]={x:l.x||0,y:l.y||0,w:l.w||0,h:l.h||0};return;
    }
    /* Campo dinâmico parte da geometria AUTORADA. Usar texto de amostra de `dVars` fazia a
       referência variar conforme a sessão (e podia declarar uma colisão pequena como intenção
       do designer). O PSD/layer publicado já é o contrato estável do espaço reservado. */
    if(_gLayoutTemCampo(l)){
      out[l.id]={x:l.x||0,y:l.y||0,w:l.w||0,h:l.h||0};return;
    }
    const limpo=Object.assign({},l);
    delete limpo._layoutW;delete limpo._layoutDx;delete limpo._layoutMaxLines;
    delete limpo._tetoFonte;delete limpo._entrelinha;delete limpo._fit;
    delete limpo._vTopAuto;
    const dadosRef={};
    const ref=_gLayoutTextoReferencia(l,defaults,dadosRef);
    const runsRef=(typeof gBuildVirtualRuns==='function'?gBuildVirtualRuns(limpo,dadosRef,1,defaults):null)
      ||(!_gLayoutTemCampo(limpo)?limpo.runs:null)||null;
    const f=gFitTextLayer(limpo,ref,ctxAux,{encolher:false,runs:runsRef});
    const w=limpo.textBox==='box'&&!limpo.vertical?(limpo.w||0):(f.larguraMax||limpo.w||0);
    const x=(limpo.x||0)+((limpo.textBox==='box'&&!limpo.vertical)?0:_gInkDx(limpo,w));
    out[l.id]={x,y:(limpo.y||0)+_gInkDy(limpo,f.altura),w,h:f.altura||limpo.h||0};
  });
  return out;
}
function _gLayoutObstaculo(o,cloned,cv,base){
  if(!o||!_gLayoutVisivel(o)||o.type==='group'||_gCorrenteEhFundo(o,cv))return false;
  if(o.type==='text'||o.type==='image'||o.type==='frame')return true;
  if(o.type!=='shape')return false;
  if(o.locked||o.lockPosition||o.layoutRole==='protected')return true;
  const areaCv=cv&&cv.w&&cv.h?cv.w*cv.h:0;
  if(areaCv&&(o.w||0)*(o.h||0)>=areaCv*0.008)return true;
  const ro=base[o.id];
  return (cloned||[]).some(t=>t&&t.type==='text'&&_gLayoutVisivel(t)&&_gRectContem(ro,base[t.id],2));
}
function _gLayoutRespiro(t,gap,cv){
  const curto=cv&&cv.w&&cv.h?Math.min(cv.w,cv.h):0;
  // 0,8% do lado curto / 18% do corpo: suficiente para a borda continuar respirando mesmo
  // quando o desenho original deixou só um fio de vão.
  const min=Math.max(4,Math.round((t.fontSize||24)*0.18),curto?Math.round(curto*0.008):0);
  const max=Math.max(min,Math.round((t.fontSize||24)*0.48),curto?Math.round(curto*0.02):0);
  return Math.max(min,Math.min(max,Math.max(0,gap)));
}
function _gInferirCorredores(cloned,opts,resolved,base){
  const cv=opts&&opts.canvas||null;
  if(!cv||!cv.w||!cv.h)return [];
  const obstaculos=cloned.filter(o=>_gLayoutObstaculo(o,cloned,cv,base));
  const alterados=[];
  cloned.forEach(t=>{
    if(!_gLayoutTemCampo(t)||!_gLayoutVisivel(t)||t.vertical)return;
    /* Rich text/split de preço tem métricas por run. Ele ainda participa da detecção e da
       redução progressiva, mas não vira caixa de quebra automática: separar um preço entre
       símbolo/inteiro/centavos destruiria o agrupamento semântico. */
    if((t.runs&&t.runs.length)||/:\s*(?:inteiro|centavos)/.test(t.content||''))return;
    const bt=base[t.id],rt=resolved[t.id];
    if(!bt||!rt)return;
    const atual={x:(t.x||0)+(rt.dx||0),y:(t.y||0)+(rt.dy||0),w:rt.w||0,h:rt.h||0};
    const align=t.textAlign||'left';
    let limiteE=0,limiteD=cv.w,achouE=false,achouD=false;
    obstaculos.forEach(o=>{
      if(o===t)return;
      const bo=base[o.id];if(!bo)return;
      // Contenção é relação intencional (texto sobre placa/foto). Sobreposição PARCIAL não dá
      // licença infinita: o corredor preserva no máximo a intrusão que já existia no desenho.
      const inter=_gRectIntersecao(bt,bo);
      if(_gRectContem(bo,bt,2))return;
      const oy=Math.min(atual.y+atual.h,bo.y+bo.h)-Math.max(atual.y,bo.y);
      if(oy/Math.max(1,Math.min(atual.h,bo.h))<0.28)return;
      const gapD=bo.x-(bt.x+bt.w);
      const centroT=bt.x+bt.w/2,centroO=bo.x+bo.w/2;
      if(centroO>centroT&&bo.x>=bt.x){
        const penetracao=Math.max(0,-gapD);
        const lim=bo.x+penetracao-(inter>0?0:_gLayoutRespiro(t,gapD,cv));
        if(lim<limiteD){limiteD=lim;achouD=true;}
      }
      const gapE=bt.x-(bo.x+bo.w);
      if(centroO<centroT&&bo.x+bo.w<=bt.x+bt.w){
        const penetracao=Math.max(0,-gapE);
        const lim=bo.x+bo.w-penetracao+(inter>0?0:_gLayoutRespiro(t,gapE,cv));
        if(lim>limiteE){limiteE=lim;achouE=true;}
      }
    });
    let dx=0,w=0,viola=false;
    if(align==='right'&&achouE){
      const direita=(t.x||0)+(t.w||0);w=direita-limiteE;dx=(t.w||0)-w;
      viola=atual.x<limiteE;
    }else if(align==='center'&&(achouE||achouD)){
      const centro=(t.x||0)+(t.w||0)/2;
      const raio=Math.min(centro-(achouE?limiteE:0),(achouD?limiteD:cv.w)-centro);
      w=Math.max(0,raio*2);dx=((t.w||0)-w)/2;
      viola=atual.x<(centro-w/2)||atual.x+atual.w>(centro+w/2);
    }else if(achouD){
      w=limiteD-(t.x||0);dx=0;viola=atual.x+atual.w>limiteD;
    }
    if(!viola||w<Math.max(24,(t.fontSize||24)*1.8))return;
    t._layoutW=Math.round(w);t._layoutDx=Math.round(dx);t._layoutMaxLines=_gLayoutMaxLinhas(t);
    alterados.push(t);
  });
  return alterados;
}

/**
 * Resolve e atualiza as posições (X e Y) de camadas ancoradas de forma magnética/relativa.
 * @param {object} [opts] {fitText:false, canvas:{w,h}} — com `fitText`, a altura de cada texto
 *        sai do `gFitTextLayer` (quebra + encolhimento REAIS, os mesmos do render) em vez de
 *        contar só as quebras manuais, e as correntes são inferidas do desenho. É o que faz o
 *        bloco de baixo descer o suficiente sem o designer marcar nada.
 */
function gApplyRelativeAnchors(layers, dados, defaults, opts) {
  if (!layers || !layers.length) return layers;
  
  const cloned = layers.map(l => ({...l}));
  const canvasAux = document.createElement('canvas');
  const ctxAux = canvasAux.getContext('2d');
  
  // Com o layout vivo ligado, a medida vem do MESMO encaixe que o render usa: quebra
  // inteligente, caixa-alta e encolhimento. Sem ele, mantém a medida antiga (só quebras
  // manuais) — que é o comportamento que os templates de hoje conhecem.
  const _fit = !!(opts && opts.fitText) && typeof gFitTextLayer === 'function';
  const _medirFit=(l,text)=>gFitTextLayer(l,text,ctxAux,{
    runs:(typeof gBuildVirtualRuns==='function'?gBuildVirtualRuns(l,dados,1,defaults):null)
      ||(!_gLayoutTemCampo(l)?l.runs:null)||null
  });
  // O piso da hierarquia é carimbado ANTES de medir: a medida e o render têm que usar o MESMO
  // piso, e é justamente medir com uma regra e desenhar com outra que originou este trabalho.
  if (_fit) gStampPisosHierarquia(cloned, opts&&opts.canvas);
  const resolved = {};
  cloned.forEach(l => {
    let text = l.content || '';
    if (l.isVar || /\{\{/.test(text)) {
      text = gInterpolate(text, dados, {defaults});
    }
    let w, h;
    if (l.type !== 'text') { w = l.w || 0; h = l.h || 0; }
    else if (_fit) {
      const f = _medirFit(l, text);
      // A caixa de parágrafo tem largura FIXA por definição — quem cresce nela é a altura.
      // Point text abraça os glifos, então a largura medida é a real.
      w = (l.textBox === 'box'&&!l.vertical) ? (l.w || 0) : f.larguraMax;
      h = f.altura;
      // Guarda o encaixe resolvido: a fase seguinte (aviso/escada) lê daqui sem re-medir.
      l._fit = f;
      _gStampVTop(l, f.altura);
    } else {
      w = gMeasureLayerWidth(l, text, ctxAux);
      h = gMeasureLayerHeight(l, text);
    }
    resolved[l.id] = { x: l.x || 0, y: l.y || 0, w, h, visible: _gLayoutVisivel(l),
                       dy: _fit ? _gInkDy(l, h) : 0, dx: _fit ? _gInkDx(l, w) : 0,
                       // Texto que não sobrou nada depois de interpolar: a corrente trata a
                       // faixa dele como inexistente em vez de deixar um buraco na arte.
                       vazio: _fit && l.type === 'text' && !!l._fit && l._fit.altura === 0 };
  });

  /* A composição de referência precisa ser registrada ANTES de criar corredores/âncoras. É
     ela que distingue uma sobreposição intencional (texto dentro de placa) de uma invasão
     causada pelo valor real do franqueado. */
  const baseVisual = _fit ? _gLayoutBaseVisual(cloned, defaults, ctxAux) : {};

  // Correntes inferidas do desenho (só com o layout vivo ligado).
  if (_fit && !(opts && opts.inferir === false)) {
    const restringidos=_gInferirCorredores(cloned,opts,resolved,baseVisual);
    /* O corredor muda a largura disponível e pode transformar point text em duas linhas;
       re-mede agora para a inferência vertical enxergar a altura REAL. */
    restringidos.forEach(l=>{
      let t=l.content||'';
      if(l.isVar||/\{\{/.test(t))t=gInterpolate(t,dados,{defaults});
      const f=_medirFit(l,t);
      l._fit=f;
      resolved[l.id].h=f.altura;
      resolved[l.id].dy=_gInkDy(l,f.altura);
      resolved[l.id].w=f.larguraMax;
      resolved[l.id].dx=_gInkDx(l,f.larguraMax);
      _gStampVTop(l,f.altura);
    });
    _gInferirCorrentes(cloned, opts, resolved);
    _gInferirPlacas(cloned, opts);
  }
  // Posição PUBLICADA de cada camada: a corrente inferida nunca sobe além dela (o laço abaixo
  // muta l.x/l.y a cada iteração, então o original tem que ser guardado antes).
  const yPub = {}, xPub = {};
  cloned.forEach(l => { yPub[l.id] = l.y || 0; xPub[l.id] = l.x || 0; });

  /* ESCADA, passo 4 — encolher quando o empurrão não cabe mais na arte.
     Achado ao medir: `gSmartWrapText` tem fallback de quebra DURA (busca binária em
     `pushToken`), então qualquer texto cabe em qualquer caixa mais larga que um glifo — o
     encolhimento por largura quase nunca dispara. Com o layout vivo, o risco deixa de ser
     "encolheu até sumir" e passa a ser "empurrou para fora da prancheta", que é pior: antes
     os blocos se sobrepunham, agora o de baixo sai da arte.
     Aqui o laço fecha: posiciona → se a corrente estourou o pé da prancheta, reduz a fonte de
     quem CRESCEU além da própria caixa e posiciona de novo. Poucos passos, com piso da
     hierarquia como fundo do poço — encolher é o último recurso, não o primeiro. */
  const _cv = (opts && opts.canvas) || null;
  const _limite = _cv && _cv.h ? _cv.h : 0;
  /* ORDEM DE RESOLUÇÃO: pai antes de filho. Sem isso o laço precisa repassar a lista até
     estabilizar — O(n²) — e numa arte de 40 blocos encadeados isso sozinho passava dos 100ms
     por tecla. Com a ordem certa, UMA passada resolve a corrente inteira.
     A profundidade é calculada uma vez; ciclo (A→B→A) trava na guarda de visitados e cai na
     ordem original, que é o comportamento antigo. */
  const _profundidade = (() => {
    const cache = {};
    let _ciclo = false;   // o ramo que acabou de ser calculado passou por um corte de ciclo?
    const calc = (id, vistos) => {
      if (cache[id] != null) return cache[id];
      if (vistos.has(id)) { _ciclo = true; return 0; }   // ciclo: para aqui
      vistos.add(id);
      const l = cloned.find(x => x.id === id);
      const a = l && (l.relativeAnchor || l._anchorAuto);
      /* ⚠ Profundidade nascida de um corte de ciclo NÃO entra no cache: o 0 do corte contamina a
         cadeia inteira acima dele, e o valor errado seria reusado por qualquer outra corrente que
         só passa por ali. Sem cache o ciclo custa uma recursão a mais e cai na ordem original —
         o comportamento já documentado para este caso. */
      const antes = _ciclo; _ciclo = false;
      const d = (a && a.layerId && resolved[a.layerId]) ? calc(a.layerId, vistos) + 1 : 0;
      if (!_ciclo) cache[id] = d;
      _ciclo = antes || _ciclo;
      return d;
    };
    cloned.forEach(l => calc(l.id, new Set()));
    return cache;
  })();
  const _ordem = cloned.slice().sort((a, b) => (_profundidade[a.id] || 0) - (_profundidade[b.id] || 0));
  // A ordem topológica resolve a corrente em UMA volta. A segunda é a prova de que estabilizou.
  // A terceira só existe quando há PLACA: ela cresce depois que o texto dela se acomodou, e
  // quem está encadeado abaixo precisa de mais uma volta para enxergar a altura nova — sem
  // isso a placa crescia por cima do bloco de baixo. Arte sem placa não paga esse passe.
  const _temPlaca = cloned.some(l => l && l._placa);
  const _voltasPos = _temPlaca ? 3 : 2;
  const _posicionar = () => {
    let mexeu = true, n = 0;
    while (mexeu && n < _voltasPos) {
      mexeu = _seguirPlacas(); n++;    // placa que cresceu conta como movimento: força mais uma volta
      _ordem.forEach(l => {
        const anchor = l.relativeAnchor || l._anchorAuto;
        if (!anchor || !anchor.layerId) return;
        const parent = resolved[anchor.layerId];
        if (!parent) return;
        const gap = parseInt(anchor.gap, 10) || 0;
        let newX = l.x || 0, newY = l.y || 0;
        if (anchor.type === 'left-to-right') {
          if (parent.visible) {
            // Tinta com tinta também deitado: a direita da tinta do pai + respiro, convertido
            // de volta para a esquerda da CAIXA do filho.
            newX = parent.x + (parent.dx || 0) + parent.w + gap - (resolved[l.id].dx || 0);
            if (anchor.auto) newX = Math.max(xPub[l.id] != null ? xPub[l.id] : newX, newX);
          } else { newX = parent.x; }
        } else if (anchor.type === 'top-to-bottom') {
          if (parent.visible) {
            // Encadeia TINTA com TINTA: base da tinta do pai + respiro, convertido de volta
            // para o topo da CAIXA do filho (que é o que o render usa como origem).
            newY = parent.y + (parent.dy || 0) + parent.h + gap - (resolved[l.id].dy || 0);
            // Corrente inferida SÓ EMPURRA — com uma exceção: o `colapso`, que é a altura das
            // faixas que sumiram no meio (campo opcional em branco). Aí o filho pode subir
            // exatamente o vão que deixou de existir, e nada além disso.
            if (anchor.auto) {
              const piso = (yPub[l.id] != null ? yPub[l.id] : newY) - (anchor.colapso || 0);
              newY = Math.max(piso, newY);
            }
          } else { newY = parent.y; }
        }
        const cur = resolved[l.id];
        if (cur.x !== newX || cur.y !== newY) { cur.x = newX; cur.y = newY; l.x = newX; l.y = newY; mexeu = true; }
      });
    }
    _seguirPlacas();
  };
  /* A placa acompanha o texto: gruda no topo dele (que pode ter sido empurrado) e cresce
     EXATAMENTE o que o texto passou da própria caixa. Texto que cabe → placa idêntica à
     desenhada, que é a mesma promessa da corrente.
     Devolve se mexeu, para o laço de posicionamento dar mais uma volta e empurrar quem está
     encadeado abaixo dela. */
  const _seguirPlacas = () => {
    let mexeu = false;
    cloned.forEach(p => {
      if (!p || !p._placa) return;
      const t = cloned.find(x => x.id === p._placa.alvo);
      const rt = t && resolved[t.id];
      if (!t || !rt) return;
      const excedente = Math.max(0, (rt.h || 0) - (t.h || 0));
      const novaY = (t.y || 0) - p._placa.padTopo;
      const novaH = p._placa.hDesenhada + excedente;
      /* LARGURA — o gêmeo horizontal, e ele só existe por causa do point text: caixa de
         parágrafo quebra a linha e nunca passa da própria largura, mas point text cresce para
         o lado (960px de tinta medidos numa placa de 400px). Cresce pelo excedente e SEGUE a
         direção da tinta: texto centralizado abre para os dois lados, à esquerda abre só para
         a direita. Enquanto o texto cabe na caixa dele, a placa fica exatamente a desenhada. */
      const excX = Math.max(0, (rt.w || 0) - (t.w || 0));
      const novaW = p._placa.wDesenhada + excX;
      const novaX = excX > 0
        ? p._placa.xDesenhado + _gInkDx(t, rt.w || 0)   // negativo quando a tinta abre à esquerda
        : p._placa.xDesenhado;
      if (p.y !== novaY || p.h !== novaH || p.x !== novaX || p.w !== novaW) {
        p.y = novaY; p.h = novaH; p.x = novaX; p.w = novaW;
        resolved[p.id].y = novaY; resolved[p.id].h = novaH;
        resolved[p.id].x = novaX; resolved[p.id].w = novaW;
        mexeu = true;
      }
    });
    return mexeu;
  };
  const _largura = _cv && _cv.w ? _cv.w : 0;
  /* Quem CRESCEU além da própria caixa — os únicos que a escada encolhe. Quem sangra pela
     borda por desenho é decisão do designer (o checklist é que cobra isso), não estrago do
     texto do franqueado.
     Nos dois eixos: em altura vale para qualquer texto; em LARGURA só point text entra, porque
     a caixa de parágrafo quebra a linha e nunca passa da própria largura. */
  const _cresceuY = (l) => l && l.type === 'text' && l._fit && l._fit.altura > (l.h || 0) + 1;
  const _cresceuX = (l) => l && l.type === 'text'
                         && (l.vertical||(l.textBox !== 'box'&&l._layoutW == null)) && l._fit
                         && l._fit.larguraMax > (l.w || 0) + 1;
  // Quem escapou da prancheta depois de posicionar — pelo PÉ (empurrado), pelo TOPO (texto
  // centralizado que cresceu para os dois lados) ou pelos LADOS (point text, que não quebra
  // linha: o nome longo do produto simplesmente sai da arte).
  const _escapou = () => {
    if (!_limite && !_largura) return false;
    return cloned.some(l => {
      if (!l || !_gLayoutVisivel(l)) return false;
      const r = resolved[l.id];
      if (!r) return false;
      const encadeada = !!(l.relativeAnchor || l._anchorAuto);
      // Y: quem foi empurrado saiu pelo pé, ou quem cresceu subiu por cima da margem do topo.
      if (_limite && encadeada && (r.y + (r.dy || 0) + (r.h || 0)) > _limite) return true;
      if (_limite && _cresceuY(l)) {
        const y=r.y+(r.dy||0);
        if(y<0||y+(r.h||0)>_limite)return true;
      }
      // X: só quem cresceu de verdade (por texto próprio) ou foi empurrado para o lado.
      if (_largura && (_cresceuX(l) || encadeada)) {
        const x = r.x + (r.dx || 0);
        if (_cresceuX(l) && (x < 0 || x + (r.w || 0) > _largura)) return true;
        if (encadeada && x + (r.w || 0) > _largura) return true;
      }
      return false;
    });
  };
  /* Colisão INTERNA é falha de composição mesmo que tudo ainda esteja dentro do canvas.
     Compara a tinta resolvida com obstáculos relevantes e preserva as relações que já
     existiam na arte de referência (texto sobre placa, selo, imagem de fundo etc.). */
  const _obstaculosLayout=(_fit&&_cv)
    ?cloned.filter(o=>_gLayoutObstaculo(o,cloned,_cv,baseVisual)):[];
  const _colisoesInternas = () => {
    if(!_fit||!_cv)return [];
    const out=[];
    cloned.forEach(t=>{
      if(!_gLayoutTemCampo(t)||!_gLayoutVisivel(t))return;
      const rt=resolved[t.id],bt=baseVisual[t.id];
      if(!rt||!bt||!rt.h||!rt.w)return;
      const tinta={x:rt.x+(rt.dx||0),y:rt.y+(rt.dy||0),w:rt.w,h:rt.h};
      const deltaT=Math.max(0,tinta.w-bt.w)+Math.max(0,tinta.h-bt.h)
        +Math.abs(tinta.x-bt.x)+Math.abs(tinta.y-bt.y);
      /* O campo que não cresceu nem foi movido é a VÍTIMA, não o culpado. Sem isto dois
         campos dinâmicos que se tocassem faziam o preço pequeno ceder antes do título longo. */
      if(deltaT<=1)return;
      _obstaculosLayout.forEach(o=>{
        if(o===t)return;
        const bo=baseVisual[o.id],ro=resolved[o.id];
        if(!bo||!ro)return;
        const interBase=_gRectIntersecao(bt,bo);
        if(_gRectContem(bo,bt,2))return;
        const atualO={x:ro.x+(o.type==='text'?(ro.dx||0):0),
          y:ro.y+(o.type==='text'?(ro.dy||0):0),w:ro.w,h:ro.h};
        if(_gLayoutTemCampo(o)){
          const deltaO=Math.max(0,atualO.w-bo.w)+Math.max(0,atualO.h-bo.h)
            +Math.abs(atualO.x-bo.x)+Math.abs(atualO.y-bo.y);
          if(deltaO>deltaT+1)return;
        }
        /* Sobreposição parcial do original é uma franquia LIMITADA, não imunidade eterna.
           Crescer além da área que o designer publicou vira colisão. */
        if(interBase>0){
          const tolerancia=Math.max(2,Math.min(bt.w*bt.h,bo.w*bo.h)*0.005);
          if(_gRectIntersecao(tinta,atualO)>interBase+tolerancia)
            out.push({culpado:t,obstaculo:o});
          return;
        }
        const gaps=[];
        if(bt.x+bt.w<=bo.x)gaps.push(bo.x-(bt.x+bt.w));
        if(bo.x+bo.w<=bt.x)gaps.push(bt.x-(bo.x+bo.w));
        if(bt.y+bt.h<=bo.y)gaps.push(bo.y-(bt.y+bt.h));
        if(bo.y+bo.h<=bt.y)gaps.push(bt.y-(bo.y+bo.h));
        const gapBase=gaps.length?Math.min(...gaps):0;
        /* Campo que cresceu respeita um respiro mínimo mesmo se o original tinha um vão quase
           nulo. Isso não redesenha o estado normal: esta checagem só roda quando `deltaT>1`. */
        const pad=_gLayoutRespiro(t,gapBase,_cv);
        const protegido={x:atualO.x-pad,y:atualO.y-pad,w:atualO.w+pad*2,h:atualO.h+pad*2};
        if(_gRectIntersecao(tinta,protegido)>1)out.push({culpado:t,obstaculo:o});
      });
    });
    return out;
  };
  let _ultimasColisoes=[];
  const _violaComposicao=()=>{
    _ultimasColisoes=_colisoesInternas();
    return _escapou()||_ultimasColisoes.length>0;
  };
  // Re-mede SÓ quem mudou. Antes remedia todas as camadas a cada volta, e uma arte pesada
  // custava 116ms por tecla — acima do debounce de 110ms da digitação.
  const _remedir = (lista) => {
    lista.forEach(l => {
      let t = l.content || '';
      if (l.isVar || /\{\{/.test(t)) t = gInterpolate(t, dados, { defaults });
      const f = _medirFit(l, t);
      l._fit = f;
      resolved[l.id].h = f.altura;
      resolved[l.id].dy = _gInkDy(l, f.altura);
      _gStampVTop(l, f.altura);
      if (l.textBox !== 'box'||l.vertical) {
        resolved[l.id].w = f.larguraMax;
        resolved[l.id].dx = _gInkDx(l, f.larguraMax);
      }
    });
  };
  // A base é sempre a posição PUBLICADA: reposicionar sobre o resultado anterior acumularia
  // empurrão em cima de empurrão a cada volta do laço.
  const _reposicionarDoZero = () => {
    cloned.forEach(l => {
      l.y = yPub[l.id]; resolved[l.id].y = yPub[l.id];
      l.x = xPub[l.id]; resolved[l.id].x = xPub[l.id];
    });
    _posicionar();
  };
  if (_fit && (_limite || _largura)) {
    _posicionar();
    let tentativas = 0;
    // Quando todo mundo chega ao piso da hierarquia e AINDA não cabe, a peça inteira passa a
    // reduzir na mesma escala. Assim recupera espaço sem transformar título em texto de apoio.
    let relaxou = false;
    // Teto de voltas: ~9 passos levam um degrau do tamanho desenhado ao piso; 32 cobrem dois
    // degraus + a escala proporcional final. Acima disso a composição já é impossível e
    // continuar medindo só congela a digitação sem produzir uma solução diferente.
    while (_violaComposicao() && tentativas < 32) {
      tentativas++;
      // Colisão aponta o texto exato; fuga usa quem cresceu/empurrou como antes.
      const idsColisao=new Set(_ultimasColisoes.map(c=>c.culpado.id));
      const culpados = cloned.filter(l => idsColisao.has(l.id)||_cresceuY(l)||_cresceuX(l));
      if (!culpados.length) break;

      /* DEGRAU ANTERIOR AO ENCOLHIMENTO: apertar a ENTRELINHA.
         Designer não sai reduzindo a letra — primeiro fecha o espaçamento, porque a hierarquia
         mora no TAMANHO da fonte e não no respiro entre linhas. De 1.2 para 1.05 são ~12% de
         altura recuperada com a tipografia intacta. Só vale para quem tem mais de uma linha
         (em texto de uma linha a entrelinha não ocupa nada) e para de mexer no piso de 1.05,
         onde as linhas começam a se tocar. */
      /* Calculada, não tateada: a entrelinha que faria a tinta caber na caixa é
         `altura / (fonte × linhas)`. Uma conta, um passo, uma re-medida — tatear de 0.05 em
         0.05 custava três voltas de re-medida em toda a arte (144ms a mais numa peça pesada)
         e chegava no mesmo lugar. Piso 1.05: abaixo disso as linhas começam a se tocar. */
      const _entrelinhaAlvo = (l) => {
        const fs = (l._tetoFonte != null) ? l._tetoFonte : (l.fontSize || 24);
        const n = l._fit.lines.length;
        const alvo = (l.h || 0) / Math.max(1, fs * n);
        return Math.max(1.05, Math.min(gLineHeightDe(l), Math.round(alvo * 1000) / 1000));
      };
      /* ⚠ SÓ ENTRA QUEM A CONTA REALMENTE APERTA. Um texto que virou culpado por COLISÃO sem ter
         crescido (foi só empurrado) e cuja caixa é folgada devolve um alvo ACIMA da entrelinha
         atual — o clamp preserva o valor, nada muda, e o `continue` abaixo repetia o mesmo estado
         até esgotar as 32 voltas: re-medida e reposicionamento inteiros por volta, sem nunca
         chegar ao degrau de encolher a fonte. Sem esta guarda a colisão saía não resolvida. */
      const _apertaveis = culpados.filter(l => l._fit && l._fit.lines.length > 1
                                            && gLineHeightDe(l) > 1.06
                                            && _entrelinhaAlvo(l) < gLineHeightDe(l) - 0.001);
      if (_apertaveis.length) {
        _apertaveis.forEach(l => { l._entrelinha = _entrelinhaAlvo(l); });
        _remedir(_apertaveis);
        _reposicionarDoZero();
        continue;                       // só encolhe fonte quando a entrelinha já deu o que tinha
      }
      /* QUEM CEDE PRIMEIRO — por ORDEM, não por ritmo.
         Antes todos caíam 8% por volta e o resultado era o avesso do desejado: o TÍTULO ia ao
         piso enquanto o regulamento jurídico parava um degrau antes. Pesar o passo não
         resolveu — rodando em paralelo, o maior tem mais o que ceder e chega ao fundo do mesmo
         jeito. O tamanho que o designer deu é a declaração de importância dele, então quem
         encolhe é o MENOR degrau que ainda tem folga, sozinho, até acabar a folga dele. O
         título só é tocado quando o resto da arte já cedeu tudo. */
      const _pisoAbsDe=(l)=>Math.max(8,l._pisoLegivel||0,Math.round((l.fontSize||24)*0.5));
      const _pisoDe = (l) => (l._pisoFonte != null)
        ?Math.max(l._pisoFonte,_pisoAbsDe(l)):_pisoAbsDe(l);
      const _atual = (l) => (l._tetoFonte != null) ? l._tetoFonte : (l.fontSize || 24);

      /* Se a hierarquia inteira ficou sem folga e a composição ainda viola uma área segura,
         o último recurso é diminuir TUDO pela mesma escala — nunca continuar reduzindo só o
         título até ele ficar menor que o preço. O fator nasce do degrau mais reduzido e só
         desce; nenhuma camada volta a crescer. */
      if(relaxou){
        /* O último degrau preserva a proporção só do COMPONENTE afetado. Reduzir toda a arte
           fazia rodapé, título remoto e preço encolherem por uma colisão local. */
        const ids=new Set(culpados.map(l=>l.id));
        let expandiu=true;
        while(expandiu){
          expandiu=false;
          _ultimasColisoes.forEach(c=>{
            if(ids.has(c.culpado.id)||ids.has(c.obstaculo.id)){
              [c.culpado.id,c.obstaculo.id].forEach(id=>{if(!ids.has(id)){ids.add(id);expandiu=true;}});
            }
          });
          cloned.forEach(l=>{
            const a=l&&(l.relativeAnchor||l._anchorAuto);
            if(a&&a.layerId&&(ids.has(l.id)||ids.has(a.layerId))){
              [l.id,a.layerId].forEach(id=>{if(!ids.has(id)){ids.add(id);expandiu=true;}});
            }
            if(l&&l._placa&&(ids.has(l.id)||ids.has(l._placa.alvo))){
              [l.id,l._placa.alvo].forEach(id=>{if(!ids.has(id)){ids.add(id);expandiu=true;}});
            }
          });
        }
        const textosComponente=cloned.filter(l=>l&&l.type==='text'&&_gLayoutVisivel(l)&&ids.has(l.id));
        const escalaAtual=Math.min(...textosComponente.map(l=>_atual(l)/Math.max(1,l.fontSize||24)));
        const escalaGlobal=Math.max(0.5,escalaAtual*0.92);
        const grupo=[];
        textosComponente.forEach(l=>{
          const alvo=Math.max(_pisoAbsDe(l),Math.floor((l.fontSize||24)*escalaGlobal));
          if(alvo<_atual(l)){l._tetoFonte=alvo;grupo.push(l);}
        });
        if(!grupo.length)break;
        _remedir(grupo);
        _reposicionarDoZero();
        continue;
      }
      const comFolga = culpados.filter(l => Math.floor(_atual(l) * 0.92) < _atual(l)
                                         && _atual(l) > _pisoDe(l));
      const menor = comFolga.length
        ? Math.min(...comFolga.map(l => Math.round(l.fontSize || 24))) : null;
      const mexidos = [];
      comFolga.forEach(l => {
        if (Math.round(l.fontSize || 24) !== menor) return;   // só o degrau da vez
        const novo = Math.max(_pisoDe(l), Math.floor(_atual(l) * 0.92));
        if (novo < _atual(l)) { l._tetoFonte = novo; mexidos.push(l); }
      });
      // Todo mundo no piso da hierarquia: entra uma vez na escala global proporcional.
      if (!mexidos.length && !relaxou) { relaxou = true; continue; }
      if (!mexidos.length) break;   // no piso absoluto: não há mais o que ceder
      _remedir(mexidos);
      _reposicionarDoZero();
    }
    /* O QUE SOBROU FORA DA ARTE. A escada tem limite; quando ela desiste, alguém precisa
       saber. Sem isto o `estourou` do encaixe dizia `false` numa peça com o preço 181px fora
       da prancheta, e nenhum consumidor a jusante tinha como perceber. */
    if (_escapou()) {
      cloned.forEach(l => {
        const r = resolved[l.id];
        if (!r || !_gLayoutVisivel(l)) return;
        const y1 = r.y + (r.dy || 0), y2 = y1 + (r.h || 0);
        const x1 = r.x + (r.dx || 0), x2 = x1 + (r.w || 0);
        const fora = (_limite && (y1 < -2 || y2 > _limite + 2))
                  || (_largura && (x1 < -2 || x2 > _largura + 2));
        if (fora) l._foraDaArte = true;
      });
    }
    /* Se nem quebra, entrelinha e redução resolveram sem violar os pisos, o material não é
       silenciosamente aprovado: o checklist/publicação recebe a marca de composição inválida. */
    const restantes=_colisoesInternas();
    restantes.forEach(c=>{ c.culpado._layoutInvalido=true; });
    return cloned;
  }

  const maxIter = cloned.length;
  let changed = true;
  let iter = 0;
  
  while (changed && iter < maxIter) {
    changed = false;
    iter++;
    
    cloned.forEach(l => {
      // A âncora MANUAL do designer sempre vence a inferida — ele desenhou por um motivo.
      const anchor = l.relativeAnchor || l._anchorAuto;
      if (!anchor || !anchor.layerId) return;
      
      const parent = resolved[anchor.layerId];
      if (!parent) return;
      
      const gap = parseInt(anchor.gap, 10) || 0;
      let newX = l.x || 0;
      let newY = l.y || 0;
      
      if (anchor.type === 'left-to-right') {
        if (parent.visible) {
          newX = parent.x + parent.w + gap;
        } else {
          newX = parent.x; // pula elemento invisível
        }
      } else if (anchor.type === 'top-to-bottom') {
        if (parent.visible) {
          newY = parent.y + parent.h + gap;
          // Corrente inferida SÓ EMPURRA: se o texto do pai coube na caixa dele, o filho fica
          // onde o designer pôs. Puxar para cima recomporia uma arte que ninguém desenhou.
          if (anchor.auto) newY = Math.max(yPub[l.id] != null ? yPub[l.id] : newY, newY);
        } else {
          newY = parent.y; // pula elemento invisível
        }
      }
      
      const current = resolved[l.id];
      if (current.x !== newX || current.y !== newY) {
        current.x = newX;
        current.y = newY;
        l.x = newX;
        l.y = newY;
        changed = true;
      }
    });
  }
  
  return cloned;
}

// Lista de conectores curtos gramaticais (preposições, conjunções, artigos) em PT e EN
const G_CONNECTORS = new Set([
  'de', 'do', 'da', 'dos', 'das',
  'e', 'ou', 'com', 'sem', 'para',
  'em', 'no', 'na', 'nos', 'nas',
  'por', 'pelo', 'pela', 'pelos', 'pelas',
  'um', 'uma', 'uns', 'umas',
  'o', 'a', 'os', 'as',
  'ao', 'aos',
  'of', 'and', 'or', 'with', 'without', 'for', 'in', 'at', 'on', 'by', 'a', 'an', 'the'
]);

// Quebra de linha inteligente baseada em pontuação de desequilíbrio e limites gramaticais (Knuth-Plass adaptado)
function gSmartWrapText(text, maxW, layer, dados, defaults) {
  if (!text || typeof text !== 'string') return text;
  
  // Preserva cada quebra manual, mas ainda protege CADA trecho. Antes uma única quebra feita
  // no PSD desligava todo o wrapping e uma linha longa atravessava as camadas vizinhas.
  if (text.includes('\n')) return text.split('\n')
    .map(parte=>parte?gSmartWrapText(parte,maxW,layer,dados,defaults):'').join('\n');
  
  // Limpa espaços redundantes
  const cleanText = text.replace(/\s+/g, ' ').trim();
  const words = cleanText.split(' ');
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const medidas = new Map();
  
  // Medição exata da largura de cada linha usando as métricas da própria camada
  const measure = (str) => {
    // Limpa tags de template temporárias (__VAR_START_...__) para obter medição física exata de pixels no editor
    const cleanStr = str.replace(/__VAR_START_[a-zA-Z0-9_]+__/g, '').replace(/__VAR_END__/g, '');
    if(medidas.has(cleanStr))return medidas.get(cleanStr);
    const largura=gMeasureLayerWidth(layer, cleanStr, ctx);
    medidas.set(cleanStr,largura);
    return largura;
  };
  
  const padding = Math.round((layer.fontSize || 24) * 0.08);
  const availableW = Math.max(10, maxW - padding * 2);
  
  // 1. Testa se cabe inteiro em 1 única linha
  const fullW = measure(cleanText);
  if (fullW <= availableW) {
    return cleanText;
  }
  
  let bestPartition = null;
  let bestScore = Infinity;
  
  // Testa partições em N = 2 e N = 3 linhas. Acima de 12 palavras vai direto ao encaixe
  // guloso: avaliar equilíbrio editorial de uma frase desse tamanho custa mais que desenhá-la.
  for (let n = 2; n <= 3 && words.length <= 12; n++) {
    if (words.length < n) continue;
    
    const partitions = [];
    /* Até 8 palavras, preserva a busca exaustiva que dá a quebra editorial mais bonita.
       Acima disso, combinações de 3 linhas crescem ao quadrado e uma entrada de 40 palavras
       congelava a prévia por 12s. Textos longos avaliam apenas cortes próximos das frações
       naturais (1/2 ou 1/3 + 2/3); se nenhum couber, o fallback guloso abaixo continua sendo
       a prova final de encaixe. O resultado segue determinístico com custo limitado. */
    if(words.length<=8){
      const getPartitions = (arr, partsLeft, currentPart) => {
        if (partsLeft === 1) { partitions.push(currentPart.concat([arr])); return; }
        for (let i = 1; i <= arr.length - partsLeft + 1; i++) {
          getPartitions(arr.slice(i), partsLeft - 1, currentPart.concat([arr.slice(0, i)]));
        }
      };
      getPartitions(words, n, []);
    }else if(n===2){
      const meio=Math.round(words.length/2);
      for(let c=Math.max(1,meio-2);c<=Math.min(words.length-1,meio+2);c++){
        partitions.push([words.slice(0,c),words.slice(c)]);
      }
    }else{
      const a=Math.round(words.length/3),b=Math.round(words.length*2/3);
      for(let c1=Math.max(1,a-1);c1<=Math.min(words.length-2,a+1);c1++){
        for(let c2=Math.max(c1+1,b-1);c2<=Math.min(words.length-1,b+1);c2++){
          partitions.push([words.slice(0,c1),words.slice(c1,c2),words.slice(c2)]);
        }
      }
    }
    
    // Avalia cada partição candidata
    partitions.forEach(part => {
      const lines = part.map(p => p.join(' '));
      const widths = lines.map(measure);
      
      let overflowScore = 0;
      let grammarScore = 0;
      let orphanScore = 0;
      
      widths.forEach((w, idx) => {
        // Penalidade severa por estourar a largura da caixa do designer
        if (w > availableW) {
          overflowScore += (w - availableW) * 150 + 20000;
        }
        
        // Penalidade por terminar linha com preposição/conjunção (quebra gramatical feia)
        if (idx < lines.length - 1) {
          const lineWords = part[idx];
          const lastWord = lineWords[lineWords.length - 1].toLowerCase().replace(/[.,!?;:]/g, '');
          if (G_CONNECTORS.has(lastWord)) {
            grammarScore += 350;
          }
        }
      });
      
      // Penalidade por palavra órfã muito curta na última linha
      const lastLineWords = part[part.length - 1];
      if (lastLineWords.length === 1) {
        const lastWord = lastLineWords[0];
        if (lastWord.length < 4) {
          orphanScore += 400;
        }
      }
      
      // Desequilíbrio entre larguras (procura simetria visual entre as linhas)
      const maxWLine = Math.max(...widths);
      const minWLine = Math.min(...widths);
      const unbalanceScore = (maxWLine - minWLine) * 2.5;
      
      const totalScore = overflowScore + grammarScore + orphanScore + unbalanceScore;
      
      if (totalScore < bestScore) {
        bestScore = totalScore;
        bestPartition = lines;
      }
    });
    
    // Se a melhor partição em N linhas couber 100% sem estourar os limites de pixel, para nela
    if (bestScore < 15000) {
      break;
    }
  }
  
  if (bestPartition && bestPartition.every(line => measure(line) <= availableW)) {
    return bestPartition.join('\n');
  }

  const wrapped = [];
  let current = '';
  const pushToken = (token) => {
    let rest = (typeof Intl!=='undefined'&&Intl.Segmenter)
      ?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(token)].map(x=>x.segment)
      :[...token];
    while (rest.length && measure(rest.join('')) > availableW) {
      let low = 1, high = rest.length, fit = 1;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (measure(rest.slice(0, mid).join('')) <= availableW) { fit = mid; low = mid + 1; }
        else high = mid - 1;
      }
      wrapped.push(rest.slice(0, fit).join(''));
      rest = rest.slice(fit);
    }
    return rest.join('');
  };
  words.forEach(word => {
    const next = current ? current + ' ' + word : word;
    if (current && measure(next) > availableW) {
      wrapped.push(current);
      current = pushToken(word);
    } else if (!current && measure(word) > availableW) {
      current = pushToken(word);
    } else {
      current = next;
    }
  });
  if (current) wrapped.push(current);
  return wrapped.join('\n');
}

// Converte strings para Title Case Gramatical (Capitalização Semântica - Ideia 2)
function gSmartTitleCase(str) {
  if (!str || typeof str !== 'string') return str;
  
  // Limpa espaços redundantes
  const cleaned = str.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  
  // Só higieniza se o texto estiver 100% gritando em maiúsculas ou 100% em minúsculas.
  // Preserva capitalizações mistas intencionais de marcas (ex: "Big Mac", "Coca-Cola Zero").
  const isAllUpper = (cleaned === cleaned.toUpperCase());
  const isAllLower = (cleaned === cleaned.toLowerCase());
  if (!isAllUpper && !isAllLower) return cleaned;
  
  const words = cleaned.split(' ');
  const formatted = words.map((w, idx) => {
    if (!w) return '';
    
    // Remove pontuação para testar o conector
    const wordClean = w.toLowerCase().replace(/[.,!?;:]/g, '');
    const hasPunctuation = w.length > wordClean.length;
    const punctuation = hasPunctuation ? w.slice(wordClean.length) : '';
    
    // Primeira palavra sempre é capitalizada. Demais palavras respeitam conectores curtos.
    if (idx === 0 || !G_CONNECTORS.has(wordClean)) {
      // Capitaliza a primeira letra, lidando com hifens (ex: "terça-feira" -> "Terça-feira")
      const parts = wordClean.split('-');
      const cappedParts = parts.map(p => p ? p[0].toUpperCase() + p.slice(1) : '');
      return cappedParts.join('-') + punctuation;
    }
    
    return wordClean + punctuation;
  });
  
  return formatted.join(' ');
}

// Interpreta e humaniza datas ou prazos de validade digitados pelo franqueado (Ideia 3)
function gSmartHumanizeDate(str) {
  if (!str || typeof str !== 'string') return str;
  
  const cleaned = str.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!cleaned) return '';
  
  // Se o usuário já digitou uma frase de validade completa, respeita e não mexe
  if (cleaned.includes('válid') || cleaned.includes('validade') || cleaned.includes('aproveite') || cleaned.length > 28) {
    return str;
  }
  
  // 1. Dias relativos comuns
  if (cleaned === 'hoje') return 'Válido apenas hoje';
  if (cleaned === 'amanha' || cleaned === 'amanhã') return 'Válido apenas amanhã';
  if (cleaned === 'fim de semana' || cleaned === 'final de semana') return 'Válido neste fim de semana';
  
  // 2. Dias da semana simples
  const diasSemana = {
    'segunda': 'nesta segunda-feira',
    'segunda-feira': 'nesta segunda-feira',
    'terça': 'nesta terça-feira',
    'terça-feira': 'nesta terça-feira',
    'quarta': 'nesta quarta-feira',
    'quarta-feira': 'nesta quarta-feira',
    'quinta': 'nesta quinta-feira',
    'quinta-feira': 'nesta quinta-feira',
    'sexta': 'nesta sexta-feira',
    'sexta-feira': 'nesta sexta-feira',
    'sabado': 'neste sábado',
    'sábado': 'neste sábado',
    'domingo': 'neste domingo'
  };
  
  if (diasSemana[cleaned]) {
    return 'Válido ' + diasSemana[cleaned];
  }
  
  // Se contiver "ate" ou "até" + dia da semana
  if (cleaned.startsWith('até ') || cleaned.startsWith('ate ')) {
    const dia = cleaned.replace(/^até\s+|^ate\s+/, '').trim();
    if (diasSemana[dia]) {
      return 'Válido até ' + dia.replace('-feira', '');
    }
  }
  
  // 3. Datas numéricas (ex: "12/07" ou "12-07")
  const dateRegex = /^(\d{1,2})[\/\-](\d{1,2})([\/\-]\d{2,4})?$/;
  if (dateRegex.test(cleaned)) {
    return 'Válido até ' + str.trim();
  }
  
  // Se contiver "de" (ex: "12 de julho")
  if (/^\d{1,2}\s+de\s+[a-z]+$/i.test(cleaned)) {
    return 'Válido até ' + str.trim();
  }
  
  // Fallback padrão: anexa "Válido " na frente se for apenas um termo curto
  if (str.trim().length <= 15) {
    return 'Válido ' + str.trim();
  }
  
  return str;
}

// Calcula o limite recomendado de caracteres da caixa de texto para preservar respiro e hierarquia
function gCalculateRecommendedCharLimit(layer) {
  if (!layer || layer.type !== 'text') return 0;
  
  const fs = layer.fontSize || 24;
  
  // Se for uma caixa de texto pontual (sem limite lateral físico), sugere limite padrão de segurança
  if (layer.textBox !== 'box') {
    return 35; 
  }
  
  const w = layer.w || 300;
  let h = layer.h || 80;
  const lh = fs * (layer.lineHeight || 1.25);
  
  // Detecção Proativa de Colisão com Vizinhos Abaixo (Ideia 3 melhorada)
  if (typeof dLayers !== 'undefined' && Array.isArray(dLayers)) {
    // Filtra camadas visíveis no mesmo artboard que estejam abaixo
    const belowLayers = dLayers.filter(l => 
      l.id !== layer.id && 
      l.visible && 
      l.parentId === layer.parentId &&
      l.y >= layer.y &&
      // Sobreposição ou vizinhança horizontal (alinhamento X)
      (Math.max(layer.x, l.x) < Math.min(layer.x + layer.w, l.x + l.w))
    );
    
    if (belowLayers.length > 0) {
      // Encontra a camada mais próxima diretamente abaixo
      belowLayers.sort((a, b) => a.y - b.y);
      const nearest = belowLayers[0];
      const distY = nearest.y - (layer.y + h);
      
      // Se a distância for menor que 24px, reduzimos a altura de cálculo em 1 linha
      // para forçar a hierarquia visual e evitar que fiquem colados ou colidam
      if (distY >= 0 && distY < 24) {
        h = Math.max(lh, h - lh);
      }
    }
  }
  
  // Determina quantas linhas cabem fisicamente com folga
  const maxLines = Math.max(1, Math.floor(h / lh));
  
  // Caractere ocidental médio tem cerca de 48% da largura do fontSize
  const charW = fs * 0.48;
  const charsPerLine = Math.max(1, Math.floor(w / charW));
  
  const rawLimit = maxLines * charsPerLine;
  
  // Aplica um redutor de segurança de 15% para manter respiros visuais elegantes nas caixas
  return Math.max(10, Math.floor(rawLimit * 0.85));
}
