/* Dados só da bancada _search-feedback-app.html. Nenhuma chamada ao Supabase real. */
(function(){
  const fixtureUser={id:crypto.randomUUID(),role:'equipe_dm',displayName:'Teste Luma',email:'teste@example.invalid'};
  let fixtureHistory=[];
  fGetHist=()=>fixtureHistory;fSaveHist=rows=>{fixtureHistory=rows;return true;};
  fGetFavs=()=>[];
  gLoadProfile=async()=>{gAuthState={user:fixtureUser};return fixtureUser;};
  const submissions=[],events=[];
  window.__feedbackFixture={submissions,events};
  const client={auth:{getSession:async()=>({data:{session:{user:fixtureUser}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},schema:()=>({
    rpc(name,args){
      let data=true;
      if(name==='submit_feedback'){
        const row=args.p_feedback;
        if(!submissions.some(s=>s.id===row.id))submissions.push({...row,created_at:new Date().toISOString()});
        data=row.id;
      }else if(name==='content_requests')data=submissions.filter(r=>r.type==='content_request').map(r=>({query:r.query,query_normalized:r.query,request_count:1,last_requested_at:r.created_at}));
      else events.push(args);
      const result=Promise.resolve({data,error:null});result.abortSignal=()=>result;return result;
    },
    from(){let type;const q={select(){return q;},order(){return q;},range(){return q;},eq(k,v){if(k==='type')type=v;return q;},then(fn){return Promise.resolve({data:submissions.filter(r=>!type||r.type===type)}).then(fn);}};return q;}
  })};
  window.sb=client;
  // Os syncs não fazem parte desta bancada de busca/feedback; não sobrescrevem fixtures.
  gFeatureSyncFromBackend=async()=>{};gFlushPendingDeletes=async()=>{};
  dSyncVarsFromBackend=dSyncFoldersFromBackend=dSyncFontsFromBackend=dSyncSnippetsFromBackend=dSyncLibFromBackend=fSyncArtesFromBackend=async()=>{};
  fPushArtesToBackend=async()=>{};fMarkBaixadaBackend=async()=>{};
  gAskAI=async()=>null;
  const campaigns=[
    {id:'test-burger',name:'Festival de Hambúrguer',color:'#FF9000',description:'Hambúrguer e combos no domingo',products:['hambúrguer','combo'],popular:true},
    {id:'test-pizza',name:'Pizza em dobro',color:'#C81818',tags:['pizza','promoção']},
    {id:'test-frete',name:'Frete grátis',color:'#FFB900',description:'Entrega gratuita no fim de semana'}
  ];
  dFolders=campaigns.map((c,i)=>{
    const t=_fDemoMaterial({...c,cover:'fixture',perguntas:[]});
    t.id='fixture-template-'+i;t.name=c.name+' · Story';t._demo=false;
    return {id:'folder-'+i,campId:c.id,name:c.name,color:c.color,templates:[t]};
  });
  fGetCampaigns=()=>({ativas:campaigns,outras:[],impl:[]});
  window.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('sp-overlay')?.remove();
    const login=document.getElementById('g-login-screen');if(login)login.style.display='none';
  });
})();
