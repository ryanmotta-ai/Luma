// ============================================================
// LUMA — Edge Function: invite-user (Fase 2 da gestão de usuários)
// ============================================================
// Cria um membro JÁ COM SENHA PADRÃO (createUser + email_confirm) e ajusta o
// profile (role/nome/telefone). A gestão passa o login pra pessoa: e-mail +
// SENHA_PADRAO; ela troca no primeiro acesso (Perfil › Segurança). Escolhido em
// vez do convite por e-mail (inviteUserByEmail) porque o público (franqueado de
// cidade pequena) usa direto, sem depender de clicar link no e-mail.
// Roda com service_role, por isso TODA a autorização acontece AQUI dentro:
//   1. Caller precisa estar autenticado (JWT no Authorization).
//   2. Caller precisa ser 'gestao' (mesma regra do front: só gestão gerencia).
//   3. Role limitado a franqueado|equipe_dm — 'gestao' não nasce por aqui
//      (promoção a gestão é manual, decisão registrada no schema).
// O trigger handle_new_user cria o profile como 'franqueado' (padrão seguro,
// não confia em metadata); o UPDATE abaixo, já autorizado, define o role real.
//
// SEGUNDA PORTA — cadastro pelo Google Forms (28/10/2026, decisão do Pedro): o Apps Script do
// Form (scripts/cadastro-forms.gs) manda o header x-cadastro-segredo e a conta nasce na hora,
// SEM passar pela gestão e SEMPRE como franqueado. Risco aceito: quem tiver o link do Form
// ganha acesso. Por isso esta função roda com verify_jwt = false (supabase/config.toml): o
// Apps Script não tem JWT, e a porta da gestão continua validando o JWT aqui dentro (getUser).
import { createClient } from "npm:@supabase/supabase-js@2";

// Chave da API: desde a migração de projeto (10/2026) o Luma usa as chaves novas (sb_publishable_ /
// sb_secret_), que a plataforma injeta como JSON por nome em SUPABASE_PUBLISHABLE_KEYS e
// SUPABASE_SECRET_KEYS. As legadas (anon/service_role, JWT assinado com o segredo antigo) foram
// desligadas no projeto novo; ficam aqui só como reserva para um projeto que ainda não as desligou.
function chaveApi(novas: string, legada: string): string {
  try {
    const d = JSON.parse(Deno.env.get(novas) ?? "");
    const v = d?.default ?? Object.values(d ?? {})[0];
    if (typeof v === "string" && v) return v;
  } catch { /* sem as novas: cai na legada */ }
  return Deno.env.get(legada)!;
}

// Senha inicial compartilhada. NÃO é segurança — é credencial temporária de
// primeiro acesso: desde 23/09/2026 o Luma OBRIGA a troca no 1º login, perguntando ao
// banco `luma.usa_senha_inicial()`. ⚠ Mudou a senha aqui? Mude naquela função também.
const SENHA_PADRAO = "dmbrasil";

// Segredo ausente ou curto = porta do Form FECHADA (nunca compara com vazio). Comparação em
// tempo constante para o segredo não vazar pela demora da resposta.
function segredoDoFormConfere(recebido: string | null): boolean {
  const certo = Deno.env.get("CADASTRO_FORMS_SEGREDO") ?? "";
  if (certo.length < 32 || !recebido || recebido.length !== certo.length) return false;
  let dif = 0;
  for (let i = 0; i < certo.length; i++) dif |= certo.charCodeAt(i) ^ recebido.charCodeAt(i);
  return dif === 0;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "método não suportado" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, chaveApi("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"));

    const viaForm = segredoDoFormConfere(req.headers.get("x-cadastro-segredo"));
    if (!viaForm) {
      // 1) Quem chama? (valida o JWT do caller com o client anon + header)
      const caller = createClient(url, chaveApi("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY"), {
        global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      });
      const { data: { user } } = await caller.auth.getUser();
      if (!user) return json({ error: "não autenticado" }, 401);

      // 2) Só gestão convida
      const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).single();
      if (me?.role !== "gestao") return json({ error: "sem permissão — só a gestão convida membros" }, 403);
    }

    // 3) Entrada — pelo Form o role é fixo: o corpo não escolhe permissão
    const body = await req.json().catch(() => ({}));
    const { email, nome, telefone } = body;
    const role = viaForm ? "franqueado" : body.role;
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return json({ error: "e-mail inválido" }, 400);
    if (!["franqueado", "equipe_dm"].includes(role))
      return json({ error: "permissão inválida" }, 400);

    // 4) Cria a conta JÁ com a senha padrão e e-mail confirmado (login imediato,
    //    sem depender de clicar link no e-mail). O trigger cria o profile.
    const { data: created, error: invErr } = await admin.auth.admin.createUser({
      email: email.trim(),
      password: SENHA_PADRAO,
      email_confirm: true,
      user_metadata: { nome: (nome ?? "").toString().trim().slice(0, 120) },
    });
    if (invErr) {
      const msg = /already.*registered|already.*exists|duplicate/i.test(invErr.message)
        ? "este e-mail já tem conta" : invErr.message;
      return json({ error: msg }, 400);
    }

    // 5) Ajusta o profile criado pelo trigger (role real + telefone opcional)
    const patch: Record<string, unknown> = { role };
    // Cortes: pelo Form o texto chega de qualquer pessoa, sem o limite da tela da gestão
    const nomeStr = (nome ?? "").toString().trim().slice(0, 120);
    if (nomeStr) patch.nome = nomeStr;
    const telStr = (telefone ?? "").toString().trim().slice(0, 30);
    if (telStr) patch.telefone = telStr;
    const { error: upErr } = await admin.from("profiles").update(patch).eq("id", created.user.id);
    if (upErr) return json({ error: "conta criada, mas falhou ao gravar o perfil: " + upErr.message }, 500);

    // Devolve a senha padrão pro front mostrar à gestão (não é segredo — é temporária)
    return json({ ok: true, id: created.user.id, senha_padrao: SENHA_PADRAO });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
