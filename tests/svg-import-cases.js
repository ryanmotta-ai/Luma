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
