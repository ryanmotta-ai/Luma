/**
 * js/potencial/historico.js
 *
 * POTENCIAL — o histórico de propostas (v2, 30/10/2026). Cada slide gerado fica em
 * `luma.potencial_propostas` (quem, qual cidade, com quais ajustes, quais números, o link). Cada pessoa vê as
 * próprias; a gestão vê todas (RLS, 20261030100000). "Reabrir" volta ao Calcular com a cidade e os ajustes
 * daquela proposta — para refazer ou conferir o que foi enviado.
 *
 * O histórico nunca atrapalha o slide (`potRegistrarProposta` engole a falha). Se a tabela ainda não existe,
 * esta vista diz isso em vez de mostrar uma lista vazia que parece "ninguém gerou nada".
 * Depende de: motor.js, potencial.js (`_pot`, `_potSb`, `potAba`, `potEscolherCidade`).
 */

async function potRenderHistorico(){
  const raiz=_potEl('pot-v-historico'); if(!raiz) return;
  raiz.innerHTML='<div class="pot-esqueleto" aria-busy="true"><i></i><i></i><i></i></div>';
  try{
    if(!_pot.historico) _pot.historico=await potCarregaHistorico();
  }catch(e){
    raiz.innerHTML='<p class="pot-vazio pot-erro" role="alert">O histórico ainda não está ativo no banco. Aplique a migration do Potencial v2.</p>'; return;
  }
  const l=_pot.historico, gestao=typeof gIsSuperAdmin==='function'&&gIsSuperAdmin();
  if(!l.length){
    raiz.innerHTML='<section class="pot-vazio-tela"><div class="pot-vazio-arte" aria-hidden="true">'+POT_ICO.slide+'</div><h2>Nenhum slide gerado ainda</h2>'
      +'<p>Cada slide que você gerar aparece aqui, com os números que foram para a apresentação.</p></section>'; return;
  }
  raiz.innerHTML='<div class="pot-hist-topo"><h2>Histórico <span>'+l.length+(l.length===1?' proposta':' propostas')+(gestao?' · de toda a equipe':'')+'</span></h2></div>'
    +'<div class="pot-hist">'+l.map((p,i)=>{
      const r=p.resumo||{}, d=new Date(p.criado_em);
      const dado=(rot,v)=>'<div><dt>'+rot+'</dt><dd>'+v+'</dd></div>';
      return '<article class="pot-hist-i"><header><h3>'+gEsc(p.cidade_nome)+' <em>'+gEsc(p.uf)+'</em></h3>'
        +'<time datetime="'+gEsc(p.criado_em)+'">'+gEsc(d.toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}))+'</time></header>'
        +(gestao&&p.por?'<p class="pot-hist-por">por '+gEsc(p.por)+'</p>':'')
        +'<dl>'+dado('Investimento',potBRLc(r.inv))+dado('GMV (real)',potBRLc(r.gmvReal))+dado('Payback',potMeses(r.paybackReal))+dado('Caixa em 24 m',potBRLc(r.resultado24))+'</dl>'
        +'<footer>'+(p.slide_url?'<a class="pot-link" href="'+gEsc(p.slide_url)+'" target="_blank" rel="noopener">Abrir slide</a>':'')
        +'<button type="button" class="pot-link" onclick="potReabrir('+i+')">Reabrir no Calcular</button></footer></article>';
    }).join('')+'</div>';
}

async function potCarregaHistorico(){
  const sb=_potSb(); if(!sb) throw new Error('sem banco');
  const { data, error } = await sb.from('potencial_propostas').select('*').order('criado_em',{ascending:false}).limit(120);
  if(error) throw error;
  const lista=data||[];
  // A gestão vê as de todos: um segundo passo põe o nome de quem gerou (profiles é legível pela equipe).
  if(typeof gIsSuperAdmin==='function' && gIsSuperAdmin() && lista.length && window.sb){
    try{
      const ids=Array.from(new Set(lista.map(p=>p.user_id)));
      const { data:pf } = await window.sb.from('profiles').select('id,nome').in('id',ids);
      const nomes={}; (pf||[]).forEach(x=>{ nomes[x.id]=x.nome; });
      lista.forEach(p=>{ p.por=nomes[p.user_id]||''; });
    }catch(e){}
  }
  return lista;
}

async function potReabrir(i){
  const p=(_pot.historico||[])[i]; if(!p) return;
  const c=await potCidadePorChave(p.cidade_chave);
  if(!c){ gToast('Essa cidade saiu da base.'); return; }
  potAba('calcular'); potEscolherCidade(c,true);
  _pot.ov=Object.assign({},p.ajustes||{}); potRenderPremissas(); potMarcaAlterados(); potRecalcula();
}
