// ============================================================
// LUMA — Edge Function: ai (tubulação única de IA)
// ============================================================
// v2 (23/09/2026): volta a ser o ÚNICO caminho. Entre 11/09 e 23/09 o front falou direto com o
// Gemini com a chave no js/00-config.js (vazou — foi revogada). Agora os dois clientes do front
// (gAskAI em js/core/ai.js e o gateway gAI em js/core/ai/ai-client.js) só chamam aqui.
//
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
// prompt aqui. Motivo: os prompts de cada recurso moram junto do recurso no front
// (sem build/ESM, não há como compartilhar módulo) e duplicá-los aqui seria motor em
// dois lugares — a proibição nº 1 desta base. Teto assumido: um usuário logado da DM consegue
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
// `aula` = tutor da Academia (js/academia/agente.js) — a ÚNICA task cujo prompt é
// montado AQUI: regra pedagógica e limites do tutor não podem morar no cliente.
// `mapear-psd` = importador de PSD do Estúdio (js/designer/psd-import.js): manda a IMAGEM da
// arte + a lista de camadas e recebe camada→campo editável. Prompt montado no front, como as
// outras (só `aula` monta aqui).
// `girias` = o jeito de falar da cidade do franqueado (js/franqueado/chat.js): roda UMA vez
// por cidade, o resultado fica no localStorage e entra no prompt da legenda como tempero.
// `transcrever-audio` = ditado do campo de texto (png-generator.js): anexo de áudio do navegador.
// As com ponto são as tarefas do gateway gAI (js/core/ai/ai-registry.js) — mandam `responseSchema`.
const TASKS = ["legenda", "encurtar", "ajuda", "cardapio", "casar-fotos", "cli", "aula", "mapear-psd", "girias",
  "transcrever-audio",
  "caption.generate", "copy.fit", "content.review", "image.validate", "psd.map", "metadata.suggest",
  "stress.generate", "search.expand"];

// Modelo: o front escolhe (console `modelo`), mas só dentro da família Gemini — nome arbitrário
// não chega na URL do provedor.
const MODELO_PADRAO = "gemini-3.6-flash";
const MODELO_OK = /^gemini-[a-z0-9.\-]{1,40}$/i;
const MAX_SCHEMA = 20000;      // caracteres do responseSchema serializado

// Tetos por chamada: prompt de peça de marketing é curto; anexo é foto/PDF de cardápio.
const MAX_PROMPT = 12000;      // caracteres
const MAX_PARTS = 8;           // anexos por chamada
const MAX_INLINE_BYTES = 6_000_000; // ~6MB de base64 somados (cardápio em PDF cabe)

// Tetos do tutor da Academia (task "aula"): pergunta curta, contexto de aula grande.
const MAX_PERGUNTA = 1500;        // caracteres da dúvida do estudante
const MAX_CONTEXTO = 24000;       // caracteres do bloco de contexto montado abaixo
const MAX_HISTORICO = 8;          // trocas anteriores consideradas

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

// ============================================================
// TUTOR DA ACADEMIA — prompt de sistema versionado (task "aula")
// ------------------------------------------------------------
// Vive no servidor de propósito: as restrições abaixo (não entregar gabarito,
// não inventar política da rede, mandar confirmar com humano em risco) são regra
// de produto — no cliente qualquer DevTools as reescreveria.
// Ao mudar comportamento, SUBA a versão: ela vai no log e permite comparar
// respostas antes/depois sem adivinhação.
// ============================================================
const AULA_PROMPT_V = "2026-07-31.1";
const AULA_SISTEMA = `Você é o tutor da Academia Delivery Much, o agente educacional da Formação do Franqueado.
Seu papel é ajudar o estudante — um franqueado que está implantando a Delivery Much na cidade dele — a COMPREENDER e APLICAR o conteúdo oficial da aula atual.

MÉTODO
- Prefira perguntas orientadoras, pistas, exemplos e verificações de entendimento a respostas mastigadas.
- Quando fizer sentido: confirme a dúvida, descubra o que a pessoa já entendeu, aponte o trecho/conceito relevante, dê uma pista e faça UMA pergunta de checagem.
- Faça no máximo uma pergunta por resposta. Não transforme a conversa em interrogatório.
- Responda direto, sem rodeio socrático, quando: a dúvida for operacional e objetiva; a pessoa só quer localizar um material ou recurso; houver risco de executar um processo errado; ou perguntar de volta só atrasaria.

LIMITES (não negociáveis)
- Use apenas o CONTEXTO OFICIAL fornecido abaixo. Não invente política, processo, prazo, valor, meta ou regra da rede.
- Se a informação não estiver no contexto, diga isso com clareza e indique o caminho: o material da aula, outra aula da formação, ou a equipe Delivery Much.
- Nunca entregue a resposta de uma atividade avaliativa. Você recebe apenas os enunciados, nunca o gabarito: conduza o raciocínio, dê pistas, não conclua por ela.
- Se a dúvida envolver risco operacional, financeiro, jurídico, de segurança ou uma decisão oficial da rede, diga explicitamente que a confirmação humana da equipe Delivery Much é necessária.
- Não fale de outros franqueados nem de dados de gestão. Você não executa ações no sistema.
- Só cite minutagem do vídeo (formato mm:ss) se ela aparecer na transcrição do contexto. Sem transcrição, não invente tempo.

TOM
- Português do Brasil, claro e breve (em geral 2 a 5 frases). Profissional e próximo, sem infantilizar e sem bajular.
- Fale de operação real de franquia, não de teoria abstrata. Trate a pessoa como adulta responsável pelo próprio negócio.
- Texto corrido ou lista curta. Nada de markdown pesado, título nem emoji.`;

function texto(v: unknown, max = 4000): string {
  // Remove caracteres de controle (embaralhariam o prompt) e corta no teto.
  return String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max);
}

/** Monta o prompt do tutor a partir do contexto estruturado enviado pelo front. */
function montaPromptAula(contexto: Record<string, unknown>, pergunta: string): string {
  const c = contexto ?? {};
  const mats = Array.isArray(c.materiais) ? c.materiais : [];
  const ativ = (c.atividade ?? null) as Record<string, unknown> | null;
  const hist = Array.isArray(c.historico) ? (c.historico as Record<string, unknown>[]) : [];
  const prog = (c.progresso ?? {}) as Record<string, unknown>;

  const partes: string[] = [];
  partes.push("CONTEXTO OFICIAL DA AULA");
  partes.push(`Formação: ${texto(c.curso, 200)}`);
  partes.push(`Módulo: ${texto(c.modulo, 200)}`);
  partes.push(`Aula: ${texto(c.aula, 200)}`);
  if (c.objetivo) partes.push(`Objetivo da aula: ${texto(c.objetivo, 800)}`);
  if (c.resumo) partes.push(`Resumo: ${texto(c.resumo, 2500)}`);
  if (c.descricao) partes.push(`Descrição: ${texto(c.descricao, 2500)}`);
  if (mats.length) {
    partes.push("Materiais desta aula: " + mats
      .map((m) => `${texto((m as Record<string, unknown>).titulo, 120)} (${texto((m as Record<string, unknown>).tipo, 30)})`)
      .join("; "));
  }
  if (ativ) {
    partes.push(`Atividade da aula (SEM gabarito — não responda por ela): ${texto(ativ.titulo, 120)}`);
    const ens = Array.isArray(ativ.enunciados) ? ativ.enunciados : [];
    ens.slice(0, 12).forEach((e, i) => partes.push(`  ${i + 1}. ${texto(e, 400)}`));
  }
  if (c.transcricao) {
    partes.push("Transcrição (use os tempos [mm:ss] para citar momentos):");
    partes.push(texto(c.transcricao, 12000));
  } else if (c.tem_video) {
    partes.push("Esta aula tem vídeo, mas SEM transcrição disponível — não cite minutagem.");
  } else {
    partes.push("Esta aula não tem vídeo (é de leitura).");
  }
  partes.push(`Situação do estudante: ${prog.aula_concluida ? "já concluiu esta aula" : "ainda não concluiu esta aula"}; ${Number(prog.pct_formacao) || 0}% da formação concluída${prog.formacao_concluida ? "; já formado (está revisando)" : ""}.`);

  if (hist.length) {
    partes.push("CONVERSA RECENTE NESTA AULA");
    hist.slice(-MAX_HISTORICO).forEach((m) => {
      const quem = String(m.papel) === "usuario" ? "Estudante" : "Tutor";
      partes.push(`${quem}: ${texto(m.texto, 900)}`);
    });
  }

  partes.push("PERGUNTA DO ESTUDANTE");
  partes.push(pergunta);
  partes.push("Responda seguindo o método, os limites e o tom definidos acima.");

  const bloco = partes.join("\n").slice(0, MAX_CONTEXTO);
  return `${AULA_SISTEMA}\n\n${bloco}`;
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
    let prompt = String(body?.prompt ?? "");
    const partes = Array.isArray(body?.parts) ? body.parts : [];
    const modelo = MODELO_OK.test(String(body?.model ?? "")) ? String(body.model) : MODELO_PADRAO;
    const schema = (body?.responseSchema && typeof body.responseSchema === "object") ? body.responseSchema : null;
    if (schema && JSON.stringify(schema).length > MAX_SCHEMA) return json({ error: "schema grande demais" }, 400);
    let querJson = body?.json !== false; // padrão: resposta em JSON (todas as tarefas de hoje)

    if (!TASKS.includes(task)) return json({ error: "tarefa desconhecida" }, 400);

    // Task "aula": o front manda PERGUNTA + CONTEXTO; o prompt é montado aqui.
    // (As outras tasks seguem recebendo o prompt pronto — ver nota do topo.)
    if (task === "aula") {
      const pergunta = prompt.trim();
      if (!pergunta || pergunta.length > MAX_PERGUNTA) {
        return json({ error: "pergunta vazia ou grande demais" }, 400);
      }
      const contexto = (body?.contexto && typeof body.contexto === "object") ? body.contexto : null;
      if (!contexto) return json({ error: "contexto da aula ausente" }, 400);
      prompt = montaPromptAula(contexto as Record<string, unknown>, pergunta);
      querJson = false;   // tutor responde em texto corrido, não JSON
      console.log(`[ai] aula · prompt ${AULA_PROMPT_V} · ${prompt.length} chars`);
    }

    if (!prompt || prompt.length > (task === "aula" ? MAX_CONTEXTO + 4000 : MAX_PROMPT)) {
      return json({ error: "prompt vazio ou grande demais" }, 400);
    }
    if (partes.length > MAX_PARTS) return json({ error: "anexos demais" }, 400);

    // 3) Anexos: imagem/PDF (cardápio, arte do PSD) e áudio (ditado). Só inlineData.
    const parts: unknown[] = [{ text: prompt }];
    let bytes = 0;
    for (const p of partes) {
      // "audio/webm;codecs=opus" → "audio/webm": o parâmetro do codec não muda o tipo.
      const mime = String(p?.mimeType ?? "").split(";")[0].trim();
      const dados = String(p?.data ?? "");
      if (!/^(image\/(png|jpe?g|webp|gif)|application\/pdf|audio\/(webm|ogg|mp4|mpeg|wav|x-m4a|aac))$/i.test(mime)) return json({ error: "tipo de anexo não aceito" }, 400);
      bytes += dados.length;
      if (bytes > MAX_INLINE_BYTES) return json({ error: "anexos pesados demais" }, 400);
      parts.push({ inlineData: { mimeType: mime, data: dados } });
    }

    // 4) Gemini
    // A chave vai no cabeçalho, não na query: URL acaba em log de proxy e de erro.
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: !querJson ? {}
          : schema ? { responseMimeType: "application/json", responseSchema: schema }
          : { responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) {
      const detalhe = await res.text().catch(() => "");
      console.warn("[ai] Gemini respondeu " + res.status + ": " + detalhe.slice(0, 300));
      return json({ error: "o provedor de IA falhou (" + res.status + ")" }, 502);
    }
    const data = await res.json();
    // Junta as partes de texto: modelo com raciocínio pode devolver mais de uma (e as de
    // pensamento vêm marcadas com `thought` — não são resposta).
    const text = ((data?.candidates?.[0]?.content?.parts ?? []) as { text?: string; thought?: boolean }[])
      .map((p) => (p && !p.thought && typeof p.text === "string") ? p.text : "")
      .join("");
    if (!text) return json({ error: "resposta vazia do provedor" }, 502);

    return json({ ok: true, task, text });
  } catch (e) {
    console.warn("[ai] falhou:", e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
