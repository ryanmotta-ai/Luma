#!/usr/bin/env node
/* Mede PNGs (renders do harness ou uma referência em PNG). Zero dependência.
   node medir.js bordas  img.png  y0 y1 [bg=#rrggbb] [tol=40]   → bordas esquerda/direita da "tinta" (≠ fundo) numa faixa de linhas
   node medir.js cor     img.png  x y                            → RGBA de um pixel
   node medir.js paleta  img.png  [n=8]                          → cores dominantes (quantizadas)
   node medir.js caixa   img.png  #rrggbb [tol=30] [x0 y0 x1 y1] → caixa que envolve os pixels dessa cor (acha selo, etiqueta, faixa…)
   node medir.js lado    a.png b.png                             → mesma altura, lado a lado, em lado.png não — só imprime diferença de tamanho (use o Read nas duas)
   Todas as medidas saem em px da imagem; numa referência, divida pela escala (largura do formato ÷ largura da referência). */
const {decode}=require('./png.js');
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const [,, cmd, f, ...a]=process.argv;
if(!cmd){ console.log(require('fs').readFileSync(__filename,'utf8').split('\n').slice(1,9).join('\n')); process.exit(2); }
const im=decode(f);
if(cmd==='cor'){ console.log(im.px(+a[0],+a[1]).join(',')); }
else if(cmd==='bordas'){ const y0=+a[0],y1=+a[1],bg=hex(a[2]||'#fbf2ff'),tol=+(a[3]||40); let L=1e9,R=-1;
  for(let y=y0;y<y1;y++)for(let x=0;x<im.w;x++){const p=im.px(x,y); if(Math.abs(p[0]-bg[0])+Math.abs(p[1]-bg[1])+Math.abs(p[2]-bg[2])>tol){ if(x<L)L=x; if(x>R)R=x; }}
  console.log(`linhas ${y0}-${y1}: esquerda ${L}  direita ${R}  (imagem ${im.w}×${im.h})`); }
else if(cmd==='paleta'){ const n=+(a[0]||8),m=new Map(); for(let y=0;y<im.h;y+=2)for(let x=0;x<im.w;x+=2){const p=im.px(x,y); if(p[3]<200)continue; const k=[p[0]>>4,p[1]>>4,p[2]>>4].join(','); m.set(k,(m.get(k)||0)+1);}
  [...m.entries()].sort((x,y)=>y[1]-x[1]).slice(0,n).forEach(([k,c])=>{const [r,g,b]=k.split(',').map(v=>(+v<<4)+8); console.log('#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join(''),Math.round(c*400/(im.w*im.h))+'%');}); }
else if(cmd==='caixa'){ const c=hex(a[0]),tol=+(a[1]||30),[x0,y0,x1,y1]=[a[2]||0,a[3]||0,a[4]||im.w,a[5]||im.h].map(Number); let b=[1e9,1e9,-1,-1],n=0;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const p=im.px(x,y); if(Math.abs(p[0]-c[0])+Math.abs(p[1]-c[1])+Math.abs(p[2]-c[2])<tol){n++; if(x<b[0])b[0]=x; if(y<b[1])b[1]=y; if(x>b[2])b[2]=x; if(y>b[3])b[3]=y;}}
  console.log(n?`caixa x ${b[0]}–${b[2]}  y ${b[1]}–${b[3]}  (${b[2]-b[0]}×${b[3]-b[1]}, ${n} px)`:'nenhum pixel dessa cor'); }
else if(cmd==='lado'){ const b=decode(a[0]); console.log(`A ${im.w}×${im.h}  B ${b.w}×${b.h}`); }
