/** Busca local do catálogo. Adaptador, ranking e eventos separados da apresentação.
 * Só lê metadados/camadas já carregados: buscar nunca inicia download de um PSD.
 * Depende de gNormBusca, catálogo/materiais e gTrackEvent (na hora da interação).
 */
const F_SEARCH_ALIASES = {
  burger:'hamburguer', burgers:'hamburguer', hamburgueres:'hamburguer',
  hamburgers:'hamburguer', hamburger:'hamburguer', pizzas:'pizza', combos:'combo',
  stories:'story', status:'whatsapp', zap:'whatsapp', insta:'instagram',
  promo:'promocao', promocoes:'promocao', delivery:'entrega', frete:'entrega',
  gratis:'gratuito', gratuita:'gratuito', gratuitas:'gratuito', gratuitos:'gratuito',
  domingo:'domingo', domingos:'domingo', lanches:'lanche', wide:'post'
};
const F_SEARCH_RELATED = {lanche:['hamburguer','combo'], instagram:['story','feed'], whatsapp:['story']};
const F_SEARCH_STOP = new Set('a o as os um uma uns umas de da do das dos em no na nos nas para pra pro por com e ou ao aos que quero queria preciso gostaria algo alguma algum divulgar postar publicar campanha campanhas arte artes material materiais meu minha seu sua'.split(' '));
const F_SEARCH_FORMATS = new Set(['story','feed','post','instagram','whatsapp']);
function fSearchTokens(value){
  return [...new Set(gNormBusca(value).replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/)
    .filter(w=>w.length>1&&!F_SEARCH_STOP.has(w)).map(w=>F_SEARCH_ALIASES[w]||w))].slice(0,32);
}
function _fSearchText(value){
  if(Array.isArray(value)) return value.filter(v=>typeof v==='string').slice(0,100).join(' ');
  return typeof value==='string'?value.slice(0,4000):'';
}
// Campos opcionais: não serializar objetos inteiros (fotos, IDs e dados privados não são termos).
function _fSearchFields(object){
  const o=object||{}, fields=[];
  const add=(keys,weight)=>keys.forEach(k=>{const text=_fSearchText(o[k]);if(text)fields.push({text,weight});});
  add(['name','title','nome','products','product','produto','produtos'],10);
  add(['tags','category','categoria','occasion','occasions','ocasiao','objective','objetivo'],7);
  add(['description','descricao','period','periodo','instrucoes','previewProd'],4);
  return fields;
}
function _fSearchMetadata(object){
  if(!object)return [];
  return [object,object.search,object.searchMeta,object.metadata,object.meta&&object.meta.search]
    .filter(o=>o&&typeof o==='object'&&!Array.isArray(o)).flatMap(_fSearchFields);
}
function _fSearchMaterials(c,folder){
  const materials=typeof fGetMaterialsForCamp==='function'?fGetMaterialsForCamp(c.id):(c.templates||[]);
  return materials.filter(m=>m&&m.publishMeta&&m.publishMeta.publicado===true&&
    (typeof fIsMaterialValid!=='function'||fIsMaterialValid(m)));
}
function fSearchDocument(c){
  const folder=typeof fFolderForCamp==='function'?fFolderForCamp(c):null;
  if(!c || c.arquivada || (folder&&folder.arquivada) ||
    (typeof _fCampAgendadaFuturo==='function'&&_fCampAgendadaFuturo(c))) return null;
  const base=[..._fSearchMetadata(c),..._fSearchMetadata(folder)];
  const mats=_fSearchMaterials(c,folder);
  const declared=!mats.length?fSearchTokens(_fSearchText(c.formats)):[];
  const formats=[...new Set(mats.map(m=>F_SEARCH_ALIASES[m.fmt]||m.fmt).concat(declared).filter(Boolean))];
  const docs=mats.map(m=>{
    const fields=[...base,..._fSearchMetadata(m),..._fSearchMetadata(m.publishMeta)];
    const fmt=F_SEARCH_ALIASES[m.fmt]||m.fmt;
    if(fmt)fields.push({text:fmt,weight:9});
    // Só conteúdo autorado disponível, nunca respostas/fotos do franqueado.
    (m.layers||[]).filter(l=>l&&l.type==='text'&&l.visible!==false).forEach(l=>{
      if(l.content)fields.push({text:String(l.content).replace(/\{\{[^}]*\}\}/g,' '),weight:2});
    });
    return {id:m.remoteId||m.id,fields};
  });
  // Campanhas antigas sem material continuam buscáveis pelo nome/metadados.
  if(!docs.length)docs.push({id:null,fields:base.concat(declared.length?[{text:declared.join(' '),weight:9}]:[])});
  return {campaign:c,formats,docs:docs.map(d=>({id:d.id,fields:d.fields.map(f=>({...f,tokens:fSearchTokens(f.text)}))}))};
}
function _fSearchTypo(a,b){
  if(a.length<5||b.length<5||Math.abs(a.length-b.length)>1)return false;
  let i=0,j=0,edits=0;
  while(i<a.length&&j<b.length){
    if(a[i]===b[j]){i++;j++;continue;}
    if(++edits>1)return false;
    if(a.length===b.length&&a[i]===b[j+1]&&a[i+1]===b[j]){i+=2;j+=2;}
    else if(a.length>b.length)i++;
    else if(b.length>a.length)j++;
    else {i++;j++;}
  }
  return edits+(i<a.length||j<b.length?1:0)<=1;
}
function _fSearchMatch(query,word){
  if(query===word)return 1;
  if((F_SEARCH_RELATED[query]||[]).includes(word))return .7;
  if(query.length>=3&&word.startsWith(query))return .8;
  return _fSearchTypo(query,word)?.65:0;
}
function fSearchRank(query,document){
  const words=fSearchTokens(query), content=words.filter(w=>!F_SEARCH_FORMATS.has(w));
  if(!words.length)return {score:0,complete:false,contentHits:0,matched:0,template_id:null};
  let best={score:0,complete:false,contentHits:0,matched:0,template_id:null};
  document.docs.forEach(d=>{
    let score=0,matched=0,contentHits=0;
    words.forEach(word=>{
      let hit=0;
      d.fields.forEach(f=>f.tokens.forEach(t=>{hit=Math.max(hit,_fSearchMatch(word,t)*f.weight);}));
      if(hit){matched++;score+=hit;if(content.includes(word))contentHits++;}
    });
    const complete=matched===words.length;
    if(complete)score+=40;
    const title=fSearchTokens(document.campaign.name||document.campaign.title).join(' ');
    if(title===words.join(' '))score+=35;
    // Uma correspondência de formato sozinha não sugere pizza para quem pediu açaí.
    if(content.length&&!contentHits)score=0;
    if(score>best.score)best={score,complete,contentHits,matched,template_id:d.id};
  });
  return best;
}
function fSearchCampaigns(query,campaigns){
  const seen=new Set(), entries=[];
  (campaigns||[]).forEach((c,order)=>{
    if(!c||seen.has(c.id))return;seen.add(c.id);
    const doc=fSearchDocument(c);if(!doc)return;
    entries.push({...fSearchRank(query,doc),campaign:c,formats:doc.formats,order});
  });
  entries.sort((a,b)=>b.score-a.score||a.order-b.order);
  const exact=entries.filter(e=>e.complete&&e.score>0);
  return {campaigns:exact.map(e=>e.campaign),entries:exact,
    suggestions:exact.length?[]:entries.filter(e=>e.score>0&&!e.complete).slice(0,3)};
}
function fSearchFormatsHTML(c){
  const doc=fSearchDocument(c);
  const names={story:'Story',feed:'Feed',post:'Post'};
  return doc&&doc.formats.length?`<div class="camp-sub f-search-formats">${doc.formats.map(f=>gEsc(names[f]||f)).join(' + ')}</div>`:'';
}
function fSearchFooterHTML(query,suggestions){
  const close=Array.isArray(suggestions)&&suggestions.length;
  return `${close?`<section class="fh-section"><div class="fh-sec"><span>Talvez estas campanhas ajudem</span></div><div class="camp-grid fh-grid">${suggestions.map(e=>fCampEl(e.campaign,false,!_fCampHasMats(e.campaign),true)).join('')}</div></section>`:''}
    <div class="f-search-feedback"><p>Não encontrou o que precisava?</p><button type="button" class="empty-cta ghost" data-query="${gEsc(query)}" onclick="fFeedbackRequest(this.dataset.query,this.parentElement)">Sugerir conteúdo</button></div>`;
}
const _fSearchContexts={home:null,catalog:null};
function fSearchRecord(query,result,source){
  const uid=typeof gCurrentUser==='function'&&gCurrentUser()?.id;
  const q=String(query||'').trim().slice(0,240), old=_fSearchContexts[source];
  if(!q){if(old)clearTimeout(old.timer);_fSearchContexts[source]=null;return;}
  const ids=result.campaigns.map(c=>c.id), suggestions=result.suggestions.map(e=>e.campaign.id);
  const signature=JSON.stringify([uid,q,ids,suggestions]);
  if(old&&old.signature===signature)return;
  if(old)clearTimeout(old.timer);
  const context={signature,uid,query:q,ids,suggestions,source,search_id:typeof gUuid==='function'?gUuid():crypto.randomUUID(),recorded:false};
  context.timer=setTimeout(()=>_fSearchEmit(context),650);
  _fSearchContexts[source]=context;
}
function _fSearchEmit(context){
  if(context.recorded||!context.uid||context.uid!==gCurrentUser()?.id)return;
  context.recorded=true;
  const payload={search_id:context.search_id,query:context.query,query_normalized:gNormBusca(context.query),
    result_count:context.ids.length,suggestion_count:context.suggestions.length,source:context.source,franchise_id:null,client_created_at:new Date().toISOString()};
  gTrackEvent('search_performed',payload,context.search_id);
  if(!context.ids.length)gTrackEvent('search_no_results',payload);
}
function fSearchRecordOpen(campId){
  const source=document.body.classList.contains('f-home-mode')?'home':'catalog', ctx=_fSearchContexts[source];
  if(!ctx||(!ctx.ids.includes(campId)&&!ctx.suggestions.includes(campId)))return;
  clearTimeout(ctx.timer);_fSearchEmit(ctx);
  if(ctx.uid!==gCurrentUser()?.id)return;
  gTrackEvent('search_result_opened',{search_id:ctx.search_id,query:ctx.query,camp_id:campId,source,
    approximate:!ctx.ids.includes(campId),position:ctx.ids.indexOf(campId)+1,result_count:ctx.ids.length});
  _fSearchContexts[source]=null;
}
