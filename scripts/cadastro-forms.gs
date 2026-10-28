/* ============================================================
   LUMA — Cadastro pelo Google Forms (28/10/2026)
   ------------------------------------------------------------
   Cada resposta do Form vira, na hora, uma conta de FRANQUEADO no Luma: a Edge Function
   invite-user (porta do segredo) cria o login com o e-mail da pessoa e a senha inicial
   dmbrasil, e o Luma obriga a troca no 1º acesso. A franquia, a pessoa escolhe no 1º login.
   Risco aceito (decisão do Pedro): quem tiver o link do Form ganha acesso — mande o link só
   para franqueados.

   INSTALAR (uma vez, dentro do Form):
   1. Três perguntas de "Resposta curta", todas obrigatórias. O título precisa COMEÇAR com
      "Nome", "Telefone" (ou "WhatsApp"/"Celular") e "E-mail".
      No E-mail: ⋮ da pergunta › Validação de resposta › Texto › E-mail.
      Em Configurações › Respostas › Coletar endereços de e-mail: "Não coletar" (senão o
      Form exige login Google, e o e-mail vem da pergunta acima).
   2. ⋮ (no topo do Form) › Editor de scripts. Apague o que vier, cole este arquivo, salve.
   3. Engrenagem (Configurações do projeto) › Propriedades do script › Adicionar:
      CADASTRO_FORMS_SEGREDO = o mesmo valor gravado no Supabase.
   4. Relógio (Acionadores) › Adicionar acionador: função cadastroAoEnviar · origem
      "Do formulário" · evento "Ao enviar o formulário". Autorize com a sua conta.
   5. No Form: Configurações › Apresentação › Mensagem de confirmação (texto pronto em
      docs/LUMA-BACKEND-CHANGELOG.md, 28/10/2026).
   Falhou criar uma conta? Chega um e-mail para quem criou o acionador, com o motivo.
   E-mail que já tinha conta não é falha: a pessoa já tem acesso.
   ============================================================ */
const LUMA_CADASTRO_URL = 'https://xqsazcazsjxajmtmirzd.supabase.co/functions/v1/invite-user';

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
