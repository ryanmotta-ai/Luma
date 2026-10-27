/**
 * js/franqueado/fotos.js
 *
 * BIBLIOTECA DE FOTOS DA FRANQUIA (27/10/2026)
 * ---------------------------------------------------------------------------
 * As fotos reais da cidade — prato, fachada, logo — param de morar só no aparelho de quem
 * enviou. Ficam no bucket PRIVADO `luma-fotos-franquia`, no caminho
 * `<franquia_id>/<user_id>/<uuid>.<ext>`, e a biblioteca aparece no painel que já abre no
 * passo de foto do chat guiado (`upload-panel.js`).
 *
 * ⛔ ISOLAMENTO É REGRA DE BANCO, NÃO DE TELA. Quem garante que outra franquia não vê a
 * foto é a RLS (`20261027120000_luma_fotos_franquia.sql`). Aqui só filtramos por
 * `franquia_id` porque é o que o PostgREST precisa para montar a consulta — se o front
 * pedisse a franquia errada, o banco devolveria vazio.
 *
 * ⛔ NÃO CRIE UM SEGUNDO CAMINHO DE UPLOAD. O upload continua sendo o motor do chat
 * (`fProcessImageFile` → `fResizeImageIfNeeded`: redimensiona, comprime, mostra prévia).
 * Esta camada só PERSISTE o resultado, chamada de lá (`fFotosSalvar`), e devolve a foto
 * para o campo pelo mesmo finishing (`_fApplyImageToField`).
 *
 * ⚠ URL ASSINADA, NUNCA PÚBLICA. O bucket é privado; a miniatura usa `createSignedUrls`
 * (1 h) só em memória. Nada de URL de storage em localStorage nem em `luma.artes`.
 *
 * Depende de: core/supabase.js (window.sb), core/franquia.js (gMinhaFranquia),
 *   core/auth.js (gCurrentUser), core/toast.js (gToast/gEsc/gConfirm),
 *   franqueado/chat.js (_fApplyImageToField/fRecordRecentImg),
 *   franqueado/upload-panel.js (_fRenderUploadPanel/fCloseUploadPanel/_fUpPanelVar).
 */

const F_FOTOS_BUCKET = 'luma-fotos-franquia';
const F_FOTOS_TTL = 3600;                    // s — validade da URL assinada da miniatura
const F_FOTOS_MAX = 8 * 1024 * 1024;         // teto do bucket (mesmo do luma-user-uploads)
const F_FOTOS_LOTE = 60;                     // quantas fotos a biblioteca carrega por vez

let _fFotosCache = [];                       // [{id,nome,storage_path,url,…}] da última leitura
let _fFotosAvisoFalha = false;               // aviso de "não deu para salvar" 1× por sessão
/* null = ainda não sabemos; false = o banco/bucket não tem a estrutura (migration não
   aplicada). Nesse caso a seção se esconde e o upload não tenta de novo a cada foto —
   a tela não pode anunciar uma biblioteca que o backend ainda não conhece. */
let _fFotosPronta = null;

function fFotosSb(){
  if(typeof gVisitante === 'function' && gVisitante()) return null;   // visita não tem conta
  return (typeof gSupabase === 'function') ? gSupabase() : window.sb;
}
function fFotosMinhaFranquia(){
  if(typeof gMinhaFranquia !== 'function') return null;
  const f = gMinhaFranquia();
  return (f && f.id) ? f : null;
}
/* Um erro de infraestrutura (tabela/bucket faltando = migration não aplicada) desliga a
   biblioteca em silêncio. Erro de rede NÃO desliga: a próxima abertura tenta de novo. */
function _fFotosSemEstrutura(msg){
  return /bucket not found|does not exist|relation .* does not exist|schema .* does not exist|permission denied/i.test(String(msg || ''));
}
/* A seção do painel só existe quando dá para ler/escrever de verdade: sem backend, sem
   sessão ou sem vínculo de franquia ela se esconde — em vez de prometer uma biblioteca
   que vai falhar no primeiro toque. */
function fFotosDisponivel(){
  if(_fFotosPronta === false) return false;
  return !!(fFotosSb() && fFotosMinhaFranquia() && typeof gCurrentUser === 'function' && gCurrentUser());
}

/* ── LEITURA ─────────────────────────────────────────────────────────────── */
async function _fFotosAssinar(rows, sb){
  const paths = (rows || []).map(r => r && r.storage_path).filter(Boolean);
  if(!paths.length) return rows || [];
  try{
    const { data, error } = await sb.storage.from(F_FOTOS_BUCKET).createSignedUrls(paths, F_FOTOS_TTL);
    if(error || !data) return rows;
    const mapa = {};
    data.forEach(s => { if(s && s.path && s.signedUrl) mapa[s.path] = s.signedUrl; });
    return rows.map(r => Object.assign({}, r, { url: mapa[r.storage_path] || '' }));
  }catch(e){
    console.warn('[fotos] não consegui assinar as URLs', e);
    return rows;
  }
}
async function fFotosListar(){
  const sb = fFotosSb(), fr = fFotosMinhaFranquia();
  _fFotosCache = [];
  if(!sb || !fr) return [];
  try{
    const { data, error } = await sb.schema('luma').from('fotos_franquia')
      .select('id,nome,storage_path,bytes,largura,altura,criado_em')
      .eq('franquia_id', fr.id)
      .order('criado_em', { ascending: false })
      .limit(F_FOTOS_LOTE);
    if(error){
      console.warn('[fotos] lista falhou:', error.message);
      if(_fFotosSemEstrutura(error.message)) _fFotosPronta = false;
      return null;
    }
    _fFotosPronta = true;
    _fFotosCache = await _fFotosAssinar(data || [], sb);
  }catch(e){
    console.warn('[fotos] lista falhou', e);
    if(_fFotosSemEstrutura(e && e.message)) _fFotosPronta = false;
    _fFotosCache = [];
    return null;
  }
  return _fFotosCache;
}

/* ── ESCRITA ─────────────────────────────────────────────────────────────── */
function _fFotosExt(blob){
  const t = String((blob && blob.type) || '').split(';')[0];
  if(t === 'image/png') return 'png';
  if(t === 'image/webp') return 'webp';
  return 'jpg';
}
function _fFotosDimensoes(dataUrl){
  return new Promise(res => {
    try{
      const im = new Image();
      const fim = () => res({ w: 0, h: 0 });
      im.onload = () => res({ w: im.naturalWidth || 0, h: im.naturalHeight || 0 });
      im.onerror = fim;
      setTimeout(fim, 4000);              // imagem que não decodifica não trava o upload
      im.src = dataUrl;
    }catch(e){ res({ w: 0, h: 0 }); }
  });
}
function _fFotosNome(nome, varId){
  const limpo = String(nome || '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_-]+/g, ' ').trim();
  const base = limpo || (typeof gFieldLabel === 'function' ? gFieldLabel(varId) : '') || 'Foto';
  return base.slice(0, 80);
}
/* Chamado pelo motor do chat DEPOIS de redimensionar/comprimir e aplicar no campo.
   Fire-and-forget de propósito: a arte não pode esperar a rede. Se falhar, a foto continua
   valendo para esta arte (está no `fState`) — o aviso é um por sessão, não um por foto. */
async function fFotosSalvar(dataUrl, varId, origem, nomeArquivo){
  if(origem === 'demo') return null;                       // exemplo não é ativo da franquia
  if(_fFotosPronta === false) return null;                 // migration não aplicada: nem tenta
  if(!fFotosDisponivel()) return null;
  if(typeof dataUrl !== 'string' || dataUrl.indexOf('data:') !== 0) return null;
  const sb = fFotosSb(), fr = fFotosMinhaFranquia(), u = gCurrentUser();
  if(!sb || !fr || !u || !u.id) return null;

  const avisaFalha = (motivo) => {
    console.warn('[fotos] não salvou na biblioteca:', motivo);
    if(_fFotosSemEstrutura(motivo)){ _fFotosPronta = false; return; }   // backend sem a migration
    if(_fFotosAvisoFalha) return;
    _fFotosAvisoFalha = true;
    if(typeof gToast === 'function')
      gToast('A foto entrou na arte, mas não deu para salvar na biblioteca da franquia.', 'error');
  };

  try{
    const blob = await (await fetch(dataUrl)).blob();
    if(!/^image\//.test(blob.type || '')) return null;
    if(blob.size > F_FOTOS_MAX){ avisaFalha('arquivo acima de 8 MB'); return null; }

    const ext = _fFotosExt(blob);
    const path = fr.id + '/' + u.id + '/' + (typeof gUuid === 'function' ? gUuid() : String(Date.now())) + '.' + ext;
    const envio = await sb.storage.from(F_FOTOS_BUCKET)
      .upload(path, blob, { upsert: false, contentType: blob.type || 'image/jpeg' });
    if(envio.error){ avisaFalha(envio.error.message); return null; }

    const dim = await _fFotosDimensoes(dataUrl);
    const { data, error } = await sb.schema('luma').from('fotos_franquia').insert({
      franquia_id: fr.id,
      user_id: u.id,
      storage_path: path,
      nome: _fFotosNome(nomeArquivo, varId),
      bytes: blob.size,
      largura: dim.w || null,
      altura: dim.h || null
    }).select('id').single();
    if(error){
      /* Índice recusado = arquivo órfão no bucket. Some com ele na hora; órfão sem linha
         ninguém consegue apagar pela biblioteca. */
      try{ await sb.storage.from(F_FOTOS_BUCKET).remove([path]); }catch(e){}
      avisaFalha(error.message);
      return null;
    }
    _fFotosCache = [];                                      // a próxima abertura relê
    _fFotosPronta = true;
    if(typeof gToast === 'function') gToast('Foto salva na biblioteca da sua franquia.');
    return data && data.id ? data.id : null;
  }catch(e){
    avisaFalha(e && e.message ? e.message : e);
    return null;
  }
}

/* ── USAR / APAGAR ───────────────────────────────────────────────────────── */
function _fFotosBlobParaDataUrl(blob){
  return new Promise(res => {
    try{
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => res(null);
      r.readAsDataURL(blob);
    }catch(e){ res(null); }
  });
}
/* Baixa o arquivo privado e entrega ao MESMO finishing do upload do chat. Sem URL pública
   no meio: o que vai para o campo (e para o PNG) é o dataURL, como qualquer outra foto. */
async function fFotosUsar(id){
  const rec = _fFotosCache.find(r => r && r.id === id);
  const sb = fFotosSb();
  if(!rec || !sb) return;
  const varId = (typeof _fUpPanelVar !== 'undefined') ? _fUpPanelVar : null;
  const uploadId = (typeof _fUpPanelUploadId !== 'undefined') ? _fUpPanelUploadId : null;
  if(typeof fCloseUploadPanel === 'function') fCloseUploadPanel();
  try{
    const { data: blob, error } = await sb.storage.from(F_FOTOS_BUCKET).download(rec.storage_path);
    if(error || !blob){ if(typeof gToast === 'function') gToast('Não consegui abrir essa foto agora. Tente de novo.', 'error'); return; }
    const url = await _fFotosBlobParaDataUrl(blob);
    if(!url){ if(typeof gToast === 'function') gToast('Essa foto veio num formato que o navegador não abre.', 'error'); return; }
    if(typeof _fApplyImageToField === 'function') _fApplyImageToField(varId, uploadId, url);
    if(typeof fRecordRecentImg === 'function') fRecordRecentImg(url, varId);
    if(typeof gToast === 'function' && rec.nome) gToast('Foto “' + rec.nome + '” aplicada.');
  }catch(e){
    console.warn('[fotos] download falhou', e);
    if(typeof gToast === 'function') gToast('Não consegui abrir essa foto agora. Tente de novo.', 'error');
  }
}
async function fFotosApagar(id, ev){
  if(ev){ try{ ev.stopPropagation(); }catch(e){} }
  const rec = _fFotosCache.find(r => r && r.id === id);
  const sb = fFotosSb();
  if(!rec || !sb) return;
  let ok = true;
  if(typeof gConfirm === 'function'){
    ok = await gConfirm('Excluir esta foto da biblioteca da franquia? Quem já usou numa arte mantém a arte.', {
      title: 'Excluir foto', okLabel: 'Excluir', danger: true
    });
  }
  if(!ok) return;
  try{
    const { error } = await sb.storage.from(F_FOTOS_BUCKET).remove([rec.storage_path]);
    /* Arquivo já ausente não impede tirar a linha: linha sem arquivo é card quebrado na
       biblioteca; arquivo sem linha é órfão invisível. Preferimos o órfão. */
    if(error) console.warn('[fotos] remove no storage:', error.message);
    const del = await sb.schema('luma').from('fotos_franquia').delete().eq('id', id);
    if(del.error){ if(typeof gToast === 'function') gToast('Não consegui excluir agora. Tente de novo.', 'error'); return; }
    _fFotosCache = _fFotosCache.filter(r => r.id !== id);
    if(typeof gToast === 'function') gToast('Foto excluída da biblioteca.');
    if(typeof _fRenderUploadPanel === 'function') _fRenderUploadPanel();
  }catch(e){
    console.warn('[fotos] excluir falhou', e);
    if(typeof gToast === 'function') gToast('Não consegui excluir agora. Tente de novo.', 'error');
  }
}

/* ── A SEÇÃO NO PAINEL ───────────────────────────────────────────────────── */
const _F_FOTOS_ICO_LIXO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/></svg>';
const _F_FOTOS_ICO_CAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';

/* Chamada por `_fRenderUploadPanel` depois de montar o HTML. Assíncrona porque a lista vem
   da rede; o painel já está utilizável (upload, demos, recentes) enquanto isso. */
async function fFotosRenderSecao(){
  const body = document.getElementById('f-up-lib-body');
  if(!body) return;
  const rows = await fFotosListar();
  const host = document.getElementById('f-up-lib-body');
  if(!host) return;                                   // painel fechou durante a leitura
  if(_fFotosPronta === false || !fFotosDisponivel()){ _fFotosEsconderSecao(); return; }

  if(rows === null){
    host.innerHTML = `
      <p class="f-up-empty">Não consegui carregar as fotos da franquia agora.</p>
      <button type="button" class="f-up-lib-add" onclick="fFotosRenderSecao()">Tentar de novo</button>`;
    return;
  }
  if(!rows.length){
    host.innerHTML = `
      <p class="f-up-empty">A biblioteca da sua franquia está vazia. A próxima foto que você enviar fica guardada aqui.</p>
      <button type="button" class="f-up-lib-add" onclick="fUploadPanelNewFile()">${_F_FOTOS_ICO_CAM}<span>Enviar a primeira foto</span></button>`;
    return;
  }
  host.innerHTML = `
    <div class="f-up-lib-grid">${rows.map(r => `
      <button type="button" class="f-up-lib-item" onclick="fFotosUsar('${gEscJs(r.id)}')" title="Usar ${gEsc(r.nome || 'esta foto')}">
        <span class="f-up-lib-shot">${r.url ? `<img src="${gEsc(r.url)}" alt="${gEsc(r.nome || 'Foto da franquia')}" loading="lazy"/>` : ''}</span>
        <span class="f-up-lib-name">${gEsc(r.nome || 'Foto')}</span>
        <span class="f-up-thumb-del" onclick="fFotosApagar('${gEscJs(r.id)}',event)" title="Excluir da biblioteca" aria-label="Excluir da biblioteca">${_F_FOTOS_ICO_LIXO}</span>
      </button>`).join('')}</div>
    <button type="button" class="f-up-lib-add" onclick="fUploadPanelNewFile()">${_F_FOTOS_ICO_CAM}<span>Enviar outra foto</span></button>`;
}
function _fFotosEsconderSecao(){
  const sec = document.getElementById('f-up-lib-sec');
  if(sec) sec.remove();
}
