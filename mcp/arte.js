/* Lógica pura de arte do MCP (sem navegador, sem rede): patches por id, derivação feed→story e auditoria de marca.
   As regras vêm de .claude/skills/luma/arte/DESIGN.md (grade 72, corpo ≥ 24, contraste ≥ 4,5, uma família de raio, zona segura do story). */
const L=require('../.claude/skills/luma/arte/ferramentas/lib.js');
const clone=o=>JSON.parse(JSON.stringify(o));

/* Aplica {id:{campo:valor}} por ID (nunca por posição: undo/story/sync trocam objetos). Ordem do array intacta. */
function aplicarPatches(layers,patches={},remover=[],adicionar=[]){
  const out=clone(layers), avisos=[], ids=new Set(out.map(l=>l.id));
  for(const id of Object.keys(patches)){ if(!ids.has(id)) avisos.push(`patch ignorado: layer "${id}" não existe`); }
  for(const id of remover) if(!ids.has(id)) avisos.push(`remover ignorado: layer "${id}" não existe`);
  const rm=new Set(remover);
  const res=out.filter(l=>!rm.has(l.id)).map(l=>patches[l.id]?Object.assign(l,patches[l.id]):l);
  for(const n of adicionar){ if(!n||!n.id){ avisos.push('adicionar ignorado: layer sem id'); continue; } if(res.some(l=>l.id===n.id)){ avisos.push(`adicionar ignorado: id "${n.id}" já existe`); continue; } res.push(n); }
  return {layers:res,avisos};
}

/* feed → story: mesmo conjunto de ids, só mudam y/h (nada renomeia nem reordena). Padrão: o fundo cresce; o que vive no
   rodapé desce; `patches` explícitos vencem. O miolo (foto, preço) NÃO é redimensionado — passe patches para isso. */
function derivarStory(feed,patches={},{HF=1350,HS=1920}={}){
  const d=HS-HF, auto={};
  for(const l of feed){ if(patches[l.id]) continue;
    const fundo=l.layoutSemantic==='fundo'||l.layoutRole==='background'||(l.y<=0&&l.h>=HF-2);
    if(fundo) auto[l.id]={h:Math.round(l.h+d)};
    else if(l.y>=HF*0.9) auto[l.id]={y:Math.round(l.y+d)}; }
  const r=aplicarPatches(feed,Object.assign({},auto,patches));
  const zona=r.layers.filter(l=>l.visible!==false&&l.type!=='shape'&&l.layoutSemantic!=='legal'&&l.layoutSemantic!=='fundo'&&l.layoutSemantic!=='decoracao'&&(l.y<250||l.y+l.h>HS-250)).map(l=>l.id);
  if(zona.length) r.avisos.push('zona segura do story (250 px do topo/base sob a interface): '+zona.join(', ')+' — só marca/rodapé deveriam ficar ali');
  return {layers:r.layers,avisos:r.avisos,auto};
}

const hex6=c=>{ if(typeof c!=='string') return null; const m=c.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i); if(!m) return null; let h=m[1]; if(h.length===3) h=h.split('').map(x=>x+x).join(''); return '#'+h; };
/* Auditoria estática. nivel: erro (bloqueia publicar) | aviso | info */
function auditar(layers,W=1080,H=1350){
  const out=[], P=(nivel,id,msg)=>out.push({nivel,id,msg}), vis=layers.filter(l=>l.visible!==false);
  const vistos=new Set(); for(const l of layers){ if(!l.id) P('erro','(sem id)','layer sem id'); else if(vistos.has(l.id)) P('erro',l.id,'id duplicado'); else vistos.add(l.id); }
  for(const l of vis){ const bleed=l.layoutSemantic==='fundo'||l.layoutSemantic==='decoracao'||l.layoutRole==='background';
    if(!bleed&&(l.x+l.w<0||l.y+l.h<0||l.x>W||l.y>H)) P('erro',l.id,'fora do canvas');
    else if(!bleed&&l.type!=='shape'&&(l.x<(l.type==='text'?56:66)||l.x+l.w>W-(l.type==='text'?56:66))) P('aviso',l.id,`passa da margem lateral de 72 px (x ${Math.round(l.x)}…${Math.round(l.x+l.w)})`);
    if(l.type==='text'&&l.fontSize<22) P('aviso',l.id,`corpo ${l.fontSize} px (piso prático da arte: 22–24)`); }
  /* contraste: cor do texto × fundo opaco mais próximo por baixo (só hex) */
  vis.forEach((l,i)=>{ if(l.type!=='text') return; const fg=hex6(l.color); if(!fg) return; const cx=l.x+l.w/2, cy=l.y+l.h/2;
    for(let j=i-1;j>=0;j--){ const b=vis[j];
      /* imagem/moldura por baixo cobrindo o centro = fundo desconhecido (ex.: bilhete PNG branco): não julga */
      if((b.type==='image'||b.type==='frame')&&cx>=b.x&&cx<=b.x+b.w&&cy>=b.y&&cy<=b.y+b.h) break;
      if(b.type!=='shape'&&b.type!=='frame') continue; const bg=hex6(b.fill); if(!bg||(b.opacity!=null&&b.opacity<70)) continue;
      if(cx>=b.x&&cx<=b.x+b.w&&cy>=b.y&&cy<=b.y+b.h){ const c=L.contraste(fg,bg); if(c<3) P('erro',l.id,`contraste ${c.toFixed(1)}:1 de ${fg} sobre ${bg} (reprova)`); else if(c<4.5&&!(c>=3&&l.fontSize>=48)) P('aviso',l.id,`contraste ${c.toFixed(1)}:1 de ${fg} sobre ${bg} (alvo ≥ 4,5)`); break; } } });
  const cores=new Set(); for(const l of vis){ for(const c of [l.fill,l.color]){ const h=hex6(c); if(h) cores.add(h.toLowerCase()); } }
  if(cores.size>8) P('aviso','(arte)',`${cores.size} cores distintas — a regra é paleta da campanha + no máx. 1 acento`);
  const raios=new Set(); for(const l of vis){ if(l.type==='shape'&&l.shapeKind==='rect'&&l.radii){ const r=l.radii.tl; if(r>0&&Math.abs(r-Math.min(l.w,l.h)/2)>2) raios.add(r); } }
  if(raios.size>2) P('aviso','(arte)',`raios diferentes: ${[...raios].join(', ')} — uma família só (ex.: 40 + pílula)`);
  if(H>=1900){ const z=vis.filter(l=>l.type==='text'&&l.layoutSemantic!=='legal'&&(l.y<250||l.y+l.h>H-250)).map(l=>l.id); if(z.length) P('aviso',z.join(', '),'texto na zona de interface do story (250 px topo/base)'); }
  return out;
}
const resumoAuditoria=a=>a.length?a.map(x=>`${x.nivel.toUpperCase()} · ${x.id} · ${x.msg}`).join('\n'):'nada a apontar';
module.exports={aplicarPatches,derivarStory,auditar,resumoAuditoria};
