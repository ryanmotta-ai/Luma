// docs/luma-evolution/scripts/um-arquivo.js — junta a apresentação num HTML só.
//
//   node docs/luma-evolution/scripts/um-arquivo.js luma-evolution-v2
//
// O HTML que o publicar.js escreve já tem o CSS embutido, mas aponta pras capturas por
// caminho relativo: mandar o arquivo pra alguém sem a pasta screenshots/ junto entrega
// 43 slides de moldura vazia. Aqui cada <img> vira um data: URI e o arquivo passa a ser
// autossuficiente — abre em qualquer máquina, sem servidor, sem a pasta ao lado.
//
// Junto vem a casca de visualização, que o HTML de exportação não tem porque não precisa:
// o slide é 1920×1080 fixo (o destino é PNG/PDF/PPTX), e aberto direto no navegador isso
// obriga a rolar pro lado. A casca aplica um `zoom` calculado pela largura da janela,
// numera os slides e liga as setas do teclado. Nada disso entra na impressão.
//
// A fonte Roboto continua vindo do Google Fonts: embutir os quatro pesos somaria ~600 KB
// e o arquivo já é grande. Sem rede, o navegador cai no fallback do sistema e o layout
// aguenta — foi por isso que a pilha de fontes do estilo.css sempre teve alternativa.

const path = require('path');
const fs = require('fs');

const BASE = path.resolve(__dirname, '..');
const OUT = path.join(BASE, 'presentation');
const PREFIXO = process.argv[2] || 'luma-evolution-v2';
const ENTRADA = path.join(OUT, `${PREFIXO}.html`);
const SAIDA = path.join(OUT, `${PREFIXO}-completo.html`);

if (!fs.existsSync(ENTRADA)) {
  console.error(`! ${path.relative(BASE, ENTRADA)} não existe — rode o publicar.js antes.`);
  process.exit(1);
}

const TIPO = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
               '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

let html = fs.readFileSync(ENTRADA, 'utf8');

// ── 1. as imagens viram data: URI ────────────────────────────────────────────
const cache = new Map();
let embutidas = 0, faltando = [], bytes = 0;

html = html.replace(/src="([^"]+)"/g, (todo, src) => {
  if (/^(data:|https?:)/.test(src)) return todo;
  if (cache.has(src)) { embutidas++; return `src="${cache.get(src)}"`; }
  const arq = path.resolve(OUT, src);
  const ext = path.extname(arq).toLowerCase();
  if (!fs.existsSync(arq) || !TIPO[ext]) { faltando.push(src); return todo; }
  const b64 = fs.readFileSync(arq).toString('base64');
  const uri = `data:${TIPO[ext]};base64,${b64}`;
  cache.set(src, uri);
  embutidas++; bytes += b64.length;
  return `src="${uri}"`;
});

// ── 2. a casca de visualização ───────────────────────────────────────────────
const total = (html.match(/<section class="slide/g) || []).length;

const CASCA_CSS = `
/* ── casca de visualização (só na tela; a impressão continua 1920×1080) ── */
:root{--esc:1}
body.vw{background:#161616;margin:0;padding:74px 0 60px}
.vw .pista{zoom:var(--esc);width:1920px;margin:0 auto}
.vw .slide{margin:0 auto 34px;box-shadow:0 22px 60px rgba(0,0,0,.55);scroll-margin-top:20px}
.vw .slide+.slide{margin-top:0}
.barra{position:fixed;top:0;left:0;right:0;height:54px;z-index:99;display:flex;align-items:center;
  gap:16px;padding:0 22px;background:rgba(16,16,16,.94);border-bottom:1px solid #2C2C2C;
  backdrop-filter:blur(8px);font-family:var(--fonte);color:#EDEDED}
.barra b{font-size:15px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:#FF9000}
.barra .cnt{font-family:var(--mono);font-size:14px;color:#9A9A9A;margin-left:auto}
.barra button{appearance:none;border:1px solid #3A3A3A;background:#232323;color:#EDEDED;
  width:34px;height:32px;border-radius:8px;font-size:15px;cursor:pointer;line-height:1}
.barra button:hover{background:#2E2E2E;border-color:#555}
.barra button:focus-visible{outline:2px solid #FF9000;outline-offset:2px}
.barra .dica{font-size:13px;color:#7C7C7C}
@media print{.barra{display:none}body.vw{background:#fff;margin:0;padding:0}
  .vw .pista{zoom:1;width:auto}.vw .slide{margin:0;box-shadow:none}}
`;

const CASCA_JS = `
// A casca não toca no conteúdo: só escala a pista e navega. Se algo aqui quebrar, os
// slides continuam legíveis — por isso ela é a última coisa a rodar.
(function(){
  var slides = [].slice.call(document.querySelectorAll('.slide'));
  var cnt = document.getElementById('vw-cnt');
  var atual = 0;

  function ajustar(){
    var e = Math.min(1, (window.innerWidth - 56) / 1920);
    document.documentElement.style.setProperty('--esc', e);
  }
  function marcar(i){
    atual = Math.max(0, Math.min(slides.length - 1, i));
    cnt.textContent = (atual + 1) + ' / ' + slides.length;
  }
  function ir(i){
    atual = Math.max(0, Math.min(slides.length - 1, i));
    slides[atual].scrollIntoView({ behavior: 'smooth', block: 'start' });
    marcar(atual);
  }
  window.vwIr = ir;
  window.vwPasso = function(d){ ir(atual + d); };

  ajustar();
  window.addEventListener('resize', ajustar);

  // Quem manda no contador é o que está na tela, não o último clique: rolar com o mouse
  // também tem que atualizar o número, senão as setas voltam pro slide errado.
  if ('IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function(es){
      es.forEach(function(e){ if (e.isIntersecting) marcar(slides.indexOf(e.target)); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    slides.forEach(function(s){ obs.observe(s); });
  }

  document.addEventListener('keydown', function(ev){
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    var k = ev.key;
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' ') { ev.preventDefault(); ir(atual + 1); }
    else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') { ev.preventDefault(); ir(atual - 1); }
    else if (k === 'Home') { ev.preventDefault(); ir(0); }
    else if (k === 'End') { ev.preventDefault(); ir(slides.length - 1); }
  });
  marcar(0);
})();
`;

const BARRA = `<div class="barra">
  <b>Luma · evolução</b>
  <button type="button" onclick="vwPasso(-1)" title="Slide anterior (←)" aria-label="Slide anterior">&#8593;</button>
  <button type="button" onclick="vwPasso(1)" title="Próximo slide (→)" aria-label="Próximo slide">&#8595;</button>
  <button type="button" onclick="vwIr(0)" title="Voltar ao início (Home)" aria-label="Voltar ao início">&#8676;</button>
  <span class="dica">setas do teclado navegam · Ctrl/Cmd+P imprime em 1920×1080</span>
  <span class="cnt" id="vw-cnt">1 / ${total}</span>
</div>`;

html = html.replace('</style>', CASCA_CSS + '</style>');
html = html.replace(/<body([^>]*)>/, (t, a) => `<body${a} class="vw">${BARRA}<div class="pista">`);
html = html.replace('</body>', `</div><script>${CASCA_JS}<\/script></body>`);

fs.writeFileSync(SAIDA, html);

const mb = x => (x / 1024 / 1024).toFixed(1) + ' MB';
console.log(`HTML único: ${path.relative(BASE, SAIDA)} — ${total} slides, ` +
            `${embutidas} imagens embutidas (${cache.size} distintas, ${mb(bytes)} em base64), ` +
            `${mb(fs.statSync(SAIDA).size)} no total`);
if (faltando.length) console.warn(`! ${faltando.length} imagem(ns) não embutida(s): ${faltando.slice(0, 5).join(', ')}`);
