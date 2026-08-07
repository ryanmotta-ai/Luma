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
   @param {object} [opts] {escala:1, encolher:true, pisoFonte:null}
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
function gStampPisosHierarquia(layers){
  const degraus=[...new Set((layers||[])
    .filter(l => l && l.type==='text' && l.visible!==false)
    .map(l => Math.round(l.fontSize||24)))].sort((a,b)=>b-a);
  (layers||[]).forEach(l => {
    if(!l || l.type!=='text') return;
    const s=Math.round(l.fontSize||24);
    const abaixo=degraus.find(t => t < s);
    l._pisoFonte = (abaixo!=null) ? Math.max(abaixo, Math.round(s*0.5)) : null;
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
  if (!l || l.type !== 'text' || l.vAlign === 'top') return 0;
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
  if (!l || l.type !== 'text' || l.textBox === 'box') return 0;
  const sobra = (l.w || 0) - (largura || 0);
  if (l.textAlign === 'center') return sobra / 2;
  if (l.textAlign === 'right') return sobra;
  return 0;
}

/* O retângulo que a TINTA ocupa de fato — o que colide, o que sai da prancheta, o que o olho
   vê. Diferente da caixa desenhada sempre que o texto não a preenche (ou passa dela).
   `fit` é o `gFitTextLayer` já resolvido (`l._fit` depois da cascata); sem ele cai na caixa. */
function gInkRect(l, fit) {
  if (!l) return { x:0, y:0, w:0, h:0 };
  const f = fit || l._fit;
  if (l.type !== 'text' || !f) return { x:l.x||0, y:l.y||0, w:l.w||0, h:l.h||0 };
  const alt = f.altura || 0;
  const larg = (l.textBox === 'box') ? (l.w || 0) : (f.larguraMax || 0);
  let x = l.x || 0;
  if (l.textBox !== 'box') {
    if (l.textAlign === 'center') x = (l.x||0) + ((l.w||0) - larg) / 2;
    else if (l.textAlign === 'right') x = (l.x||0) + (l.w||0) - larg;
  }
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
  const base = Math.round(_desenhada * esc);
  const vazio = { text:'', lines:[], fontSize:base, letterSpacing:null, altura:0, larguraMax:0, estourou:false };
  if (l.type !== 'text') return vazio;

  let txt = String(texto == null ? '' : texto);
  // 1) QUEBRA — só caixa de parágrafo tem largura para quebrar. Point text não quebra: é a
  //    regra do render (e mexer nisso quebraria a fidelidade 1:1 do PSD).
  const ehCaixa = (l.textBox === 'box');
  // A quebra tem que usar o tamanho EFETIVO. Com o teto da escada, quebrar no tamanho
  // desenhado e desenhar menor gera linha demais (7 onde cabiam 3) — a arte encolhe e cresce
  // em altura ao mesmo tempo, que é o oposto do que a escada quer. Sem teto (`_tetoFonte`
  // nulo), o clone nem existe e o caminho é byte a byte o de hoje.
  const _wrapL = (_desenhada !== (l.fontSize || 24)) ? Object.assign({}, l, { fontSize: _desenhada }) : l;
  if (ehCaixa && typeof gSmartWrapText === 'function') txt = gSmartWrapText(txt, l.w, _wrapL, null, null);
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
  let ls = (l.letterSpacing != null) ? (l.letterSpacing * esc) : null;
  const aplicar = () => {
    ctx.font = ital + peso + ' ' + fs + 'px ' + fp.family;
    ctx.letterSpacing = (ls != null) ? (ls + 'px') : (display ? Math.max(0.5, fs * 0.02) + 'px' : '0px');
  };
  const medir = () => { aplicar(); let m = 0; for (const ln of linhas) { const w = ctx.measureText(ln).width; if (w > m) m = w; } return m; };
  let maxL = medir();

  // 4) ENCOLHER — só caixa, um passo, com piso. O piso padrão é 50% do tamanho desenhado
  //    (regra atual do render); `opts.pisoFonte` existe para a hierarquia virar o piso real.
  const largura = Math.round((l.w || 0) * esc);
  const pad = Math.round(fs * 0.08);
  const disp = Math.max(10, largura - pad * 2);
  let estourou = false;
  if (opts.encolher !== false && ehCaixa && maxL > disp) {
    // Prioridade: piso explícito > piso da hierarquia (carimbado) > o antigo 50% isolado.
    const _pisoBase = (opts.pisoFonte != null) ? opts.pisoFonte
                    : ((l._pisoFonte != null) ? l._pisoFonte : ((l.fontSize || 24) * 0.5));
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
  const lh = fs * gLineHeightDe(l);
  return { text: txt, lines: linhas, fontSize: fs,
    letterSpacing: (ls != null) ? (ls + 'px') : null,
    altura: Math.round(lh * linhas.length), larguraMax: Math.round(maxL), estourou };
}

/* O interruptor do layout vivo — DOIS em série.
   `franqueado.layout-vivo` (Controle do produto) governa a REDE, para a gestão poder desligar
   sem deploy; `gLayoutVivoOff` é o botão **Auto-layout** da prévia ao vivo, a chave de quem
   está OLHANDO a arte agora — o franqueado pode preferir a composição original mesmo com o
   texto apertado, e gosto é dele.
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
  if(typeof gFeatureCan === 'function'){
    try{ return gFeatureCan('franqueado.layout-vivo','render') !== false; }catch(e){ return true; }
  }
  return true;
}

function gLayoutVivoAtivo(){
  return !gLayoutVivoOff && gLayoutVivoDisponivel();
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
function _gCorrenteMovivel(l){
  if(!l || l.type==='group' || l.visible===false) return false;
  if(l.locked || l.lockPosition || l.parentId) return false;
  if(l.layoutRole==='background' || l.layoutRole==='protected') return false;
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
  const nós=cloned.filter(l=>l && l.visible!==false && l.type!=='group'
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
    if(B.relativeAnchor || !_gCorrenteMovivel(B)) return;   // manual vence; imóvel não entra
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
  const textos = cloned.filter(l => l && l.type === 'text' && l.visible !== false);
  cloned.forEach((p, iP) => {
    if (!p || p.type !== 'shape' || p.visible === false) return;
    if (p.shapeKind && p.shapeKind !== 'rect') return;
    if (p.locked || p.lockPosition || p.parentId) return;
    if (p.layoutRole === 'protected' || _gCorrenteEhFundo(p, cv)) return;
    const px1 = p.x || 0, py1 = p.y || 0, px2 = px1 + (p.w || 0), py2 = py1 + (p.h || 0);
    const dentro = textos.filter(t => {
      if (cloned.indexOf(t) < iP) return false;                 // texto tem que estar NA FRENTE
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
  // O piso da hierarquia é carimbado ANTES de medir: a medida e o render têm que usar o MESMO
  // piso, e é justamente medir com uma regra e desenhar com outra que originou este trabalho.
  if (_fit) gStampPisosHierarquia(cloned);
  const resolved = {};
  cloned.forEach(l => {
    let text = l.content || '';
    if (l.isVar || /\{\{/.test(text)) {
      text = gInterpolate(text, dados, {defaults});
    }
    let w, h;
    if (l.type !== 'text') { w = l.w || 0; h = l.h || 0; }
    else if (_fit) {
      const f = gFitTextLayer(l, text, ctxAux);
      // A caixa de parágrafo tem largura FIXA por definição — quem cresce nela é a altura.
      // Point text abraça os glifos, então a largura medida é a real.
      w = (l.textBox === 'box') ? (l.w || 0) : f.larguraMax;
      h = f.altura;
      // Guarda o encaixe resolvido: a fase seguinte (aviso/escada) lê daqui sem re-medir.
      l._fit = f;
      _gStampVTop(l, f.altura);
    } else {
      w = gMeasureLayerWidth(l, text, ctxAux);
      h = gMeasureLayerHeight(l, text);
    }
    resolved[l.id] = { x: l.x || 0, y: l.y || 0, w, h, visible: l.visible !== false,
                       dy: _fit ? _gInkDy(l, h) : 0, dx: _fit ? _gInkDx(l, w) : 0,
                       // Texto que não sobrou nada depois de interpolar: a corrente trata a
                       // faixa dele como inexistente em vez de deixar um buraco na arte.
                       vazio: _fit && l.type === 'text' && !!l._fit && l._fit.altura === 0 };
  });

  // Correntes inferidas do desenho (só com o layout vivo ligado).
  if (_fit && !(opts && opts.inferir === false)) {
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
    const calc = (id, vistos) => {
      if (cache[id] != null) return cache[id];
      if (vistos.has(id)) return 0;                       // ciclo: para aqui
      vistos.add(id);
      const l = cloned.find(x => x.id === id);
      const a = l && (l.relativeAnchor || l._anchorAuto);
      const d = (a && a.layerId && resolved[a.layerId]) ? calc(a.layerId, vistos) + 1 : 0;
      cache[id] = d;
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
  const _cresceuX = (l) => l && l.type === 'text' && l.textBox !== 'box' && l._fit
                         && l._fit.larguraMax > (l.w || 0) + 1;
  // Quem escapou da prancheta depois de posicionar — pelo PÉ (empurrado), pelo TOPO (texto
  // centralizado que cresceu para os dois lados) ou pelos LADOS (point text, que não quebra
  // linha: o nome longo do produto simplesmente sai da arte).
  const _escapou = () => {
    if (!_limite && !_largura) return false;
    return cloned.some(l => {
      if (!l || l.visible === false) return false;
      const r = resolved[l.id];
      if (!r) return false;
      const encadeada = !!(l.relativeAnchor || l._anchorAuto);
      // Y: quem foi empurrado saiu pelo pé, ou quem cresceu subiu por cima da margem do topo.
      if (_limite && encadeada && (r.y + (r.dy || 0) + (r.h || 0)) > _limite) return true;
      if (_limite && _cresceuY(l) && (r.y + (r.dy || 0)) < 0) return true;
      // X: só quem cresceu de verdade (por texto próprio) ou foi empurrado para o lado.
      if (_largura && (_cresceuX(l) || encadeada)) {
        const x = r.x + (r.dx || 0);
        if (_cresceuX(l) && (x < 0 || x + (r.w || 0) > _largura)) return true;
        if (encadeada && x + (r.w || 0) > _largura) return true;
      }
      return false;
    });
  };
  // Re-mede SÓ quem mudou. Antes remedia todas as camadas a cada volta, e uma arte pesada
  // custava 116ms por tecla — acima do debounce de 110ms da digitação.
  const _remedir = (lista) => {
    lista.forEach(l => {
      let t = l.content || '';
      if (l.isVar || /\{\{/.test(t)) t = gInterpolate(t, dados, { defaults });
      const f = gFitTextLayer(l, t, ctxAux);
      l._fit = f;
      resolved[l.id].h = f.altura;
      resolved[l.id].dy = _gInkDy(l, f.altura);
      _gStampVTop(l, f.altura);
      if (l.textBox !== 'box') {
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
    // Quando todo mundo chega ao piso da hierarquia e AINDA não cabe, a prioridade inverte:
    // arte com o preço cortado é inútil; arte com hierarquia achatada é feia mas serve. Só aí
    // se desce abaixo do degrau, até o piso absoluto (50% do desenhado, nunca menos de 8px).
    let relaxou = false;
    // Teto de voltas: encolhendo um degrau por vez são ~9 passos para levar um degrau do
    // tamanho desenhado ao piso, vezes os degraus da arte, vezes a volta do relaxamento.
    // 60 cobre arte real com folga; é rede de segurança contra laço infinito, não orçamento.
    while (_escapou() && tentativas < 60) {
      tentativas++;
      // Culpados: os textos que passaram da própria caixa (são eles que empurram).
      const culpados = cloned.filter(l => _cresceuY(l) || _cresceuX(l));
      if (!culpados.length) break;

      /* DEGRAU ANTERIOR AO ENCOLHIMENTO: apertar a ENTRELINHA.
         Designer não sai reduzindo a letra — primeiro fecha o espaçamento, porque a hierarquia
         mora no TAMANHO da fonte e não no respiro entre linhas. De 1.2 para 1.05 são ~12% de
         altura recuperada com a tipografia intacta. Só vale para quem tem mais de uma linha
         (em texto de uma linha a entrelinha não ocupa nada) e para de mexer no piso de 1.05,
         onde as linhas começam a se tocar. */
      const _apertaveis = culpados.filter(l => l._fit && l._fit.lines.length > 1
                                            && gLineHeightDe(l) > 1.06);
      if (_apertaveis.length) {
        /* Calculada, não tateada: a entrelinha que faria a tinta caber na caixa é
           `altura / (fonte × linhas)`. Uma conta, um passo, uma re-medida — tatear de 0.05 em
           0.05 custava três voltas de re-medida em toda a arte (144ms a mais numa peça pesada)
           e chegava no mesmo lugar. Piso 1.05: abaixo disso as linhas começam a se tocar. */
        _apertaveis.forEach(l => {
          const fs = (l._tetoFonte != null) ? l._tetoFonte : (l.fontSize || 24);
          const n = l._fit.lines.length;
          const alvo = (l.h || 0) / Math.max(1, fs * n);
          l._entrelinha = Math.max(1.05, Math.min(gLineHeightDe(l), Math.round(alvo * 1000) / 1000));
        });
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
      const _pisoDe = (l) => {
        const pisoAbs = Math.max(8, Math.round((l.fontSize || 24) * 0.5));
        return relaxou ? pisoAbs
             : ((l._pisoFonte != null) ? Math.max(l._pisoFonte, pisoAbs) : pisoAbs);
      };
      const _atual = (l) => (l._tetoFonte != null) ? l._tetoFonte : (l.fontSize || 24);
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
      // Todo mundo no piso da hierarquia: solta o piso uma vez e tenta de novo.
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
        if (!r || l.visible === false) return;
        const y1 = r.y + (r.dy || 0), y2 = y1 + (r.h || 0);
        const x1 = r.x + (r.dx || 0), x2 = x1 + (r.w || 0);
        const fora = (_limite && (y1 < -2 || y2 > _limite + 2))
                  || (_largura && (x1 < -2 || x2 > _largura + 2));
        if (fora) l._foraDaArte = true;
      });
    }
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
