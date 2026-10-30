/* Leitura do banco do Luma (Supabase/PostgREST, schema `luma`) para o MCP. SOMENTE LEITURA.
   A fronteira de segurança é a RLS: a anon key é pública (a mesma de js/core/supabase-config.js) e quem
   autoriza é o JWT do usuário. Nunca service_role. Credencial vem do ambiente do processo, nunca de arquivo:
     LUMA_JWT                      access token do designer (expira em ~1 h), OU
     LUMA_EMAIL + LUMA_SENHA       login automático (renova sozinho ao expirar). */
const fs=require('fs'), path=require('path');
const cfg=fs.readFileSync(path.join(__dirname,'../js/core/supabase-config.js'),'utf8');
const URL_=(cfg.match(/url:\s*'([^']+)'/)||[])[1], KEY=(cfg.match(/anonKey:\s*'([^']+)'/)||[])[1];
let jwt=process.env.LUMA_JWT||'';

async function login(){
  const {LUMA_EMAIL:email,LUMA_SENHA:password}=process.env; if(!email||!password) return false;
  const r=await fetch(URL_+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  if(!r.ok) throw new Error('login no Supabase falhou ('+r.status+'): confira LUMA_EMAIL/LUMA_SENHA');
  jwt=(await r.json()).access_token; return true;
}
const autenticado=()=>!!(jwt||(process.env.LUMA_EMAIL&&process.env.LUMA_SENHA));

/* GET em luma.<tabela>?<query> → array de linhas. Renova o login uma vez se vier 401. */
async function ler(tabela,query){
  if(!jwt) await login();
  for(let t=0;t<2;t++){
    const r=await fetch(`${URL_}/rest/v1/${tabela}?${query}`,{headers:{apikey:KEY,Authorization:'Bearer '+(jwt||KEY),'Accept-Profile':'luma'}});
    if(r.status===401&&t===0&&await login()) continue;
    if((r.status===401||r.status===403)&&!autenticado()) throw new Error('Sem acesso (RLS). Defina LUMA_JWT (token do designer) ou LUMA_EMAIL + LUMA_SENHA no ambiente do servidor MCP.');
    if(!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0,300)}`);
    return r.json();
  }
}
/* Escrita (POST/PATCH) em luma.<tabela>. Quem autoriza é a RLS do usuário; sem login não há escrita. */
async function escrever(metodo,tabela,query,body){
  if(!autenticado()) throw new Error('Escrita exige login: defina LUMA_JWT ou LUMA_EMAIL + LUMA_SENHA.');
  if(!jwt) await login();
  for(let t=0;t<2;t++){
    const r=await fetch(`${URL_}/rest/v1/${tabela}${query?'?'+query:''}`,{method:metodo,headers:{apikey:KEY,Authorization:'Bearer '+jwt,'Content-Profile':'luma','Accept-Profile':'luma','Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(body)});
    if(r.status===401&&t===0&&await login()) continue;
    if(!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0,300)}`);
    return r.json();
  }
}
async function rpc(nome,args){
  if(!autenticado()) throw new Error('Exige login: defina LUMA_JWT ou LUMA_EMAIL + LUMA_SENHA.'); if(!jwt) await login();
  const r=await fetch(`${URL_}/rest/v1/rpc/${nome}`,{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+jwt,'Content-Profile':'luma','Content-Type':'application/json'},body:JSON.stringify(args)});
  if(!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0,300)}`); return r.json();
}
/* id do usuário logado (claim `sub` do JWT) — vira `criado_por` dos templates que o MCP cria */
function usuarioId(){ try{ return JSON.parse(Buffer.from(jwt.split('.')[1],'base64url').toString()).sub; }catch(e){ return null; } }
const SEM_ACESSO='Nenhuma linha veio. Sem login o RLS esconde os templates: defina LUMA_JWT (token do designer) ou LUMA_EMAIL + LUMA_SENHA no ambiente do servidor MCP.';
module.exports={ler,escrever,rpc,usuarioId,autenticado,SEM_ACESSO};
