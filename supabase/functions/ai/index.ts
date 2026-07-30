// ============================================================
// LUMA — Edge Function: ai (tubulação única de IA)
// ============================================================
// PROBLEMA QUE ESTA FUNCTION RESOLVE: até aqui a chave do Gemini vivia em
// js/00-config.js, servida a TODO browser de franqueado — qualquer DevTools
// lia e gastava a cota da DM, sem freio e sem rastro. Isso fere o guardrail
// "nenhum segredo no código" (luma-brain/06 §7). Agora a chave é secret do
// Supabase (GEMINI_API_KEY) e só existe aqui.
//
// AUTORIZAÇÃO: exige JWT válido (qualquer role autenticada — as 3 personas
// usam IA). Não há dado sensível na resposta; o que se protege é a COTA.
//
// ponytail: este proxy REPASSA o prompt montado pelo front em vez de montar o
// prompt aqui. Motivo: o Luma não tem build/ESM, então prompt no servidor viraria
// prompt DUPLICADO (front precisa dele pro modo transição) — e duplicar motor é
// a proibição nº 1 desta base. Teto assumido: um usuário logado da DM consegue
// gastar tokens com prompt próprio, limitado pelo rate-limit abaixo. Se algum dia
// precisar de controle rígido, os builders de prompt migram pra cá (task por task)
// e o front passa a mandar só payload.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Tarefas conhecidas (só pra log/telemetria e pra recusar uso genérico do proxy).
// `cli` = console interno do time (js/core/console.js), só role equipe_dm/gestao no front.
const TASKS = ["legenda", "encurtar", "ajuda", "cardapio", "casar-fotos", "cli"];

// Tetos por chamada: prompt de peça de marketing é curto; anexo é foto/PDF de cardápio.
const MAX_PROMPT = 12000;      // caracteres
const MAX_PARTS = 8;           // anexos por chamada
const MAX_INLINE_BYTES = 6_000_000; // ~6MB de base64 somados (cardápio em PDF cabe)

// Rate-limit por usuário. ponytail: memória do isolate, não tabela — sem migration e
// sem round-trip no caminho quente. Teto real: o Supabase pode rodar N isolates, então
// o limite é "por instância", não global. Serve pra impedir loop/abuso acidental; se
// precisar de contabilidade exata, virar tabela luma.ai_uso + RPC.
const JANELA_MS = 60_000;
const MAX_POR_JANELA = 20;
const uso = new Map<string, number[]>();
function passouDoLimite(uid: string): boolean {
  const agora = Date.now();
  const marcas = (uso.get(uid) ?? []).filter((t) => agora - t < JANELA_MS);
  marcas.push(agora);
  uso.set(uid, marcas);
  if (uso.size > 500) { // higiene: não deixa o mapa crescer sem fim
    for (const [k, v] of uso) if (!v.some((t) => agora - t < JANELA_MS)) uso.delete(k);
  }
  return marcas.length > MAX_POR_JANELA;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "método não suportado" }, 405);
  try {
    const chave = Deno.env.get("GEMINI_API_KEY");
    if (!chave) return json({ error: "IA não configurada (falta o secret GEMINI_API_KEY)" }, 503);

    // 1) Quem chama? (mesmo padrão do invite-user: valida o JWT com o client anon)
    const caller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "não autenticado" }, 401);
    if (passouDoLimite(user.id)) return json({ error: "muitas chamadas seguidas — espere um minuto" }, 429);

    // 2) Entrada
    const body = await req.json().catch(() => ({}));
    const task = String(body?.task ?? "");
    const prompt = String(body?.prompt ?? "");
    const partes = Array.isArray(body?.parts) ? body.parts : [];
    const modelo = /^[a-z0-9.\-]{3,60}$/i.test(String(body?.model ?? "")) ? String(body.model) : "gemini-flash-latest";
    const querJson = body?.json !== false; // padrão: resposta em JSON (todas as tarefas de hoje)

    if (!TASKS.includes(task)) return json({ error: "tarefa desconhecida" }, 400);
    if (!prompt || prompt.length > MAX_PROMPT) return json({ error: "prompt vazio ou grande demais" }, 400);
    if (partes.length > MAX_PARTS) return json({ error: "anexos demais" }, 400);

    // 3) Anexos (foto/PDF de cardápio): só inlineData com mime de imagem/pdf
    const parts: unknown[] = [{ text: prompt }];
    let bytes = 0;
    for (const p of partes) {
      const mime = String(p?.mimeType ?? "");
      const dados = String(p?.data ?? "");
      if (!/^(image\/(png|jpe?g|webp|gif)|application\/pdf)$/i.test(mime)) return json({ error: "tipo de anexo não aceito" }, 400);
      bytes += dados.length;
      if (bytes > MAX_INLINE_BYTES) return json({ error: "anexos pesados demais" }, 400);
      parts.push({ inlineData: { mimeType: mime, data: dados } });
    }

    // 4) Gemini
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${chave}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: querJson ? { responseMimeType: "application/json" } : {},
      }),
    });
    if (!res.ok) {
      const detalhe = await res.text().catch(() => "");
      console.warn("[ai] Gemini respondeu " + res.status + ": " + detalhe.slice(0, 300));
      return json({ error: "o provedor de IA falhou (" + res.status + ")" }, 502);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text) return json({ error: "resposta vazia do provedor" }, 502);

    return json({ ok: true, task, text });
  } catch (e) {
    console.warn("[ai] falhou:", e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
