/* Auditoria de nomes do catálogo — cole no Console (F12) com o Luma aberto e logado como admin.
   Só LÊ o dFolders (o mesmo que a vitrine usa). Não altera nada. */
(() => {
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const VAZIAS = new Set('de da do das dos e o a os as com para pra por no na em um uma ate the'.split(' '));
  const GENERICAS = new Set('feed story stories post cupom oferta preco promo promocao delivery much material campanha arte r 25'.split(' '));
  const palavras = s => norm(s).split(/[^a-z0-9]+/).filter(w => w.length > 2 && !VAZIAS.has(w));
  const distintas = s => palavras(s).filter(w => !GENERICAS.has(w));
  const fmtNoNome = n => /\bstor(y|ies)\b/i.test(n) ? 'story' : /\bfeed\b/i.test(n) ? 'feed' : /\bpost\b/i.test(n) ? 'post' : null;
  const fmtReal = t => (t.fmt === 'wide' ? 'post' : t.fmt) || 'story';

  const pastas = (typeof dFolders !== 'undefined' ? dFolders : []).filter(f => f && (f.templates || []).length);
  if (!pastas.length) return console.warn('dFolders vazio — abra o Estúdio ou o catálogo e tente de novo.');

  const linhas = [];
  for (const f of pastas) {
    const outras = pastas.filter(o => o !== f && distintas(o.name).length);
    const nomes = {};
    for (const t of f.templates) {
      const n = t.name || '';
      const prob = [];
      if (!n.trim() || /^(material|sem nome|untitled|novo material)\b/i.test(n.trim())) prob.push('nome vazio/genérico');
      // Nome cita outra campanha: todas as palavras distintas dela aparecem no nome do material
      for (const o of outras) {
        const d = distintas(o.name), nn = norm(n);
        if (d.length && d.every(w => nn.includes(w)) && !distintas(f.name).every(w => nn.includes(w)))
          prob.push(`cita a campanha "${o.name}"`);
      }
      // Nada em comum com a pasta (aviso fraco: revisar à mão)
      const dp = distintas(f.name), dn = distintas(n);
      if (dp.length && dn.length && !dn.some(w => dp.includes(w))) prob.push('nenhuma palavra da pasta (revisar)');
      const fn = fmtNoNome(n);
      if (fn && fn !== fmtReal(t)) prob.push(`nome diz ${fn}, formato é ${fmtReal(t)}`);
      const k = norm(n).trim();
      if (nomes[k]) prob.push('nome repetido na pasta');
      nomes[k] = 1;
      if (prob.length) linhas.push({ pasta: f.name, material: n, formato: fmtReal(t), publicado: !!t.publishMeta?.publicado, problema: prob.join(' · ') });
    }
  }
  const total = pastas.reduce((s, f) => s + f.templates.length, 0);
  console.log(`Auditoria: ${pastas.length} pastas, ${total} materiais, ${linhas.length} para revisar.`);
  if (linhas.length) console.table(linhas);
  console.table(pastas.flatMap(f => f.templates.map(t => ({ pasta: f.name, material: t.name, formato: fmtReal(t), publicado: !!t.publishMeta?.publicado }))));
  try { copy(linhas.map(l => [l.pasta, l.material, l.formato, l.publicado ? 'sim' : 'não', l.problema].join('\t')).join('\n')); console.log('Lista de problemas copiada (cole aqui no chat).'); } catch (e) {}
})();
