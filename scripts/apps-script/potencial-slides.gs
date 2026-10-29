/**
 * Luma — gerador do slide "Potencial" (Google Apps Script, Web App).
 *
 * O Luma (js/potencial/potencial.js) manda um POST com o token do Supabase de quem clicou e os
 * textos já formatados ({cidade_uf:'Aruanã - GO', real_gmv:'R$ 76.464', …}). Este script:
 *   1. confere o token no Supabase e exige role equipe_dm/gestao + conta ativa;
 *   2. copia o deck-modelo (Google Slides) para a pasta de destino;
 *   3. troca cada {{chave}} pelo valor;
 *   4. dá acesso de editor a quem clicou e devolve {ok:true, url} — o Luma abre o link.
 *
 * ⛔ Nenhum segredo no Luma: o endpoint é público, mas sem token válido de equipe não faz nada.
 * ⛔ Os cálculos NÃO moram aqui. O script só troca texto; o número nasce em `potCalcular`.
 *
 * SETUP (uma vez) — Propriedades do script (Configurações do projeto → Propriedades do script):
 *   TEMPLATE_ID        id do deck-modelo (o trecho entre /d/ e /edit na URL do Slides)
 *   SUPABASE_URL       https://xqsazcazsjxajmtmirzd.supabase.co
 *   SUPABASE_ANON_KEY  a chave pública (anon/publishable) do projeto — a mesma de js/core/supabase-config.js
 *   FOLDER_ID          (opcional) pasta do Drive onde guardar as cópias
 * Implantar → Nova implantação → App da Web → Executar como: eu · Quem pode acessar: qualquer pessoa.
 * Cole a URL /exec em luma.potencial_parametros (chave slides_webapp_url).
 */

function doPost(e) {
  try {
    var corpo = JSON.parse(e.postData.contents);
    var propriedades = PropertiesService.getScriptProperties();
    var cfg = {
      template: propriedades.getProperty('TEMPLATE_ID'),
      supaUrl: propriedades.getProperty('SUPABASE_URL'),
      supaKey: propriedades.getProperty('SUPABASE_ANON_KEY'),
      pasta: propriedades.getProperty('FOLDER_ID')
    };
    if (!cfg.template || !cfg.supaUrl || !cfg.supaKey) return _json({ ok: false, erro: 'Gerador sem configuração: faltam propriedades do script.' });

    var quem = _equipe(cfg, corpo.token);
    if (!quem) return _json({ ok: false, erro: 'Sem permissão. Entre de novo no Luma com uma conta da equipe.' });

    var campos = corpo.campos || {};
    if (!campos.cidade_uf) return _json({ ok: false, erro: 'Faltou a cidade.' });

    var modelo = DriveApp.getFileById(cfg.template);
    var nome = 'Estudo de potencial — ' + campos.cidade_uf + ' — ' + Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm');
    var copia = cfg.pasta ? modelo.makeCopy(nome, DriveApp.getFolderById(cfg.pasta)) : modelo.makeCopy(nome);

    var apresentacao = SlidesApp.openById(copia.getId());
    Object.keys(campos).forEach(function (chave) {
      apresentacao.replaceAllText('{{' + chave + '}}', String(campos[chave]));
    });
    apresentacao.saveAndClose();

    // Quem clicou vira editor da cópia (o dono continua sendo quem publicou o script). Se o e-mail do
    // Luma não for uma conta Google, ou a política do Workspace barrar, cai para "quem tem o link só vê".
    try { copia.addEditor(quem.email); }
    catch (_) { try { copia.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (__) {} }

    return _json({ ok: true, url: 'https://docs.google.com/presentation/d/' + copia.getId() + '/edit' });
  } catch (err) {
    return _json({ ok: false, erro: 'Não consegui gerar: ' + err.message });
  }
}

// Valida o JWT no próprio Supabase (GoTrue) e lê o profile com o MESMO token — a RLS decide.
function _equipe(cfg, token) {
  if (!token) return null;
  var cab = { apikey: cfg.supaKey, Authorization: 'Bearer ' + token };
  var u = UrlFetchApp.fetch(cfg.supaUrl + '/auth/v1/user', { headers: cab, muteHttpExceptions: true });
  if (u.getResponseCode() !== 200) return null;
  var usuario = JSON.parse(u.getContentText());
  var id = usuario.id;
  var p = UrlFetchApp.fetch(cfg.supaUrl + '/rest/v1/profiles?id=eq.' + encodeURIComponent(id) + '&select=role,ativo', { headers: cab, muteHttpExceptions: true });
  if (p.getResponseCode() !== 200) return null;
  var linhas = JSON.parse(p.getContentText());
  var perfil = linhas[0];
  return perfil && perfil.ativo !== false && (perfil.role === 'equipe_dm' || perfil.role === 'gestao') ? { id: id, email: usuario.email } : null;
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Rode UMA vez no editor (botão Executar) só para o Google pedir as permissões de Drive, Slides e rede.
function autorizar() {
  DriveApp.getRootFolder();
  UrlFetchApp.fetch('https://www.google.com');
  SlidesApp.openById(PropertiesService.getScriptProperties().getProperty('TEMPLATE_ID'));
}
