/**
 * js/academia/certificado.js
 *
 * ACADEMIA — CONCLUSÃO E CERTIFICADO.
 *
 * EMISSÃO: sempre pela RPC `luma.ac_emitir_certificado` (SECURITY DEFINER). O
 * cliente NÃO insere em luma.certificados — a tabela não tem policy de INSERT,
 * então quem valida a conclusão é o banco. Se faltar aula, a função levanta uma
 * exceção com a mensagem em PT-BR e a UI mostra exatamente ela.
 *
 * DOCUMENTO: o certificado é DESENHADO em Canvas 2D e vira PDF pelo pdf-lib
 * VENDORIZADO — o mesmo caminho que fGenPDF usa para a arte do franqueado
 * (js/franqueado/png-generator.js). Zero dependência nova, e o PDF é sempre
 * reconstituível a partir da linha do banco (não guardamos o arquivo).
 *
 * Cores vêm dos TOKENS lidos do CSS (não hex solto): trocar a marca no
 * 00-tokens.css muda o certificado também.
 */

const AC_CERT_W = 2000;   // 2000×1414 ≈ A4 paisagem com folga de impressão
const AC_CERT_H = 1414;

/* ══════════════════════════════════════════════════════════════
   TELA DE CONCLUSÃO / CERTIFICADO
══════════════════════════════════════════════════════════════ */
function acRenderCertificado(root){
  root = root || document.getElementById('ac-root'); if(!root) return;
  const r = acResumo();
  const cert = acState.certificado;
  const concluiu = acConcluiu();
  const faltam = Math.max(0, r.total - r.concluidas);

  if(!cert && !concluiu && faltam>0){
    root.innerHTML = `<div class="ac-home"><div class="ac-bloco ac-cert-tela">
      <button type="button" class="ac-side-voltar" onclick="acGo('home')">${acIco('volta')} <span>Jornada</span></button>
      ${acVazio('lock','Seu certificado ainda não está liberado',
        `Faltam ${faltam} aula${faltam===1?'':'s'} obrigatória${faltam===1?'':'s'} para você concluir a formação. Nada se perde pelo caminho — continue no seu ritmo.`,
        r.proxima?`<button type="button" class="ac-btn ac-btn-primario" onclick="acGo('aula','${r.proxima.id}')">Continuar: ${gEsc(r.proxima.titulo)}</button>`:'')}
      ${acCertRequisitos()}
    </div></div>`;
    return;
  }

  root.innerHTML = `<div class="ac-home ac-cert-tela">
    <header class="ac-cert-hero">
      <button type="button" class="ac-side-voltar" onclick="acGo('home')">${acIco('volta')} <span>Jornada</span></button>
      <span class="ac-cert-hero-selo">${acIco('medal')}</span>
      <h1 class="ac-cert-hero-t">${cert?'Formação concluída':'Tudo pronto para concluir'}</h1>
      <p class="ac-cert-hero-s">${cert
        ? `Você concluiu a ${gEsc(cert.curso_nome)}${cert.concluido_em?` em ${acFmtData(cert.concluido_em)}`:''}. O conteúdo continua disponível para revisão sempre que precisar.`
        : 'Você concluiu todas as aulas obrigatórias. Emita seu certificado — leva um instante.'}</p>
      <dl class="ac-cert-hero-nums">
        <div><dt>Aulas concluídas</dt><dd>${r.concluidas} de ${r.total}</dd></div>
        <div><dt>Progresso</dt><dd>${r.pct}%</dd></div>
        ${(acState.curso&&acState.curso.carga_horaria_min)?`<div><dt>Carga horária</dt><dd>${acFmtDur(acState.curso.carga_horaria_min*60)}</dd></div>`:''}
        ${cert?`<div><dt>Código</dt><dd><code>${gEsc(cert.codigo)}</code></dd></div>`:''}
      </dl>
      <div class="ac-cert-acoes" id="ac-cert-acoes">
        ${cert
          ? `<button type="button" class="ac-btn ac-btn-primario" onclick="acBaixarCertificado(this)">Baixar em PDF</button>
             <button type="button" class="ac-btn ac-btn-ghost" onclick="acGo('home')">Voltar à jornada</button>`
          : `<button type="button" class="ac-btn ac-btn-primario" onclick="acEmitirCertificado(this)">Emitir certificado</button>`}
      </div>
    </header>

    ${cert?`<section class="ac-bloco">
      <div class="ac-cert-cab">
        <h2 class="ac-bloco-titulo">Seu certificado</h2>
        <div class="ac-cert-zoom" role="group" aria-label="Zoom do certificado">
          <button type="button" class="ac-pbtn" onclick="acCertZoom(-1)" aria-label="Diminuir zoom" title="Diminuir">−</button>
          <button type="button" class="ac-pbtn ac-cert-zoom-num" id="ac-cert-zoom-num" onclick="acCertZoom(0)" title="Voltar ao tamanho da tela">100%</button>
          <button type="button" class="ac-pbtn" onclick="acCertZoom(1)" aria-label="Aumentar zoom" title="Aumentar">+</button>
        </div>
      </div>
      <div class="ac-cert-moldura" id="ac-cert-moldura">
        <canvas id="ac-cert-canvas" class="ac-cert-canvas"
                aria-label="Certificado de conclusão da ${gEsc(cert.curso_nome)} em nome de ${gEsc(cert.nome_completo)}"></canvas>
      </div>
      <p class="ac-form-dica">Guarde o código <code>${gEsc(cert.codigo)}</code>: ele identifica este documento e permite a conferência pela equipe Delivery Much.</p>
    </section>`:''}

    ${cert?acCertRevisao():''}
  </div>`;

  if(cert) acDesenharCertificado();
}

// Requisitos, em tom de orientação — nunca punitivo.
function acCertRequisitos(){
  const c = acState.curso; if(!c) return '';
  const pct = Math.round(acPctMin()*100);
  const mods = (c.modulos||[]);
  return `<div class="ac-cert-req-lista">
    <h3 class="ac-bloco-titulo">O que falta</h3>
    <ul>${mods.map(m=>{
      const obrig = (m.aulas||[]).filter(a=>a.obrigatoria);
      const feitas = obrig.filter(a=>acProg(a.id).concluida).length;
      const ok = obrig.length && feitas===obrig.length;
      if(!obrig.length) return '';
      return `<li class="${ok?'is-ok':''}">${ok?acIco('check'):acIco('relog')}
        <span><strong>${gEsc(m.nome)}</strong><small>${feitas} de ${obrig.length} aulas obrigatórias</small></span></li>`;
    }).join('')}</ul>
    <p class="ac-form-dica">Uma aula com vídeo conta como concluída depois de ${pct}% assistidos. Aulas opcionais não são exigidas.</p>
  </div>`;
}

// Sugestão de revisão pós-formação: o que a pessoa salvou e o que mudou depois.
function acCertRevisao(){
  const r = acResumo();
  const sug = r.salvas.concat(r.atualizadas).slice(0,6);
  if(!sug.length){
    return `<section class="ac-bloco"><h2 class="ac-bloco-titulo">Continue por aqui</h2>
      <p class="ac-form-dica">Todas as aulas seguem abertas para revisão. Você pode salvar as que quiser rever depois — elas aparecem aqui.</p>
      <button type="button" class="ac-btn ac-btn-ghost" onclick="acGo('home')">Ver a jornada completa</button></section>`;
  }
  return `<section class="ac-bloco">
    <h2 class="ac-bloco-titulo">Vale revisar</h2>
    <ul class="ac-rec-lista">
      ${sug.map(a=>`<li><button type="button" class="ac-rec" onclick="acGo('aula','${a.id}')">
        ${acProg(a.id).salva?acIco('marca'):acIco('novo')}
        <span><strong>${gEsc(a.titulo)}</strong><small>${acProg(a.id).salva?'você salvou para revisar':'conteúdo atualizado depois da sua formação'}</small></span>
      </button></li>`).join('')}
    </ul></section>`;
}

/* ══════════════════════════════════════════════════════════════
   EMISSÃO
══════════════════════════════════════════════════════════════ */
async function acEmitirCertificado(btn){
  const c = acState.curso;
  if(!c){ return; }
  if(c._demo){
    gToast('⚠ Esta é a formação de demonstração — o certificado é emitido na formação publicada pela equipe','error');
    return;
  }
  const sb = _acSb();
  if(!sb){ gToast('⚠ Backend indisponível — não consigo emitir agora','error'); return; }
  const restore = (typeof gBtnLoading==='function') ? gBtnLoading(btn,'Emitindo…') : ()=>{};
  try{
    // RPC no schema luma: a validação de conclusão acontece no servidor.
    const { data, error } = await sb.schema('luma').rpc('ac_emitir_certificado', { p_curso: c.id });
    if(error) throw error;
    const cert = Array.isArray(data) ? data[0] : data;
    if(!cert || !cert.codigo) throw new Error('resposta inesperada da emissão');
    acState.certificado = cert;
    if(!acState.matricula) acState.matricula = {};
    acState.matricula.concluido_em = cert.concluido_em;
    acState.matricula.curso_versao = cert.curso_versao;
    if(typeof gTrackEvent==='function') gTrackEvent('certificado_emitido',{curso_id:c.id, versao:cert.curso_versao});
    // Só agora a conclusão é FATO no servidor (matrícula concluída + certificado
    // com código). É o único ponto do módulo autorizado a abrir a experiência —
    // nunca a partir de estado local, que poderia celebrar algo que não gravou.
    if(typeof acConclusaoTalvezAbrir==='function' && acConclusaoTalvezAbrir()) return;
    gToast('Certificado emitido');
    acRenderCertificado();
  }catch(e){
    const msg = String((e&&e.message)||e||'');
    console.warn('[academia] emissão falhou:', msg);
    // A função levanta mensagens já escritas para o usuário ("Ainda faltam N aulas…").
    if(/faltam|não tem aulas|não encontrada|login/i.test(msg)){
      gToast('⚠ '+msg.replace(/^.*?:\s*/,''),'error');
      await acCarregarProgresso();
      acRenderCertificado();
    }else if(/permission|denied|42501/i.test(msg)){
      gToast('⚠ Sem permissão para emitir. Recarregue a página e tente de novo.','error');
    }else{
      gToast('⚠ Não consegui emitir o certificado agora. Tente de novo em instantes.','error');
    }
  }finally{ restore(); }
}

/* ══════════════════════════════════════════════════════════════
   DESENHO DO DOCUMENTO
══════════════════════════════════════════════════════════════ */
// Token do CSS → cor real para o Canvas. Mantém a marca em UM lugar (00-tokens.css)
// em vez de espalhar hex por aqui.
function _acToken(nome, fallback){
  try{
    const v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    return v || fallback;
  }catch(e){ return fallback; }
}

/* ZOOM da visualização. transform:scale no canvas já pintado: nada de redesenhar
   2000×1414 a cada clique. O PDF continua saindo na resolução cheia. */
let _acCertZoom = 1;
function acCertZoom(dir){
  const cv = document.getElementById('ac-cert-canvas');
  const box = document.getElementById('ac-cert-moldura');
  if(!cv || !box) return;
  if(dir===0) _acCertZoom = 1;
  else _acCertZoom = Math.max(1, Math.min(3, _acCertZoom + dir*0.25));
  cv.style.transformOrigin = 'top center';
  cv.style.transform = _acCertZoom===1 ? '' : `scale(${_acCertZoom})`;
  // >1 o canvas passa da moldura: liberamos a rolagem em vez de cortar.
  box.classList.toggle('is-zoom', _acCertZoom>1);
  const num = document.getElementById('ac-cert-zoom-num');
  if(num) num.textContent = Math.round(_acCertZoom*100)+'%';
}

async function acDesenharCertificado(){
  const cv = document.getElementById('ac-cert-canvas');
  if(!cv || !acState.certificado) return;
  cv.width = AC_CERT_W; cv.height = AC_CERT_H;
  await _acPintarCertificado(cv, acState.certificado);
  _acCertZoom = 1;
  // Entra depois de PINTADO: animar um canvas em branco e revelar o conteúdo
  // depois é pior que não animar.
  if(typeof acMotionReduzido==='function' && !acMotionReduzido()) cv.classList.add('ac-cert-entra');
}

async function _acPintarCertificado(cv, cert){
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const laranja = _acToken('--dm-orange', '#FF9000');
  const laranjaD = _acToken('--dm-orange-d', '#F85400');
  const amarelo = _acToken('--dm-yellow', '#FFB900');
  const texto = '#0A0A0A';        // o documento é sempre claro (papel), não segue tema
  const texto2 = '#3A3A3A';
  const texto3 = '#6B6B6B';

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Papel
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0,0,W,H);

  // Faixa superior da marca + fio amarelo (assinatura visual da DM)
  const faixa = Math.round(H*0.055);
  const g = ctx.createLinearGradient(0,0,W,0);
  g.addColorStop(0, laranja); g.addColorStop(1, laranjaD);
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,faixa);
  ctx.fillStyle = amarelo;
  ctx.fillRect(0,faixa,W,Math.round(H*0.006));

  // Moldura interna discreta
  ctx.strokeStyle = 'rgba(10,10,10,.12)';
  ctx.lineWidth = 2;
  const m = Math.round(W*0.045);
  ctx.strokeRect(m, faixa + Math.round(H*0.05), W-m*2, H - faixa - Math.round(H*0.11));

  // Selo circular no canto. O símbolo é o LOGO REAL da Delivery Much — antes era
  // um "DM" desenhado com fonte, que imita a marca sem ser a marca.
  const sx = W - m - Math.round(W*0.075), sy = faixa + Math.round(H*0.155), sr = Math.round(W*0.042);
  ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,144,0,.10)'; ctx.fill();
  ctx.strokeStyle = laranja; ctx.lineWidth = 4; ctx.stroke();
  ctx.textAlign='center'; ctx.textBaseline='middle';
  let seloOk = false;
  try{
    const marca = await _acCarregarImagem('assets/logos/dm-h-principal.png');
    if(marca && marca.width){
      const lw = sr*1.24, lh = lw*(marca.height/marca.width);
      ctx.drawImage(marca, sx-lw/2, sy-lh/2-sr*0.08, lw, lh);
      seloOk = true;
    }
  }catch(e){ /* sem arquivo, cai no texto abaixo */ }
  if(!seloOk){
    ctx.fillStyle = laranjaD;
    ctx.font = `900 ${Math.round(sr*0.42)}px Roboto, sans-serif`;
    ctx.fillText('DM', sx, sy - sr*0.12);
  }
  ctx.font = `700 ${Math.round(sr*0.17)}px Roboto, sans-serif`;
  ctx.fillStyle = texto3;
  ctx.fillText('ACADEMIA', sx, sy + sr*0.42);

  const cx = W/2;
  let y = faixa + Math.round(H*0.16);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = texto3;
  ctx.font = `700 ${Math.round(H*0.022)}px Roboto, sans-serif`;
  ctx.fillText('A C A D E M I A   D E L I V E R Y   M U C H', cx, y);

  y += Math.round(H*0.062);
  ctx.fillStyle = texto;
  ctx.font = `900 ${Math.round(H*0.052)}px Roboto, sans-serif`;
  ctx.fillText('CERTIFICADO DE CONCLUSÃO', cx, y);

  y += Math.round(H*0.055);
  ctx.fillStyle = texto2;
  ctx.font = `400 ${Math.round(H*0.026)}px Roboto, sans-serif`;
  ctx.fillText('Certificamos que', cx, y);

  // Nome: encolhe para caber em vez de estourar a moldura (nome comprido é comum).
  y += Math.round(H*0.085);
  const nome = String(cert.nome_completo||'');
  let tam = Math.round(H*0.068);
  ctx.font = `900 ${tam}px Roboto, sans-serif`;
  const maxNome = W - m*2 - Math.round(W*0.08);
  while(tam > 24 && ctx.measureText(nome).width > maxNome){
    tam -= 4; ctx.font = `900 ${tam}px Roboto, sans-serif`;
  }
  ctx.fillStyle = texto;
  ctx.fillText(nome, cx, y);
  // Fio sob o nome, do tamanho do texto
  const larg = Math.min(maxNome, Math.max(Math.round(W*0.3), ctx.measureText(nome).width + 60));
  ctx.strokeStyle = amarelo; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(cx-larg/2, y+Math.round(H*0.022)); ctx.lineTo(cx+larg/2, y+Math.round(H*0.022)); ctx.stroke();

  y += Math.round(H*0.075);
  ctx.fillStyle = texto2;
  ctx.font = `400 ${Math.round(H*0.026)}px Roboto, sans-serif`;
  ctx.fillText('concluiu a formação', cx, y);

  y += Math.round(H*0.058);
  ctx.fillStyle = laranjaD;
  ctx.font = `900 ${Math.round(H*0.040)}px Roboto, sans-serif`;
  ctx.fillText(String(cert.curso_nome||''), cx, y);

  y += Math.round(H*0.046);
  ctx.fillStyle = texto3;
  ctx.font = `500 ${Math.round(H*0.022)}px Roboto, sans-serif`;
  const meta = [
    cert.carga_horaria_min ? `Carga horária de ${Math.round(cert.carga_horaria_min/60)} horas` : '',
    cert.concluido_em ? `Concluída em ${acFmtData(cert.concluido_em)}` : '',
    `Versão ${cert.curso_versao||1} da formação`
  ].filter(Boolean).join('   ·   ');
  ctx.fillText(meta, cx, y);

  const msg = (cert.dados && cert.dados.mensagem) || '';
  if(msg){
    y += Math.round(H*0.042);
    ctx.fillStyle = texto2;
    ctx.font = `400 italic ${Math.round(H*0.022)}px Roboto, sans-serif`;
    _acTextoQuebrado(ctx, msg, cx, y, W - m*2 - Math.round(W*0.14), Math.round(H*0.032));
  }

  // Assinaturas (até duas — mais que isso viraria carimbo ilegível)
  const ass = (cert.dados && Array.isArray(cert.dados.assinaturas) ? cert.dados.assinaturas : [])
                .filter(a=>a&&a.nome).slice(0,2);
  const yAss = H - Math.round(H*0.155);
  const lista = ass.length ? ass : [{nome:'Delivery Much', cargo:'Franqueadora'}];
  const passo = W / (lista.length+1);
  lista.forEach((a,i)=>{
    const ax = passo*(i+1);
    const lw = Math.round(W*0.16);
    ctx.strokeStyle = 'rgba(10,10,10,.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ax-lw/2, yAss); ctx.lineTo(ax+lw/2, yAss); ctx.stroke();
    ctx.fillStyle = texto;
    ctx.font = `700 ${Math.round(H*0.022)}px Roboto, sans-serif`;
    ctx.fillText(String(a.nome||''), ax, yAss + Math.round(H*0.033));
    if(a.cargo){
      ctx.fillStyle = texto3;
      ctx.font = `400 ${Math.round(H*0.019)}px Roboto, sans-serif`;
      ctx.fillText(String(a.cargo), ax, yAss + Math.round(H*0.058));
    }
  });

  // Rodapé: código de validação (a identidade do documento)
  ctx.fillStyle = texto3;
  ctx.font = `500 ${Math.round(H*0.018)}px Roboto, sans-serif`;
  ctx.fillText(`Código de validação ${cert.codigo}   ·   emitido em ${acFmtData(cert.emitido_em)}   ·   confira com a equipe Delivery Much`,
               cx, H - Math.round(H*0.052));
  // ⚠ Sem segundo logo no rodapé: a marca já está no selo, e a repetição
  // empurrava o código de validação contra a borda do papel.
}

function _acTextoQuebrado(ctx, txt, cx, y, maxW, alturaLinha){
  const palavras = String(txt||'').split(/\s+/);
  let linha = '', linhas = [];
  palavras.forEach(p=>{
    const teste = linha ? linha+' '+p : p;
    if(ctx.measureText(teste).width > maxW && linha){ linhas.push(linha); linha = p; }
    else linha = teste;
  });
  if(linha) linhas.push(linha);
  linhas.slice(0,3).forEach((l,i)=>ctx.fillText(l, cx, y + i*alturaLinha));
}

function _acCarregarImagem(src){
  return new Promise((resolve,reject)=>{
    const img = new Image();
    img.onload = ()=>resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/* ══════════════════════════════════════════════════════════════
   DOWNLOAD EM PDF (pdf-lib vendorizado — mesmo caminho de fGenPDF)
══════════════════════════════════════════════════════════════ */
async function acBaixarCertificado(btn){
  const cert = acState.certificado;
  if(!cert){ gToast('⚠ Emita o certificado antes de baixar','error'); return; }
  const restore = (typeof gBtnLoading==='function') ? gBtnLoading(btn,'Gerando…') : ()=>{};
  try{
    // Canvas próprio (não o da tela): garante resolução cheia mesmo se o visível
    // estiver escalado pelo CSS.
    const cv = document.createElement('canvas');
    cv.width = AC_CERT_W; cv.height = AC_CERT_H;
    await _acPintarCertificado(cv, cert);
    const nomeArq = 'certificado-' + String(cert.codigo||'luma').toLowerCase() + '.pdf';

    if(!window.PDFLib){
      // pdf-lib não carregou: em vez de falhar, entrega o PNG (o documento é o mesmo).
      const a = document.createElement('a');
      a.download = nomeArq.replace(/\.pdf$/,'.png');
      a.href = cv.toDataURL('image/png');
      a.click();
      gToast('Baixei em PNG — o gerador de PDF não carregou nesta sessão');
      return;
    }
    const pdf = await PDFLib.PDFDocument.create();
    const page = pdf.addPage([cv.width, cv.height]);
    const png = await pdf.embedPng(cv.toDataURL('image/png'));
    page.drawImage(png, { x:0, y:0, width:cv.width, height:cv.height });
    pdf.setTitle('Certificado — ' + (cert.curso_nome||'Formação do Franqueado'));
    pdf.setSubject('Código de validação ' + (cert.codigo||''));
    const bytes = await pdf.save();
    const blob = new Blob([bytes], { type:'application/pdf' });
    const a = document.createElement('a');
    a.download = nomeArq;
    a.href = URL.createObjectURL(blob);
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
    if(typeof gTrackEvent==='function') gTrackEvent('certificado_baixado',{curso_id:acState.curso&&acState.curso.id});
    gToast('Certificado baixado');
  }catch(e){
    console.warn('[academia] PDF do certificado falhou:', e&&e.message||e);
    gToast('⚠ Não consegui gerar o PDF agora. Tente de novo.','error');
  }finally{ restore(); }
}
