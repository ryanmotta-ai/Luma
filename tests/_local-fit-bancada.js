/* ══════════════════════════════════════════════════════════════════════════════════════════
   BANCADA DO LOCAL FIT — `node scripts/run-browser-tests.js _local-fit-bancada`
   (com `LUMA_VERBOSE=1` para ver todas as linhas).

   INSTRUMENTO, NÃO PORTÃO. O `_` no nome mantém o arquivo fora da rodada padrão e do CI: ele
   mede e nunca reprova. A pergunta que ele responde é a única que decide se vale ligar esta
   camada na produção:

        ATÉ ONDE O LOCAL FIT RESOLVE SOZINHO, SEM O AUTOMATIC DESIGNER?

   Três medições:
     1. CORPUS SHADOW — nos mesmos materiais reais de `tests/corpus/`, quantos campos já cabem
        no original, quantos resolvem só com wrap, quantos precisam de shrink e quantos chegam
        em overflow. ⚠ SHADOW: nada da produção muda, nada é escrito em layer nenhum.
     2. STRESS — grade de caixas × conteúdos × fontes, para achar o limite de cada forma de
        caixa (estreita, baixa, larga/baixa, estreita/alta).
     3. BENCHMARK — custo por campo nos três regimes (cabe de primeira, wrap, shrink completo),
        porque esta camada poderá rodar a cada tecla digitada na copy.
   ══════════════════════════════════════════════════════════════════════════════════════════ */
(function(){
  const saida = document.getElementById('saida');
  const linhas = [];
  const log = (s) => { linhas.push(s); saida.textContent += s + '\n'; };
  const pct = (a, b) => b ? (Math.round(a * 1000 / b) / 10) + '%' : '—';
  const q = (arr, p) => { if(!arr.length) return 0;
    const o = arr.slice().sort((a,b) => a-b);
    return Math.round(o[Math.min(o.length-1, Math.floor(p*(o.length-1)))] * 100) / 100; };
  const clone = o => JSON.parse(JSON.stringify(o));

  const CANVAS_PADRAO = { w:1080, h:1350 };
  const contar = () => ({ original:0, wrap:0, shrink:0, overflow:0 });
  const somar = (c, r) => { c[r.degrau === 'piso' ? 'overflow' : r.degrau]++; };
  const linhaContagem = (c) => {
    const t = c.original + c.wrap + c.shrink + c.overflow;
    return 'original ' + String(c.original).padStart(4) + ' (' + pct(c.original,t) + ')'
         + ' · wrap ' + String(c.wrap).padStart(4) + ' (' + pct(c.wrap,t) + ')'
         + ' · shrink ' + String(c.shrink).padStart(4) + ' (' + pct(c.shrink,t) + ')'
         + ' · overflow ' + String(c.overflow).padStart(4) + ' (' + pct(c.overflow,t) + ')'
         + ' · n=' + t;
  };

  /* Qualidade editorial da quebra — o que o Local Fit HERDA de `gSmartWrapText` e não pode
     consertar sozinho (mexer na quebra é mexer em primitiva compartilhada). */
  const editorial = { linhasMultiplas:0, conectorOrfao:0, unidadePartida:0 };
  function medirEditorial(r){
    if(!r || r.lines.length < 2) return;
    editorial.linhasMultiplas++;
    for(let i = 0; i < r.lines.length - 1; i++){
      const p = String(r.lines[i]).trim().split(/\s+/);
      const ultima = p[p.length-1] || '';
      const prox = String(r.lines[i+1]).trim().split(/\s+/)[0] || '';
      if(typeof gLayoutColaConector === 'function' && gLayoutColaConector(ultima)){
        editorial.conectorOrfao++; break;
      }
      if(typeof G_LAYOUT_UNIDADES !== 'undefined'
         && G_LAYOUT_UNIDADES.some(u => u.antes.test(ultima) && u.depois.test(prox))){
        editorial.unidadePartida++; break;
      }
    }
  }

  const temCampo = (l) => l && l.type === 'text' && /\{\{/.test(String(l.content || ''));
  const interpolar = (l, dados) => (typeof gInterpolate === 'function')
    ? gInterpolate(String(l.content||''), dados, { defaults:{}, onEmpty:'remove' })
    : String(l.content||'');

  /* ══ 1. CORPUS SHADOW ══════════════════════════════════════════════════════════════════ */
  log('══ 1. CORPUS SHADOW — materiais reais, nenhuma escrita em produção ═══════════════════');
  log('');
  const corpus = window.LUMA_CORPUS || [];
  const totalCorpus = contar();
  const porCenario = {};
  const travados = [];
  const temposCorpus = [];

  corpus.forEach(art => {
    const canvas = art.canvas || CANVAS_PADRAO;
    const porArte = contar();
    Object.keys(art.cenarios || {}).forEach(nomeCen => {
      const dados = art.cenarios[nomeCen];
      /* Papéis compilados em CLONE: o teto de linhas tem que ser o mesmo que a produção
         inferiria. Ler a decisão que outra camada já tomou é melhor que readivinhar pelo nome. */
      const layers = clone(art.layers);
      if(typeof gCompileLayoutRoles === 'function') gCompileLayoutRoles(layers, canvas);
      porCenario[nomeCen] = porCenario[nomeCen] || contar();
      layers.filter(temCampo).forEach(l => {
        const texto = interpolar(l, dados);
        const t0 = performance.now();
        const r = gFitTextToAuthoredBox(l, texto, { canvas, layers });
        temposCorpus.push(performance.now() - t0);
        somar(totalCorpus, r); somar(porArte, r); somar(porCenario[nomeCen], r);
        medirEditorial(r);
        if(r.status === 'overflow'){
          travados.push('  [' + art.nome + ' · ' + nomeCen + '] ' + (l.name || l.id)
            + ' → ' + r.diagnostics.motivo
            + ' · corpo ' + r.diagnostics.fontSizeAutorado + '→' + r.fontSize
            + 'px (piso ' + r.diagnostics.piso + ')');
        }
      });
    });
    log(('  ' + art.nome).padEnd(28) + linhaContagem(porArte));
  });
  log('');
  log('  TOTAL'.padEnd(28) + linhaContagem(totalCorpus));
  log('');
  Object.keys(porCenario).forEach(k => log(('  cenário ' + k).padEnd(28) + linhaContagem(porCenario[k])));
  log('');
  log('  O que o Local Fit NÃO resolve sozinho (vai precisar do Automatic Designer):');
  if(!travados.length) log('    nenhum — o corpus inteiro cabe na própria caixa.');
  travados.slice(0, 30).forEach(t => log(t));
  log('');

  /* ══ 2. STRESS ═════════════════════════════════════════════════════════════════════════ */
  log('══ 2. STRESS — formas de caixa × conteúdo × fonte ════════════════════════════════════');
  log('');
  const CAIXAS = [
    { nome:'referência  (620×150)', w:620, h:150 },
    { nome:'estreita    (260×900)', w:260, h:900 },
    { nome:'baixa       (620×70) ', w:620, h:70  },
    { nome:'larga/baixa (980×90) ', w:980, h:90  },
    { nome:'estreita/alta (180×1100)', w:180, h:1100 },
    { nome:'generosa    (820×620)', w:820, h:620 }
  ];
  const CONTEUDOS = [
    { nome:'título curto ', t:'Combo Burger' },
    { nome:'título médio ', t:'Super Combo Duplo Mega Burger' },
    { nome:'título longo ', t:'Super Combo Duplo Mega Burger Artesanal com Batata e Refrigerante' },
    { nome:'texto absurdo', t:('Super Combo Duplo Mega Burger Artesanal com Batata Frita Cheddar '
                             + 'Bacon Refrigerante Sobremesa e Brinde Surpresa ').repeat(3) },
    { nome:'palavra longa', t:'SUPERPROMOÇÃOIMPERDÍVELDEANIVERSÁRIODAREDEINTEIRA' },
    { nome:'preço + unid.', t:'Combo Especial R$ 1.249,00 e ganhe 500 ml grátis' }
  ];
  const FONTES = [
    { nome:'texto  ', font:'Arial',        fontSize:48, textTransform:null },
    { nome:'display', font:'Realce Black', fontSize:48, textTransform:'uppercase' }
  ];

  const stress = contar();
  FONTES.forEach(f => {
    log('  ── fonte ' + f.nome.trim() + ' ' + (f.textTransform ? '(caixa alta)' : '') + ' ──');
    CAIXAS.forEach(cx => {
      const l = { id:'alvo', name:'Produto', type:'text', content:'{{produto}}', isVar:true,
        x:60, y:200, w:cx.w, h:cx.h, font:f.font, fontSize:f.fontSize, lineHeight:1.2,
        textAlign:'left', textBox:'box', vAlign:'top', textTransform:f.textTransform,
        visible:true, opacity:100, layoutRefText:'Combo Burger', maxLines:12 };
      const celulas = CONTEUDOS.map(c => {
        const r = gFitTextToAuthoredBox(l, c.t, { canvas:CANVAS_PADRAO });
        somar(stress, r); medirEditorial(r);
        const marca = r.degrau === 'original' ? 'orig'
                    : r.degrau === 'wrap' ? 'wrap'
                    : r.degrau === 'shrink' ? ('−' + Math.round(100 - r.fontSize*100/r.diagnostics.fontSizeAutorado) + '%')
                    : 'OVER';
        return marca.padStart(5) + '/' + String(r.lines.length).padStart(2) + 'ln';
      });
      log('    ' + cx.nome.padEnd(24) + celulas.join(' │ '));
    });
    log('    ' + ' '.repeat(24) + CONTEUDOS.map(c => c.nome.slice(0,8).padStart(8)).join(' │ '));
    log('');
  });
  log('  TOTAL do stress: ' + linhaContagem(stress));
  log('');

  /* ══ 3. QUALIDADE EDITORIAL HERDADA ════════════════════════════════════════════════════ */
  log('══ 3. QUALIDADE EDITORIAL HERDADA de `gSmartWrapText` ════════════════════════════════');
  log('  (Local Fit não tem quebra própria — isto mede o motor único, não esta camada.)');
  log('  resultados com 2+ linhas: ' + editorial.linhasMultiplas);
  log('    com preposição órfã no fim da linha: ' + editorial.conectorOrfao
      + ' (' + pct(editorial.conectorOrfao, editorial.linhasMultiplas) + ')');
  log('    com unidade semântica partida:       ' + editorial.unidadePartida
      + ' (' + pct(editorial.unidadePartida, editorial.linhasMultiplas) + ')');
  log('');

  /* ══ 4. BENCHMARK ══════════════════════════════════════════════════════════════════════ */
  log('══ 4. BENCHMARK — custo por campo (esta camada roda a cada tecla da copy) ════════════');
  log('');
  const base = { id:'bench', name:'Produto', type:'text', content:'{{produto}}', isVar:true,
    x:60, y:200, w:620, h:150, font:'Arial', fontSize:48, lineHeight:1.2, textAlign:'left',
    textBox:'box', vAlign:'top', visible:true, opacity:100, layoutRefText:'Combo Burger',
    maxLines:12 };
  const REGIMES = [
    { nome:'fit original (cabe de primeira)', layer:base, t:'Combo Burger' },
    { nome:'wrap (2–3 linhas, sem encolher)', layer:Object.assign({}, base, { h:420 }),
      t:'Super Combo Duplo Mega Burger Artesanal com Batata' },
    { nome:'shrink até resolver           ', layer:base,
      t:'Super Combo Duplo Mega Burger Artesanal com Batata' },
    { nome:'shrink até o piso (overflow)  ', layer:base,
      t:('Super Combo Duplo Mega Burger Artesanal com Batata Frita Cheddar Bacon ').repeat(3) }
  ];
  const N = 200;
  REGIMES.forEach(rg => {
    /* Duas medições: com o cache quente (o caso real — o franqueado digita letra a letra sobre
       o mesmo campo) e com ele frio (a primeira tecla, e o pior caso honesto). */
    const quente = [], frio = [];
    gFitTextToAuthoredBox(rg.layer, rg.t, { canvas:CANVAS_PADRAO });      // aquece
    for(let i = 0; i < N; i++){
      let t0 = performance.now();
      gFitTextToAuthoredBox(rg.layer, rg.t, { canvas:CANVAS_PADRAO });
      quente.push(performance.now() - t0);
      _G_MEDIDA_CACHE = new Map();
      t0 = performance.now();
      gFitTextToAuthoredBox(rg.layer, rg.t, { canvas:CANVAS_PADRAO });
      frio.push(performance.now() - t0);
    }
    const r = gFitTextToAuthoredBox(rg.layer, rg.t, { canvas:CANVAS_PADRAO });
    log('  ' + rg.nome + '  degraus=' + String(r.diagnostics.passos.length).padStart(2)
      + '  quente p50 ' + q(quente,0.5) + 'ms / p95 ' + q(quente,0.95) + 'ms'
      + '   frio p50 ' + q(frio,0.5) + 'ms / p95 ' + q(frio,0.95) + 'ms');
  });
  log('');
  log('  campo do corpus, ponta a ponta (inclui clonar a arte e carimbar os pisos):');
  log('    p50 ' + q(temposCorpus,0.5) + 'ms · p95 ' + q(temposCorpus,0.95) + 'ms · máx '
      + q(temposCorpus,1) + 'ms · n=' + temposCorpus.length);
  log('    ⚠ o MÁXIMO é o primeiro campo medido: ele paga o aquecimento do canvas e da fonte,');
  log('      não se repete e não é o custo de digitar.');
  log('');
  log('  ⚠ Orçamento: a prévia ao vivo repinta a cada tecla. Um campo acima de ~8ms no caminho');
  log('    quente já é perceptível num celular fraco (o runner roda em desktop — multiplique).');

  document.getElementById('summary').textContent =
    'corpus: ' + linhaContagem(totalCorpus) + ' · campo p95 ' + q(temposCorpus,0.95) + 'ms';
  window.__lumaTest = { passed:1, total:1, failures:[], notas:linhas };
  document.title = 'OK — bancada do Local Fit';
})();
