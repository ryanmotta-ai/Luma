/* Motor de render PERSISTENTE do MCP: um Chromium headless que fica de pé entre as chamadas.
   Antes cada render subia um Chrome novo (5–10 s); agora só abre uma aba (<1 s) e várias abas rodam em paralelo.
   Mesma página (`harness.html`) e mesmo motor (`fRenderTemplateLayers` + Local Fit) do render.js — só muda quem dirige o navegador.
   Zero dependência: protocolo CDP direto pelo WebSocket nativo do Node (≥22). */
const fs=require('fs'), os=require('os'), path=require('path'), cp=require('child_process');
const {prepare,start}=require('../.claude/skills/luma/arte/ferramentas/serve.js');

function achaChrome(){
  if(process.env.CHROME) return process.env.CHROME;
  const c=['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Chromium.app/Contents/MacOS/Chromium'].find(p=>fs.existsSync(p));
  if(c) return c;
  const g=cp.spawnSync('sh',['-c','command -v chromium chromium-browser google-chrome google-chrome-stable 2>/dev/null | head -1']).stdout.toString().trim();
  if(g) return g;
  throw new Error('Chrome/Chromium não encontrado. Instale o Google Chrome ou defina CHROME=/caminho/do/executável.');
}

/* cliente CDP mínimo: uma conexão por aba (evita sessões/flatten) */
function cdp(url){
  return new Promise((ok,no)=>{
    const ws=new WebSocket(url), pend=new Map(); let n=0;
    ws.onerror=()=>no(new Error('falha ao conectar no Chrome (CDP)'));
    ws.onclose=()=>{ for(const p of pend.values()) p.no(new Error('Chrome fechou a conexão')); pend.clear(); };
    ws.onmessage=e=>{ const m=JSON.parse(e.data); const p=pend.get(m.id); if(!p) return; pend.delete(m.id); m.error?p.no(new Error(m.error.message)):p.ok(m.result); };
    ws.onopen=()=>ok({
      send:(method,params={})=>new Promise((o,n2)=>{ const id=++n; pend.set(id,{ok:o,no:n2}); ws.send(JSON.stringify({id,method,params})); }),
      close:()=>{ try{ws.close();}catch(e){} }
    });
  });
}

let estado=null, subindo=null, SEQ=0;
async function subir(){
  const dir=prepare(), {server,port}=await start(dir);
  const udd=fs.mkdtempSync(path.join(os.tmpdir(),'luma-chrome-'));
  const proc=cp.spawn(achaChrome(),['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-port=0','--user-data-dir='+udd,'about:blank'],{stdio:['ignore','ignore','pipe']});
  const ws=await new Promise((ok,no)=>{ let buf=''; const t=setTimeout(()=>no(new Error('Chrome não respondeu em 20 s')),20000);
    proc.stderr.on('data',d=>{ buf+=d; const m=buf.match(/DevTools listening on (ws:\/\/\S+)/); if(m){ clearTimeout(t); ok(m[1]); } });
    proc.on('exit',()=>{ clearTimeout(t); no(new Error('Chrome encerrou ao iniciar')); }); });
  const browser=await cdp(ws), cdpPort=new URL(ws).port;
  const e={dir,server,port,proc,udd,browser,cdpPort,vivo:true};
  proc.on('exit',()=>{ e.vivo=false; if(estado===e) estado=null; });
  return e;
}
async function motor(){
  if(estado&&estado.vivo) return estado;
  return subindo||(subindo=subir().then(e=>{estado=e;subindo=null;return e;},err=>{subindo=null;throw err;}));
}

/* renderiza um job ({W,H,fmt,layers,dados}) numa aba nova e devolve {png(base64),fit,err} */
async function render(job,mode='export'){
  const e=await motor(), nome='m'+process.pid+'_'+(++SEQ), base='http://127.0.0.1:'+e.port+'/assets/demo/';
  const d=job.dados=job.dados||{};
  for(const k of Object.keys(d)){ if(d[k]==='{{FOTO}}') d[k]=base+'burger-batata.jpg'; if(d[k]==='{{LOGO}}') d[k]=base+'logo-sushi-kai.png'; }
  const jf=path.join(e.dir,'job_'+nome+'.json'); fs.writeFileSync(jf,JSON.stringify(job));
  const {targetId}=await e.browser.send('Target.createTarget',{url:'about:blank'});
  let page; try{
    page=await cdp(`ws://127.0.0.1:${e.cdpPort}/devtools/page/${targetId}`);
    await page.send('Page.navigate',{url:`http://127.0.0.1:${e.port}/harness.html?k=${nome}&p=${mode}`});
    const ate=Date.now()+90000;
    const ler=`(()=>{const o=document.getElementById('out');return o?JSON.stringify({err:o.dataset.err,png:o.dataset.png,result:o.dataset.result}):null})()`;
    for(;;){
      const r=await page.send('Runtime.evaluate',{expression:ler,returnByValue:true});
      if(r.result.value){ const o=JSON.parse(r.result.value); let fit={}; try{fit=JSON.parse(o.result||'{}');}catch(x){}
        return {err:o.err||'',png:(o.png||'').replace(/^data:image\/png;base64,/,''),fit}; }
      if(Date.now()>ate) return {err:'o harness não terminou em 90 s',png:'',fit:{}};
      await new Promise(r2=>setTimeout(r2,80));
    }
  } finally {
    if(page) page.close();
    try{ await e.browser.send('Target.closeTarget',{targetId}); }catch(x){}
    try{ fs.unlinkSync(jf); }catch(x){}
  }
}

/* N renders com no máximo `lim` abas ao mesmo tempo */
async function renderMuitos(jobs,lim=4){
  const out=new Array(jobs.length); let i=0;
  await Promise.all(Array.from({length:Math.min(lim,jobs.length)},async()=>{ while(i<jobs.length){ const k=i++; out[k]=await render(jobs[k]).catch(err=>({err:String(err.message||err),png:'',fit:{}})); } }));
  return out;
}

/* Importa um PSD no motor do Estúdio e devolve, por prancheta, PNGs (composto do Photoshop + render da Luma) e as layers.
   Grava tudo em `saida`. O PSD é servido por symlink (nada trafega pelo CDP). */
async function importarPsd(psdPath,saida){
  const e=await motor(), nome='p'+process.pid+'_'+(++SEQ), link=path.join(e.dir,nome+'.psd');
  fs.symlinkSync(path.resolve(psdPath),link);
  const {targetId}=await e.browser.send('Target.createTarget',{url:'about:blank'});
  let page; try{
    page=await cdp(`ws://127.0.0.1:${e.cdpPort}/devtools/page/${targetId}`);
    await page.send('Page.navigate',{url:`http://127.0.0.1:${e.port}/psd.html`});
    const ev=async ex=>{ const r=await page.send('Runtime.evaluate',{expression:ex,awaitPromise:true,returnByValue:true}); if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception&&r.exceptionDetails.exception.description||'erro na página'); return r.result.value; };
    for(let t=0;t<200&&!(await ev('typeof window.__psdRodar')==='function'&&await ev('1'));t++){ if(await ev("typeof window.__psdRodar")==='function') break; await new Promise(r=>setTimeout(r,100)); }
    const out=JSON.parse(await ev(`window.__psdRodar(${JSON.stringify('/'+nome+'.psd')})`));
    if(!out.ok) throw new Error(out.erro);
    fs.mkdirSync(saida,{recursive:true});
    const slug=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w.-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'prancheta';
    for(let i=0;i<out.boards.length;i++){ const b=out.boards[i], base=String(i+1).padStart(2,'0')+'-'+slug(b.nome); b.arquivos={};
      for(const k of ['luma','ref']){ const d=await ev(`window.__img(${i},'${k}')`); if(d){ const f=path.join(saida,base+(k==='luma'?'.png':'.photoshop.png')); fs.writeFileSync(f,Buffer.from(d.replace(/^data:image\/png;base64,/,''),'base64')); b.arquivos[k]=f; } }
      const L=await ev(`JSON.stringify(window.__psdRes.layers[${i}])`); const lf=path.join(saida,base+'.layers.json'); fs.writeFileSync(lf,L); b.arquivos.layers=lf; }
    return out;
  } finally {
    if(page) page.close();
    try{ await e.browser.send('Target.closeTarget',{targetId}); }catch(x){}
    try{ fs.unlinkSync(link); }catch(x){}
  }
}

/* Monta uma grade de PNGs (base64) com rótulos num PNG só — o estresse vira UMA imagem de revisão. */
async function grade(itens,colunas=4,larg=360){
  const e=await motor(), {targetId}=await e.browser.send('Target.createTarget',{url:'about:blank'}); let page;
  try{
    page=await cdp(`ws://127.0.0.1:${e.cdpPort}/devtools/page/${targetId}`);
    const js=`(async(it,cols,w)=>{const im=await Promise.all(it.map(i=>new Promise((ok,no)=>{const x=new Image();x.onload=()=>ok(x);x.onerror=()=>no(new Error('imagem inválida'));x.src='data:image/png;base64,'+i.png;})));
      const hs=im.map(x=>Math.round(x.height*w/x.width)), rows=Math.ceil(im.length/cols), rh=Math.max(...hs)+34, c=document.createElement('canvas'); c.width=cols*(w+12)+12; c.height=rows*rh+12;
      const g=c.getContext('2d'); g.fillStyle='#e9e5ee'; g.fillRect(0,0,c.width,c.height); g.font='700 18px sans-serif';
      im.forEach((x,k)=>{const px=12+(k%cols)*(w+12), py=12+Math.floor(k/cols)*rh; g.fillStyle=it[k].cor||'#222'; g.fillText(it[k].rotulo,px,py+18); g.drawImage(x,px,py+28,w,hs[k]);});
      return c.toDataURL('image/png').split(',')[1];})(${JSON.stringify(itens)},${colunas},${larg})`;
    const r=await page.send('Runtime.evaluate',{expression:js,awaitPromise:true,returnByValue:true});
    if(r.exceptionDetails) throw new Error('falha ao montar a grade'); return r.result.value;
  } finally { if(page) page.close(); try{ await e.browser.send('Target.closeTarget',{targetId}); }catch(x){} }
}

/* Compara dois PNGs (base64): % de pixels que BATEM (diferença máx. por canal ≤ tol) — mesma ideia do selo de fidelidade do importador
   (cobertura, não média: média esconderia um logo inteiro errado). B é esticado ao tamanho de A; ambos sobre fosco branco.
   Devolve {pct, ra, rb, diffPng}; diffPng = A esmaecido com os pixels divergentes em vermelho. */
async function comparar(aB64,bB64,tol=24){
  const e=await motor(), {targetId}=await e.browser.send('Target.createTarget',{url:'about:blank'}); let page;
  try{
    page=await cdp(`ws://127.0.0.1:${e.cdpPort}/devtools/page/${targetId}`);
    const js=`(async(a,b,tol)=>{const ld=s=>new Promise((ok,no)=>{const x=new Image();x.onload=()=>ok(x);x.onerror=()=>no(new Error('PNG inválido'));x.src='data:image/png;base64,'+s;});
      const [A,B]=await Promise.all([ld(a),ld(b)]); const w=A.width,h=A.height, mk=(im)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,w,h);g.drawImage(im,0,0,w,h);return {c,g,d:g.getImageData(0,0,w,h).data};};
      const x=mk(A),y=mk(B),o=document.createElement('canvas');o.width=w;o.height=h;const og=o.getContext('2d'),od=og.createImageData(w,h);let ruim=0;
      for(let i=0;i<x.d.length;i+=4){const d=Math.max(Math.abs(x.d[i]-y.d[i]),Math.abs(x.d[i+1]-y.d[i+1]),Math.abs(x.d[i+2]-y.d[i+2]));
        if(d>tol){ruim++;od.data[i]=230;od.data[i+1]=20;od.data[i+2]=20;od.data[i+3]=255;}else{od.data[i]=255-(255-x.d[i])*0.35;od.data[i+1]=255-(255-x.d[i+1])*0.35;od.data[i+2]=255-(255-x.d[i+2])*0.35;od.data[i+3]=255;}}
      og.putImageData(od,0,0);return JSON.stringify({pct:+(100*(1-ruim/(w*h))).toFixed(1),ra:[A.width,A.height],rb:[B.width,B.height],diffPng:o.toDataURL('image/png').split(',')[1]});})(${JSON.stringify(aB64)},${JSON.stringify(bB64)},${+tol})`;
    const r=await page.send('Runtime.evaluate',{expression:js,awaitPromise:true,returnByValue:true});
    if(r.exceptionDetails) throw new Error((r.exceptionDetails.exception&&r.exceptionDetails.exception.description||'falha na comparação').split('\n')[0]);
    return JSON.parse(r.result.value);
  } finally { if(page) page.close(); try{ await e.browser.send('Target.closeTarget',{targetId}); }catch(x){} }
}

function fechar(){
  if(!estado) return; const e=estado; estado=null;
  try{e.browser.close();}catch(x){} try{e.proc.kill('SIGKILL');}catch(x){} try{e.server.close();}catch(x){}
  try{fs.rmSync(e.udd,{recursive:true,force:true});}catch(x){}
}
process.on('exit',fechar);
for(const s of ['SIGTERM','SIGINT','SIGHUP']) process.on(s,()=>process.exit(0)); /* SIGTERM não dispara 'exit' sozinho: sem isto o Chrome fica órfão */
module.exports={render,renderMuitos,importarPsd,grade,comparar,fechar};
