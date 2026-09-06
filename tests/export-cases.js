/* ══════════════════════════════════════════════════════════════════════════════════════════
   CONTRATO DE EXPORTAÇÃO — abra `tests/export.html` ou rode
   `node scripts/run-browser-tests.js export`.

   O que ele cobra: as DIMENSÕES e a escala do que sai pelo caminho do franqueado. Não é o
   corpus (aquele mede composição e geometria de texto) nem o importador de PSD — é a promessa
   do arquivo entregue: uma prancheta de 1080×1350 tem que conseguir sair 1080×1350.

   Por que existe: o 2× estava escrito na mão dentro do render e não havia como pedir o tamanho
   nativo. Comparar a saída do Luma com o composto do Photoshop exige as mesmas dimensões —
   2160×2700 ao lado de 1080×1350 é outra resolução, não é igualdade (estudo de fidelidade
   05/09 §5.8, ticket 3). Aqui é onde os próximos contratos de saída (original sem perdas,
   paridade Estúdio × franqueado) devem entrar.
   ══════════════════════════════════════════════════════════════════════════════════════════ */
(async function(){
  const results=document.getElementById('results');
  const summary=document.getElementById('summary');
  const cases=[];
  const test=(name,fn)=>cases.push({name,fn});
  const assert=(condition,message)=>{if(!condition)throw new Error(message||'asserção falhou');};

  /* Material mínimo com layers reais (fundo + texto): é o CAMINHO NOVO do render, o mesmo que
     o franqueado usa. `fState` mora no 01-state.js, que esta página não carrega — o motor só
     lê `fState.material`, então o stub basta e não inventa uma segunda fonte de estado. */
  const material=()=>({w:1080,h:1350,layers:[
    {id:'fundo',name:'Fundo',type:'shape',shapeKind:'rect',x:0,y:0,w:1080,h:1350,fill:'#F3EFE7',visible:true,opacity:100},
    {id:'titulo',name:'Título',type:'text',content:'PIZZA HOJE',x:110,y:180,w:860,h:200,
     font:'Arial',fontSize:78,lineHeight:1.2,textAlign:'left',textBox:'box',vAlign:'top',visible:true,opacity:100}
  ]});
  const camp={id:'teste',color:'#FF9000'};
  const fmt={id:'feed'};
  const exportar=async(opts)=>{
    window.fState={material:material(),dados:{},camp:camp,fmt:fmt};
    return await fRenderCanvasHelper({},camp,fmt,opts);
  };

  test('modo nativo exporta a prancheta no tamanho real',async()=>{
    const cv=await exportar({scale:1});
    assert(cv.width===1080&&cv.height===1350,
      'a prancheta de 1080×1350 saiu '+cv.width+'×'+cv.height+' — o modo nativo não é nativo');
  });

  test('2× continua o padrão quando ninguém pede escala',async()=>{
    const cv=await exportar();
    assert(cv.width===2160&&cv.height===2700,
      'o super-sampling padrão mudou sem aviso: saiu '+cv.width+'×'+cv.height+' em vez de 2160×2700');
  });

  test('escala inválida cai no padrão em vez de zerar o arquivo',()=>{
    assert(fExportScale({scale:0})===F_EXPORT_SCALE_DEFAULT,'escala 0 produziria um canvas vazio');
    assert(fExportScale({scale:-3})===F_EXPORT_SCALE_DEFAULT,'escala negativa passou pelo resolvedor');
    assert(fExportScale(null)===F_EXPORT_SCALE_DEFAULT,'sem opções o resolvedor não devolveu o padrão');
    assert(fExportScale({scale:3})===3,'uma escala explícita e válida foi ignorada');
  });

  let passed=0;
  const falhas=[];
  for(const item of cases){
    const li=document.createElement('li');li.className='case';
    try{
      await item.fn();passed++;li.classList.add('pass');
      li.innerHTML='<strong>✓ '+item.name+'</strong>';
    }catch(error){
      li.classList.add('fail');
      li.innerHTML='<strong>✕ '+item.name+'</strong><small>'+String(error&&error.message||error)+'</small>';
      console.error('[export]',item.name,error);
      falhas.push({name:item.name,error:String(error&&error.message||error)});
    }
    results.appendChild(li);
  }
  const failed=cases.length-passed;
  summary.textContent=passed+'/'+cases.length+' cenários passaram'+(failed?' · '+failed+' falharam':' · contrato de saída mantido');
  summary.dataset.passed=String(passed);summary.dataset.total=String(cases.length);
  document.title=(failed?'FALHOU':'OK')+' — Export ('+passed+'/'+cases.length+')';

  /* Contrato do runner de CI (`scripts/run-browser-tests.js`): a suíte publica o resultado
     aqui quando termina — o render é assíncrono, esperar o `load` pegaria no meio. */
  window.__lumaTest={passed:passed,total:cases.length,failures:falhas};
})();
