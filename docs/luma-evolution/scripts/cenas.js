// docs/luma-evolution/scripts/cenas.js — o que capturar em cada versão.
//
// Uma CENA é uma tela num estado específico. Cada uma sabe se chegar até si mesma e
// devolve `true` se conseguiu. Versão antiga que não tem aquela tela devolve `false` e
// a captura é registrada como ausente — que também é evidência: mostra QUANDO a tela
// passou a existir.
//
// ⛔ Nenhuma cena inventa dado. Tudo que aparece nos prints é o conteúdo de exemplo do
// próprio commit, renderizado offline. Ver docs/luma-evolution/README.md.

const espera = (p, ms) => p.waitForTimeout(ms);

// Existe e está visível?
const visivel = (p, sel) => p.evaluate(s => {
  const e = document.querySelector(s);
  if (!e) return false;
  const c = getComputedStyle(e), r = e.getBoundingClientRect();
  return c.display !== 'none' && c.visibility !== 'hidden' && r.width > 40 && r.height > 40;
}, sel);

// Chama uma função global se ela existir naquela versão (as antigas têm menos).
const chamar = (p, expr) => p.evaluate(e => {
  try { return !!eval(e); } catch (err) { return false; }
}, expr);

const CENAS = [
  {
    id: 'login', titulo: 'Entrada', area: 'Acesso', viewport: [1440, 1000],
    // Única cena que roda SEM o atalho de sessão: é a tela que o usuário real vê primeiro.
    semSessao: true,
    async montar(p) { await espera(p, 4000); return visivel(p, '#g-login-screen'); }
  },
  {
    id: 'home', titulo: 'Vitrine do franqueado', area: 'Franqueado', viewport: [1440, 1000],
    async montar(p) { await espera(p, 1500); return visivel(p, '.fh-hero, #fh-body, .camp-grid'); }
  },
  {
    id: 'catalogo', titulo: 'Campanha aberta — materiais', area: 'Franqueado', viewport: [1440, 1000],
    async montar(p) {
      const ok = await p.evaluate(() => {
        const c = document.querySelector('.camp-card[role="button"], .camp-card[onclick]');
        if (!c) return false; c.click(); return true;
      });
      if (!ok) return false;
      await espera(p, 3500);
      return visivel(p, '.f-mat-card, .f-mat-content, #f-messages, #camp-main, .f-mat-breadcrumb');
    }
  },
  {
    id: 'chat', titulo: 'Chat que monta a arte', area: 'Franqueado', viewport: [1440, 1000],
    async montar(p) {
      // Caminho longo: campanha → primeiro material → chat. Cada passo é opcional porque
      // as versões antigas caíam direto no chat, sem a etapa de catálogo.
      await p.evaluate(() => { const c = document.querySelector('.camp-card[role="button"], .camp-card[onclick]'); if (c) c.click(); });
      await espera(p, 2500);
      await p.evaluate(() => {
        const alvo = document.querySelector('.f-mat-card, .f-mat-action')
          || [...document.querySelectorAll('button, a')].find(e => /personalizar|come[çc]ar|criar arte/i.test(e.textContent || ''));
        if (alvo) alvo.click();
      });
      await espera(p, 3500);
      return visivel(p, '#f-messages, #f-msg-box, #f-chat, .chat-msg');
    }
  },
  {
    id: 'minhas-artes', titulo: 'Minhas artes — histórico', area: 'Franqueado', viewport: [1440, 1000],
    async montar(p) {
      const ok = await chamar(p, `(typeof fHomeOpenHist==='function' && (fHomeOpenHist(),true)) || (typeof fSwitchTab==='function' && (fSwitchTab('historico', document.querySelectorAll('.f-tab')[1]),true))`);
      if (!ok) return false;
      await espera(p, 3000);
      return visivel(p, '#f-history-shell, #f-hist-tab, .f-hist, .fh-draft');
    }
  },
  {
    id: 'designer', titulo: 'Estúdio — a casa do designer', area: 'Designer', viewport: [1440, 1000],
    async montar(p) {
      const ok = await chamar(p, `(typeof setMode==='function') && (setMode('designer'),true)`);
      if (!ok) return false;
      await espera(p, 4000);
      return visivel(p, '#d-studio-home, #d-canvas-wrapper, #d-main, #d-center');
    }
  },
  {
    id: 'designer-canvas', titulo: 'Estúdio — template aberto no canvas', area: 'Designer', viewport: [1440, 1000],
    async montar(p) {
      const ok = await chamar(p, `(typeof setMode==='function') && (setMode('designer'),true)`);
      if (!ok) return false;
      await espera(p, 4000);
      // Abre o primeiro template da home do Estúdio: sem isso não há canvas nem camadas.
      await p.evaluate(() => { const t = document.querySelector('.dc-tmpl-main, .dc-tmpl'); if (t) t.click(); });
      await espera(p, 5000);
      await p.evaluate(() => { const l = document.querySelector('.layer-row'); if (l) l.click(); });
      await espera(p, 1500);
      return visivel(p, '#d-canvas-wrapper, #d-canvas-container, #d-layers-list');
    }
  },
  {
    id: 'publicar', titulo: 'Publicar template', area: 'Designer', viewport: [1440, 1000],
    async montar(p) {
      await chamar(p, `(typeof setMode==='function') && (setMode('designer'),true)`);
      await espera(p, 4000);
      await p.evaluate(() => { const t = document.querySelector('.dc-tmpl-main, .dc-tmpl'); if (t) t.click(); });
      await espera(p, 4500);
      const ok = await chamar(p, `(typeof dPublishOpen==='function' && (dPublishOpen(),true)) || (typeof dOpenTemplatePublishWizard==='function' && (dOpenTemplatePublishWizard(),true))`);
      if (!ok) return false;
      await espera(p, 3000);
      return visivel(p, '#d-publish-modal, #d-panel-publicar');
    }
  },
  {
    id: 'exportar', titulo: 'Exportar arte', area: 'Designer', viewport: [1440, 1000],
    async montar(p) {
      await chamar(p, `(typeof setMode==='function') && (setMode('designer'),true)`);
      await espera(p, 4000);
      const ok = await chamar(p, `(typeof dOpenExportModal==='function' && (dOpenExportModal(),true)) || (typeof dOpenExport==='function' && (dOpenExport(),true))`);
      if (!ok) return false;
      await espera(p, 1500);
      return visivel(p, '#d-export-modal');
    }
  },
  {
    id: 'ajuda', titulo: 'Central de ajuda', area: 'Suporte', viewport: [1440, 1000],
    async montar(p) {
      // O widget de ajuda é um FAB: clicar nele é o caminho real do usuário e funciona
      // em qualquer versão que o tenha, sem depender do nome da função.
      const clicou = await p.evaluate(() => {
        const fab = document.querySelector('#fhw-fab, .fhw-fab, #f-help-fab, [aria-label*="juda" i], [title*="juda" i]');
        if (fab) { fab.click(); return true; }
        return false;
      });
      const ok = clicou || await chamar(p, `(typeof gFraHelpOpen==='function' && (gFraHelpOpen(),true)) || (typeof gOpenHelp==='function' && (gOpenHelp(),true))`);
      if (!ok) return false;
      await espera(p, 3000);
      return visivel(p, '#fhw, #g-help-modal, .help-modal');
    }
  },
  {
    id: 'cli', titulo: 'Luma CLI — console do time', area: 'Interno', viewport: [1440, 1000],
    async montar(p) {
      const ok = await chamar(p, `(typeof gCliOpen==='function') && (gCliOpen(),true)`);
      if (!ok) return false;
      await espera(p, 2000);
      return visivel(p, '#luma-cli.open');
    }
  },
  {
    id: 'home-mobile', titulo: 'Vitrine no celular', area: 'Franqueado', viewport: [390, 844],
    async montar(p) { await espera(p, 2000); return visivel(p, '.fh-hero, #fh-body, .camp-grid, #f-rail'); }
  }
];

module.exports = { CENAS };
