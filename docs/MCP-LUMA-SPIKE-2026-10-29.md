# Spike — servidor MCP oficial do Luma (29/10/2026)

> Resultado do spike: **viável, e o PoC já roda** (`mcp/luma-mcp.js`, Node puro, zero dependência).
> A decisão central: o MCP **não é um segundo motor**. Ele é uma casca de protocolo sobre o harness que
> já existe (`.claude/skills/luma/arte/ferramentas/render.js`), que carrega o motor real
> (`fRenderTemplateLayers` + Local Fit) num Chromium headless.

## 1. Por que dá certo aqui
- O motor de render vive no **navegador** (Canvas 2D, `js/franqueado/png-generator.js`, `js/00-config.js`, `js/core/local-fit.js`), sem build e sem Node. Reescrever em Node seria o segundo render (`03_ENGINEERING` §1).
- O harness já resolve isso: servidor estático local + Chromium headless + `harness.html`. O MCP só chama o harness.
- O protocolo MCP sobre stdio é JSON-RPC por linha: cabe em ~100 linhas sem SDK, coerente com "zero dependência nova".

## 2. Levantamento — o que expor (e o que fica para depois)

| Capacidade | Onde mora hoje | Status no MCP |
|---|---|---|
| Render de arte (layers + dados → PNG + veredito de encaixe) | `fRenderTemplateLayers` (`png-generator.js`) + `gLocalFitArte` (`local-fit.js`) via `render.js` | ✅ **`luma_render`** |
| Teste de estresse (7 variantes: título longo, sem detalhes, sem "de", preço 1/3 dígitos, sem preço) | `ESTRESSE` em `ferramentas/lib.js` | ✅ **`luma_estresse`** |
| Blocos de layer (rect, text, foto, preço partido, selo, ticket…) | `ferramentas/lib.js` | ✅ **`luma_bloco`** |
| Medição de PNG (bordas, cor, paleta, caixa) | `ferramentas/medir.js` | ✅ **`luma_medir`** |
| Regras de marca, motor, design, negócio | `ARTE.md`, `MOTOR.md`, `DESIGN.md`, `01_BUSINESS.md` | ✅ **recursos** `luma://doc/*` |
| Fluxo "arte de preço" | `ARTE.md` + `REFINO-15.md` | ✅ **prompt** `arte_de_preco` |
| Ler templates do catálogo (`luma.templates`) | Supabase, protegido por **RLS** | ⏳ fase 2 (ver §4) |
| Gravar/publicar template | Supabase + changelog + reversão (`arte/BANCO.md`) | ⏳ fase 2, **sempre com confirmação humana** |
| Importar PSD → layers | `psd-parse.js` (agPsd **no navegador**) | ⏳ fase 2: mesmo harness, página nova |
| Interpolar `{{campo}}` / catálogo de variáveis | `gInterpolate` (`00-config.js`), `luma.variaveis` | já embutido no `luma_render`; tool própria só se pedirem |
| Story animado (MP4), PDF, Instagram/WhatsApp | `motion.js`, `png-generator.js` | ❌ fora do escopo (ação do franqueado, não do estúdio) |

## 3. Arquitetura do PoC
```
agente (Claude Code / Desktop / Ateliê) ──stdio JSON-RPC──▶ mcp/luma-mcp.js
                                                             │ execFile
                                                             ▼
                                   render.js ─▶ serve.js (symlinks js/ css/ assets/) ─▶ Chromium headless ─▶ harness.html
                                                                                              └─ fRenderTemplateLayers + Local Fit
```
- Cada chamada usa arquivos temporários próprios (`os.tmpdir()/luma-mcp-*`), limpos na saída.
- `INVÁLIDA` no retorno = o Local Fit bloquearia o franqueado; é o mesmo critério do portão de arte.
- `render.js` ganhou o caminho do Chrome do macOS (antes só achava `chromium` no PATH).

### Como usar
```bash
claude mcp add luma -- node "/caminho/para/Luma/mcp/luma-mcp.js"
```
Requisitos: Node ≥ 18 e Google Chrome/Chromium (ou `CHROME=/caminho`). Cada render leva ~5–10 s (Chromium sobe a cada chamada).

## 4. Documentação das ferramentas

| Ferramenta | Entrada | Saída |
|---|---|---|
| `luma_render` | `layers` (obrigatório), `dados`, `W`, `H`, `fmt` | PNG + `status`/`INVÁLIDA` + encaixe por campo |
| `luma_estresse` | igual ao `luma_render` | resumo das 7 variantes + PNG da primeira com problema |
| `luma_bloco` | `bloco`, `args[]` (sem `bloco` lista os disponíveis) | JSON de layer(s) pronto para `layers` |
| `luma_medir` | `cmd` (`bordas`/`cor`/`paleta`/`caixa`), `png`, `args[]` | texto com a medida |

**Recursos:** `luma://doc/arte`, `motor`, `design`, `negocio`, `ferramentas-lib`.
**Prompt:** `arte_de_preco(produto, preco?)` — leia os docs → monte → renderize → estresse → feed + story.

## 5. Riscos e decisões abertas (para o Ryan)
1. **Segurança (fase 2).** RLS é a única fronteira. Um MCP que lê/grava templates precisa rodar com o **JWT do usuário** (nunca service role em arquivo). Decisão: login por token do designer em variável de ambiente?
2. **Escrita no banco.** Recomendo manter "proposta ≠ aplicar": o MCP gera e renderiza; gravar em `luma.templates` só com ferramenta separada e confirmação explícita.
3. **Latência/escala.** Chromium por chamada serve ao estúdio e a agentes; para uso em massa (Ateliê no servidor) o caminho é um Chromium persistente ou transporte HTTP (edge function não roda Canvas — exigiria um worker com Chromium).
4. **Transporte remoto.** stdio cobre máquinas dos designers e do Time de IA. MCP remoto (HTTP) fica para quando houver um serviço hospedado; não existe hoje (`02_ARCHITECTURE`: sem servidor de aplicação).
5. **Fontes e assets.** `assets/` relativo funciona no harness; foto do franqueado exige URL `http(s)`/`data:`.

## 6. Próximos passos sugeridos
- [ ] Fase 2a: `luma_templates_listar/ler` (Supabase, JWT do usuário).
- [ ] Fase 2b: `luma_psd_importar` (harness com `psd-parse.js`).
- [ ] Fase 2c: ferramenta de publicação com confirmação + changelog (`arte/BANCO.md`).
- [ ] Decidir hospedagem para uso do Ateliê em produção (item 3/4).
