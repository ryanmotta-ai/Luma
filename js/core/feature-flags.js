/**
 * js/core/feature-flags.js
 *
 * CONTROLE DO PRODUTO — o motor único de disponibilidade funcional do Luma.
 *
 * Responde a UMA pergunta em todo o app: "este recurso está disponível para
 * esta pessoa, para esta ação?". Registro, cache, sync, resolução, dependências
 * pai/filho e overrides por permissão moram aqui — e SÓ aqui. Nenhum outro
 * arquivo fala com a tabela de flags (a lição do "um interpolador só", aplicada).
 *
 * ⛔ ISTO NÃO É SEGURANÇA. Governa EXPERIÊNCIA (o que aparece, o que pode ser
 * acionado). Quem protege DADO é a RLS. Por isso o fallback é fail-open: sem
 * backend e sem cache, o Luma funciona exatamente como funcionava antes. Uma
 * flag indisponível nunca pode derrubar o produto.
 *
 * QUATRO CAMADAS, nesta ordem:
 *   1. G_FEATURE_REGISTRY  → o que existe (versionado com o código)
 *   2. _gFFValores         → o que a gestão configurou (Supabase + cache local)
 *   3. gFeatureState()     → o estado EFETIVO (default → global → role → pais)
 *   4. gFeatureCan()/DOM   → a aplicação nas interfaces e nos handlers
 *
 * Depende de: core/toast.js (gToast, gEsc), core/auth.js (gCurrentRole,
 * gIsSuperAdmin), core/supabase.js (gSupabase). Carregado ANTES de main.js.
 */

/* ══════════════════════════════════════════════════════════════
   1. REGISTRO ESTÁTICO — a fonte de verdade do que existe
   ──────────────────────────────────────────────────────────────
   Rótulo, descrição e hierarquia ficam AQUI, versionados, não no banco:
   renomear um recurso vira commit, não migration. O banco guarda só o estado
   operacional (ligado/desligado, comportamento, motivo, overrides).

   Campos:
     key        chave estável — depois de publicada, só muda com migration
     label      nome em PT-BR (é o que a gestão lê)
     desc       uma linha explicando o que o recurso faz
     module     agrupador de topo (franqueado | designer | academia | global)
     parent     chave do pai — a cascata sai daqui
     categoria  filtro da tela (modulos|ferramentas|chats|importacao|exportacao|areas)
     behaviors  comportamentos VÁLIDOS para este recurso
     preserva   ações que continuam funcionando mesmo desativado
     tools      ferramentas do Estúdio que esta chave governa (dSetTool)
     tags       termos extras para a busca
══════════════════════════════════════════════════════════════ */

// Ações que a API entende. Nem todo recurso usa todas.
const G_FEATURE_ACOES = ['access','view','create','edit','execute','render','export','load'];

// Ações de leitura pura — o que 'readonly' libera por cima do que o recurso preserva.
const _GFF_ACOES_LEITURA = ['access','view','render','export','load'];

// Conteúdo já criado nunca some porque a ferramenta que o criou foi desligada.
// Esta é A regra do produto: desativar CRIAÇÃO não é desativar EXIBIÇÃO.
const _GFF_PRESERVA_CONTEUDO = ['render','export','load','view'];

const G_FEATURE_REGISTRY = [
  /* ── MÓDULOS (as abas da topbar) ─────────────────────────── */
  { key:'module.franqueado', label:'Franqueado', desc:'A área onde o franqueado escolhe campanhas e gera artes.',
    module:'franqueado', parent:null, categoria:'modulos', behaviors:['hide','maintenance'],
    preserva:['load'], tags:['vitrine','catálogo','home'] },
  { key:'module.academia', label:'Academia', desc:'A formação do franqueado: aulas, materiais e certificado.',
    module:'academia', parent:null, categoria:'modulos', behaviors:['hide','maintenance'],
    preserva:['load'], tags:['formação','curso','aula'], defaultEnabled:false },
  { key:'module.designer', label:'Estúdio', desc:'O editor onde a equipe monta e publica os templates.',
    module:'designer', parent:null, categoria:'modulos', behaviors:['hide','maintenance'],
    preserva:['load'], tags:['designer','editor','canvas'] },

  /* ── FRANQUEADO ──────────────────────────────────────────── */
  { key:'franqueado.catalogo', label:'Catálogo de campanhas', desc:'A vitrine de campanhas e materiais publicados.',
    module:'franqueado', parent:'module.franqueado', categoria:'areas', behaviors:['hide','maintenance'],
    preserva:['load'], tags:['campanha','material','vitrine'] },
  { key:'franqueado.historico', label:'Minhas artes', desc:'O histórico de artes que o franqueado já gerou.',
    module:'franqueado', parent:'module.franqueado', categoria:'areas', behaviors:['hide','maintenance'],
    preserva:['load'], tags:['histórico','artes'] },
  { key:'franqueado.chat', label:'Chat gerador', desc:'A conversa guiada que preenche os campos e gera a arte.',
    module:'franqueado', parent:'module.franqueado', categoria:'chats', behaviors:['hide','disabled','maintenance'],
    preserva:_GFF_PRESERVA_CONTEUDO, tags:['chat','gerar','conversa'] },
  { key:'franqueado.legendas', label:'Assistente de legenda', desc:'Sugestões de legenda para acompanhar a arte.',
    module:'franqueado', parent:'franqueado.chat', categoria:'chats', behaviors:['hide','disabled','maintenance'],
    preserva:_GFF_PRESERVA_CONTEUDO, tags:['legenda','copy','texto'] },
  { key:'franqueado.sheets', label:'Luma Sheets', desc:'Geração de artes em lote a partir de uma planilha.',
    module:'franqueado', parent:'module.franqueado', categoria:'areas', behaviors:['hide','disabled','maintenance'],
    preserva:_GFF_PRESERVA_CONTEUDO, tags:['lote','planilha','csv','bulk'] },

  // ★ Layout vivo: com o campo preenchido, o texto quebra linha e os blocos ancorados abaixo
  //   descem junto, mantendo o respiro que o designer desenhou. É a defesa contra a arte
  //   "apertada" quando o nome do produto é longo.
  //   DOIS interruptores em série, de propósito: esta chave governa a REDE, e
  //   `publishMeta.layoutVivo` governa CADA template — porque ligar muda o layout de uma arte
  //   já publicada, e isso é decisão do designer daquela arte, não da rede.
  //   Desligada aqui: a geometria é exatamente a que o designer publicou (comportamento antigo).
  { key:'franqueado.layout-vivo', label:'Layout que se adapta ao texto', desc:'Quando o texto do franqueado é maior que o espaço, a arte reacomoda os blocos em vez de apertar.',
    module:'franqueado', parent:'module.franqueado', categoria:'areas', behaviors:['hide','disabled'],
    preserva:_GFF_PRESERVA_CONTEUDO, tags:['layout','respiro','hierarquia','texto','quebra'] },

  { key:'franqueado.export', label:'Exportação', desc:'Todos os formatos de download da arte gerada.',
    module:'franqueado', parent:'module.franqueado', categoria:'exportacao', behaviors:['hide','disabled'],
    preserva:['render','view','load'], tags:['baixar','download','exportar'] },
  { key:'franqueado.export.png', label:'Baixar PNG', desc:'Download da arte em PNG (o formato padrão).',
    module:'franqueado', parent:'franqueado.export', categoria:'exportacao', behaviors:['hide','disabled'],
    preserva:['render','view','load'], tags:['png','imagem','baixar'] },
  { key:'franqueado.export.pdf', label:'Baixar PDF', desc:'Download da arte em PDF para impressão.',
    module:'franqueado', parent:'franqueado.export', categoria:'exportacao', behaviors:['hide','disabled'],
    preserva:['render','view','load'], tags:['pdf','impressão','baixar'] },
  { key:'franqueado.export.zip', label:'Baixar lote em ZIP', desc:'Download de todas as artes de um lote de uma vez.',
    module:'franqueado', parent:'franqueado.export', categoria:'exportacao', behaviors:['hide','disabled'],
    preserva:['render','view','load'], tags:['zip','lote','baixar'] },

  /* ── ESTÚDIO ─────────────────────────────────────────────── */
  { key:'designer.tools', label:'Ferramentas de criação', desc:'A régua de ferramentas do Estúdio.',
    module:'designer', parent:'module.designer', categoria:'ferramentas', behaviors:['hide','disabled'],
    preserva:_GFF_PRESERVA_CONTEUDO.concat(['edit']), tags:['toolbar','ferramenta'] },

  { key:'designer.tools.text', label:'Ferramentas de texto', desc:'Criação de camadas de texto no canvas.',
    module:'designer', parent:'designer.tools', categoria:'ferramentas', behaviors:['hide','disabled','maintenance'],
    preserva:_GFF_PRESERVA_CONTEUDO.concat(['edit']), tools:['text','text-h'], tags:['texto','tipografia'] },
  // ★ A primeira flag real. Desativada: some do Estúdio e nenhuma camada vertical
  //   nova é criada por caminho nenhum. As que já existem carregam, aparecem,
  //   são editadas e exportadas exatamente como antes.
  // tools inclui 'mask-text-v': a máscara VERTICAL também cria conteúdo vertical,
  // então depende desta chave além da de máscaras. gFeatureToolBlocked exige as
  // duas liberadas — sem isto, desligar "texto vertical" deixava a máscara
  // vertical como porta dos fundos para criar exatamente o que se quis barrar.
  { key:'designer.tools.text.vertical', label:'Texto vertical', desc:'Criação de camadas de texto em orientação vertical.',
    module:'designer', parent:'designer.tools.text', categoria:'ferramentas', behaviors:['hide','disabled','maintenance'],
    preserva:_GFF_PRESERVA_CONTEUDO.concat(['edit']), tools:['text-v','mask-text-v'], tags:['texto','vertical','estúdio'] },
  { key:'designer.tools.text.mask', label:'Máscaras de texto', desc:'Recorte de uma camada no formato do texto digitado.',
    module:'designer', parent:'designer.tools.text', categoria:'ferramentas', behaviors:['hide','disabled','maintenance'],
    preserva:_GFF_PRESERVA_CONTEUDO.concat(['edit']), tools:['mask-text-h','mask-text-v'], tags:['máscara','recorte','texto'] },

  { key:'designer.tools.shape', label:'Formas', desc:'Retângulo, elipse, triângulo, polígono, estrela e linha.',
    module:'designer', parent:'designer.tools', categoria:'ferramentas', behaviors:['hide','disabled','maintenance'],
    preserva:_GFF_PRESERVA_CONTEUDO.concat(['edit']), tools:['rect','ellipse','triangle','polygon','star','line'], tags:['forma','shape'] },
  { key:'designer.tools.paint', label:'Pintura', desc:'Pincel, borracha, carimbo e borrachas especiais.',
    module:'designer', parent:'designer.tools', categoria:'ferramentas', behaviors:['hide','disabled','maintenance'],
    preserva:_GFF_PRESERVA_CONTEUDO.concat(['edit']), tools:['brush','eraser','stamp','bg-eraser','magic-eraser'], tags:['pincel','pintura','borracha'] },
  { key:'designer.tools.fill', label:'Preenchimento', desc:'Balde de tinta e gradiente.',
    module:'designer', parent:'designer.tools', categoria:'ferramentas', behaviors:['hide','disabled','maintenance'],
    preserva:_GFF_PRESERVA_CONTEUDO.concat(['edit']), tools:['bucket','gradient'], tags:['balde','gradiente','preenchimento'] },
  { key:'designer.tools.effects', label:'Efeitos', desc:'Desfoque, nitidez e dedo.',
    module:'designer', parent:'designer.tools', categoria:'ferramentas', behaviors:['hide','disabled','maintenance'],
    preserva:_GFF_PRESERVA_CONTEUDO.concat(['edit']), tools:['blur','sharpen','smudge'], tags:['desfoque','nitidez','efeito'] },
  { key:'designer.tools.measure', label:'Medição', desc:'Conta-gotas, régua, nota, contagem e classificador de cores.',
    module:'designer', parent:'designer.tools', categoria:'ferramentas', behaviors:['hide','disabled','maintenance'],
    preserva:_GFF_PRESERVA_CONTEUDO.concat(['edit']), tools:['eyedrop','color-sampler','ruler','note','count'], tags:['régua','medida','conta-gotas'] },

  { key:'designer.import', label:'Importação de arquivos', desc:'Trazer artes prontas de fora para o Estúdio.',
    module:'designer', parent:'module.designer', categoria:'importacao', behaviors:['hide','disabled','maintenance'],
    preserva:_GFF_PRESERVA_CONTEUDO, tags:['importar','arquivo'] },
  { key:'designer.import.psd', label:'Importar PSD', desc:'Abrir um arquivo do Photoshop como template editável.',
    module:'designer', parent:'designer.import', categoria:'importacao', behaviors:['hide','disabled','maintenance'],
    preserva:_GFF_PRESERVA_CONTEUDO, tags:['psd','photoshop','importar'] },
  { key:'designer.import.svg', label:'Importar SVG', desc:'Abrir um arquivo vetorial como template editável.',
    module:'designer', parent:'designer.import', categoria:'importacao', behaviors:['hide','disabled','maintenance'],
    preserva:_GFF_PRESERVA_CONTEUDO, tags:['svg','vetor','importar'] },

  { key:'designer.publish', label:'Publicação', desc:'Publicar o template para o catálogo do franqueado.',
    module:'designer', parent:'module.designer', categoria:'areas', behaviors:['hide','disabled','maintenance'],
    preserva:_GFF_PRESERVA_CONTEUDO.concat(['edit']), tags:['publicar','catálogo'] },
  { key:'designer.campos', label:'Campos', desc:'O painel dos campos que o franqueado preenche.',
    module:'designer', parent:'module.designer', categoria:'areas', behaviors:['hide','disabled','readonly'],
    preserva:_GFF_PRESERVA_CONTEUDO, tags:['campo','variável','dados'] },
  { key:'designer.campanhas', label:'Campanhas', desc:'O painel que organiza campanhas e templates.',
    module:'designer', parent:'module.designer', categoria:'areas', behaviors:['hide','disabled','readonly'],
    preserva:_GFF_PRESERVA_CONTEUDO, tags:['campanha','pasta','template'] },
  { key:'designer.assets', label:'Recursos e biblioteca', desc:'Biblioteca de imagens, ícones e fontes da marca.',
    module:'designer', parent:'module.designer', categoria:'areas', behaviors:['hide','disabled','readonly'],
    preserva:_GFF_PRESERVA_CONTEUDO, tags:['asset','biblioteca','fonte'] },
  { key:'designer.checklist', label:'Checklist de qualidade', desc:'A revisão automática do design antes de publicar.',
    module:'designer', parent:'module.designer', categoria:'areas', behaviors:['hide','disabled'],
    preserva:_GFF_PRESERVA_CONTEUDO, tags:['linter','checklist','qualidade'] },

  /* ── GLOBAL ──────────────────────────────────────────────── */
  { key:'global.help', label:'Central de Ajuda', desc:'Artigos, trilha e busca de ajuda dentro do Luma.',
    module:'global', parent:null, categoria:'areas', behaviors:['hide','maintenance'],
    preserva:['load'], tags:['ajuda','suporte','faq'] },
  { key:'global.help.chat', label:'Chat de ajuda', desc:'A conversa de apoio dentro da Central de Ajuda.',
    module:'global', parent:'global.help', categoria:'chats', behaviors:['hide','disabled','maintenance'],
    preserva:['load'], tags:['ajuda','chat','suporte'] },
  { key:'global.tutorials', label:'Tutoriais animados', desc:'Os passo a passo guiados dentro do produto.',
    module:'global', parent:null, categoria:'areas', behaviors:['hide','maintenance'],
    preserva:['load'], tags:['tutorial','onboarding','passo a passo'] }
];

/* Ordem e rótulo dos módulos na tela. Não vem do registro pra não repetir
   o nome em 20 entradas. */
const G_FEATURE_MODULOS = [
  { id:'designer',   label:'Estúdio' },
  { id:'franqueado', label:'Franqueado' },
  { id:'academia',   label:'Academia' },
  { id:'global',     label:'Global' }
];

/* Recursos que NÃO têm chave de propósito — a gestão não pode se trancar do
   lado de fora. Não é "flag proibida": é ausência de flag, que é mais forte.
   A tela mostra esta lista para deixar a fronteira explícita. */
const G_FEATURE_PROTEGIDOS = [
  'Login, logout e sessão',
  'Carregamento do perfil e das permissões',
  'O próprio Controle do produto',
  'O painel da conta (onde este controle vive)'
];

/* ══════════════════════════════════════════════════════════════
   2. ESTADO INTERNO E CACHE
══════════════════════════════════════════════════════════════ */

const _GFF_CACHE_KEY = 'luma_feature_flags_v1';
const _GFF_SCHEMA_VERSION = 1;

// let (não const): é estado compartilhado e re-atribuído no sync — o padrão da casa.
let _gFFValores = {};        // { key: {enabled, comportamento, motivo, overrides} }
let _gFFSyncedAt = null;     // ISO da última leitura do backend
let _gFFOrigem = 'defaults'; // defaults | cache | backend
let _gFFErroSync = null;     // mensagem do último erro de sync (mostrada na tela)
let _gFFIniciado = false;

// Índices derivados do registro (montados uma vez, no init).
let _gFFPorChave = {};
let _gFFFilhos = {};
let _gFFPorTool = {};

function _gFFMeta(key){ return _gFFPorChave[key] || null; }

function _gFFIndexar(){
  _gFFPorChave = {};
  _gFFFilhos = {};
  _gFFPorTool = {};
  G_FEATURE_REGISTRY.forEach(f => {
    _gFFPorChave[f.key] = f;
    if (f.parent) (_gFFFilhos[f.parent] = _gFFFilhos[f.parent] || []).push(f.key);
    // Uma ferramenta pode ser governada por mais de uma chave (a máscara vertical
    // depende de "máscaras de texto" E de "texto vertical"). Guardamos a lista.
    (f.tools || []).forEach(t => { (_gFFPorTool[t] = _gFFPorTool[t] || []).push(f.key); });
  });
}

// Normaliza uma linha (do banco ou do cache) para o formato interno.
function _gFFNormalizar(row){
  const meta = _gFFMeta(row.feature_key);
  let comp = row.disabled_behavior || 'hide';
  // Comportamento fora do que o recurso aceita cai no primeiro válido: um valor
  // gravado por fora da tela não pode produzir um estado que a UI não sabe aplicar.
  if (meta && meta.behaviors && meta.behaviors.indexOf(comp) < 0) comp = meta.behaviors[0] || 'hide';
  const ov = (row.role_overrides && typeof row.role_overrides === 'object') ? row.role_overrides : {};
  return {
    enabled: row.enabled !== false,
    comportamento: comp,
    motivo: row.motivo || '',
    overrides: {
      franqueado: typeof ov.franqueado === 'boolean' ? ov.franqueado : null,
      equipe_dm:  typeof ov.equipe_dm  === 'boolean' ? ov.equipe_dm  : null,
      gestao:     typeof ov.gestao     === 'boolean' ? ov.gestao     : null
    }
  };
}

function gFeatureLoadCache(){
  try {
    const raw = localStorage.getItem(_GFF_CACHE_KEY);
    if (!raw) return false;
    const c = JSON.parse(raw);
    // Cache de outro schema é descartado, não migrado: o formato mudou, o
    // conteúdo não vale mais, e os defaults do registro são um fallback correto.
    if (!c || c.schemaVersion !== _GFF_SCHEMA_VERSION || !c.values) return false;
    Object.keys(c.values).forEach(k => {
      if (_gFFMeta(k)) _gFFValores[k] = _gFFNormalizar(Object.assign({ feature_key:k }, c.values[k]));
    });
    _gFFSyncedAt = c.syncedAt || null;
    _gFFOrigem = 'cache';
    return true;
  } catch(e) { return false; }
}

function _gFFSalvarCache(){
  try {
    const values = {};
    Object.keys(_gFFValores).forEach(k => {
      const v = _gFFValores[k];
      values[k] = { enabled:v.enabled, disabled_behavior:v.comportamento, motivo:v.motivo, role_overrides:v.overrides };
    });
    localStorage.setItem(_GFF_CACHE_KEY, JSON.stringify({
      values, syncedAt:_gFFSyncedAt, schemaVersion:_GFF_SCHEMA_VERSION
    }));
  } catch(e) { /* quota estourada não pode derrubar o app */ }
}

/* ══════════════════════════════════════════════════════════════
   3. RESOLUÇÃO — configurado × efetivo
══════════════════════════════════════════════════════════════ */

// O que a gestão configurou (sem cascata e sem role).
function _gFFConfigurado(key){
  const meta = _gFFMeta(key);
  if (_gFFValores[key]) return _gFFValores[key];
  return {
    enabled: meta ? meta.defaultEnabled !== false : true,
    comportamento: (meta && meta.behaviors && meta.behaviors[0]) || 'hide',
    motivo: '',
    overrides: { franqueado:null, equipe_dm:null, gestao:null }
  };
}

/**
 * O estado completo de um recurso. É a função que todas as outras usam.
 * Ordem de resolução: default do registro → configuração global → override por
 * permissão → estado dos pais.
 *
 * A cascata NÃO altera o estado configurado do filho: um filho ativo sob um pai
 * desligado continua "configurado como ativo", só fica indisponível. Religar o
 * pai devolve cada filho ao próprio estado — sem isso, desligar um grupo
 * apagaria em silêncio a decisão de cada ferramenta dentro dele.
 */
function gFeatureState(key, _prof){
  const meta = _gFFMeta(key);
  // Chave desconhecida → fail-open. Um guard perguntando por uma chave que
  // ninguém registrou não pode bloquear o produto.
  if (!meta) {
    return { key, conhecido:false, configurado:true, efetivo:true, comportamento:'hide',
             motivo:'', bloqueadoPor:null, preserva:G_FEATURE_ACOES.slice(), meta:null };
  }

  const cfg = _gFFConfigurado(key);
  const preserva = meta.preserva || [];

  // Override por permissão vence a configuração global para esta pessoa.
  let ligado = cfg.enabled;
  const role = (typeof gCurrentRole === 'function') ? gCurrentRole() : null;
  if (role && typeof cfg.overrides[role] === 'boolean') ligado = cfg.overrides[role];

  // Cascata pai/filho. Guard de profundidade: o registro é escrito à mão e não
  // tem ciclo, mas um ciclo acidental não pode virar stack overflow no boot.
  let bloqueadoPor = null;
  let comportamento = cfg.comportamento;
  let motivo = cfg.motivo;
  const prof = (_prof || 0);
  if (ligado && meta.parent && prof < 12) {
    const pai = gFeatureState(meta.parent, prof + 1);
    if (!pai.efetivo) {
      bloqueadoPor = pai.bloqueadoPor || meta.parent;
      comportamento = pai.comportamento;
      motivo = pai.motivo;
    }
  }

  return {
    key,
    conhecido: true,
    configurado: cfg.enabled,          // o que a gestão gravou (sem role, sem pai)
    efetivo: ligado && !bloqueadoPor,  // o que vale agora, para esta pessoa
    comportamento,
    motivo,
    bloqueadoPor,                      // chave do ancestral que está derrubando
    overrides: cfg.overrides,
    preserva,
    meta
  };
}

function gFeatureEnabled(key){ return gFeatureState(key).efetivo; }

/**
 * A pergunta que os guards fazem: "posso fazer ESTA ação neste recurso?".
 *
 * A regra que sustenta a promessa do produto: render/export/load continuam
 * verdadeiros mesmo com o recurso desativado, porque estão em `preserva`.
 * Desativar a ferramenta que CRIA nunca pode sumir com o que já foi criado.
 */
function gFeatureCan(key, acao){
  const st = gFeatureState(key);
  if (st.efetivo) return true;
  acao = acao || 'access';
  if (st.preserva.indexOf(acao) >= 0) return true;
  // readonly libera a leitura por cima do que o recurso já preserva.
  if (st.comportamento === 'readonly' && _GFF_ACOES_LEITURA.indexOf(acao) >= 0) return true;
  return false;
}

// Por que está indisponível, em PT-BR, pronto para a tela e para o toast.
function gFeatureReason(key){
  const st = gFeatureState(key);
  if (st.efetivo) return '';
  if (st.bloqueadoPor) {
    const pai = _gFFMeta(st.bloqueadoPor);
    return 'Indisponível porque "' + ((pai && pai.label) || st.bloqueadoPor) + '" está desativado';
  }
  if (st.motivo) return st.motivo;
  if (st.comportamento === 'maintenance') return 'Em manutenção';
  return 'Recurso desativado pela gestão';
}

// Feedback único quando um caminho bloqueado é acionado. Sem alert, sem console.
function gFeatureBlockedFeedback(key){
  const st = gFeatureState(key);
  const nome = (st.meta && st.meta.label) || 'Este recurso';
  const motivo = gFeatureReason(key);
  if (typeof gToast === 'function') {
    gToast(nome + ' está indisponível no momento' + (motivo ? ' — ' + motivo.toLowerCase() : '') + '.', 'error');
  }
}

/**
 * Ferramenta do Estúdio → está liberada? Uma ferramenta pode depender de mais
 * de uma chave (máscara vertical = "máscaras de texto" + "texto vertical");
 * qualquer uma desligada bloqueia. Retorna a chave que bloqueou, ou null.
 */
function gFeatureToolBlocked(tool){
  const keys = _gFFPorTool[tool];
  if (!keys) return null;
  for (let i = 0; i < keys.length; i++) {
    if (!gFeatureCan(keys[i], 'create')) return keys[i];
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════
   4. APLICAÇÃO NO DOM
   ──────────────────────────────────────────────────────────────
   Para elementos estáticos do HTML:
     data-feature="chave"  data-feature-action="create"
   ⛔ Nunca é o ÚNICO bloqueio: o guard no handler é que impede o console, o
   atalho antigo e o menu de contexto. Isto aqui é a camada visual.
══════════════════════════════════════════════════════════════ */
function gFeatureApplyToDOM(root){
  const escopo = root || document;
  let nodes;
  try { nodes = escopo.querySelectorAll('[data-feature]'); } catch(e) { return; }
  nodes.forEach(el => {
    // data-feature aceita MAIS DE UMA chave separada por espaço: um elemento
    // pode depender de duas (a máscara de texto vertical precisa de "máscaras de
    // texto" E de "texto vertical"). Qualquer uma bloqueada esconde o elemento.
    const keys = String(el.getAttribute('data-feature') || '').trim().split(/\s+/).filter(Boolean);
    if (!keys.length) return;
    const acao = el.getAttribute('data-feature-action') || 'access';
    const bloqueada = keys.find(k => !gFeatureCan(k, acao));
    const key = bloqueada || keys[0];
    const st = gFeatureState(key);
    const liberado = !bloqueada;

    // Guarda o display original UMA vez: sem isto, reativar deixaria o
    // elemento com display:'' e quebraria quem dependia de flex/grid inline.
    if (el.dataset.ffDisplay === undefined) el.dataset.ffDisplay = el.style.display || '';

    if (liberado) {
      el.style.display = el.dataset.ffDisplay;
      el.removeAttribute('aria-disabled');
      el.classList.remove('is-feature-off');
      if (el.dataset.ffTabindex !== undefined) {
        if (el.dataset.ffTabindex === '') el.removeAttribute('tabindex');
        else el.setAttribute('tabindex', el.dataset.ffTabindex);
        delete el.dataset.ffTabindex;
      }
      if (el.dataset.ffTitle !== undefined) { el.title = el.dataset.ffTitle; delete el.dataset.ffTitle; }
      return;
    }

    if (st.comportamento === 'hide') {
      el.style.display = 'none';
      return;
    }
    // disabled / readonly / maintenance: fica visível, mas fora do fluxo de
    // teclado e anunciado como indisponível.
    el.style.display = el.dataset.ffDisplay;
    el.setAttribute('aria-disabled', 'true');
    el.classList.add('is-feature-off');
    if (el.dataset.ffTabindex === undefined) el.dataset.ffTabindex = el.getAttribute('tabindex') || '';
    el.setAttribute('tabindex', '-1');
    if (el.dataset.ffTitle === undefined) el.dataset.ffTitle = el.title || '';
    el.title = gFeatureReason(key);
  });
}

/* ══════════════════════════════════════════════════════════════
   5. SYNC COM O BACKEND
══════════════════════════════════════════════════════════════ */

function _gFFSb(){
  try { return (typeof gSupabase === 'function') ? gSupabase() : window.sb; }
  catch(e) { return null; }
}

function _gFFDispararEvento(keys){
  try {
    window.dispatchEvent(new CustomEvent('luma:feature-flags-changed', { detail:{ keys: keys || [] } }));
  } catch(e) {}
}

/**
 * Puxa o estado do Supabase e reconcilia. Nunca lança: sem backend o app segue
 * com cache/defaults — é a diferença entre "uma flag não sincronizou" e "o Luma
 * não abre".
 */
async function gFeatureSyncFromBackend(){
  const sb = _gFFSb();
  if (!sb) { _gFFErroSync = 'Backend não configurado'; return { ok:false, error:_gFFErroSync }; }
  try {
    const { data, error } = await sb.schema('luma').from('feature_flags')
      .select('feature_key,enabled,disabled_behavior,role_overrides,motivo,updated_at');
    if (error) { _gFFErroSync = error.message || 'Falha ao ler as configurações'; return { ok:false, error:_gFFErroSync }; }

    const mudou = [];
    (data || []).forEach(row => {
      if (!_gFFMeta(row.feature_key)) return;  // chave do banco que o front não conhece: ignora
      const novo = _gFFNormalizar(row);
      const velho = _gFFValores[row.feature_key];
      if (!velho || JSON.stringify(velho) !== JSON.stringify(novo)) mudou.push(row.feature_key);
      _gFFValores[row.feature_key] = novo;
    });

    _gFFSyncedAt = new Date().toISOString();
    _gFFOrigem = 'backend';
    _gFFErroSync = null;
    _gFFSalvarCache();
    if (mudou.length) { gFeatureApplyToDOM(); _gFFDispararEvento(mudou); }
    return { ok:true, changed:mudou };
  } catch(e) {
    _gFFErroSync = String((e && e.message) || e);
    return { ok:false, error:_gFFErroSync };
  }
}

/**
 * Grava uma alteração. Só a gestão chega aqui pela tela, mas quem DECIDE é a
 * RLS — o gate no JS é UX (evita a ida ao servidor), não segurança.
 *
 * ⛔ Não atualiza o estado local antes da resposta: "salvo" só pode aparecer
 * depois que o servidor confirmou. Estado otimista aqui viraria mentira na tela
 * quando o backend recusa.
 */
async function gFeatureSave(key, patch){
  const meta = _gFFMeta(key);
  if (!meta) return { ok:false, error:'Recurso desconhecido.' };
  if (typeof gIsSuperAdmin === 'function' && !gIsSuperAdmin()) {
    return { ok:false, error:'Só a gestão altera o Controle do produto.' };
  }
  const sb = _gFFSb();
  if (!sb) return { ok:false, error:'Sem conexão com o servidor. A alteração não foi salva.' };

  const atual = _gFFConfigurado(key);
  let comportamento = patch.comportamento || atual.comportamento;
  if (meta.behaviors && meta.behaviors.indexOf(comportamento) < 0) comportamento = meta.behaviors[0] || 'hide';

  // Override null = herdar → a chave sai do JSON (ausência É a herança).
  const overrides = {};
  const base = Object.assign({}, atual.overrides, patch.overrides || {});
  ['franqueado','equipe_dm','gestao'].forEach(r => { if (typeof base[r] === 'boolean') overrides[r] = base[r]; });

  const linha = {
    feature_key: key,
    enabled: typeof patch.enabled === 'boolean' ? patch.enabled : atual.enabled,
    disabled_behavior: comportamento,
    role_overrides: overrides,
    motivo: (typeof patch.motivo === 'string' ? patch.motivo : atual.motivo) || null,
    atualizado_por: (typeof gCurrentUser === 'function' && gCurrentUser()) ? gCurrentUser().id : null,
    updated_at: new Date().toISOString()
  };

  try {
    const { error } = await sb.schema('luma').from('feature_flags')
      .upsert(linha, { onConflict:'feature_key' });
    if (error) {
      // Toda mensagem que chega ao usuário é em PT-BR e diz O QUE FAZER.
      // "TypeError: Failed to fetch" (rede caída) vinha vazando cru no toast.
      const raw = error.message || '';
      let msg;
      if (/permission|policy|42501|row-level/i.test(raw)) msg = 'Sem permissão para alterar (só a gestão).';
      else if (/failed to fetch|networkerror|load failed|timeout/i.test(raw)) msg = 'Sem conexão com o servidor. A alteração não foi salva — tente de novo.';
      else if (/relation .* does not exist|schema cache|pgrst/i.test(raw)) msg = 'O Controle do produto ainda não foi criado no banco. Aplique a migration de feature flags.';
      else msg = raw || 'Não foi possível salvar.';
      return { ok:false, error:msg };
    }
  } catch(e) {
    return { ok:false, error:'Não foi possível salvar. Verifique a conexão e tente de novo.' };
  }

  _gFFValores[key] = _gFFNormalizar(linha);
  _gFFSyncedAt = new Date().toISOString();
  _gFFSalvarCache();
  gFeatureApplyToDOM();
  // A chave e os descendentes: quem escuta precisa saber que a cascata mudou.
  _gFFDispararEvento([key].concat(_gFFDescendentes(key)));
  return { ok:true };
}

function _gFFDescendentes(key){
  const out = [];
  (_gFFFilhos[key] || []).forEach(f => { out.push(f); out.push.apply(out, _gFFDescendentes(f)); });
  return out;
}

async function gFeatureRefresh(){ return gFeatureSyncFromBackend(); }

/** Histórico de alterações. Só a gestão lê (a RLS garante; isto evita a ida). */
async function gFeatureHistory(limit){
  const sb = _gFFSb();
  if (!sb) return { ok:false, error:'Sem conexão com o servidor.', rows:[] };
  try {
    const { data, error } = await sb.schema('luma').from('feature_flag_history')
      .select('feature_key,operacao,valor_anterior,valor_novo,motivo,created_at')
      .order('created_at', { ascending:false })
      .limit(limit || 40);
    if (error) return { ok:false, error:error.message, rows:[] };
    return { ok:true, rows:data || [] };
  } catch(e) { return { ok:false, error:String((e && e.message) || e), rows:[] }; }
}

/* ══════════════════════════════════════════════════════════════
   6. INIT E DIAGNÓSTICO
══════════════════════════════════════════════════════════════ */

/**
 * SÍNCRONO de propósito, e chamado ANTES de gLoadProfile() no boot.
 * O flash "ferramenta aparece → flags carregam → ferramenta some" só não
 * acontece porque o cache local já está aplicado quando o Estúdio monta.
 */
function gFeatureInit(){
  if (_gFFIniciado) return;
  _gFFIniciado = true;
  _gFFIndexar();
  gFeatureLoadCache();   // falhou? _gFFValores fica vazio e tudo cai nos defaults
  gFeatureApplyToDOM();
}

/** Resumo para a tela e para o console. Números reais, calculados do registro. */
function gFeatureResolveTree(){
  const linhas = G_FEATURE_REGISTRY.map(f => gFeatureState(f.key));
  return {
    total: linhas.length,
    ativos: linhas.filter(s => s.efetivo).length,
    desativados: linhas.filter(s => !s.efetivo && !s.bloqueadoPor && s.comportamento !== 'maintenance').length,
    manutencao: linhas.filter(s => !s.efetivo && !s.bloqueadoPor && s.comportamento === 'maintenance').length,
    porDependencia: linhas.filter(s => !!s.bloqueadoPor).length,
    origem: _gFFOrigem,
    syncedAt: _gFFSyncedAt,
    erro: _gFFErroSync,
    linhas
  };
}

// Estado da sincronização, para a tela mostrar a verdade (e não "sincronizado"
// quando nunca falou com o servidor).
function gFeatureSyncInfo(){
  return { origem:_gFFOrigem, syncedAt:_gFFSyncedAt, erro:_gFFErroSync, temBackend: !!_gFFSb() };
}

// Aba volta ao foco → reconcilia. Outra pessoa da gestão pode ter mudado algo
// enquanto esta janela estava em segundo plano. Sem polling: só neste gatilho,
// depois de salvar, e ao abrir o Controle do produto.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (typeof gCurrentUser !== 'function' || !gCurrentUser()) return;
  gFeatureSyncFromBackend();
});
