#!/usr/bin/env node
/* Renderiza um ou mais jobs no MESMO motor do franqueado (fRenderTemplateLayers + Local Fit) e grava o PNG.
   Uso:  node render.js job.json [job2.json ...] [--out pasta] [--mode export|preview]
   Job = {W,H,fmt,layers,dados}. `dados` pode usar {{FOTO}} e {{LOGO}}: viram imagens de demo do repo.
   Saída por job:  <nome>.png · <nome>.layers.json · <nome>.fit.json · e uma linha de resumo no terminal.
   Zero dependência: usa o Chromium que já existe na máquina (CHROME=… para apontar outro). */
const fs=require('fs'), path=require('path'), cp=require('child_process');
const {prepare,start}=require('./serve.js');
function chrome(){
  if(process.env.CHROME) return process.env.CHROME;
  const g=require('child_process').spawnSync('sh',['-c','ls /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -1; command -v chromium chromium-browser google-chrome 2>/dev/null | head -1']).stdout.toString().split('\n').filter(Boolean);
  if(!g.length) throw new Error('Chromium não encontrado (defina CHROME=/caminho)'); return g[0];
}
const un=s=>s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
(async()=>{
  const args=process.argv.slice(2); let out='.', mode='export', jobs=[];
  for(let i=0;i<args.length;i++){ if(args[i]==='--out') out=args[++i]; else if(args[i]==='--mode') mode=args[++i]; else jobs.push(args[i]); }
  if(!jobs.length){ console.error('uso: node render.js job.json [...] [--out pasta] [--mode export|preview]'); process.exit(2); }
  fs.mkdirSync(out,{recursive:true});
  const dir=prepare(), {server,port}=await start(dir), bin=chrome(); let falhas=0;
  for(const jf of jobs){
    const nome=path.basename(jf,'.json'); const job=JSON.parse(fs.readFileSync(jf,'utf8'));
    const base='http://127.0.0.1:'+port+'/assets/demo/';
    const d=job.dados=job.dados||{}; for(const k of Object.keys(d)){ if(d[k]==='{{FOTO}}') d[k]=base+'burger-batata.jpg'; if(d[k]==='{{LOGO}}') d[k]=base+'logo-sushi-kai.png'; }
    fs.writeFileSync(path.join(dir,'job_'+nome+'.json'),JSON.stringify(job));
    /* assíncrono de propósito: o servidor está NESTE processo; um spawnSync travaria o event loop e o Chromium nunca receberia a página */
    const dom=await new Promise(ok=>{ const c=cp.spawn(bin,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--virtual-time-budget=40000','--dump-dom',`http://127.0.0.1:${port}/harness.html?k=${nome}&p=${mode}`],{stdio:['ignore','pipe','ignore']}); let o=''; c.stdout.on('data',d=>o+=d); const t=setTimeout(()=>c.kill('SIGKILL'),120000); c.on('close',()=>{clearTimeout(t);ok(o);}); });
    const m=dom.match(/id="out"[^>]*/);
    if(!m){ console.log(nome+': SEM SAÍDA (o harness não terminou)'); falhas++; continue; }
    const a=m[0]; const get=n=>{const x=a.match(new RegExp('data-'+n+'="([^"]*)"'));return x?un(x[1]):'';};
    const err=get('err'); if(err){ console.log(nome+': ERRO '+err.slice(0,300)); falhas++; }
    const png=get('png').replace(/^data:image\/png;base64,/,''); if(png) fs.writeFileSync(path.join(out,nome+'.png'),Buffer.from(png,'base64'));
    fs.writeFileSync(path.join(out,nome+'.layers.json'),get('layers'));
    let res={}; try{res=JSON.parse(get('result')||'{}');}catch(e){}
    fs.writeFileSync(path.join(out,nome+'.fit.json'),JSON.stringify(res,null,1));
    const ruim=(res.campos||[]).filter(c=>c.status!=='fits'&&c.status!=='vazio').map(c=>(c.nomes||[c.id]).join('+')+':'+c.status);
    console.log(`${nome}: ${res.status||'?'}${res.invalid?' · INVÁLIDA (bloqueia exportação)':''}${ruim.length?' · '+ruim.join(', '):''}  → ${path.join(out,nome+'.png')}`);
    if(res.invalid) falhas++;
  }
  server.close(); process.exit(falhas?1:0);
})();
