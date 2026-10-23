#!/usr/bin/env node
/* Exemplo mínimo e funcional: monta uma arte de preço (feed) com os blocos da lib e renderiza no motor real.
   node exemplo.js [pasta-de-saída]   →  <pasta>/exemplo.png (+ variantes de estresse)
   Copie este arquivo como ponto de partida para uma arte nova. */
const path=require('path'), fs=require('fs'), cp=require('child_process');
const L=require('./lib.js'), {PAL}=L;
const out=process.argv[2]||path.join(require('os').tmpdir(),'luma-arte-exemplo'); fs.mkdirSync(out,{recursive:true});
const M=72, W=1080;                      // margem lateral; coluna útil = M..W-M
const layers=[
  L.rect('l-bg','Fundo',0,0,1080,1350,PAL.lilas,0,{anchor:{h:'stretch',v:'stretch'}}),
  ...L.selo(M,64),
  L.banner(48,104,780,'assets/banners/aai.png'),
  L.logoLoja(840,123,168,PAL.laranja,8,L.ELEV),
  L.text('l-prod','PRODUTO',M-6,332,540,90,'{{produto}}','custom:Realce',80,PAL.roxoEsc,{layoutSemantic:'produto'}),
  L.text('l-det','DETALHE',M-6,424,540,58,'{{detalhes}}','custom:Realce',48,PAL.roxoMed),
  ...L.descricaoComSem('l-desc',M-2,486,540,76,"'Roboto',400",26,PAL.roxoMed,56),
  L.rect('l-tag','Etiqueta de preço',648,332,360,208,PAL.amarelo,40,Object.assign({rules:[{var:'precoPor',then:'hide',when:'empty'}]},L.ELEV)),
  L.text('l-de','Preço de',664,352,328,38,'DE {{precoDe}}','custom:Realce',32,PAL.roxoMed,{textAlign:'center',strikethrough:true,rules:[{var:'precoDe',then:'hide',when:'empty'}]}),
  ...L.preco('p',726,476,1.25,PAL.roxoEsc,[{var:'precoDe',then:'hide',when:'empty'}]),
  ...L.preco('s',726,442,1.25,PAL.roxoEsc,[{var:'precoDe',then:'hide',when:'filled'}]),
  L.foto(M,580,936,644,40,L.ELEV),
  L.rect('l-barra','Faixa rodapé',0,1264,1080,86,PAL.roxo),
  L.text('l-info','Validade',300,1292,708,30,'{{validade}}',"'Roboto',400",24,'#ffffff',{textAlign:'right',layoutSemantic:'legal'}),
];
const jobs=[['exemplo',{}],...Object.entries(L.ESTRESSE).map(([k,v])=>['exemplo-'+k,v])];
const files=jobs.map(([n,d])=>{const f=path.join(out,n+'.json'); fs.writeFileSync(f,JSON.stringify(L.job(layers,{dados:d}))); return f;});
const r=cp.spawnSync('node',[path.join(__dirname,'render.js'),...files,'--out',out],{stdio:'inherit'}); process.exit(r.status);
