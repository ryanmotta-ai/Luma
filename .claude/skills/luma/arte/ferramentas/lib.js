/* Blocos de montagem de layers do Luma (zero dependência). Cada função devolve UM objeto de layer no formato do banco.
   Convenção: coordenadas em px do formato (feed 1080×1350, story 1080×1920); x,y = canto superior esquerdo. */
const A={h:'left',v:'top'};
const PAL={roxo:'#831CA5',roxoEsc:'#4a0f63',roxoMed:'#6b2a86',lilas:'#fbf2ff',amarelo:'#ffb900',laranja:'#f85400',laranjaCl:'#ff9000',branco:'#ffffff',vermelho:'#c81414',marrom:'#4a1a0c',creme:'#fdf3d8'};
function base(id,name,type,x,y,w,h,o={}){ return Object.assign({id,name,type,x,y,w,h,anchor:A,opacity:100,visible:true},o); }
const R=(r)=>({tl:r,tr:r,bl:r,br:r});
function rect(id,name,x,y,w,h,fill,r=0,o={}){ return base(id,name,'shape',x,y,w,h,Object.assign({fill,shapeKind:'rect',radii:R(r),layoutSemantic:'decoracao'},o)); }
/* texto: font 'custom:Realce' (títulos/preço, altura de maiúscula ≈0.69em) ou "'Roboto',400|700" ou "'Roboto Black'" */
function text(id,name,x,y,w,h,content,font,size,color,o={}){
  return base(id,name,'text',x,y,w,h,Object.assign({font,color,isVar:/\{\{/.test(content),vAlign:'top',content,textBox:'box',fontSize:size,textAlign:'left',lineHeight:1,letterSpacing:0,layoutSemantic:'apoio'},o));
}
function img(id,name,x,y,w,h,url,o={}){ return base(id,name,'image',x,y,w,h,Object.assign({imgUrl:url,imgVar:'',objectFit:'cover',frameShape:'rect',layoutSemantic:'decoracao'},o)); }
/* moldura que recebe a foto do franqueado (imgVar foto_produto) */
function foto(x,y,w,h,r=40,o={}){ return base('l-foto','Foto do produto','frame',x,y,w,h,Object.assign({radii:R(r),imgUrl:'',imgVar:'foto_produto',objectFit:'cover',shapeKind:'rect',layoutSemantic:'decoracao'},o)); }
const CIRC={paths:[{knots:[{in:[0.2239,0],out:[0.7761,0],anchor:[0.5,0],linked:true},{in:[1,0.2239],out:[1,0.7761],anchor:[1,0.5],linked:true},{in:[0.7761,1],out:[0.2239,1],anchor:[0.5,1],linked:true},{in:[0,0.7761],out:[0,0.2239],anchor:[0,0.5],linked:true}],closed:true}],fillRule:'evenodd'};
const COMMA={paths:[{knots:[{in:[0.12,0],out:[0.88,0],anchor:[0.5,0],linked:false},{in:[1,0.06],out:[1,0.55],anchor:[1,0.3],linked:false},{in:[0.9,0.8],out:[0,1],anchor:[0.1,0.98],linked:false},{in:[0,0.9],out:[0.35,0.78],anchor:[0.1,0.82],linked:false},{in:[0,0.5],out:[0,0.06],anchor:[0,0.3],linked:false}],closed:true}],fillRule:'evenodd'};
/* círculo da loja (imgVar logo_loja) com aro */
function logoLoja(x,y,s,cor,aro=8,o={}){ return base('l-logo','Logo da loja','frame',x,y,s,s,Object.assign({imgUrl:'',imgVar:'logo_loja',objectFit:'contain',strokeW:aro,strokeCap:'butt',strokeJoin:'miter',shapeKind:'path',vectorPath:CIRC,strokeAlign:'inside',strokeColor:cor,layoutSemantic:'decoracao'},o)); }
/* sombra de elevação única da peça (mesma em tudo) */
const ELEV={shadow:true,shadowColor:'rgba(74,15,99,0.22)',shadowBlur:16,shadowDist:6,shadowAngle:90};
/* banner de campanha: proporção do PNG (ex. aai.png 1528×408); contorno branco 4px pelo alpha real + sombra sutil */
function banner(x,y,w,url,ratio=1528/408,o={}){ return img('l-banner','Banner da campanha',x,y,w,Math.round(w/ratio),url,Object.assign({strokeW:4,strokeColor:'#ffffff',strokeAlign:'outside',shadow:true,shadowColor:'rgba(0,0,0,0.22)',shadowBlur:10,shadowDist:4,shadowAngle:90},o)); }
/* selo "PROCURE O BANNER" (devolve 2 layers) */
function selo(x,y,w=248,h=36,fill=PAL.roxo,cor='#ffffff',fs=20){ return [rect('l-selo','Selo procure o banner',x,y,w,h,fill,h/2),text('l-selo-t','Selo texto',x,y+Math.round((h-fs)/2)-1,w,fs+4,'PROCURE O BANNER',"'Roboto Black'",fs,cor,{textAlign:'center',layoutSemantic:'decoracao'})]; }
/* preço partido: R$ + inteiro + vírgula + centavos. (x0,y)= canto do "R$"; k = escala (1 ≈ inteiro de 84px). `regras` entra em TODAS as peças
   (use para o par "com/sem preço de": hide quando precoDe vazio / preenchido). cs = escala dos centavos. */
function preco(pre,x0,y,k,cor,regras=[],cs=1,cdx=134){
  const ex=regras, w=n=>Math.round(n*k), hid=[{var:'precoPor',then:'hide',when:'empty'}];
  return [
    text(pre+'rs','R$',x0,y,w(50),w(36),'R$','custom:Realce',w(32),cor,{layoutSemantic:'decoracao',rules:hid.concat(ex)}),
    text(pre+'in','Preço inteiro',w(x0/k-27),y-w(43),w(140),w(100),'{{precoPor:inteiro}}','custom:Realce',w(84),cor,{textAlign:'right',layoutSemantic:'titulo',rules:ex.length?ex:undefined}),
    base(pre+'vg','Vírgula','shape',x0+w(116),y+w(6),w(14),w(26),{fill:cor,shapeKind:'path',vectorPath:COMMA,layoutSemantic:'decoracao',rules:hid.concat(ex)}),
    text(pre+'ct','Preço centavos',x0+w(cdx),y-w(38),Math.round(70*k*cs),Math.round(64*k*cs),'{{precoPor:centavos}}','custom:Realce',Math.round(46*k*cs),cor,{rules:ex.length?ex:undefined})
  ].map(l=>{ if(l.rules===undefined) delete l.rules; return l; });
}
/* ATENÇÃO: x do inteiro = x0 - 27k (a caixa é alinhada à direita). Se montar o grupo à mão, mantenha essa relação. */
function star(n,Ro,Ri){ const kn=[]; for(let i=0;i<2*n;i++){const r=i%2?Ri:Ro,a=Math.PI*i/n-Math.PI/2,p=[+(0.5+r*Math.cos(a)/(2*Ro)).toFixed(4),+(0.5+r*Math.sin(a)/(2*Ro)).toFixed(4)];kn.push({anchor:p,in:p,out:p,linked:false});} return {paths:[{knots:kn,closed:true}],fillRule:'nonzero'}; }
function sparkle(id,x,y,s,cor,rot=0,o={}){ const kn=[]; for(let j=0;j<8;j++){const r=j%2?0.12:0.5,a=Math.PI*j/4-Math.PI/2,p=[+(0.5+r*Math.cos(a)).toFixed(4),+(0.5+r*Math.sin(a)).toFixed(4)];kn.push({anchor:p,in:p,out:p,linked:false});}
  return base(id,'Brilho','shape',x,y,s,s,Object.assign({fill:cor,shapeKind:'path',vectorPath:{paths:[{knots:kn,closed:true}],fillRule:'nonzero'},layoutSemantic:'decoracao',rotation:rot},o)); }
/* selo serrilhado: devolve o layer (use rotarGrupo para girar junto com o texto que vai dentro) */
function seloSerrilhado(id,cx,cy,Ro,fill,pontas=28,ri=0.93,o={}){ return base(id,'Selo de preço','shape',cx-Ro,cy-Ro,2*Ro,2*Ro,Object.assign({fill,shapeKind:'path',vectorPath:star(pontas,Ro,Ro*ri),layoutSemantic:'decoracao'},o)); }
/* gira um grupo de layers em torno de (cx,cy): reposiciona o centro de cada um e soma a rotação própria. O motor gira cada layer em torno do PRÓPRIO centro. */
function rotarGrupo(layers,cx,cy,graus){ const t=graus*Math.PI/180,c=Math.cos(t),s=Math.sin(t);
  for(const l of layers){ const mx=l.x+l.w/2-cx,my=l.y+l.h/2-cy,nx=cx+mx*c-my*s,ny=cy+mx*s+my*c; l.x=+(nx-l.w/2).toFixed(1); l.y=+(ny-l.h/2).toFixed(1); l.rotation=+((l.rotation||0)+graus).toFixed(2);} return layers; }
/* descrição que sobe quando "detalhes" está vazio: devolve [com, sem] — o motor não reflui, então são duas cópias com rules */
function descricaoComSem(id,x,y,w,h,font,size,cor,subir){ const a=text(id,'Descrição',x,y,w,h,'{{descricao}}',font,size,cor,{lineHeight:1.3,rules:[{var:'detalhes',then:'hide',when:'empty'}]}); const b=JSON.parse(JSON.stringify(a)); b.id=id+'-sem-detalhe'; b.y=y-subir; b.rules=[{var:'detalhes',then:'hide',when:'filled'}]; return [a,b]; }

/* bilhete (cupom): retângulo arredondado r + 2 entalhes semicirculares (topo e base) em x=nx, raio nr — poucos nós Bézier (14).
   ticketRot gira o bilhete NA GEOMETRIA (o motor do franqueado só gira texto: ver MOTOR.md, "Rotação"). */
function ticketKnots(w,h,r,nr,nx){ const K=0.5523,rk=r*K,nk=nr*K,P=(a,i,o)=>({a,i:i||a,o:o||a});
  return [P([r,0],[r-rk,0],[r,0]),P([nx-nr,0],[nx-nr,0],[nx-nr,nk]),P([nx,nr],[nx-nk,nr],[nx+nk,nr]),P([nx+nr,0],[nx+nr,nk],[nx+nr,0]),P([w-r,0],[w-r,0],[w-r+rk,0]),P([w,r],[w,r-rk],[w,r]),P([w,h-r],[w,h-r],[w,h-r+rk]),P([w-r,h],[w-r+rk,h],[w-r,h]),P([nx+nr,h],[nx+nr,h],[nx+nr,h-nk]),P([nx,h-nr],[nx+nk,h-nr],[nx-nk,h-nr]),P([nx-nr,h],[nx-nr,h-nk],[nx-nr,h]),P([r,h],[r,h],[r-rk,h]),P([0,h-r],[0,h-r+rk],[0,h-r]),P([0,r],[0,r],[0,r-rk])]; }
function _pathK(ks,w,h){ const n=v=>+v.toFixed(4); return {paths:[{closed:true,knots:ks.map(q=>({anchor:[n(q.a[0]/w),n(q.a[1]/h)],in:[n(q.i[0]/w),n(q.i[1]/h)],out:[n(q.o[0]/w),n(q.o[1]/h)],linked:false}))}],fillRule:'nonzero'}; }
function ticket(id,name,x,y,w,h,fill,o={}){ const {r=36,nr=26,nx=170,extra={}}=o;
  return Object.assign(rect(id,name,x,y,w,h,fill,0,Object.assign({shapeKind:'path',vectorPath:_pathK(ticketKnots(w,h,r,nr,nx),w,h)},extra)),{radii:undefined}); }
function ticketRot(id,name,x,y,w,h,fill,deg,o={}){ const {r=36,nr=26,nx=170,extra={}}=o,t=deg*Math.PI/180,c=Math.cos(t),s=Math.sin(t);
  const rot=([px,py])=>{const dx=px-w/2,dy=py-h/2;return [dx*c-dy*s,dx*s+dy*c];};
  const ks=ticketKnots(w,h,r,nr,nx).map(q=>({a:rot(q.a),i:rot(q.i),o:rot(q.o)})), all=[].concat(...ks.map(q=>[q.a,q.i,q.o])), xs=all.map(p=>p[0]), ys=all.map(p=>p[1]);
  const x0=Math.min(...xs),y0=Math.min(...ys),W2=Math.max(...xs)-x0,H2=Math.max(...ys)-y0, sh=p=>[p[0]-x0,p[1]-y0];
  return Object.assign(rect(id,name,Math.round(x+w/2+x0),Math.round(y+h/2+y0),Math.round(W2),Math.round(H2),fill,0,Object.assign({shapeKind:'path',vectorPath:_pathK(ks.map(q=>({a:sh(q.a),i:sh(q.i),o:sh(q.o)})),W2,H2)},extra)),{radii:undefined}); }
const DADOS={produto:'AÇAÍ NA TIGELA',detalhes:'500 ML',descricao:'Açaí cremoso com granola, banana e leite condensado.',precoDe:'R$ 29,00',precoPor:'R$ 22,90',validade:'informações gerais...',foto_produto:'{{FOTO}}',logo_loja:'{{LOGO}}'};
/* variantes de estresse que TODA arte passa antes de sair (ver REFINO-15.md, rodada 11) */
const ESTRESSE={
  'titulo-longo':{produto:'COMBO FAMÍLIA AÇAÍ SUPREMO COMPLETO',detalhes:'DE 1 LITRO COM 4 ADICIONAIS',descricao:'Açaí cremoso com granola crocante, banana, morango, leite condensado e leite em pó.'},
  'sem-detalhes':{detalhes:''},
  'sem-de':{precoDe:''},
  'sem-detalhes-sem-de':{detalhes:'',precoDe:''},
  'preco-1-digito':{precoPor:'R$ 9,90',precoDe:'R$ 14,90'},
  'preco-de-3-digitos':{precoPor:'R$ 89,90',precoDe:'R$ 119,90'},
  'sem-preco':{precoPor:'',precoDe:''}
};
function job(layers,{W=1080,H=1350,fmt,dados={}}={}){ return {W,H,fmt:fmt||(H>1400?'story':'feed'),layers,dados:Object.assign({},DADOS,dados)}; }
/* WCAG: razão de contraste entre duas cores #rrggbb. AA texto grande ≥3:1, texto corrido ≥4.5:1; no Luma o alvo é ≥4.5 em tudo que é lido. */
function contraste(a,b){ const L=h=>{h=h.replace('#','');const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};const [r,g,bb]=[0,2,4].map(i=>f(parseInt(h.substr(i,2),16)));return .2126*r+.7152*g+.0722*bb;}; const x=L(a),y=L(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
module.exports={ticket,ticketRot,PAL,base,rect,text,img,foto,logoLoja,banner,selo,preco,star,sparkle,seloSerrilhado,rotarGrupo,descricaoComSem,job,contraste,CIRC,COMMA,ELEV,DADOS,ESTRESSE,R};
