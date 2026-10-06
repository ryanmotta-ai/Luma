#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════════════════════
   NOVIDADES — confere a edição publicada e monta o RASCUNHO da próxima
   ------------------------------------------------------------------------------------------
   O changelog da rede (js/widgets/novidades.js) é curado à mão, no máximo 1 edição por
   semana. Este script faz as duas partes que não precisam de gosto:

   · CONFERIR — as regras que dá para medir: 7 dias entre edições, mais recente primeiro,
     data nunca futura, campos obrigatórios, artigo que existe, nenhum "✎ REVISAR" esquecido.
     `--checar` roda só isso e sai 1 se reprovar (é passo do CI).
   · RASCUNHAR — lê os commits desde a última edição e pega SÓ os marcados com o trailer
     `Novidade:` (e o `Pedido:`, quando a mudança veio da rede). O resto fica de fora de
     propósito: commit não é notícia. Imprime a próxima edição no formato do arquivo, com
     "✎ REVISAR" onde falta mão humana. Nada é escrito em disco e nada vai ao ar sozinho:
     alguém lê, corta, reescreve pensando em quem usa e cola no topo de LUMA_NOVIDADES.

   O TRAILER (no bloco final da mensagem, junto do Co-Authored-By):
       Novidade: Baixe as artes do lote uma a uma, sem abrir ZIP.
       Pedido: baixar as artes do lote sem precisar abrir ZIP.
   Uma frase de benefício, na língua de quem usa, com o nome que está na tela.

   Uso:
     node scripts/novidades.js            # confere + imprime o rascunho da próxima edição
     node scripts/novidades.js --checar   # só confere; sai 1 se reprovar (CI)

   Zero dependência (1ª lei): Node puro + o `git` que já existe.
   ══════════════════════════════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const ARQ = path.join(RAIZ, 'js/widgets/novidades.js');
const WIDGET = path.join(RAIZ, 'js/widgets/help-widget.js');
const CHECAR = process.argv.includes('--checar');
const DIA = 86400000;
const MARCA = '✎ REVISAR';
const ID = /^[a-z0-9-]+$/;

const dois = n => String(n).padStart(2, '0');
const isoLocal = d => d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate());
// 'T12:00' de propósito, como no widget: meia-noite UTC vira o dia anterior no Brasil.
const dataDe = s => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T12:00:00')))
  ? new Date(s + 'T12:00:00') : null;
const texto = v => typeof v === 'string' && v.trim().length > 0;

function carregar() {
  const src = fs.readFileSync(ARQ, 'utf8');
  // `const` de topo não vira propriedade do contexto: a última expressão devolve o valor.
  return vm.runInNewContext(src + '\n;LUMA_NOVIDADES', {}, { filename: ARQ });
}

function conferir(eds) {
  const erros = [];
  if (!Array.isArray(eds)) return ['LUMA_NOVIDADES precisa ser uma lista'];
  const widget = fs.readFileSync(WIDGET, 'utf8');
  const fimDeHoje = new Date(); fimDeHoje.setHours(23, 59, 59, 999);
  const idsEd = new Set(), idsItem = new Set();

  eds.forEach((e, i) => {
    const nome = 'edição ' + ((e && e.id) || '#' + (i + 1));
    if (!e || typeof e !== 'object') { erros.push(nome + ': não é um objeto'); return; }
    if (!texto(e.id) || !ID.test(e.id)) erros.push(nome + ': id só com minúscula, número e hífen');
    else if (idsEd.has(e.id)) erros.push(nome + ': id repetido');
    else idsEd.add(e.id);

    const d = dataDe(e.data);
    if (!d) erros.push(nome + ': data fora do formato AAAA-MM-DD');
    else if (d > fimDeHoje) erros.push(nome + ': data no futuro. A edição aparece assim que o deploy sai; a data é o dia em que ela vai ao ar');
    if (!texto(e.titulo)) erros.push(nome + ': falta o título');
    if (!texto(e.resumo)) erros.push(nome + ': falta o resumo');

    // A cadência: é daqui que sai o "no máximo 1 por semana".
    const ant = eds[i + 1], dAnt = ant && dataDe(ant.data);
    if (d && dAnt) {
      const dias = Math.round((d - dAnt) / DIA);
      if (dias < 0) erros.push(nome + ': fora de ordem. A mais recente vem primeiro');
      else if (dias < 7) erros.push(nome + ': sai ' + dias + ' dia(s) depois de "' + ant.id + '". No máximo 1 edição a cada 7 dias: junte as duas');
    }

    if (!Array.isArray(e.itens) || !e.itens.length) erros.push(nome + ': edição sem itens');
    (e.itens || []).forEach((n, j) => {
      const q = nome + ' › item ' + ((n && n.id) || '#' + (j + 1));
      if (!n || typeof n !== 'object') { erros.push(q + ': não é um objeto'); return; }
      if (!texto(n.id) || !ID.test(n.id)) erros.push(q + ': id só com minúscula, número e hífen');
      else if (idsItem.has(n.id)) erros.push(q + ': id repetido (vira âncora na página; precisa ser único no arquivo)');
      else idsItem.add(n.id);
      if (!texto(n.title)) erros.push(q + ': falta o título');
      if (!Array.isArray(n.body) || !n.body.length || !n.body.every(texto)) erros.push(q + ': body precisa ser uma lista de parágrafos');
      if (n.pedido !== undefined && !texto(n.pedido)) erros.push(q + ': pedido vazio. Diga o que a rede pediu ou tire o campo');
      if (n.requer !== undefined && n.requer !== 'suporte') erros.push(q + ': requer só aceita "suporte"');
      // O link "Ler: …" some calado quando o artigo não existe; aqui ele não passa calado.
      if (n.artigo !== undefined && !new RegExp("\\bid: '" + String(n.artigo).replace(/[^a-z0-9-]/g, '') + "'").test(widget)) {
        erros.push(q + ': o artigo "' + n.artigo + '" não existe em LUMA_ARTICLES (help-widget.js)');
      }
    });

    if (e.beta !== undefined) {
      const b = e.beta || {};
      if (!texto(b.id) || !ID.test(b.id)) erros.push(nome + ' › beta: id só com minúscula, número e hífen');
      if (!texto(b.titulo)) erros.push(nome + ' › beta: falta o título ("Estamos testando X.")');
      if (!texto(b.texto)) erros.push(nome + ' › beta: falta o texto');
    }
  });

  // Rascunho colado sem curadoria: a marca não pode chegar na rede.
  if (JSON.stringify(eds).includes(MARCA)) erros.push('sobrou "' + MARCA + '" no arquivo: o rascunho não foi curado');
  return erros;
}

function commitsDesde(dataIso) {
  // %x1f separa campos, %x1e separa commits, %x1d separa trailers repetidos.
  const fmt = '%h%x1f%ad%x1f%s%x1f%(trailers:key=Novidade,valueonly,separator=%x1d)%x1f%(trailers:key=Pedido,valueonly,separator=%x1d)%x1e';
  const args = ['log', '--date=short', '--format=' + fmt];
  if (dataIso) args.push('--since=' + dataIso + ' 00:00');
  const saida = execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8' });
  const lista = s => String(s || '').split('\x1d').map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return saida.split('\x1e').map(s => s.replace(/^\s+/, '')).filter(Boolean).map(l => {
    const [h, d, assunto, nov, ped] = l.split('\x1f');
    return { h, d, assunto, novidades: lista(nov), pedidos: lista(ped) };
  });
}

const aspas = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').slice(0, 4).join('-') || 'item';

function rascunho(eds) {
  const ult = eds[0], dUlt = ult && dataDe(ult.data);
  const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
  const minima = dUlt ? new Date(dUlt.getTime() + 7 * DIA) : hoje;
  const proxima = isoLocal(minima > hoje ? minima : hoje);

  console.log(ult
    ? `Última edição: ${ult.id} (${(ult.itens || []).length} itens). A próxima pode sair a partir de ${isoLocal(minima)}.`
    : 'Nenhuma edição publicada ainda.');

  let commits;
  try { commits = commitsDesde(ult && ult.data); }
  catch (e) { console.log('\nNão consegui ler o git aqui: ' + e.message.split('\n')[0]); return; }
  const marcados = commits.filter(c => c.novidades.length);
  console.log(`Desde ${ult ? ult.data : 'o começo'}: ${commits.length} commits, ${marcados.length} com "Novidade:". ` +
    `Os outros ${commits.length - marcados.length} ficam de fora de propósito.`);

  if (!marcados.length) {
    console.log('\nSem novidade marcada, sem edição. Semana sem novidade não vira notícia.');
    return;
  }

  const usados = new Set((eds || []).flatMap(e => (e.itens || []).map(n => n.id)));
  const itens = [];
  marcados.slice().reverse().forEach(c => c.novidades.forEach((nov, i) => {
    let id = slug(nov); while (usados.has(id)) id += '-2'; usados.add(id);
    const ped = c.pedidos[i] || (i === 0 && c.pedidos.length === 1 ? c.pedidos[0] : null);
    itens.push(`      // ${c.h} · ${c.d} · ${c.assunto}\n` +
      `      { id: ${aspas(id)}, icon: 'text',\n` +
      `        title: ${aspas(MARCA + ': ' + nov)},\n` +
      `        body: [${aspas(nov)}]${ped ? `,\n        pedido: ${aspas(ped)}` : ''} }`);
  }));

  console.log(`
── RASCUNHO (nada disto está publicado) ─────────────────────────────────────────
Revise cada item: é benefício para quem usa? Está na língua de quem usa, com o nome
que está na tela? Precisa mesmo entrar? Corte sem dó e ponha o mais importante primeiro.
Depois cole no TOPO de LUMA_NOVIDADES (js/widgets/novidades.js) e rode
\`node scripts/novidades.js --checar\`: ele reprova "${MARCA}" esquecido.

  { id: ${aspas(proxima)}, data: ${aspas(proxima)},
    titulo: ${aspas(MARCA + ': o que a semana muda para quem usa, em poucas palavras')},
    resumo: ${aspas(MARCA + ': uma frase juntando os itens abaixo')},
    itens: [
${itens.join(',\n')}
    ] },
`);
}

let eds;
try { eds = carregar(); }
catch (e) { console.error('✕ não consegui ler js/widgets/novidades.js: ' + e.message); process.exit(1); }

const erros = conferir(eds);
if (erros.length) {
  console.error('✕ Novidades reprovadas:\n' + erros.map(x => '  · ' + x).join('\n'));
  process.exit(1);
}
console.log(`✓ Novidades em ordem: ${eds.length} ${eds.length === 1 ? 'edição' : 'edições'}` +
  (eds[0] ? `, a última em ${eds[0].data}.` : '.'));
if (!CHECAR) { console.log(''); rascunho(eds); }
