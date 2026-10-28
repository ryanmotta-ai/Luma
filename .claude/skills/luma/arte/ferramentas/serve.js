/* Servidor estático mínimo para o harness: raiz temporária com atalhos (symlinks) para js/ css/ assets/ do repo.
   Zero dependência. Uso interno do render.js, mas também roda sozinho: node serve.js [porta] */
const http=require('http'), fs=require('fs'), path=require('path'), os=require('os');
const REPO=path.resolve(__dirname,'../../../../..');
const TYPES={'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.otf':'font/otf','.ttf':'font/ttf','.woff':'font/woff','.woff2':'font/woff2','.webp':'image/webp'};
function prepare(){
  const dir=path.join(os.tmpdir(),'luma-arte-srv'); fs.mkdirSync(dir,{recursive:true});
  /* 'junction': no Windows o symlink de pasta exige admin (EPERM); junction não. No Linux/mac o tipo é ignorado. */
  for(const n of ['js','css','assets']){ const l=path.join(dir,n); try{fs.lstatSync(l);}catch(e){fs.symlinkSync(path.join(REPO,n),l,'junction');} }
  fs.copyFileSync(path.join(__dirname,'harness.html'),path.join(dir,'harness.html'));
  return dir;
}
function start(dir,port=0){
  return new Promise(res=>{
    const s=http.createServer((req,rs)=>{
      const f=path.join(dir,decodeURIComponent(req.url.split('?')[0]));
      if(!f.startsWith(dir)) {rs.writeHead(403);return rs.end();}
      fs.readFile(f,(e,b)=>{ if(e){rs.writeHead(404);return rs.end();} rs.writeHead(200,{'Content-Type':TYPES[path.extname(f).toLowerCase()]||'application/octet-stream'}); rs.end(b); });
    }).listen(port,'127.0.0.1',()=>res({server:s,port:s.address().port,dir}));
  });
}
module.exports={prepare,start,REPO};
if(require.main===module){ const d=prepare(); start(d,+process.argv[2]||8765).then(r=>console.log('http://127.0.0.1:'+r.port+'/harness.html  (raiz '+d+')')); }
