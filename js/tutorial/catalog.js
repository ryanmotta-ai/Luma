/**
 * js/tutorial/catalog.js
 *
 * TUTORIALS = {...} — catalogo dos 4 tutoriais interativos.
 * Cada tutorial define titulo, descricao e array de cenas com build().
 * Depende de: tutorial/mocks.js (tutMockCampaign etc)
 */

const TUTORIALS = {
  // ════════════════════════════════════════
  // TUTORIAL 1 — Como criar minha primeira arte (polido)
  // ════════════════════════════════════════
  'primeira-arte': {
    title: 'Como criar minha primeira arte',
    description: 'Aprenda a gerar artes promocionais a partir das campanhas disponíveis.',
    duration: 5000,
    scenes: [
      {
        id: 'intro',
        duration: 3500,
        build: () => `
          <div class="tut-scene-content">
            <div style="text-align:center;max-width:480px">
              <div class="tut-finale-icon" style="margin:0 auto 24px;background:linear-gradient(135deg, var(--dm-orange-bg), rgba(255,185,0,.15));color:var(--dm-orange-d);animation-delay:0s">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
              </div>
              <h3 style="font-family:'Roboto',sans-serif;font-weight:900;font-size:28px;letter-spacing:.02em;margin-bottom:10px;animation:tutFinaleFadeUp .5s .2s both;opacity:0">Em 4 passos rápidos</h3>
              <p style="font-size:14px;color:var(--text-3);line-height:1.6;animation:tutFinaleFadeUp .5s .35s both;opacity:0">Você vai aprender a escolher campanha, selecionar material, preencher os dados e baixar sua arte pronta.</p>
            </div>
          </div>`,
        tooltip: null,
      },
      {
        id: 'escolher-campanha',
        duration: 4500,
        build: () => `
          <div class="tut-scene-content">
            <div style="display:flex;gap:14px" id="tut-camp-grid">
              ${tutMockCampaign('Hamburguer Fest','linear-gradient(135deg,#C81818,#FF9000)','Combo Smash','R$ 19,90', false)}
              ${tutMockCampaign('Combão','linear-gradient(135deg,#FFB900,#FF9000)','Combo Família','R$ 39,90', true)}
              ${tutMockCampaign('Entrega Grátis','linear-gradient(135deg,#22C55E,#15803D)','Frete Grátis','R$ 0,00', false)}
            </div>
          </div>`,
        tooltip: { text: 'Clique numa campanha para abrir os materiais disponíveis dela.', target: '.tut-mock-camp.highlight-target', placement: 'bottom' },
        after: () => {
          tutSceneTimeout(()=>tutMoveCursor('.tut-mock-camp.highlight-target', 'click'), 1500);
        },
      },
      {
        id: 'escolher-material',
        duration: 4500,
        build: () => `
          <div class="tut-scene-content">
            <div style="display:flex;gap:14px" id="tut-mat-grid">
              ${tutMockMaterial('story', 'Hamburguer Fest — Story', false)}
              ${tutMockMaterial('feed', 'Hamburguer Fest — Feed', true)}
              ${tutMockMaterial('wide', 'Hamburguer Fest — Post', false)}
            </div>
          </div>`,
        tooltip: { text: 'Escolha o material que você quer personalizar. O designer já preparou eles.', target: '.tut-mock-mat.highlight-target', placement: 'bottom' },
        after: () => {
          tutSceneTimeout(()=>tutMoveCursor('.tut-mock-mat.highlight-target', 'click'), 1500);
        },
      },
      {
        id: 'responder-chat',
        duration: 5500,
        build: () => `
          <div class="tut-scene-content">
            <div class="tut-mock-chat" id="tut-mock-chat-1">
              <div class="tut-mock-msg bot" data-delay="100">
                <div class="tut-mock-av">🤖</div>
                <div class="tut-mock-bbl"><span class="tut-mock-step-badge">Passo 1</span>Qual é o <strong>produto</strong>?</div>
              </div>
              <div class="tut-mock-msg user" data-delay="1500">
                <div class="tut-mock-av">FR</div>
                <div class="tut-mock-bbl">Combo Smash</div>
              </div>
              <div class="tut-mock-msg bot" data-delay="2500">
                <div class="tut-mock-av">🤖</div>
                <div class="tut-mock-bbl"><span class="tut-mock-step-badge">Passo 2</span>Qual o <strong>preço promocional</strong>?</div>
              </div>
              <div class="tut-mock-msg user" data-delay="3800">
                <div class="tut-mock-av">FR</div>
                <div class="tut-mock-bbl">R$ 19,90</div>
              </div>
            </div>
          </div>`,
        tooltip: { text: 'Responda as perguntas no chat. Pode digitar ou clicar nas sugestões.', target: '#tut-mock-chat-1', placement: 'right' },
        after: () => {
          // Anima cada mensagem no delay configurado
          document.querySelectorAll('#tut-mock-chat-1 .tut-mock-msg').forEach(msg=>{
            const delay = parseInt(msg.dataset.delay) || 0;
            tutSceneTimeout(()=>msg.classList.add('show'), delay);
          });
        },
      },
      {
        id: 'arte-pronta',
        duration: 4500,
        build: () => `
          <div class="tut-scene-content">
            <div class="tut-mock-arte" id="tut-mock-final">
              <div class="tut-mock-arte-canvas">
                <div style="font-size:8px;font-weight:700;letter-spacing:.12em;opacity:.7;text-transform:uppercase;font-family:'Roboto',sans-serif;z-index:1">HAMBURGUER FEST</div>
                <div class="tut-mock-arte-prod">Combo Smash</div>
                <div class="tut-mock-arte-por">R$ 19,90</div>
                <div style="height:9px;width:36px;background:rgba(255,255,255,.8);margin-top:6px;border-radius:2px;z-index:1"></div>
              </div>
            </div>
          </div>`,
        tooltip: { text: 'Pronto! Sua arte está pronta para baixar. Clique em "Baixar PNG" e use onde quiser.', target: '#tut-mock-final', placement: 'right' },
      },
    ],
  },

  // ════════════════════════════════════════
  // TUTORIAL 2 — Como editar uma arte (polido)
  // ════════════════════════════════════════
  'editar-arte': {
    title: 'Como editar uma arte que já fiz',
    description: 'Reabra e modifique artes que você criou anteriormente.',
    duration: 4500,
    scenes: [
      {
        id: 'intro',
        duration: 3000,
        build: () => `
          <div class="tut-scene-content">
            <div style="text-align:center;max-width:480px">
              <div class="tut-finale-icon" style="margin:0 auto 24px;background:linear-gradient(135deg, rgba(124,110,255,.15), rgba(59,130,246,.1));color:#7C6EFF;animation-delay:0s">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </div>
              <h3 style="font-family:'Roboto',sans-serif;font-weight:900;font-size:28px;letter-spacing:.02em;margin-bottom:10px;animation:tutFinaleFadeUp .5s .2s both;opacity:0">Edite artes salvas</h3>
              <p style="font-size:14px;color:var(--text-3);line-height:1.6;animation:tutFinaleFadeUp .5s .35s both;opacity:0">Toda arte que você gera fica salva. Você pode reabrir e modificar quando quiser, sem refazer tudo.</p>
            </div>
          </div>`,
        tooltip: null,
      },
      {
        id: 'abrir-aba',
        duration: 3500,
        build: () => `
          <div class="tut-scene-content">
            <div style="display:flex;flex-direction:column;align-items:center;gap:16px">
              <div style="display:flex;gap:4px;background:rgba(0,0,0,.04);padding:4px;border-radius:8px" id="tut-tabs-mock">
                <div style="padding:8px 18px;font-size:12px;font-weight:600;color:var(--text-3);border-radius:5px">Catálogo</div>
                <div class="highlight-target" style="padding:8px 18px;font-size:12px;font-weight:700;color:var(--dm-orange-d);background:var(--dm-orange-bg);border-radius:5px;transition:all .3s">Minhas artes</div>
              </div>
              <p style="font-size:12px;color:var(--text-3);text-align:center;max-width:280px">Todas suas artes ficam aqui, separadas por status.</p>
            </div>
          </div>`,
        tooltip: { text: 'Clique na aba "Minhas artes" pra ver tudo que você já criou.', target: '.highlight-target', placement: 'bottom' },
        after: () => {
          tutSceneTimeout(()=>tutMoveCursor('.highlight-target', 'click'), 1200);
        },
      },
      {
        id: 'filtros',
        duration: 4000,
        build: () => `
          <div class="tut-scene-content">
            <div style="display:flex;flex-direction:column;gap:12px;width:360px">
              <div style="display:flex;gap:6px">
                <div style="flex:1;padding:7px;font-size:11px;font-weight:600;border:1px solid var(--dm-orange);background:var(--dm-orange-bg);color:var(--dm-red);border-radius:5px;text-align:center">Todas <span style="background:var(--dm-orange);color:#fff;font-size:9px;padding:1px 5px;border-radius:8px;margin-left:4px">12</span></div>
                <div style="flex:1;padding:7px;font-size:11px;font-weight:600;border:1px solid #e4e4e4;background:#fff;color:var(--text-3);border-radius:5px;text-align:center">Rascunhos <span style="background:#f0f0f0;font-size:9px;padding:1px 5px;border-radius:8px;margin-left:4px">4</span></div>
                <div style="flex:1;padding:7px;font-size:11px;font-weight:600;border:1px solid #e4e4e4;background:#fff;color:var(--text-3);border-radius:5px;text-align:center">Baixadas <span style="background:#f0f0f0;font-size:9px;padding:1px 5px;border-radius:8px;margin-left:4px">8</span></div>
              </div>
              ${tutMockHist('Combo Smash · Story','Hamburguer Fest','Hoje 14:32', true)}
              ${tutMockHist('Frete Grátis · Feed','Entrega Grátis','Ontem 09:15', false)}
            </div>
          </div>`,
        tooltip: { text: 'Use os filtros pra encontrar rápido. Rascunho = ainda não baixou. Baixada = já salvou no celular.', target: '.tut-mock-hist.highlight-target', placement: 'right' },
      },
      {
        id: 'editar',
        duration: 4500,
        build: () => `
          <div class="tut-scene-content">
            <div style="display:flex;flex-direction:column;gap:8px;width:360px">
              ${tutMockHist('Combo Smash · Story','Hamburguer Fest','Hoje 14:32', false, true)}
            </div>
          </div>`,
        tooltip: { text: 'O botão "Editar" reabre a arte com todos os campos preenchidos. Você muda só o que quiser.', target: '.tut-mock-hist-btn.highlighted', placement: 'left' },
        after: () => {
          tutSceneTimeout(()=>tutMoveCursor('.tut-mock-hist-btn.highlighted', 'click'), 1800);
        },
      },
    ],
  },

  // ════════════════════════════════════════
  // TUTORIAL 3 — Qual formato escolher
  // ════════════════════════════════════════
  'qual-formato': {
    title: 'Qual formato escolher',
    description: 'Entenda quando usar cada formato disponível.',
    duration: 4000,
    scenes: [
      {
        id: 'intro',
        duration: 3000,
        build: () => `
          <div class="tut-scene-content">
            <div style="text-align:center;max-width:480px">
              <div class="tut-finale-icon" style="margin:0 auto 24px;background:linear-gradient(135deg, var(--dm-orange-bg), rgba(255,185,0,.15));color:var(--dm-orange-d);animation-delay:0s">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              </div>
              <h3 style="font-family:'Roboto',sans-serif;font-weight:900;font-size:28px;letter-spacing:.02em;margin-bottom:10px;animation:tutFinaleFadeUp .5s .2s both;opacity:0">3 formatos, 3 propósitos</h3>
              <p style="font-size:14px;color:var(--text-3);line-height:1.6;animation:tutFinaleFadeUp .5s .35s both;opacity:0">Cada formato funciona melhor em um lugar. Escolha de acordo com onde você vai postar.</p>
            </div>
          </div>`,
        tooltip: null,
      },
      {
        id: 'todos-formatos',
        duration: 4000,
        build: () => `
          <div class="tut-scene-content">
            <div class="tut-mock-fmt-grid">
              <div class="tut-mock-fmt-card" data-fmt="story">
                <div class="tut-mock-fmt-canvas story">
                  <div style="font-size:7px;letter-spacing:.08em;text-transform:uppercase;opacity:.7;font-family:'Roboto',sans-serif;font-weight:700;z-index:1">PROMO</div>
                  <div style="font-size:8px;text-transform:uppercase;letter-spacing:.02em;z-index:1;margin-top:2px">PRODUTO</div>
                  <div style="font-size:13px;color:var(--dm-yellow);z-index:1">R$ 0</div>
                </div>
                <div class="tut-mock-fmt-label">Story</div>
                <div class="tut-mock-fmt-dim">1080 × 1920</div>
              </div>
              <div class="tut-mock-fmt-card" data-fmt="feed">
                <div class="tut-mock-fmt-canvas feed">
                  <div style="font-size:7px;letter-spacing:.08em;text-transform:uppercase;opacity:.7;font-family:'Roboto',sans-serif;font-weight:700;z-index:1">PROMO</div>
                  <div style="font-size:10px;text-transform:uppercase;z-index:1;margin-top:3px">PRODUTO</div>
                  <div style="font-size:14px;color:var(--dm-yellow);z-index:1">R$ 0</div>
                </div>
                <div class="tut-mock-fmt-label">Feed</div>
                <div class="tut-mock-fmt-dim">1080 × 1080</div>
              </div>
              <div class="tut-mock-fmt-card" data-fmt="wide">
                <div class="tut-mock-fmt-canvas wide">
                  <div style="font-size:8px;letter-spacing:.08em;text-transform:uppercase;opacity:.7;font-family:'Roboto',sans-serif;font-weight:700;z-index:1">PROMO</div>
                  <div style="font-size:12px;text-transform:uppercase;z-index:1">PRODUTO · R$ 0</div>
                </div>
                <div class="tut-mock-fmt-label">Post wide</div>
                <div class="tut-mock-fmt-dim">1200 × 628</div>
              </div>
            </div>
          </div>`,
        tooltip: null,
        after: () => {
          // Anima cada card destacando em sequência
          const cards = document.querySelectorAll('.tut-mock-fmt-card');
          cards.forEach((card, i) => {
            tutSceneTimeout(()=>{
              cards.forEach(c=>c.classList.remove('highlighted'));
              card.classList.add('highlighted');
            }, 800 + i*900);
          });
        },
      },
      {
        id: 'story-uso',
        duration: 3500,
        build: () => `
          <div class="tut-scene-content">
            <div style="display:flex;align-items:center;gap:28px">
              <div class="tut-mock-fmt-card highlighted" style="transform:scale(1.15)">
                <div class="tut-mock-fmt-canvas story" style="width:80px;height:142px">
                  <div style="font-size:8px;letter-spacing:.08em;text-transform:uppercase;opacity:.7;font-family:'Roboto',sans-serif;font-weight:700;z-index:1">PROMO</div>
                  <div style="font-size:11px;text-transform:uppercase;z-index:1;margin-top:4px">PRODUTO</div>
                  <div style="font-size:17px;color:var(--dm-yellow);z-index:1">R$ 0</div>
                </div>
              </div>
              <div style="max-width:240px">
                <h4 style="font-family:'Roboto',sans-serif;font-weight:900;font-size:24px;letter-spacing:.02em;color:var(--dm-orange-d);margin-bottom:8px">STORY 9:16</h4>
                <p style="font-size:13px;color:var(--text-2);line-height:1.55">Vertical, ideal pra stories do Instagram e WhatsApp Status. Ocupa a tela inteira do celular.</p>
              </div>
            </div>
          </div>`,
        tooltip: null,
      },
      {
        id: 'feed-uso',
        duration: 3500,
        build: () => `
          <div class="tut-scene-content">
            <div style="display:flex;align-items:center;gap:28px">
              <div class="tut-mock-fmt-card highlighted" style="transform:scale(1.15)">
                <div class="tut-mock-fmt-canvas feed" style="width:120px;height:120px">
                  <div style="font-size:8px;letter-spacing:.08em;text-transform:uppercase;opacity:.7;font-family:'Roboto',sans-serif;font-weight:700;z-index:1">PROMO</div>
                  <div style="font-size:14px;text-transform:uppercase;z-index:1;margin-top:4px">PRODUTO</div>
                  <div style="font-size:18px;color:var(--dm-yellow);z-index:1">R$ 0</div>
                </div>
              </div>
              <div style="max-width:240px">
                <h4 style="font-family:'Roboto',sans-serif;font-weight:900;font-size:24px;letter-spacing:.02em;color:var(--dm-orange-d);margin-bottom:8px">FEED 1:1</h4>
                <p style="font-size:13px;color:var(--text-2);line-height:1.55">Quadrado, ideal pra feed do Instagram. Aparece bem mesmo no preview, antes de abrir o post.</p>
              </div>
            </div>
          </div>`,
        tooltip: null,
      },
      {
        id: 'wide-uso',
        duration: 3500,
        build: () => `
          <div class="tut-scene-content">
            <div style="display:flex;align-items:center;gap:28px">
              <div class="tut-mock-fmt-card highlighted" style="transform:scale(1.15)">
                <div class="tut-mock-fmt-canvas wide" style="width:160px;height:84px">
                  <div style="font-size:8px;letter-spacing:.08em;text-transform:uppercase;opacity:.7;font-family:'Roboto',sans-serif;font-weight:700;z-index:1">PROMO</div>
                  <div style="font-size:14px;text-transform:uppercase;z-index:1">PRODUTO · R$ 0</div>
                </div>
              </div>
              <div style="max-width:240px">
                <h4 style="font-family:'Roboto',sans-serif;font-weight:900;font-size:24px;letter-spacing:.02em;color:var(--dm-orange-d);margin-bottom:8px">POST WIDE 12:6</h4>
                <p style="font-size:13px;color:var(--text-2);line-height:1.55">Horizontal, ideal pra Facebook, capas e banners. Mostra produto + preço lado a lado.</p>
              </div>
            </div>
          </div>`,
        tooltip: null,
      },
    ],
  },

  // ════════════════════════════════════════
  // TUTORIAL 4 — Regras da marca DM
  // ════════════════════════════════════════
  'regras-marca': {
    title: 'Regras da marca DM',
    description: 'Aplique a identidade visual correta nas suas artes.',
    duration: 4000,
    scenes: [
      {
        id: 'intro',
        duration: 3000,
        build: () => `
          <div class="tut-scene-content">
            <div style="text-align:center;max-width:480px">
              <div class="tut-finale-icon" style="margin:0 auto 24px;background:linear-gradient(135deg, var(--dm-orange), var(--dm-red));color:#fff;animation-delay:0s">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              </div>
              <h3 style="font-family:'Roboto',sans-serif;font-weight:900;font-size:28px;letter-spacing:.02em;margin-bottom:10px;animation:tutFinaleFadeUp .5s .2s both;opacity:0">A identidade DM</h3>
              <p style="font-size:14px;color:var(--text-3);line-height:1.6;animation:tutFinaleFadeUp .5s .35s both;opacity:0">Cor, fonte e logo. Os três pilares que mantêm toda arte da DM reconhecível.</p>
            </div>
          </div>`,
        tooltip: null,
      },
      {
        id: 'cores',
        duration: 4500,
        build: () => `
          <div class="tut-scene-content">
            <div style="display:flex;flex-direction:column;align-items:center;gap:24px">
              <h4 style="font-family:'Roboto',sans-serif;font-weight:900;font-size:18px;letter-spacing:.04em;color:var(--text);opacity:0;animation:tutFinaleFadeUp .4s .1s both">PALETA OFICIAL</h4>
              <div class="tut-mock-palette">
                <div class="tut-mock-color" data-color-delay="200">
                  <div class="tut-mock-color-swatch" style="background:#FF9000"></div>
                  <div class="tut-mock-color-hex">#FF9000</div>
                  <div class="tut-mock-color-name">Laranja</div>
                </div>
                <div class="tut-mock-color" data-color-delay="400">
                  <div class="tut-mock-color-swatch" style="background:#C81818"></div>
                  <div class="tut-mock-color-hex">#C81818</div>
                  <div class="tut-mock-color-name">Vermelho</div>
                </div>
                <div class="tut-mock-color" data-color-delay="600">
                  <div class="tut-mock-color-swatch" style="background:#FFB900"></div>
                  <div class="tut-mock-color-hex">#FFB900</div>
                  <div class="tut-mock-color-name">Amarelo</div>
                </div>
                <div class="tut-mock-color" data-color-delay="800">
                  <div class="tut-mock-color-swatch" style="background:#F85400"></div>
                  <div class="tut-mock-color-hex">#F85400</div>
                  <div class="tut-mock-color-name">Laranja-D</div>
                </div>
              </div>
              <p style="font-size:12px;color:var(--text-3);max-width:340px;text-align:center;line-height:1.55;opacity:0;animation:tutFinaleFadeUp .4s 1s both">Use sempre essas cores. Evite criar variações novas — a paleta foi pensada pra funcionar em qualquer fundo.</p>
            </div>
          </div>`,
        tooltip: null,
        after: () => {
          document.querySelectorAll('.tut-mock-color').forEach(el => {
            const delay = parseInt(el.dataset.colorDelay) || 0;
            tutSceneTimeout(()=>el.classList.add('show'), delay);
          });
        },
      },
      {
        id: 'tipografia',
        duration: 4000,
        build: () => `
          <div class="tut-scene-content">
            <div style="display:flex;flex-direction:column;align-items:center;gap:18px;max-width:520px">
              <h4 style="font-family:'Roboto',sans-serif;font-weight:900;font-size:18px;letter-spacing:.04em;color:var(--text);opacity:0;animation:tutFinaleFadeUp .4s .1s both">TIPOGRAFIA</h4>
              <div style="display:flex;flex-direction:column;gap:14px;width:100%">
                <div style="background:#fff;border:1.5px solid #f0f0f0;border-radius:10px;padding:18px;opacity:0;animation:tutFinaleFadeUp .5s .25s both">
                  <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--dm-orange-d);margin-bottom:6px">Display / Títulos</div>
                  <div style="font-family:'Roboto',sans-serif;font-weight:900;font-size:32px;letter-spacing:.03em;color:var(--text);line-height:1">ROBOTO BLACK</div>
                  <div style="font-size:11px;color:var(--text-3);margin-top:4px">Para títulos, preços e elementos de destaque</div>
                </div>
                <div style="background:#fff;border:1.5px solid #f0f0f0;border-radius:10px;padding:18px;opacity:0;animation:tutFinaleFadeUp .5s .45s both">
                  <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--dm-orange-d);margin-bottom:6px">Corpo / UI</div>
                  <div style="font-family:'Roboto',sans-serif;font-size:22px;font-weight:500;color:var(--text);line-height:1">Roboto Regular &amp; Bold</div>
                  <div style="font-size:11px;color:var(--text-3);margin-top:4px">Para textos longos, legendas e interface</div>
                </div>
              </div>
            </div>
          </div>`,
        tooltip: null,
      },
      {
        id: 'logo',
        duration: 4000,
        build: () => `
          <div class="tut-scene-content">
            <div style="display:flex;flex-direction:column;align-items:center;gap:18px">
              <h4 style="font-family:'Roboto',sans-serif;font-weight:900;font-size:18px;letter-spacing:.04em;color:var(--text);opacity:0;animation:tutFinaleFadeUp .4s .1s both">LOGO DM</h4>
              <div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center">
                <div style="background:#fff;border-radius:12px;padding:24px 30px;border:1px solid #f0f0f0;display:flex;flex-direction:column;align-items:center;gap:12px;opacity:0;animation:tutFinaleFadeUp .5s .25s both">
                  <div style="height:18px;width:62px;background:var(--logo-h-principal) center/contain no-repeat"></div>
                  <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em">Em fundo claro</div>
                </div>
                <div style="background:var(--dm-orange);border-radius:12px;padding:24px 30px;display:flex;flex-direction:column;align-items:center;gap:12px;opacity:0;animation:tutFinaleFadeUp .5s .4s both">
                  <div style="height:18px;width:62px;background:var(--logo-h-branca) center/contain no-repeat"></div>
                  <div style="font-size:10px;color:rgba(255,255,255,.85);text-transform:uppercase;letter-spacing:.06em">Em fundo laranja</div>
                </div>
                <div style="background:#0a0a0f;border-radius:12px;padding:24px 30px;display:flex;flex-direction:column;align-items:center;gap:12px;opacity:0;animation:tutFinaleFadeUp .5s .55s both">
                  <div style="height:18px;width:62px;background:var(--logo-h-branca) center/contain no-repeat"></div>
                  <div style="font-size:10px;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.06em">Em fundo escuro</div>
                </div>
              </div>
              <p style="font-size:12px;color:var(--text-3);max-width:380px;text-align:center;line-height:1.55;opacity:0;animation:tutFinaleFadeUp .4s .8s both">A logo é aplicada automaticamente nas artes. O sistema escolhe a variante certa pelo fundo.</p>
            </div>
          </div>`,
        tooltip: null,
      },
    ],
  },
};
