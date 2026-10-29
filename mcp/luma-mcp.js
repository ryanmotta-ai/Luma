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
const motor=require('./motor.js'), banco=require('./banco.js');

/* ---------- ferramentas ---------- */
const run=(args)=>new Promise(ok=>cp.execFile('node',args,{timeout:180000,maxBuffer:1<<26},(e,so,se)=>ok({code:e?(e.code||1):0,out:String(so||''),err:String(se||'')})));
const UUID=/^[0-9a-f-]{36}$/i;
const arte=require('./arte.js');
/* Fonte das layers, nesta ordem: `layers` explícito · `layers_arquivo` (ex.: o .layers.json do luma_psd_importar) · `template_id` (banco, RLS do usuário). */
async function resolver(a){
  if(Array.isArray(a.layers)&&a.layers.length) return {layers:a.layers,W:a.W,H:a.H,fmt:a.fmt};
  if(a.layers_arquivo){ const f=path.resolve(String(a.layers_arquivo)); if(!/\.json$/i.test(f)||!fs.existsSync(f)) throw new Error('layers_arquivo deve ser um .json existente'); const l=JSON.parse(fs.readFileSync(f,'utf8')); if(!Array.isArray(l)||!l.length) throw new Error('layers_arquivo sem layers'); return {layers:l,W:a.W,H:a.H,fmt:a.fmt}; }
  if(a.template_id){ if(!UUID.test(a.template_id)) throw new Error('template_id inválido');
    const [t]=await banco.ler('templates',`id=eq.${a.template_id}&select=layers,w,h,fmt`); if(!t) throw new Error('template não encontrado. '+banco.SEM_ACESSO);
    return {layers:t.layers,W:a.W||t.w,H:a.H||t.h,fmt:a.fmt||t.fmt}; }
  throw new Error('informe `layers`, `layers_arquivo` ou `template_id`');
}
const jobDe=async a=>{ const r=await resolver(a); return L.job(r.layers,{W:r.W||1080,H:r.H||1350,fmt:r.fmt,dados:a.dados||{}}); };
const FONTE={template_id:{type:'string',description:'UUID de um template do banco (luma_templates_listar)'},layers_arquivo:{type:'string',description:'caminho de um .layers.json (ex.: saída do luma_psd_importar)'},layers:{type:'array',items:{type:'object'},description:'layers no formato do banco'},W:{type:'integer'},H:{type:'integer'},fmt:{type:'string',enum:['feed','story']}};
const DADOS={type:'object',description:'valores dos campos {{var}}; "{{FOTO}}"/"{{LOGO}}" = imagens de demonstração',additionalProperties:{type:'string'}};
const img=(r)=>r.png?[{type:'image',data:r.png,mimeType:'image/png'}]:[];
/* jobs = [[nome, job]] → [{nome,png,fit,err}]. Chrome persistente (motor.js): abas em paralelo, sem subir navegador a cada chamada. */
async function renderJobs(jobs){
  const r=await motor.renderMuitos(jobs.map(j=>j[1]));
  return {res:jobs.map(([n],i)=>({nome:n,png:r[i].png||null,fit:r[i].fit||{},err:r[i].err})),log:r.map(x=>x.err).filter(Boolean).join(' | ')};
}
const resumoFit=(n,f)=>`${n}: ${f.status||'?'}${f.invalid?' · INVÁLIDA (o franqueado seria bloqueado)':''}`+((f.campos||[]).filter(c=>c.status!=='fits'&&c.status!=='vazio').map(c=>` · ${(c.nomes||[c.id]).join('+')}:${c.status}`).join(''));

const TOOLS={
  luma_render:{
    description:'Renderiza uma arte (lista de layers do Luma + dados dos campos) no MESMO motor do franqueado (fRenderTemplateLayers + Local Fit) e devolve o PNG e o veredito do encaixe. `INVÁLIDA` = o franqueado não conseguiria exportar essa combinação de dados.',
    inputSchema:{type:'object',properties:{
      template_id:{type:'string',description:'UUID de um template do banco (use luma_templates_listar). Alternativa a `layers`.'},
      layers_arquivo:{type:'string',description:'caminho de um .layers.json (ex.: saída do luma_psd_importar). Alternativa a `layers`.'},
      salvar_em:{type:'string',description:'caminho .png para gravar o render em disco (além de devolvê-lo)'},
      layers:{type:'array',description:'Layers no formato do banco (luma.templates.layers). Monte com luma_bloco ou leia de um template existente.',items:{type:'object'}},
      dados:{type:'object',description:'Valores dos campos {{var}}: produto, detalhes, descricao, precoDe, precoPor, validade, foto_produto, logo_loja… Use "{{FOTO}}"/"{{LOGO}}" para as imagens de demonstração.',additionalProperties:{type:'string'}},
      W:{type:'integer',description:'Largura em px (padrão 1080)'},H:{type:'integer',description:'Altura em px (1350 = feed, 1920 = story)'},fmt:{type:'string',enum:['feed','story']}}},
    async run(a){ const {res,log}=await renderJobs([['arte',await jobDe(a)]]); const r=res[0];
      if(!r.png) return {isError:true,content:[{type:'text',text:'Render sem saída. '+log}]};
      if(a.salvar_em){ const f=path.resolve(String(a.salvar_em)); if(!/\.png$/i.test(f)) throw new Error('salvar_em deve terminar em .png'); fs.mkdirSync(path.dirname(f),{recursive:true}); fs.writeFileSync(f,Buffer.from(r.png,'base64')); r.fit._salvo=f; }
      return {content:[{type:'image',data:r.png,mimeType:'image/png'},{type:'text',text:resumoFit('arte',r.fit)+(r.fit._salvo?'\nSalvo em '+r.fit._salvo:'')+'\n'+JSON.stringify(r.fit.campos||[])}]}; }},
  luma_estresse:{
    description:'Roda a arte nas 7 variantes de estresse que toda arte do Luma passa antes de sair (título longo, sem detalhes, sem "de", preço de 1 e 3 dígitos, sem preço) e devolve UMA grade com as 7 imagens (borda vermelha no rótulo = variante com problema) + o resumo do encaixe de cada uma.',
    inputSchema:{type:'object',properties:Object.assign({dados:DADOS},FONTE)},
    async run(a){ const r0=await resolver(a); a=Object.assign({},a,{layers:r0.layers,W:a.W||r0.W,H:a.H||r0.H,fmt:a.fmt||r0.fmt});
      const jobs=await Promise.all(Object.entries(L.ESTRESSE).map(async([k,v])=>[k,await jobDe(Object.assign({},a,{dados:Object.assign({},a.dados,v)}))]));
      const {res}=await renderJobs(jobs); const ruim=r=>!r.png||r.fit.invalid||(r.fit.campos||[]).some(c=>c.status!=='fits'&&c.status!=='vazio'); const bad=res.filter(ruim);
      const txt=res.map(r=>r.png?resumoFit(r.nome,r.fit):r.nome+': SEM SAÍDA').join('\n')+`\n\n${bad.length?bad.length+' variante(s) com problema: '+bad.map(r=>r.nome).join(', '):'todas as 7 passaram'}.`;
      const ok=res.filter(r=>r.png); let g=null; if(ok.length) g=await motor.grade(ok.map(r=>({png:r.png,rotulo:(ruim(r)?'✗ ':'✓ ')+r.nome,cor:ruim(r)?'#c81414':'#1a6b2e'})),4,a.W>=1000?340:360);
      return {content:[{type:'text',text:txt}].concat(g?[{type:'image',data:g,mimeType:'image/png'}]:[])}; }},
  luma_editar_layers:{
    description:'Edita uma arte por INSTRUÇÃO, sem reenviar o JSON inteiro: `patches` {id:{campo:valor}} (mover, cor, texto, esconder…), `remover` [ids], `adicionar` [layers novas]. Aplica por id (ordem preservada), renderiza e devolve a imagem + o veredito. Com `devolver_layers:true` devolve também o JSON novo para encadear.',
    inputSchema:{type:'object',properties:Object.assign({patches:{type:'object',description:'{ "l-prod": {"y":340,"fontSize":72}, "l-bg": {"fill":"#fbf2ff"} }'},remover:{type:'array',items:{type:'string'}},adicionar:{type:'array',items:{type:'object'}},devolver_layers:{type:'boolean'},dados:DADOS},FONTE)},
    async run(a){ const r0=await resolver(a); const e=arte.aplicarPatches(r0.layers,a.patches||{},a.remover||[],a.adicionar||[]);
      const {res}=await renderJobs([['arte',L.job(e.layers,{W:a.W||r0.W||1080,H:a.H||r0.H||1350,fmt:a.fmt||r0.fmt,dados:a.dados||{}})]]); const r=res[0];
      const txt=(r.png?resumoFit('arte',r.fit):'SEM SAÍDA '+r.err)+(e.avisos.length?'\nAvisos:\n'+e.avisos.join('\n'):'')+(a.devolver_layers?'\n\nlayers:\n'+JSON.stringify(e.layers):'');
      return {isError:!r.png,content:[{type:'text',text:txt}].concat(img(r))}; }},
  luma_derivar_story:{
    description:'Deriva o STORY (1080×1920) do FEED (1080×1350) por id de layer — mesmo conjunto de ids, só mudam y/h (o Ateliê pede os dois com o mesmo nome). Padrão: o fundo cresce e o que vive no rodapé desce; `patches` explícitos vencem (ex.: a foto crescer). Renderiza feed e story juntos e avisa sobre a zona segura do story. `devolver_layers:true` traz o JSON do story.',
    inputSchema:{type:'object',properties:Object.assign({patches:{type:'object',description:'patches só do story, por id: {"l-foto":{"h":900}}'},devolver_layers:{type:'boolean'},dados:DADOS},FONTE)},
    async run(a){ const r0=await resolver(a), W=a.W||r0.W||1080, HF=a.H||r0.H||1350, HS=1920; const s=arte.derivarStory(r0.layers,a.patches||{},{HF,HS});
      const {res}=await renderJobs([['feed',L.job(r0.layers,{W,H:HF,fmt:'feed',dados:a.dados||{}})],['story',L.job(s.layers,{W,H:HS,fmt:'story',dados:a.dados||{}})]]);
      const txt=res.map(r=>r.png?resumoFit(r.nome,r.fit):r.nome+': SEM SAÍDA').join('\n')+(s.avisos.length?'\nAvisos:\n'+s.avisos.join('\n'):'')+'\nAjustes automáticos: '+(Object.keys(s.auto).join(', ')||'nenhum')+(a.devolver_layers?'\n\nlayers do story:\n'+JSON.stringify(s.layers):'');
      return {content:[{type:'text',text:txt}].concat(...res.map(img))}; }},
  luma_auditar:{
    description:'Audita uma arte contra as regras de marca do DESIGN.md (estático, sem render): ids, fora do canvas, margem de 72, corpo mínimo, contraste ≥ 4,5:1 por texto × fundo, paleta, família de raio, zona segura do story. ERRO bloqueia publicar.',
    inputSchema:{type:'object',properties:FONTE},
    async run(a){ const r=await resolver(a); const au=arte.auditar(r.layers,r.W||1080,r.H||1350); return {content:[{type:'text',text:`${au.filter(x=>x.nivel==='erro').length} erro(s) · ${au.filter(x=>x.nivel==='aviso').length} aviso(s)\n`+arte.resumoAuditoria(au)}]}; }},
  luma_variaveis:{
    description:'Lista o catálogo de campos {{var}} (luma.variaveis): nome, rótulo, tipo, se é obrigatório e a categoria. Consulte antes de desenhar: campo fora do catálogo vira obrigatório no chat do franqueado.',
    inputSchema:{type:'object',properties:{}},
    async run(){ const v=await banco.ler('variaveis','select=name,label,type,required,category&order=ordem'); if(!v.length) return {content:[{type:'text',text:banco.SEM_ACESSO}]};
      return {content:[{type:'text',text:v.map(x=>`${x.name} · ${x.label} · ${x.type} · ${x.required?'obrigatório':'opcional'}${x.category?' · '+x.category:''}`).join('\n')}]}; }},
  luma_pastas:{
    description:'Lista as pastas (campanhas) do banco: id, nome e camp_id. Necessário para criar template (pasta_id).',
    inputSchema:{type:'object',properties:{busca:{type:'string'}}},
    async run(a){ let p=await banco.ler('pastas','select=id,nome,camp_id&order=nome&limit=500'); if(a.busca) p=p.filter(x=>x.nome.toLowerCase().includes(String(a.busca).toLowerCase()));
      return {content:[{type:'text',text:p.length?p.map(x=>`${x.id} · ${x.nome}${x.camp_id?' · camp '+x.camp_id:''}`).join('\n'):banco.SEM_ACESSO}]}; }},
  luma_templates_listar:{
    description:'Lista templates do banco (somente leitura, respeita o RLS do usuário). Filtra por nome da pasta/campanha e/ou do template. Devolve id, nome, formato, pasta e se está publicado. Requer LUMA_JWT ou LUMA_EMAIL+LUMA_SENHA no ambiente do servidor.',
    inputSchema:{type:'object',properties:{busca:{type:'string',description:'trecho do nome do template ou da pasta'},fmt:{type:'string',enum:['feed','story']},publicado:{type:'boolean'},limite:{type:'integer',description:'padrão 30, máx. 100'}}},
    async run(a){ const lim=Math.min(Math.max(+a.limite||30,1),100), esc=v=>encodeURIComponent(String(v).replace(/[*,()]/g,' '));
      const pastas=await banco.ler('pastas','select=id,nome&limit=1000'), nomePasta=new Map(pastas.map(p=>[p.id,p.nome]));
      let q=`select=id,nome,fmt,pasta_id,publicado,w,h&order=created_at.desc&limit=${a.busca?500:lim}`;
      if(a.fmt) q+='&fmt=eq.'+a.fmt; if(typeof a.publicado==='boolean') q+='&publicado=is.'+a.publicado;
      let ts=await banco.ler('templates',q);
      if(a.busca){ const b=String(a.busca).toLowerCase(); ts=ts.filter(t=>t.nome.toLowerCase().includes(b)||String(nomePasta.get(t.pasta_id)||'').toLowerCase().includes(b)).slice(0,lim); }
      if(!ts.length) return {content:[{type:'text',text:banco.autenticado()?'Nenhum template encontrado com esse filtro.':banco.SEM_ACESSO}]};
      return {content:[{type:'text',text:ts.map(t=>`${t.id} · ${t.nome} · ${t.fmt} ${t.w}×${t.h} · pasta: ${nomePasta.get(t.pasta_id)||'?'} · ${t.publicado?'publicado':'rascunho'}`).join('\n')}]}; }},
  luma_template_ler:{
    description:'Lê UM template do banco (somente leitura): layers (JSON), permissões por campo, tamanho e instruções. Use para entender ou adaptar uma arte existente. Para só ver a imagem, use luma_render com template_id.',
    inputSchema:{type:'object',required:['id'],properties:{id:{type:'string',description:'UUID do template'}}},
    async run(a){ if(!UUID.test(a.id||'')) throw new Error('id inválido'); const [t]=await banco.ler('templates',`id=eq.${a.id}&select=id,nome,fmt,w,h,bg,publicado,permissoes,instrucoes,layers`);
      if(!t) return {isError:true,content:[{type:'text',text:'Template não encontrado. '+banco.SEM_ACESSO}]};
      const {layers,...meta}=t; return {content:[{type:'text',text:JSON.stringify(meta)+'\n\nlayers ('+layers.length+'):\n'+JSON.stringify(layers)}]}; }},
  luma_psd_importar:{
    description:'Importa um .psd pelo MESMO importador do Estúdio (psd-parse.js) e exporta PNG de cada prancheta: o render da Luma (<nn>-<nome>.png, tamanho nativo) e, quando a prancheta está dentro da área do documento, o composto do Photoshop (<nn>-<nome>.photoshop.png) para comparar. Também grava as layers (<nn>-<nome>.layers.json) prontas para luma_render. Não grava nada no banco. Pranchetas ocultas vêm marcadas.',
    inputSchema:{type:'object',required:['psd'],properties:{psd:{type:'string',description:'caminho absoluto do .psd'},saida:{type:'string',description:'pasta de saída (padrão: <pasta do psd>/<nome>-luma-png)'},pranchetas:{type:'array',items:{type:'integer'},description:'números (1…N) das pranchetas a devolver como imagem na resposta; padrão: as 3 primeiras. Todas são gravadas em disco.'}}},
    async run(a){ const psd=path.resolve(String(a.psd||'')); if(!/\.psd$/i.test(psd)) throw new Error('`psd` deve ser um caminho absoluto de arquivo .psd');
      let st; try{st=fs.statSync(psd);}catch(e){ throw new Error('arquivo não encontrado: '+psd); } if(!st.size) throw new Error('o arquivo está vazio (0 bytes) — o download/cópia foi interrompido; baixe de novo');
      const saida=a.saida?path.resolve(a.saida):path.join(path.dirname(psd),path.basename(psd,path.extname(psd))+'-luma-png');
      const o=await motor.importarPsd(psd,saida);
      for(const b of o.boards){ if(b.arquivos.ref&&b.arquivos.luma){ try{ b.fid=(await motor.comparar(fs.readFileSync(b.arquivos.ref).toString('base64'),fs.readFileSync(b.arquivos.luma).toString('base64'))).pct; }catch(e){} } }
      const linhas=o.boards.map((b,i)=>`${i+1}. ${b.nome} · ${b.w}×${b.h}${b.oculta?' · OCULTA':''} · ${b.camadas??'?'} camadas${b.erro?' · ERRO: '+b.erro.split('\n')[0]:''}${b.fid!=null?' · fidelidade '+b.fid+'%':(b.arquivos.ref?'':' · sem composto do Photoshop')}\n   ${b.arquivos.luma||'(sem PNG)'}`);
      const quais=(a.pranchetas&&a.pranchetas.length?a.pranchetas:[1,2,3]).filter(n=>o.boards[n-1]&&o.boards[n-1].arquivos.luma);
      return {content:[{type:'text',text:`${o.boards.length} prancheta(s) · ${Math.round(o.res)} ppi · pasta: ${saida}\n`+linhas.join('\n')}].concat(quais.map(n=>({type:'image',data:fs.readFileSync(o.boards[n-1].arquivos.luma).toString('base64'),mimeType:'image/png'})))}; }},
  luma_template_salvar:{
    description:'ESCREVE no banco: cria um template RASCUNHO (publicado=false) em luma.templates. Copia formats/permissoes/bg de um template irmão (`copiar_de`). Sem `confirmar:true` só mostra o que faria (dry-run). Recusa imagens embutidas (data:/idb://): elas não sobem pelo MCP — suba pelo Estúdio. Valida com a auditoria (erro bloqueia).',
    inputSchema:{type:'object',required:['pasta_id','nome','fmt'],properties:Object.assign({pasta_id:{type:'string'},nome:{type:'string'},copiar_de:{type:'string',description:'UUID de um template irmão (formats/permissoes/bg)'},confirmar:{type:'boolean',description:'true para gravar de verdade'},permitir_imagens_embutidas:{type:'boolean'}},FONTE)},
    async run(a){ if(!UUID.test(a.pasta_id||'')) throw new Error('pasta_id inválido'); if(!['feed','story'].includes(a.fmt)) throw new Error('fmt deve ser feed ou story');
      const r=await resolver(a), W=a.W||r.W||1080, H=a.H||r.H||(a.fmt==='story'?1920:1350), au=arte.auditar(r.layers,W,H), erros=au.filter(x=>x.nivel==='erro');
      const emb=r.layers.filter(l=>typeof l.imgUrl==='string'&&/^(data:|idb:\/\/|__local__)/.test(l.imgUrl)).map(l=>l.id);
      const kb=Math.round(JSON.stringify(r.layers).length/1024);
      const plano=`criar rascunho "${a.nome}" (${a.fmt} ${W}×${H}) na pasta ${a.pasta_id} · ${r.layers.length} layers · ${kb} KB${a.copiar_de?' · modelo '+a.copiar_de:' · SEM irmão (formats/permissoes ficam vazios)'}`;
      if(erros.length) return {isError:true,content:[{type:'text',text:'Recusado pela auditoria:\n'+arte.resumoAuditoria(erros)}]};
      if(emb.length&&!a.permitir_imagens_embutidas) return {isError:true,content:[{type:'text',text:`Recusado: ${emb.length} layer(s) com imagem embutida/local (${emb.slice(0,6).join(', ')}). Elas não existem no Storage — abra no Estúdio para subir, ou use URLs de assets/.`}]};
      if(!a.confirmar) return {content:[{type:'text',text:'DRY-RUN (nada gravado). Faria: '+plano+'\nRefaça com confirmar:true para gravar.'}]};
      let m={}; if(a.copiar_de){ if(!UUID.test(a.copiar_de)) throw new Error('copiar_de inválido'); [m]=await banco.ler('templates',`id=eq.${a.copiar_de}&select=formats,permissoes,bg`); if(!m) throw new Error('template irmão não encontrado'); }
      const [novo]=await banco.escrever('POST','templates','',{pasta_id:a.pasta_id,nome:a.nome,fmt:a.fmt,formats:m.formats,permissoes:m.permissoes,bg:m.bg||'transparent',layers:r.layers,publicado:false,criado_por:banco.usuarioId(),w:W,h:H});
      return {content:[{type:'text',text:`Gravado: ${plano}\nid: ${novo.id}\nChangelog sugerido: "${new Date().toISOString().slice(0,10)} · template ${novo.id} (${a.nome}, ${a.fmt}) criado como rascunho via MCP"`}]}; }},
  luma_template_atualizar:{
    description:'ESCREVE no banco: altera as layers de um template (por `patches`/`remover`/`adicionar` sobre as layers ATUAIS do banco, ou `layers` inteiras). Template publicado ganha versão automática (trigger) — dá para reverter com luma_template_reverter. Sem `confirmar:true` é dry-run.',
    inputSchema:{type:'object',required:['id'],properties:{id:{type:'string'},patches:{type:'object'},remover:{type:'array',items:{type:'string'}},adicionar:{type:'array',items:{type:'object'}},layers:{type:'array',items:{type:'object'}},confirmar:{type:'boolean'}}},
    async run(a){ if(!UUID.test(a.id||'')) throw new Error('id inválido'); const [t]=await banco.ler('templates',`id=eq.${a.id}&select=id,nome,fmt,w,h,publicado,layers`); if(!t) throw new Error('template não encontrado. '+banco.SEM_ACESSO);
      let novas, avisos=[]; if(Array.isArray(a.layers)&&a.layers.length) novas=a.layers; else { const e=arte.aplicarPatches(t.layers,a.patches||{},a.remover||[],a.adicionar||[]); novas=e.layers; avisos=e.avisos; }
      const antes=new Map(t.layers.map(l=>[l.id,JSON.stringify(l)])), mud=novas.filter(l=>antes.get(l.id)!==JSON.stringify(l)).map(l=>l.id), sumiu=t.layers.filter(l=>!novas.some(n=>n.id===l.id)).map(l=>l.id);
      const erros=arte.auditar(novas,t.w,t.h).filter(x=>x.nivel==='erro'); if(erros.length) return {isError:true,content:[{type:'text',text:'Recusado pela auditoria:\n'+arte.resumoAuditoria(erros)}]};
      const plano=`template "${t.nome}" (${t.fmt}, ${t.publicado?'PUBLICADO — a mudança vai ao ar':'rascunho'}): ${mud.length} layer(s) alterada(s)/nova(s) [${mud.slice(0,12).join(', ')}], ${sumiu.length} removida(s) [${sumiu.slice(0,12).join(', ')}]`+(avisos.length?'\nAvisos: '+avisos.join('; '):'');
      if(!a.confirmar) return {content:[{type:'text',text:'DRY-RUN (nada gravado). Faria: '+plano+'\nRefaça com confirmar:true.'}]};
      await banco.escrever('PATCH','templates',`id=eq.${a.id}`,{layers:novas});
      return {content:[{type:'text',text:`Gravado: ${plano}\nChangelog sugerido: "${new Date().toISOString().slice(0,10)} · template ${a.id} atualizado via MCP"\nPara desfazer: luma_template_versoes {id} → luma_template_reverter.`}]}; }},
  luma_template_publicar:{
    description:'ESCREVE no banco: publica templates (publicado=true). Recusa se a auditoria achar ERRO. Dica: rode luma_estresse e luma_auditar antes. Publique feed e story JUNTOS. Sem `confirmar:true` é dry-run.',
    inputSchema:{type:'object',required:['ids'],properties:{ids:{type:'array',items:{type:'string'},description:'UUIDs dos templates (feed + story)'},confirmar:{type:'boolean'}}},
    async run(a){ const ids=a.ids||[]; if(!ids.length||ids.some(i=>!UUID.test(i))) throw new Error('ids inválidos');
      const ts=await banco.ler('templates',`id=in.(${ids.join(',')})&select=id,nome,fmt,w,h,publicado,layers`); if(ts.length!==ids.length) throw new Error(`só ${ts.length} de ${ids.length} templates visíveis para você. `+banco.SEM_ACESSO);
      const bad=ts.map(t=>({t,e:arte.auditar(t.layers,t.w,t.h).filter(x=>x.nivel==='erro')})).filter(x=>x.e.length); if(bad.length) return {isError:true,content:[{type:'text',text:'Recusado pela auditoria:\n'+bad.map(x=>x.t.nome+' ('+x.t.fmt+')\n'+arte.resumoAuditoria(x.e)).join('\n')}]};
      const fm=new Set(ts.map(t=>t.fmt)); const aviso=fm.size<2?'\nAtenção: só um formato — o Ateliê espera feed e story juntos.':'';
      const plano=ts.map(t=>`${t.nome} (${t.fmt})${t.publicado?' já publicado':''}`).join('; ');
      if(!a.confirmar) return {content:[{type:'text',text:'DRY-RUN (nada gravado). Publicaria: '+plano+aviso+'\nRefaça com confirmar:true.'}]};
      await banco.escrever('PATCH','templates',`id=in.(${ids.join(',')})`,{publicado:true,publicado_em:new Date().toISOString()});
      return {content:[{type:'text',text:`Publicado: ${plano}${aviso}\nChangelog sugerido: "${new Date().toISOString().slice(0,10)} · publicados via MCP: ${ids.join(', ')}"`}]}; }},
  luma_template_versoes:{
    description:'Lista as versões salvas de um template (luma.template_versions), da mais nova para a mais antiga. Use o id da versão em luma_template_reverter.',
    inputSchema:{type:'object',required:['id'],properties:{id:{type:'string'}}},
    async run(a){ if(!UUID.test(a.id||'')) throw new Error('id inválido'); const v=await banco.ler('template_versions',`template_id=eq.${a.id}&select=id,created_at&order=created_at.desc&limit=30`);
      return {content:[{type:'text',text:v.length?v.map(x=>`${x.id} · ${x.created_at}`).join('\n'):'Nenhuma versão (só templates publicados são versionados) ou sem acesso.'}]}; }},
  luma_template_reverter:{
    description:'ESCREVE no banco: restaura um template para uma versão anterior (luma.restaurar_versao, cria nova versão). Sem `confirmar:true` é dry-run.',
    inputSchema:{type:'object',required:['version_id'],properties:{version_id:{type:'string'},confirmar:{type:'boolean'}}},
    async run(a){ if(!UUID.test(a.version_id||'')) throw new Error('version_id inválido'); if(!a.confirmar) return {content:[{type:'text',text:'DRY-RUN (nada gravado). Restauraria a versão '+a.version_id+'. Refaça com confirmar:true.'}]};
      await banco.rpc('restaurar_versao',{p_version:a.version_id}); /* assinatura real: luma.restaurar_versao(p_version uuid) — conferida no catálogo */
      return {content:[{type:'text',text:`Restaurada a versão ${a.version_id}.\nChangelog sugerido: "${new Date().toISOString().slice(0,10)} · reversão via MCP para a versão ${a.version_id}"`}]}; }},
  luma_comparar:{
    description:'Compara dois PNGs pixel a pixel e devolve a % de pixels que BATEM (tolerância por canal) + uma imagem de diferença (divergências em vermelho). Use para medir um render da Luma contra o composto do Photoshop, ou antes/depois de uma edição. B é esticado ao tamanho de A.',
    inputSchema:{type:'object',required:['a','b'],properties:{a:{type:'string',description:'PNG de referência (caminho absoluto)'},b:{type:'string',description:'PNG a comparar (caminho absoluto)'},tolerancia:{type:'integer',description:'0–255, padrão 24'},salvar_diff_em:{type:'string',description:'.png para gravar a imagem de diferença'}}},
    async run(a){ const rd=f=>{ const p=path.resolve(String(f||'')); if(!/\.png$/i.test(p)||!fs.existsSync(p)) throw new Error('PNG não encontrado: '+f); return fs.readFileSync(p).toString('base64'); };
      const r=await motor.comparar(rd(a.a),rd(a.b),a.tolerancia==null?24:a.tolerancia); let salvo='';
      if(a.salvar_diff_em){ const f=path.resolve(String(a.salvar_diff_em)); fs.mkdirSync(path.dirname(f),{recursive:true}); fs.writeFileSync(f,Buffer.from(r.diffPng,'base64')); salvo='\nDiff salvo em '+f; }
      return {content:[{type:'text',text:`${r.pct}% dos pixels batem (A ${r.ra.join('×')} · B ${r.rb.join('×')}${r.ra[0]!==r.rb[0]||r.ra[1]!==r.rb[1]?' — B esticado ao tamanho de A':''})${salvo}`},{type:'image',data:r.diffPng,mimeType:'image/png'}]}; }},
  luma_render_lote:{
    description:'Renderiza a MESMA arte com várias linhas de dados (ex.: 10 produtos) e grava um PNG por linha em `saida`. Devolve a tabela de encaixe (INVÁLIDA = bloqueado) e uma grade-contato com todos. Até 40 linhas, 4 abas em paralelo.',
    inputSchema:{type:'object',required:['lote','saida'],properties:Object.assign({lote:{type:'array',description:'[{nome:"acai-500", dados:{produto:"…",precoPor:"R$ 22,90"}}]',items:{type:'object'}},saida:{type:'string',description:'pasta de saída (absoluta)'}},FONTE)},
    async run(a,ctx){ const lote=a.lote||[]; if(!lote.length||lote.length>40) throw new Error('`lote` deve ter de 1 a 40 linhas'); const r0=await resolver(a), saida=path.resolve(String(a.saida)); fs.mkdirSync(saida,{recursive:true});
      const slug=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w.-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'arte'; const vistos=new Set();
      const nomes=lote.map((x,i)=>{ let n=slug(x.nome||('arte-'+(i+1))); while(vistos.has(n)) n+='-'+i; vistos.add(n); return n; });
      let feitos=0; const res=[]; const jobs=lote.map(x=>L.job(r0.layers,{W:a.W||r0.W||1080,H:a.H||r0.H||1350,fmt:a.fmt||r0.fmt,dados:x.dados||{}}));
      for(let i=0;i<jobs.length;i+=4){ const part=await motor.renderMuitos(jobs.slice(i,i+4)); res.push(...part); feitos+=part.length; ctx&&ctx.progress(feitos,jobs.length,'renderizados '+feitos+'/'+jobs.length); }
      const linhas=res.map((r,i)=>{ if(r.png) fs.writeFileSync(path.join(saida,nomes[i]+'.png'),Buffer.from(r.png,'base64')); return (r.png?resumoFit(nomes[i],r.fit):nomes[i]+': SEM SAÍDA '+(r.err||''))+(r.png?'':''); });
      const ok=res.map((r,i)=>({r,i})).filter(x=>x.r.png).slice(0,12); const g=ok.length?await motor.grade(ok.map(x=>({png:x.r.png,rotulo:nomes[x.i],cor:x.r.fit.invalid?'#c81414':'#1a6b2e'})),4,300):null;
      return {content:[{type:'text',text:`${res.filter(r=>r.png).length}/${lote.length} PNG em ${saida}\n`+linhas.join('\n')}].concat(g?[{type:'image',data:g,mimeType:'image/png'}]:[])}; }},
  luma_psd_lote:{
    description:'Importa VÁRIOS .psd de uma pasta (luma_psd_importar em série) e grava os PNGs em <saida>/<nome-do-psd>/. Devolve uma tabela: pranchetas, camadas, fidelidade média por arquivo e erros. Pula arquivos de 0 bytes. Emite progresso por arquivo. Padrão: 10 arquivos (`limite` até 80).',
    inputSchema:{type:'object',required:['pasta'],properties:{pasta:{type:'string',description:'pasta com .psd (absoluta)'},saida:{type:'string',description:'padrão: <pasta>/_luma-png'},recursivo:{type:'boolean'},limite:{type:'integer'},filtro:{type:'string',description:'trecho do nome do arquivo'}}},
    async run(a,ctx){ const raiz=path.resolve(String(a.pasta||'')); if(!fs.existsSync(raiz)||!fs.statSync(raiz).isDirectory()) throw new Error('pasta não encontrada: '+raiz);
      const achar=(d,prof)=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{ const p=path.join(d,e.name); return e.isDirectory()?((a.recursivo&&prof<4&&!e.name.startsWith('_'))?achar(p,prof+1):[]):(/\.psd$/i.test(e.name)&&!e.name.startsWith('.')?[p]:[]); });
      let ps=achar(raiz,0).sort(); if(a.filtro) ps=ps.filter(p=>path.basename(p).toLowerCase().includes(String(a.filtro).toLowerCase())); const lim=Math.min(Math.max(+a.limite||10,1),80), total=Math.min(ps.length,lim);
      if(!ps.length) return {content:[{type:'text',text:'Nenhum .psd encontrado'+(a.recursivo?'':' (use recursivo:true para subpastas)')+'.'}]};
      const saida=a.saida?path.resolve(String(a.saida)):path.join(raiz,'_luma-png'); const linhas=[]; let n=0;
      for(const p of ps.slice(0,lim)){ n++; ctx&&ctx.progress(n,total,path.basename(p)); const nome=path.basename(p,path.extname(p));
        try{ if(!fs.statSync(p).size){ linhas.push(`${nome}: PULADO (0 bytes)`); continue; }
          const o=await motor.importarPsd(p,path.join(saida,nome.replace(/[^\w.-]+/g,'-'))); const fids=[];
          for(const b of o.boards){ if(b.arquivos.ref&&b.arquivos.luma){ try{ fids.push((await motor.comparar(fs.readFileSync(b.arquivos.ref).toString('base64'),fs.readFileSync(b.arquivos.luma).toString('base64'))).pct); }catch(e){} } }
          const err=o.boards.filter(b=>b.erro).length; linhas.push(`${nome}: ${o.boards.length} prancheta(s) · ${o.boards.reduce((s,b)=>s+(b.camadas||0),0)} camadas · ${fids.length?'fidelidade média '+Math.round(fids.reduce((x,y)=>x+y,0)/fids.length*10)/10+'%':'sem composto'}${err?' · '+err+' com ERRO':''}`);
        }catch(e){ linhas.push(`${nome}: ERRO ${String(e.message||e).split('\n')[0].slice(0,160)}`); } }
      return {content:[{type:'text',text:`${total} de ${ps.length} arquivo(s) · saída: ${saida}\n`+linhas.join('\n')}]}; }},
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
  psd_para_template:{description:'Do PSD ao template: importa, confere a fidelidade, audita e prepara o rascunho (sem gravar sem confirmação).',arguments:[{name:'psd',description:'caminho absoluto do .psd',required:true}],
    text:a=>`Transforme o PSD "${a.psd}" em template do Luma.\n1. luma_psd_importar e OLHE os PNGs; compare a fidelidade (luma_comparar se precisar).\n2. luma_auditar no .layers.json de cada prancheta; corrija com luma_editar_layers.\n3. Troque textos por campos {{var}} só com nomes de luma_variaveis.\n4. luma_derivar_story se só houver o feed.\n5. luma_estresse nos dois formatos.\n6. Mostre o plano com luma_template_salvar SEM confirmar. Só grave se eu pedir. Imagem embutida não sobe pelo MCP: avise.`},
  refinar_arte:{description:'Rodada de refino de uma arte existente (render → auditar → estresse → ajustar).',arguments:[{name:'template_id',description:'UUID do template',required:true}],
    text:a=>`Refine o template ${a.template_id}.\n1. Leia luma://doc/design e luma://doc/motor.\n2. luma_render (olhe a imagem), luma_auditar e luma_estresse.\n3. Proponha até 3 ajustes e aplique com luma_editar_layers (patches por id), re-renderizando a cada passo.\n4. Mostre antes/depois com luma_comparar. Não grave no banco sem pedido explícito.`},
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
      const tok=params._meta&&params._meta.progressToken, ctx={progress:(n,total,message)=>{ if(tok!==undefined) send({method:'notifications/progress',params:{progressToken:tok,progress:n,total,message}}); }};
      try{ return ok(id,await t.run(params.arguments||{},ctx)); }catch(e){ return ok(id,{isError:true,content:[{type:'text',text:String(e.message||e)}]}); } }
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
process.stdin.on('end',()=>process.exit(0)); /* cliente fechou: derruba o Chrome junto (motor.js limpa no exit) */
