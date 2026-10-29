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

function fechar(){
  if(!estado) return; const e=estado; estado=null;
  try{e.browser.close();}catch(x){} try{e.proc.kill('SIGKILL');}catch(x){} try{e.server.close();}catch(x){}
  try{fs.rmSync(e.udd,{recursive:true,force:true});}catch(x){}
}
process.on('exit',fechar);
for(const s of ['SIGTERM','SIGINT','SIGHUP']) process.on(s,()=>process.exit(0)); /* SIGTERM não dispara 'exit' sozinho: sem isto o Chrome fica órfão */
module.exports={render,renderMuitos,fechar};
