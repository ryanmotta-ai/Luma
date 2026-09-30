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

// O mais barato que ESTA conta tem (medido em 23/09/2026). Os 2.5 (Flash 0,30/2,50 e Flash-Lite
// 0,10/0,40 por 1M tokens) dão 404: o Google só os abre para conta que já os usava — ficaram fora.
const MODELO_PADRAO = "gemini-3.1-flash-lite";
const MODELO_OK = /^gemini-[a-z0-9.\-]{1,40}$/i;
// Escada, do mais barato para o mais caro (entrada/saída por 1M tokens, 09/2026):
// 3.1 Flash-Lite 0,25/1,50 · 3.6, 3.8 e 3.7 Flash 0,75/3,75 (mesmo preço, filas separadas).
// Desce quando o modelo não existe para a conta (404/403) OU está sem vaga (503 "high demand",
// 429 cota) — cada modelo tem fila própria — e, desde 29/09, também em 500/502/504, demora e
// resposta vazia (ver passo 4). Medido em 23/09/2026: o 3.1 Flash-Lite deu 503 em
// todas as tentativas; o 3.6 Flash respondeu entre 3s e 20s e também deu 503 no pico — daí os
// dois Flash de mesmo preço no fim. ⛔ O 3.5 Flash-Lite (0,30/2,50) FICOU FORA: levou 25s para
// um "olá" e empurrava a chamada para além do timeout de 45s do front.
const MODELOS_RESERVA = ["gemini-3.1-flash-lite", "gemini-3.6-flash", "gemini-3.8-flash", "gemini-3.7-flash"];
const DESCE = new Set([403, 404, 429, 500, 502, 503, 504]);

// POLÍTICA POR TAREFA (29/09/2026): teto de saída e nível de pensamento. O pensamento é cobrado
// como saída e o teto INCLUI o pensamento — bateu no teto raciocinando, a resposta vem cortada ou
// vazia (e cobrada). Por isso os tetos têm folga larga sobre a maior resposta legítima medida em
// 14 dias (caption 304, image 604 e copy.fit 956 já com pensamento no 3.6 Flash): o teto é rede de
// segurança; quem economiza é o nível. Lista longa (cardápio, PSD) ganha teto de lista longa.
// `pensar: null` = não manda o parâmetro (o modelo decide) — é o caso do tutor.
type Pensar = "MINIMAL" | "LOW" | null;
// `temp` (opcional): temperatura. A legenda do Flash-Lite a 1.0 (padrão) esquecia regra fixa (acento no
// whatsapp, hashtags) em ~1 de 3 amostras reais (29/09/2026); 0.5 segura a regra e ainda varia as 3 opções.
const POLITICA: Record<string, { max: number; pensar: Pensar; temp?: number }> = {
  "caption.generate": { max: 2048, pensar: "MINIMAL", temp: 0.5 },
  "legenda": { max: 2048, pensar: "MINIMAL", temp: 0.5 },
  "copy.fit": { max: 1536, pensar: "MINIMAL" },
  "encurtar": { max: 1536, pensar: "MINIMAL" },
  "content.review": { max: 1536, pensar: "MINIMAL" },
  "image.validate": { max: 1536, pensar: "MINIMAL" },
  "search.expand": { max: 1536, pensar: "MINIMAL" },
  "metadata.suggest": { max: 1536, pensar: "MINIMAL" },
  "girias": { max: 1536, pensar: "MINIMAL" },
  "ajuda": { max: 2048, pensar: "LOW" },
  "cli": { max: 4096, pensar: "LOW" },
  "stress.generate": { max: 4096, pensar: "LOW" },
  "transcrever-audio": { max: 8192, pensar: "MINIMAL" },
  "casar-fotos": { max: 8192, pensar: "LOW" },
  "cardapio": { max: 16384, pensar: "LOW" },
  "mapear-psd": { max: 16384, pensar: "LOW" },
  "psd.map": { max: 16384, pensar: "LOW" },
  "aula": { max: 8192, pensar: null },
};
const POLITICA_PADRAO = { max: 8192, pensar: "LOW" as Pensar };
// Quem aceita thinkingConfig.thinkingLevel, e com quais níveis — tabela "Thinking levels" de
// https://ai.google.dev/gemini-api/docs/thinking (lida em 29/09/2026). O campo em modelo sem
// pensamento devolve 400 (referência do generateContent), e 400 PARA a escada: modelo fora desta
// lista não recebe o parâmetro. ⛔ O 3.1 Flash-Lite não aparece na tabela (só o -image): fica sem.
const NIVEIS: Record<string, string[]> = {
  "gemini-3.6-flash": ["MINIMAL", "LOW", "MEDIUM", "HIGH"],
  "gemini-3.7-flash": ["LOW", "MEDIUM", "HIGH"],
  "gemini-3.8-flash": ["LOW", "MEDIUM", "HIGH"],
};
function nivelPara(m: string, pensar: Pensar): string | null {
  const ok = NIVEIS[m];
  if (!pensar || !ok) return null;
  if (ok.includes(pensar)) return pensar;
  return ok.includes("LOW") ? "LOW" : null;   // sem MINIMAL no modelo → o menor que ele tem
}

// Schema em uma linha para as reservas: {issues:[{severity:"warning"|"info", field:string, …}]}.
// Colar o JSON inteiro do schema inchava a entrada em ~45% (medido na legenda pela NVIDIA).
function schemaCurto(s: Record<string, unknown> | null | undefined, fundo = 0): string {
  if (!s || typeof s !== "object" || fundo > 6) return "any";
  const tipo = String(s.type ?? "").toUpperCase();
  if (Array.isArray(s.enum) && s.enum.length) return s.enum.map((v) => JSON.stringify(v)).join("|");
  if (tipo === "ARRAY") return "[" + schemaCurto(s.items as Record<string, unknown>, fundo + 1) + "]";
  if (tipo === "OBJECT") {
    const props = (s.properties ?? {}) as Record<string, Record<string, unknown>>;
    const req = Array.isArray(s.required) ? s.required : [];
    return "{" + Object.keys(props).map((k) => k + (req.includes(k) ? "" : "?") + ":" + schemaCurto(props[k], fundo + 1)).join(", ") + "}";
  }
  return tipo ? tipo.toLowerCase() : "any";
}

// Reservas fora do Google, todas no formato OpenAI (/chat/completions). Entram em ordem, EM PARALELO
// com o Gemini quando ele fica HEDGE_MS calado ou falha (ver passo 5); cada uma que der erro passa
// para a próxima. Secret ausente = provedor pulado. ⛔ Só texto: chamada com anexo (foto, PDF, áudio) não
// desce — os modelos abaixo não leem arquivo. Ordem = da cota mais folgada para a mais apertada:
// · NVIDIA NIM (free ~40 req/min POR CHAVE — 2 chaves, 2 cotas). UM MODELO DIFERENTE POR CHAVE: o
//   Llama 3.3 70B saiu do catálogo em 26/08/2026 (410 Gone) e derrubou as duas de uma vez. Modelos
//   de instrução, sem raciocínio exposto (o texto de "pensamento" quebraria o JSON). Conferir o
//   catálogo vivo em https://integrate.api.nvidia.com/v1/models antes de trocar.
// · Ollama Cloud (cota por hora/semana). gpt-oss 120B.
// · Cloudflare Workers AI (free 10 mil neurons/dia). A URL leva o account id: vem do secret
//   CLOUDFLARE_ACCOUNT_ID ou é descoberto pela própria chave (GET /accounts).
// · OpenRouter (free ~50 req/dia sem crédito — a mais apertada, fica por último). `openrouter/free`
//   sorteia um modelo gratuito disponível: os `:free` somem e mudam de nome com frequência.
const RESERVAS = [
  { nome: "nvidia", secret: "NVIDIA_API_KEY", url: "https://integrate.api.nvidia.com/v1/chat/completions", modelo: "google/gemma-4-31b-it" },
  { nome: "nvidia2", secret: "NVIDIA2_API_KEY", url: "https://integrate.api.nvidia.com/v1/chat/completions", modelo: "deepseek-ai/deepseek-v4.1-flash" },
  { nome: "ollama", secret: "OLLAMA_API_KEY", url: "https://ollama.com/v1/chat/completions", modelo: "gpt-oss:120b" },
  { nome: "cloudflare", secret: "CLOUDFLARE_API_KEY", url: "", modelo: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
  { nome: "openrouter", secret: "OPENROUTER_API_KEY", url: "https://openrouter.ai/api/v1/chat/completions", modelo: "openrouter/free" },
];
// Tempos (29/09/2026, a partir de 203 chamadas reais de 14 dias). O front desiste aos 45s.
const PRAZO_MS = 38_000;           // a chamada inteira: sobra margem para rede e cold start até os 45s
const GEMINI_1_MS = 15_000;        // 1º degrau: o 3.1 Flash-Lite responde 90% dos casos em até 14s
const GEMINI_N_MS = 10_000;        // degraus seguintes
const RESERVA_TIMEOUT_MS = 12_000; // cada reserva
const HEDGE_MS = 8_000;            // Gemini calado por 8s → reservas entram em paralelo (só texto)

async function urlCloudflare(chave: string): Promise<string> {
  let conta = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "";
  if (!conta) {
    const r = await fetch("https://api.cloudflare.com/client/v4/accounts", {
      headers: { Authorization: "Bearer " + chave }, signal: AbortSignal.timeout(5000),
    });
    conta = String((await r.json().catch(() => ({})))?.result?.[0]?.id ?? "");
    if (!conta) throw new Error("account id não encontrado — crie o secret CLOUDFLARE_ACCOUNT_ID");
  }
  return `https://api.cloudflare.com/client/v4/accounts/${conta}/ai/v1/chat/completions`;
}
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
    const chave = Deno.env.get("GEMINI_API_KEY") ?? "";
    const reservas = RESERVAS.map((r) => ({ ...r, chave: Deno.env.get(r.secret) ?? "" })).filter((r) => r.chave);
    if (!chave && !reservas.length) return json({ error: "IA não configurada (falta o secret GEMINI_API_KEY)" }, 503);

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
    // Pedido do front vale só se for um degrau da escada: um nome fora dela (o 2.5 de um front em
    // cache, um palpite no console) custaria um 404 em toda chamada antes de cair na reserva.
    const pedido = String(body?.model ?? "");
    const modelo = MODELO_OK.test(pedido) && MODELOS_RESERVA.includes(pedido) ? pedido : MODELO_PADRAO;
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

    // 4) Orçamento de tempo: UM prazo para a chamada inteira, abaixo dos 45s do front. Antes cada
    // tentativa não tinha teto — um Gemini travado comia os 45s, o front desistia e as reservas
    // nunca chegavam a ser tentadas (medido em 29/09/2026: 15% das chamadas em timeout, 24% em 502,
    // reserva respondeu 4 vezes em 203). O prazo também cai quando o navegador desiste (req.signal):
    // ninguém mais esperando = para de gastar cota.
    const t0 = Date.now();
    const resta = () => PRAZO_MS - (Date.now() - t0);
    const prazo = AbortSignal.any([AbortSignal.timeout(PRAZO_MS), ...(req.signal ? [req.signal] : [])]);
    let status = 503;
    type Resposta = { text: string; modelo: string; tokens: { in: number; out: number } | null };

    // Gemini em escada. Cada degrau tem teto próprio e desce também por demora, rede, erro do lado
    // de lá (500/502/504) e resposta vazia — não só por 403/404/429/503.
    const pol = POLITICA[task] ?? POLITICA_PADRAO;
    // Cada chamada costuma subir uma instância nova ("booted" no log), então não adianta lembrar
    // recusa em memória: a escada curta e sem modelo sabidamente morto é o que poupa tempo.
    const escada = [modelo, ...MODELOS_RESERVA.filter((m) => m !== modelo)];
    const viaGemini = async (fila: string[], sinal: AbortSignal): Promise<Resposta | null> => {
      if (!chave) return null;
      const base: Record<string, unknown> = !querJson ? {}
        : schema ? { responseMimeType: "application/json", responseSchema: schema }
        : { responseMimeType: "application/json" };
      base.maxOutputTokens = pol.max;
      if (pol.temp != null) base.temperature = pol.temp;
      const semNivel = new Set<string>();   // modelo que recusou o thinkingConfig (400): vai sem
      for (let i = 0; i < fila.length; i++) {
        const m = fila[i];
        const teto = Math.min(i === 0 && m === modelo ? GEMINI_1_MS : GEMINI_N_MS, resta());
        if (teto < 1000 || sinal.aborted) return null;
        const nivel = semNivel.has(m) ? null : nivelPara(m, pol.pensar);
        const cfg = nivel ? { ...base, thinkingConfig: { thinkingLevel: nivel } } : base;
        try {
          // A chave vai no cabeçalho, não na query: URL acaba em log de proxy e de erro.
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
            body: JSON.stringify({ contents: [{ parts }], generationConfig: cfg }),
            signal: AbortSignal.any([sinal, AbortSignal.timeout(teto)]),
          });
          status = res.status;
          if (!res.ok) {
            console.warn(`[ai] Gemini ${m} respondeu ${res.status}: ` + (await res.text().catch(() => "")).slice(0, 300));
            if (DESCE.has(res.status)) continue;
            // 400 com o nível de pensamento: pode ser o parâmetro — repete o MESMO modelo sem ele,
            // uma vez. Sem isto, um nível recusado derrubava a validação de foto (anexo não tem reserva).
            if (res.status === 400 && nivel) { semNivel.add(m); i--; continue; }
            return null;   // 400 e afins: o pedido é que está errado, outro Gemini daria o mesmo
          }
          const data = await res.json();
          // Bateu no teto: JSON cortado no meio não serve a ninguém — desce em vez de devolvê-lo.
          if (data?.candidates?.[0]?.finishReason === "MAX_TOKENS") {
            console.warn(`[ai] Gemini ${m} bateu no teto de ${pol.max} tokens (${task}) — descendo`);
            continue;
          }
          // Pensamento (thoughtsTokenCount) é cobrado como saída no Gemini.
          const u = data?.usageMetadata;
          const tokens = u ? { in: Number(u.promptTokenCount) || 0, out: (Number(u.candidatesTokenCount) || 0) + (Number(u.thoughtsTokenCount) || 0) } : null;
          // Junta as partes de texto: modelo com raciocínio pode devolver mais de uma (e as de
          // pensamento vêm marcadas com `thought` — não são resposta).
          const text = ((data?.candidates?.[0]?.content?.parts ?? []) as { text?: string; thought?: boolean }[])
            .map((p) => (p && !p.thought && typeof p.text === "string") ? p.text : "")
            .join("");
          if (text) return { text, modelo: m, tokens };
          console.warn(`[ai] Gemini ${m} veio vazio`);
        } catch (e) {
          if (sinal.aborted) return null;
          console.warn(`[ai] Gemini ${m} ${(e as Error)?.name === "TimeoutError" ? `passou de ${teto}ms` : "falhou na rede"} — descendo`);
        }
      }
      return null;
    };

    // Reservas fora do Google, em ordem, cada uma com teto — só texto (não leem anexo).
    const instrucao = !querJson ? "Responda em português do Brasil."
      : "Responda APENAS com JSON válido, sem markdown e sem texto fora do JSON." +
        (schema ? " Formato (campo?: opcional): " + schemaCurto(schema) : "");
    const viaReservas = async (sinal: AbortSignal): Promise<Resposta | null> => {
      for (const rv of reservas) {
        // Guarda GEMINI_N_MS para o degrau caro, que vem depois (passo 5): sem isto, reservas
        // penduradas comiam os 38s e a chamada morria em 504 com o 3.6 Flash nem tentado.
        const teto = Math.min(RESERVA_TIMEOUT_MS, resta() - (chave ? GEMINI_N_MS : 0));
        if (teto < 1000 || sinal.aborted) return null;
        try {
          const url = rv.url || await urlCloudflare(rv.chave);
          const r = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + rv.chave },
            body: JSON.stringify({
              model: rv.modelo, temperature: pol.temp ?? 0.6, max_tokens: pol.max,
              messages: [{ role: "system", content: instrucao }, { role: "user", content: prompt }],
            }),
            signal: AbortSignal.any([sinal, AbortSignal.timeout(teto)]),
          });
          if (!r.ok) {
            console.warn(`[ai] reserva ${rv.nome} respondeu ${r.status}: ` + (await r.text().catch(() => "")).slice(0, 300));
            continue;
          }
          const d = await r.json();
          if (d?.choices?.[0]?.finish_reason === "length") {
            console.warn(`[ai] reserva ${rv.nome} bateu no teto de ${pol.max} tokens (${task}) — próxima`);
            continue;
          }
          const tokens = d?.usage ? { in: Number(d.usage.prompt_tokens) || 0, out: Number(d.usage.completion_tokens) || 0 } : null;
          // Modelo aberto às vezes embrulha o JSON em ```json … ```: tira a cerca.
          const text = String(d?.choices?.[0]?.message?.content ?? "").trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
          if (text) return { text, modelo: rv.nome + ":" + String(d?.model || rv.modelo), tokens };
          console.warn(`[ai] reserva ${rv.nome} veio vazia`);
        } catch (e) {
          if (sinal.aborted) return null;
          console.warn(`[ai] reserva ${rv.nome} falhou:`, String((e as Error)?.message ?? e));
        }
      }
      return null;
    };

    // 5) Disparo em paralelo: se o Gemini não respondeu em HEDGE_MS (ou já falhou), as reservas
    // entram JUNTO com ele — fica a primeira que responder, a outra é abortada. Só em chamada de
    // texto: com anexo não há reserva, a escada Gemini é o caminho inteiro.
    // Rota por custo (29/09/2026, só texto): ao lado das reservas corre SÓ o 1º degrau (o pedido,
    // Flash-Lite); os Flash de 0,75/3,75 — que ainda pensam — entram por último, depois que as
    // reservas grátis falharam, e só se sobrar prazo.
    const ctrlG = new AbortController();
    const ctrlR = new AbortController();
    let r: Resposta | null;
    if (parts.length > 1 || !reservas.length) {
      r = await viaGemini(escada, prazo);
    } else {
      r = await new Promise<Resposta | null>((resolve) => {
        let pendentes = 2;
        let reservasNoAr = false;
        const fim = (x: Resposta | null) => { if (x) resolve(x); else if (--pendentes === 0) resolve(null); };
        const disparaReservas = () => {
          if (reservasNoAr) return;
          reservasNoAr = true;
          clearTimeout(relogio);
          viaReservas(AbortSignal.any([prazo, ctrlR.signal])).then(fim, () => fim(null));
        };
        const relogio = setTimeout(disparaReservas, HEDGE_MS);
        viaGemini(escada.slice(0, 1), AbortSignal.any([prazo, ctrlG.signal])).then((x) => {
          if (x) clearTimeout(relogio); else disparaReservas();
          fim(x);
        }, () => { disparaReservas(); fim(null); });
      });
      if (!r) r = await viaGemini(escada.slice(1), prazo);
    }
    ctrlG.abort();
    ctrlR.abort();

    if (!r) {
      const estourou = resta() < 1000;
      return json({ error: estourou ? "a IA demorou demais para responder" : "o provedor de IA falhou (" + status + ")" }, estourou ? 504 : 502);
    }

    // `modelo` = o que respondeu de fato (pode ser a reserva): vai para a telemetria de custo.
    return json({ ok: true, task, text: r.text, modelo: r.modelo, tokens: r.tokens });
  } catch (e) {
    console.warn("[ai] falhou:", e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
