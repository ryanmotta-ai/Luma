/**
 * js/potencial/tarifas.js
 *
 * POTENCIAL — Tarifas (só a gestão, v2, 30/10/2026). Edita na tela o que antes exigia SQL: os parâmetros
 * (IPCA, multiplicadores, tickets, deltas…), as 37 faixas de população e o cadastro de uma cidade que não
 * está na base (hoje faltam ~22 municípios cujo nome mudou no IBGE).
 *
 * ⛔ Quem manda é a RLS: só `gestao` escreve em luma.potencial_* (20261029120000). A aba só aparece para a
 *   gestão (`gIsSuperAdmin`), mas esconder não protege nada — se o banco recusar, o toast diz.
 * ⛔ Valor digitado é validado antes de gravar (número, JSON, faixa coerente): uma tarifa errada vira slide
 *   errado para o comercial inteiro.
 * Depende de: motor.js, potencial.js (`_pot`, `_potSb`, `potCarregar`, `potRecalcula`).
 */

const POT_UFS=['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

async function potRenderTarifas(){
  const raiz=_potEl('pot-v-tarifas'); if(!raiz) return;
  if(!(typeof gIsSuperAdmin==='function' && gIsSuperAdmin())){ raiz.innerHTML='<p class="pot-vazio">Só a gestão edita as tarifas.</p>'; return; }
  const sb=_potSb(); if(!sb){ raiz.innerHTML='<p class="pot-vazio pot-erro">Sem conexão com o banco.</p>'; return; }
  const { data:pr } = await sb.from('potencial_parametros').select('chave,valor,descricao,atualizado_em').order('chave');
  const params=pr||[];
  raiz.innerHTML=
    '<div class="pot-tar">'
    +'<section class="pot-sec"><header><h3>Parâmetros</h3><p>Cada alteração vale para todo o comercial na próxima vez que abrir a tela.</p></header>'
    +'<div class="pot-tar-lista">'+params.map(p=>potLinhaParametro(p)).join('')+'</div></section>'
    +'<section class="pot-sec"><header><h3>Faixas de população</h3><p>Taxa de franquia e a base do marketing de lançamento (antes de IPCA e concorrência).</p></header>'
    +'<div class="pot-tab-rolo"><table class="pot-tab pot-tab-edit"><thead><tr><th>De (hab.)</th><th>Até (hab.)</th><th>Taxa de franquia</th><th>Base do marketing</th><th></th></tr></thead><tbody>'
    +(_pot.faixas||[]).map(f=>'<tr data-id="'+f.id+'"><td><input data-c="pop_min" inputmode="numeric" value="'+f.pop_min+'" aria-label="Habitantes, de"></td><td><input data-c="pop_max" inputmode="numeric" value="'+(f.pop_max==null?'':f.pop_max)+'" placeholder="sem teto" aria-label="Habitantes, até"></td>'
      +'<td><input data-c="taxa_franquia" inputmode="decimal" value="'+f.taxa_franquia+'" aria-label="Taxa de franquia"></td><td><input data-c="mkt_base" inputmode="decimal" value="'+f.mkt_base+'" aria-label="Base do marketing"></td>'
      +'<td><button type="button" class="pot-link" onclick="potSalvaFaixa('+f.id+',this)">Salvar</button></td></tr>').join('')
    +'</tbody></table></div></section>'
    +'<section class="pot-sec"><header><h3>Cadastrar cidade</h3><p>Para o município que não aparece na busca. A chave é UF-Nome; repetida, o banco recusa.</p></header>'
    +'<form class="pot-form" onsubmit="return potCadastraCidade(event)">'
    +'<label>Nome<input name="nome" required maxlength="80" autocomplete="off"></label>'
    +'<label>UF<select name="uf" required><option value="">—</option>'+POT_UFS.map(u=>'<option>'+u+'</option>').join('')+'</select></label>'
    +'<label>População (2025)<input name="populacao" required inputmode="numeric"></label>'
    +'<label>PIB per capita<input name="pib" inputmode="decimal" placeholder="opcional"></label>'
    +'<label>Concorrentes<input name="concorrentes" inputmode="numeric" placeholder="opcional"></label>'
    +'<label>Taxa negociada<input name="taxa" inputmode="decimal" placeholder="usa a da faixa"></label>'
    +'<label class="pot-form-chk"><input type="checkbox" name="naovender"> Marcar como "não vender"</label>'
    +'<button type="submit" class="pot-cta">'+POT_ICO.mais+'<span>Cadastrar cidade</span></button></form></section></div>';
}

/* Um parâmetro vira o controle certo para o tipo do valor: número, sim/não, texto ou JSON. */
function potLinhaParametro(p){
  const v=p.valor, id='pot-p-'+gEsc(p.chave);
  let campo;
  if(typeof v==='boolean') campo='<label class="pot-chk"><input type="checkbox" id="'+id+'" '+(v?'checked':'')+'> Ligado</label>';
  else if(typeof v==='number') campo='<input id="'+id+'" inputmode="decimal" value="'+gEsc(String(v).replace('.',','))+'">';
  else if(v!==null && typeof v==='object') campo='<textarea id="'+id+'" rows="3" spellcheck="false">'+gEsc(JSON.stringify(v))+'</textarea>';
  else campo='<input id="'+id+'" value="'+gEsc(v==null?'':String(v))+'" placeholder="vazio = desligado">';
  return '<div class="pot-tar-p" data-chave="'+gEsc(p.chave)+'" data-tipo="'+(typeof v==='boolean'?'bool':typeof v==='number'?'num':v!==null&&typeof v==='object'?'json':'txt')+'">'
    +'<div><label for="'+id+'"><code>'+gEsc(p.chave)+'</code></label><p>'+gEsc(p.descricao||'')+'</p></div>'
    +'<div class="pot-tar-c">'+campo+'<button type="button" class="pot-link" onclick="potSalvaParametro(this)">Salvar</button></div></div>';
}

async function potSalvaParametro(btn){
  const linha=btn.closest('.pot-tar-p'), chave=linha.dataset.chave, tipo=linha.dataset.tipo, campo=linha.querySelector('input,textarea');
  let valor;
  try{
    if(tipo==='bool') valor=campo.checked;
    else if(tipo==='num'){ valor=potLerNumero(campo.value); if(valor==null) throw new Error('Digite um número.'); }
    else if(tipo==='json'){ valor=JSON.parse(campo.value); }
    else valor=campo.value.trim()===''?null:campo.value.trim();
    if(chave==='slides_webapp_url' && valor!=null && !/^https:\/\/script\.google\.com\//.test(valor)) throw new Error('A URL do gerador começa com https://script.google.com/');
  }catch(e){ gToast(e instanceof SyntaxError?'O JSON está inválido. Confira as vírgulas e as aspas.':e.message); return; }
  const solta=gBtnLoading(btn,'Salvando…');
  try{
    const { error } = await _potSb().from('potencial_parametros').upsert({ chave, valor, atualizado_em:new Date().toISOString() });
    if(error) throw error;
    await potCarregar(true); potRecalcula(); gToast('Parâmetro "'+chave+'" salvo.');
  }catch(e){ gToast('O banco recusou a alteração: '+String((e&&e.message)||e)); }
  finally{ solta(); }
}

async function potSalvaFaixa(id, btn){
  const tr=btn.closest('tr'), g=c=>tr.querySelector('[data-c="'+c+'"]').value.trim();
  const min=parseInt(g('pop_min'),10), max=g('pop_max')===''?null:parseInt(g('pop_max'),10);
  const taxa=potLerNumero(g('taxa_franquia')), base=potLerNumero(g('mkt_base'));
  if(isNaN(min)||min<1||(max!=null&&(isNaN(max)||max<min))||taxa==null||base==null||taxa<0||base<0){ gToast('Confira a faixa: "de" menor que "até" e valores positivos.'); return; }
  const solta=gBtnLoading(btn,'Salvando…');
  try{
    const { error } = await _potSb().from('potencial_faixas').update({ pop_min:min, pop_max:max, taxa_franquia:taxa, mkt_base:base }).eq('id',id);
    if(error) throw error;
    await potCarregar(true); potRecalcula(); gToast('Faixa salva.');
  }catch(e){ gToast('O banco recusou a alteração: '+String((e&&e.message)||e)); }
  finally{ solta(); }
}

async function potCadastraCidade(ev){
  ev.preventDefault();
  const f=ev.target, v=n=>f.elements[n].value.trim();
  const nome=v('nome'), uf=v('uf'), pop=parseInt(v('populacao').replace(/\./g,''),10);
  if(!nome||!uf||isNaN(pop)||pop<1){ gToast('Preencha nome, UF e população.'); return false; }
  const pib=v('pib')===''?null:potLerNumero(v('pib')), conc=v('concorrentes')===''?null:parseInt(v('concorrentes'),10), taxa=v('taxa')===''?null:potLerNumero(v('taxa'));
  const btn=f.querySelector('button[type=submit]'); const solta=gBtnLoading(btn,'Cadastrando…');
  try{
    const { error } = await _potSb().from('potencial_cidades').insert({
      chave:uf+'-'+nome, uf, nome, busca:gNormBusca(nome)+' '+uf.toLowerCase(), populacao:pop, pib_per_capita:pib,
      concorrentes:conc, taxa_franquia_override:taxa, vender:!f.elements.naovender.checked });
    if(error) throw error;
    gToast(nome+' - '+uf+' cadastrada. Já aparece na busca.'); f.reset();
  }catch(e){
    gToast(/duplicate|23505/i.test(String((e&&e.message)||e)) ? 'Essa cidade já existe na base.' : 'O banco recusou o cadastro: '+String((e&&e.message)||e));
  }finally{ solta(); }
  return false;
}
