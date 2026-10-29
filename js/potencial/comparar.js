/**
 * js/potencial/comparar.js
 *
 * POTENCIAL — comparar cidades e gerar slides em lote (v2, 30/10/2026).
 * Até POT_COMPARA_MAX cidades lado a lado, com barras por métrica proporcionais ao maior valor e o melhor
 * de cada linha marcado. Cada coluna leva os ajustes (concorrentes, ticket…) que a pessoa já tinha feito no
 * Calcular. "Gerar slides" percorre as cidades UMA a UMA pelo mesmo gerador (`potChamaGerador`) e lista os
 * links — não abre aba nenhuma sozinho (N popups seriam bloqueados e seriam ruído).
 *
 * ⛔ Nada calcula aqui: cada coluna é `potCalcular` + `potResumo` (motor.js).
 * Depende de: motor.js, potencial.js (estado `_pot`, potBuscarCidades, potChamaGerador, potRegistrarProposta).
 */

const POT_COMPARA_MAX = 4;

// Linha da comparação: rótulo, de onde vem, como formata e qual lado é "melhor".
const POT_METRICAS = [
  { k:'inv',         rot:'Investimento total',        f:potBRLc, melhor:'menor' },
  { k:'gmvReal',     rot:'GMV mensal (cenário real)', f:potBRLc, melhor:'maior' },
  { k:'receitaReal', rot:'Receita franqueado/mês',    f:potBRLc, melhor:'maior' },
  { k:'lucroReal',   rot:'Lucro líquido anual',       f:potBRLc, melhor:'maior' },
  { k:'paybackReal', rot:'Payback do cenário real',   f:potMeses, melhor:'menor' },
  { k:'pico',        rot:'Fundo do caixa (24 meses)', f:potBRLc, melhor:'maior', negativo:true },
  { k:'paybackMes',  rot:'Caixa volta ao zero em',    f:v=>v==null?'além de 24 m':'mês '+v, melhor:'menor' },
  { k:'resultado24', rot:'Resultado em 24 meses',     f:potBRLc, melhor:'maior' }
];

function potComparaAdd(){
  const c=_pot.cidade; if(!c){ gToast('Escolha uma cidade primeiro.'); return; }
  potComparaPoe(c, Object.assign({},_pot.ov));
  gToast(c.nome+' entrou na comparação.');
}
function potComparaPoe(c, ov){
  const i=_pot.comparar.findIndex(x=>x.cidade.chave===c.chave);
  if(i>=0) _pot.comparar[i]={cidade:c,ov:ov||{}};
  else{
    if(_pot.comparar.length>=POT_COMPARA_MAX){ gToast('A comparação comporta '+POT_COMPARA_MAX+' cidades. Tire uma para entrar outra.'); return false; }
    _pot.comparar.push({cidade:c,ov:ov||{},estado:''});
  }
  potComparaContador(); return true;
}
function potComparaTira(chave){
  _pot.comparar=_pot.comparar.filter(x=>x.cidade.chave!==chave); potComparaContador(); potRenderComparar();
}
function potComparaContador(){
  const n=_pot.comparar.length, el=_potEl('pot-n-comparar'); if(!el) return;
  el.textContent=n; el.hidden=!n;
}

function potRenderComparar(){
  const raiz=_potEl('pot-v-comparar'); if(!raiz) return;
  const itens=_pot.comparar.map(x=>({x, calc:potCalcular(x.cidade,_pot,x.ov)})).map(o=>Object.assign(o,{res:potResumo(o.calc)}));
  const barra='<div class="pot-comp-barra"><div class="pot-busca pot-busca-c"><label for="pot-cq">Adicionar cidade</label>'
    +'<div class="pot-busca-campo">'+POT_ICO.lupa+'<input id="pot-cq" type="text" autocomplete="off" spellcheck="false" placeholder="Digite a cidade" oninput="potComparaBusca(this)" onkeydown="if(event.key===\'Enter\'){event.preventDefault();potComparaPrimeira();}">'
    +'</div><ul id="pot-clista" class="pot-lista-c" hidden></ul></div>'
    +'<div class="pot-comp-acoes">'
    +(itens.length?'<button type="button" class="pot-link" onclick="potComparaLimpa()">Limpar</button>':'')
    +'<button type="button" class="pot-cta" id="pot-lote" onclick="potComparaLote()"'+(itens.length?'':' disabled')+'>'+POT_ICO.slide+'<span>Gerar '+(itens.length>1?itens.length+' slides':'slide')+'</span></button></div></div>';
  if(!itens.length){
    raiz.innerHTML=barra+'<section class="pot-vazio-tela"><div class="pot-vazio-arte" aria-hidden="true">'+POT_ICO.mais+'</div><h2>Compare cidades lado a lado</h2>'
      +'<p>Adicione até '+POT_COMPARA_MAX+' cidades aqui, ou use o botão "Comparar" no topo de uma cidade já calculada. Cada coluna leva os ajustes que você fez nela.</p></section>';
    return;
  }
  // O melhor de cada linha (entre as cidades com valor): menor ou maior, conforme a métrica.
  const melhores={}, maximos={}, empate={};
  POT_METRICAS.forEach(M=>{
    const v=itens.map(o=>o.res[M.k]).filter(x=>x!=null&&!isNaN(x));
    melhores[M.k]=v.length ? (M.melhor==='menor'?Math.min.apply(null,v):Math.max.apply(null,v)) : null;
    maximos[M.k]=Math.max.apply(null,[1].concat(v.map(Math.abs)));
    empate[M.k]=v.length>1 && v.every(x=>x===v[0]);   // todos iguais: ninguém é "o melhor"
  });
  const cols=itens.length;
  let g='<div class="pot-cmp" style="--n:'+cols+'" role="table" aria-label="Comparação entre cidades">';
  g+='<div class="pot-cmp-l pot-cmp-cab" role="row"><div class="pot-cmp-rot" role="columnheader"></div>'+itens.map(o=>{
    const c=o.x.cidade, est=o.x.estado;
    return '<div class="pot-cmp-c pot-cmp-cabeca" role="columnheader"><button type="button" class="pot-cmp-x" aria-label="Tirar '+gEsc(c.nome)+' da comparação" data-chave="'+gEsc(c.chave)+'" onclick="potComparaTira(this.dataset.chave)">'+POT_ICO.x+'</button>'
      +'<h3>'+gEsc(c.nome)+' <em>'+gEsc(c.uf)+'</em></h3><p>'+potNumero(c.populacao)+' hab. · '+o.calc.conc+' concorrente'+(o.calc.conc===1?'':'s')+'</p>'
      +(est&&est.url?'<a class="pot-cmp-ok" href="'+gEsc(est.url)+'" target="_blank" rel="noopener">'+POT_ICO.check+'Abrir slide</a>':est&&est.erro?'<span class="pot-cmp-er">'+gEsc(est.erro)+'</span>':est&&est.gerando?'<span class="pot-cmp-gen"><i class="mini-spinner"></i> Gerando…</span>':'')
      +'<button type="button" class="pot-link" data-chave="'+gEsc(c.chave)+'" onclick="potAbrirNoCalcular(this.dataset.chave)">Abrir no Calcular</button></div>';
  }).join('')+'</div>';
  POT_METRICAS.forEach(M=>{
    g+='<div class="pot-cmp-l" role="row"><div class="pot-cmp-rot" role="rowheader">'+M.rot+'</div>'+itens.map(o=>{
      const v=o.res[M.k], ok=v!=null&&!isNaN(v), top=ok&&itens.length>1&&v===melhores[M.k]&&!empate[M.k];
      const larg=ok?Math.max(2,Math.abs(v)/maximos[M.k]*100):0;
      return '<div class="pot-cmp-c'+(top?' top':'')+(ok&&v<0?' neg':'')+'" role="cell"><b>'+(ok?M.f(v):(M.k==='paybackMes'?M.f(null):'—'))+'</b>'
        +(top?'<span class="pot-cmp-melhor">'+POT_ICO.check+'melhor</span>':'')
        +(ok?'<span class="pot-cmp-barra" aria-hidden="true"><i style="width:'+larg.toFixed(1)+'%"></i></span>':'')+'</div>';
    }).join('')+'</div>';
  });
  g+='</div>';
  raiz.innerHTML=barra+g+'<div id="pot-lote-res"></div>';
}

function potAbrirNoCalcular(chave){
  const i=_pot.comparar.findIndex(x=>x.cidade.chave===chave); if(i<0) return;
  potAba('calcular'); potEscolherCidade(_pot.comparar[i].cidade,true); _pot.ov=Object.assign({},_pot.comparar[i].ov); potRenderPremissas(); potMarcaAlterados(); potRecalcula();
}
function potComparaLimpa(){ _pot.comparar=[]; potComparaContador(); potRenderComparar(); }

/* Busca própria da vista (lista simples; Enter escolhe a primeira). */
let _potCRes=[], _potCSeq=0, _potCTimer=0;
function potComparaBusca(el){
  clearTimeout(_potCTimer); const termo=el.value, meu=++_potCSeq;
  _potCTimer=setTimeout(async()=>{
    try{ const l=await potBuscarCidades(termo); if(meu!==_potCSeq) return; _potCRes=l.slice(0,12); potComparaLista(termo); }
    catch(e){ gToast('Não consegui buscar as cidades.'); }
  },180);
}
function potComparaLista(termo){
  const ul=_potEl('pot-clista'); if(!ul) return;
  ul.innerHTML=_potCRes.length ? _potCRes.map((c,i)=>'<li><button type="button" onclick="potComparaEscolhe('+i+')"><span class="pot-li-nome">'+gEsc(c.nome)+' <em>'+gEsc(c.uf)+'</em></span><span class="pot-li-pop">'+potNumero(c.populacao)+' hab.</span></button></li>').join('')
    : (gNormBusca(termo).trim().length>=2 ? '<li class="pot-li-vazio">Nenhuma cidade com esse nome.</li>' : '');
  ul.hidden=!ul.innerHTML;
}
function potComparaPrimeira(){ if(_potCRes.length) potComparaEscolhe(0); }
function potComparaEscolhe(i){
  const c=_potCRes[i]; if(!c) return;
  if(potComparaPoe(c,{})) potRenderComparar();
  const q=_potEl('pot-cq'); if(q){ q.value=''; q.focus(); }
}

/* Slides em lote: sequencial, com o estado de cada coluna. */
async function potComparaLote(){
  if(_pot.gerando || !_pot.comparar.length) return;
  _pot.gerando=true;
  const btn=_potEl('pot-lote'); if(btn) btn.disabled=true;
  let ok=0, erro=0;
  for(const item of _pot.comparar){
    const calc=potCalcular(item.cidade,_pot,item.ov);
    if(calc.inv==null){ item.estado={erro:'Sem investimento total: ajuste os concorrentes.'}; erro++; potRenderComparar(); continue; }
    item.estado={gerando:true}; potRenderComparar();
    try{
      const j=await potChamaGerador(calc);
      item.estado={url:j.url}; ok++;
      potRegistrarProposta(calc,j.url,item.ov);
    }catch(e){ item.estado={erro:String((e&&e.message)||'Falhou.')}; erro++; }
    potRenderComparar();
  }
  _pot.gerando=false; potRenderComparar();
  gToast(ok+(ok===1?' slide gerado':' slides gerados')+(erro?' · '+erro+' com erro':'')+'. Os links estão em cada coluna.');
}
