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
| Ler templates do catálogo (`luma.templates`) | Supabase, protegido por **RLS** | ✅ **`luma_templates_listar`**, **`luma_template_ler`**, `template_id` em `luma_render`/`luma_estresse` (somente leitura) |
| Gravar/publicar template | Supabase + changelog + reversão (`arte/BANCO.md`) | ⏳ fase 2, **sempre com confirmação humana** |
| Importar PSD → layers | `psd-parse.js` (agPsd **no navegador**) | ⏳ fase 2: mesmo harness, página nova |
| Interpolar `{{campo}}` / catálogo de variáveis | `gInterpolate` (`00-config.js`), `luma.variaveis` | já embutido no `luma_render`; tool própria só se pedirem |
| Story animado (MP4), PDF, Instagram/WhatsApp | `motion.js`, `png-generator.js` | ❌ fora do escopo (ação do franqueado, não do estúdio) |

## 3. Arquitetura do PoC
```
agente (Claude Code / Desktop / Ateliê) ──stdio JSON-RPC──▶ mcp/luma-mcp.js ──▶ mcp/motor.js
                                                                                     │ CDP (WebSocket nativo do Node)
                                   serve.js (symlinks js/ css/ assets/) ◀──────────── ▼
                                                      Chromium headless PERSISTENTE ─▶ 1 aba por render ─▶ harness.html
                                                                                              └─ fRenderTemplateLayers + Local Fit
```
- O Chrome sobe na 1ª chamada e fica de pé; cada render abre uma aba e a fecha. Até 4 abas em paralelo (o estresse roda as 7 variantes juntas). Ao fechar o cliente (ou SIGTERM) o Chrome é derrubado. Medido: 1º render ~4 s, seguintes ~0,5–0,9 s, estresse de 7 variantes ~3 s (antes ~1 min).
- `INVÁLIDA` no retorno = o Local Fit bloquearia o franqueado; é o mesmo critério do portão de arte.
- `render.js` ganhou o caminho do Chrome do macOS (antes só achava `chromium` no PATH).

### Acesso ao banco (leitura)
A anon key é a pública de `js/core/supabase-config.js`; **quem autoriza é o RLS**, pelo login do usuário. Sem login o banco responde "permission denied for schema luma" (verificado). Credenciais só no ambiente do processo, nunca em arquivo:
```bash
claude mcp add luma -e LUMA_EMAIL=voce@deliverymuch.com.br -e LUMA_SENHA=… -- node "/caminho/Luma/mcp/luma-mcp.js"   # renova sozinho
claude mcp add luma -e LUMA_JWT=<access token> -- node …                                                               # expira em ~1 h
```
Nunca service_role. O MCP só faz `GET`; nenhuma ferramenta grava.

### Como usar
```bash
claude mcp add luma -- node "/caminho/para/Luma/mcp/luma-mcp.js"
```
Requisitos: **Node ≥ 22** (WebSocket nativo) e Google Chrome/Chromium (ou `CHROME=/caminho`).

## 4. Documentação das ferramentas

| Ferramenta | Entrada | Saída |
|---|---|---|
| `luma_render` | `layers` **ou** `template_id`, `dados`, `W`, `H`, `fmt` | PNG + `status`/`INVÁLIDA` + encaixe por campo |
| `luma_estresse` | igual ao `luma_render` | resumo das 7 variantes + PNG da primeira com problema |
| `luma_templates_listar` | `busca`, `fmt`, `publicado`, `limite` | id, nome, formato, pasta, publicado |
| `luma_template_ler` | `id` | metadados + layers (JSON) |
| `luma_bloco` | `bloco`, `args[]` (sem `bloco` lista os disponíveis) | JSON de layer(s) pronto para `layers` |
| `luma_medir` | `cmd` (`bordas`/`cor`/`paleta`/`caixa`), `png`, `args[]` | texto com a medida |

**Recursos:** `luma://doc/arte`, `motor`, `design`, `negocio`, `ferramentas-lib`.
**Prompt:** `arte_de_preco(produto, preco?)` — leia os docs → monte → renderize → estresse → feed + story.

## 5. Riscos e decisões abertas (para o Ryan)
1. **Segurança (fase 2).** RLS é a única fronteira. Um MCP que lê/grava templates precisa rodar com o **JWT do usuário** (nunca service role em arquivo). Decisão: login por token do designer em variável de ambiente?
2. **Escrita no banco.** Recomendo manter "proposta ≠ aplicar": o MCP gera e renderiza; gravar em `luma.templates` só com ferramenta separada e confirmação explícita.
3. **Escala.** Chromium persistente já resolve estúdio e agentes (feito). Para uso em massa no servidor (Ateliê) o caminho é transporte HTTP num worker com Chromium (edge function não roda Canvas).
4. **Transporte remoto.** stdio cobre máquinas dos designers e do Time de IA. MCP remoto (HTTP) fica para quando houver um serviço hospedado; não existe hoje (`02_ARCHITECTURE`: sem servidor de aplicação).
5. **Fontes e assets.** `assets/` relativo funciona no harness; foto do franqueado exige URL `http(s)`/`data:`.

## 6. Próximos passos sugeridos
- [x] Fase 2a: `luma_templates_listar/ler` (Supabase, login do usuário) — **ainda não testado com login real**; testado só o caminho sem login.
- [ ] Fase 2b: `luma_psd_importar` (harness com `psd-parse.js`).
- [ ] Fase 2c: ferramenta de publicação com confirmação + changelog (`arte/BANCO.md`).
- [ ] Decidir hospedagem para uso do Ateliê em produção (item 3/4).
