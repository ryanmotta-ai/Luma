/**
 * js/academia/gestao.js
 *
 * ACADEMIA — GESTÃO DE CONTEÚDO (equipe_dm / gestao). Permite administrar a
 * formação sem editar código: curso, módulos, aulas, upload de MP4, materiais,
 * atividade, preview como franqueado e publicação.
 *
 * SEGURANÇA: o gate daqui é de NAVEGAÇÃO (esconder o que a pessoa não usa). Quem
 * de fato barra a escrita é a RLS (`is_designer()` nas policies de luma.cursos /
 * curso_modulos / curso_aulas e no bucket luma-aulas). Franqueado que chamar
 * acRenderGestao pelo console vê a tela e recebe erro do banco em qualquer
 * gravação — como no resto do Luma.
 *
 * UPLOAD: XHR cru contra a Storage REST API em vez de sb.storage.upload().
 * Motivo concreto: o supabase-js não expõe progresso nem cancelamento, e vídeo
 * de aula tem centenas de MB — barra de progresso e botão cancelar não são
 * enfeite aqui. Mesmo endpoint, mesmas policies.
 */

// Setas de reordenar: SVG currentColor (a casa não usa glifo/emoji como ícone).
const AC_ICO_SETA_CIMA  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 15 12 9 18 15"/></svg>';
const AC_ICO_SETA_BAIXO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';

let acGestaoAba = 'estrutura';      // estrutura | curso | turma
let acEdit = { tipo:null, id:null }; // painel de edição aberto (modulo | aula | null)
let _acUp = null;                    // {xhr, cancelado} do upload em curso

/* ══════════════════════════════════════════════════════════════
   RENDER
══════════════════════════════════════════════════════════════ */
function acRenderGestao(root){
  root = root || document.getElementById('ac-root'); if(!root) return;
  const c = acState.curso;
  root.innerHTML = `<div class="ac-gestao">
    <header class="ac-g-cab">
      <div>
        <button type="button" class="ac-side-voltar" onclick="acGo('home')">${acIco('volta')} <span>Jornada</span></button>
        <h1 class="ac-g-titulo">Gestão da Implementação</h1>
        <p class="ac-g-sub">Conteúdo da formação dos franqueados. O que estiver em rascunho não aparece para eles.</p>
      </div>
      <div class="ac-g-cab-acoes">
        ${c&&!c._demo?`<button type="button" class="ac-btn ac-btn-ghost" onclick="acGestaoPreview()">${acIco('play')} Ver como franqueado</button>`:''}
      </div>
    </header>
    ${acGestaoAvisos()}
    <div class="ac-g-abas" role="tablist" aria-label="Seções da gestão">
      ${[['estrutura','Módulos e aulas'],['curso','Configuração da formação'],['conclusao','Experiência de conclusão'],['turma','Acompanhamento']]
        .map(([id,rot])=>`<button type="button" role="tab" class="ac-aba${acGestaoAba===id?' is-atual':''}"
          aria-selected="${acGestaoAba===id}" onclick="acGestaoTrocarAba('${id}')">${rot}</button>`).join('')}
    </div>
    <div class="ac-g-corpo" id="ac-g-corpo"></div>
  </div>`;
  acGestaoRenderCorpo();
}
function acGestaoTrocarAba(id){ acGestaoAba=id; acRenderGestao(); }

function acGestaoAvisos(){
  const c = acState.curso;
  if(!c || c._demo){
    return `<div class="ac-aviso ac-aviso-info">
      ${acIco('alerta')}
      <div><strong>Nenhuma formação no banco ainda.</strong>
      <span>Você pode criar do zero ou começar da estrutura de demonstração (6 módulos e 9 aulas de exemplo) e editar a partir dela.</span></div>
      <button type="button" class="ac-btn ac-btn-primario" onclick="acGestaoCriarCurso()">Criar formação</button>
      <button type="button" class="ac-btn ac-btn-ghost" onclick="acGestaoSemearDemo(this)">Começar da demonstração</button>
    </div>`;
  }
  if(!c.publicado){
    return `<div class="ac-aviso ac-aviso-alerta">${acIco('alerta')}
      <div><strong>Esta formação está em rascunho.</strong>
      <span>Nenhum franqueado a vê enquanto ela não for publicada.</span></div>
      <button type="button" class="ac-btn ac-btn-primario" onclick="acGestaoPublicarCurso(true)">Publicar formação</button>
    </div>`;
  }
  return '';
}

function acGestaoRenderCorpo(){
  const el = document.getElementById('ac-g-corpo'); if(!el) return;
  if(acGestaoAba==='curso')  { el.innerHTML = acGestaoFormCurso(); return; }
  if(acGestaoAba==='conclusao'){ el.innerHTML = acGestaoFormConclusao(); return; }
  if(acGestaoAba==='turma')  { el.innerHTML = acGestaoTurmaHTML(); acGestaoCarregarTurma(); return; }
  el.innerHTML = `<div class="ac-g-split">
    <div class="ac-g-arvore" id="ac-g-arvore">${acGestaoArvore()}</div>
    <div class="ac-g-editor" id="ac-g-editor">${acGestaoEditor()}</div>
  </div>`;
}

/* ══════════════════════════════════════════════════════════════
   VISÃO GERAL / ÁRVORE
══════════════════════════════════════════════════════════════ */
function acGestaoArvore(){
  const c = acState.curso;
  if(!c) return '';
  // Em demonstração NADA aqui é editável (não há linha no banco pra atualizar).
  // Mostrar botões de publicar/ordenar/excluir seria prometer o que não existe —
  // e a etiqueta "PUBLICADO" contradiria o aviso "nenhuma formação no banco".
  if(c._demo) return acGestaoArvoreDemo(c);
  const mods = c.modulos||[];
  const nAulas = mods.reduce((s,m)=>s+((m.aulas||[]).length),0);
  const nPub = mods.reduce((s,m)=>s+((m.aulas||[]).filter(a=>a.publicado).length),0);
  return `<dl class="ac-g-resumo">
      <div><dt>Versão</dt><dd>v${c.versao||1}</dd></div>
      <div><dt>Módulos</dt><dd>${mods.length}</dd></div>
      <div><dt>Aulas</dt><dd>${nAulas} (${nPub} publicadas)</dd></div>
      <div><dt>Estado</dt><dd>${c.publicado?'Publicada':'Rascunho'}</dd></div>
      <div><dt>Atualizada</dt><dd>${acFmtData(c.updated_at)||'—'}</dd></div>
    </dl>
    <div class="ac-g-arvore-topo">
      <h2 class="ac-bloco-titulo">Módulos e aulas</h2>
      <button type="button" class="ac-btn ac-btn-ghost ac-btn-sm" onclick="acGestaoNovoModulo()">${acIco('novo')} Módulo</button>
    </div>
    ${mods.length?`<ol class="ac-g-mods">${mods.map((m,i)=>acGestaoModItem(m,i,mods.length)).join('')}</ol>`
      :acVazio('cap','Nenhum módulo ainda','Comece criando o primeiro módulo da formação.',
        `<button type="button" class="ac-btn ac-btn-primario" onclick="acGestaoNovoModulo()">Criar módulo</button>`)}`;
}

// Estrutura de demonstração: só leitura, para a equipe conferir o exemplo antes de semear.
function acGestaoArvoreDemo(c){
  const mods = c.modulos||[];
  const nAulas = mods.reduce((s,m)=>s+((m.aulas||[]).length),0);
  return `<h2 class="ac-bloco-titulo">Estrutura de demonstração</h2>
    <p class="ac-form-dica">${mods.length} módulos e ${nAulas} aulas de exemplo. Nada aqui é editável ainda —
    crie a formação (ou comece da demonstração) para editar de verdade.</p>
    <ol class="ac-g-mods">${mods.map(m=>`<li class="ac-g-mod">
      <div class="ac-g-mod-cab">
        <span class="ac-g-mod-nome"><strong>${gEsc(m.nome)}</strong>
          <small>${(m.aulas||[]).length} ${(m.aulas||[]).length===1?'aula':'aulas'}</small></span>
        <span class="ac-tag">Exemplo</span>
      </div>
      <ol class="ac-g-aulas">${(m.aulas||[]).map(a=>`<li class="ac-g-aula">
        <span class="ac-g-aula-nome"><strong>${gEsc(a.titulo)}</strong>
          <small>${a.duracao_seg?acFmtDur(a.duracao_seg):'sem vídeo'}${a.obrigatoria?'':' · opcional'}</small></span>
      </li>`).join('')}</ol>
    </li>`).join('')}</ol>`;
}

function acGestaoModItem(m, i, total){
  const aulas = m.aulas||[];
  const sel = acEdit.tipo==='modulo' && acEdit.id===m.id;
  return `<li class="ac-g-mod${sel?' is-sel':''}">
    <div class="ac-g-mod-cab">
      <div class="ac-g-ordem" role="group" aria-label="Reordenar ${gEsc(m.nome)}">
        <button type="button" ${i===0?'disabled':''} onclick="acGestaoMoverModulo('${m.id}',-1)" aria-label="Mover para cima" title="Mover para cima">${AC_ICO_SETA_CIMA}</button>
        <button type="button" ${i===total-1?'disabled':''} onclick="acGestaoMoverModulo('${m.id}',1)" aria-label="Mover para baixo" title="Mover para baixo">${AC_ICO_SETA_BAIXO}</button>
      </div>
      <button type="button" class="ac-g-mod-nome" onclick="acGestaoEditar('modulo','${m.id}')">
        <strong>${gEsc(m.nome)}</strong>
        <small>${aulas.length} ${aulas.length===1?'aula':'aulas'} · ${m.publicado?'publicado':'rascunho'}</small>
      </button>
      <span class="ac-tag ${m.publicado?'ac-tag-concluido':'ac-tag-rascunho'}">${m.publicado?'Publicado':'Rascunho'}</span>
      <button type="button" class="ac-g-ico" onclick="acGestaoNovaAula('${m.id}')" title="Nova aula neste módulo" aria-label="Nova aula em ${gEsc(m.nome)}">${acIco('novo')}</button>
      <button type="button" class="ac-g-ico ac-g-ico-perigo" onclick="acGestaoApagarModulo('${m.id}')" title="Excluir módulo" aria-label="Excluir ${gEsc(m.nome)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/></svg>
      </button>
    </div>
    ${aulas.length?`<ol class="ac-g-aulas">${aulas.map((a,j)=>{
      const s = acEdit.tipo==='aula' && acEdit.id===a.id;
      return `<li class="ac-g-aula${s?' is-sel':''}">
        <div class="ac-g-ordem">
          <button type="button" ${j===0?'disabled':''} onclick="acGestaoMoverAula('${a.id}',-1)" aria-label="Mover aula para cima" title="Mover para cima">${AC_ICO_SETA_CIMA}</button>
          <button type="button" ${j===aulas.length-1?'disabled':''} onclick="acGestaoMoverAula('${a.id}',1)" aria-label="Mover aula para baixo" title="Mover para baixo">${AC_ICO_SETA_BAIXO}</button>
        </div>
        <button type="button" class="ac-g-aula-nome" onclick="acGestaoEditar('aula','${a.id}')">
          <strong>${gEsc(a.titulo)}</strong>
          <small>${a.duracao_seg?acFmtDur(a.duracao_seg):'sem vídeo'}${a.obrigatoria?'':' · opcional'}${(a.video_path||a.video_url)?' · vídeo':''}</small>
        </button>
        <span class="ac-tag ${a.publicado?'ac-tag-concluido':'ac-tag-rascunho'}">${a.publicado?'Publicada':'Rascunho'}</span>
      </li>`;
    }).join('')}</ol>`:`<p class="ac-g-vazio-mod">Sem aulas neste módulo.
      <button type="button" class="ac-link" onclick="acGestaoNovaAula('${m.id}')">Criar a primeira</button></p>`}
  </li>`;
}

/* ══════════════════════════════════════════════════════════════
   EDITOR (painel direito)
══════════════════════════════════════════════════════════════ */
function acGestaoEditar(tipo, id){ acEdit={tipo,id}; acGestaoRenderCorpo(); }
function acGestaoFecharEditor(){ acEdit={tipo:null,id:null}; acGestaoRenderCorpo(); }

function acGestaoEditor(){
  if(acEdit.tipo==='modulo'){
    const m = acModulo(acEdit.id);
    return m ? acGestaoFormModulo(m) : '';
  }
  if(acEdit.tipo==='aula'){
    const a = acAula(acEdit.id);
    return a ? acGestaoFormAula(a) : '';
  }
  return `<div class="ac-g-editor-vazio">${acVazio('cfg','Selecione um módulo ou uma aula',
    'Clique num item da lista para editar. As alterações são salvas no banco quando você clica em Salvar.')}</div>`;
}

/* ── FORM: CURSO ── */
function acGestaoFormCurso(){
  const c = acState.curso;
  if(!c || c._demo) return acVazio('cfg','Nenhuma formação para configurar','Crie a formação primeiro.');
  const cert = c.certificado||{};
  const ass = Array.isArray(cert.assinaturas)?cert.assinaturas:[];
  return `<form class="ac-form" onsubmit="event.preventDefault();acGestaoSalvarCurso()">
    <h2 class="ac-bloco-titulo">Configuração da formação</h2>
    ${acCampo('ac-c-nome','Nome da formação', `<input id="ac-c-nome" type="text" required maxlength="120" value="${gEsc(c.nome||'')}">`)}
    ${acCampo('ac-c-desc','Descrição', `<textarea id="ac-c-desc" rows="2" maxlength="500">${gEsc(c.descricao||'')}</textarea>`,'Aparece no cabeçalho da jornada do franqueado.')}
    ${acCampo('ac-c-obj','Objetivo', `<textarea id="ac-c-obj" rows="2" maxlength="500">${gEsc(c.objetivo||'')}</textarea>`)}
    <div class="ac-form-linha">
      ${acCampo('ac-c-carga','Carga horária (horas)', `<input id="ac-c-carga" type="number" min="0" max="500" step="1" value="${c.carga_horaria_min?Math.round(c.carga_horaria_min/60):''}">`,'Sai no certificado. Em branco = não informar.')}
      ${acCampo('ac-c-pct','Assistido para concluir uma aula (%)', `<input id="ac-c-pct" type="number" min="10" max="100" step="5" value="${Math.round((Number(c.criterios&&c.criterios.pct_min)||0.85)*100)}">`,'Critério validado também no servidor na emissão do certificado.')}
    </div>
    ${acCampo('ac-c-versao','Versão da formação', `<input id="ac-c-versao" type="number" min="1" max="99" value="${c.versao||1}">`,'Suba a versão só em mudança grande. Certificados já emitidos guardam a versão concluída e continuam válidos.')}
    ${acCampo('ac-c-capa','Imagem de capa (URL)', `<input id="ac-c-capa" type="url" value="${gEsc(c.capa_url||'')}" placeholder="https://…">`)}
    <fieldset class="ac-form-fs">
      <legend>Certificado</legend>
      ${acCampo('ac-c-msg','Mensagem do certificado', `<textarea id="ac-c-msg" rows="2" maxlength="300">${gEsc(cert.mensagem||'')}</textarea>`,'Linha opcional impressa acima das assinaturas.')}
      ${acCampo('ac-c-ass','Assinaturas', `<textarea id="ac-c-ass" rows="3" placeholder="Nome | Cargo (uma por linha)">${gEsc(ass.map(a=>`${a.nome||''} | ${a.cargo||''}`).join('\n'))}</textarea>`,'Uma por linha, no formato Nome | Cargo. Até duas aparecem no documento.')}
    </fieldset>
    <div class="ac-form-acoes">
      <label class="ac-check"><input type="checkbox" id="ac-c-pub" ${c.publicado?'checked':''}>
        <span>Formação publicada (visível para os franqueados)</span></label>
      <button type="submit" class="ac-btn ac-btn-primario">Salvar formação</button>
    </div>
  </form>`;
}

/* ══════════════════════════════════════════════════════════════
   EXPERIÊNCIA DE CONCLUSÃO (splash + vídeo dos CEOs)
   Campos claros + preview confiável. NÃO é editor visual: a equipe precisa
   trocar texto e vídeo sem deploy, não montar layout.
══════════════════════════════════════════════════════════════ */
function acGestaoFormConclusao(){
  const c = acState.curso;
  if(!c || c._demo) return acVazio('cfg','Nenhuma formação para configurar','Crie a formação primeiro.');
  const cfg = (typeof acConclusaoCfg==='function') ? acConclusaoCfg() : null;
  if(!cfg) return acVazio('cfg','Módulo de conclusão não carregado','Recarregue a página.');
  const v = cfg.video;
  return `<form class="ac-form" onsubmit="event.preventDefault();acGestaoSalvarConclusao()">
    <h2 class="ac-bloco-titulo">O que o franqueado vê ao concluir a formação</h2>
    <p class="ac-form-dica">Esta experiência aparece UMA vez por versão da formação, logo depois de o certificado ser emitido. Depois disso ela fica acessível na jornada, como ação do próprio franqueado.</p>

    <fieldset class="ac-form-fs">
      <legend>Tela de conclusão</legend>
      <label class="ac-check"><input type="checkbox" id="ac-cc-splash" ${cfg.splashAtiva?'checked':''}>
        <span>Mostrar a tela de conclusão</span></label>
      ${acCampo('ac-cc-titulo','Rótulo acima do nome', `<input id="ac-cc-titulo" type="text" maxlength="60" value="${gEsc(cfg.titulo)}">`)}
      ${acCampo('ac-cc-msg','Mensagem', `<textarea id="ac-cc-msg" rows="2" maxlength="240">${gEsc(cfg.mensagem)}</textarea>`,'Uma ou duas linhas. Texto longo na splash não é lido.')}
      ${acCampo('ac-cc-frase','Frase de nova jornada', `<textarea id="ac-cc-frase" rows="2" maxlength="180">${gEsc(cfg.fraseFinal)}</textarea>`,'É a frase que marca a mudança de fase. Aparece também na tela de próximos passos.')}
      <div class="ac-form-linha">
        ${acCampo('ac-cc-cta','Botão principal', `<input id="ac-cc-cta" type="text" maxlength="40" value="${gEsc(cfg.ctaLabel)}">`)}
        ${acCampo('ac-cc-destino','Para onde ele leva', `<select id="ac-cc-destino" onchange="acGestaoCcDestino(this.value)">
            <option value="certificado" ${cfg.ctaDestino==='certificado'?'selected':''}>Certificado</option>
            <option value="home" ${cfg.ctaDestino==='home'?'selected':''}>Jornada (home)</option>
            <option value="aula" ${cfg.ctaDestino==='aula'?'selected':''}>Aula salva para revisão</option>
            <option value="url" ${cfg.ctaDestino==='url'?'selected':''}>Link externo</option>
          </select>`)}
      </div>
      <div id="ac-cc-url-box" ${cfg.ctaDestino==='url'?'':'hidden'}>
        ${acCampo('ac-cc-url','Endereço do link', `<input id="ac-cc-url" type="url" value="${gEsc(cfg.ctaUrl)}" placeholder="https://…">`)}
      </div>
    </fieldset>

    <fieldset class="ac-form-fs">
      <legend>Mensagem dos CEOs</legend>
      <label class="ac-check"><input type="checkbox" id="ac-cc-vativo" ${v.ativo?'checked':''}>
        <span>Mostrar o vídeo institucional depois da tela de conclusão</span></label>
      ${acGestaoVideoCeoHTML(v)}
      ${acCampo('ac-cc-vurl','Ou cole a URL de um MP4 já hospedado', `<input id="ac-cc-vurl" type="url" value="${gEsc(v.url)}" placeholder="https://…/mensagem.mp4">`)}
      ${acCampo('ac-cc-vtitulo','Título', `<input id="ac-cc-vtitulo" type="text" maxlength="120" value="${gEsc(v.titulo)}">`)}
      ${acCampo('ac-cc-vintro','Texto de introdução', `<textarea id="ac-cc-vintro" rows="2" maxlength="240">${gEsc(v.intro)}</textarea>`)}
      <div class="ac-form-linha">
        ${acCampo('ac-cc-vthumb','Thumbnail (URL)', `<input id="ac-cc-vthumb" type="url" value="${gEsc(v.thumb)}" placeholder="https://…">`)}
        ${acCampo('ac-cc-vlegenda','Legendas .vtt (URL)', `<input id="ac-cc-vlegenda" type="url" value="${gEsc(v.legenda)}" placeholder="https://…/legendas.vtt">`,'Envie o .vtt como material e cole aqui a URL assinada, ou hospede externamente.')}
      </div>
      <div class="ac-form-linha">
        ${acCampo('ac-cc-vdur','Duração (minutos)', `<input id="ac-cc-vdur" type="number" min="0" max="120" value="${v.duracao?Math.round(v.duracao/60):''}">`)}
        ${acCampo('ac-cc-vcta','Botão depois do vídeo', `<input id="ac-cc-vcta" type="text" maxlength="40" value="${gEsc(v.ctaLabel)}">`)}
      </div>
      <label class="ac-check"><input type="checkbox" id="ac-cc-vobrig" ${v.obrigatorio?'checked':''}>
        <span>Assistir é obrigatório para seguir</span></label>
      <p class="ac-form-dica">Obrigatório não bloqueia o certificado: ele já foi emitido antes desta tela. Se o vídeo falhar por problema técnico, o franqueado segue de qualquer forma — falha nossa não vira punição.</p>
      ${acCampo('ac-cc-vversao','Versão da mensagem', `<input id="ac-cc-vversao" type="number" min="1" max="99" value="${v.versao}">`,'Suba ao publicar uma mensagem NOVA. Quem já se formou não é obrigado a rever: a nova aparece marcada como novidade na jornada.')}
    </fieldset>

    <div class="ac-form-acoes ac-form-acoes-col">
      <div class="ac-cc-preview">
        <span class="ac-form-dica">Pré-visualizar como franqueado:</span>
        <div class="ac-cc-preview-btns">
          <button type="button" class="ac-btn ac-btn-ghost ac-btn-sm" onclick="acPreviewConclusao('confirmacao')">Sequência completa</button>
          <button type="button" class="ac-btn ac-btn-ghost ac-btn-sm" onclick="acPreviewConclusao('splash')">Só a tela</button>
          ${v.ativo?`<button type="button" class="ac-btn ac-btn-ghost ac-btn-sm" onclick="acPreviewConclusao('video')">Só o vídeo</button>`:''}
          <button type="button" class="ac-btn ac-btn-ghost ac-btn-sm" onclick="acPreviewConclusao('proxima')">Próximos passos</button>
        </div>
        <span class="ac-form-dica">O preview usa o que já está SALVO. Salve antes de conferir uma alteração.</span>
      </div>
      <button type="submit" class="ac-btn ac-btn-primario">Salvar experiência de conclusão</button>
    </div>
  </form>`;
}
function acGestaoCcDestino(v){
  const box = document.getElementById('ac-cc-url-box');
  if(box) box.hidden = (v!=='url');
}
function acGestaoVideoCeoHTML(v){
  return `<div class="ac-up" id="ac-cc-up">
    ${v.path?`<div class="ac-up-atual">${acIco('play')}
        <div><strong>Vídeo enviado</strong><small>${gEsc(v.path)}</small></div>
        <button type="button" class="ac-link" onclick="acGestaoPreviewVideo('${gEsc(v.path)}')">Ver</button>
        <button type="button" class="ac-link ac-link-perigo" onclick="acGestaoRemoverVideoCeo()">Remover</button>
      </div>`:''}
    <label class="ac-up-zona" id="ac-cc-up-zona"
           ondragover="event.preventDefault();this.classList.add('is-drag')"
           ondragleave="this.classList.remove('is-drag')"
           ondrop="acGestaoSoltarVideoCeo(event)">
      <input type="file" accept="video/mp4,.mp4" hidden onchange="acGestaoEnviarVideoCeo(this.files&&this.files[0])">
      <span class="ac-up-ico">${acIco('play')}</span>
      <span class="ac-up-txt"><strong>${v.path?'Substituir a mensagem':'Arraste o MP4 dos CEOs aqui'}</strong>
      <small>ou clique para escolher · MP4 até 500 MB</small></span>
    </label>
    <div class="ac-up-prog" id="ac-cc-up-prog" hidden aria-live="polite">
      <span class="ac-barra"><i id="ac-cc-up-bar" style="width:0%"></i></span>
      <span class="ac-up-num" id="ac-cc-up-num">0%</span>
      <button type="button" class="ac-link ac-link-perigo" onclick="acGestaoCancelarUpload()">Cancelar</button>
    </div>
  </div>`;
}
function acGestaoSoltarVideoCeo(ev){
  ev.preventDefault();
  const z=document.getElementById('ac-cc-up-zona'); if(z) z.classList.remove('is-drag');
  const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
  if(f) acGestaoEnviarVideoCeo(f);
}
async function acGestaoEnviarVideoCeo(file){
  if(!file) return;
  const c = acState.curso; if(!c || c._demo){ gToast('Crie a formação primeiro','error'); return; }
  if(file.size > 500*1024*1024){ gToast('O vídeo passa de 500 MB. Comprima antes de enviar.','error'); return; }
  if(!(await _acEhMp4(file))){ gToast('Só aceito vídeo MP4. Converta o arquivo e tente de novo.','error'); return; }
  // Mesmo bucket das aulas, pasta própria: sem bucket novo pra manter policy única.
  const path = `conclusao/${c.id}/ceos.mp4`;
  const prog=document.getElementById('ac-cc-up-prog');
  const bar=document.getElementById('ac-cc-up-bar'), num=document.getElementById('ac-cc-up-num');
  if(prog) prog.hidden=false;
  const ok = await acUploadArquivo(file, path, pct=>{ if(bar)bar.style.width=pct+'%'; if(num)num.textContent=pct+'%'; });
  if(prog) prog.hidden=true;
  if(!ok) return;
  const dur = await _acDuracaoDoArquivo(file);
  await acGestaoSalvarConclusao({ videoPath: path, videoDur: dur?Math.round(dur):0, silencioso:true });
  _acUrlAssinada.delete(path);
  gToast('Mensagem dos CEOs enviada');
  acGestaoRenderCorpo();
}
async function acGestaoRemoverVideoCeo(){
  const ok = await gConfirm('Remover o vídeo da mensagem dos CEOs? O arquivo é apagado do armazenamento.',
                            {title:'Remover vídeo', okLabel:'Remover', danger:true});
  if(!ok) return;
  const c = acState.curso; const cfg = acConclusaoCfg();
  const sb=_acSb();
  if(sb && cfg.video.path){
    try{ await sb.storage.from('luma-aulas').remove([cfg.video.path]); }catch(e){}
    _acUrlAssinada.delete(cfg.video.path);
  }
  await acGestaoSalvarConclusao({ videoPath:'', silencioso:true });
  gToast('Vídeo removido');
  acGestaoRenderCorpo();
}

/**
 * Grava luma.cursos.conclusao. Aceita sobreposições (upload chama com videoPath)
 * para não depender de o formulário estar montado.
 */
async function acGestaoSalvarConclusao(over){
  over = over||{};
  const lu=_acLuma(), c=acState.curso;
  if(!lu || !c || c._demo){ gToast('Crie a formação no banco antes de configurar','error'); return; }
  const cfg = acConclusaoCfg();
  const val=(id, fb)=>{ const e=document.getElementById(id); return e ? e.value : (fb!==undefined?fb:''); };
  const chk=(id, fb)=>{ const e=document.getElementById(id); return e ? !!e.checked : !!fb; };
  const mins = Number(val('ac-cc-vdur', ''))||0;
  const path = over.videoPath!==undefined ? over.videoPath : cfg.video.path;
  const dur = over.videoDur ? over.videoDur : (mins ? mins*60 : cfg.video.duracao);

  const conclusao = {
    splash: {
      ativa: chk('ac-cc-splash', cfg.splashAtiva),
      titulo: val('ac-cc-titulo', cfg.titulo),
      mensagem: val('ac-cc-msg', cfg.mensagem),
      frase_final: val('ac-cc-frase', cfg.fraseFinal),
      cta_label: val('ac-cc-cta', cfg.ctaLabel),
      cta_destino: val('ac-cc-destino', cfg.ctaDestino),
      cta_url: val('ac-cc-url', cfg.ctaUrl)
    },
    video: {
      // Só liga de verdade se houver arquivo ou URL — checkbox marcada sem vídeo
      // prometeria uma tela que não existe.
      ativo: chk('ac-cc-vativo', cfg.video.ativo) && !!(path || val('ac-cc-vurl', cfg.video.url)),
      versao: Math.max(1, Number(val('ac-cc-vversao', cfg.video.versao))||1),
      titulo: val('ac-cc-vtitulo', cfg.video.titulo),
      intro: val('ac-cc-vintro', cfg.video.intro),
      path: path,
      url: val('ac-cc-vurl', cfg.video.url),
      thumb_url: val('ac-cc-vthumb', cfg.video.thumb),
      legenda_url: val('ac-cc-vlegenda', cfg.video.legenda),
      duracao_seg: dur || null,
      obrigatorio: chk('ac-cc-vobrig', cfg.video.obrigatorio),
      cta_label: val('ac-cc-vcta', cfg.video.ctaLabel)
    }
  };
  try{
    const { data, error } = await lu.from('cursos').update({ conclusao }).eq('id', c.id).select().maybeSingle();
    if(error) throw error;
    if(data){ data.modulos = c.modulos; acState.curso = data; }
    if(!over.silencioso){ gToast('Experiência de conclusão salva'); acGestaoRenderCorpo(); }
  }catch(e){ _acGestaoErro(e,'a experiência de conclusão'); }
}

/* ── FORM: MÓDULO ── */
function acGestaoFormModulo(m){
  const c = acState.curso;
  const outros = (c.modulos||[]).filter(x=>x.id!==m.id);
  return `<form class="ac-form" onsubmit="event.preventDefault();acGestaoSalvarModulo('${m.id}')">
    <div class="ac-form-cab">
      <h2 class="ac-bloco-titulo">Módulo</h2>
      <button type="button" class="ac-g-ico" onclick="acGestaoFecharEditor()" aria-label="Fechar editor">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>
    ${acCampo('ac-m-nome','Nome', `<input id="ac-m-nome" type="text" required maxlength="120" value="${gEsc(m.nome||'')}">`)}
    ${acCampo('ac-m-desc','Descrição', `<textarea id="ac-m-desc" rows="2" maxlength="400">${gEsc(m.descricao||'')}</textarea>`,'Explica ao franqueado o objetivo da etapa.')}
    ${acCampo('ac-m-prereq','Pré-requisito', `<select id="ac-m-prereq">
        <option value="">Nenhum — módulo liberado desde o início</option>
        ${outros.map(o=>`<option value="${o.id}" ${m.prereq_modulo_id===o.id?'selected':''}>Concluir ${gEsc(o.nome)}</option>`).join('')}
      </select>`,'Enquanto o pré-requisito não estiver concluído, este módulo aparece bloqueado.')}
    <div class="ac-form-acoes">
      <label class="ac-check"><input type="checkbox" id="ac-m-pub" ${m.publicado?'checked':''}>
        <span>Módulo publicado</span></label>
      <button type="submit" class="ac-btn ac-btn-primario">Salvar módulo</button>
    </div>
  </form>`;
}

/* ── FORM: AULA ── */
function acGestaoFormAula(a){
  const mats = (a.materiais||[]);
  const at = a.atividade||{};
  const tr = Array.isArray(a.transcricao)?a.transcricao:[];
  return `<form class="ac-form" onsubmit="event.preventDefault();acGestaoSalvarAula('${a.id}')">
    <div class="ac-form-cab">
      <h2 class="ac-bloco-titulo">Aula</h2>
      <div class="ac-form-cab-acoes">
        <button type="button" class="ac-btn ac-btn-ghost ac-btn-sm" onclick="acGestaoPreviewAula('${a.id}')">${acIco('play')} Preview</button>
        <button type="button" class="ac-g-ico ac-g-ico-perigo" onclick="acGestaoApagarAula('${a.id}')" aria-label="Excluir aula" title="Excluir aula">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/></svg></button>
        <button type="button" class="ac-g-ico" onclick="acGestaoFecharEditor()" aria-label="Fechar editor">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>
    </div>

    ${acCampo('ac-a-titulo','Título', `<input id="ac-a-titulo" type="text" required maxlength="140" value="${gEsc(a.titulo||'')}">`)}
    ${acCampo('ac-a-obj','Objetivo da aula', `<textarea id="ac-a-obj" rows="2" maxlength="400">${gEsc(a.objetivo||'')}</textarea>`,'Aparece sob o título e vai no contexto do tutor.')}
    ${acCampo('ac-a-resumo','Resumo', `<textarea id="ac-a-resumo" rows="3" maxlength="2000">${gEsc(a.resumo||'')}</textarea>`,'É a base das respostas do tutor. Quanto melhor o resumo, melhor a ajuda.')}
    ${acCampo('ac-a-desc','Descrição complementar', `<textarea id="ac-a-desc" rows="2" maxlength="1000">${gEsc(a.descricao||'')}</textarea>`)}

    <fieldset class="ac-form-fs">
      <legend>Vídeo</legend>
      ${acGestaoUploadHTML(a)}
      ${acCampo('ac-a-vurl','Ou cole a URL de um MP4 já hospedado', `<input id="ac-a-vurl" type="url" value="${gEsc(a.video_url||'')}" placeholder="https://…/aula.mp4">`,'Use quando o vídeo já vive em outro lugar. Deixe em branco se enviou o arquivo acima.')}
      <div class="ac-form-linha">
        ${acCampo('ac-a-dur','Duração (minutos)', `<input id="ac-a-dur" type="number" min="0" max="600" step="1" value="${a.duracao_seg?Math.round(a.duracao_seg/60):''}">`,'Preenchida automaticamente após o upload.')}
        ${acCampo('ac-a-thumb','Thumbnail (URL)', `<input id="ac-a-thumb" type="url" value="${gEsc(a.thumb_url||'')}" placeholder="https://…">`)}
      </div>
    </fieldset>

    <fieldset class="ac-form-fs">
      <legend>Materiais complementares</legend>
      <div id="ac-a-mats">${mats.map((m,i)=>acGestaoMatLinha(m,i)).join('')}</div>
      <div class="ac-mat-add">
        <button type="button" class="ac-btn ac-btn-ghost ac-btn-sm" onclick="acGestaoAddMaterialLinha()">${acIco('novo')} Adicionar link</button>
        <label class="ac-btn ac-btn-ghost ac-btn-sm ac-file-lbl">
          ${acIco('arq')} Enviar arquivo
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.vtt,.csv,.docx,.xlsx" onchange="acGestaoEnviarMaterial(this,'${a.id}')" hidden>
        </label>
      </div>
      <p class="ac-form-dica" id="ac-mat-status" aria-live="polite"></p>
    </fieldset>

    <fieldset class="ac-form-fs">
      <legend>Transcrição</legend>
      ${acCampo('ac-a-trans','Transcrição com marcação de tempo',
        `<textarea id="ac-a-trans" rows="5" placeholder="00:00 Abertura da aula&#10;01:20 Primeiro conceito">${gEsc(tr.map(t=>`${t.t!=null?acFmtTempo(t.t)+' ':''}${t.texto||''}`).join('\n'))}</textarea>`,
        'Uma linha por trecho, começando com mm:ss. O franqueado clica no tempo e o vídeo vai até lá; o tutor só cita minutagem que existe aqui.')}
    </fieldset>

    <fieldset class="ac-form-fs">
      <legend>Atividade</legend>
      ${acCampo('ac-a-attipo','Tipo', `<select id="ac-a-attipo" onchange="acGestaoTrocarTipoAtividade(this.value)">
          <option value="" ${!at.tipo?'selected':''}>Sem atividade</option>
          <option value="quiz" ${at.tipo==='quiz'?'selected':''}>Perguntas de fixação</option>
          <option value="checklist" ${at.tipo==='checklist'?'selected':''}>Checklist prático</option>
        </select>`,'Use só quando ajudar o aprendizado. Não vale nota e não trava a conclusão da aula.')}
      <div id="ac-a-atbox" ${!at.tipo?'hidden':''}>
        ${acCampo('ac-a-attitulo','Título da atividade', `<input id="ac-a-attitulo" type="text" maxlength="120" value="${gEsc(at.titulo||'')}">`)}
        ${acCampo('ac-a-atitens','Itens', `<textarea id="ac-a-atitens" rows="5" placeholder="${gEsc('Pergunta | opção A ; opção B ; opção C | 0 | explicação')}">${gEsc(acGestaoAtividadeTexto(at))}</textarea>`,
          'Uma linha por item. Quiz: Pergunta | opções separadas por ; | índice da correta (0 = primeira) | explicação. Checklist: só o texto do item.')}
      </div>
    </fieldset>

    <div class="ac-form-acoes ac-form-acoes-col">
      <label class="ac-check"><input type="checkbox" id="ac-a-obrig" ${a.obrigatoria?'checked':''}>
        <span>Aula obrigatória (conta para o certificado)</span></label>
      <label class="ac-check"><input type="checkbox" id="ac-a-pub" ${a.publicado?'checked':''}>
        <span>Aula publicada</span></label>
      <label class="ac-check"><input type="checkbox" id="ac-a-bump">
        <span>Marcar como atualização relevante (v${a.conteudo_versao||1} → v${(a.conteudo_versao||1)+1})</span></label>
      <p class="ac-form-dica">A atualização relevante avisa quem já viu a aula, sem apagar conclusão nem invalidar certificado.</p>
      <button type="submit" class="ac-btn ac-btn-primario">Salvar aula</button>
    </div>
  </form>`;
}

function acCampo(id, rot, controle, dica){
  return `<div class="ac-campo">
    <label for="${id}">${gEsc(rot)}</label>
    ${controle}
    ${dica?`<p class="ac-form-dica">${gEsc(dica)}</p>`:''}
  </div>`;
}

/* ══════════════════════════════════════════════════════════════
   UPLOAD DE MP4 (XHR: progresso + cancelamento reais)
══════════════════════════════════════════════════════════════ */
function acGestaoUploadHTML(a){
  const temArquivo = !!a.video_path;
  return `<div class="ac-up" id="ac-up">
    ${temArquivo?`<div class="ac-up-atual">
        ${acIco('play')}
        <div><strong>Vídeo enviado</strong><small>${gEsc(a.video_path)}</small></div>
        <button type="button" class="ac-link" onclick="acGestaoPreviewVideo('${gEsc(a.video_path)}')">Ver</button>
        <button type="button" class="ac-link ac-link-perigo" onclick="acGestaoRemoverVideo('${a.id}')">Remover</button>
      </div>`:''}
    <label class="ac-up-zona" id="ac-up-zona"
           ondragover="event.preventDefault();this.classList.add('is-drag')"
           ondragleave="this.classList.remove('is-drag')"
           ondrop="acGestaoSoltarVideo(event,'${a.id}')">
      <input type="file" accept="video/mp4,.mp4" hidden onchange="acGestaoEnviarVideo(this.files&&this.files[0],'${a.id}')">
      <span class="ac-up-ico">${acIco('play')}</span>
      <span class="ac-up-txt"><strong>${temArquivo?'Substituir o vídeo':'Arraste o MP4 aqui'}</strong>
      <small>ou clique para escolher · MP4 até 500 MB</small></span>
    </label>
    <div class="ac-up-prog" id="ac-up-prog" hidden aria-live="polite">
      <span class="ac-barra"><i id="ac-up-bar" style="width:0%"></i></span>
      <span class="ac-up-num" id="ac-up-num">0%</span>
      <button type="button" class="ac-link ac-link-perigo" onclick="acGestaoCancelarUpload()">Cancelar</button>
    </div>
  </div>`;
}

function acGestaoSoltarVideo(ev, aulaId){
  ev.preventDefault();
  const zona = document.getElementById('ac-up-zona'); if(zona) zona.classList.remove('is-drag');
  const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
  if(f) acGestaoEnviarVideo(f, aulaId);
}

/**
 * Valida MP4 de verdade: extensão E MIME E assinatura do arquivo. Só extensão é
 * fácil de falsificar; a caixa `ftyp` nos primeiros bytes é o que prova o
 * formato (e evita subir um .exe renomeado pro bucket).
 */
async function _acEhMp4(file){
  const nomeOk = /\.mp4$/i.test(file.name||'');
  const mimeOk = /^video\/mp4$/i.test(file.type||'');
  if(!nomeOk && !mimeOk) return false;
  try{
    const buf = await file.slice(0,12).arrayBuffer();
    const b = new Uint8Array(buf);
    // bytes 4..7 == 'ftyp' (ISO Base Media File Format, que o MP4 usa)
    return b[4]===0x66 && b[5]===0x74 && b[6]===0x79 && b[7]===0x70;
  }catch(e){ return false; }
}

async function acGestaoEnviarVideo(file, aulaId){
  if(!file) return;
  const aula = acAula(aulaId); if(!aula) return;
  if(file.size > 500*1024*1024){ gToast('O vídeo passa de 500 MB. Comprima antes de enviar.','error'); return; }
  if(!(await _acEhMp4(file))){ gToast('Só aceito vídeo MP4. Converta o arquivo e tente de novo.','error'); return; }
  if(aula.video_path){
    const ok = await gConfirm('Substituir o vídeo desta aula? O arquivo atual é apagado.',
                              {title:'Substituir vídeo', okLabel:'Substituir', danger:true});
    if(!ok) return;
  }
  const path = `aulas/${aulaId}/video.mp4`;
  const prog = document.getElementById('ac-up-prog');
  const bar = document.getElementById('ac-up-bar');
  const num = document.getElementById('ac-up-num');
  if(prog) prog.hidden = false;

  const ok = await acUploadArquivo(file, path, (pct)=>{
    if(bar) bar.style.width = pct+'%';
    if(num) num.textContent = pct+'%';
  });
  if(prog) prog.hidden = true;
  if(!ok){ return; }

  // Duração real do arquivo: evita a equipe digitar minutagem errada (e o cálculo
  // de "tempo restante" e o critério de % dependem dela).
  const dur = await _acDuracaoDoArquivo(file);
  await acGestaoAtualizarAula(aulaId, {
    video_path: path, video_mime: 'video/mp4', video_url: null,
    duracao_seg: dur ? Math.round(dur) : (aula.duracao_seg||null)
  });
  _acUrlAssinada.delete(path);   // arquivo novo no mesmo path: assinatura antiga aponta pro velho
  gToast('Vídeo enviado');
  acGestaoRenderCorpo();
}

function _acDuracaoDoArquivo(file){
  return new Promise(resolve=>{
    try{
      const url = URL.createObjectURL(file);
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = ()=>{ const d=v.duration; URL.revokeObjectURL(url); resolve(isFinite(d)?d:0); };
      v.onerror = ()=>{ URL.revokeObjectURL(url); resolve(0); };
      v.src = url;
    }catch(e){ resolve(0); }
  });
}

/**
 * Upload com progresso e cancelamento. XHR contra a Storage REST API — mesmo
 * endpoint que o supabase-js usa, mas com upload.onprogress e abort(), que ele
 * não expõe. Respeita as policies do bucket (vai com o JWT do usuário).
 */
async function acUploadArquivo(file, path, onProgresso){
  const sb = _acSb(); const cfg = window.LUMA_SUPABASE||{};
  if(!sb || !cfg.url){ gToast('Backend indisponível — não consigo enviar arquivos agora','error'); return false; }
  let token = '';
  try{ const { data } = await sb.auth.getSession(); token = (data&&data.session&&data.session.access_token)||''; }catch(e){}
  if(!token){ gToast('Sua sessão expirou. Recarregue a página e entre de novo.','error'); return false; }

  return new Promise(resolve=>{
    const xhr = new XMLHttpRequest();
    _acUp = { xhr, cancelado:false };
    // x-upsert: substituir o vídeo grava no MESMO path (senão sobra lixo no bucket)
    xhr.open('POST', cfg.url.replace(/\/+$/,'')+'/storage/v1/object/luma-aulas/'+path, true);
    xhr.setRequestHeader('Authorization','Bearer '+token);
    xhr.setRequestHeader('apikey', cfg.anonKey||'');
    xhr.setRequestHeader('x-upsert','true');
    if(file.type) xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e)=>{
      if(e.lengthComputable && onProgresso) onProgresso(Math.round((e.loaded/e.total)*100));
    };
    xhr.onload = ()=>{
      _acUp = null;
      if(xhr.status>=200 && xhr.status<300){ resolve(true); return; }
      if(xhr.status===403 || xhr.status===401){
        gToast('Você não tem permissão para enviar arquivos da Academia','error');
      }else if(xhr.status===413){
        gToast('Arquivo grande demais para o bucket','error');
      }else{
        gToast('Falha no envio ('+xhr.status+'). Tente de novo.','error');
      }
      console.warn('[academia] upload falhou', xhr.status, String(xhr.responseText||'').slice(0,200));
      resolve(false);
    };
    xhr.onerror = ()=>{ _acUp=null; gToast('Conexão caiu durante o envio. Tente de novo.','error'); resolve(false); };
    xhr.onabort = ()=>{ _acUp=null; gToast('Envio cancelado'); resolve(false); };
    xhr.send(file);
  });
}
function acGestaoCancelarUpload(){
  if(_acUp && _acUp.xhr){ _acUp.cancelado=true; try{ _acUp.xhr.abort(); }catch(e){} }
  const prog=document.getElementById('ac-up-prog'); if(prog) prog.hidden=true;
}
async function acGestaoRemoverVideo(aulaId){
  const ok = await gConfirm('Remover o vídeo desta aula? O arquivo é apagado do armazenamento.',
                            {title:'Remover vídeo', okLabel:'Remover', danger:true});
  if(!ok) return;
  const aula = acAula(aulaId); if(!aula) return;
  const sb=_acSb();
  if(sb && aula.video_path){
    try{ await sb.storage.from('luma-aulas').remove([aula.video_path]); }
    catch(e){ console.warn('[academia] arquivo não apagou:', e&&e.message||e); }
  }
  if(aula.video_path) _acUrlAssinada.delete(aula.video_path);
  await acGestaoAtualizarAula(aulaId, { video_path:null, video_mime:null });
  gToast('Vídeo removido');
  acGestaoRenderCorpo();
}
async function acGestaoPreviewVideo(path){
  const url = await acVideoUrl({ video_path:path });
  if(url) window.open(url,'_blank','noopener');
  else gToast('Não consegui abrir o vídeo agora','error');
}

/* ── Materiais ── */
const AC_MAT_TIPOS = ['pdf','doc','planilha','link','checklist','modelo','legenda'];
function acGestaoMatLinha(m, i){
  m = m||{};
  return `<div class="ac-mat-linha" data-i="${i}">
    <select aria-label="Tipo do material" class="ac-mat-tipo">
      ${AC_MAT_TIPOS.map(t=>`<option value="${t}" ${m.tipo===t?'selected':''}>${t}</option>`).join('')}
    </select>
    <input type="text" class="ac-mat-titulo" placeholder="Título" maxlength="120" value="${gEsc(m.titulo||'')}" aria-label="Título do material">
    <input type="text" class="ac-mat-url" placeholder="${m.path?'arquivo enviado':'https://…'}" value="${gEsc(m.url||'')}" ${m.path?'disabled':''} aria-label="URL do material">
    <input type="hidden" class="ac-mat-path" value="${gEsc(m.path||'')}">
    <input type="hidden" class="ac-mat-id" value="${gEsc(m.id||('m'+i))}">
    <input type="hidden" class="ac-mat-tam" value="${gEsc(String(m.tamanho||''))}">
    <button type="button" class="ac-g-ico ac-g-ico-perigo" onclick="this.closest('.ac-mat-linha').remove()" aria-label="Remover material">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
  </div>`;
}
function acGestaoAddMaterialLinha(){
  const box = document.getElementById('ac-a-mats'); if(!box) return;
  box.insertAdjacentHTML('beforeend', acGestaoMatLinha({tipo:'link',id:'m'+Date.now()}, box.children.length));
}
async function acGestaoEnviarMaterial(input, aulaId){
  const file = input && input.files && input.files[0];
  input.value = '';
  if(!file) return;
  if(file.size > 25*1024*1024){ gToast('Material acima de 25 MB — prefira um link','error'); return; }
  const st = document.getElementById('ac-mat-status');
  if(st) st.textContent = 'Enviando '+file.name+'…';
  const limpo = String(file.name).replace(/[^a-zA-Z0-9._-]/g,'_').slice(-80);
  const path = `materiais/${aulaId}/${Date.now()}-${limpo}`;
  const ok = await acUploadArquivo(file, path, (pct)=>{ if(st) st.textContent = 'Enviando '+file.name+' · '+pct+'%'; });
  if(st) st.textContent = ok ? file.name+' enviado. Salve a aula para confirmar.' : '';
  if(!ok) return;
  const box = document.getElementById('ac-a-mats'); if(!box) return;
  const tipo = /\.pdf$/i.test(file.name) ? 'pdf'
             : /\.(xlsx|csv)$/i.test(file.name) ? 'planilha'
             : /\.vtt$/i.test(file.name) ? 'legenda'
             : /\.docx?$/i.test(file.name) ? 'doc' : 'modelo';
  box.insertAdjacentHTML('beforeend', acGestaoMatLinha({
    id:'m'+Date.now(), tipo, titulo:file.name.replace(/\.[^.]+$/,''), path, tamanho:file.size
  }, box.children.length));
}
function _acLerMateriais(){
  const box = document.getElementById('ac-a-mats'); if(!box) return [];
  return Array.from(box.querySelectorAll('.ac-mat-linha')).map(l=>{
    const g = (sel)=>{ const e=l.querySelector(sel); return e ? String(e.value||'').trim() : ''; };
    const path = g('.ac-mat-path'), url = g('.ac-mat-url'), titulo = g('.ac-mat-titulo');
    if(!titulo && !url && !path) return null;
    const tam = Number(g('.ac-mat-tam'))||0;
    return { id:g('.ac-mat-id')||('m'+Math.random().toString(36).slice(2,8)),
             tipo:g('.ac-mat-tipo')||'link', titulo:titulo||'Material',
             url:url||'', path:path||'', tamanho:tam||undefined };
  }).filter(Boolean);
}

/* ── Transcrição e atividade: texto simples ↔ JSON ── */
function _acLerTranscricao(){
  const t = document.getElementById('ac-a-trans');
  const txt = t ? String(t.value||'') : '';
  if(!txt.trim()) return [];
  return txt.split('\n').map(linha=>{
    const m = linha.match(/^\s*(\d{1,3}):([0-5]\d)\s+(.*)$/);
    if(m) return { t: Number(m[1])*60 + Number(m[2]), texto: m[3].trim() };
    const s = linha.trim();
    return s ? { t:null, texto:s } : null;
  }).filter(Boolean);
}
function acGestaoAtividadeTexto(at){
  const itens = (at&&at.itens)||[];
  if(at && at.tipo==='checklist') return itens.map(i=>i.enunciado||'').join('\n');
  return itens.map(i=>[
    i.enunciado||'', (i.opcoes||[]).join(' ; '), String(i.correta!=null?i.correta:0), i.explicacao||''
  ].join(' | ')).join('\n');
}
function acGestaoTrocarTipoAtividade(v){
  const box = document.getElementById('ac-a-atbox'); if(box) box.hidden = !v;
}
function _acLerAtividade(){
  const tipo = (document.getElementById('ac-a-attipo')||{}).value||'';
  if(!tipo) return {};
  const titulo = String((document.getElementById('ac-a-attitulo')||{}).value||'').trim();
  const txt = String((document.getElementById('ac-a-atitens')||{}).value||'');
  const itens = txt.split('\n').map((linha,i)=>{
    const s = linha.trim(); if(!s) return null;
    if(tipo==='checklist') return { id:'i'+i, enunciado:s };
    const p = s.split('|').map(x=>x.trim());
    const opcoes = (p[1]||'').split(';').map(x=>x.trim()).filter(Boolean);
    return { id:'i'+i, enunciado:p[0]||'', opcoes,
             correta: Math.max(0, Math.min(opcoes.length-1, parseInt(p[2],10)||0)),
             explicacao: p[3]||'' };
  }).filter(Boolean);
  if(!itens.length) return {};
  return { tipo, titulo: titulo||(tipo==='quiz'?'Revisão da aula':'Checklist da aula'), itens };
}

/* ══════════════════════════════════════════════════════════════
   GRAVAÇÃO
══════════════════════════════════════════════════════════════ */
function _acGestaoErro(e, oque){
  const msg = (e&&e.message)||String(e||'');
  console.warn('[academia/gestão] '+oque+':', msg);
  // 42501 = insufficient_privilege (RLS barrou): a mensagem crua não ajuda ninguém.
  if(/permission|denied|42501|row-level/i.test(msg)){
    gToast('Você não tem permissão para editar o conteúdo da Academia','error');
  }else{
    gToast('Não consegui salvar '+oque+'. Tente de novo.','error');
  }
}

async function acGestaoCriarCurso(){
  const lu=_acLuma(); if(!lu){ gToast('Backend indisponível','error'); return; }
  try{
    const { data, error } = await lu.from('cursos').insert({
      slug: AC_SLUG_PADRAO, nome:'Formação do Franqueado',
      descricao:'A jornada que acompanha o franqueado da assinatura do contrato ao primeiro mês de operação.',
      objetivo:'', publicado:false, criado_por:_acUid()||null
    }).select().maybeSingle();
    if(error) throw error;
    data.modulos = [];
    acState.curso = data; acState.demo = false;
    gToast('Formação criada em rascunho');
    acGestaoAba='curso'; acRenderGestao();
  }catch(e){ _acGestaoErro(e,'a formação'); }
}

// Semeia a estrutura de DEMONSTRAÇÃO no banco a partir da MESMA constante que o
// front usa em modo local — uma fonte só para o conteúdo de exemplo.
async function acGestaoSemearDemo(btn){
  const lu=_acLuma(); if(!lu){ gToast('Backend indisponível','error'); return; }
  const ok = await gConfirm('Criar a formação com os 6 módulos e 9 aulas de demonstração? Tudo entra como RASCUNHO para você editar antes de publicar.',
                            {title:'Começar da demonstração', okLabel:'Criar'});
  if(!ok) return;
  const restore = (typeof gBtnLoading==='function') ? gBtnLoading(btn,'Criando…') : ()=>{};
  try{
    const d = AC_CURSO_DEMO;
    const { data: curso, error: eC } = await lu.from('cursos').insert({
      slug: AC_SLUG_PADRAO, nome:d.nome, descricao:d.descricao, objetivo:d.objetivo,
      carga_horaria_min:d.carga_horaria_min, criterios:d.criterios, certificado:d.certificado,
      publicado:false, criado_por:_acUid()||null
    }).select().maybeSingle();
    if(eC) throw eC;
    // Módulos primeiro (para ter os ids reais), depois religa os pré-requisitos.
    const mapa = {};
    for(const m of d.modulos){
      const { data: mm, error: eM } = await lu.from('curso_modulos').insert({
        curso_id:curso.id, nome:m.nome, descricao:m.descricao, ordem:m.ordem, publicado:false
      }).select().maybeSingle();
      if(eM) throw eM;
      mapa[m.id] = mm.id;
    }
    for(const m of d.modulos){
      if(m.prereq_modulo_id && mapa[m.prereq_modulo_id]){
        await lu.from('curso_modulos').update({ prereq_modulo_id: mapa[m.prereq_modulo_id] }).eq('id', mapa[m.id]);
      }
      for(const a of (m.aulas||[])){
        const { error: eA } = await lu.from('curso_aulas').insert({
          curso_id:curso.id, modulo_id:mapa[m.id], titulo:a.titulo, descricao:a.descricao||'',
          objetivo:a.objetivo||'', resumo:a.resumo||'', duracao_seg:a.duracao_seg||null,
          materiais:a.materiais||[], transcricao:a.transcricao||[], atividade:a.atividade||{},
          obrigatoria:!!a.obrigatoria, ordem:a.ordem, publicado:false
        });
        if(eA) throw eA;
      }
    }
    gToast('Estrutura de demonstração criada em rascunho');
    await acCarregar({silent:true});
    acRenderGestao();
  }catch(e){ _acGestaoErro(e,'a estrutura de demonstração'); }
  finally{ restore(); }
}

async function acGestaoSalvarCurso(){
  const lu=_acLuma(), c=acState.curso;
  if(!lu || !c || c._demo){ gToast('Crie a formação no banco antes de configurá-la','error'); return; }
  const val = (id)=>{ const e=document.getElementById(id); return e?e.value:''; };
  const horas = Number(val('ac-c-carga'))||0;
  const pct = Math.min(100, Math.max(10, Number(val('ac-c-pct'))||85));
  const ass = String(val('ac-c-ass')||'').split('\n').map(l=>{
    const p = l.split('|'); const nome=(p[0]||'').trim();
    return nome ? { nome, cargo:(p[1]||'').trim() } : null;
  }).filter(Boolean);
  const pub = !!(document.getElementById('ac-c-pub')||{}).checked;
  try{
    const { data, error } = await lu.from('cursos').update({
      nome: String(val('ac-c-nome')||'').trim() || c.nome,
      descricao: val('ac-c-desc'), objetivo: val('ac-c-obj'),
      carga_horaria_min: horas ? horas*60 : null,
      criterios: Object.assign({}, c.criterios||{}, { pct_min: pct/100 }),
      versao: Math.max(1, Number(val('ac-c-versao'))||1),
      capa_url: val('ac-c-capa')||null,
      certificado: { assinaturas: ass, mensagem: val('ac-c-msg') },
      publicado: pub, publicado_em: pub ? (c.publicado_em || new Date().toISOString()) : null
    }).eq('id', c.id).select().maybeSingle();
    if(error) throw error;
    if(data){ data.modulos = c.modulos; acState.curso = data; }
    gToast('Formação salva');
    acRenderGestao();
  }catch(e){ _acGestaoErro(e,'a formação'); }
}
async function acGestaoPublicarCurso(pub){
  const lu=_acLuma(), c=acState.curso; if(!lu||!c||c._demo) return;
  try{
    const { error } = await lu.from('cursos').update({
      publicado:!!pub, publicado_em: pub?(c.publicado_em||new Date().toISOString()):null
    }).eq('id', c.id);
    if(error) throw error;
    c.publicado = !!pub;
    gToast(pub?'Formação publicada':'Formação despublicada');
    acRenderGestao();
  }catch(e){ _acGestaoErro(e,'a publicação'); }
}

async function acGestaoNovoModulo(){
  const lu=_acLuma(), c=acState.curso;
  if(!lu||!c||c._demo){ gToast('Crie a formação primeiro','error'); return; }
  const mods = c.modulos||[];
  const ultimo = mods[mods.length-1];
  try{
    const { data, error } = await lu.from('curso_modulos').insert({
      curso_id:c.id, nome:'Novo módulo', ordem:mods.length, publicado:false,
      // Sequência é o padrão da jornada: o novo módulo depende do anterior.
      prereq_modulo_id: ultimo ? ultimo.id : null
    }).select().maybeSingle();
    if(error) throw error;
    data.aulas = [];
    c.modulos = mods.concat([data]);
    acEdit = {tipo:'modulo', id:data.id};
    acGestaoRenderCorpo();
    const n=document.getElementById('ac-m-nome'); if(n){ n.focus(); n.select(); }
  }catch(e){ _acGestaoErro(e,'o módulo'); }
}
async function acGestaoSalvarModulo(id){
  const lu=_acLuma(), m=acModulo(id); if(!lu||!m) return;
  const val=(i)=>{ const e=document.getElementById(i); return e?e.value:''; };
  try{
    const { data, error } = await lu.from('curso_modulos').update({
      nome: String(val('ac-m-nome')||'').trim() || m.nome,
      descricao: val('ac-m-desc'),
      prereq_modulo_id: val('ac-m-prereq') || null,
      publicado: !!(document.getElementById('ac-m-pub')||{}).checked
    }).eq('id', id).select().maybeSingle();
    if(error) throw error;
    if(data) Object.assign(m, data, { aulas: m.aulas });
    gToast('Módulo salvo');
    acGestaoRenderCorpo();
  }catch(e){ _acGestaoErro(e,'o módulo'); }
}
async function acGestaoApagarModulo(id){
  const m = acModulo(id); if(!m) return;
  const n = (m.aulas||[]).length;
  const ok = await gConfirm(n
    ? `Excluir "${m.nome}" e as ${n} aula(s) dentro dele? O progresso dos franqueados nessas aulas também é apagado.`
    : `Excluir "${m.nome}"?`, {title:'Excluir módulo', okLabel:'Excluir', danger:true});
  if(!ok) return;
  const lu=_acLuma(); if(!lu) return;
  try{
    const { error } = await lu.from('curso_modulos').delete().eq('id', id);
    if(error) throw error;
    acState.curso.modulos = (acState.curso.modulos||[]).filter(x=>x.id!==id);
    if(acEdit.id===id) acEdit={tipo:null,id:null};
    gToast('Módulo excluído');
    acGestaoRenderCorpo();
  }catch(e){ _acGestaoErro(e,'a exclusão'); }
}
async function acGestaoMoverModulo(id, dir){
  const c = acState.curso; const mods=(c.modulos||[]).slice();
  const i = mods.findIndex(m=>m.id===id); const j=i+dir;
  if(i<0 || j<0 || j>=mods.length) return;
  const tmp=mods[i]; mods[i]=mods[j]; mods[j]=tmp;
  c.modulos = mods;
  acGestaoRenderCorpo();
  const lu=_acLuma(); if(!lu||c._demo) return;
  try{
    // Grava a ordem de todos: renumerar só os dois trocados deixaria buracos se
    // alguém tivesse editado a ordem por fora.
    await Promise.all(mods.map((m,k)=>lu.from('curso_modulos').update({ordem:k}).eq('id',m.id)));
    mods.forEach((m,k)=>{ m.ordem=k; });
  }catch(e){ _acGestaoErro(e,'a ordem'); }
}

async function acGestaoNovaAula(moduloId){
  const lu=_acLuma(), m=acModulo(moduloId); if(!lu||!m) return;
  try{
    const { data, error } = await lu.from('curso_aulas').insert({
      curso_id:acState.curso.id, modulo_id:moduloId, titulo:'Nova aula',
      ordem:(m.aulas||[]).length, publicado:false, obrigatoria:true
    }).select().maybeSingle();
    if(error) throw error;
    m.aulas = (m.aulas||[]).concat([data]);
    acEdit = {tipo:'aula', id:data.id};
    acGestaoRenderCorpo();
    const t=document.getElementById('ac-a-titulo'); if(t){ t.focus(); t.select(); }
  }catch(e){ _acGestaoErro(e,'a aula'); }
}
async function acGestaoSalvarAula(id){
  const a = acAula(id); if(!a) return;
  const val=(i)=>{ const e=document.getElementById(i); return e?e.value:''; };
  const mins = Number(val('ac-a-dur'))||0;
  const bump = !!(document.getElementById('ac-a-bump')||{}).checked;
  const pub = !!(document.getElementById('ac-a-pub')||{}).checked;
  const campos = {
    titulo: String(val('ac-a-titulo')||'').trim() || a.titulo,
    objetivo: val('ac-a-obj'), resumo: val('ac-a-resumo'), descricao: val('ac-a-desc'),
    video_url: val('ac-a-vurl') || null,
    thumb_url: val('ac-a-thumb') || null,
    duracao_seg: mins ? mins*60 : (a.video_path||val('ac-a-vurl') ? (a.duracao_seg||null) : null),
    materiais: _acLerMateriais(), transcricao: _acLerTranscricao(), atividade: _acLerAtividade(),
    obrigatoria: !!(document.getElementById('ac-a-obrig')||{}).checked,
    publicado: pub,
    publicado_em: pub ? (a.publicado_em || new Date().toISOString()) : null
  };
  if(bump) campos.conteudo_versao = (a.conteudo_versao||1)+1;
  const ok = await acGestaoAtualizarAula(id, campos);
  if(ok){ gToast(bump?'Aula salva e marcada como atualizada':'Aula salva'); acGestaoRenderCorpo(); }
}
// Ponto único de UPDATE de aula (usado pelo form, pelo upload e pela remoção de
// vídeo) — assim o estado local nunca sai de sincronia com o banco.
async function acGestaoAtualizarAula(id, campos){
  const lu=_acLuma(); const a=acAula(id);
  if(!a) return false;
  if(!lu || (acState.curso&&acState.curso._demo)){ gToast('Backend indisponível','error'); return false; }
  try{
    const { data, error } = await lu.from('curso_aulas').update(campos).eq('id', id).select().maybeSingle();
    if(error) throw error;
    // Atualiza a aula DENTRO do módulo (acAula devolve cópia com _modulo)
    const m = acModulo(a.modulo_id);
    if(m && data){
      const i = (m.aulas||[]).findIndex(x=>x.id===id);
      if(i>=0) m.aulas[i] = data;
    }
    return true;
  }catch(e){ _acGestaoErro(e,'a aula'); return false; }
}
async function acGestaoApagarAula(id){
  const a = acAula(id); if(!a) return;
  const ok = await gConfirm(`Excluir a aula "${a.titulo}"? O progresso dos franqueados nesta aula é apagado.`,
                            {title:'Excluir aula', okLabel:'Excluir', danger:true});
  if(!ok) return;
  const lu=_acLuma(); if(!lu) return;
  try{
    const { error } = await lu.from('curso_aulas').delete().eq('id', id);
    if(error) throw error;
    const m = acModulo(a.modulo_id);
    if(m) m.aulas = (m.aulas||[]).filter(x=>x.id!==id);
    if(acEdit.id===id) acEdit={tipo:null,id:null};
    gToast('Aula excluída');
    acGestaoRenderCorpo();
  }catch(e){ _acGestaoErro(e,'a exclusão'); }
}
async function acGestaoMoverAula(id, dir){
  const a = acAula(id); if(!a) return;
  const m = acModulo(a.modulo_id); if(!m) return;
  const aulas = (m.aulas||[]).slice();
  const i = aulas.findIndex(x=>x.id===id), j=i+dir;
  if(i<0||j<0||j>=aulas.length) return;
  const tmp=aulas[i]; aulas[i]=aulas[j]; aulas[j]=tmp;
  m.aulas = aulas;
  acGestaoRenderCorpo();
  const lu=_acLuma(); if(!lu||acState.curso._demo) return;
  try{
    await Promise.all(aulas.map((x,k)=>lu.from('curso_aulas').update({ordem:k}).eq('id',x.id)));
    aulas.forEach((x,k)=>{ x.ordem=k; });
  }catch(e){ _acGestaoErro(e,'a ordem'); }
}

/* ══════════════════════════════════════════════════════════════
   PREVIEW — ver a experiência do franqueado antes de publicar
   Marcado com faixa fixa para NUNCA ser confundido com o app real.
══════════════════════════════════════════════════════════════ */
function acGestaoPreview(){
  acState.preview = true;
  document.body.classList.add('ac-preview');
  acMostrarFaixaPreview();
  acGo('home');
}
function acGestaoPreviewAula(aulaId){
  acState.preview = true;
  document.body.classList.add('ac-preview');
  acMostrarFaixaPreview();
  acGo('aula', aulaId);
}
function acSairPreview(){
  acState.preview = false;
  document.body.classList.remove('ac-preview');
  const f = document.getElementById('ac-faixa-preview'); if(f) f.remove();
  acGo('gestao');
}
function acMostrarFaixaPreview(){
  if(document.getElementById('ac-faixa-preview')) return;
  const el = document.createElement('div');
  el.id = 'ac-faixa-preview';
  el.className = 'ac-faixa-preview';
  el.setAttribute('role','status');
  el.innerHTML = `<span>${AC_ICO.alerta} Preview da equipe — você está vendo a experiência do franqueado, inclusive rascunhos.</span>
    <button type="button" class="ac-btn ac-btn-ghost ac-btn-sm" onclick="acSairPreview()">Sair do preview</button>`;
  document.body.appendChild(el);
}

/* ══════════════════════════════════════════════════════════════
   ACOMPANHAMENTO DA TURMA
   Lê matriculas + aula_progresso (a RLS permite ao designer). NÃO lê anotações
   nem conversas — são privadas por policy, de propósito.
══════════════════════════════════════════════════════════════ */
function acGestaoTurmaHTML(){
  return `<div class="ac-bloco">
    <h2 class="ac-bloco-titulo">Acompanhamento da rede</h2>
    <p class="ac-form-dica">Progresso agregado dos franqueados nesta formação. Anotações pessoais e conversas com o tutor são privadas e não aparecem aqui.</p>
    <div id="ac-turma" aria-live="polite"><div class="ac-sk ac-sk-bloco"></div></div>
  </div>`;
}
async function acGestaoCarregarTurma(){
  const el = document.getElementById('ac-turma'); if(!el) return;
  const lu=_acLuma(), c=acState.curso;
  if(!lu || !c || c._demo){
    el.innerHTML = acVazio('cap','Sem dados de acompanhamento','Os números aparecem quando a formação estiver publicada no banco e os franqueados começarem a estudar.');
    return;
  }
  try{
    const [{ data: mats, error: eM }, { data: prog, error: eP }, { data: certs }] = await Promise.all([
      lu.from('matriculas').select('user_id,iniciado_em,ultimo_acesso,concluido_em').eq('curso_id', c.id),
      lu.from('aula_progresso').select('user_id,concluida').eq('curso_id', c.id),
      lu.from('certificados').select('id').eq('curso_id', c.id)
    ]);
    if(eM) throw eM;
    if(eP) throw eP;
    const total = (mats||[]).length;
    const concl = (mats||[]).filter(m=>m.concluido_em).length;
    const emCurso = total - concl;
    const aulasConcl = (prog||[]).filter(p=>p.concluida).length;
    const obrig = acAulas().filter(a=>a.obrigatoria && a.publicado).length;
    const ativos7 = (mats||[]).filter(m=>{
      if(!m.ultimo_acesso) return false;
      return (Date.now()-new Date(m.ultimo_acesso).getTime()) < 7*24*3600*1000;
    }).length;
    if(!total){
      el.innerHTML = acVazio('cap','Ninguém começou a formação ainda',
        c.publicado?'Assim que um franqueado iniciar, os números aparecem aqui.':'A formação está em rascunho — publique para os franqueados verem.');
      return;
    }
    el.innerHTML = `<dl class="ac-turma-cards">
      ${[['Iniciaram',total],['Em andamento',emCurso],['Concluíram',concl],
         ['Ativos nos últimos 7 dias',ativos7],['Certificados emitidos',(certs||[]).length],
         ['Aulas concluídas (rede)',aulasConcl]]
        .map(([k,v])=>`<div class="ac-turma-card"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}
    </dl>
    ${obrig?`<p class="ac-form-dica">A formação tem ${obrig} aula(s) obrigatória(s) publicada(s) — é o que o certificado exige.</p>`:
      `<p class="ac-form-dica">Nenhuma aula obrigatória publicada: ninguém consegue concluir a formação assim.</p>`}`;
  }catch(e){
    console.warn('[academia/gestão] turma:', e&&e.message||e);
    el.innerHTML = `<div class="ac-aviso ac-aviso-erro">${acIco('alerta')}
      <div><span>Não consegui carregar o acompanhamento agora.</span></div>
      <button type="button" class="ac-btn ac-btn-ghost" onclick="acGestaoCarregarTurma()">Tentar de novo</button></div>`;
  }
}
