// docs/luma-evolution/scripts/cenas.js — o que fotografar em cada versão.
//
// Uma CENA é uma tela num estado específico. Cada uma sabe chegar até si mesma e devolve
// `true` só quando a tela realmente apareceu. Versão antiga que não tem aquela tela
// devolve `false`, e isso também é evidência: mostra QUANDO a tela passou a existir.
//
// ⛔ Nenhuma cena inventa dado. O que aparece no print é o conteúdo de exemplo do próprio
// commit, renderizado offline. Ver docs/luma-evolution/README.md.
//
// Os seletores têm alternativas separadas por vírgula de propósito: o mesmo painel mudou
// de id/classe ao longo das versões, e a cena precisa reconhecer as duas formas pra não
// reportar "não existia" quando na verdade só mudou de nome.

const espera = (p, ms) => p.waitForTimeout(ms);

// Existe e está visível de verdade? Testa TODOS os candidatos da lista, não só o primeiro:
// `querySelector('a, b')` devolve quem aparece antes no DOM, e um contêiner de 0×0 nessa
// posição mascarava o elemento visível logo abaixo. (Aconteceu: a campanha no celular
// reportava "não existe" porque #camp-main, zerado, vinha antes de .f-mat-card.)
const visivel = (p, sel) => p.evaluate(s => [...document.querySelectorAll(s)].some(e => {
  const c = getComputedStyle(e), r = e.getBoundingClientRect();
  return c.display !== 'none' && c.visibility !== 'hidden' && r.width > 40 && r.height > 40;
}), sel);

// Chama uma função global só se ela existir nesta versão (as antigas têm menos).
const chamar = (p, expr) => p.evaluate(e => {
  try { return !!eval(e); } catch (err) { return false; }
}, expr);

const CENAS = [
  {
    id: 'home', titulo: 'Vitrine do franqueado', area: 'Franqueado', viewport: [1440, 1000],
    async montar(p) { await espera(p, 1200); return visivel(p, '.fh-hero, #fh-body, .camp-grid, #f-home'); }
  },
  {
    id: 'catalogo', titulo: 'Campanha aberta — materiais', area: 'Franqueado', viewport: [1440, 1000],
    async montar(p) {
      const ok = await p.evaluate(() => {
        const c = document.querySelector('.camp-card[role="button"], .camp-card[onclick]');
        if (!c) return false; c.click(); return true;
      });
      if (!ok) return false;
      await espera(p, 3000);
      return visivel(p, '.f-mat-card, .f-mat-content, #camp-main, .f-mat-breadcrumb');
    }
  },
  {
    id: 'chat', titulo: 'Chat que monta a arte', area: 'Franqueado', viewport: [1440, 1000],
    async montar(p) {
      // Caminho longo: campanha → material → chat. Cada passo é tolerante porque as
      // versões antigas caíam direto no chat, sem a etapa de catálogo no meio.
      //
      // E quando caem, NÃO se navega. No primeiro commit (936c6d3) o chat já está montado
      // no boot; clicar na campanha levava pro catálogo de materiais e derrubava o chat que
      // já estava na tela — a cena então reportava "tela não existe nesta versão" para uma
      // tela que existe e estava visível desde o começo. Quem já chegou, chegou.
      if (await visivel(p, '#f-messages, #f-msg-box, #f-chat, .chat-msg')) return true;
      await p.evaluate(() => { const c = document.querySelector('.camp-card[role="button"], .camp-card[onclick]'); if (c) c.click(); });
      await espera(p, 2200);
      await p.evaluate(() => {
        const alvo = document.querySelector('.f-mat-card, .f-mat-action')
          || [...document.querySelectorAll('button, a')].find(e => /personalizar|come[çc]ar|criar arte/i.test(e.textContent || ''));
        if (alvo) alvo.click();
      });
      await espera(p, 3000);
      return visivel(p, '#f-messages, #f-msg-box, #f-chat, .chat-msg');
    }
  },
  {
    id: 'minhas-artes', titulo: 'Minhas artes — histórico', area: 'Franqueado', viewport: [1440, 1000],
    async montar(p) {
      // As abas do rail só existem DENTRO da campanha; na vitrine o caminho é o botão
      // "Minhas artes" do cabeçalho.
      const ok = await chamar(p, `(typeof fHomeOpenHist==='function' && (fHomeOpenHist(),true))
        || (typeof fSwitchTab==='function' && (fSwitchTab('historico', document.querySelectorAll('.f-tab')[1]),true))`);
      if (!ok) return false;
      await espera(p, 2500);
      return visivel(p, '#f-history-shell, #f-hist-tab, .f-hist, .fh-draft');
    }
  },
  {
    id: 'designer', titulo: 'Estúdio — a casa do designer', area: 'Designer', viewport: [1440, 1000],
    async montar(p) {
      const ok = await chamar(p, `(typeof setMode==='function') && (setMode('designer'),true)`);
      if (!ok) return false;
      await espera(p, 3500);
      return visivel(p, '#d-studio-home, #d-canvas-wrapper, #d-main, #d-center');
    }
  },
  {
    id: 'exportar', titulo: 'Exportar arte', area: 'Designer', viewport: [1440, 1000],
    async montar(p) {
      await chamar(p, `(typeof setMode==='function') && (setMode('designer'),true)`);
      await espera(p, 3500);
      const ok = await chamar(p, `(typeof dOpenExportModal==='function' && (dOpenExportModal(),true))
        || (typeof dOpenExport==='function' && (dOpenExport(),true))`);
      if (!ok) return false;
      await espera(p, 1500);
      return visivel(p, '#d-export-modal');
    }
  },
  {
    id: 'cli', titulo: 'Luma CLI — console do time', area: 'Interno', viewport: [1440, 1000],
    async montar(p) {
      const ok = await chamar(p, `(typeof gCliOpen==='function') && (gCliOpen(),true)`);
      if (!ok) return false;
      await espera(p, 2000);
      return visivel(p, '#luma-cli.open, #luma-cli');
    }
  },
  {
    id: 'muchplus', titulo: 'Much+ — o tema por campanha', area: 'Franqueado', viewport: [1440, 1000],
    async montar(p) {
      // A campanha Much+ re-tokeniza o app enquanto o franqueado está dentro dela. Procura
      // pelo nome porque a posição na vitrine muda conforme o que o time publicou.
      const ok = await p.evaluate(() => {
        const alvo = [...document.querySelectorAll('.camp-card, .fh-hero, [class*="camp-card"]')]
          .find(e => /much\s*\+/i.test(e.textContent || ''));
        if (!alvo) return false;
        (alvo.querySelector('[onclick], button, a') || alvo).click();
        return true;
      });
      if (!ok) return false;
      await espera(p, 3500);
      return visivel(p, '.f-mat-card, .f-mat-content, #camp-main');
    }
  },
  {
    id: 'login', titulo: 'Entrada — a porta do produto', area: 'Acesso', viewport: [1440, 1000],
    // Única cena servida SEM a sessão de demonstração (?semdemo=1). Com ela, o boot
    // substitui o login antes de qualquer print.
    semSessao: true,
    async montar(p) { await espera(p, 1500); return visivel(p, '#g-login-screen'); }
  },
  {
    id: 'perfil', titulo: 'Perfil do usuário', area: 'Núcleo', viewport: [1440, 1000],
    async montar(p) {
      const ok = await chamar(p, `(typeof gOpenUserProfileModal==='function') && (gOpenUserProfileModal(),true)`);
      if (!ok) return false;
      await espera(p, 2000);
      return visivel(p, '#g-profile-modal');
    }
  },
  {
    id: 'ajuda', titulo: 'Central de ajuda', area: 'Suporte', viewport: [1440, 1000],
    async montar(p) {
      // Chamada direta em vez do helper `chamar`: aqui o eval indireto não estava
      // encontrando a função, e o widget mudou de nome (hoje é #luma-widget-modal).
      const abriu = await p.evaluate(() => {
        for (const f of ['gFraHelpOpen', 'gOpenHelp', 'gHelpOpen']) {
          if (typeof window[f] === 'function') { try { window[f](); return f; } catch (e) {} }
        }
        const fab = document.querySelector('#luma-widget-fab-trigger, #luma-widget-fab-pill, #fhw-fab');
        if (fab) { fab.click(); return 'fab'; }
        return null;
      });
      if (!abriu) return false;
      await espera(p, 3000);
      return visivel(p, '#luma-widget-modal, #fhw, #g-help-modal, .help-modal');
    }
  },
  {
    id: 'novo-material', titulo: 'Criar material do zero', area: 'Designer', viewport: [1440, 1000],
    async montar(p) {
      await chamar(p, `(typeof setMode==='function') && (setMode('designer'),true)`);
      await espera(p, 3500);
      const ok = await chamar(p, `(typeof dNewDocOpen==='function' && (dNewDocOpen(),true))
        || (typeof dOpenNewTemplate==='function' && (dOpenNewTemplate(),true))`);
      if (!ok) return false;
      await espera(p, 2000);
      return visivel(p, '#d-newdoc-modal');
    }
  },
  {
    id: 'psd', titulo: 'Importar PSD do Photoshop', area: 'Designer', viewport: [1440, 1000],
    async montar(p) {
      await chamar(p, `(typeof setMode==='function') && (setMode('designer'),true)`);
      await espera(p, 3500);
      const ok = await p.evaluate(() => {
        const m = document.getElementById('d-psd-modal');
        if (!m) return false;
        m.classList.add('open');   // .modal-overlay abre por classe; abrir pelo fluxo
        return true;               // exigiria um arquivo .psd real no upload
      });
      if (!ok) return false;
      await espera(p, 1500);
      return visivel(p, '#d-psd-modal');
    }
  },
  {
    id: 'atalhos', titulo: 'Atalhos do Estúdio', area: 'Designer', viewport: [1440, 1000],
    async montar(p) {
      await chamar(p, `(typeof setMode==='function') && (setMode('designer'),true)`);
      await espera(p, 3500);
      const ok = await chamar(p, `(typeof dOpenCheat==='function') && (dOpenCheat(),true)`);
      if (!ok) return false;
      await espera(p, 1500);
      return visivel(p, '#d-cheat-modal');
    }
  },
  {
    id: 'catalogo-mobile', titulo: 'Campanha aberta no celular', area: 'Franqueado', viewport: [390, 844],
    async montar(p) {
      const ok = await p.evaluate(() => {
        const c = document.querySelector('.camp-card[onclick], .camp-card[role="button"], .camp-card');
        if (!c) return false;
        c.scrollIntoView({ block: 'center' });
        c.click();
        return true;
      });
      if (!ok) return false;
      await espera(p, 3200);
      return visivel(p, '.f-mat-card, .f-mat-content, #camp-main, .f-mat-breadcrumb');
    }
  },
  {
    id: 'chat-mobile', titulo: 'O chat no celular', area: 'Franqueado', viewport: [390, 844],
    async montar(p) {
      // Mesma armadilha da cena 'chat': versão antiga que já nasce no chat não deve ser
      // navegada, senão a navegação desmonta o que se queria fotografar.
      if (await visivel(p, '#f-messages, #f-msg-box, .chat-msg')) return true;
      await p.evaluate(() => {
        const c = document.querySelector('.camp-card[onclick], .camp-card[role="button"], .camp-card');
        if (c) { c.scrollIntoView({ block: 'center' }); c.click(); }
      });
      await espera(p, 2600);
      await p.evaluate(() => {
        const a = document.querySelector('.f-mat-card, .f-mat-action')
          || [...document.querySelectorAll('button, a')].find(e => /personalizar|come[çc]ar/i.test(e.textContent || ''));
        if (a) { a.scrollIntoView({ block: 'center' }); a.click(); }
      });
      await espera(p, 3000);
      return visivel(p, '#f-messages, #f-msg-box, .chat-msg');
    }
  },
  {
    id: 'home-mobile', titulo: 'Vitrine no celular', area: 'Franqueado', viewport: [390, 844],
    async montar(p) { await espera(p, 1500); return visivel(p, '.fh-hero, #fh-body, .camp-grid, #f-rail, #f-home'); }
  }
];

module.exports = { CENAS };
