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
                 .repeat(2);

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

  test('7b · texto de PONTO não vira caixa: não quebra, só encolhe', () => {
    const l = ponto();
    const box = gAuthoredTextBox(l, { canvas:CANVAS });
    assert(box.quebravel === false, 'texto de ponto não é quebrável no escopo local');
    const r = gFitTextToAuthoredBox(l, 'OFERTA RELÂMPAGO DE ANIVERSÁRIO', { canvas:CANVAS });
    assert(r.lines.length === 1, 'texto de ponto não pode ganhar linha, veio ' + r.lines.length);
    assert(r.changed === true || r.status === 'fits', 'ou coube, ou encolheu — nada além disso');
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
      const prova = Object.assign({}, box.camada, { fontSize:r.fontSize });
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

  /* ── Bordas do contrato ───────────────────────────────────────────────────────────── */
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
  window.__lumaTest = { passed:passed, total:cases.length, failures:falhas };
})();
