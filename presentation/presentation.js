/* presentation/presentation.js — navegação e demos da apresentação oficial do Luma.
 *
 * Isolado de propósito: não carrega nenhum script do app, não fala com Supabase, IA, upload nem
 * rede. As "demos" são encenações determinísticas feitas com quadros que o próprio motor de render
 * do Luma gerou (assets/artes) e com telas reais capturadas (captures/). Parece vivo e não quebra.
 *
 * Teclas: → ↓ espaço PgDn Enter avançam · ← ↑ PgUp Backspace voltam · Home/End · F tela cheia
 *         G índice · H esconde número e barra · Esc fecha o índice.
 */
(function () {
  'use strict';

  const stage = document.getElementById('stage');
  const slides = Array.from(stage.querySelectorAll('.slide'));
  const principais = slides.filter(s => !s.hasAttribute('data-apx'));
  const barra = stage.querySelector('.chrome-progress > i');
  const numero = stage.querySelector('.chrome-num');
  const indice = document.querySelector('.index');
  const reduzido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let atual = -1, passo = 0;
  let timers = [];
  const agenda = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const limpaTimers = () => { timers.forEach(clearTimeout); timers = []; };

  /* ── Escala: o palco é sempre 1920×1080 e cabe inteiro em qualquer janela ──────────────── */
  let escala = 1;
  function ajustaEscala() {
    escala = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.setProperty('--s', escala);
  }
  window.addEventListener('resize', ajustaEscala);
  ajustaEscala();

  /* ── Recortes: data-crop="x,y,w,h" em px naturais da captura; a imagem cobre a caixa ──── */
  function recorta(el) {
    const img = el.querySelector('img');
    if (!img) return;
    const fazer = () => {
      const [x, y, w, h] = el.dataset.crop.split(',').map(Number);
      const bw = el.offsetWidth, bh = el.offsetHeight;
      if (!bw || !bh || !img.naturalWidth) return;
      const k = Math.max(bw / w, bh / h);
      const ox = (bw - w * k) / 2 - x * k, oy = (bh - h * k) / 2 - y * k;
      img.style.width = (img.naturalWidth * k) + 'px';
      img.style.height = 'auto';
      img.style.left = ox + 'px';
      img.style.top = oy + 'px';
      el._k = k; el._ox = ox; el._oy = oy;
    };
    if (img.complete && img.naturalWidth) fazer(); else img.addEventListener('load', fazer, { once: true });
  }
  stage.querySelectorAll('.crop[data-crop]').forEach(recorta);

  /* ── Quantos passos cada slide tem ─────────────────────────────────────────────────────── */
  const DEMO_PASSOS = { chat: 5, pub: 1, copy: 3 };
  function passosDe(s) {
    let n = 0;
    s.querySelectorAll('[data-step]').forEach(e => { n = Math.max(n, Number(e.dataset.step) || 0); });
    const d = s.dataset.demo;
    if (d && DEMO_PASSOS[d]) n = Math.max(n, DEMO_PASSOS[d]);
    return n;
  }

  /* ── Mostrar slide / passo ─────────────────────────────────────────────────────────────── */
  function aplicaPasso(s, p, animar) {
    s.querySelectorAll('[data-step]').forEach(e => e.classList.toggle('is-on', (Number(e.dataset.step) || 0) <= p));
    const d = s.dataset.demo;
    if (d && DEMOS[d]) DEMOS[d].passo(s, p, animar && !reduzido);
  }

  function vai(i, p, origem) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    const antes = atual;
    limpaTimers();
    if (antes >= 0 && antes !== i) {
      const velho = slides[antes];
      if (velho.dataset.demo && DEMOS[velho.dataset.demo] && DEMOS[velho.dataset.demo].sai) DEMOS[velho.dataset.demo].sai(velho);
    }
    slides.forEach((s, k) => {
      s.classList.toggle('is-active', k === i);
      s.classList.toggle('is-past', k < i);
      s.setAttribute('aria-hidden', k === i ? 'false' : 'true');
    });
    atual = i;
    const s = slides[i];
    passo = (p === 'fim') ? passosDe(s) : (p || 0);
    document.body.style.setProperty('--edge', s.dataset.edge || '#0A0A0A');
    const d = s.dataset.demo;
    if (antes !== i && d && DEMOS[d] && DEMOS[d].entra) DEMOS[d].entra(s, passo);
    aplicaPasso(s, passo, false);
    atualizaCromo();
    if (origem !== 'hash') {
      const alvo = '#' + (i + 1);
      if (location.hash !== alvo) history.replaceState(null, '', alvo);
    }
  }

  function avancar() {
    const s = slides[atual];
    if (passo < passosDe(s)) { passo++; aplicaPasso(s, passo, true); return; }
    if (atual < slides.length - 1) vai(atual + 1, 0);
  }
  function voltar() {
    const s = slides[atual];
    if (passo > 0) { passo--; limpaTimers(); aplicaPasso(s, passo, false); return; }
    if (atual > 0) vai(atual - 1, 'fim');
  }

  function atualizaCromo() {
    const s = slides[atual];
    const ip = principais.indexOf(s);
    if (ip >= 0) {
      barra.style.width = ((ip + 1) / principais.length * 100) + '%';
      numero.textContent = String(ip + 1).padStart(2, '0') + ' / ' + String(principais.length).padStart(2, '0');
    } else {
      barra.style.width = '100%';
      numero.textContent = 'Apêndice' + (s.dataset.title && s.dataset.title !== 'Apêndice' ? ' · ' + s.dataset.title.split(' · ')[0] : '');
    }
    document.body.classList.toggle('t-orange-edge', s.classList.contains('t-orange'));
    indice.querySelectorAll('button[data-i]').forEach(b => b.classList.toggle('is-cur', Number(b.dataset.i) === atual));
  }

  /* ── Hash: #7 abre o slide 7; #apx-c abre um apêndice pelo id ─────────────────────────── */
  function lerHash() {
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    if (!h) return 0;
    if (/^\d+$/.test(h)) return Math.max(0, Number(h) - 1);
    const k = slides.findIndex(s => s.id === h);
    return k >= 0 ? k : 0;
  }
  window.addEventListener('hashchange', () => { const i = lerHash(); if (i !== atual) vai(i, 0, 'hash'); });

  /* ── Índice ────────────────────────────────────────────────────────────────────────────── */
  function montaIndice() {
    const main = indice.querySelector('[data-list="main"]');
    const apx = indice.querySelector('[data-list="apx"]');
    slides.forEach((s, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.i = i;
      const ip = principais.indexOf(s);
      const n = document.createElement('b'); n.textContent = ip >= 0 ? String(ip + 1).padStart(2, '0') : '·';
      const t = document.createElement('span'); t.textContent = s.dataset.title || ('Slide ' + (i + 1));
      b.append(n, t);
      b.addEventListener('click', () => { fechaIndice(); vai(i, 0); });
      li.appendChild(b);
      (ip >= 0 ? main : apx).appendChild(li);
    });
  }
  function abreIndice() { indice.classList.add('is-open'); const c = indice.querySelector('button.is-cur') || indice.querySelector('button'); if (c) c.focus(); }
  function fechaIndice() { indice.classList.remove('is-open'); }
  montaIndice();

  /* ── Tela cheia ────────────────────────────────────────────────────────────────────────── */
  function telaCheia() {
    if (!document.fullscreenElement) { const r = document.documentElement.requestFullscreen; if (r) r.call(document.documentElement).catch(() => {}); }
    else if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
  }

  /* ── Entradas: teclado, clique, toque ──────────────────────────────────────────────────── */
  document.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (indice.classList.contains('is-open')) {
      if (e.key === 'Escape' || e.key === 'g' || e.key === 'G') { e.preventDefault(); fechaIndice(); }
      return;
    }
    const k = e.key;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n', 'N'].includes(k)) { e.preventDefault(); avancar(); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p', 'P'].includes(k)) { e.preventDefault(); voltar(); }
    else if (k === 'Home') { e.preventDefault(); vai(0, 0); }
    else if (k === 'End') { e.preventDefault(); vai(principais.length - 1, 'fim'); }
    else if (k === 'f' || k === 'F') { e.preventDefault(); telaCheia(); }
    else if (k === 'g' || k === 'G') { e.preventDefault(); abreIndice(); }
    else if (k === 'h' || k === 'H') { e.preventDefault(); document.body.classList.toggle('clean'); }
  });

  stage.addEventListener('click', e => {
    const go = e.target.closest('[data-go]');
    if (go) { const k = slides.findIndex(s => s.id === go.dataset.go); if (k >= 0) vai(k, 0); return; }
    if (e.target.closest('button, a, input, .index')) return;
    if (e.shiftKey) voltar(); else avancar();
  });
  document.querySelector('.chrome-nav').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    e.stopPropagation();
    ({ prev: voltar, next: avancar, index: abreIndice, full: telaCheia })[b.dataset.act]();
  });
  indice.addEventListener('click', e => { if (e.target === indice) fechaIndice(); });

  let toqueX = null, toqueY = null;
  document.addEventListener('touchstart', e => { const t = e.touches[0]; toqueX = t.clientX; toqueY = t.clientY; }, { passive: true });
  document.addEventListener('touchend', e => {
    if (toqueX === null) return;
    const t = e.changedTouches[0], dx = t.clientX - toqueX, dy = t.clientY - toqueY;
    toqueX = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) avancar(); else voltar(); }
  }, { passive: true });

  // Cursor e botões somem quando o apresentador para de mexer o mouse
  let ocioso = null;
  document.addEventListener('mousemove', () => {
    document.body.classList.add('show-nav'); document.body.classList.remove('is-idle');
    clearTimeout(ocioso);
    ocioso = setTimeout(() => { document.body.classList.remove('show-nav'); document.body.classList.add('is-idle'); }, 2200);
  });

  /* ══ DEMOS ══════════════════════════════════════════════════════════════════════════════ */

  // Posição (em px do palco) de uma região natural de uma captura recortada
  function regiaoNoPalco(cropEl, x, y, w, h) {
    const r = cropEl.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    const bx = (r.left - sr.left) / escala, by = (r.top - sr.top) / escala;
    const k = cropEl._k || 1;
    return { left: bx + (cropEl._ox || 0) + x * k, top: by + (cropEl._oy || 0) + y * k, width: w * k, height: h * k };
  }

  const DEMOS = {
    /* 06 · a arte sai do Estúdio e aparece no catálogo do franqueado */
    pub: {
      entra(s) { s.classList.remove('fase-2'); const f = s.querySelector('.flyer'); f.style.opacity = 0; },
      passo(s, p, animar) {
        const f = s.querySelector('.flyer');
        if (p < 1) { s.classList.remove('fase-2'); f.style.opacity = 0; return; }
        s.classList.add('fase-2');
        if (!animar) { f.style.opacity = 0; return; }
        const de = s.querySelector('[data-flyer-from]'), para = s.querySelector('[data-flyer-to]');
        const a = regiaoNoPalco(de, ...de.dataset.flyerFrom.split(',').map(Number));
        const b = regiaoNoPalco(para, ...para.dataset.flyerTo.split(',').map(Number));
        f.style.transition = 'none';
        Object.assign(f.style, { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px', opacity: 1 });
        void f.offsetWidth;
        f.style.transition = '';
        agenda(() => Object.assign(f.style, { left: b.left + 'px', top: b.top + 'px', width: b.width + 'px', height: b.height + 'px' }), 380);
        agenda(() => { f.style.opacity = 0; }, 1500);
      },
      sai(s) { s.classList.remove('fase-2'); }
    },

    /* 07 · o franqueado responde, a prévia se monta (quadros do motor real) */
    chat: {
      roteiro: [
        { kicker: 'Foto do produto', q: 'Envie a foto do produto', sub: 'Use nas ofertas de preço reduzido. Foto do produto de frente, em fundo limpo.', ph: 'Escolher imagem', resposta: null, arte: 1 },
        { kicker: 'Produto', q: 'Qual produto você quer anunciar?', sub: '', chips: ['X-Burguer', 'Combo Frango', 'Pizza calabresa', 'Açaí 500ml'], ph: 'Ex: X-Burger Duplo', resposta: 'Smash Bacon Duplo', arte: 2 },
        { kicker: 'Preço original', q: 'Qual era o preço original?', sub: '', ph: 'R$ 0,00', resposta: 'R$ 34,90', arte: 3 },
        { kicker: 'Preço promocional', q: 'E qual será o preço promocional?', sub: 'O preço original é De: R$ 34,90.', ph: 'R$ 0,00', resposta: 'R$ 27,90', arte: 4 },
        { kicker: 'Validade', q: 'Até quando vale essa oferta?', sub: '', chips: ['Só hoje', 'Só neste fim de semana', 'Enquanto durar o estoque'], ph: 'Ex: Só hoje', resposta: 'Só neste fim de semana', arte: 5 }
      ],
      el(s) {
        if (s._c) return s._c;
        const q = s.querySelector('.q');
        s._c = {
          q, kicker: q.querySelector('.kicker'), qt: q.querySelector('.qt'), sub: q.querySelector('.sub'),
          chips: q.querySelector('.chips'), photo: q.querySelector('.photo'), pt: q.querySelector('.pt'), pb: q.querySelector('.prog b'),
          answer: s.querySelector('.answer'), txt: s.querySelector('.answer .txt'), done: s.querySelector('.done'),
          a1: s.querySelector('.artcard .a1'), a2: s.querySelector('.artcard .a2'), flash: s.querySelector('.artcard .flash')
        };
        return s._c;
      },
      arte(s, n, animar) {
        const c = this.el(s), src = 'assets/artes/chat-passo-' + n + '.webp';
        const frente = c.a2.classList.contains('is-back') ? c.a1 : c.a2;
        const tras = frente === c.a1 ? c.a2 : c.a1;
        if (frente.getAttribute('src') === src) return;
        if (!animar) { frente.src = src; tras.src = src; return; }
        tras.src = src;
        const troca = () => { tras.classList.remove('is-back'); frente.classList.add('is-back'); };
        if (tras.complete) troca(); else tras.addEventListener('load', troca, { once: true });
      },
      pergunta(s, i) {
        const c = this.el(s), r = this.roteiro[i];
        c.kicker.textContent = r.kicker; c.qt.textContent = r.q;
        c.sub.textContent = r.sub || ''; c.sub.hidden = !r.sub;
        c.chips.innerHTML = '';
        (r.chips || []).forEach(t => { const e = document.createElement('span'); e.textContent = t; c.chips.appendChild(e); });
        c.photo.hidden = true;
        c.pt.textContent = i + ' de 5 informações';
        c.pb.style.width = (i / 5 * 100) + '%';
        c.txt.textContent = r.ph; c.txt.className = 'txt ph';
        c.answer.style.display = '';
      },
      // estado final de um passo, sem animação (para voltar e para abrir o slide pelo meio)
      estado(s, p) {
        const c = this.el(s);
        c.done.classList.toggle('is-on', p >= 5);
        c.q.classList.toggle('is-out', p >= 5);
        if (p >= 5) { c.answer.style.display = 'none'; c.pt.textContent = '5 de 5 informações'; c.pb.style.width = '100%'; this.arte(s, 5, false); return; }
        this.pergunta(s, p);
        this.arte(s, p === 0 ? 1 : this.roteiro[p - 1].arte, false);
      },
      entra(s, p) { this.estado(s, p); },
      passo(s, p, animar) {
        if (!animar) { this.estado(s, p); return; }
        const c = this.el(s), anterior = this.roteiro[p - 1];
        const conclui = () => {
          this.arte(s, anterior.arte, true);
          if (p === 1) { c.flash.classList.remove('go'); void c.flash.offsetWidth; c.flash.classList.add('go'); }
          agenda(() => {
            if (p >= 5) { c.q.classList.add('is-out'); c.answer.style.display = 'none'; c.pt.textContent = '5 de 5 informações'; c.pb.style.width = '100%'; c.done.classList.add('is-on'); return; }
            c.q.classList.add('is-out');
            agenda(() => { this.pergunta(s, p); c.q.classList.remove('is-out'); }, 340);
          }, 720);
        };
        if (!anterior.resposta) {                       // passo da foto: a imagem chega pronta
          c.photo.hidden = false; c.txt.textContent = 'Usar esta imagem'; c.txt.className = 'txt';
          agenda(conclui, 650);
          return;
        }
        // digitação: um caractere por vez, com o cursor piscando no fim
        const alvo = anterior.resposta; let n = 0;
        c.txt.className = 'txt'; c.txt.textContent = '';
        const cursor = document.createElement('span'); cursor.className = 'caret';
        const tecla = () => {
          n++; c.txt.textContent = alvo.slice(0, n); c.txt.appendChild(cursor);
          if (n < alvo.length) agenda(tecla, 38 + Math.random() * 38); else agenda(conclui, 420);
        };
        agenda(tecla, 180);
      },
      sai() {}
    },

    /* 08 · a legenda: os rolos giram e o cartão mostra o que o motor escreveu. As quatro legendas
       são saídas reais do fBuildCopy (js/franqueado/png-generator.js) com sorteio semeado: as 3
       opções de uma arte (Promo, Engajar, WhatsApp) e a Promo da arte seguinte, que não repete
       nenhuma frase da anterior. O índice aponta a frase sorteada em cada rolo do HTML. */
    copy: {
      seq: [
        { i: 1, aba: 'PROMO · OPÇÃO 1 DE 3', bancos: ['todo cardápio', 'com desconto', 'pedido'], tags: '#delivery #pecaagora #hamburguer #lanche #smashburger' },
        { i: 3, aba: 'ENGAJAR · OPÇÃO 2 DE 3', bancos: ['lanches', 'com desconto', 'conversa'], tags: '#deliverymuch #pediu #lanche #smashburger #burger' },
        { i: 4, aba: 'WHATSAPP · OPÇÃO 3 DE 3', bancos: ['lanches', 'com desconto', 'WhatsApp'], tags: '' },
        { i: 6, aba: 'PROMO · A ARTE SEGUINTE', bancos: ['todo cardápio', 'com desconto', 'pedido'], tags: '#matoufome #pecaagora #lanche #burger #burgerlovers' }
      ],
      validade: 'Válido só neste fim de semana.',
      rolos(s, r) {
        return Array.from(s.querySelectorAll('.reel')).map((rolo, k) => {
          const ol = rolo.querySelector('ol'), itens = Array.from(ol.children);
          ol.style.transform = 'translateY(' + (-(r.i - 1) * 36) + 'px)';
          itens.forEach((li, j) => li.classList.toggle('is-cur', j === r.i));
          rolo.querySelector('.banco').textContent = r.bancos[k];
          return itens[r.i].textContent;
        });
      },
      cartao(s, r, pecas) {
        s.querySelector('.leg .aba').textContent = r.aba;
        const txt = s.querySelector('.leg .txt');
        txt.textContent = '';
        const par = (t, cls) => { const e = document.createElement('p'); e.textContent = t; if (cls) e.className = cls; txt.appendChild(e); };
        par(pecas[0]);
        const corpo = document.createElement('p');
        corpo.append(pecas[1], document.createElement('br'), this.validade);
        txt.appendChild(corpo);
        par(pecas[2]);
        if (r.tags) par(r.tags, 'tags');
      },
      estado(s, p) {
        s.classList.add('sem-anim');
        const r = this.seq[Math.min(p, this.seq.length - 1)];
        this.cartao(s, r, this.rolos(s, r));
        s.querySelector('.leg .txt').classList.remove('is-out');
        void s.offsetWidth;
        s.classList.remove('sem-anim');
      },
      entra(s, p) { this.estado(s, p); },
      passo(s, p, animar) {
        if (!animar) { this.estado(s, p); return; }
        const r = this.seq[Math.min(p, this.seq.length - 1)];
        const outra = s.querySelector('.leg .outra'), txt = s.querySelector('.leg .txt');
        outra.classList.remove('go'); void outra.offsetWidth; outra.classList.add('go');
        txt.classList.add('is-out');
        const pecas = this.rolos(s, r);
        agenda(() => { this.cartao(s, r, pecas); txt.classList.remove('is-out'); }, 700);
      },
      sai() {}
    },

    /* 10 · as artes do lote entram uma a uma */
    wall: {
      entra(s) {
        const itens = Array.from(s.querySelectorAll('.wall .a')), cont = s.querySelector('.count .c');
        itens.forEach(e => e.classList.remove('is-on')); cont.textContent = '0';
        if (reduzido) { itens.forEach(e => e.classList.add('is-on')); cont.textContent = String(itens.length); return; }
        itens.forEach((e, k) => agenda(() => { e.classList.add('is-on'); cont.textContent = String(k + 1); }, 420 + k * 110));
      },
      passo() {},
      sai(s) { s.querySelectorAll('.wall .a').forEach(e => e.classList.add('is-on')); }
    }
  };

  /* ── Início ────────────────────────────────────────────────────────────────────────────── */
  vai(lerHash(), 0, 'hash');
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => stage.querySelectorAll('.crop[data-crop]').forEach(recorta));
})();
