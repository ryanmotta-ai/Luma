/* Importador de SVG (js/designer/templates.js, dSvg*) — o contrato com a skill luma-creative e o
   mapeamento para camadas do Luma. Roda o fluxo de verdade (dSvgHandleFile monta o SVG no
   documento e o navegador mede); só o modal de revisão é trocado por "aceitar o padrão".
   Medido em 10/2026: sem estas regras, as artes da skill entravam com 9–31% dos pixels errados,
   o logo virava a moldura da foto e "ANOS", "PEDIR", "CUPOM" viravam campos. */
(async function(){
  const results=document.getElementById('results'), summary=document.getElementById('summary');
  const assert=(cond,msg)=>{ if(!cond) throw new Error(msg); };
  const SVG=(corpo,attrs)=>`<svg xmlns="http://www.w3.org/2000/svg" ${attrs==null?'data-luma="1"':attrs} viewBox="0 0 1080 1350" width="1080" height="1350">${corpo}</svg>`;
  const ESTILO=`<style>.hero{font-family:'Realce',sans-serif;font-weight:900}.leve{font-family:'Roboto',sans-serif;font-weight:300;font-style:italic}.forte{font-family:'Roboto',sans-serif;font-weight:900}.body{font-family:'Roboto',sans-serif;font-weight:400}</style>`;

  async function importar(svg){
    let els=[], tmpl=null, fmt='';
    dFolders=[{id:'t',name:'teste',templates:[]}]; dImportTargetFolderId='t';
    window.dRenderFolders=()=>{}; window.dPersistFolders=()=>{}; window.dLoadTemplate=t=>{ tmpl=t; }; window.gToast=()=>{};
    window.dSvgShowReviewModal=(e,meta)=>{ els=e; fmt=meta.fmt; dSvgCreateTemplate(e,meta,meta.fmt); };
    await dSvgHandleFile(svg,'caso.svg');
    return {els, layers:tmpl?tmpl.layers:[], tela:DFMT_SIZES[fmt]||{w:1080,h:1920}};
  }
  const texto=(L,c)=>L.find(l=>l.type==='text'&&(l.content===c||l.layoutRefText===c||(l.runs&&l.runs.map(r=>r.text).join('')===c)));

  const cases=[];
  const caso=(name,fn)=>cases.push({name,fn});

  caso('slot foto_produto vira MOLDURA com o raio do retângulo; o placeholder de dentro não entra', async()=>{
    const {layers}=await importar(SVG(`<g id="foto_produto"><rect x="100" y="430" width="880" height="520" rx="56" fill="#D9D9D9"/><text x="540" y="700" text-anchor="middle" font-size="32">Use aqui sua foto do produto</text></g>`));
    assert(layers.length===1, 'esperava 1 camada, veio '+layers.length);
    const f=layers[0];
    assert(f.type==='frame' && f.imgVar==='foto_produto', 'não virou moldura foto_produto: '+f.type+' '+f.imgVar);
    assert(f.x===100 && f.y===430 && f.w===880 && f.h===520 && f.radius===56, 'geometria '+[f.x,f.y,f.w,f.h,f.radius]);
  });

  caso('<image> solta no contrato é arte FIXA (o logo não vira moldura)', async()=>{
    const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const {layers}=await importar(SVG(`<image href="${png}" x="100" y="80" width="260" height="52"/>`));
    assert(layers[0].type==='image' && !layers[0].imgVar, 'logo virou '+layers[0].type+' {{'+layers[0].imgVar+'}}');
  });

  caso('no contrato, campo é só quem tem data-campo — caixa alta continua texto fixo', async()=>{
    const {layers}=await importar(SVG(ESTILO+`<text x="100" y="300" class="hero" font-size="150" fill="#FFFFFF" data-campo="produto">PIZZA</text><text x="100" y="500" class="hero" font-size="80" fill="#FFFFFF">ANOS</text>`));
    const p=layers.find(l=>l.content==='{{produto}}'), a=layers.find(l=>l.content==='ANOS');
    assert(p && p.isVar && p.layoutRefText==='PIZZA', 'campo produto ausente ou sem texto de exemplo');
    assert(a && !a.isVar, '"ANOS" virou campo');
  });

  caso('preço-assinatura (R$ e ,90 pequenos) vira o split {{campo:inteiro}}/{{campo:centavos}}', async()=>{
    const {layers}=await importar(SVG(ESTILO+`<text x="146" y="1134" class="hero" font-size="168" fill="#F85400" data-campo="precoPor"><tspan font-size="92" dy="-59">R$</tspan><tspan dy="59" dx="6">22</tspan><tspan font-size="92" dy="-59">,90</tspan></text>`));
    const t=layers[0];
    assert(t.content==='R${{precoPor:inteiro}},{{precoPor:centavos}}', 'conteúdo '+t.content);
    assert(t.fontSize===168 && t.font==='custom:Realce', 'fonte '+t.font+' '+t.fontSize);
  });

  caso('Realce vira custom:Realce; peso e itálico viram trechos (frase mista)', async()=>{
    const {layers}=await importar(SVG(ESTILO+`<text x="100" y="700" font-size="66" fill="#FFFFFF"><tspan class="leve">o presente é </tspan><tspan class="forte">seu!</tspan></text>`));
    const t=layers[0];
    assert(Array.isArray(t.runs) && t.runs.length===2, 'esperava 2 trechos');
    assert(t.runs[0].italic===true && t.runs[0].font==="'Roboto',300", 'trecho leve: '+JSON.stringify(t.runs[0]));
    assert(!t.runs[1].italic && t.runs[1].font==="'Roboto',900", 'trecho forte: '+JSON.stringify(t.runs[1]));
    assert(t.runs[0].text==='o presente é ' && t.runs[1].text==='seu!', 'texto dos trechos');
  });

  caso('texto girado (rotate -90) guarda o ângulo e gira em torno do centro', async()=>{
    const {layers}=await importar(SVG(ESTILO+`<text transform="translate(226,1028) rotate(-90)" text-anchor="middle" class="hero" font-size="66" fill="#FFFFFF">CUPOM</text>`));
    const t=layers[0];
    assert(t.rotation===-90, 'rotation '+t.rotation);
    const cx=t.x+t.w/2, cy=t.y+t.h/2;
    assert(Math.abs(cy-1028)<60 && cx<226 && cx>150, 'centro fora do lugar: '+cx+','+cy);
  });

  caso('fill:none + stroke vira contorno (pílula do CTA e texto vazado), nunca preto', async()=>{
    const {layers}=await importar(SVG(ESTILO+`<rect x="692" y="1084" width="288" height="96" rx="48" fill="none" stroke="#FFFFFF" stroke-width="4"/><text x="100" y="985" class="hero" font-size="380" fill="none" stroke="#FFFFFF" stroke-width="7">GRÁTIS</text>`));
    const r=layers.find(l=>l.type==='shape'), t=layers.find(l=>l.type==='text');
    assert(r.fill==='transparent' && r.strokeW===4 && r.strokeColor==='#FFFFFF' && r.strokeAlign==='center', 'pílula: '+JSON.stringify(r));
    assert(t.color==='transparent' && t.strokeW===7 && t.strokeColor==='#FFFFFF', 'vazado: '+t.color+' '+t.strokeW);
  });

  caso('caminho vira vetor editável (vectorPath válido); caminho com arco vira imagem', async()=>{
    const {layers}=await importar(SVG(`<path d="M 30 0 L 650 0 C 665 0 680 15 680 30 L 680 250 L 0 250 Z" fill="#FF9000"/><path d="M 100 600 A 50 50 0 0 1 200 600 Z" fill="#F85400"/>`));
    const v=layers.find(l=>l.type==='shape'), im=layers.find(l=>l.type==='image');
    assert(v && v.shapeKind==='path' && gVectorPathValid(v.vectorPath) && v.fill==='#FF9000', 'vetor inválido');
    assert(v.x===0 && v.y===0 && v.w===680 && v.h===250, 'caixa do vetor '+[v.x,v.y,v.w,v.h]);
    assert(im && /^data:image\/png/.test(im.imgUrl), 'arco não virou imagem');
  });

  caso('grupo com clip-path vira UMA imagem; o texto de dentro continua texto', async()=>{
    const {layers}=await importar(SVG(ESTILO+`<clipPath id="c"><rect x="100" y="100" width="300" height="200" rx="40"/></clipPath><g clip-path="url(#c)"><rect x="0" y="0" width="600" height="600" fill="#FFFFFF"/><rect x="0" y="0" width="180" height="600" fill="#F62900"/><text x="200" y="220" class="body" font-size="40" fill="#434343">CÓDIGO</text></g>`));
    const im=layers.filter(l=>l.type==='image'), t=layers.filter(l=>l.type==='text');
    assert(im.length===1 && /^data:image\/png/.test(im[0].imgUrl), 'esperava 1 imagem');
    assert(Math.abs(im[0].x-100)<=1 && Math.abs(im[0].w-300)<=2 && Math.abs(im[0].h-200)<=2, 'recorte não aplicado: '+[im[0].x,im[0].y,im[0].w,im[0].h]);
    assert(t.length===1 && t[0].content==='CÓDIGO', 'texto do grupo sumiu');
  });

  caso('<line> vira traço vetorial; text-decoration line-through vira strikethrough', async()=>{
    const {layers}=await importar(SVG(ESTILO+`<line x1="322" y1="1072" x2="890" y2="1072" stroke="#FFB900" stroke-width="3"/><text x="148" y="934" class="body" font-size="40" fill="#434343" text-decoration="line-through" data-campo="precoDe">DE R$ 28,00</text>`));
    const l=layers.find(x=>x.type==='shape'), t=layers.find(x=>x.type==='text');
    assert(l && l.vectorPath && l.strokeColor==='#FFB900' && l.strokeW===3 && l.w===568, 'linha: '+JSON.stringify(l&&{w:l.w,s:l.strokeW}));
    assert(t.strikethrough===true && t.content==='{{precoDe}}', 'risco do preço: '+t.strikethrough+' '+t.content);
  });

  caso('feDropShadow vira a sombra do Luma (90° = para baixo)', async()=>{
    const {layers}=await importar(SVG(`<defs><filter id="sh"><feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#434343" flood-opacity="0.25"/></filter></defs><rect x="100" y="870" width="470" height="310" rx="36" fill="#FFFFFF" filter="url(#sh)"/>`));
    const r=layers[0];
    assert(r.shadow===true && r.shadowDist===12 && r.shadowAngle===90 && r.shadowBlur===32, 'sombra '+JSON.stringify({d:r.shadowDist,a:r.shadowAngle,b:r.shadowBlur}));
    assert(/rgba\(67, ?67, ?67, ?0?\.25\)/.test(r.shadowColor), 'cor da sombra '+r.shadowColor);
  });

  caso('texto de estilo único: a linha de base do Luma cai na do SVG (vAlign top + subida da tinta)', async()=>{
    const {layers}=await importar(SVG(ESTILO+`<text x="100" y="300" class="hero" font-size="151" fill="#FFFFFF">PIZZA</text>`));
    const t=layers[0];
    assert(t.vAlign==='top', 'vAlign '+t.vAlign);
    const c=document.createElement('canvas').getContext('2d'); const fp=dTextFontParts(t.font);
    c.font=`${fp.weight} ${t.fontSize}px ${fp.family}`;
    const base=t.y+c.measureText('PIZZA').actualBoundingBoxAscent;
    assert(Math.abs(base-300)<=1.5, 'linha de base em '+base.toFixed(1)+' (esperado 300)');
    assert(Math.abs(t.x-(100-151*0.08))<=1.5, 'x com o respiro de 0,08em: '+t.x);
  });

  caso('SEM contrato (SVG do Illustrator): comportamento antigo preservado, "DE R$" é precoDe', async()=>{
    const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const {layers}=await importar(SVG(`<text x="100" y="300" font-size="80" fill="#000000">PIZZA GRANDE</text><text x="100" y="500" font-size="40" fill="#000000">DE R$ 28,00</text><image href="${png}" id="foto" x="0" y="600" width="400" height="400"/>`, ''));
    const p=layers.find(l=>/PIZZA|\{\{/.test(l.content||'')&&l.fontSize===80), d=layers.find(l=>l.fontSize===40), f=layers.find(l=>l.type==='frame');
    assert(p && p.isVar, 'caixa alta deixou de ser campo no modo antigo');
    assert(d && d.content==='{{precoDe}}', 'DE R$ virou '+(d&&d.content));
    assert(f && f.imgVar==='foto_produto', 'imagem do Illustrator deixou de ser moldura');
  });

  caso('modal de revisão monta com os tipos novos (moldura e imagem)', async()=>{
    const {els}=await importar(SVG(`<g id="foto_produto"><rect x="0" y="0" width="400" height="300" rx="56" fill="#D9D9D9"/></g><path d="M 0 0 A 10 10 0 0 1 20 0 Z" fill="#F85400"/>`));
    const html=dSvgBuildReviewHTML(els,{w:1080,h:1350,fmt:'feed',fileName:'caso.svg'});
    assert(/Moldura \(foto\)/.test(html) && /Imagem fixa/.test(html), 'opções novas ausentes no modal');
    assert(!/>\?</.test(html), 'tipo sem ícone no modal');
  });

  caso('editor (DOM) desenha o itálico do trecho — mesmo motor de texto rico', async()=>{
    const html=gRichTextHtml([{text:'o presente é ',font:"'Roboto',300",fontSize:66,color:'#FFFFFF',italic:true},{text:'seu!',font:"'Roboto',900",fontSize:66,color:'#FFFFFF'}],66);
    const spans=html.split('</span>');
    assert(/font-style:italic/.test(spans[0]) && !/font-style:italic/.test(spans[1]), 'itálico por trecho: '+html);
  });

  caso('Illustrator: posição no <tspan> e preenchimento com gradiente (vira imagem, não some)', async()=>{
    const {layers}=await importar(SVG(`<defs><linearGradient id="g"><stop offset="0" stop-color="#F85400"/><stop offset="1" stop-color="#FF9000"/></linearGradient></defs><rect x="0" y="0" width="1080" height="400" fill="url(#g)"/><text transform="matrix(1 0 0 1 100 600)" font-family="Roboto" font-size="60" fill="#FFFFFF"><tspan x="0" y="0">Sabor de casa</tspan></text>`, ''));
    const im=layers.find(l=>l.type==='image'), t=layers.find(l=>l.type==='text');
    assert(im && im.w===1080 && im.h===400, 'gradiente não virou imagem: '+JSON.stringify(im&&[im.x,im.y,im.w,im.h]));
    const c=document.createElement('canvas').getContext('2d'); const fp=dTextFontParts(t.font); c.font=`${fp.weight} ${t.fontSize}px ${fp.family}`;
    const base=t.y+c.measureText('Sabor de casa').actualBoundingBoxAscent;
    assert(Math.abs(base-600)<=1.5, 'linha de base em '+base.toFixed(1)+' (esperado 600)');
  });

  caso('arquivo de fora: script e on* não executam ao montar', async()=>{
    window.__svgExec=0;
    await importar(SVG(`<script>window.__svgExec=1</script><rect x="0" y="0" width="10" height="10" fill="#FFFFFF" onload="window.__svgExec=2"/><image href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" onload="window.__svgExec=3" x="0" y="0" width="1" height="1"/>`));
    await new Promise(r=>setTimeout(r,200));
    assert(window.__svgExec===0, 'código do arquivo executou: '+window.__svgExec);
  });

  /* ── Luma Creative (js/creative/creative.js): o motor de diagramações. Toda opção APROVADA pela
     conferência geométrica tem de ser arte limpa (paleta, nada estourado) e entrar no importador
     com os campos certos — e a conferência tem de reprovar o que a skill reprova. ── */
  const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const CR_CASOS={
    oferta:{titulo:'Pizza calabresa',apoio:'Tradicional, direto pelo app',precoDe:'28,00',precoPor:'22,90',selo:['18%','OFF']},
    cupom:{cupomValor:'15',cupomCodigo:'QUEROPIZZA',legal:'Válido para pedidos acima de R$ 40.'},
    evento:{titulo:'Festival gastronômico',apoio:'Os pratos do festival no app',selo:['10 A 20','OUTUBRO']},
    beneficio:{palavra:'entrega',titulo:'grátis',apoio:'em pedidos acima de R$ 40',selo:['SÓ','HOJE']},
    aniversario:{anos:'3',cupomValor:'15',cupomCodigo:'NIVERDM15'}
  };
  const campoNa=(L,c)=>L.some(l=>l.type==='text' && l.isVar && String(l.content).indexOf('{{'+c)>=0);

  caso('Luma Creative: toda diagramação aprovada (objetivos × feed/story × com/sem foto) é arte limpa e entra no importador', async()=>{
    await crFontesProntas();
    let aprovadas=0;
    for(const obj of Object.keys(CR_CASOS)) for(const formato of ['feed','story']) for(const foto of ['',PNG]){
      const cands=crCandidatos(Object.assign({objetivo:obj, formato, foto}, CR_CASOS[obj]));
      const tres=crEscolher3(cands);
      assert(tres.length>=1, obj+'/'+formato+(foto?'/foto':'')+': nenhuma diagramação aprovada — '+cands.map(c=>c.receita+': '+c.avaliacao.erros.join('; ')).join(' | '));
      if(obj==='oferta') assert(tres.length===3, 'oferta/'+formato+(foto?'/foto':'')+': esperava 3 opções, veio '+tres.length);
      assert(new Set(tres.map(r=>r.receita+r.fundo)).size===tres.length, 'opções repetidas');
      for(const r of tres){
        const rot=obj+'/'+formato+(foto?'/foto':'')+'/'+r.receita;
        assert(!r.estouros.length, rot+': texto estourou '+r.estouros.join(', '));
        assert(crConfere(r).every(c=>c.ok), rot+': conferência da marca falhou');
        assert(!/Use aqui sua foto/.test(r.svg), rot+': placeholder cinza na arte final');
        const {layers}=await importar(await crEmbutir(r.svg));
        r.campos.filter(c=>c!=='foto_produto').forEach(c=>assert(campoNa(layers,c), rot+': campo {{'+c+'}} não chegou ao Estúdio'));
        assert(layers.filter(l=>l.type==='frame' && l.imgVar==='foto_produto').length===(r.campos.indexOf('foto_produto')>=0?1:0), rot+': moldura da foto');
        const fora=layers.filter(l=>l.type==='text' && !l.rotation && (l.x<0 || l.x+l.w>CR_W || l.y<0 || l.y+l.h>r.h));
        assert(!fora.length, rot+': texto fora da arte: '+fora.map(l=>l.content).join(' · '));
        aprovadas++;
      }
    }
    assert(aprovadas>=40, 'poucas opções aprovadas: '+aprovadas);
  });

  caso('Luma Creative: formatos de canal (inapp, banner, email, capa, slide) — toda opção aprovada é arte limpa, do tamanho do formato, e entra no importador', async()=>{
    await crFontesProntas();
    for(const formato of ['inapp','banner','emailTopo','emailRodape','capa','slide','carrossel']) for(const obj of Object.keys(CR_CASOS)) for(const foto of ['',PNG]){
      const f=CR_FORMATOS[formato], rot0=formato+'/'+obj+(foto?'/foto':'');
      const cands=crCandidatos(Object.assign({objetivo:obj, formato, foto}, CR_CASOS[obj])), tres=crEscolher3(cands);
      assert(tres.length>=(f.fixo||f.laminas?1:2), rot0+': '+tres.length+' opção(ões) — '+cands.map(c=>c.receita+': '+c.avaliacao.erros.join('; ')).join(' | '));
      for(const r of tres){
        const rot=rot0+'/'+r.receita;
        assert(r.w===(f.w||1080) && r.h===f.h && r.svg.indexOf('viewBox="0 0 '+r.w+' '+r.h+'"')>0, rot+': tamanho '+r.w+'×'+r.h);
        assert(!r.estouros.length && crConfere(r).every(c=>c.ok), rot+': conferência da marca falhou');
        if(formato==='inapp') assert(/rx="62"/.test(r.svg), rot+': sem o botão largo do inapp');
        const {layers, tela}=await importar(await crEmbutir(r.svg));
        r.campos.filter(c=>c!=='foto_produto').forEach(c=>assert(campoNa(layers,c), rot+': campo {{'+c+'}} não chegou ao Estúdio'));
        // o Estúdio encaixa a arte na tela do formato dele (escala + centro): o texto tem de caber nela
        const fora=layers.filter(l=>l.type==='text' && !l.rotation && (l.x<-1 || l.x+l.w>tela.w+1 || l.y<-1 || l.y+l.h>tela.h+1));
        assert(!fora.length, rot+': texto fora da arte: '+fora.map(l=>l.content+' @'+[l.x,l.y,l.w,l.h].map(Math.round)).join(' · '));
      }
    }
    const ditos={'Banner do app da promo turbinada':'banner','pop-up inapp do much+':'inapp','cabeçalho de email do burger fest':'emailTopo',
      'rodapé do email':'emailRodape','capa da pasta do Deskfy':'capa','slide de apresentação':'slide','story do festival':'story','carrossel do festival':'carrossel'};
    Object.entries(ditos).forEach(([t,f])=>assert(_crFormatoDito(t)===f, '"'+t+'" → '+_crFormatoDito(t)+' (esperado '+f+')'));
  });

  caso('Luma Creative: a IA designer posiciona caixas e o Luma desenha — composição boa passa e entra no importador; bloco faltando, margem e grafismo atrás do texto reprovam', async()=>{
    await crFontesProntas();
    const sp=crNormaliza(Object.assign({objetivo:'cupom', formato:'story'}, CR_CASOS.cupom));
    const bom={ideia:'Valor gigante à esquerda, ticket embaixo', fundo:'#F85400',
      blocos:[{bloco:'logo',x:100,y:290,w:260,h:52},{bloco:'chamada',x:100,y:430,w:880,h:190},{bloco:'valor',x:100,y:760,w:880,h:330},
        {bloco:'cupom',x:100,y:1220,w:880,h:324},{bloco:'legal',x:100,y:1630,w:880,h:30}], grafismos:[{asset:'explosao',x:820,y:-60,w:420,rot:10}]};
    const r=crDesenhar(sp, bom, 0), av=crAvaliar(r);
    assert(!av.erros.length, 'composição boa reprovou: '+av.erros.join('; '));
    assert(r.nomeReceita===bom.ideia && /asset:inv\/explosao\.png/.test(r.svg), 'ideia ou grafismo não entrou');
    assert(crConfere(r).every(c=>c.ok), 'conferência da marca falhou');
    const {layers}=await importar(await crEmbutir(r.svg));
    ['desconto_valor','codigo_cupom'].forEach(c=>assert(campoNa(layers,c), 'campo {{'+c+'}} não chegou ao Estúdio'));
    const falta=crAvaliar(crDesenhar(sp, {blocos:bom.blocos.filter(b=>b.bloco!=='cupom')}, 0)).erros;
    assert(falta.some(e=>/Faltou o bloco cupom/.test(e)), 'bloco faltando passou: '+falta.join('; '));
    const margem=crAvaliar(crDesenhar(sp, {blocos:bom.blocos.map(b=>b.bloco==='valor'?Object.assign({},b,{x:20}):b)}, 0)).erros;
    assert(margem.some(e=>/margem/.test(e)), 'fora da margem passou');
    const atras=crAvaliar(crDesenhar(sp, Object.assign({}, bom, {grafismos:[{asset:'sorriso-arco',x:200,y:700,w:600}]}), 0)).erros;
    assert(atras.some(e=>/Grafismo atrás/.test(e)), 'grafismo atrás do texto passou');
    const pr=crPromptDesenho(sp, 2, ['ideia velha']);
    assert(/explosao/.test(pr) && /100–140/.test(pr) && /ideia velha/.test(pr) && /"composicoes"/.test(pr), 'prompt sem inventário, respiro ou ideias a evitar');
  });

  caso('Luma Creative: contrato SVG da IA (D13) — arte da skill passa e entra no importador; o que executa, sai do inventário ou da paleta é barrado', async()=>{
    await crFontesProntas();
    const sp=crNormaliza({objetivo:'oferta', formato:'banner', titulo:'Mercado', apoio:'no app'});
    const bom='<svg xmlns="http://www.w3.org/2000/svg"><rect x="23" y="9" width="730" height="175" rx="30" fill="#F85400"/>'
      +'<g data-bloco="titulo"><text x="60" y="118" class="hero" font-size="96" fill="#F85400" stroke="#FFFFFF" stroke-width="21" stroke-linejoin="round" paint-order="stroke fill" data-campo="produto">MERCADO</text></g>'
      +'<g data-bloco="apoio" transform="rotate(-4 90 160)"><rect x="90" y="134" width="150" height="44" fill="#FFFFFF"/><text x="104" y="169" class="hero" font-size="42" fill="#F85400" data-campo="apoio">NO APP</text></g></svg>';
    const c=crSvgContrato(bom, sp);
    assert(!c.erros.length, 'arte da skill reprovou no contrato: '+c.erros.join('; '));
    const av=crAvaliar({svg:c.svg, spec:sp, receita:'ia-svg', fundo:'#F85400', w:764, h:204, estouros:[], campos:['produto','apoio']});
    assert(!av.erros.length, 'arte da skill reprovou na marca: '+av.erros.join('; '));
    const {layers}=await importar(await crEmbutir(c.svg));
    ['produto','apoio'].forEach(k=>assert(campoNa(layers,k), 'campo {{'+k+'}} não chegou ao Estúdio'));
    const mau=crSvgContrato('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><script>alert(1)</script><foreignObject><div>x</div></foreignObject>'
      +'<g data-bloco="titulo" onload="alert(2)"><text class="hero" style="fill:red" fill="#00FF00" data-campo="produto">OI</text></g>'
      +'<image href="https://x.com/a.png"/><image xlink:href="javascript:alert(3)"/><image href="asset:../x.png"/>'
      +'<g filter="url(http://x#f)" transform="matrix(1,0,0,1,0,0)"><text>solto</text></g></svg>', sp);
    ['<script>','<foreignObject>','#00FF00','https://x.com','javascript:','asset:../x.png','url(http://x#f)','matrix','Texto fora de bloco'].forEach(k=>
      assert(mau.erros.some(e=>e.indexOf(k)>=0), 'não barrou: '+k+' — '+mau.erros.join('; ')));
    assert(!/<script|onload|foreignObject|https?:\/\/(?!www\.w3\.org)|javascript:|style=|\.\.\/|matrix/i.test(mau.svg), 'sobrou algo perigoso no SVG saneado');
    const semCampo=crSvgContrato('<svg xmlns="http://www.w3.org/2000/svg"><g data-bloco="titulo"><text class="hero" fill="#FFFFFF">OI</text></g></svg>', sp).erros;
    assert(semCampo.some(e=>/data-campo/.test(e)), 'título sem campo editável passou');
    assert(crSvgContrato('<svg', sp).erros.length && crSvgContrato('x'.repeat(90000), sp).erros.length, 'SVG quebrado ou gigante passou');
  });

  caso('Luma Creative: a IA escreve o SVG do banner (D13 · E13.3) — prompt com skill e conteúdo, reprovada volta 1 vez com os erros, foto na caixa', async()=>{
    await crFontesProntas();
    const A='<svg xmlns="http://www.w3.org/2000/svg"><rect x="23" y="9" width="730" height="175" rx="30" fill="#F85400"/>'
      +'<g data-bloco="titulo"><text x="60" y="108" class="hero" font-size="92" fill="#F85400" stroke="#FFFFFF" stroke-width="20" stroke-linejoin="round" paint-order="stroke fill" data-campo="produto">COMBOS</text></g>'
      +'<g data-bloco="apoio" transform="rotate(-4 84 160)"><rect x="84" y="138" width="262" height="42" fill="#FFFFFF"/><text x="98" y="172" class="hero" font-size="38" fill="#F85400">COM DESCONTO</text></g>'
      +'<g data-bloco="foto" id="foto_produto"><rect x="470" y="0" width="270" height="204" rx="0"/></g>'
      +'<g data-bloco="selo"><circle cx="470" cy="150" r="44" fill="#FFB900"/><text x="470" y="160" class="hero" font-size="28" fill="#F85400" text-anchor="middle">29,90</text></g></svg>';
    const mau=A.replace('#FFB900','#22CC22');
    const g={ask:window.gAskAI, ready:window.gAiReady, parse:window.gAiParseJson}, prompts=[];
    window.gAiReady=()=>true;
    if(typeof window.gAiParseJson!=='function') window.gAiParseJson=t=>{ try{ return JSON.parse(t); }catch(e){ return null; } };
    window.gAskAI=async(t,prompt,o)=>{ prompts.push(prompt); return JSON.stringify(prompts.length===1?{artes:[{ideia:'boa',svg:A},{ideia:'ruim',svg:mau}]}:{artes:[{ideia:'corrigida',svg:A}]}); };
    try{
      const sp=crNormaliza({objetivo:'oferta', formato:'banner', titulo:'Combos', apoio:'com desconto', precoPor:'29,90', foto:'slot'});
      const rs=await crArtesSvg(sp, 2, [], null);
      assert(prompts.length===2, 'esperava 1 pedido + 1 correção, foram '+prompts.length);
      assert(/=== SKILL ===/.test(prompts[0]) && /Adesivo/.test(prompts[0]) && /data-campo="produto"/.test(prompts[0]) && /29,90/.test(prompts[0]), 'prompt sem skill, campo ou preço');
      assert(/ERROS: .*Cor fora da paleta: #22CC22/.test(prompts[1]), 'a correção não levou o erro do contrato');
      assert(rs.length===2 && rs.every(r=>!r.avaliacao.erros.length && r.nota>0), 'as duas artes deviam sair aprovadas');
      assert(rs.every(r=>/id="foto_produto"/.test(r.svg) && r.campos.indexOf('produto')>=0), 'foto ou campo editável sumiu');
      assert(crPromptSvg(sp, 2, 'x', ['ideia velha']).indexOf('ideia velha')>0, 'prompt sem as ideias a evitar');
    }finally{ window.gAskAI=g.ask; window.gAiReady=g.ready; window.gAiParseJson=g.parse; }
  });

  caso('Luma Creative: peça much+ sai na paleta das referências (rosa + amarelo, logo much+) e sem os grafismos da DM', async()=>{
    await crFontesProntas();
    assert(crLerPedido('cupom do much+ de R$ 10').marca==='much' && crLerPedido('cupom de R$ 10').marca==='dm', 'marca não lida do pedido');
    const b=Object.assign({objetivo:'cupom', formato:'story', marca:'much'}, CR_CASOS.cupom), tres=crEscolher3(crCandidatos(b));
    assert(tres.length>=1, 'nenhuma opção much+');
    tres.forEach(r=>{
      assert(/#E52676/.test(r.svg) && !/#F85400|#FF9000/i.test(r.svg), r.receita+': ainda tem laranja DM');
      assert(/much-plus-branco/.test(r.svg) && !/dm-h-branca/.test(r.svg) && !/pattern-ancorado/.test(r.svg), r.receita+': logo ou pattern da DM');
      assert(crConfere(r).every(c=>c.ok), r.receita+': conferência da marca reprovou o rosa');
    });
    const d=crDesenhar(crNormaliza(b), {blocos:[{bloco:'valor',x:100,y:700,w:880,h:330}], grafismos:[{asset:'sorriso-arco',x:0,y:0,w:300},{asset:'mais-amarelo',x:800,y:100,w:300}]}, 0);
    assert(!/inv\/sorriso-arco/.test(d.svg) && /inv\/mais-amarelo/.test(d.svg), 'inventário não filtrou pela marca');
  });

  caso('Luma Creative: "deixar o espaço da foto" (slot) põe o placeholder cinza nas composições de foto e vira moldura no Estúdio', async()=>{
    await crFontesProntas();
    const tres=crEscolher3(crCandidatos(Object.assign({objetivo:'oferta', formato:'story', foto:'slot'}, CR_CASOS.oferta)));
    assert(tres.length===3, 'esperava 3 opções com o espaço da foto, veio '+tres.length);
    for(const r of tres){
      assert(/id="foto_produto"/.test(r.svg) && /Use aqui sua foto/.test(r.svg) && !/clip-path="url\(#crfoto\)"/.test(r.svg), r.receita+': sem o placeholder (ou com foto fantasma)');
      const {layers}=await importar(await crEmbutir(r.svg));
      assert(layers.filter(l=>l.type==='frame' && l.imgVar==='foto_produto').length===1, r.receita+': o espaço não virou moldura');
    }
    const q=crPerguntasFinais({objetivo:'oferta', perguntas:[]}, {pedido:'Story: pizza por R$ 22,90', fmt:'story', foto:null}).find(x=>x.tipo==='foto');
    assert(q && q.opcoes[0].valor==='slot', 'a 1ª opção da pergunta da foto não é deixar o espaço');
  });

  caso('Luma Creative: sem foto, nenhuma diagramação usa o slot; com foto, a foto vira a moldura no Estúdio', async()=>{
    await crFontesProntas();
    crEscolher3(crCandidatos(Object.assign({objetivo:'oferta'}, CR_CASOS.oferta))).forEach(r=>assert(r.svg.indexOf('foto_produto')<0, r.receita+' usou slot sem foto'));
    const r=crCompor({objetivo:'evento', titulo:'Festival', foto:PNG});
    assert(/clip-path="url\(#crfoto\)"/.test(r.svg), 'foto não entrou no slot');
    const {layers}=await importar(await crEmbutir(r.svg));
    const f=layers.filter(l=>l.type==='frame' && l.imgVar==='foto_produto');
    assert(f.length===1 && f[0].imgUrl===PNG, 'moldura sem a foto');
    assert(!layers.some(l=>l.type==='image' && l.imgUrl===PNG), 'a foto entrou também como imagem solta');
  });

  caso('Luma Creative: a conferência reprova colisão, margem e texto pequeno; o vão herói→apoio de 40 px passa', async()=>{
    await crFontesProntas();
    const r=crCompor(Object.assign({objetivo:'oferta'}, CR_CASOS.oferta));
    assert(!crAvaliar(r).erros.length, 'a melhor opção não passou: '+crAvaliar(r).erros.join('; '));
    const colide=Object.assign({}, r, {svg:r.svg.replace('<g data-bloco="apoio">','<g data-bloco="apoio" transform="translate(0,-60)">')});
    assert(crAvaliar(colide).erros.some(e=>/Colisão/.test(e)), 'colisão passou');
    const margem=Object.assign({}, r, {svg:r.svg.replace('<g data-bloco="logo">','<g data-bloco="logo" transform="translate(-60,0)">')});
    assert(crAvaliar(margem).erros.some(e=>/margem/.test(e)), 'margem passou');
    const mini=Object.assign({}, r, {svg:r.svg.replace('</svg>','<g data-bloco="nota"><text x="300" y="700" font-size="14">x</text></g></svg>')});
    assert(crAvaliar(mini).erros.some(e=>/22 px/.test(e)), 'texto de 14 px passou');
  });

  caso('Luma Creative: herói de 2 linhas vira UM campo de várias linhas (nunca a 2ª linha fixa)', async()=>{
    await crFontesProntas();
    const sp=crNormaliza({objetivo:'oferta', titulo:'Combo burger artesanal duplo', precoPor:'39,90', foto:PNG});
    const r=crMontar(sp, CR_RECEITAS.find(x=>x.id==='cardPreso'), '#F85400');
    const {layers}=await importar(await crEmbutir(r.svg));
    const p=layers.filter(l=>l.type==='text' && String(l.content).indexOf('{{produto}}')>=0);
    assert(p.length===1, 'esperava 1 campo produto, veio '+p.length);
    assert(/\n/.test(p[0].layoutRefText||''), 'campo sem as 2 linhas de exemplo: '+JSON.stringify(p[0].layoutRefText));
    assert(!layers.some(l=>l.type==='text' && !l.isVar && /ARTESANAL/.test(l.content)), 'a 2ª linha virou texto fixo');
  });

  caso('Luma Creative: leitura local do pedido não inventa preço; com preço, de/por saem na ordem', async()=>{
    const sem=crNormaliza(crLerPedido('Arte da pizza margherita para o feed'));
    assert(sem.objetivo==='oferta' && !sem.precoPor && !sem.precoDe, 'inventou preço: '+JSON.stringify([sem.precoDe,sem.precoPor]));
    assert(crCompor(sem).svg.indexOf('data-campo="precoPor"')<0, 'preço sem preço');
    const com=crNormaliza(crLerPedido('Oferta de pizza calabresa: de R$ 28 por R$ 22,9, 18% off'));
    assert(com.precoDe==='28,00' && com.precoPor==='22,90', 'de/por: '+com.precoDe+' / '+com.precoPor);
    assert(com.selo.join(' ')==='18% OFF', 'selo: '+com.selo.join(' '));
    const cup=crNormaliza(crLerPedido('Cupom QUEROPIZZA de R$ 15 para pedidos acima de R$ 40'));
    assert(cup.objetivo==='cupom' && cup.cupomCodigo==='QUEROPIZZA' && cup.cupomValor==='15', 'cupom: '+JSON.stringify(cup));
    assert(/acima de R\$ 40/.test(cup.legal), 'pedido mínimo fora da letra miúda');
  });

  caso('Luma Creative: o pedido é lido com intenção — a fala vira manchete, não título (motor local)', async()=>{
    // [pedido como o franqueado escreve, objetivo, título, outras expectativas]
    const tabela=[
      ['vai ter um evento gastronomico na minha cidade e preciso de um post pra avisar','evento','EVENTO GASTRONÔMICO',{topo:'VEM AÍ',selo:'',cta:''}],
      ['faz um post de pizza calabresa por 39,90','oferta','PIZZA CALABRESA',{precoPor:'39,90'}],
      ['quero avisar que amanhã não vamos abrir por causa do feriado','aviso','AMANHÃ NÃO VAMOS ABRIR',{apoio:'Por causa do feriado',cta:''}],
      ['preciso de uma arte pra chamar entregador','prospeccao','SEJA ENTREGADOR',{cta:'CADASTRAR'}],
      ['a pizzaria do joão entrou no app, faz um post','parceiro','PIZZARIA DO JOÃO',{loja:'Pizzaria do João',topo:'NOVO PARCEIRO'}],
      ['post pro dia das mães','evento','DIA DAS MÃES',{selo:'',cta:''}],
      ['festival de hambúrguer de 10 a 20 de novembro','evento','FESTIVAL DE HAMBÚRGUER',{selo:'10 A 20 NOVEMBRO'}],
      ['cria um story com cupom BEMVINDO de 15 reais pra primeira compra','cupom','',{cupomCodigo:'BEMVINDO',cupomValor:'15'}],
      ['tá chovendo e as entregas podem atrasar, avisa a galera','aviso','TÁ CHOVENDO',{apoio:'As entregas podem atrasar'}],
      ['faz uma arte de happy hour com chopp em dobro das 18h às 20h','oferta','HAPPY HOUR',{horario:'18H ÀS 20H',apoio:'Com chopp em dobro'}],
      ['quero um post avisando nosso horário especial no feriado: das 11h às 15h','aviso','HORÁRIO ESPECIAL NO FERIADO',{horario:'11H ÀS 15H'}],
      ['arte pra divulgar o show do zé na praça dia 20 de dezembro','evento','SHOW DO ZÉ',{selo:'20 DEZEMBRO',apoio:'Na praça'}],
      ['promoção de açaí 2 por 1 só hoje','oferta','AÇAÍ 2 POR 1',{topo:'SÓ HOJE'}],
      ['preciso de um post pra chamar restaurantes pra vender no app','prospeccao','SEJA PARCEIRO',{cta:'QUERO VENDER'}],
      ['vamos ter feira de artesanato na praça no sábado, me ajuda com uma arte','evento','FEIRA DE ARTESANATO',{topo:'VEM AÍ'}],
      // o que já se lia bem continua igual
      ['Novo parceiro: Pizzaria Nonna chegou no app','parceiro','PIZZARIA NONNA',{}],
      ['Peça no app: tudo que a cidade tem','prospeccao','PEÇA NO APP',{}],
      ['Happy hour: chopp 2x1 das 17h às 20h','oferta','HAPPY HOUR',{}]
    ];
    const ruins=[];
    tabela.forEach(([pd,obj,tit,mais])=>{
      const sp=crNormaliza(crLerPedido(pd,'feed')), v=k=>Array.isArray(sp[k])?sp[k].join(' '):String(sp[k]==null?'':sp[k]);
      const erros=[];
      if(sp.objetivo!==obj) erros.push('objetivo '+sp.objetivo);
      if(tit && sp.titulo!==tit) erros.push('título '+sp.titulo);
      Object.keys(mais).forEach(k=>{ if(v(k)!==mais[k]) erros.push(k+' '+JSON.stringify(v(k))); });
      // nenhuma palavra da fala no título
      if(/\b(PRECISO|QUERO|POST|ARTE|FAZ|VAI TER|MINHA)\b/.test(sp.titulo)) erros.push('fala no título');
      if(erros.length) ruins.push(pd+' → '+erros.join(', '));
    });
    assert(!ruins.length, ruins.length+' leitura(s) erradas:\n'+ruins.join('\n'));
  });

  caso('Luma Creative: trava de dado — o que a pessoa não disse não vai na arte (IA ou motor)', async()=>{
    // a IA devolveu o exemplo do prompt como selo, um preço e um "só hoje" que ninguém disse
    const ia={objetivo:'evento',titulo:'EVENTO GASTRONÔMICO',apoio:'Dia 10 na praça',selo:['10 A 20','OUTUBRO'],topo:'SÓ HOJE',precoPor:'39,90',cupomCodigo:'FESTA10',cta:'VER NO APP'};
    const r=crSoDado(ia,'vai ter um evento gastronomico na minha cidade e preciso de um post pra avisar');
    assert(!r.sp.selo.length && !r.sp.precoPor && !r.sp.cupomCodigo && !r.sp.topo && !r.sp.apoio, 'passou dado inventado: '+JSON.stringify(r.sp));
    assert(r.sp.titulo==='EVENTO GASTRONÔMICO' && r.sp.cta==='VER NO APP', 'tirou o que não era dado: '+JSON.stringify(r.sp));
    assert(['selo','precoPor','cupomCodigo','topo','apoio'].every(k=>r.tirou.indexOf(k)>=0), 'não contou o que tirou: '+r.tirou.join(','));
    // o que a pessoa disse (no pedido ou no briefing) fica — e % calculado de DE/POR é conta, não invenção
    const ok=crSoDado({objetivo:'oferta',titulo:'PIZZA',precoDe:'28,00',precoPor:'22,90',selo:['18%','OFF'],topo:'SÓ HOJE',horario:'18H ÀS 20H'},'pizza de 28 por 22,9 só hoje das 18h às 20h');
    assert(!ok.tirou.length, 'tirou dado que a pessoa deu: '+ok.tirou.join(','));
    const br=crSoDado({objetivo:'evento',titulo:'FEIRA',selo:['10 A 20','OUTUBRO']},'feira na praça Quando é o evento? 10 a 20 de outubro');
    assert(br.sp.selo.join(' ')==='10 A 20 OUTUBRO', 'a data dada no briefing saiu');
    // a fala como título é reconhecida (e a leitura local entra no lugar)
    assert(_crPareceFala('VAI TER UM EVENTO GASTRONOMICO','vai ter um evento gastronomico na minha cidade') && !_crPareceFala('EVENTO GASTRONÔMICO','vai ter um evento gastronomico'), 'fala x manchete');
  });

  caso('Luma Creative: a conferência da marca acusa cor fora da paleta (não é carimbo)', async()=>{
    await crFontesProntas();
    const r=crCompor({objetivo:'cupom'});
    r.svg=r.svg.replace('</svg>','<rect width="10" height="10" fill="#00FF00"/></svg>');
    const c=crConfere(r);
    assert(!c[0].ok && /#00FF00/.test(c[0].t), 'cor estranha passou: '+c[0].t);
  });

  caso('Luma Creative: bloco movido no editor chega ao Estúdio na posição nova (o importador lê o transform)', async()=>{
    await crFontesProntas();
    const r=crCompor({objetivo:'oferta', titulo:'Pizza calabresa', precoPor:'22,90'});
    const antes=(await importar(await crEmbutir(r.svg))).layers.find(l=>String(l.content).indexOf('{{precoPor')>=0);
    const movido=r.svg.replace('<g data-bloco="preco">','<g data-bloco="preco" data-dx="40" data-dy="-100" transform="translate(40,-100)">');
    const depois=(await importar(await crEmbutir(movido))).layers.find(l=>String(l.content).indexOf('{{precoPor')>=0);
    assert(antes && depois, 'campo precoPor sumiu');
    assert(Math.abs(depois.x-antes.x-40)<=1.5 && Math.abs(depois.y-antes.y+100)<=1.5, 'deslocou '+(depois.x-antes.x)+','+(depois.y-antes.y)+' (esperado 40,-100)');
  });

  caso('Luma Creative: o briefing pergunta formato e o que falta, e as respostas entram na arte', async()=>{
    const fio={pedido:'Oferta de pizza calabresa', fmt:'feed', foto:null};
    const t=crPerguntasFinais(crBriefingLocal(fio), fio).map(q=>q.titulo).join(',');
    assert(t==='Formato,Preço,Foto', 'perguntas: '+t);
    const f=crPerguntasFinais(crBriefingLocal(fio), fio)[0];
    assert(f.opcoes.map(o=>o.valor).join(',')===Object.keys(CR_FORMATOS).join(','), 'opções de formato fora do cadastro');
    const dito={pedido:'Story: oferta de pizza de R$ 28 por R$ 22,90', fmt:'feed', foto:PNG};
    assert(!crPerguntasFinais(crBriefingLocal(dito), dito).length, 'perguntou o que o pedido já dizia');
    const sp=crNormaliza(crAplicaRespostas({objetivo:'oferta'}, [{campo:'precoPor', resposta:'de 28 por 22,9'}, {campo:'formato', valor:'story'}]));
    assert(sp.precoDe==='28,00' && sp.precoPor==='22,90' && sp.formato==='story', 'respostas: '+[sp.precoDe, sp.precoPor, sp.formato]);
    const ev=crNormaliza(crAplicaRespostas({objetivo:'evento'}, [{campo:'data', resposta:'10 a 20 de outubro'}]));
    assert(ev.selo.join(' ')==='10 A 20 OUTUBRO', 'selo da data: '+ev.selo.join(' '));
    const cp=crNormaliza(crAplicaRespostas({objetivo:'cupom'}, [{campo:'cupomValor', resposta:'R$ 15'}, {campo:'cupomCodigo', resposta:'quero pizza'}]));
    assert(cp.cupomValor==='15' && cp.cupomCodigo==='QUEROPIZZA', 'cupom: '+cp.cupomValor+' '+cp.cupomCodigo);
  });

  /* ── Nota de design (frente 1): a geometria sem DOM é a régua da busca, e o DOM a confere ── */
  caso('Luma Creative: a geometria sem DOM bate com a medida pelo DOM (≤ 3 px) em todo o banco de casos', async()=>{
    await crFontesProntas();
    let n=0, pior=0, onde='';
    // banco inteiro × curto e extremo × com/sem foto (os formatos de cada pedido): toda opção aprovada
    for(const c of crBancoCasos({textos:[0,3], much:[false]})){
      for(const r of crEscolher3(crCandidatos(c.sp, {avaliacoes:120}))){
        const g=crGeometria(r.svg).blocos, d=_crMede(r.svg);
        assert(g.length===d.length, c.id+'/'+r.receita+': '+g.length+' blocos sem DOM, '+d.length+' no DOM');
        g.forEach((b,i)=>{ const q=d[i], dd=Math.max(Math.abs(b.x-q.x), Math.abs(b.y-q.y), Math.abs(b.x+b.w-q.x-q.w), Math.abs(b.y+b.h-q.y-q.h)); n++;
          if(dd>pior){ pior=dd; onde=c.id+'/'+r.receita+'/'+b.nome; } });
      }
    }
    assert(n>3000, 'poucos blocos medidos: '+n);
    assert(pior<=3, 'divergiu '+pior.toFixed(2)+' px em '+onde);
  });

  caso('Luma Creative: a nota de design é pura e determinística, tem as 6 partes, diz o porquê e erro da marca zera', async()=>{
    await crFontesProntas();
    const r=crCompor(Object.assign({objetivo:'oferta', formato:'feed'}, CR_CASOS.oferta)), geo=crGeometria(r.svg), ctx={formato:'feed', objetivo:'oferta', fundo:r.fundo};
    const a=crNotaDesign(geo, ctx), b=crNotaDesign(crGeometria(r.svg), ctx);
    assert(JSON.stringify(a)===JSON.stringify(b), 'mesma geometria, notas diferentes');
    assert(a.total>=0 && a.total<=100 && a.total===r.nota, 'total '+a.total+' (r.nota '+r.nota+')');
    assert(CR_NOTA_PARTES.every(k=>a.partes[k]>=0 && a.partes[k]<=1), 'parte fora de 0–1: '+JSON.stringify(a.partes));
    assert(typeof a.porque==='string' && a.porque.length>8, 'sem porquê');
    assert(crNotaDesign(geo, Object.assign({erros:1}, ctx)).total===0, 'erro da marca não zerou');
    // a geometria lê o transform do bloco (o editor arrasta assim): nulo não muda; descer o botão abre um buraco e a nota cai
    const mexe=dy=>crNotaDesign(crGeometria(r.svg.replace(/<g data-bloco="(botao|legal)">/g, '<g data-bloco="$1" transform="translate(0,'+dy+')">')), ctx).total;
    assert(mexe(0)===a.total, 'transform nulo mudou a nota');
    const pesos=crNotaPesos('aviso','story'); assert(pesos.contraste>CR_NOTA_PESOS.padrao.contraste && pesos.vazio>CR_NOTA_PESOS.padrao.vazio, 'pesos por objetivo/formato não entraram');
  });

  /* ── Busca de composições (frente 2) ── */
  caso('Luma Creative: a busca é determinística, nunca devolve arte com erro da marca e as 3 finalistas têm famílias e assinaturas diferentes', async()=>{
    await crFontesProntas();
    const b=Object.assign({objetivo:'oferta', formato:'feed', foto:PNG}, CR_CASOS.oferta);
    const x=crEscolher3(crCandidatos(b)), y=crEscolher3(crCandidatos(b));
    assert(x.length===3, 'esperava 3 finalistas, veio '+x.length);
    assert(x.map(r=>r.receita+JSON.stringify(r.params)+r.svg.length).join()===y.map(r=>r.receita+JSON.stringify(r.params)+r.svg.length).join(), 'mesma entrada, busca diferente');
    assert(new Set(x.map(r=>r.receita)).size===3, 'família repetida: '+x.map(r=>r.receita));
    for(let i=0;i<3;i++) for(let j=i+1;j<3;j++) assert(crDistAssinatura(x[i].design.sinais, x[j].design.sinais)>=1, 'assinaturas iguais: '+x[i].design.sinais.txt);
    x.forEach(r=>{ assert(!r.avaliacao.erros.length && !crAvaliarDom(r).erros.length, r.receita+': erro da marca'); assert(r.params, r.receita+': sem os parâmetros da busca'); });
    // "Outras opções": as assinaturas já mostradas ficam de fora quando há alternativa
    const cands=crCandidatos(b, {rodada:1}), outras=crEscolher3(cands, x.map(r=>r.receita).concat(x.map(r=>r.design.sinais.txt)));
    assert(outras.length>=1 && outras.every(r=>x.every(o=>o.design.sinais.txt!==r.design.sinais.txt)), 'Outras opções repetiu assinatura');
  });

  caso('Luma Creative: a busca roda em fatias (a tela não congela), fica no orçamento e acha nota pelo menos tão boa quanto o ponto de fábrica', async()=>{
    await crFontesProntas();
    const b=Object.assign({objetivo:'oferta', formato:'story', foto:PNG}, CR_CASOS.oferta);
    let cedeu=0; setTimeout(()=>{ cedeu=1; }, 0);
    const t0=performance.now(), res=await crBuscar(b), ms=performance.now()-t0;
    assert(cedeu, 'a busca não cedeu a vez ao navegador');
    assert(res.avaliacoes>20 && res.avaliacoes<=CR_BUSCA_ORCAMENTO+20, 'avaliações fora do orçamento: '+res.avaliacoes);
    assert(ms<CR_BUSCA_TETO_MS+200, 'busca demorou '+Math.round(ms)+' ms');
    // o ponto de fábrica (o motor de antes) está entre as avaliadas: a melhor da busca nunca fica abaixo dele
    const fab=res.cands.filter(r=>r.familia==='cardPreso' && r.params.kh===1 && r.params.kf===1 && r.params.kv===1 && r.params.dist==='centro' && r.params.card==='esq' && r.params.selo==='td');
    assert(fab.length===1, 'ponto de fábrica do cardPreso não avaliado');
    assert(crEscolher3(res.cands)[0].nota>=fab[0].nota, 'a busca ficou abaixo do ponto de fábrica');
  });

  /* ── Tipografia de agência (frente 3) ── */
  caso('Luma Creative: tipografia — nada se separa do que cola (R$, artigo, preposição), apoio longo quebra sem órfã, acento ganha entrelinha e a caixa é a tinta', async()=>{
    await crFontesProntas();
    assert(_crPalavras('É JOGO').length===1 && _crPalavras('A DOIS').length===1, 'artigo/verbo curto separado: '+_crPalavras('É JOGO').join('|'));
    assert(_crPalavras('POR R$ 22,90 HOJE').indexOf('POR R$ 22,90')>=0, '"POR R$ 22,90" quebrável: '+_crPalavras('POR R$ 22,90 HOJE').join('|'));
    assert(_crPalavras('AÇAÍ 500 ML 2 POR 1').indexOf('500 ML')>=0 && _crPalavras('AÇAÍ 500 ML 2 POR 1').indexOf('2 POR 1')>=0, 'número e unidade separados');
    for(const t of ['MUDOU O HORÁRIO DO ATENDIMENTO','FESTIVAL GASTRONÔMICO DA CIDADE','SEXTOU COM BURGER E BATATA','PIZZA CALABRESA COM BORDA'])
      for(const iguala of [false,true]){
        const q=crLockup(t, {larg:880, max:160, min:80, linhas:3, iguala});
        q.linhas.slice(0,-1).forEach(l=>assert(!_CR_COLA.test(l.split(' ').pop()), t+': linha termina em "'+l.split(' ').pop()+'"'));
        q.larguras.forEach(w=>assert(w<=881, t+': linha mais larga que a caixa ('+Math.round(w)+')'));
        if(iguala && q.linhas.length>1) assert(Math.max(...q.zs)/Math.min(...q.zs)<=1.36, t+': variação de corpo acima do limite');
      }
    // acento: a linha de baixo com É/Ã ganha respiro (nunca encosta na de cima) e a altura conta a tinta
    const com=_crAlt(['FESTIVAL','GASTRONÔMICO'], 150), sem=_crAlt(['FESTIVAL','GASTRONOMICO'], 150);
    assert(com.ys[1]-com.ys[0] >= sem.ys[1]-sem.ys[0], 'acento não ganhou entrelinha');
    const asc=_crMetrica('É JOGO', _crFonteCls('hero',200), CR_ESTILO.hero.ls).a;
    assert(Math.abs(_crAlt(['É JOGO'], 200).asc-asc)<0.5, 'a caixa não começa na tinta do acento');
    // apoio longo: 2 linhas, sem palavra sozinha na 2ª, corpo maior que a versão encolhida em 1 linha
    const ap='Os parceiros participantes abrem das 11h às 22h no feriado', q2=crTextoLinhas(ap, 'body', 44, 880, 32);
    assert(q2.linhas.length===2 && /\s/.test(q2.linhas[1]) && q2.z>crCabe(ap,'body',44,880,0), 'apoio longo: '+JSON.stringify(q2.linhas)+' '+q2.z);
    // o kerning do Realce entra na medida E no desenho (dx), e o importador lê o texto inteiro
    assert(crMede('FY','hero',200) < crMede('F','hero',200)+crMede('Y','hero',200), 'par FY sem ajuste');
    assert(/dx="/.test(crTexto(100,500,'hero',200,'#FFFFFF','FY PT')), 'kerning não chegou ao SVG');
  });

  caso('Luma Creative: preço-assinatura — R$ e centavos com o topo na altura do número, corpo estável entre 11 e 88, e o Estúdio lê um preço só', async()=>{
    await crFontesProntas();
    const svg=z=>'<svg xmlns="http://www.w3.org/2000/svg" data-luma="1" viewBox="0 0 1080 1350" width="1080" height="1350">'+crDefs()+'<g data-bloco="preco"><g id="preco">'+crPreco(100, 600, z, 880, '#FFFFFF', 220)+'</g></g></svg>';
    const t=crGeometria(svg('22,90')).textos[0];
    assert(t, 'preço sem texto na geometria');
    const g=_crPrecoGeo(220, Math.round(220*0.55)), topoNum=600-_crMetrica('22',_crFonteCls('hero',220),CR_ESTILO.hero.ls).a, topoR=600-g.dy-_crMetrica('R',_crFonteCls('hero',121),CR_ESTILO.hero.ls).a;
    assert(Math.abs(topoNum-topoR)<=2, 'R$ fora da altura das maiúsculas: '+Math.round(topoNum)+' × '+Math.round(topoR));
    assert(crPrecoMede('11,90', 300, 220).big===crPrecoMede('88,90', 300, 220).big, 'algarismos instáveis: 11 e 88 com corpos diferentes');
    const {layers}=await importar(await crEmbutir(svg('22,90')));
    const p=layers.filter(l=>l.type==='text' && String(l.content).indexOf('{{precoPor')>=0);
    assert(p.length===1, 'o preço não virou UM campo no Estúdio: '+layers.map(l=>l.content).join(' | '));
  });

  /* ── Composições e golden (frente 4; a curadoria da frente 5 escreve no mesmo arquivo) ── */
  caso('Luma Creative: golden — toda arte aprovada volta sem erro da marca, com a nota da aprovação (− tolerância), e cada composição entra no importador', async()=>{
    await crFontesProntas();
    CR_COMPOSICOES.forEach(c=>assert(CR_GOLDEN.some(g=>g.receita===c.id), 'composição sem golden: '+c.id+' (rode node scripts/catalogo-composicoes.js)'));
    const caiu=[], importada=new Set();
    for(const g of CR_GOLDEN){
      const rot=g.receita+'/'+g.caso+'/'+g.texto+(g.foto?'/foto':'')+'/'+g.marca;
      const r=crCandidatos(crBancoPedido(g.caso, g.texto, g.formato, g.foto?'slot':'', g.marca), {receitas:[g.receita]}).filter(x=>!x.avaliacao.erros.length)[0];
      if(!r){ caiu.push(rot+': não monta mais sem erro'); continue; }
      if(r.nota < g.nota-CR_GOLDEN_TOL) caiu.push(rot+': nota '+g.nota+' → '+r.nota+' ('+r.design.porque+')');
      if(importada.has(g.receita)) continue;
      importada.add(g.receita);
      assert(!r.estouros.length && crConfere(r).every(c=>c.ok), rot+': conferência da marca falhou');
      const {layers}=await importar(await crEmbutir(r.svg));
      r.campos.filter(c=>c!=='foto_produto').forEach(c=>assert(campoNa(layers,c), rot+': campo {{'+c+'}} não chegou ao Estúdio'));
      assert(layers.filter(l=>l.type==='frame' && l.imgVar==='foto_produto').length===(r.campos.indexOf('foto_produto')>=0?1:0), rot+': moldura da foto');
    }
    assert(!caiu.length, caiu.length+' arte(s) do golden pioraram: '+caiu.slice(0,6).join(' · '));
  });

  /* ── Curadoria (frente 5): os votos viram pesos sugeridos e golden, sem IA ── */
  caso('Luma Creative: curadoria — os votos sugerem pesos de forma determinística, puxando a parte que separa aprovadas de reprovadas, e o JSON leva o golden', async()=>{
    const p=(o)=>Object.assign({equilibrio:.85,vazio:.85,eixos:.9,escala:.85,contraste:.95,respiro:.9}, o);
    const v=(i, voto, partes, motivos)=>({chave:'k'+i, caso:'a01', formato:'feed', texto:i%4, foto:false, marca:'dm', objetivo:'oferta', receita:'cardPreso', familia:'cardPreso', nota:80, partes, voto, motivos:motivos||[]});
    // as aprovadas têm o vazio bom e a escala pior; as reprovadas, o contrário — a nota de hoje erra a ordem
    const votos=[v(1,1,p({vazio:.95,escala:.7})), v(2,1,p({vazio:.93,escala:.72})), v(3,1,p({vazio:.94,escala:.71})),
      v(4,-1,p({vazio:.75,escala:.99}),['vazio']), v(5,-1,p({vazio:.76,escala:.98}),['vazio']), v(6,-1,p({vazio:.74,escala:.99}))];
    const a=crCuradoriaPesos(votos), b=crCuradoriaPesos(votos.slice().reverse());
    assert(a && JSON.stringify(a)===JSON.stringify(b), 'pesos não determinísticos');
    assert(a.pesos.vazio>1 && a.pesos.vazio>=a.pesos.escala, 'o vazio não ganhou peso: '+JSON.stringify(a.pesos));
    assert(a.acerto.depois>a.acerto.antes, 'o acerto não melhorou: '+JSON.stringify(a.acerto));
    assert(crCuradoriaPesos(votos.slice(0,3))===null, 'sugeriu pesos sem reprovadas');
    const j=crCuradoriaExporta(votos);
    assert(j.versao===1 && j.votos.length===6 && j.golden.length===3 && j.pesosSugeridos, 'JSON incompleto');
    j.golden.forEach(g=>['receita','formato','caso','texto','foto','marca','nota'].forEach(k=>assert(k in g, 'golden sem '+k)));
    // os pesos aplicados mexem na nota (e voltar a null devolve a do código)
    const antes=crNotaPesos('oferta','feed').vazio; _crPesosCuradoria={vazio:2};
    const depois=crNotaPesos('oferta','feed').vazio; _crPesosCuradoria=null;
    assert(Math.abs(depois-2*antes)<1e-9 && crNotaPesos('oferta','feed').vazio===antes, 'os pesos da curadoria não entram na nota');
  });

  let passed=0; const falhas=[];
  for(const item of cases){
    const li=document.createElement('li'); li.className='case';
    try{
      await item.fn(); passed++; li.classList.add('pass');
      li.innerHTML='<strong>✓ '+item.name+'</strong>';
    }catch(error){
      li.classList.add('fail');
      li.innerHTML='<strong>✕ '+item.name+'</strong><small>'+String(error&&error.message||error).replace(/</g,'&lt;')+'</small>';
      console.error('[svg-import]', item.name, error);
      falhas.push({name:item.name, error:String(error&&error.message||error)});
    }
    results.appendChild(li);
  }
  const failed=cases.length-passed;
  summary.textContent=passed+'/'+cases.length+' cenários passaram'+(failed?' · '+failed+' falharam':' · contrato do importador mantido');
  document.title=(failed?'FALHOU':'OK')+' — Importador de SVG ('+passed+'/'+cases.length+')';
  // Contrato do runner (scripts/run-browser-tests.js)
  window.__lumaTest={passed:passed, total:cases.length, failures:falhas};
})();
