/* ══════════════════════════════════════════════════════════════════════════════════════════
   BANCADA DE PARIDADE — `fRenderTemplateLayers` (o que o franqueado baixa) contra
   `pvRenderLayers` (a prévia e a exportação do Estúdio). Abra `tests/_paridade-render.html`
   ou rode `node scripts/run-browser-tests.js _paridade`.

   Por que existe: o `02_ARCHITECTURE` promete "um motor de render, três alvos", mas o código
   tem quatro implementações de "desenhar uma camada" (MAPA.md). O ticket 5 do estudo de
   fidelidade (05/09) manda migrar a saída do Estúdio para o motor único, e o critério de
   aceite é "grupo + máscara + multiply + ajuste + texto ficam iguais entre as saídas".
   Esta bancada MEDE esse `iguais` recurso a recurso, para a migração ser dirigida por número
   em vez de palpite — e para a melhora ser visível a cada passo.

   ⚠ NÃO é portão de CI, de propósito: o prefixo `_` tira o arquivo da rodada padrão. Ela
   documenta um defeito conhecido; travar o push de todo mundo por causa dele não ajuda.
   Quando os números chegarem perto de zero, aí sim vira suíte com asserção.
   ══════════════════════════════════════════════════════════════════════════════════════════ */
(async function(){
  const W=400, H=500;
  const saida=document.getElementById('saida');
  const amostras=document.getElementById('amostras');
  const linhas=[];

  // O pv* lê `dVars` sem guarda (rótulo de campo na prévia) e o motor lê `fState.material`.
  window.dVars=[];
  const fundo={id:'fundo',type:'shape',shapeKind:'rect',x:0,y:0,w:W,h:H,fill:'#123c5a',visible:true,opacity:100};
  const texto={id:'txt',type:'text',content:'PIZZA HOJE',x:24,y:60,w:352,h:80,font:'Arial',
    fontSize:44,lineHeight:1.2,textAlign:'left',textBox:'point',color:'#ffffff',visible:true,opacity:100};

  // Máscara: gradiente horizontal opaco→transparente, do tamanho da camada mascarada.
  const mascaraUrl=(()=>{
    const c=document.createElement('canvas');c.width=200;c.height=200;
    const x=c.getContext('2d');const g=x.createLinearGradient(0,0,200,0);
    g.addColorStop(0,'#fff');g.addColorStop(1,'rgba(255,255,255,0)');
    x.fillStyle=g;x.fillRect(0,0,200,200);return c.toDataURL('image/png');
  })();

  const casos=[
    {nome:'controle (forma + texto)', layers:[fundo,texto]},
    {nome:'multiply', layers:[fundo,
      {id:'m',type:'shape',shapeKind:'rect',x:40,y:200,w:200,h:200,fill:'#ff8c00',visible:true,opacity:100,blendMode:'multiply'}]},
    {nome:'máscara', layers:[fundo,
      {id:'mk',type:'shape',shapeKind:'rect',x:40,y:200,w:200,h:200,fill:'#ff8c00',visible:true,opacity:100,mask:mascaraUrl}]},
    {nome:'ajuste de cor', layers:[fundo,texto,
      {id:'aj',type:'adjustment',adjustmentType:'invert',adjustment:{type:'invert'},adjustmentSupported:true,
       x:0,y:0,w:W,h:H,visible:true,opacity:100}]},
    {nome:'grupo com opacidade', layers:[fundo,
      {id:'g1',type:'group',x:40,y:200,w:240,h:240,visible:true,opacity:50,isolation:true},
      {id:'g1a',parentId:'g1',type:'shape',shapeKind:'rect',x:40,y:200,w:200,h:200,fill:'#ff8c00',visible:true,opacity:100},
      {id:'g1b',parentId:'g1',type:'shape',shapeKind:'circle',x:120,y:260,w:160,h:160,fill:'#ffffff',visible:true,opacity:100}]}
  ];

  const novoCanvas=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;return c;};

  // O pv* é recursivo por callback e não devolve promessa. Sem o teto de tempo, um `type` que
  // ele não conhece (grupo, por exemplo) pode nunca chamar o `done` e travar a página inteira.
  const comTeto=(p,ms)=>Promise.race([p,new Promise(r=>setTimeout(()=>r('timeout'),ms))]);

  async function motorUnico(layers){
    const cv=novoCanvas(), ctx=cv.getContext('2d');
    window.fState={material:{w:W,h:H,fmt:'orig',layers:layers},dados:{},camp:{color:'#FF9000'},fmt:{id:'feed'}};
    await fRenderTemplateLayers(ctx,JSON.parse(JSON.stringify(layers)),W,H,{},{color:'#FF9000'},
      window.fState.material,{scope:'designer',purpose:'export'});
    return cv;
  }
  async function motorEstudio(layers){
    const cv=novoCanvas(), ctx=cv.getContext('2d');
    // `pvRenderViaMotor` é a ponte de produção (o que a prévia e o PNG do Estúdio chamam);
    // caindo para `pvRenderLayers` a bancada volta a medir o renderizador antigo, que é
    // exatamente o que se quer se a ponte for removida ou a rede for acionada.
    const desenhar=(res)=>(typeof pvRenderViaMotor==='function')
      ? pvRenderViaMotor(ctx,JSON.parse(JSON.stringify(layers)),W,H,'export',res)
      : pvRenderLayers(ctx,JSON.parse(JSON.stringify(layers)),W,H,0,res);
    const r=await comTeto(new Promise(desenhar),4000);
    return r==='timeout' ? null : cv;
  }

  // % de pixels que divergem. Tolerância 8 por canal absorve antialias; alpha entra na conta
  // porque metade das divergências deste par é justamente área que um lado pinta e o outro não.
  function divergencia(a,b){
    const A=a.getContext('2d').getImageData(0,0,W,H).data;
    const B=b.getContext('2d').getImageData(0,0,W,H).data;
    let ruins=0;
    for(let i=0;i<A.length;i+=4){
      const d=Math.max(Math.abs(A[i]-B[i]),Math.abs(A[i+1]-B[i+1]),Math.abs(A[i+2]-B[i+2]),Math.abs(A[i+3]-B[i+3]));
      if(d>8) ruins++;
    }
    return Math.round(ruins/(W*H)*1000)/10;
  }

  for(const caso of casos){
    let linha;
    try{
      const [um,dois]=[await motorUnico(caso.layers), await motorEstudio(caso.layers)];
      if(!dois){ linha={nome:caso.nome,pct:null,nota:'o pv* não terminou o render (4s)'}; }
      else{
        linha={nome:caso.nome,pct:divergencia(um,dois),nota:''};
        const fig=document.createElement('div');fig.className='par';
        fig.innerHTML='<figure><figcaption>'+caso.nome+' · motor único</figcaption></figure>'
                     +'<figure><figcaption>'+caso.nome+' · Estúdio (pv*)</figcaption></figure>';
        fig.children[0].prepend(um); fig.children[1].prepend(dois);
        amostras.appendChild(fig);
      }
    }catch(e){ linha={nome:caso.nome,pct:null,nota:String(e&&e.message||e)}; }
    linhas.push(linha);
  }

  const fmt=(l)=>l.pct==null ? (l.nome+': — ('+l.nota+')')
                             : (l.nome+': '+l.pct.toFixed(1)+'% dos pixels divergem');
  saida.textContent='Divergência entre fRenderTemplateLayers e pvRenderLayers ('+W+'×'+H+'):\n\n'
    +linhas.map(l=>'  · '+fmt(l)).join('\n')
    +'\n\nMeta do ticket 5: todas as linhas perto de 0%. Controle alto significa que a comparação\n'
    +'está errada, não que o motor está — confira o caso simples antes de acreditar no resto.';

  /* A bancada também publica o contrato do runner: rodando com filtro `_paridade`, o resultado
     sai no terminal. Nenhum caso "falha" aqui — o número É a entrega. */
  const medidos=linhas.filter(l=>l.pct!=null).length;
  document.title='Paridade — '+linhas.map(l=>l.pct==null?'—':l.pct+'%').join(' / ');
  window.__lumaTest={passed:medidos,total:linhas.length,
    failures:linhas.filter(l=>l.pct==null).map(l=>({name:l.nome,error:l.nota})),
    notas:linhas.map(fmt)};
})();
