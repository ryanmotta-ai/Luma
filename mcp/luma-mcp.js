#!/usr/bin/env node
/* Servidor MCP do Luma (PoC do spike) — zero dependência, Node puro, stdio (JSON-RPC 2.0 por linha).
   Expõe o motor REAL de render do Ateliê/franqueado: cada chamada reusa `arte/ferramentas/render.js`,
   que carrega `fRenderTemplateLayers` + Local Fit num Chromium headless. NÃO é um segundo render
   (03_ENGINEERING §1): se o motor mudar, o MCP muda junto.
   Registrar:  claude mcp add luma -- node /caminho/Luma/mcp/luma-mcp.js     (ver docs/MCP-LUMA-SPIKE-2026-10-29.md)
   Log só em stderr: stdout é o canal do protocolo. */
const fs=require('fs'), os=require('os'), path=require('path'), cp=require('child_process');
const REPO=path.resolve(__dirname,'..');
const FERR=path.join(REPO,'.claude/skills/luma/arte/ferramentas');
const L=require(path.join(FERR,'lib.js'));
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'luma-mcp-'));
let SEQ=0;

/* ---------- ferramentas ---------- */
const run=(args)=>new Promise(ok=>cp.execFile('node',args,{timeout:180000,maxBuffer:1<<26},(e,so,se)=>ok({code:e?(e.code||1):0,out:String(so||''),err:String(se||'')})));
const jobDe=a=>{ if(!Array.isArray(a.layers)||!a.layers.length) throw new Error('`layers` (array de layers do Luma) é obrigatório');
  return L.job(a.layers,{W:a.W||1080,H:a.H||1350,fmt:a.fmt,dados:a.dados||{}}); };
async function renderJobs(jobs){ /* jobs = [[nome, job]] */
  const id='r'+process.pid+'_'+(++SEQ), out=path.join(TMP,id); fs.mkdirSync(out,{recursive:true});
  const files=jobs.map(([n,j])=>{ const f=path.join(out,id+'-'+n+'.json'); fs.writeFileSync(f,JSON.stringify(j)); return f; });
  const r=await run([path.join(FERR,'render.js'),...files,'--out',out]);
  const res=jobs.map(([n])=>{ const b=path.join(out,id+'-'+n); const png=fs.existsSync(b+'.png')?fs.readFileSync(b+'.png').toString('base64'):null;
    let fit={}; try{fit=JSON.parse(fs.readFileSync(b+'.fit.json','utf8'));}catch(e){} return {nome:n,png,fit}; });
  return {res,log:r.out.trim()||r.err.trim()};
}
const resumoFit=(n,f)=>`${n}: ${f.status||'?'}${f.invalid?' · INVÁLIDA (o franqueado seria bloqueado)':''}`+((f.campos||[]).filter(c=>c.status!=='fits'&&c.status!=='vazio').map(c=>` · ${(c.nomes||[c.id]).join('+')}:${c.status}`).join(''));

const TOOLS={
  luma_render:{
    description:'Renderiza uma arte (lista de layers do Luma + dados dos campos) no MESMO motor do franqueado (fRenderTemplateLayers + Local Fit) e devolve o PNG e o veredito do encaixe. `INVÁLIDA` = o franqueado não conseguiria exportar essa combinação de dados.',
    inputSchema:{type:'object',required:['layers'],properties:{
      layers:{type:'array',description:'Layers no formato do banco (luma.templates.layers). Monte com luma_bloco ou leia de um template existente.',items:{type:'object'}},
      dados:{type:'object',description:'Valores dos campos {{var}}: produto, detalhes, descricao, precoDe, precoPor, validade, foto_produto, logo_loja… Use "{{FOTO}}"/"{{LOGO}}" para as imagens de demonstração.',additionalProperties:{type:'string'}},
      W:{type:'integer',description:'Largura em px (padrão 1080)'},H:{type:'integer',description:'Altura em px (1350 = feed, 1920 = story)'},fmt:{type:'string',enum:['feed','story']}}},
    async run(a){ const {res,log}=await renderJobs([['arte',jobDe(a)]]); const r=res[0];
      if(!r.png) return {isError:true,content:[{type:'text',text:'Render sem saída. '+log}]};
      return {content:[{type:'image',data:r.png,mimeType:'image/png'},{type:'text',text:resumoFit('arte',r.fit)+'\n'+JSON.stringify(r.fit.campos||[])}]}; }},
  luma_estresse:{
    description:'Roda a arte nas 7 variantes de estresse que toda arte do Luma passa antes de sair (título longo, sem detalhes, sem "de", preço de 1 e 3 dígitos, sem preço) e resume o encaixe de cada uma. Uma variante INVÁLIDA = a arte tem bug.',
    inputSchema:{type:'object',required:['layers'],properties:{layers:{type:'array',items:{type:'object'}},dados:{type:'object',additionalProperties:{type:'string'}},W:{type:'integer'},H:{type:'integer'},fmt:{type:'string',enum:['feed','story']}}},
    async run(a){ const jobs=Object.entries(L.ESTRESSE).map(([k,v])=>[k,jobDe(Object.assign({},a,{dados:Object.assign({},a.dados,v)}))]);
      const {res}=await renderJobs(jobs); const bad=res.filter(r=>!r.png||r.fit.invalid||(r.fit.campos||[]).some(c=>c.status!=='fits'&&c.status!=='vazio'));
      const txt=res.map(r=>r.png?resumoFit(r.nome,r.fit):r.nome+': SEM SAÍDA').join('\n')+`\n\n${bad.length?bad.length+' variante(s) com problema':'todas as 7 passaram'}.`;
      const first=bad.find(r=>r.png)||res.find(r=>r.png);
      return {content:[{type:'text',text:txt}].concat(first?[{type:'image',data:first.png,mimeType:'image/png'}]:[])}; }},
  luma_bloco:{
    description:'Monta UM bloco de layer(s) com a biblioteca oficial (arte/ferramentas/lib.js). Sem `bloco`, lista os blocos disponíveis. Devolve o JSON pronto para entrar em `layers`.',
    inputSchema:{type:'object',properties:{bloco:{type:'string',description:'rect, text, img, foto, logoLoja, banner, selo, preco, seloSerrilhado, sparkle, star, rotarGrupo, descricaoComSem, ticket, ticketRot'},args:{type:'array',description:'Argumentos posicionais da função (ver assinatura em lib.js)',items:{}}}},
    async run(a){ const ok=['rect','text','img','foto','logoLoja','banner','selo','preco','seloSerrilhado','sparkle','star','rotarGrupo','descricaoComSem','ticket','ticketRot'];
      if(!a.bloco) return {content:[{type:'text',text:'Blocos: '+ok.join(', ')+'\nAssinaturas: leia luma://doc/ferramentas-lib'}]};
      if(!ok.includes(a.bloco)) throw new Error('bloco desconhecido: '+a.bloco);
      return {content:[{type:'text',text:JSON.stringify(L[a.bloco](...(a.args||[])))}]}; }},
  luma_medir:{
    description:'Mede um PNG (renders ou referências): bordas da tinta numa faixa, cor de um pixel, paleta, caixa de uma cor.',
    inputSchema:{type:'object',required:['cmd','png'],properties:{cmd:{type:'string',enum:['bordas','cor','paleta','caixa']},png:{type:'string',description:'caminho absoluto do PNG'},args:{type:'array',items:{type:['string','number']},description:'argumentos do subcomando (ver medir.js)'}}},
    async run(a){ const r=await run([path.join(FERR,'medir.js'),a.cmd,a.png,...(a.args||[]).map(String)]); return {isError:!!r.code,content:[{type:'text',text:(r.out||r.err).trim()}]}; }}
};

/* ---------- recursos (a "mente" do projeto, só leitura) ---------- */
const DOCS={
  'arte':['luma-brain/../.claude/skills/luma/arte/ARTE.md','Fluxo completo de pedido de arte'],
  'motor':['.claude/skills/luma/arte/MOTOR.md','Como o render e o Local Fit funcionam (layers, regras, armadilhas)'],
  'design':['.claude/skills/luma/arte/DESIGN.md','Grade, escala tipográfica, paleta, proibições'],
  'negocio':['luma-brain/01_BUSINESS.md','Regras de domínio do Luma'],
  'ferramentas-lib':['.claude/skills/luma/arte/ferramentas/lib.js','Blocos de layer (assinaturas)']
};
DOCS.arte[0]='.claude/skills/luma/arte/ARTE.md';
const RES=Object.entries(DOCS).map(([k,[p,d]])=>({uri:'luma://doc/'+k,name:k,description:d,mimeType:p.endsWith('.js')?'text/javascript':'text/markdown'}));

/* ---------- prompts ---------- */
const PROMPTS={
  arte_de_preco:{description:'Monta e valida uma arte de preço do Luma (feed + story) seguindo o fluxo do Ateliê.',arguments:[{name:'produto',description:'Ex.: Açaí na tigela 500 ml',required:true},{name:'preco',description:'Ex.: R$ 22,90',required:false}],
    text:a=>`Crie uma arte de preço do Luma para "${a.produto}"${a.preco?` por ${a.preco}`:''}.\n1. Leia luma://doc/arte, luma://doc/motor e luma://doc/design antes de desenhar.\n2. Monte as layers com luma_bloco (grade 72/8, Realce nos títulos).\n3. Renderize com luma_render e OLHE a imagem.\n4. Rode luma_estresse; corrija até as 7 variantes passarem.\n5. Entregue feed (1080×1350) e story (1080×1920) com os mesmos ids de layer. Proposta não é aplicar: mostre o resultado e só grave no banco se pedirem.`}
};

/* ---------- JSON-RPC ---------- */
const send=m=>process.stdout.write(JSON.stringify(Object.assign({jsonrpc:'2.0'},m))+'\n');
const ok=(id,result)=>send({id,result}), fail=(id,code,message)=>send({id,error:{code,message}});
async function handle(m){
  const {id,method,params={}}=m; if(id===undefined) return; /* notificação: sem resposta */
  try{
    if(method==='initialize') return ok(id,{protocolVersion:params.protocolVersion||'2025-06-18',capabilities:{tools:{},resources:{},prompts:{}},serverInfo:{name:'luma',version:'0.1.0-poc'},
      instructions:'Motor de render do Luma. Leia luma://doc/arte antes de criar arte; valide sempre com luma_estresse.'});
    if(method==='ping') return ok(id,{});
    if(method==='tools/list') return ok(id,{tools:Object.entries(TOOLS).map(([name,t])=>({name,description:t.description,inputSchema:t.inputSchema}))});
    if(method==='tools/call'){ const t=TOOLS[params.name]; if(!t) return fail(id,-32602,'ferramenta desconhecida: '+params.name);
      try{ return ok(id,await t.run(params.arguments||{})); }catch(e){ return ok(id,{isError:true,content:[{type:'text',text:String(e.message||e)}]}); } }
    if(method==='resources/list') return ok(id,{resources:RES});
    if(method==='resources/read'){ const k=String(params.uri||'').replace('luma://doc/',''), d=DOCS[k]; if(!d) return fail(id,-32002,'recurso desconhecido');
      return ok(id,{contents:[{uri:params.uri,mimeType:'text/plain',text:fs.readFileSync(path.join(REPO,d[0]),'utf8')}]}); }
    if(method==='prompts/list') return ok(id,{prompts:Object.entries(PROMPTS).map(([name,p])=>({name,description:p.description,arguments:p.arguments}))});
    if(method==='prompts/get'){ const p=PROMPTS[params.name]; if(!p) return fail(id,-32602,'prompt desconhecido'); return ok(id,{description:p.description,messages:[{role:'user',content:{type:'text',text:p.text(params.arguments||{})}}]}); }
    return fail(id,-32601,'método não suportado: '+method);
  }catch(e){ fail(id,-32603,String(e.message||e)); }
}
let buf=''; process.stdin.setEncoding('utf8');
process.stdin.on('data',c=>{ buf+=c; let i; while((i=buf.indexOf('\n'))>=0){ const ln=buf.slice(0,i).trim(); buf=buf.slice(i+1); if(!ln) continue; let m; try{m=JSON.parse(ln);}catch(e){ fail(null,-32700,'JSON inválido'); continue; } handle(m); } });
process.on('exit',()=>{ try{fs.rmSync(TMP,{recursive:true,force:true});}catch(e){} });
