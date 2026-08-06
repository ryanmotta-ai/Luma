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

// Resolve e atualiza as posições (X e Y) de camadas ancoradas de forma magnética/relativa
function gApplyRelativeAnchors(layers, dados, defaults) {
  if (!layers || !layers.length) return layers;
  
  const cloned = layers.map(l => ({...l}));
  const canvasAux = document.createElement('canvas');
  const ctxAux = canvasAux.getContext('2d');
  
  const resolved = {};
  cloned.forEach(l => {
    let text = l.content || '';
    if (l.isVar || /\{\{/.test(text)) {
      text = gInterpolate(text, dados, {defaults});
    }
    
    resolved[l.id] = {
      x: l.x || 0,
      y: l.y || 0,
      w: l.type === 'text' ? gMeasureLayerWidth(l, text, ctxAux) : (l.w || 0),
      h: l.type === 'text' ? gMeasureLayerHeight(l, text) : (l.h || 0),
      visible: l.visible !== false
    };
  });
  
  const maxIter = cloned.length;
  let changed = true;
  let iter = 0;
  
  while (changed && iter < maxIter) {
    changed = false;
    iter++;
    
    cloned.forEach(l => {
      const anchor = l.relativeAnchor;
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
  
  // Se contiver quebras de linha manuais do designer, respeita e não mexe
  if (text.includes('\n')) return text;
  
  // Limpa espaços redundantes
  const cleanText = text.replace(/\s+/g, ' ').trim();
  const words = cleanText.split(' ');
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Medição exata da largura de cada linha usando as métricas da própria camada
  const measure = (str) => {
    // Limpa tags de template temporárias (__VAR_START_...__) para obter medição física exata de pixels no editor
    const cleanStr = str.replace(/__VAR_START_[a-zA-Z0-9_]+__/g, '').replace(/__VAR_END__/g, '');
    return gMeasureLayerWidth(layer, cleanStr, ctx);
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
  
  // Testa partições em N = 2 e N = 3 linhas
  for (let n = 2; n <= 3; n++) {
    if (words.length < n) continue;
    
    const partitions = [];
    const getPartitions = (arr, partsLeft, currentPart) => {
      if (partsLeft === 1) {
        partitions.push(currentPart.concat([arr]));
        return;
      }
      for (let i = 1; i <= arr.length - partsLeft + 1; i++) {
        getPartitions(arr.slice(i), partsLeft - 1, currentPart.concat([arr.slice(0, i)]));
      }
    };
    
    getPartitions(words, n, []);
    
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
    let rest = token;
    while (rest && measure(rest) > availableW) {
      let low = 1, high = rest.length, fit = 1;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (measure(rest.slice(0, mid)) <= availableW) { fit = mid; low = mid + 1; }
        else high = mid - 1;
      }
      wrapped.push(rest.slice(0, fit));
      rest = rest.slice(fit);
    }
    return rest;
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
