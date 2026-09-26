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
  /* 760px desde 26/09/2026 (eram 900): com a folga de hierarquia (piso 71px) o texto longo cabia
     em 900. Medido: em 760 o longo bloqueia até 820px de caixa e o curto cabe até 700 — ±8%. */
  T('produto',{content:'{{produto}}',x:90,y:400,w:wProduto||760,h:110,fontSize:90}),
  T('linha',{content:'{{sabor}} {{borda}}',x:90,y:700,w:760,h:110,fontSize:90}),
  T('por',{content:'{{precoPor}}',x:90,y:1000,w:400,h:110,fontSize:84,textBox:'point'}),
  /* Texto fixo ao lado do preço (25/09/2026): com a hierarquia por família o preço não segura
     mais o piso do produto — este texto segura. 89px desde 26/09: com a folga de 80% o piso do
     produto fica em 71px, e a bancada continua bloqueando com margem. */
  T('selo',{content:'SÓ HOJE',isVar:false,x:560,y:1000,w:430,h:110,fontSize:89,textBox:'point'}),
  /* Faixa à direita (26/09/2026): parede para a largura livre — esta bancada mede o Copy Fit, não
     o alargamento (coberto em local-fit/copy-fit). */
  {id:'faixa',type:'shape',shapeKind:'rect',x:855,y:380,w:40,h:460,fill:'#B01C14',visible:true,opacity:100}
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
  window.gAskAI=undefined; window.gAiReady=()=>false; _fFitCancela();
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
  fState.material=material('mat-b',300);   // 300 desde 26/09/2026: em 420 a versão curta cabia alargando (+50%)
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
  // Controle: sem trocar de pergunta, uma resposta VÁLIDA vira opção. (A de cima, "Calabresa
  // Mussarela", hoje também cairia no gCopyFitConfere: sumiu "Pizza".)
  await reset({produto:''});
  window.gAiReady=()=>true; window.gAskAI=()=>new Promise(r=>{ solta=r; });
  naPergunta('produto'); digita(LONGO); await render();
  const p2=fFitTextWithAI(true); solta('{"opcoes":["'+CURTO+'"]}'); await p2;
  assert($('#f-fit-pop .f-fit-opt'),'controle: a resposta na mesma pergunta deveria virar opção');
});

/* IA como ÚLTIMO degrau (23/09/2026): toda opção da IA passa por gCopyFitConfere E pela régua
   em pixel. Reprovada some calada; todas reprovadas → frase honesta, nunca opção ruim. */
await test('IA: 3 opções, 2 inválidas (produto trocado, preço inventado) → só a válida aparece, com o que saiu', async()=>{
  await reset({produto:''});
  window.gAiReady=()=>true;
  window.gAskAI=()=>Promise.resolve(JSON.stringify({opcoes:['Pizza Mussarela', CURTO, CURTO+' 2x']}));
  naPergunta('produto'); digita(LONGO); await render();
  await fFitTextWithAI(true);
  const opts=Array.from(document.querySelectorAll('#f-fit-pop .f-fit-opt'));
  assert(opts.length===1 && opts[0].querySelector('span').textContent===CURTO,
    'esperava só "'+CURTO+'": '+opts.map(o=>o.textContent).join(' | '));
  assert(_fFitIaReprovadas===2,'a conta de reprovadas devia ser 2: '+_fFitIaReprovadas);
  const foot=$('#f-fit-pop .f-fit-pop-foot').textContent;
  assert(/Sugestão de IA/.test(foot) && /Sai: Deliciosa/.test(foot),'rodapé sem a origem ou sem o que saiu: "'+foot+'"');
  assert(/sem Deliciosa/.test(opts[0].getAttribute('aria-label')||''),'a opção não diz o que saiu');
});

await test('IA: todas inválidas → nenhuma opção e a frase honesta', async()=>{
  await reset({produto:''});
  window.gAiReady=()=>true;
  window.gAskAI=()=>Promise.resolve(JSON.stringify({opcoes:['Pizza Mussarela','Calabresa','Pizza Calabresa R$ 5']}));
  naPergunta('produto'); digita(LONGO); await render();
  await fFitTextWithAI(true);
  assert(!$('#f-fit-pop .f-fit-opt'),'opção reprovada apareceu');
  // A falha fica NO painel (26/09/2026): diz o que houve, que o texto não mudou, e dá a saída.
  const pop=$('#f-fit-pop.f-fit-pop-falha');
  assert(pop && /A IA não achou uma versão que mantenha preço e produtos/.test(pop.textContent),'sem a frase honesta no painel');
  assert(/continua como estava/.test(pop.textContent) && box.value===LONGO,'a falha não garante o texto original');
  assert(Array.from(pop.querySelectorAll('.f-fit-acao')).some(b=>/Tentar de novo/.test(b.textContent)),'falha sem "Tentar de novo"');
});

await test('Motor sem versão + IA → o Encurtar aparece e um toque vai direto à IA', async()=>{
  await reset({produto:''});
  let chamou=0; window.gAiReady=()=>true;
  window.gAskAI=()=>{ chamou++; return Promise.resolve('{"opcoes":["Calabresa Mussarela"]}'); };
  naPergunta('produto'); digita(SEM_VERSAO); await render();
  assert(_lpLayoutResult.invalid && !_fFitCopyFit('produto'),'pré-condição: bloqueia e o motor não tem versão');
  assert(!chamou,'a IA foi chamada sem toque (por tecla/render)');
  const btn=document.getElementById('f-fit-btn');
  assert(btn,'sem versão e com IA, o Encurtar sumiu');
  assert(/Tentar com IA/.test(btn.getAttribute('aria-label')||''),'o botão não diz que vai tentar com IA: '+btn.getAttribute('aria-label'));
  btn.click(); await tick(); await tick();
  assert(chamou===1,'um toque devia chamar a IA uma vez: '+chamou);
  assert(!$('#f-fit-pop .f-fit-opt') && /A IA não achou/.test(($('#f-fit-pop')||{}).textContent||''),'"Calabresa Mussarela" (sumiu Pizza) não pode virar opção');
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

/* O QUE O LUMA ESTÁ FAZENDO (26/09/2026): na espera, o painel mostra as etapas reais — sem barra de
   tempo —, o texto não muda, e Cancelar/Esc/editar devolvem o controle na hora. */
await test('IA trabalhando: etapas reais, texto intacto, e Cancelar devolve o controle', async()=>{
  await reset({produto:''});
  let solta; window.gAiReady=()=>true; window.gAskAI=()=>new Promise(r=>{ solta=r; });
  naPergunta('produto'); digita(LONGO); await render();
  const p=fFitTextWithAI(true);
  const pop=$('#f-fit-pop'); assert(pop,'a espera não abriu o painel');
  const lis=Array.from(pop.querySelectorAll('.f-fit-etapas li'));
  assert(lis.length===3 && lis[0].classList.contains('is-feita') && lis[1].classList.contains('is-ativa') && !lis[2].className,
    'as etapas não dizem onde está: '+lis.map(l=>l.className||'-').join(','));
  assert(/Meta: até \d+ caracteres \(hoje 25\)/.test(lis[0].textContent),'a meta medida não aparece: "'+lis[0].textContent+'"');
  assert(!pop.querySelector('.f-fit-prog'),'voltou a barra de tempo');
  assert(document.getElementById('f-fit-btn').disabled,'o botão aceitou um segundo toque na espera');
  assert(box.value===LONGO,'o texto mudou antes de haver versão');
  fFitSync();                                          // a prévia mede de novo no meio da espera
  assert($('#f-fit-pop .f-fit-etapas'),'a prévia medindo fechou o painel de progresso');
  const cancelar=Array.from(pop.querySelectorAll('.f-fit-acao')).find(b=>/Cancelar/.test(b.textContent));
  assert(cancelar,'a espera não tem Cancelar'); cancelar.click();
  assert(!$('#f-fit-pop') && !_fFitRun,'Cancelar não encerrou a espera');
  assert(!document.getElementById('f-fit-btn').disabled,'depois de cancelar o botão ficou travado');
  solta('{"opcoes":["'+CURTO+'"]}'); await p;
  assert(!$('#f-fit-pop') && box.value===LONGO,'a resposta de uma rodada cancelada apareceu');
  // Esc também cancela, e editar o texto cancela (a resposta seria de outro texto).
  fFitTextWithAI(true); assert(_fFitRun,'pré-condição: rodada nova');
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));
  assert(!_fFitRun && !$('#f-fit-pop'),'Esc não cancelou a espera');
  fFitTextWithAI(true); digita(LONGO2);
  assert(!_fFitRun,'editar o texto não cancelou a espera');
});

await test('IA não respondeu: a falha fica no painel e "Tentar de novo" chama de novo', async()=>{
  await reset({produto:''});
  let chamou=0; window.gAiReady=()=>true; window.gAskAI=()=>{ chamou++; return Promise.resolve(null); };
  naPergunta('produto'); digita(LONGO); await render();
  await fFitTextWithAI(true);
  const pop=$('#f-fit-pop.f-fit-pop-falha');
  assert(pop && /A IA não respondeu/.test(pop.textContent),'a falha sumiu num toast (ou nem apareceu)');
  assert(box.value===LONGO && !document.getElementById('f-fit-btn').disabled,'a falha mexeu no texto ou travou o botão');
  Array.from(pop.querySelectorAll('.f-fit-acao')).find(b=>/Tentar de novo/.test(b.textContent)).click();
  await tick(); await tick();
  assert(chamou===2,'"Tentar de novo" não chamou a IA: '+chamou);
});

/* ══ 4. SEM VERSÃO: QUANTO FALTA ══════════════════════════════════════════════════════════ */
const notaVis=()=>{ const v=document.querySelector('#lp-layout-nota .lp-nota-vis'); return v?v.textContent:''; };
// Aviso desde 25/09/2026: "“Produto” não cabe na arte (tem 25 letras, cabem 15) · Encurtar".
const faltaDaNota=()=>{ const m=/tem (\d+) letras?, cabem (\d+)/.exec(notaVis()); return m?(+m[1])-(+m[2]):0; };

await test('Sem versão: o aviso diz quantas letras tirar, e o corte desse tamanho CABE', async()=>{
  await reset({produto:SEM_VERSAO});
  assert(_lpLayoutResult.invalid&&!balao(),'pré-condição: bloqueia e não tem versão');
  const n=faltaDaNota();
  assert(n>=1&&n<SEM_VERSAO.length,'o aviso não diz quanto tirar: "'+notaVis()+'"');
  // Determinístico: o texto atual não cabe; o começo dele com (atual − N) caracteres cabe.
  fState.dados.produto=SEM_VERSAO.slice(0,SEM_VERSAO.length-n); await render();
  assert(!(_lpLayoutResult.bloqueios||[]).some(b=>b.fieldId==='produto'),
    'tirei as '+n+' letras que o aviso pediu e segue sem caber: "'+fState.dados.produto+'"');
});

await test('Sem versão: o diálogo diz o MESMO número e o contador bate com ele', async()=>{
  await reset({produto:SEM_VERSAO});
  const n=faltaDaNota(); assert(n>=1,'pré-condição: aviso com o número');
  const ov=await abreDialogo(); assert(ov,'o aviso não abriu o diálogo');
  const quanto='Tire '+(n===1?'1 letra':n+' letras');
  assert(ov.textContent.includes(quanto),'o diálogo não disse "'+quanto+'": "'+ov.textContent+'"');
  ov.querySelector('.g-dialog-ok').click(); await tick(); clearTimeout(box._lpPreviewT);
  fUpdateCharCount();
  const L=SEM_VERSAO.length;
  assert(document.getElementById('f-char-count').textContent===L+'/'+(L-n),
    'o contador não bate com o aviso: '+document.getElementById('f-char-count').textContent+' (esperado '+L+'/'+(L-n)+')');
});

await test('Campo de preço bloqueado não ganha "tire N letras" (cortar o fim de um preço não é conselho)', async()=>{
  await reset({precoPor:PRECO_LONGO});
  assert(_lpLayoutResult.invalid,'pré-condição: bloqueia');
  assert(!faltaDaNota()&&/encurtar/i.test(notaVis()),'o preço ganhou número de letras: "'+notaVis()+'"');
});

await test('Leitor de tela: o número que muda a cada tecla só é falado na pausa', async()=>{
  const n=document.createElement('button');
  _fLpNotaTexto(n,'“Produto” não cabe — tire umas 9 letras','');
  const vis=n.querySelector('.lp-nota-vis'), sr=n.querySelector('.lp-nota-sr');
  assert(vis&&vis.getAttribute('aria-hidden')==='true'&&sr,'sem a parte visível escondida e a parte falada');
  assert(/9 letras/.test(sr.textContent),'a primeira frase não foi falada: "'+sr.textContent+'"');
  _fLpNotaTexto(n,'“Produto” não cabe — tire umas 8 letras','');
  assert(/8 letras/.test(vis.textContent),'a barra não acompanhou a tecla');
  assert(/9 letras/.test(sr.textContent),'o leitor de tela repetiu o aviso na tecla: "'+sr.textContent+'"');
  await tick(F_LP_NOTA_PAUSA+80);
  assert(/8 letras/.test(sr.textContent),'parou de digitar e o número novo não foi falado');
  _fLpNotaTexto(n,'“Borda” não cabe — encurtar','');
  assert(/Borda/.test(sr.textContent),'frase nova (outro campo) esperou a pausa');
});

await reset();
window.__lumaTest={total,passed:total-failures.length,failures};
})().catch(e=>window.__lumaTest={total:1,passed:0,failures:[{name:'bancada',error:e.stack}]});
