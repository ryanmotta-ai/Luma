// ============================================================
// LUMA — Edge Function: suporte-telegram (a ponte do suporte ao vivo), 26/09/2026
// ============================================================
// A equipe DM recebe e responde o suporte pelo Telegram, sem o painel do Luma aberto.
// Estudo e decisões: docs/SUPORTE-TELEGRAM.md · banco: 20260926130000_luma_suporte_telegram.sql
//
// DUAS PORTAS, UM SEGREDO. Quem chama manda o cabeçalho X-Telegram-Bot-Api-Secret-Token:
//   · o Telegram (webhook, configurado com secret_token) — traz um Update;
//   · o banco (pg_net no INSERT da fila + pg_cron a cada minuto) — traz {"chute":true}.
// Toda chamada drena a fila luma.suporte_telegram_saida. verify_jwt = false (config.toml): o
// Telegram não manda JWT do Supabase, então a porta é o segredo, conferido aqui.
//
// ⛔ Esta função não decide nada do atendimento. Quem é responsável, a trava contra dois
// atendentes e o histórico são do banco: tudo que chega do Telegram vira
// luma.suporte_telegram_acao, que grava pelo mesmo caminho da resposta dada no Luma.
// ⛔ O link de arquivo do Telegram leva o TOKEN do bot: a imagem é baixada aqui dentro e regravada
// no bucket luma-suporte. O link nunca sai desta função.
import { createClient } from "npm:@supabase/supabase-js@2";

const TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const CHAT = Number(Deno.env.get("TELEGRAM_CHAT_ID") ?? "0"); // supergrupo da equipe (-100…), com tópicos
const SEGREDO = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
const API = `https://api.telegram.org/bot${TOKEN}`;
const BUCKET = "luma-suporte";
const MAX_IMG = 5 * 1024 * 1024; // o mesmo limite do bucket
const MIME_EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const db = sb.schema("luma");

type Msg = { texto: string; anexo_path: string | null; da_equipe: boolean; autor_nome: string | null; contexto: Record<string, string> | null };
type Evt = { tipo: string; ator_nome: string | null; de_nome: string | null; para_nome: string | null };
type Item = {
  id: number; franqueado_id: string; franqueado_nome: string | null; cidade: string | null;
  chat_id: number | null; thread_id: number | null; mensagem: Msg | null; evento: Evt | null;
};

async function rpc<T = unknown>(nome: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(nome, args);
  if (error) throw new Error(`${nome}: ${error.message}`);
  return data as T;
}

async function tg(metodo: string, corpo: Record<string, unknown> | FormData) {
  const r = await fetch(`${API}/${metodo}`, corpo instanceof FormData
    ? { method: "POST", body: corpo }
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  const j = await r.json().catch(() => ({ ok: false, description: `HTTP ${r.status}` }));
  if (!j.ok) {
    const espera = j.parameters?.retry_after ? ` (retry_after ${j.parameters.retry_after}s)` : "";
    throw new Error(`${metodo}: ${j.description ?? "falhou"}${espera}`);
  }
  return j.result;
}

Deno.serve(async (req) => {
  if (!SEGREDO || !TOKEN || !CHAT || req.headers.get("x-telegram-bot-api-secret-token") !== SEGREDO) {
    return new Response("não", { status: 401 });
  }
  const corpo = await req.json().catch(() => ({}));
  try {
    if (typeof corpo.update_id === "number") await tratarUpdate(corpo);
  } catch (e) { console.error("[suporte-telegram] update", e); }
  try { await drenar(); } catch (e) { console.error("[suporte-telegram] fila", e); }
  // 200 sempre: o erro já foi registrado, e um não-2XX faria o Telegram reenviar o mesmo update.
  return new Response("ok");
});

/* ══ Luma → Telegram ══════════════════════════════════════════════════════════════════════ */

async function drenar() {
  const itens = (await rpc<Item[]>("suporte_telegram_pegar", { p_limite: 10 })) ?? [];
  itens.sort((a, b) => a.id - b.id);
  // Falhou um item de um franqueado: os seguintes DELE esperam (o aluguel devolve todos em 2 min,
  // na ordem). Os outros franqueados seguem.
  const travados = new Set<string>();
  for (const it of itens) {
    if (travados.has(it.franqueado_id)) continue;
    try {
      await enviar(it);
      await rpc("suporte_telegram_feito", { p_id: it.id, p_erro: null });
    } catch (e) {
      travados.add(it.franqueado_id);
      await rpc("suporte_telegram_feito", { p_id: it.id, p_erro: String(e) }).catch(() => {});
      if (/retry_after/.test(String(e))) break; // 429: parar tudo, o pg_cron tenta de novo
    }
  }
}

function primeiroNome(nome: string | null | undefined, reserva: string) {
  return String(nome ?? "").trim().split(/\s+/)[0] || reserva;
}

// O mesmo resumo do "Estava em:" do Luma (gSupContextoTexto, js/core/suporte.js).
function contextoTexto(c: Record<string, string> | null) {
  if (!c) return "";
  const partes = [c.campanha, c.material, c.formato].filter(Boolean);
  const modos: Record<string, string> = { franqueado: "Franqueado", designer: "Estúdio", academia: "Implementação", calendario: "Calendário", video: "Vídeo" };
  const onde = partes.length ? partes.join(" › ") : (modos[c.modo] ?? "");
  return [onde, c.tela === "celular" ? "no celular" : ""].filter(Boolean).join(" · ");
}

// Texto simples, sem parse_mode: o que o franqueado escreveu nunca vira marcação no Telegram.
function textoDe(it: Item) {
  const m = it.mensagem, e = it.evento;
  if (m) {
    const quem = m.da_equipe ? `${m.autor_nome || "Equipe"} (pelo Luma)` : primeiroNome(it.franqueado_nome, "Franqueado");
    const corpo = m.texto?.trim() || (m.anexo_path ? "enviou uma imagem." : "");
    const ctx = m.da_equipe ? "" : contextoTexto(m.contexto);
    return `${quem}: ${corpo}${ctx ? `\n(estava em: ${ctx})` : ""}`;
  }
  if (e) {
    const ator = e.ator_nome || "Alguém da equipe";
    if (e.tipo === "assumiu") return `${ator} assumiu o atendimento${e.de_nome && e.de_nome !== e.ator_nome ? ` de ${e.de_nome}` : ""}.`;
    if (e.tipo === "repassou") return `${ator} passou o atendimento para ${e.para_nome || "outra pessoa"}.`;
    if (e.tipo === "resolveu") return `${ator} marcou a conversa como resolvida.`;
    if (e.tipo === "reabriu") return "O franqueado escreveu de novo: a conversa voltou para a fila. Responda aqui ou use /assumir.";
  }
  return "";
}

async function topico(it: Item): Promise<number> {
  if (it.thread_id && it.chat_id === CHAT) return it.thread_id;
  const nome = [it.franqueado_nome || "Franqueado", it.cidade].filter(Boolean).join(" · ").slice(0, 128);
  const t = await tg("createForumTopic", { chat_id: CHAT, name: nome });
  await rpc("suporte_telegram_topico", { p_franqueado: it.franqueado_id, p_chat: CHAT, p_thread: t.message_thread_id });
  it.chat_id = CHAT;
  it.thread_id = t.message_thread_id;
  return t.message_thread_id;
}

async function enviar(it: Item) {
  const texto = textoDe(it);
  if (!texto) return;
  try {
    await postar(await topico(it), texto, it.mensagem?.anexo_path ?? null);
  } catch (e) {
    // Alguém apagou o tópico no Telegram: esquece, recria e tenta uma vez.
    if (!/thread not found|TOPIC_DELETED|TOPIC_ID_INVALID/i.test(String(e))) throw e;
    await rpc("suporte_telegram_topico", { p_franqueado: it.franqueado_id, p_chat: CHAT, p_thread: null });
    it.thread_id = null;
    await postar(await topico(it), texto, it.mensagem?.anexo_path ?? null);
  }
}

async function postar(thread: number, texto: string, anexo: string | null) {
  // protect_content: não encaminha nem salva pelo Telegram (a mensagem tem dado de loja).
  const base = { chat_id: CHAT, message_thread_id: thread, protect_content: true };
  if (anexo) {
    const { data, error } = await sb.storage.from(BUCKET).download(anexo);
    if (error || !data) throw new Error(`anexo: ${error?.message ?? "não baixou"}`);
    const nome = anexo.split("/").pop() ?? "print.png";
    const form = (campo: string) => {
      const f = new FormData();
      for (const [k, v] of Object.entries(base)) f.append(k, String(v));
      f.append("caption", texto.slice(0, 1024));
      f.append(campo, data, nome);
      return f;
    };
    // Print muito comprido (proporção > 20) ou WEBP o sendPhoto recusa: vai como arquivo.
    try { await tg("sendPhoto", form("photo")); }
    catch (e) {
      if (/thread not found|TOPIC_|retry_after/i.test(String(e))) throw e;
      await tg("sendDocument", form("document"));
    }
    return;
  }
  await tg("sendMessage", { ...base, text: texto.slice(0, 4096) });
}

/* ══ Telegram → Luma ══════════════════════════════════════════════════════════════════════ */

type TgMsg = {
  message_id: number; message_thread_id?: number; chat: { id: number; type: string };
  from?: { id: number; is_bot: boolean; first_name?: string; last_name?: string };
  text?: string; caption?: string;
  photo?: { file_id: string; file_size?: number }[];
  document?: { file_id: string; file_size?: number; mime_type?: string };
  video?: unknown; voice?: unknown; audio?: unknown; sticker?: unknown; animation?: unknown; video_note?: unknown;
};

async function aviso(chat: number, texto: string, thread?: number, responderA?: number) {
  await tg("sendMessage", {
    chat_id: chat, text: texto,
    ...(thread ? { message_thread_id: thread } : {}),
    ...(responderA ? { reply_parameters: { message_id: responderA, allow_sending_without_reply: true } } : {}),
  }).catch((e) => console.error("[suporte-telegram] aviso", e));
}
const avisoNoTopico = (m: TgMsg, texto: string) => aviso(m.chat.id, texto, m.message_thread_id, m.message_id);

// Recusa do banco → frase para quem escreveu no Telegram.
function motivo(r: { erro?: string; responsavel_nome?: string } | null) {
  switch (r?.erro) {
    case "outro_responsavel": return `${r.responsavel_nome || "Outra pessoa"} está atendendo esta conversa. Use /assumir para assumir.`;
    case "nao_vinculado": return "Sua conta do Telegram não está vinculada ao Luma. Mande /start para mim no privado.";
    case "destino_invalido": return "Não achei essa pessoa na equipe. Use /repassar e o primeiro nome, como aparece no Luma.";
    case "destino_ambiguo": return "Tem mais de uma pessoa com esse primeiro nome. Repasse pelo Luma.";
    case "sem_conversa": return "Esta conversa não existe mais no Luma.";
    default: return "Não consegui salvar no Luma. Tente de novo.";
  }
}

const HORA = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

async function disponibilidade(m: TgMsg, acao: "disponivel" | "ausente") {
  const r = await rpc<{ ok: boolean; erro?: string; ate?: string }>("suporte_telegram_acao", { p_tg: m.from!.id, p_franqueado: null, p_acao: acao });
  const texto = !r?.ok ? motivo(r)
    : acao === "disponivel" ? `Você está disponível pelo Telegram até ${HORA(r.ate!)}. O franqueado vê você online. /ausente encerra antes.`
    : "Você saiu do online. As conversas continuam chegando aqui.";
  await aviso(m.chat.id, texto, m.message_thread_id, m.message_id);
}

// A maior foto que cabe no limite, ou um documento de imagem. null = não é imagem.
function imagemDa(m: TgMsg): { id: string; mime: string } | null {
  if (m.photo?.length) {
    const p = [...m.photo].sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0)).find((x) => (x.file_size ?? 0) <= MAX_IMG);
    return { id: p?.file_id ?? "", mime: "image/jpeg" }; // foto do Telegram é sempre JPEG
  }
  const d = m.document;
  if (d && MIME_EXT[d.mime_type ?? ""]) return { id: (d.file_size ?? 0) <= MAX_IMG ? d.file_id : "", mime: d.mime_type! };
  return null;
}

async function guardarImagem(img: { id: string; mime: string }, franqueadoId: string): Promise<string | null> {
  if (!img.id) return null;
  const f = await tg("getFile", { file_id: img.id });
  const r = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${f.file_path}`);
  if (!r.ok) return null;
  const blob = await r.blob();
  if (blob.size > MAX_IMG) return null;
  // A pasta é a CONVERSA (o franqueado): é o que a policy do bucket e o Luma esperam.
  const path = `${franqueadoId}/${Date.now()}-tg-${crypto.randomUUID().slice(0, 6)}.${MIME_EXT[img.mime]}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: img.mime });
  return error ? null : path;
}

async function tratarUpdate(u: { update_id: number; message?: TgMsg; edited_message?: TgMsg }) {
  if (!(await rpc<boolean>("suporte_telegram_update", { p_update_id: u.update_id }))) return; // repetido

  // A mensagem do Luma é imutável: editar no Telegram não chega ao franqueado.
  if (u.edited_message) {
    const m = u.edited_message;
    if (m.chat.id === CHAT && m.message_thread_id && !m.from?.is_bot) {
      await avisoNoTopico(m, "A edição não chega ao franqueado. Se precisar corrigir, mande a mensagem de novo.");
    }
    return;
  }
  const m = u.message;
  if (!m?.from || m.from.is_bot) return;
  const texto = (m.text ?? m.caption ?? "").trim();
  const cmd = /^\/([a-z]+)(?:@\w+)?\s*([\s\S]*)$/i.exec(m.text ?? "");
  const comando = cmd ? cmd[1].toLowerCase() : "";

  // Chat privado com o bot: vínculo e disponibilidade.
  if (m.chat.type === "private") {
    if (comando === "start" || comando === "vincular") {
      const nome = [m.from.first_name, m.from.last_name].filter(Boolean).join(" ");
      const codigo = await rpc<string>("suporte_telegram_codigo", { p_tg: m.from.id, p_nome: nome });
      return aviso(m.chat.id, `Seu código: ${codigo}\n\nNo Luma, abra Ajuda › Mensagens e cole em "Vincular Telegram". Vale por 10 minutos.`);
    }
    if (comando === "disponivel" || comando === "ausente") return disponibilidade(m, comando);
    return aviso(m.chat.id, "Comandos: /start vincula sua conta do Luma · /disponivel aparece online para o franqueado · /ausente sai do online.\n\nAs conversas ficam no grupo da equipe, um tópico por franqueado.");
  }

  if (m.chat.id !== CHAT) return; // outro grupo: não é conosco
  if (comando === "disponivel" || comando === "ausente") return disponibilidade(m, comando);
  if (!m.message_thread_id) return; // fora de tópico = conversa da equipe, não do franqueado

  const conv = await rpc<{ franqueado_id: string; vinculado: boolean } | null>("suporte_telegram_conversa",
    { p_tg: m.from.id, p_chat: CHAT, p_thread: m.message_thread_id });
  if (!conv?.franqueado_id) return; // tópico que não é de franqueado
  if (!conv.vinculado) return avisoNoTopico(m, motivo({ erro: "nao_vinculado" }));

  if (comando) {
    if (comando !== "assumir" && comando !== "resolver" && comando !== "repassar") {
      return avisoNoTopico(m, "Neste tópico: responda normalmente, ou use /assumir, /resolver, /repassar <nome>.");
    }
    const r = await rpc<{ ok: boolean; erro?: string; responsavel_nome?: string }>("suporte_telegram_acao",
      { p_tg: m.from.id, p_franqueado: conv.franqueado_id, p_acao: comando, p_texto: cmd![2].trim() });
    // Deu certo: o histórico do atendimento volta para cá pela fila, como linha do tópico.
    if (!r?.ok) await avisoNoTopico(m, motivo(r));
    return;
  }

  const img = imagemDa(m);
  let anexo: string | null = null;
  if (img) {
    anexo = await guardarImagem(img, conv.franqueado_id);
    if (!anexo) return avisoNoTopico(m, "A imagem precisa ser PNG, JPG ou WEBP de até 5 MB.");
  } else if (m.document || m.video || m.voice || m.audio || m.sticker || m.animation || m.video_note) {
    return avisoNoTopico(m, "Só texto e imagem chegam ao franqueado.");
  }
  if (!texto && !anexo) return;
  const r = await rpc<{ ok: boolean; erro?: string; responsavel_nome?: string }>("suporte_telegram_acao",
    { p_tg: m.from.id, p_franqueado: conv.franqueado_id, p_acao: "responder", p_texto: texto.slice(0, 4000), p_anexo: anexo });
  if (!r?.ok) {
    if (anexo) await sb.storage.from(BUCKET).remove([anexo]).catch(() => {});
    await avisoNoTopico(m, motivo(r));
  }
}
