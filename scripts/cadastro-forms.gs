/* ============================================================
   LUMA — Cadastro pelo Google Forms (28/10/2026)
   ------------------------------------------------------------
   Cada resposta do Form vira, na hora, uma conta de FRANQUEADO no Luma: a Edge Function
   invite-user (porta do segredo) cria o login com o e-mail da pessoa e a senha inicial
   dmbrasil, e o Luma obriga a troca no 1º acesso. A franquia, a pessoa escolhe no 1º login.
   Risco aceito (decisão do Pedro): quem tiver o link do Form ganha acesso — mande o link só
   para franqueados.

   INSTALAR (uma vez; o script monta o Form sozinho — o conector do Google não cria Forms):
   1. script.google.com › Novo projeto. Apague o que vier, cole este arquivo, salve.
   2. Escolha a função criarFormDoLuma › Executar › autorize com a sua conta.
   3. No "Registro de execução" saem: o link curto para o WhatsApp, o link de edição e o
      comando `supabase secrets set …` com o segredo que o script acabou de gerar.
   Rodar de novo não cria outro Form: só repete os links e refaz o acionador.
   Falhou criar uma conta? Chega um e-mail para quem rodou o passo 2, com o motivo.
   E-mail que já tinha conta não é falha: a pessoa já tem acesso.
   ============================================================ */
const LUMA_CADASTRO_URL = 'https://xqsazcazsjxajmtmirzd.supabase.co/functions/v1/invite-user';
const LUMA_APP_URL = 'https://luma-deliverymuch.vercel.app';

function criarFormDoLuma() {
  const props = PropertiesService.getScriptProperties();
  let form = null;
  try { if (props.getProperty('FORM_ID')) form = FormApp.openById(props.getProperty('FORM_ID')); } catch (x) {}
  if (!form) {
    form = FormApp.create('Acesso ao Luma — Delivery Much');
    form.setDescription('Preencha para receber o seu acesso ao Luma, a ferramenta de artes da Delivery Much. Leva 1 minuto.');
    form.addTextItem().setTitle('Nome completo').setRequired(true);
    form.addTextItem().setTitle('Telefone (WhatsApp)').setHelpText('Com DDD, ex.: (55) 99999-9999').setRequired(true)
      .setValidation(FormApp.createTextValidation().requireTextMatchesPattern('^[0-9()+\\-\\s]{10,20}$')
        .setHelpText('Digite o telefone com DDD.').build());
    form.addTextItem().setTitle('E-mail').setHelpText('É com este e-mail que você vai entrar no Luma.').setRequired(true)
      .setValidation(FormApp.createTextValidation().requireTextIsEmail().setHelpText('Digite um e-mail válido.').build());
    form.setConfirmationMessage('Pronto! Seu acesso ao Luma foi criado. Entre em ' + LUMA_APP_URL +
      ' com este e-mail e a senha dmbrasil. No primeiro acesso, o Luma pede para você criar a sua própria senha.' +
      ' Se você já tinha acesso, use a senha de sempre.');
    form.setCollectEmail(false);          // o e-mail vem da pergunta; coletar exigiria login Google
    form.setAllowResponseEdits(false);
    form.setShowLinkToRespondAgain(false);
    props.setProperty('FORM_ID', form.getId());
  }
  // Franqueado é de fora do domínio da DM: sem isto o Workspace pode exigir login da empresa.
  try { form.setRequireLogin(false); } catch (x) {}
  // Forms novos nascem sem publicar (mudança do Google em 2025); versões antigas não têm o método.
  if (typeof form.setPublished === 'function') form.setPublished(true);
  form.setAcceptingResponses(true);

  if (!props.getProperty('CADASTRO_FORMS_SEGREDO')) {
    props.setProperty('CADASTRO_FORMS_SEGREDO',
      Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''));
  }
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'cadastroAoEnviar') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('cadastroAoEnviar').forForm(form).onFormSubmit().create();

  console.log('Link para o WhatsApp: ' + form.shortenFormUrl(form.getPublishedUrl()));
  console.log('Editar o Form: ' + form.getEditUrl());
  console.log('Rode no terminal: supabase secrets set CADASTRO_FORMS_SEGREDO=' +
    props.getProperty('CADASTRO_FORMS_SEGREDO') + ' --project-ref xqsazcazsjxajmtmirzd');
}

function cadastroAoEnviar(e) {
  const r = {};
  e.response.getItemResponses().forEach(function (ir) {
    const campo = _cadastroCampo(ir.getItem().getTitle());
    if (campo) r[campo] = String(ir.getResponse() || '').trim();
  });
  const corpo = { nome: r.nome || '', telefone: r.telefone || '', email: (r.email || '').toLowerCase() };
  let motivo = '';
  try {
    const res = UrlFetchApp.fetch(LUMA_CADASTRO_URL, {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      headers: { 'x-cadastro-segredo': PropertiesService.getScriptProperties().getProperty('CADASTRO_FORMS_SEGREDO') || '' },
      payload: JSON.stringify(corpo)
    });
    let dados = {};
    try { dados = JSON.parse(res.getContentText()); } catch (x) {}
    if (res.getResponseCode() === 200 && dados.ok) return;
    if (/já tem conta/.test(dados.error || '')) return;
    motivo = 'HTTP ' + res.getResponseCode() + ' — ' + (dados.error || res.getContentText());
  } catch (err) {
    motivo = String(err);
  }
  // Sem este aviso a falha seria silenciosa: a pessoa já viu "acesso criado" na confirmação do Form.
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(),
    'Luma: acesso NÃO criado para ' + (corpo.email || '(sem e-mail)'),
    'O cadastro pelo Form falhou.\n\nNome: ' + corpo.nome + '\nTelefone: ' + corpo.telefone +
    '\nE-mail: ' + corpo.email + '\n\nMotivo: ' + motivo +
    '\n\nCrie o acesso à mão no Luma (painel de conta › Equipe › Convidar membro) ou confira o segredo e o acionador.');
}

// Acha o campo pelo começo do título, sem acento e sem pontuação: "E-mail" → email.
function _cadastroCampo(titulo) {
  const t = String(titulo).toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
  if (t.indexOf('email') === 0) return 'email';
  if (/^(telefone|whatsapp|celular)/.test(t)) return 'telefone';
  if (t.indexOf('nome') === 0) return 'nome';
  return null;
}
