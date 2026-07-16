// ============================================================
// LUMA — Edge Function: invite-user (Fase 2 da gestão de usuários)
// ============================================================
// Convida um membro por e-mail (auth.admin.inviteUserByEmail) e ajusta o
// profile (role/nome/telefone). Roda com service_role, por isso TODA a
// autorização acontece AQUI dentro:
//   1. Caller precisa estar autenticado (JWT no Authorization).
//   2. Caller precisa ser 'gestao' (mesma regra do front: só gestão gerencia).
//   3. Role convidado limitado a franqueado|equipe_dm — 'gestao' não nasce por
//      convite (promoção a gestão é manual, decisão registrada no schema).
// O trigger handle_new_user cria o profile como 'franqueado' (padrão seguro,
// não confia em metadata); o UPDATE abaixo, já autorizado, define o role real.
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1) Quem chama? (valida o JWT do caller com o client anon + header)
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "não autenticado" }, 401);

    // 2) Só gestão convida
    const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (me?.role !== "gestao") return json({ error: "sem permissão — só a gestão convida membros" }, 403);

    // 3) Entrada
    const { email, nome, role, telefone } = await req.json().catch(() => ({}));
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return json({ error: "e-mail inválido" }, 400);
    if (!["franqueado", "equipe_dm"].includes(role))
      return json({ error: "permissão inválida" }, 400);

    // 4) Convite (Supabase envia o e-mail; link volta pro app via origin)
    const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(email.trim(), {
      data: { nome: (nome ?? "").toString().trim() },
      redirectTo: req.headers.get("origin") ?? undefined,
    });
    if (invErr) {
      const msg = /already.*registered|already.*exists/i.test(invErr.message)
        ? "este e-mail já tem conta" : invErr.message;
      return json({ error: msg }, 400);
    }

    // 5) Ajusta o profile criado pelo trigger (role real + telefone opcional)
    const patch: Record<string, unknown> = { role };
    const nomeStr = (nome ?? "").toString().trim();
    if (nomeStr) patch.nome = nomeStr;
    const telStr = (telefone ?? "").toString().trim();
    if (telStr) patch.telefone = telStr;
    const { error: upErr } = await admin.from("profiles").update(patch).eq("id", invited.user.id);
    if (upErr) return json({ error: "convite enviado, mas falhou ao gravar o perfil: " + upErr.message }, 500);

    return json({ ok: true, id: invited.user.id });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
