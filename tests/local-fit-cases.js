/* ══════════════════════════════════════════════════════════════════════════════════════════
   LOCAL FIT CONTRACT — regressão. Abra `tests/local-fit.html` ou rode
   `node scripts/run-browser-tests.js local-fit`.

   O que se cobra aqui é CONTRATO, não beleza:
     · FITS ou OVERFLOW — nunca "parece que coube";
     · conteúdo autorado ⇒ ZERO alteração (ORIGINAL FIRST);
     · a caixa autorada nunca sai de geometria já adaptada;
     · a escada sobe na ordem (corpo → wrap → shrink) e PARA no piso normal;
     · a caixa é 2D: largura e altura são dois vereditos;
     · nada além do texto alvo é tocado — nem o próprio layer recebido;
     · a medida é a do render (`gFitTextLayer`), nunca uma régua paralela.

   ⛔ As asserções são RELACIONAIS de propósito (status, degrau, ordem, monotonia). Cravar
   pixels aqui ataria a suíte à métrica da fonte instalada na máquina — e um vermelho que só
   reproduz num computador é um vermelho que o time aprende a ignorar.
   ══════════════════════════════════════════════════════════════════════════════════════════ */
(async function(){
  const results = document.getElementById('results');
  const summary = document.getElementById('summary');
  const cases = [], falhas = [];
  let perfPilha = null;
  const test = (name, fn) => cases.push({ name, fn });
  const assert = (c, m) => { if(!c) throw new Error(m || 'asserção falhou'); };
  const clone = o => JSON.parse(JSON.stringify(o));

  const CANVAS = { w:1080, h:1350 };

  /* Caixa de parágrafo padrão. `h` generoso ou apertado é o que muda de caso para caso — o
     resto fica igual para que a diferença de veredito tenha UMA causa. */
  const caixa = (extra) => Object.assign({
    id:'produto', name:'Produto', type:'text', content:'{{produto}}', isVar:true,
    x:80, y:260, w:620, h:150,
    font:'Arial', fontSize:48, lineHeight:1.2, textAlign:'left', textBox:'box', vAlign:'top',
    visible:true, opacity:100, layoutRefText:'Combo Burger'
  }, extra || {});

  const ponto = (extra) => Object.assign({
    id:'titulo', name:'Título', type:'text', content:'{{titulo}}', isVar:true,
    x:80, y:120, w:700, h:110,
    font:'Arial', fontSize:80, lineHeight:1.1, textAlign:'left', textBox:'point', vAlign:'top',
    textTransform:'uppercase', visible:true, opacity:100, layoutRefText:'OFERTA DA SEMANA'
  }, extra || {});

  const LONGO   = 'Super Combo Duplo Mega Burger Artesanal com Batata';
  const ABSURDO = ('Super Combo Duplo Mega Burger Artesanal com Batata Frita Cheddar Bacon e '
                 + 'Refrigerante Dois Litros Mais Sobremesa Especial da Casa e Brinde Surpresa ')
                 .repeat(4);   // 4× desde 26/09/2026: com a folga de hierarquia (80%) + largura livre, 2× (~300 caracteres) passou a caber

  /* ── 1. texto curto → original intacto ────────────────────────────────────────────── */
  test('1 · conteúdo do tamanho autorado → FITS, degrau original, ZERO alteração', () => {
    const l = caixa();
    const r = gFitTextToAuthoredBox(l, 'Combo Burger', { canvas:CANVAS });
    assert(r.status === 'fits', 'deveria caber, veio ' + r.status);
    assert(r.degrau === 'original', 'degrau deveria ser original, veio ' + r.degrau);
    assert(r.intacto === true, 'intacto deveria ser true');
    assert(r.changed === false, 'changed deveria ser false');
    assert(r.fontSize === l.fontSize, 'a fonte não podia mudar: ' + r.fontSize);
    assert(r.lines.length === 1, 'deveria sair em 1 linha, veio ' + r.lines.length);
    assert(r.overflowX === 0 && r.overflowY === 0, 'não podia sobrar overflow');
    assert(r.diagnostics.passos.length === 1, 'não podia dar mais de um passo de escada');
  });

  test('1b · o PRÓPRIO texto autorado sempre cabe (invariante da tinta autorada)', () => {
    [caixa(), ponto(), caixa({ h:40 }), ponto({ w:120, h:30 })].forEach(l => {
      const box = gAuthoredTextBox(l, { canvas:CANVAS });
      const r = gFitTextToAuthoredBox(l, box.textoAutorado, { canvas:CANVAS });
      assert(r.status === 'fits', 'o desenho do designer não pode ser overflow: ' + l.id
        + ' · ' + r.diagnostics.motivo);
      assert(r.degrau === 'original', 'o desenho do designer não pode precisar de escada: ' + r.degrau);
    });
  });

  /* ── 2. texto cresce → quebra em mais linhas, mesma fonte ──────────────────────────── */
  test('2 · texto cresce e a caixa tem altura → resolve só com wrap, sem encolher', () => {
    const l = caixa({ h:400, maxLines:6 });
    const r = gFitTextToAuthoredBox(l, LONGO, { canvas:CANVAS });
    assert(r.status === 'fits', 'deveria caber: ' + r.diagnostics.motivo);
    assert(r.degrau === 'wrap', 'degrau deveria ser wrap, veio ' + r.degrau);
    assert(r.changed === false, 'wrap não pode mexer no corpo');
    assert(r.fontSize === l.fontSize, 'a fonte não podia mudar');
    assert(r.lines.length > 1, 'deveria ter quebrado, veio ' + r.lines.length + ' linha(s)');
  });

  /* ── 3 e 4. wrap não basta → shrink progressivo, resolvendo ANTES do piso ──────────── */
  test('3 · wrap não basta (altura estoura) → sobe para shrink', () => {
    const l = caixa({ maxLines:6 });                       // h:150, cabe ~2 linhas a 48px
    const r = gFitTextToAuthoredBox(l, LONGO, { canvas:CANVAS });
    assert(r.degrau === 'shrink' || r.degrau === 'piso',
      'deveria ter precisado encolher, veio ' + r.degrau);
    assert(r.diagnostics.passos.length > 1, 'shrink exige mais de um passo');
    const p = r.diagnostics.passos;
    for(let i = 1; i < p.length; i++){
      assert(p[i].fontSize < p[i-1].fontSize, 'a escada tem que descer sempre');
      assert(p[i].fontSize >= r.diagnostics.piso, 'nenhum passo pode passar do piso');
    }
  });

  test('4 · shrink resolve ANTES do piso — e o corpo final fica entre o piso e o autorado', () => {
    const l = caixa({ maxLines:6 });
    const r = gFitTextToAuthoredBox(l, LONGO, { canvas:CANVAS });
    assert(r.status === 'fits', 'este conteúdo deveria caber encolhendo: ' + r.diagnostics.motivo);
    assert(r.changed === true, 'changed deveria marcar o encolhimento');
    assert(r.fontSize < r.diagnostics.fontSizeAutorado, 'a fonte deveria ter descido');
    assert(r.fontSize > r.diagnostics.piso, 'deveria ter sobrado folga até o piso, mas parou nele');
    assert(r.diagnostics.noPiso === false, 'não chegou ao piso, então noPiso é false');
  });

  /* ── 5. chega ao piso → OVERFLOW com diagnóstico objetivo ──────────────────────────── */
  test('5 · chegou ao piso normal e não coube → OVERFLOW, e a escada PARA', () => {
    const l = caixa({ maxLines:12 });
    const r = gFitTextToAuthoredBox(l, ABSURDO, { canvas:CANVAS });
    assert(r.status === 'overflow', 'deveria ser overflow, veio ' + r.status);
    assert(r.degrau === 'piso', 'degrau deveria ser piso, veio ' + r.degrau);
    assert(r.fontSize === r.diagnostics.piso, 'tem que parar EXATAMENTE no piso, parou em ' + r.fontSize);
    assert(r.diagnostics.noPiso === true, 'noPiso deveria ser true');
    assert(r.overflowX > 0 || r.overflowY > 0 || r.lines.length > r.diagnostics.maxLinhas,
      'overflow sem excesso mensurável é beco sem saída');
    const d = r.diagnostics;
    ['motivo','larguraDisponivel','larguraNecessaria','alturaDisponivel','alturaNecessaria',
     'linhas','maxLinhas','fontSizeAutorado','piso'].forEach(k =>
      assert(d[k] !== undefined && d[k] !== null, 'diagnóstico sem "' + k + '"'));
    assert(/excedida|linhas/.test(d.motivo), 'motivo vago: ' + d.motivo);
  });

  test('5b · piso normal, nunca emergência — o piso bate com gLayoutPisoFonte(l,false)', () => {
    const l = caixa();
    const layers = [l, caixa({ id:'apoio', name:'Apoio', fontSize:20, y:500 })];
    const box = gAuthoredTextBox(l, { canvas:CANVAS, layers });
    const espelho = clone(layers);
    gStampPisosHierarquia(espelho, CANVAS);
    const esperado = Math.max(8, Math.round(gLayoutPisoFonte(espelho[0], false)));
    assert(box.piso === Math.min(l.fontSize, esperado),
      'piso ' + box.piso + ' ≠ piso normal do motor ' + esperado);
    assert(box.piso > Math.max(8, Math.round(gLayoutPisoFonte(espelho[0], true))) ||
           gLayoutPisoFonte(espelho[0], true) === gLayoutPisoFonte(espelho[0], false),
      'Local Fit não pode usar o piso de emergência');
  });

  /* ── 6. a caixa é 2D — largura cabe, altura não ────────────────────────────────────── */
  test('6 · cada linha cabe na largura mas as linhas estouram a altura → OVERFLOW vertical', () => {
    // Quebras manuais: a largura fica trivialmente resolvida, o veredito é só do eixo Y.
    const l = caixa({ h:150, maxLines:12 });
    const texto = ['Um','Dois','Três','Quatro','Cinco','Seis','Sete','Oito'].join('\n');
    const r = gFitTextToAuthoredBox(l, texto, { canvas:CANVAS });
    assert(r.overflowX === 0, 'a largura deveria estar resolvida, sobrou ' + r.overflowX + 'px');
    assert(r.status === 'overflow', 'altura estourada ainda é overflow, veio ' + r.status);
    assert(r.overflowY > 0, 'o excesso vertical tem que ser mensurável');
    assert(/altura excedida/.test(r.diagnostics.motivo), 'motivo não cita a altura: ' + r.diagnostics.motivo);
    assert(r.diagnostics.alturaNecessaria > r.diagnostics.alturaDisponivel, 'altura incoerente');
  });

  /* ── 7. altura cabe, largura não → wrap (caixa) ou shrink (ponto) ──────────────────── */
  test('7a · caixa alta e estreita: só a largura falta → resolve com wrap', () => {
    const l = caixa({ w:300, h:900, maxLines:12 });
    const r = gFitTextToAuthoredBox(l, LONGO, { canvas:CANVAS });
    assert(r.status === 'fits', 'deveria caber: ' + r.diagnostics.motivo);
    assert(r.degrau === 'wrap', 'deveria resolver sem encolher, veio ' + r.degrau);
    assert(r.lines.length > 2, 'caixa estreita deveria render muitas linhas');
  });

  /* Caixa do Illustrator (decisão do Ryan, 22/09/2026): texto de ponto também quebra na
     largura DESENHADA e só encolhe quando as linhas lotaram a altura. */
  test('7b · texto de PONTO quebra na caixa desenhada antes de encolher', () => {
    const l = ponto({ h:300 });
    const r = gFitTextToAuthoredBox(l, 'OFERTA RELÂMPAGO DE ANIVERSÁRIO', { canvas:CANVAS });
    assert(r.status === 'fits', 'caixa com altura de sobra deveria caber: ' + r.diagnostics.motivo);
    assert(r.lines.length > 1, 'deveria ter pulado de linha, veio ' + r.lines.length);
    assert(r.layoutW === l.w, 'a quebra usa a largura desenhada, veio ' + r.layoutW);
    assert(r.fontSize === l.fontSize, 'cabendo quebrando, não podia encolher: ' + r.fontSize);
  });

  test('7c · texto de PONTO com caixa baixa: lotou a altura → encolhe', () => {
    const r = gFitTextToAuthoredBox(ponto(), 'OFERTA RELÂMPAGO DE ANIVERSÁRIO', { canvas:CANVAS });
    assert(r.changed === true || r.status === 'overflow', 'sem altura para quebrar, tinha que encolher');
    if(r.status === 'fits') assert(r.diagnostics.alturaNecessaria <= r.diagnostics.alturaDisponivel + 1,
      'FITS não pode passar da altura');
  });

  test('7d · texto de PONTO autorado segue em 1 linha, sem carimbo de quebra', () => {
    const r = gFitTextToAuthoredBox(ponto(), 'OFERTA DA SEMANA', { canvas:CANVAS });
    assert(r.degrau === 'original' && r.lines.length === 1 && !r.layoutW, 'o desenho autorado mudou');
  });

  /* ── 8. maxLines ──────────────────────────────────────────────────────────────────── */
  test('8 · maxLines explícito manda em tudo e nunca é ultrapassado num FITS', () => {
    const solto  = caixa({ h:900, maxLines:12 });
    const travado = caixa({ h:900, maxLines:2 });
    const a = gFitTextToAuthoredBox(solto, LONGO, { canvas:CANVAS });
    const b = gFitTextToAuthoredBox(travado, LONGO, { canvas:CANVAS });
    assert(b.diagnostics.maxLinhas === 2, 'o teto explícito deveria ser 2, veio ' + b.diagnostics.maxLinhas);
    if(b.status === 'fits') assert(b.lines.length <= 2, 'FITS não pode passar do teto');
    assert(b.lines.length <= a.lines.length, 'o teto menor não pode produzir MAIS linhas');
  });

  test('8b · sem regra explícita, o teto é inferido: papel ∩ altura, e nunca abaixo do autorado', () => {
    const l = caixa({ h:150 });                    // ~2 linhas de 48px cabem em 150px
    const box = gAuthoredTextBox(l, { canvas:CANVAS });
    const semantico = _gLayoutMaxLinhas(box.camada);
    const geo = Math.max(1, Math.floor(box.alturaDisponivel / (box.fontSize * box.lineHeight)));
    const r = gFitTextToAuthoredBox(l, 'Combo Burger', { canvas:CANVAS });
    assert(box.maxLinhasEditorial === semantico, 'o teto editorial tem que vir do motor semântico');
    assert(r.diagnostics.maxLinhas === Math.max(box.linhasAutoradas, Math.min(semantico, geo)),
      'inferência fora do contrato: ' + r.diagnostics.maxLinhas);
    assert(r.diagnostics.maxLinhas >= box.linhasAutoradas,
      'o teto não pode reprovar o próprio desenho do designer');
  });

  test('8c · o teto NUNCA vem de `_layoutMaxLines` (carimbo de runtime)', () => {
    const l = caixa({ h:900, _layoutMaxLines:1 });
    const r = gFitTextToAuthoredBox(l, LONGO, { canvas:CANVAS });
    assert(r.diagnostics.maxLinhas > 1, 'leu o carimbo adaptado como teto autoral');
  });

  /* ── 9. quebra semântica preservada ───────────────────────────────────────────────── */
  /* ⚠ A CAIXA AQUI É LARGA DE PROPÓSITO, e mudar isso não é "endurecer o teste".
     `gSmartWrapText` só garante a proteção de preposição órfã e a cola semântica no regime em
     que ele realmente BUSCA partição: até 3 linhas e ~8 unidades. Fora dele (caixa estreita,
     frase longa) o motor cai no encaixe guloso, que é prova de encaixe e não de editoria — e a
     cola de `R$ 49,90` é condicional a a unidade colada ainda caber na linha. Medido em
     `tests/_local-fit-bancada.js`. Local Fit HERDA essa qualidade; ele não pode consertá-la sem
     mexer numa primitiva compartilhada, que é exatamente o que esta frente não faz. */
  test('9 · nenhuma linha termina em preposição e nenhuma unidade semântica é partida', () => {
    const l = caixa({ w:620, h:900, maxLines:12 });
    ['Combo de Burger com Batata e Refrigerante',
     'Pizza Grande de Calabresa com Borda de Cheddar',
     'Açaí de 500 ml com 50% de desconto'].forEach(t => {
      const r = gFitTextToAuthoredBox(l, t, { canvas:CANVAS });
      r.lines.slice(0, -1).forEach(linha => {
        const ultima = String(linha).trim().split(/\s+/).pop().toLowerCase();
        assert(!G_CONNECTORS.has(ultima), 'linha terminou na preposição "' + ultima + '" · ' + t);
      });
    });
  });

  test('9b · a quebra é a de `gSmartWrapText` — não existe segundo algoritmo', () => {
    const l = caixa({ h:900, maxLines:12 });
    const r = gFitTextToAuthoredBox(l, LONGO, { canvas:CANVAS });
    const box = gAuthoredTextBox(l, { canvas:CANVAS });
    const prova = Object.assign({}, box.camada, { fontSize:r.fontSize });
    const esperado = gSmartWrapText(LONGO, prova.w, prova, null, null);
    assert(r.text === esperado, 'a quebra divergiu do motor único:\n' + r.text + '\n≠\n' + esperado);
  });

  /* ── 10. caixa alta e fonte display ───────────────────────────────────────────────── */
  test('10 · uppercase e fonte display: a transformação é a do render e o veredito é honesto', () => {
    const l = ponto({ textTransform:'uppercase', font:'Realce Black', w:700, h:110 });
    const r = gFitTextToAuthoredBox(l, 'oferta relâmpago', { canvas:CANVAS });
    assert(r.text === r.text.toUpperCase(), 'o textTransform do render não foi aplicado');
    assert(r.lines.every(s => s === s.toUpperCase()), 'linha sem caixa alta');
    // Caixa alta mede MAIS que caixa baixa: o mesmo texto não pode exigir menos espaço.
    const baixa = gFitTextToAuthoredBox(ponto({ textTransform:null, font:'Realce Black', w:700, h:110 }),
      'oferta relâmpago', { canvas:CANVAS });
    assert(r.diagnostics.larguraNecessaria >= baixa.diagnostics.larguraNecessaria - 1,
      'a caixa alta mediu menos que a caixa baixa — a régua não é a do render');
  });

  /* ── 11. preço e unidades ─────────────────────────────────────────────────────────── */
  test('11 · preço e unidade não quebram errado', () => {
    const l = caixa({ id:'preco', name:'Preço', content:'{{preco}}', w:620, h:600,
                      fontSize:40, layoutRefText:'R$ 29,90', maxLines:12 });
    /* ⚠ LIMITE CONHECIDO DA PRIMITIVA COMPARTILHADA (não é do Local Fit, e esta frente não a
       altera): em `gSemanticUnits` a cola de CONECTOR é avaliada antes do par semântico e sai
       da unidade com `break`. Então em "…por R$ 999,90" o `por` gruda no `R$` e o valor fica
       órfão na linha seguinte. O fixture evita conector imediatamente antes de moeda/unidade
       de propósito — o caso está registrado em `docs/LOCAL-FIT-CONTRACT.md` §Riscos. */
    const r = gFitTextToAuthoredBox(l, 'Combo Especial R$ 1.249,00 e ganhe 500 ml grátis',
      { canvas:CANVAS });
    const junto = r.lines.join('\n');
    [['R$','1.249,00'], ['500','ml']].forEach(([a, b]) => {
      const partido = new RegExp(a.replace('$','\\$') + '\\s*\\n\\s*' + b.replace('.','\\.'));
      assert(!partido.test(junto), a + ' foi separado de ' + b + ':\n' + junto);
    });
  });

  /* ── 12. determinismo ─────────────────────────────────────────────────────────────── */
  test('12 · mesmo conteúdo → mesmo resultado, byte a byte', () => {
    [[caixa(), LONGO], [caixa({maxLines:12}), ABSURDO], [ponto(), 'OFERTA RELÂMPAGO EXCLUSIVA']]
      .forEach(([l, t]) => {
        const a = gFitTextToAuthoredBox(clone(l), t, { canvas:CANVAS });
        const b = gFitTextToAuthoredBox(clone(l), t, { canvas:CANVAS });
        assert(JSON.stringify(a) === JSON.stringify(b), 'resultado variou entre duas chamadas');
      });
  });

  /* ── 13. não mexer em terceiros ───────────────────────────────────────────────────── */
  test('13 · texto A em overflow → todos os outros layers (e o próprio) ficam iguais', () => {
    const alvo = caixa({ maxLines:12 });
    const layers = [
      { id:'fundo', name:'Fundo', type:'shape', shapeKind:'rect', x:0, y:0, w:1080, h:1350,
        fill:'#FF9000', visible:true, opacity:100 },
      alvo,
      { id:'textoB', name:'Descrição', type:'text', content:'Descrição de apoio', x:80, y:460,
        w:620, h:80, font:'Arial', fontSize:28, lineHeight:1.2, textBox:'box', visible:true, opacity:100 },
      { id:'preco', name:'Preço', type:'text', content:'R$ 29,90', x:772, y:265, w:226, h:80,
        font:'Arial', fontSize:56, lineHeight:1.1, textBox:'point', visible:true, opacity:100 },
      { id:'cta', name:'CTA', type:'text', content:'PEÇA AGORA', x:80, y:560, w:420, h:56,
        font:'Arial', fontSize:34, lineHeight:1.2, textBox:'point', visible:true, opacity:100 },
      { id:'foto', name:'Foto', type:'image', x:0, y:640, w:1080, h:710, visible:true, opacity:100 },
      { id:'placa', name:'Placa externa', type:'shape', shapeKind:'rect', x:60, y:240, w:660, h:190,
        fill:'#0A0A0A', visible:true, opacity:100 }
    ];
    const antes = JSON.stringify(layers);
    const r = gFitTextToAuthoredBox(alvo, ABSURDO, { canvas:CANVAS, layers });
    assert(r.status === 'overflow', 'o caso precisa ser de overflow para valer');
    assert(JSON.stringify(layers) === antes, 'Local Fit escreveu em alguma camada');
  });

  /* ── 14. a caixa autorada não deriva de geometria adaptada ─────────────────────────── */
  test('14a · carimbos da cascata são ignorados (teto de fonte, corredor, entrelinha)', () => {
    const autorado = caixa();
    const adaptado = caixa({
      w:260, fontSize:19,                        // já encolhido/apertado por uma volta anterior
      _tetoFonte:19, _layoutW:260, _layoutDx:-40, _layoutMaxLines:1, _entrelinha:0.85,
      _layoutBase:{ x:80, y:260, w:620, h:150 }
    });
    const a = gAuthoredTextBox(autorado, { canvas:CANVAS });
    const b = gAuthoredTextBox(adaptado, { canvas:CANVAS });
    assert(b.origemCaixa === '_layoutBase', 'deveria ler a base do solve, veio ' + b.origemCaixa);
    assert(b.w === a.w && b.h === a.h, 'a caixa autorada veio da geometria adaptada: ' + b.w + '×' + b.h);
    assert(b.camada._tetoFonte === undefined && b.camada._layoutW === undefined,
      'a camada de prova ainda carrega carimbo da cascata');
    assert(b.lineHeight === a.lineHeight, '`_entrelinha` vazou para a entrelinha autorada');
  });

  test('14b · com baseline, `layoutRef` vence a geometria corrente', () => {
    const l = caixa({
      w:200, fontSize:16,                        // geometria corrente já adaptada
      layoutRef:{ v:1, x:80, y:260, w:620, h:150, fontSize:48, lineHeight:1.2,
                  letterSpacing:null, textAlign:'left', textBox:'box', font:'Arial',
                  linhas:1, ink:{ w:300, h:58 }, probe:0 }
    });
    const box = gAuthoredTextBox(l, { canvas:CANVAS });
    assert(box.origemCaixa === 'layoutRef', 'deveria ler o baseline, veio ' + box.origemCaixa);
    assert(box.w === 620 && box.fontSize === 48, 'baseline ignorado: ' + box.w + ' / ' + box.fontSize);
    assert(box.linhasAutoradas === 1, 'o nº de linhas autorado tem que vir do baseline');
  });

  /* ── 15. paridade com o render ────────────────────────────────────────────────────── */
  test('15 · o resultado é exatamente o do `gFitTextLayer` naquele corpo — sem régua paralela', () => {
    [[caixa({ h:900, maxLines:12 }), LONGO], [caixa({ maxLines:12 }), LONGO],
     [ponto(), 'OFERTA RELÂMPAGO EXCLUSIVA DE ANIVERSÁRIO']].forEach(([l, t]) => {
      const r = gFitTextToAuthoredBox(l, t, { canvas:CANVAS });
      const box = gAuthoredTextBox(l, { canvas:CANVAS });
      const prova = Object.assign({}, box.camada, { fontSize:r.fontSize },
                                  r.layoutW ? { _layoutW:r.layoutW } : {});
      const f = gFitTextLayer(prova, t, null, { encolher:false });
      assert(r.text === f.text, 'texto divergiu do render');
      assert(r.lines.join('') === f.lines.join(''), 'linhas divergiram do render');
      assert(r.fontSize === f.fontSize, 'corpo divergiu do render');
      assert(r.diagnostics.larguraNecessaria === Math.round(f.larguraMax),
        'largura medida divergiu do render');
      assert(r.diagnostics.alturaNecessaria === Math.round(f.altura),
        'altura medida divergiu do render');
    });
  });

  /* ── 15b–15e. rodada de 22/09/2026 ────────────────────────────────────────────────── */
  test('15b · placa não cresce para cima do vizinho: o texto cabe no INTERIOR dela', () => {
    const placa = { id:'pl', type:'shape', shapeKind:'rect', x:60, y:100, w:360, h:70,
                    fill:'#FF9000', visible:true, opacity:100 };
    const cta = ponto({ id:'cta', name:'CTA', content:'{{cta}}', x:80, y:110, w:320, h:150,
                        fontSize:36, textAlign:'center', layoutRefText:'PEÇA JÁ' });
    const foto = { id:'foto', type:'shape', x:60, y:190, w:360, h:200, fill:'#333', visible:true, opacity:100 };
    const lf = gLocalFitArte([placa, cta, foto], { canvas:CANVAS,
      dados:{ cta:'PEÇA JÁ PELO APP E GANHE FRETE GRÁTIS' }, defaults:{} });
    const pl = lf.layers.find(l => l.id === 'pl');
    assert(pl.y + pl.h <= foto.y, 'a placa invadiu a foto: termina em ' + (pl.y + pl.h));
  });

  /* Quem RE-MEDE um bloqueio (o balão da solução, o "cabem até N") tem que dar o veredito do
     runtime. Antes media sem a placa: o interior dela não limitava a altura, e uma versão que
     "cabia" ali seguia bloqueada na arte. */
  test('15g · re-medir um bloqueio usa a MESMA placa do runtime (gLocalFitMedidor)', () => {
    const placa = { id:'pl', type:'shape', shapeKind:'rect', x:60, y:100, w:360, h:70,
                    fill:'#FF9000', visible:true, opacity:100 };
    const cta = ponto({ id:'cta', name:'CTA', content:'{{cta}}', x:80, y:110, w:320, h:150,
                        fontSize:36, textAlign:'center', layoutRefText:'PEÇA JÁ' });
    const foto = { id:'foto', type:'shape', x:60, y:190, w:360, h:200, fill:'#333', visible:true, opacity:100 };
    const rodar = (t) => gLocalFitArte([placa, cta, foto].map(clone), { canvas:CANVAS,
      dados:{ cta:t }, defaults:{} });
    const LONGA = 'PEÇA JÁ PELO APP E GANHE FRETE GRÁTIS EM TODO O CARDÁPIO HOJE AMANHÃ E DEPOIS SEM PEDIDO MÍNIMO NENHUM';
    const lf = rodar(LONGA);
    const b = lf.result.bloqueios[0];
    assert(b && b.fieldId === 'cta', 'o cenário precisa bloquear o CTA');
    assert(b.placa && b.placa.id === 'pl', 'o bloqueio não levou a placa que o runtime usou');
    assert(gLocalFitCulpado(b, { cta:LONGA }) === 'cta', 'culpado errado');
    const medir = gLocalFitMedidor(lf.layers, b, 'cta', { cta:LONGA }, { canvas:CANVAS, defaults:{} });
    const alvo = lf.layers.find(l => l.id === 'cta');
    const palavras = LONGA.split(' ');
    let semPlacaErra = false;
    for(let n = 1; n <= palavras.length; n++){
      const t = palavras.slice(0, n).join(' ');
      const runtime = rodar(t).result.invalid ? 'overflow' : 'fits';
      const r = medir(t);
      assert(r.status === runtime, '“' + t + '”: o medidor diz ' + r.status + ' e a arte diz ' + runtime);
      const sem = gFitTextToAuthoredBox(alvo, t, { layers:lf.layers, canvas:CANVAS });
      if(sem.status !== runtime) semPlacaErra = true;
    }
    assert(semPlacaErra, 'o cenário não exercita a placa: sem ela a medida já batia');
  });

  test('15c · conjunto declarado sai no MESMO corpo', () => {
    const card = (id, x) => ponto({ id, name:id, content:'{{'+id+'}}', x, y:80, w:300, h:90,
                                    fontSize:34, textAlign:'center', layoutRefText:'X-BURGER', fitFontGroup:'produtos' });
    /* A faixa de preço logo abaixo é o que uma grade real tem — sem ela o card longo cresce
       para o respiro (ver 15f) e cabe sem encolher, e o grupo não teria o que igualar. */
    const faixa = { id:'faixa', type:'shape', x:0, y:180, w:1080, h:60, fill:'#FF9000', visible:true, opacity:100 };
    const lf = gLocalFitArte([card('p1',40), card('p2',380), card('p3',720), faixa], { canvas:CANVAS,
      dados:{ p1:'X-BURGER', p2:'X-SALADA', p3:'X-TUDO DUPLO COM BACON E OVO' }, defaults:{} });
    const fs = lf.result.campos.map(c => c.fontSize);
    assert(lf.result.campos.every(c => c.status === 'fits'), 'os três deveriam caber');
    assert(new Set(fs).size === 1, 'corpos diferentes na mesma grade: ' + fs.join('/'));
    assert(fs[0] < 34, 'o grupo deveria ter descido junto com o mais longo');
  });

  test('15d · irmão NÃO é quem só parece: largura diferente não entra no grupo', () => {
    const a = ponto({ id:'a', name:'a', content:'{{a}}', w:300, h:90, fontSize:34, layoutRefText:'X' });
    const b = ponto({ id:'b', name:'b', content:'{{b}}', x:500, w:600, h:90, fontSize:34, layoutRefText:'X' });
    const lf = gLocalFitArte([a, b], { canvas:CANVAS,
      dados:{ a:'X-TUDO DUPLO COM BACON E OVO', b:'X-SALADA' }, defaults:{} });
    const cb = lf.result.campos.find(c => c.id === 'b');
    assert(cb.fontSize === 34 && cb.degrau === 'original', 'b não era irmão e encolheu: ' + cb.fontSize);
  });

  test('15e · "por R$ 999,90" não parte o preço entre linhas', () => {
    const medir = s => s.length * 10;
    const u = gSemanticUnits('De R$ 1.249,00 por R$ 999,90 com brinde'.split(' '), medir, 400);
    assert(u.includes('por R$ 999,90'), 'o valor ficou órfão: ' + JSON.stringify(u));
  });

  /* ── 15f–15i. o respiro abaixo da caixa ───────────────────────────────────────────── */
  const produto = (extra) => ponto(Object.assign({ id:'produto', name:'Produto', content:'{{produto}}',
    x:130, y:1220, w:363, h:72, fontSize:95, layoutRefText:'PRODUTO' }, extra || {}));
  const detalhes = { id:'detalhes', name:'Detalhes', type:'text', content:'Com batata', x:126, y:1387,
    w:188, h:58, font:'Arial', fontSize:48, lineHeight:1.2, textBox:'point', vAlign:'top', visible:true, opacity:100 };
  const STORY = { w:1080, h:1920 };
  const LONGO_P = 'PIZZA GRANDE CALABRESA';

  test('15f · caixa justa com vazio embaixo: cresce até o próximo objeto e CABE', () => {
    // pilha:null — aqui se prova o RESPIRO; o Detalhes colado seria pilha inferida (15l).
    const r = gFitTextToAuthoredBox(produto(), LONGO_P, { layers:[produto(), detalhes], canvas:STORY, pilha:null });
    assert(r.status === 'fits', 'deveria caber usando o respiro: ' + r.diagnostics.motivo);
    assert(r.lines.length >= 2, 'deveria ter pulado de linha, veio ' + r.lines.length);
    const fundo = 1220 + r.diagnostics.alturaNecessaria;
    assert(fundo <= detalhes.y - 8, 'o texto encostou no vizinho: termina em ' + fundo);
  });

  test('15g · sem camadas/prancheta a caixa NÃO cresce (o contador do chat não adivinha)', () => {
    const box = gAuthoredTextBox(produto(), {});
    assert(box.alturaLivre === 0, 'cresceu sem saber o que tem embaixo: +' + box.alturaLivre);
  });

  test('15h · texto centralizado na vertical não cresce (cresceria para cima também)', () => {
    const p = produto({ vAlign:'middle' });
    const box = gAuthoredTextBox(p, { layers:[p, detalhes], canvas:STORY });
    assert(box.alturaLivre === 0, 'caixa centralizada cresceu: +' + box.alturaLivre);
  });

  test('15i · o painel que CONTÉM a caixa não é obstáculo; a safe zone do Story é o teto', () => {
    const painel = { id:'painel', type:'shape', x:0, y:900, w:1080, h:1020, fill:'#05c', visible:true, opacity:100 };
    const p = produto();
    const box = gAuthoredTextBox(p, { layers:[painel, p], canvas:STORY });
    assert(box.alturaLivre > 0, 'o painel de trás travou a caixa');
    assert(1220 + 72 + box.alturaLivre <= 1920 - 250, 'passou da safe zone do Story');
  });

  test('15j · palavra partida não é "caber": encolhe em vez de "RECHEA-" / "DA"', () => {
    const d = Object.assign({}, detalhes, { content:'{{detalhes}}', isVar:true });
    const r = gFitTextToAuthoredBox(d, 'Com borda recheada', { layers:[d], canvas:STORY });
    const pedacos = r.lines.join(' ').split(/\s+/).filter(Boolean).length;
    assert(pedacos <= 3, 'alguma palavra foi partida: ' + JSON.stringify(r.lines));
  });

  /* ── 15k–15n. a pilha do designer (relativeAnchor top-to-bottom) ──────────────────── */
  const copa = (ancorado, produtoTxt) => {
    const p = produto();
    const d = Object.assign({}, detalhes, { id:'detalhes' },
      ancorado ? { relativeAnchor:{ layerId:'produto', type:'top-to-bottom', gap:48 } } : {});
    const linha = { id:'linha', type:'shape', x:126, y:1610, w:760, h:5, fill:'#fff', visible:true, opacity:100 };
    // O preço de 57px ao lado (fora da faixa) é o degrau que segura o piso do Produto em 57,
    // como na arte real da Copa: sem ele o nome desceria até 48 e caberia sem pilha nenhuma.
    const preco = { id:'preco', type:'text', content:'R$ 49,90', x:560, y:1230, w:300, h:70, font:'Arial',
      fontSize:57, lineHeight:1.2, textBox:'point', vAlign:'top', visible:true, opacity:100 };
    const dados = { produto: produtoTxt };
    const ancoradas = gApplyRelativeAnchors([p, d, linha, preco], dados, {}, { canvas:STORY });
    return { antes: ancoradas.map(o => Object.assign({}, o)),
             lf: gLocalFitArte(ancoradas, { canvas:STORY, dados, defaults:{} }) };
  };
  const TRES_LINHAS = 'X-TUDO DUPLO COM BACON';

  test('15k · pilha: o topo cresce, o ancorado DESCE junto e a arte cabe', () => {
    const { antes, lf } = copa(true, TRES_LINHAS);
    const cp = lf.result.campos.find(c => c.id === 'produto');
    assert(cp.status === 'fits', 'com a pilha deveria caber: ' + JSON.stringify(cp));
    const d0 = antes.find(o => o.id === 'detalhes'), d1 = lf.layers.find(o => o.id === 'detalhes');
    assert(d1.y > d0.y, 'o Detalhes ancorado não desceu');
    assert(d1.y + d1.h <= 1610 - 8, 'a pilha passou da linha do rodapé: termina em ' + (d1.y + d1.h));
    const p1 = lf.layers.find(o => o.id === 'produto');
    assert(p1.y === 1220, 'o topo da pilha não pode se mover');
    assert(lf.result.changes.some(c => c.id === 'detalhes' && c.pilhaDe === 'produto'), 'a descida não foi declarada');
  });

  test('15l · sem âncora, o vizinho colado na mesma coluna vira pilha QUANDO senão bloquearia', () => {
    const { antes, lf } = copa(false, 'QUANTO TU SABE MANO SOBRE');
    const cp = lf.result.campos.find(c => c.id === 'produto');
    assert(cp.status === 'fits', 'a pilha inferida deveria resolver: ' + JSON.stringify(cp));
    const d1 = lf.layers.find(o => o.id === 'detalhes');
    assert(d1.y > 1387, 'o Detalhes deveria ter descido');
    assert(d1.y + d1.h <= 1610 - 8, 'a pilha inferida passou da linha: termina em ' + (d1.y + d1.h));
    assert(1220 + lf.layers.find(o => o.id === 'produto')._layoutH <= d1.y, 'o texto cobre o Detalhes');
    const l1 = lf.layers.find(o => o.id === 'linha');
    assert(l1.y === antes.find(o => o.id === 'linha').y, 'o de baixo do vizinho é parede, não desce');
  });

  test('15l2 · pilha inferida só no bloqueio: o que cabe sem ela não mexe no vizinho', () => {
    const { lf } = copa(false, 'QUANTO TU SABE');
    assert(lf.result.campos.find(c => c.id === 'produto').status === 'fits', 'deveria caber sozinho');
    assert(lf.layers.find(o => o.id === 'detalhes').y === 1387, 'o Detalhes se moveu sem precisar');
  });

  test('15l3 · vizinho fora da coluna não é pilha: segue parede e bloqueia', () => {
    const p = produto();
    const preco = { id:'preco', type:'text', content:'R$ 49,90', x:560, y:1230, w:300, h:70, font:'Arial',
      fontSize:57, lineHeight:1.2, textBox:'point', vAlign:'top', visible:true, opacity:100 };
    // Começa 60px à direita: cruza a faixa (é parede), mas não é a mesma coluna (não desce).
    const torto = Object.assign({}, detalhes, { x:190 });
    const lf = gLocalFitArte([p, torto, preco], { canvas:STORY, dados:{ produto:'QUANTO TU SABE MANO SOBRE' }, defaults:{} });
    assert(lf.result.campos.find(c => c.id === 'produto').status === 'overflow', 'sem par de pilha deveria bloquear');
    assert(lf.layers.find(o => o.id === 'detalhes').y === 1387, 'o vizinho fora da coluna se moveu');
  });

  test('15m · texto que coube em 1 linha não mexe na pilha (só desce, nunca sobe)', () => {
    const { antes, lf } = copa(true, 'COMBO');
    const d0 = antes.find(o => o.id === 'detalhes'), d1 = lf.layers.find(o => o.id === 'detalhes');
    assert(d1.y === d0.y, 'a pilha se mexeu sem o topo crescer: ' + d0.y + ' → ' + d1.y);
  });

  test('15n · membro da pilha não reserva respiro próprio (o vazio é do topo)', () => {
    const d = Object.assign({}, detalhes, { relativeAnchor:{ layerId:'produto', type:'top-to-bottom', gap:48 } });
    const box = gAuthoredTextBox(d, { layers:[produto(), d], canvas:STORY });
    assert(box.alturaLivre === 0, 'o membro reservou respiro: +' + box.alturaLivre);
  });

  /* ── Bordas do contrato ───────────────────────────────────────────────────────────── */
  const cadeiaVertical = () => {
    const a = caixa({ id:'a', content:'{{a}}', x:80, y:80, w:310, h:58, fontSize:48,
      layoutRefText:'Produto' });
    const b = caixa({ id:'b', content:'{{b}}', x:80, y:160, w:310, h:40, fontSize:32,
      layoutRefText:'Detalhes', relativeAnchor:{ layerId:'a', type:'top-to-bottom', gap:22 } });
    const c = caixa({ id:'c', content:'{{c}}', x:80, y:222, w:310, h:40, fontSize:32,
      layoutRefText:'Preço', relativeAnchor:{ layerId:'b', type:'top-to-bottom', gap:22 } });
    const rodape = { id:'rodape', type:'shape', x:60, y:700, w:500, h:20, visible:true };
    return [a, b, c, rodape];
  };
  const dadosCadeia = { a:'Pizza grande calabresa especial', b:'Com borda recheada e refrigerante', c:'R$ 49,90' };
  const rodaCadeia = (layers, dados) => gLocalFitArte(gApplyRelativeAnchors(layers, dados, {}),
    { canvas:CANVAS, dados, defaults:{} });
  test('15n2 · limite de três linhas reduz o título e preserva a fonte dos detalhes', () => {
    const layers = cadeiaVertical().slice(0, 2); layers[0].w = 180;
    const lf = rodaCadeia(layers, {...dadosCadeia,b:'Detalhes'});
    assert(!lf.result.invalid, JSON.stringify(lf.result.bloqueios));
    const b = lf.layers.find(l => l.id === 'b');
    assert(b.y > 160 && b.y <= 160 + 3 * 32 * 1.2 + 1, 'desceu além de três linhas: '+b.y);
    assert(lf.result.campos.find(c=>c.id==='a').fontSize < 48, 'título não cedeu');
    assert(lf.result.campos.find(c=>c.id==='b').fontSize === 32, 'encolheu o vizinho sem necessidade');
  });
  test('15n3 · quebras explícitas não deslocam a origem do limite', () => {
    const layers = cadeiaVertical().slice(0, 2);
    const lf = rodaCadeia(layers, {a:'Pizza\ngrande\nsaborosa\nespecial',b:'Detalhes'});
    assert(!lf.result.invalid, JSON.stringify(lf.result.bloqueios));
    assert(lf.layers.find(l=>l.id==='b').y <= 160 + 3 * 32 * 1.2 + 1, 'a âncora renovou a folga');
    assert(lf.result.campos.find(c=>c.id==='a').fontSize < 48, 'quebras não reduziram o título');
    layers.push({id:'parede',type:'shape',x:60,y:300,w:500,h:20,visible:true});
    const perto = rodaCadeia(layers, {a:'Pizza\ngrande\nsaborosa\nespecial',b:dadosCadeia.b});
    if(!perto.result.invalid){
      const b = perto.layers.find(l=>l.id==='b');
      assert(b.y + gFitTextLayer(b,dadosCadeia.b,null,{encolher:false}).altura <= 292,
        'âncora inicial além do obstáculo fez a parede desaparecer');
    }
  });
  test('15n4 · vizinho inferido também tem limite mesmo com rodapé distante', () => {
    const layers = cadeiaVertical().slice(0, 2); layers[0].w = 180;
    delete layers[1].relativeAnchor;
    layers[1].fontSize = 16; layers[1].h = 20;
    const lf = rodaCadeia(layers, {...dadosCadeia,b:'Detalhes'});
    assert(!lf.result.invalid, JSON.stringify(lf.result.bloqueios));
    assert(lf.layers.find(l=>l.id==='b').y <= 160 + 3 * 16 * 1.2 + 1, 'par inferido perdeu o limite');
    assert(lf.result.campos.find(c=>c.id==='b').fontSize === 16, 'vizinho inferido encolheu');
  });
  test('15n5 · cada membro respeita seu limite acumulado desde o desenho', () => {
    const layers = cadeiaVertical(), lf = rodaCadeia(layers, dadosCadeia);
    assert(!lf.result.invalid, 'cadeia bloqueou');
    assert(lf.result.campos.find(c=>c.id==='a').fontSize < 48, 'o topo não cedeu espaço');
    assert(lf.result.campos.find(c=>c.id==='b').fontSize === 32, 'reduziu Detalhes antes de esgotar o topo');
    layers.slice(1,3).forEach(l => assert(lf.layers.find(o=>o.id===l.id).y <= l.y + 3*l.fontSize*l.lineHeight + 1,
      l.id+' acumulou mais de três linhas'));
  });
  test('15o · título e detalhes crescem juntos e preço segue a altura FINAL dos dois', () => {
    const lf = rodaCadeia(cadeiaVertical(), dadosCadeia);
    assert(!lf.result.invalid, JSON.stringify(lf.result.bloqueios));
    const [a,b,c] = ['a','b','c'].map(id => lf.layers.find(l => l.id === id));
    const h = id => lf.result.campos.find(c => c.id === id).linhas;
    assert(h('a') > 1 && h('b') > 1, 'cenário não exercitou crescimento simultâneo');
    assert(b.y > 160 && c.y > 222, 'os dois membros deveriam descer');
    const tinta = l => gFitTextLayer(l, dadosCadeia[l.id], null, {encolher:false}).altura;
    assert(Math.abs(b.y - a.y - tinta(a) - 22) <= 1, 'gap do título não foi preservado');
    assert(Math.abs(c.y - b.y - tinta(b) - 22) <= 1, 'gap dos detalhes não foi preservado');
    assert(c.y + tinta(c) < 700, 'preço invadiu rodapé');
    assert(lf.layers.find(l => l.id === 'rodape').y === 700, 'rodapé se moveu');
  });
  test('15p · ordem no array e serialização não mudam a solução da cadeia', () => {
    const layers = cadeiaVertical(), antes = JSON.stringify(layers);
    const a = rodaCadeia(layers, dadosCadeia), b = rodaCadeia(clone(layers).reverse(), dadosCadeia);
    const geometria = lf => lf.layers.map(l => [l.id,l.x,l.y,l.w,l.h,l._tetoFonte,l._layoutW]).sort();
    assert(JSON.stringify(geometria(a)) === JSON.stringify(geometria(b)), 'ordem mudou a solução');
    assert(JSON.stringify(layers) === antes, 'mutou o template');
  });
  test('15q · curto → longo → curto retorna à mesma geometria e fonte', () => {
    const layers = cadeiaVertical(), curto = { a:'Produto', b:'Detalhes', c:'Preço' };
    const a = rodaCadeia(layers, curto); rodaCadeia(layers, dadosCadeia);
    const b = rodaCadeia(layers, curto);
    assert(JSON.stringify(a.layers) === JSON.stringify(b.layers), 'adaptação acumulou');
  });
  test('15r · cadeia impossível bloqueia sem aplicar deslocamento parcial', () => {
    const layers = cadeiaVertical(); layers[3].y = 290;
    const dados = { a:ABSURDO, b:ABSURDO, c:'R$ 49,90' };
    const antes = gApplyRelativeAnchors(layers, dados, {});
    const lf = gLocalFitArte(antes, { canvas:CANVAS, dados, defaults:{} });
    assert(lf.result.invalid, 'deveria bloquear');
    assert(lf.layers.every(l => l.y === antes.find(o => o.id === l.id).y), 'moveu metade da cadeia');
    assert(lf.result.bloqueios.every(b => b.motivo), 'bloqueio sem explicação');
  });
  test('15s · medidor do bloqueio considera o texto dos outros membros', () => {
    const layers = cadeiaVertical(); layers[3].y = 400;
    const dados = { a:ABSURDO, b:'Detalhes com bebida', c:'R$ 49,90' };
    const lf = rodaCadeia(layers, dados), bloqueio = lf.result.bloqueios.find(b => b.fieldId === 'a');
    assert(bloqueio, 'cenário deveria bloquear a');
    const medir = gLocalFitMedidor(lf.layers, bloqueio, 'a', dados, { canvas:CANVAS, defaults:{} });
    ['Pizza', 'Pizza grande calabresa', ABSURDO].forEach(a => {
      const real = rodaCadeia(layers, Object.assign({}, dados, { a })).result.campos.find(c => c.id === 'a');
      assert(medir(a).status === real.status, 'medidor divergiu para ' + a);
    });
  });
  test('15t · ciclo, pai ausente e ramificação recusam movimento parcial', () => {
    ['ciclo','ausente','ramo'].forEach(tipo => {
      const layers = cadeiaVertical();
      if(tipo === 'ciclo') layers[0].relativeAnchor = { layerId:'c', type:'top-to-bottom', gap:22 };
      if(tipo === 'ausente') layers[1].relativeAnchor.layerId = 'sumiu';
      if(tipo === 'ramo') layers[2].relativeAnchor.layerId = 'a';
      const lf = rodaCadeia(layers, dadosCadeia);
      assert(lf.result.invalid, 'aceitou ' + tipo);
      assert(lf.layers.every(l => l.y === layers.find(o => o.id === l.id).y), 'moveu ' + tipo);
    });
  });
  test('15u · textos idênticos em regiões independentes não igualam fontes', () => {
    const a = caixa({ id:'a', content:'{{a}}', x:50, y:80, w:300, h:58, fontSize:48, layoutRefText:'Pizza' });
    const b = Object.assign({}, a, { id:'b', content:'{{b}}', x:600 });
    const parede = { id:'parede', type:'shape', x:0, y:150, w:1080, h:30, visible:true };
    const lf = gLocalFitArte([a,b,parede], { canvas:CANVAS, dados:{ a:'Pizza grande calabresa', b:'Pizza' }, defaults:{} });
    assert(lf.result.campos.find(c => c.id === 'b').fontSize === 48, 'texto independente encolheu');
    assert(lf.result.campos.find(c => c.id === 'a').fontSize < 48, 'cenário não exercitou encolhimento');
  });
  test('15v · cadeia e conjunto de fontes mantêm espaço e igualdade após serializar', () => {
    const layers = cadeiaVertical();
    layers[1].fitFontGroup = layers[2].fitFontGroup = 'apoios';
    const lf = rodaCadeia(clone(layers), dadosCadeia);
    assert(!lf.result.invalid, 'conjunto bloqueou');
    const b = lf.result.campos.find(c => c.id === 'b'), c = lf.result.campos.find(c => c.id === 'c');
    assert(b.fontSize === c.fontSize, 'grupo perdeu igualdade');
    const lb = lf.layers.find(l => l.id === 'b'), lc = lf.layers.find(l => l.id === 'c');
    const hb = gFitTextLayer(lb, dadosCadeia.b, null, {encolher:false}).altura;
    assert(Math.abs(lc.y - lb.y - hb - 22) <= 1, 'grupo perdeu o gap');
  });
  test('15w · preço com placa acompanha a pilha sem invadir rodapé', () => {
    const layers = cadeiaVertical();
    layers[2].layoutRefText = 'R$ 49,90';
    const placa = { id:'placa', type:'shape', x:70, y:212, w:330, h:60,
      shapeKind:'rect', visible:true, opacity:100, fill:'#ff9000' };
    layers.unshift(placa);
    const lf = rodaCadeia(layers, dadosCadeia);
    assert(!lf.result.invalid, JSON.stringify(lf.result.bloqueios));
    const p = lf.layers.find(l => l.id === 'placa'), c = lf.layers.find(l => l.id === 'c');
    assert(p.y > placa.y, 'placa não acompanhou');
    assert(p.y <= c.y && p.y + p.h >= c.y + (c._layoutH || c.h) - 1, 'placa perdeu o texto');
    assert(p.y + p.h < 700, 'placa invadiu rodapé');
    const bloqueada = rodaCadeia(layers, {...dadosCadeia,a:ABSURDO,b:ABSURDO});
    assert(bloqueada.result.invalid, 'deveria bloquear a cadeia com placa');
    const original = gApplyRelativeAnchors(layers, {...dadosCadeia,a:ABSURDO,b:ABSURDO}, {}).find(l => l.id === 'placa');
    const preservada = bloqueada.layers.find(l => l.id === 'placa');
    assert(['x','y','w','h'].every(k=>preservada[k]===original[k]), 'falha aplicou geometria parcial na placa');
  });
  test('15x · cadeia: PNG da prévia é idêntico ao PNG da exportação', async () => {
    const pintar = async purpose => {
      const cv = document.createElement('canvas'); cv.width = CANVAS.w; cv.height = CANVAS.h;
      const out = await fRenderTemplateLayers(cv.getContext('2d'), cadeiaVertical(), CANVAS.w, CANVAS.h,
        dadosCadeia, {color:'#ff9000'}, {layers:[],w:CANVAS.w,h:CANVAS.h,bg:'#fff'}, {scope:'franqueado',purpose});
      return { out, png:cv.toDataURL() };
    };
    const p = await pintar('preview'), e = await pintar('export');
    assert(!p.out._layoutResult.invalid, 'prévia bloqueou');
    assert(p.out.find(l => l.id === 'c').y > 222, 'não exercitou a pilha');
    assert(p.png === e.png, 'PNGs divergiram');
  });
  test('15y · membro oculto não reaparece como espaço na aplicação final', () => {
    const layers = cadeiaVertical(); layers[1].visible = false;
    const lf = rodaCadeia(layers, dadosCadeia);
    assert(!lf.result.invalid, 'membro oculto bloqueou');
    const b = lf.layers.find(l => l.id === 'b'), c = lf.layers.find(l => l.id === 'c');
    assert(!b.visible, 'membro reapareceu');
    assert(Math.abs(c.y - b.y) <= 1, 'altura ou gap do membro oculto empurrou o preço');
  });
  test('15z · cadeia impossível tem custo limitado; benchmark do caminho novo', () => {
    const real = window.gFitTextLayer; let chamadas = 0;
    window.gFitTextLayer = function(){ chamadas++; return real.apply(this, arguments); };
    try{ rodaCadeia(cadeiaVertical(), {a:ABSURDO,b:ABSURDO,c:ABSURDO}); }
    finally{ window.gFitTextLayer = real; }
    assert(chamadas < 500, 'cadeia fez ' + chamadas + ' medidas');
    const tempos = [];
    for(let n=0;n<25;n++){
      const t0=performance.now();
      rodaCadeia(cadeiaVertical(), {...dadosCadeia,a:dadosCadeia.a+' '+n});
      tempos.push(performance.now()-t0);
    }
    tempos.sort((a,b)=>a-b);
    perfPilha={n:tempos.length,p50:tempos[12],p95:tempos[23],max:tempos[24]};
  });

  test('16 · entradas de borda não quebram e não inventam veredito', () => {
    assert(gFitTextToAuthoredBox({ id:'x', type:'shape' }, 'oi', {}) === null, 'shape deveria devolver null');
    assert(gAuthoredTextBox(null) === null, 'null deveria devolver null');
    const vazio = gFitTextToAuthoredBox(caixa(), '', { canvas:CANVAS });
    assert(vazio.status === 'fits' && vazio.lines.length === 0, 'texto vazio cabe e não tem linha');
    const nulo = gFitTextToAuthoredBox(caixa(), null, { canvas:CANVAS });
    assert(nulo.status === 'fits', 'conteúdo nulo não pode virar overflow');
  });

  test('17 · toda geometria devolvida é número finito e o status é um dos dois', () => {
    const textos = ['', 'Combo', LONGO, ABSURDO, '🍔🔥 SUPERPROMOÇÃOIMPERDÍVELDEANIVERSÁRIO',
                    'Xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'a\nb\nc\nd\ne\nf\ng\nh'];
    [caixa(), caixa({ w:90, h:900 }), caixa({ w:900, h:44 }), ponto(), ponto({ w:80 })].forEach(l => {
      textos.forEach(t => {
        const r = gFitTextToAuthoredBox(l, t, { canvas:CANVAS });
        assert(r.status === 'fits' || r.status === 'overflow', 'status inválido: ' + r.status);
        [r.fontSize, r.overflowX, r.overflowY, r.diagnostics.larguraNecessaria,
         r.diagnostics.alturaNecessaria, r.diagnostics.piso].forEach(n =>
          assert(Number.isFinite(n), 'número não finito no resultado de "' + String(t).slice(0,20) + '"'));
        assert(r.fontSize >= r.diagnostics.piso, 'passou do piso');
        assert(r.fontSize <= r.diagnostics.fontSizeAutorado, 'Local Fit AUMENTOU a fonte');
        assert(r.diagnostics.passos.length <= 60, 'escada longa demais — risco de laço');
      });
    });
  });

  /* ── 18. placa interna — diagnóstico, nunca movimento ─────────────────────────────── */
  test('18 · placa do próprio campo vira diagnóstico de mismatch e nada é reposicionado', () => {
    const l = caixa({ id:'preco', name:'Preço', w:300, h:80, fontSize:44,
                      layoutRefText:'R$ 29,90', maxLines:2 });
    const box = gAuthoredTextBox(l, { canvas:CANVAS });
    const placa = { id:'selo', type:'shape', shapeKind:'rect',
                    x:box.x - 20, y:box.y - 14,
                    w:(box.tintaAutorada.w || 100) + 40, h:(box.tintaAutorada.h || 50) + 28,
                    fill:'#0A0A0A', visible:true, opacity:100 };
    const antes = JSON.stringify(placa);
    const curto = gFitTextToAuthoredBox(l, 'R$ 29,90', { canvas:CANVAS, placa });
    assert(curto.diagnostics.placa && curto.diagnostics.placa.mismatch === false,
      'o conteúdo autorado não pode acusar mismatch');
    const longo = gFitTextToAuthoredBox(l, 'De R$ 1.249,00 por R$ 999,90', { canvas:CANVAS, placa });
    assert(longo.diagnostics.placa !== null, 'a placa deveria ter sido reconhecida');
    assert(JSON.stringify(placa) === antes, 'Local Fit mexeu na placa');
  });

  /* ── 19. a fronteira com a outra frente ───────────────────────────────────────────── */
  test('19 · Local Fit não chama Candidate Search, beam, scoring nem a escolha de alternativa', () => {
    const espioes = ['gLayoutEscolherAlternativa','gApplyRelativeAnchors','gScoreComposition',
                     'gLayoutBuscarCandidatos','gLayoutBeam'];
    const originais = {}, chamou = [];
    espioes.forEach(n => {
      if(typeof window[n] !== 'function') return;
      originais[n] = window[n];
      window[n] = function(){ chamou.push(n); return originais[n].apply(this, arguments); };
    });
    try{
      gFitTextToAuthoredBox(caixa({ maxLines:12 }), ABSURDO, { canvas:CANVAS });
      gFitTextToAuthoredBox(ponto(), 'OFERTA RELÂMPAGO', { canvas:CANVAS });
    } finally {
      Object.keys(originais).forEach(n => { window[n] = originais[n]; });
    }
    assert(!chamou.length, 'Local Fit chamou a outra frente: ' + chamou.join(', '));
  });


  /* ══════════════════════════════════════════════════════════════════════════════════════
     5. A ARTE INTEIRA — `gLocalFitArte`, o runtime oficial
     ══════════════════════════════════════════════════════════════════════════════════════
     Os casos acima provam UMA camada. Estes provam o contrato do produto: o que acontece com
     a arte, com os vizinhos e com quem consome o resultado. */

  const shape = (id, x, y, w, h, extra) => Object.assign({
    id, name:id, type:'shape', shapeKind:'rect', x, y, w, h,
    fill:'#0A0A0A', visible:true, opacity:100 }, extra || {});

  /* Arte de referência: fundo + placa + preço dentro dela + título + CTA fixo + campo opcional.
     A placa é a ÚNICA forma autorizada a se mover (ela é do próprio preço); o CTA e o fundo são
     os terceiros que nunca podem mudar. */
  const ARTE = () => [
    shape('fundo', 0, 0, 1080, 1350, { fill:'#FF9000' }),
    ponto({ id:'titulo', x:80, y:120, w:700, h:110, fontSize:80 }),
    caixa({ id:'produto', x:80, y:280, w:620, h:150, fontSize:48 }),
    shape('placa', 760, 260, 250, 120),
    Object.assign(ponto({ id:'preco' }), { name:'Preço', content:'{{preco}}', x:780, y:285,
      w:210, h:70, fontSize:56, textAlign:'center', textTransform:null,
      layoutRefText:'R$ 29,90' }),
    caixa({ id:'selo', name:'Selo opcional', content:'{{selo}}', x:80, y:520, w:400, h:60,
      fontSize:32, layoutRefText:'' }),
    Object.assign(ponto({ id:'cta' }), { name:'CTA', content:'PEÇA AGORA PELO APP', isVar:false,
      x:80, y:640, w:420, h:56, fontSize:34, textTransform:null, layoutRefText:null })
  ];
  const AUTORAL = { titulo:'OFERTA DA SEMANA', produto:'Combo Burger', preco:'R$ 29,90', selo:'' };
  const arte = (dados) => {
    const base = gApplyRelativeAnchors(ARTE(), dados, {}, { canvas:CANVAS, scope:'franqueado' });
    return gLocalFitArte(base, { canvas:CANVAS, dados:dados, defaults:{} });
  };
  const camada = (r, id) => r.layers.find(l => l.id === id);
  const g4 = (l) => [Math.round(l.x||0), Math.round(l.y||0), Math.round(l.w||0), Math.round(l.h||0)];

  test('20 · a arte que cabe sai SEM UM ÚNICO CARIMBO (original first absoluto)', () => {
    const r = arte(AUTORAL);
    assert(r.result.status === 'original', 'a arte autoral virou ' + r.result.status);
    assert(r.result.changes.length === 0, 'a arte autoral registrou ' + r.result.changes.length + ' mudanças');
    const publicado = new Map(ARTE().map(l => [l.id, l]));
    r.layers.forEach(l => {
      assert(JSON.stringify(g4(l)) === JSON.stringify(g4(publicado.get(l.id))),
             '“' + l.id + '” mudou de geometria com conteúdo que cabe');
      assert(l._tetoFonte == null, '“' + l.id + '” recebeu teto de fonte com conteúdo que cabe');
      assert(l._layoutW == null && l._entrelinha == null,
             '“' + l.id + '” voltou com carimbo de composição');
    });
  });

  test('21 · TERCEIROS NUNCA MUDAM — nem quando o vizinho encolhe, nem quando ele estoura', () => {
    [LONGO, ABSURDO].forEach(copy => {
      const r = arte(Object.assign({}, AUTORAL, { produto:copy }));
      const base = gApplyRelativeAnchors(ARTE(), Object.assign({}, AUTORAL, { produto:copy }), {},
                                         { canvas:CANVAS, scope:'franqueado' });
      const antes = new Map(base.map(l => [l.id, l]));
      ['fundo','titulo','preco','cta','selo'].forEach(id => {
        const a = antes.get(id), b = camada(r, id);
        assert(JSON.stringify(g4(a)) === JSON.stringify(g4(b)),
               '“' + id + '” se moveu por causa do produto (' + g4(a) + ' → ' + g4(b) + ')');
        assert(b._tetoFonte == null, '“' + id + '” encolheu por causa do produto');
      });
    });
  });

  test('22 · a PLACA do próprio texto acompanha — e é a única geometria que o Local Fit escreve', () => {
    const r = arte(Object.assign({}, AUTORAL, { preco:'R$ 1.249,00' }));
    const placa = camada(r, 'placa'), publicada = ARTE().find(l => l.id === 'placa');
    const mexeu = JSON.stringify(g4(placa)) !== JSON.stringify(g4(publicada));
    if(!mexeu){
      /* Se a copy do preço couber sem mudar a tinta, a placa fica igual — e isso é o contrato,
         não uma falha. O que não pode acontecer é OUTRA forma se mover. */
      assert(r.result.changes.every(c => !c.geometry), 'algo se moveu sem ser a placa');
      return;
    }
    const geometricas = r.result.changes.filter(c => c.geometry);
    assert(geometricas.length === 1 && geometricas[0].id === 'placa',
           'moveu geometria de ' + geometricas.map(c => c.id).join(', ') + ' — só a placa do campo pode');
    assert(geometricas[0].placaDe === 'preco',
           'a placa mexeu sem dizer de qual campo ela é');
  });

  test('23 · campo opcional VAZIO não é erro, não bloqueia e não adapta nada', () => {
    const r = arte(AUTORAL);                       // `selo` vem vazio de propósito
    const laudo = r.result.campos.find(c => c.id === 'selo');
    assert(laudo && laudo.status === 'vazio', 'o campo vazio não foi reportado como vazio');
    assert(!r.result.invalid, 'campo vazio bloqueou a arte');
    assert(r.result.status === 'original', 'campo vazio virou adaptação: ' + r.result.status);
  });

  test('24 · texto FIXO do designer não entra no encaixe — ele escreveu, ele mediu', () => {
    const r = arte(Object.assign({}, AUTORAL, { produto:ABSURDO }));
    assert(!r.result.campos.some(c => c.id === 'cta'),
           'o CTA fixo entrou no laudo — encaixar o que ninguém pode editar só gera bloqueio sem saída');
    assert(camada(r, 'cta')._tetoFonte == null, 'o CTA fixo foi encolhido');
  });

  test('25 · overflow devolve o payload de CONTENT_TOO_LARGE, com pixels e piso', () => {
    const r = arte(Object.assign({}, AUTORAL, { produto:ABSURDO }));
    assert(r.result.status === 'overflow', 'a copy absurda não bloqueou: ' + r.result.status);
    const b = r.result.bloqueios[0];
    assert(b && b.status === 'CONTENT_TOO_LARGE', 'o bloqueio não saiu tipado');
    assert(b.fieldId === 'produto', 'o bloqueio culpou “' + b.fieldId + '”');
    assert(b.campos.indexOf('produto') >= 0, 'o bloqueio não diz qual {{campo}} travou');
    assert(b.overflowX > 0 || b.overflowY > 0, 'bloqueou sem excesso medido');
    assert(b.fontSize <= b.minimumFontSize + 1,
           'desistiu em ' + b.fontSize + 'px antes do piso de ' + b.minimumFontSize + 'px');
    assert(b.requiredLines >= 1 && typeof b.motivo === 'string' && b.motivo.length > 0,
           'o payload não diz quantas linhas nem por quê');
  });

  test('26 · o diagnóstico diz o LIMITE em caracteres, com o rótulo do Dado e em PT-BR', () => {
    const antes = window.dVars;
    window.dVars = [{ name:'produto', label:'Nome do produto', example:'Combo Burger', type:'text' }];
    try{
      const dados = Object.assign({}, AUTORAL, { produto:ABSURDO });
      const r = arte(dados);
      const d = gLocalFitDiagnostico(r.layers, r.result, dados, { canvas:CANVAS, defaults:{} });
      assert(d && d.campo === 'produto', 'o diagnóstico não achou o campo culpado');
      assert(d.mensagem.indexOf('Nome do produto') >= 0, 'a mensagem não usou o rótulo do Dado');
      assert(!/\{\{|_|undefined/.test(d.mensagem), 'a mensagem vazou termo técnico: ' + d.mensagem);
      assert(d.limite >= 0 && d.limite < dados.produto.length,
             'o limite prometido (' + d.limite + ') não faz sentido');
      if(d.limite){
        const cabe = arte(Object.assign({}, dados, { produto:gLocalFitCorta(dados.produto, d.limite) }));
        assert(!cabe.result.invalid,
               'o limite prometido (' + d.limite + ' caracteres) ainda não cabe — a promessa é falsa');
      }
    }finally{ window.dVars = antes; }
  });

  test('26b · gLocalFitMaiorPrefixo acha o MAIOR corte que cabe, em ~log2(n) medições', () => {
    // Régua sintética: cabe até 17 letras. O maior corte na palavra que cabe é "Pizza Calabresa" (15);
    // "Pizza Calabresa Mussarela" (25) já não. O limite é o do TEXTO medido, não o `n` da busca (24).
    const t = 'Pizza Calabresa Mussarela Especial';
    const r = gLocalFitMaiorPrefixo(t, (s) => s.length <= 17);
    assert(r.texto === 'Pizza Calabresa' && r.limite === 15,
           'achou "' + r.texto + '" (' + r.limite + ') — esperado "Pizza Calabresa" (15)');
    assert(r.medidas <= Math.ceil(Math.log2(t.length + 1)), 'mediu ' + r.medidas + ' vezes para ' + t.length + ' letras');
    assert(gLocalFitMaiorPrefixo(t, () => false).limite === 0, 'nada cabe e prometeu limite');
    assert(gLocalFitMaiorPrefixo(t, () => true).limite === t.length, 'tudo cabe e o limite não é o texto inteiro');
    // Na arte de verdade: o começo do texto com o comprimento prometido cabe.
    const dados = Object.assign({}, AUTORAL, { produto:ABSURDO });
    const a = arte(dados);
    const d = gLocalFitDiagnostico(a.layers, a.result, dados, { canvas:CANVAS, defaults:{} });
    if(d && d.limite)
      assert(!arte(Object.assign({}, dados, { produto:ABSURDO.slice(0, d.limite) })).result.invalid,
             'os ' + d.limite + ' primeiros caracteres prometidos não cabem');
  });

  test('27 · mesma entrada → mesmo resultado, byte a byte, na arte inteira', () => {
    const dados = Object.assign({}, AUTORAL, { produto:LONGO, titulo:'SEMANA DE OFERTAS IMPERDÍVEIS' });
    const a = arte(dados), b = arte(dados);
    const chapa = (r) => JSON.stringify(r.layers.map(l => [l.id, g4(l), l._tetoFonte || 0]));
    assert(chapa(a) === chapa(b), 'duas execuções idênticas divergiram');
    assert(JSON.stringify(a.result.campos) === JSON.stringify(b.result.campos),
           'o laudo por campo divergiu entre execuções');
  });

  test('28 · PRÉVIA = EXPORTAÇÃO: o mesmo estado alimenta os dois', async () => {
    /* Cenário que EXERCITA o encaixe (o produto encolhe) e ainda assim CABE — paridade só faz
       sentido quando os dois lados chegam a desenhar. */
    const dados = Object.assign({}, AUTORAL, { produto:LONGO });
    const pintar = async (purpose) => {
      const cv = document.createElement('canvas'); cv.width = CANVAS.w; cv.height = CANVAS.h;
      const out = await fRenderTemplateLayers(cv.getContext('2d'), ARTE(), CANVAS.w, CANVAS.h,
        dados, { color:'#FF9000' }, { layers:[], w:CANVAS.w, h:CANVAS.h, bg:'#fff' },
        { scope:'franqueado', purpose:purpose });
      return { out, png:cv.toDataURL('image/png') };
    };
    const p = await pintar('preview'), e = await pintar('export');
    assert(!p.out._layoutResult.invalid, 'o cenário escolhido bloqueia — ele precisa CABER para medir paridade');
    const chapa = (o) => JSON.stringify(o.filter(l => l && l.type === 'text')
      .map(l => [l.id, g4(l), l._tetoFonte || 0]));
    assert(chapa(p.out) === chapa(e.out), 'prévia e exportação resolveram geometrias diferentes');
    assert(p.png === e.png, 'prévia e exportação desenharam PNGs diferentes — o pior bug possível aqui');
  });

  test('29 · o custo é O(campos × degraus), não O(candidatos) — não existe busca escondida', () => {
    const real = window.gFitTextLayer;
    let chamadas = 0;
    window.gFitTextLayer = function(){ chamadas++; return real.apply(this, arguments); };
    try{
      arte(Object.assign({}, AUTORAL, { produto:ABSURDO }));
    }finally{ window.gFitTextLayer = real; }
    /* 4 campos dinâmicos. Com o pior caso descendo do corpo autorado ao piso em degraus de 8%,
       são ~35 medidas por campo, mais a base visual e o baseline. Uma beam search com 240
       candidatos e profundidade 8 passaria MUITO disto — é essa a diferença que se cobra. */
    assert(chamadas < 400, 'o encaixe fez ' + chamadas + ' medidas — isso tem cheiro de busca');
    assert(chamadas > 0, 'não mediu nada — o teste não exercitou o motor');
  });

  test('30 · ⛔ nenhum símbolo de Candidate Search, scoring ou rollout existe no runtime', () => {
    const removidos = ['gSearchLayoutCandidates','gSelectLayoutCandidate','gScoreComposition',
      'gApplyLayoutAction','gLayoutDesignerMoves','gCompileLayoutGrammar','gCompileCompositionGraph',
      'gCompileLayoutComponents','gLayoutElasticity','gLayoutImpactZones','gAdaptiveScaleGroups',
      'gLayoutOperationalCapability','gShadowValidationRecord','gLayoutEscolherAlternativa'];
    const vivos = removidos.filter(n => typeof window[n] === 'function');
    assert(!vivos.length, 'o Automatic Designer voltou: ' + vivos.join(', '));
  });

  /* ── Execução ─────────────────────────────────────────────────────────────────────── */
  let passed = 0;
  for(const item of cases){
    const li = document.createElement('li'); li.className = 'case';
    try{
      await item.fn(); passed++; li.classList.add('pass');
      li.innerHTML = '<strong>✓ ' + item.name + '</strong>';
    }catch(error){
      li.classList.add('fail');
      li.innerHTML = '<strong>✕ ' + item.name + '</strong><small>'
        + String(error && error.message || error) + '</small>';
      console.error('[local-fit]', item.name, error);
      falhas.push({ name:item.name, error:String(error && error.message || error) });
    }
    results.appendChild(li);
  }
  const failed = cases.length - passed;
  summary.textContent = passed + '/' + cases.length + ' casos passaram' + (failed ? ' · ' + failed + ' falharam' : '');
  document.title = (failed ? 'FALHOU' : 'OK') + ' — Local Fit (' + passed + '/' + cases.length + ')';
  window.__lumaTest = { passed:passed, total:cases.length, failures:falhas, perf:perfPilha };
})();
