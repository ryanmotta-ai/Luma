/* Casos de `tests/copy-fit-ui.html` — as três portas do Copy Fit na interface do franqueado.
   Cada caso marcado "regressão <commit>" é um defeito achado à mão naquele commit: revertido o
   conserto, o caso fica vermelho (conferido por mutação ao montar a suíte).

   A ARTE DE BANCADA bloqueia de verdade no Local Fit, com folga para os dois lados (conferido com
   a caixa ±7% — a métrica do Arial no Windows e do Liberation Sans no CI não vira o resultado):
     · "Deliciosa Pizza Calabresa" na caixa `produto` não cabe; a versão "Pizza Calabresa" cabe;
     · "Pizza Calabresa Mussarela" não cabe e o Copy Fit não tem versão (não corta sabor);
     · a caixa `linha` junta dois campos ("{{sabor}} {{borda}}"): `campos[0]` é o sabor, mas o
       culpado é o mais longo — a borda. É o caso que separa `gLocalFitCulpado` de `campos[0]`. */
(async()=>{
const failures=[];let total=0;
const assert=(x,m)=>{if(!x)throw new Error(m||'asserção falhou');};
async function test(name,fn){total++;try{await fn();
    document.getElementById('results').insertAdjacentHTML('beforeend','<li>OK '+gEsc(name)+'</li>');}
  catch(e){failures.push({name,error:e.message});
    document.getElementById('results').insertAdjacentHTML('beforeend','<li>FALHOU '+gEsc(name)+'</li>');}}

const tick=(ms)=>new Promise(r=>setTimeout(r,ms||0));
const $=(s)=>document.querySelector(s);
const box=document.getElementById('f-msg-box');

const LONGO='Deliciosa Pizza Calabresa', CURTO='Pizza Calabresa';
const LONGO2='Deliciosa Pizza Mussarela';          // outro texto que também não cabe
const SEM_VERSAO='Pizza Calabresa Mussarela';
const PRECO_LONGO='Delicioso Hambúrguer com Refrigerante';   // como TEXTO teria versão ("… Burger com Refri")

const T=(id,o)=>Object.assign({id,type:'text',visible:true,opacity:100,textAlign:'left',textBox:'box',
  font:'Arial',color:'#fff',lineHeight:1.05,isVar:true},o);
const camadas=(wProduto)=>[
  {id:'fundo',type:'shape',shapeKind:'rect',x:0,y:0,w:1080,h:1920,fill:'#E8231A',visible:true,opacity:100},
  T('produto',{content:'{{produto}}',x:90,y:400,w:wProduto||900,h:110,fontSize:90}),
  T('linha',{content:'{{sabor}} {{borda}}',x:90,y:700,w:900,h:110,fontSize:90}),
  T('por',{content:'{{precoPor}}',x:90,y:1000,w:400,h:110,fontSize:84,textBox:'point'})
];
const material=(id,wProduto)=>({id,name:'Bancada '+id,fmt:'story',w:1080,h:1920,
  layers:camadas(wProduto),publishMeta:{publicado:true}});
const BASE={produto:CURTO,sabor:'Pizza',borda:'Calabresa',precoPor:'R$ 10,00'};

// Renderiza a prévia de verdade e espera terminar (sem o debounce de 110ms da digitação).
async function render(){
  clearTimeout(box._lpPreviewT);
  while(_lpRendering) await tick(5);
  await fUpdateLivePreview();
  while(_lpRendering) await tick(5);
}
// Digita na caixa pelo caminho real (evento `input`), mas SEM deixar o debounce repintar.
function digita(t){ box.value=t; box.dispatchEvent(new Event('input',{bubbles:true})); clearTimeout(box._lpPreviewT); }
const idx=(id)=>fState.camp.perguntas.findIndex(p=>p.id===id);
const naPergunta=(id)=>{ fState.stepIdx=idx(id); };
const balao=()=>document.getElementById('lp-balao');
const toastCom=(re)=>Array.from(document.querySelectorAll('.g-toast-item')).find(t=>re.test(t.textContent));
const fechaDialogos=()=>document.querySelectorAll('.g-dialog-ov').forEach(o=>{
  const c=o.querySelector('.g-dialog-cancel'); if(c) c.click(); else o.remove(); });
const enter=()=>(document.activeElement||document).dispatchEvent(
  new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));

fAttachInputGuard();
if(typeof window.gAiParseJson!=='function') window.gAiParseJson=(t)=>{ try{return JSON.parse(t);}catch(e){return null;} };

async function reset(dados, mat){
  fechaDialogos(); _fFitClosePop();
  window.gAskAI=undefined; window.gAiReady=()=>false; _fFitBusy=false;
  try{ _fUndoLimpa(); }catch(e){}
  document.getElementById('g-toast-container').innerHTML='';
  document.getElementById('f-messages').innerHTML='';
  const fb=document.getElementById('f-fit-btn'); if(fb) fb.remove();
  try{ localStorage.removeItem('luma_chat_draft'); }catch(e){}
  fState.material=mat||material('mat-a');
  fState.fmt=FMTS.find(f=>f.id==='story')||FMTS[0];
  fState.camp={id:'camp-1',name:'Campanha de bancada',color:'#FF9000',
    perguntas:fBuildPerguntas(['produto','sabor','borda','precoPor'],{camp:{name:'Campanha de bancada'},imageVars:new Set()})};
  fState.dados=Object.assign({},BASE,dados||{});
  fState.stepIdx=-1; fState.done=false; fState.editIdx=null; fState.extractedColors={};
  box.value=''; box.disabled=false; box._fFit=null; box._fEsp=null;
  clearTimeout(box._draftT);
  await render();
}

/* ══ 1. BALÃO DA PRÉVIA ═══════════════════════════════════════════════════════════════════ */
await test('Balão aparece quando o texto bloqueia e há versão que cabe', async()=>{
  await reset({produto:LONGO});
  assert(_lpLayoutResult&&_lpLayoutResult.invalid,'a arte de bancada deixou de bloquear — o caso perdeu o sentido');
  const b=balao(); assert(b,'bloqueou, há versão, e o balão não apareceu');
  assert(b.textContent.includes(CURTO),'o balão não mostra a versão que cabe: "'+b.textContent+'"');
});

await test('Balão some quando o texto passa a caber', async()=>{
  await reset({produto:LONGO});
  assert(balao(),'pré-condição: balão');
  fState.dados.produto=CURTO; await render();
  assert(!_lpLayoutResult.invalid,'o texto curto deveria caber');
  assert(!balao(),'coube e o balão continuou na tela');
});

await test('Sem versão que caiba, não há balão (nunca corta produto sozinho)', async()=>{
  await reset({produto:SEM_VERSAO});
  assert(_lpLayoutResult.invalid,'pré-condição: bloqueia');
  assert(!balao(),'sem versão possível e o balão apareceu');
  assert(!fLpBalaoSolucao(),'sem versão e a prévia ainda oferece solução ao chat/diálogo');
});

await test('Campo de preço bloqueado não ganha balão (Copy Fit é só para texto)', async()=>{
  await reset({precoPor:PRECO_LONGO});
  assert(_lpLayoutResult.invalid,'pré-condição: bloqueia');
  assert(!balao(),'o balão ofereceu versão para um campo de preço');
  // Controle: o MESMO valor, se o campo fosse texto, teria balão — então o que barrou foi o tipo.
  const orig=fGetFieldType;
  window.fGetFieldType=(id)=>id==='precoPor'?Object.assign(orig(id),{type:'text'}):orig(id);
  try{ _lpBalao=null; await render(); assert(balao(),'controle: como texto, o valor teria versão'); }
  finally{ window.fGetFieldType=orig; _lpBalao=null; await render(); }
});

await test('Balão percorre os bloqueios: o 1º sem versão, o balão vai para o 2º (regressão 35fb5ec)', async()=>{
  await reset({produto:SEM_VERSAO, borda:'Deliciosa Calabresa'});
  const bl=_lpLayoutResult.bloqueios||[];
  assert(bl.length>=2&&bl[0].fieldId==='produto','pré-condição: produto bloqueado primeiro, linha depois');
  assert(balao(),'o primeiro bloqueio não tinha versão e o balão sumiu — o segundo tinha');
  assert(_lpBalao.campo==='borda'&&_lpBalao.fieldId==='linha','balão no campo errado: '+_lpBalao.campo);
});

await test('Aviso, balão e diálogo culpam o MESMO campo (gLocalFitCulpado, regressão 35fb5ec)', async()=>{
  await reset({sabor:'Pizza', borda:'Deliciosa Calabresa'});
  const bl=_lpLayoutResult.bloqueios[0];
  assert(bl&&bl.campos[0]==='sabor'&&bl.campos.includes('borda'),'pré-condição: campos[0] é o sabor');
  const rBorda=gFieldLabel('borda'), rSabor=gFieldLabel('sabor');
  const nota=document.getElementById('lp-layout-nota');
  assert(!nota.hidden&&nota.textContent.includes(rBorda),'o aviso não culpa a borda: "'+nota.textContent+'"');
  assert(!nota.textContent.includes('“'+rSabor+'”'),'o aviso culpou o sabor (campos[0])');
  assert(_lpBalao.campo==='borda','o balão culpou '+_lpBalao.campo);
  // Diálogo pelo aviso (com laudo) e direto do resultado (sem laudo — caminho do baixar).
  for(const abre of [()=>nota.click(), ()=>fCorrigirTextoLongo(_lpLayoutResult)]){
    abre();
    const msg=$('.g-dialog-msg'); assert(msg,'o diálogo não abriu');
    assert(msg.textContent.includes('“'+rBorda+'”'),'o diálogo culpou outro campo: "'+msg.textContent+'"');
    fechaDialogos(); await tick();
  }
});

await test('Balão reaproveita o mesmo nó entre renders (não pisca a cada tecla — regressão 4cb4f29)', async()=>{
  await reset({produto:LONGO});
  const b1=balao(); assert(b1,'pré-condição: balão');
  await render();
  assert(balao()===b1,'o mesmo texto re-renderizado recriou o balão');
  fState.dados.produto=LONGO2; await render();
  const b2=balao();
  assert(b2===b1,'a tecla nova recriou o balão (a entrada anima de novo e ele pisca)');
  assert(b2.textContent.includes('Pizza Mussarela'),'o nó reaproveitado não trocou o texto: "'+b2.textContent+'"');
});

await test('Balão com a pergunta ABERTA: troca na caixa e o Desfazer devolve à caixa (regressão 35fb5ec)', async()=>{
  await reset({produto:''});
  naPergunta('produto'); digita(LONGO); await render();
  assert(balao(),'pré-condição: balão');
  balao().click();
  assert(box.value===CURTO,'o balão não trocou o texto na caixa: "'+box.value+'"');
  assert(fState.dados.produto===CURTO,'a caixa trocou mas a prévia não acompanhou');
  assert(document.activeElement===box,'o foco não voltou para a caixa');
  assert(fUndoDisponivel(),'aplicar pelo chat não registrou Desfazer');
  assert(toastCom(/Trocamos/),'o toque no balão não avisou a troca');
  fDesfazer();
  assert(box.value===LONGO,'o Desfazer não devolveu o texto à caixa: "'+box.value+'"');
  assert(fState.dados.produto===LONGO,'o Desfazer não devolveu o valor à prévia');
});

await test('Balão com a pergunta JÁ RESPONDIDA: troca pelos dados e o Desfazer volta o valor', async()=>{
  await reset({produto:LONGO});
  naPergunta('sabor');                               // a conversa já está em outra pergunta
  box.value='Pizza';
  balao().click();
  assert(fState.dados.produto===CURTO,'não trocou o produto: '+fState.dados.produto);
  assert(box.value==='Pizza','o balão escreveu o produto na caixa de OUTRA pergunta');
  toastCom(/Trocamos/).querySelector('.g-toast-acao').click();   // o Desfazer do próprio toast
  assert(fState.dados.produto===LONGO,'o Desfazer do toast não voltou o produto: '+fState.dados.produto);
});

await test('Aplicou com a pergunta aberta e ENVIOU: o Desfazer volta pelos dados', async()=>{
  await reset({produto:''});
  naPergunta('produto'); digita(LONGO); await render();
  balao().click();
  naPergunta('sabor'); box.value='';                  // enviou: a caixa agora é de outra pergunta
  fDesfazer();
  assert(fState.dados.produto===LONGO,'desfazer depois de enviar não voltou o produto: '+fState.dados.produto);
  assert(box.value==='','o desfazer escreveu o produto na caixa da pergunta seguinte');
});

await test('Balão medido para o texto ANTIGO não troca o texto que a pessoa acabou de digitar', async()=>{
  await reset({produto:''});
  naPergunta('produto'); digita(LONGO); await render();
  const b=balao(); assert(b&&b.textContent.includes(CURTO),'pré-condição: balão de "'+LONGO+'"');
  digita(LONGO2);                                     // digitou antes de a prévia repintar
  b.click();
  assert(box.value===LONGO2,'o balão velho trocou o texto novo: "'+box.value+'"');
  assert(fState.dados.produto===LONGO2,'o balão velho reescreveu o dado novo');
});

await test('Estado vazio (sem material) tira balão, solução e Encurtar (regressão df5cdec)', async()=>{
  await reset({produto:''});
  naPergunta('produto'); digita(LONGO); await render();
  assert(balao()&&document.getElementById('f-fit-btn'),'pré-condição: balão e Encurtar');
  fState.material=null; await render();
  assert(!balao(),'sem arte e o balão ficou clicável por cima do vazio');
  assert(!fLpBalaoSolucao(),'sem arte e a solução da arte anterior seguia valendo');
  assert(!document.getElementById('f-fit-btn'),'sem arte e o Encurtar continuou aceso');
});

await test('Trocar de material invalida a sugestão (a chave é da ARTE, não do texto)', async()=>{
  await reset({produto:LONGO});
  assert(fLpBalaoSolucao(),'pré-condição: solução na arte A');
  // Arte B com a caixa do produto estreita: lá nem a versão curta cabe.
  fState.material=material('mat-b',420);
  assert(!fLpBalaoSolucao(),'o material trocou (ainda sem render) e a solução da arte A seguiu valendo');
  await render();
  assert(_lpLayoutResult.invalid,'pré-condição: bloqueia na arte B');
  assert(!balao(),'na arte B a versão não cabe e o balão reaproveitou a sugestão da arte A');
  assert(!fLpBalaoSolucao(),'na arte B a prévia ofereceu a versão medida na arte A');
});

/* ══ 2. DIÁLOGO "ESSE TEXTO NÃO CABE" ═════════════════════════════════════════════════════ */
const abreDialogo=async()=>{ document.getElementById('lp-layout-nota').click(); await tick(40); return $('.g-dialog-ov'); };

await test('Diálogo com versão: "Usar esta versão" troca e o toast tem Desfazer', async()=>{
  await reset({produto:LONGO});
  const ov=await abreDialogo(); assert(ov,'o aviso não abriu o diálogo');
  assert(ov.textContent.includes(CURTO),'o diálogo não mostra a versão que cabe');
  assert(ov.querySelector('.g-dialog-ok').textContent==='Usar esta versão','a ação principal não é usar a versão');
  ov.querySelector('.g-dialog-ok').click(); await tick();
  assert(fState.dados.produto===CURTO,'"Usar esta versão" não trocou: '+fState.dados.produto);
  const t=toastCom(/Trocamos/); assert(t&&t.querySelector('.g-toast-acao'),'sem toast com Desfazer');
  t.querySelector('.g-toast-acao').click();
  assert(fState.dados.produto===LONGO,'o Desfazer do diálogo não voltou: '+fState.dados.produto);
});

await test('Diálogo: "Editar" abre o campo com o texto ATUAL, não vazio (regressão 4cb4f29)', async()=>{
  await reset({produto:LONGO});
  const ov=await abreDialogo();
  const alt=ov.querySelector('.g-dialog-alt'); assert(alt&&alt.textContent==='Editar','sem a saída "Editar"');
  alt.click(); await tick(); clearTimeout(box._lpPreviewT);
  assert(fState.stepIdx===idx('produto'),'"Editar" não levou à pergunta do produto');
  assert(box.value===LONGO,'"Editar" abriu o campo com "'+box.value+'" — a pessoa teria de redigitar tudo');
  assert(fState.dados.produto===LONGO,'"Editar" mudou o valor sozinho');
});

await test('Diálogo sem versão: "Encurtar agora" também abre com o texto atual', async()=>{
  await reset({produto:SEM_VERSAO});
  const ov=await abreDialogo(); assert(ov,'o aviso não abriu o diálogo');
  assert(!ov.querySelector('.g-dialog-alt'),'sem versão e o diálogo ofereceu três saídas');
  assert(ov.querySelector('.g-dialog-ok').textContent==='Encurtar agora','sem versão, a ação é encurtar à mão');
  ov.querySelector('.g-dialog-ok').click(); await tick(); clearTimeout(box._lpPreviewT);
  assert(box.value===SEM_VERSAO,'"Encurtar agora" abriu o campo com "'+box.value+'"');
});

await test('Diálogo: "Agora não" não muda nada', async()=>{
  await reset({produto:LONGO});
  const ov=await abreDialogo();
  ov.querySelector('.g-dialog-cancel').click(); await tick();
  assert(fState.dados.produto===LONGO,'"Agora não" mudou o texto');
  assert(fState.stepIdx===-1&&box.value==='','"Agora não" abriu o campo');
  assert(!fUndoDisponivel(),'"Agora não" registrou um Desfazer');
});

await test('Diálogo: Enter com foco em "Agora não" NÃO troca o texto (regressão df5cdec)', async()=>{
  await reset({produto:LONGO});
  const ov=await abreDialogo();
  ov.querySelector('.g-dialog-cancel').focus(); enter(); await tick();
  assert(!$('.g-dialog-ov'),'Enter não fechou o diálogo');
  assert(fState.dados.produto===LONGO,'Enter em "Agora não" aplicou a versão: '+fState.dados.produto);
});

await test('gConfirm danger: Enter com foco em Cancelar NÃO confirma; no OK, confirma (regressão df5cdec)', async()=>{
  await reset();
  let p=gConfirm('Apagar a arte?',{danger:true,okLabel:'Apagar'}); await tick(40);
  assert(document.activeElement===$('.g-dialog-ok'),'o foco inicial não está no OK');
  $('.g-dialog-cancel').focus(); enter();
  assert((await p)===false,'Enter em Cancelar confirmou o apagar');
  p=gConfirm('Apagar a arte?',{danger:true,okLabel:'Apagar'}); await tick(40);
  enter();
  assert((await p)===true,'Enter no OK deixou de confirmar');
});

await test("gConfirm: a saída 'alt' só existe com altLabel", async()=>{
  await reset();
  let p=gConfirm('Pergunta simples?'); await tick();
  assert(!$('.g-dialog-alt'),'sem altLabel e o diálogo ganhou um terceiro botão');
  $('.g-dialog-cancel').click(); assert((await p)===false,'Cancelar não resolveu false');
  p=gConfirm('Três saídas?',{altLabel:'Editar'}); await tick();
  $('.g-dialog-alt').click(); assert((await p)==='alt',"a saída alternativa não resolveu 'alt'");
});

/* ══ 3. "ENCURTAR" DO CHAT ════════════════════════════════════════════════════════════════ */
await test('Encurtar aparece SEM IA quando a prévia mediu uma versão, e aplicar tem Desfazer', async()=>{
  await reset({produto:''});
  naPergunta('produto'); digita(LONGO); await render();
  const btn=document.getElementById('f-fit-btn'); assert(btn,'sem IA e com versão medida, o Encurtar não apareceu');
  btn.click();
  const opt=$('#f-fit-pop .f-fit-opt'); assert(opt&&opt.textContent.includes(CURTO),'o popover não trouxe a versão medida');
  opt.click();
  assert(box.value===CURTO&&fState.dados.produto===CURTO,'aplicar não trocou: "'+box.value+'"');
  assert(!$('#f-fit-pop'),'o popover não fechou');
  fDesfazer();
  assert(box.value===LONGO,'o Desfazer do Encurtar não devolveu o texto: "'+box.value+'"');
});

await test('Encurtar sem versão e sem IA não aparece', async()=>{
  await reset({produto:''});
  naPergunta('produto'); digita(SEM_VERSAO); await render();
  assert(!document.getElementById('f-fit-btn'),'sem versão e sem IA, o Encurtar apareceu (não teria o que oferecer)');
});

await test('Popover do Encurtar não aplica a versão de um texto que já mudou (regressão df5cdec)', async()=>{
  await reset({produto:''});
  naPergunta('produto'); digita(LONGO); await render();
  document.getElementById('f-fit-btn').click();
  const opt=$('#f-fit-pop .f-fit-opt'); assert(opt,'pré-condição: popover');
  digita(LONGO2);                                     // escreveu outro texto com o popover aberto
  opt.click();
  assert(box.value===LONGO2,'a versão de "'+LONGO+'" caiu por cima de "'+LONGO2+'": "'+box.value+'"');
  assert(toastCom(/O texto mudou/),'recusou calado — a pessoa não sabe por que nada aconteceu');
});

await test('Popover fechado não deixa o "clicou fora" armado para o próximo (regressão 2470e6b)', async()=>{
  await reset({produto:''});
  naPergunta('produto'); digita(LONGO); await render();
  document.getElementById('f-fit-btn').click(); await tick();
  assert($('#f-fit-pop'),'pré-condição: popover aberto');
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));
  assert(!$('#f-fit-pop'),'Esc não fechou o popover');
  // O botão reaparece como OUTRO nó (é o que acontece depois de aplicar e voltar a não caber).
  document.getElementById('f-fit-btn').remove(); fFitSync();
  const novo=document.getElementById('f-fit-btn'); assert(novo,'pré-condição: botão de volta');
  novo.click(); await tick();
  assert($('#f-fit-pop'),'o popover novo fechou no mesmo clique que o abriu');
});

await test('Encurtar esquece a tentativa de um texto que a pessoa apagou (regressão 4cb4f29)', async()=>{
  await reset({produto:''});
  naPergunta('produto');
  box._fFit={id:'produto',text:'Pizza Calabresa com borda recheada de catupiry e cheddar'};
  digita('Frango');
  assert(!box._fFit,'escreveu OUTRO texto e o Encurtar seguiria encurtando o anterior');
  box._fFit={id:'produto',text:'Pizza Calabresa com borda'};
  digita('Pizza Cala');
  assert(box._fFit,'apagar o fim do MESMO texto não pode esquecer a tentativa');
});

await test('IA lenta: a resposta é descartada se a pergunta mudou (regressão df5cdec)', async()=>{
  await reset({produto:''});
  let solta; window.gAiReady=()=>true;
  window.gAskAI=()=>new Promise(r=>{ solta=r; });
  naPergunta('produto'); digita(SEM_VERSAO);
  const p=fFitTextWithAI(true);
  assert(typeof solta==='function','a IA não foi chamada');
  naPergunta('precoPor'); box.value='R$ 10,00';       // enviou; a caixa agora é do preço
  solta('{"opcoes":["Calabresa Mussarela"]}'); await p;
  assert(!$('#f-fit-pop'),'a resposta atrasada do produto abriu opções na pergunta do preço');
  assert(box.value==='R$ 10,00','a resposta atrasada mexeu na caixa do preço');
  // Controle: sem trocar de pergunta, a mesma resposta vira opção.
  await reset({produto:''});
  window.gAiReady=()=>true; window.gAskAI=()=>new Promise(r=>{ solta=r; });
  naPergunta('produto'); digita(SEM_VERSAO);
  const p2=fFitTextWithAI(true); solta('{"opcoes":["Calabresa Mussarela"]}'); await p2;
  assert($('#f-fit-pop .f-fit-opt'),'controle: a resposta na mesma pergunta deveria virar opção');
});

await test('IA lenta: a resposta é descartada se o texto foi reescrito', async()=>{
  await reset({produto:''});
  let solta; window.gAiReady=()=>true; window.gAskAI=()=>new Promise(r=>{ solta=r; });
  naPergunta('produto'); digita(SEM_VERSAO);
  const p=fFitTextWithAI(true);
  digita('Frango Catupiry Especial da Casa');
  solta('{"opcoes":["Calabresa Mussarela"]}'); await p;
  assert(!$('#f-fit-pop'),'opções de um texto que a pessoa já reescreveu');
});

await reset();
window.__lumaTest={total,passed:total-failures.length,failures};
})().catch(e=>window.__lumaTest={total:1,passed:0,failures:[{name:'bancada',error:e.stack}]});
