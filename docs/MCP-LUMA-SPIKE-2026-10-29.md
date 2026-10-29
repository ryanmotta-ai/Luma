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
| Importar PSD → layers + PNG por prancheta | `psd-parse.js` (agPsd **no navegador**) | ✅ **`luma_psd_importar`** (harness `ferramentas/psd.html`, mesmo caminho do Estúdio) |
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

### Escrita no banco (regras)
- **Toda escrita é dry-run por padrão**: só grava com `confirmar:true`. A resposta traz um "changelog sugerido" para colar em `docs/LUMA-BACKEND-CHANGELOG.md` (o MCP não edita o repositório).
- Autorização = **RLS do usuário logado** (designer/gestão). O MCP não usa service_role e não tem como contornar a política.
- `salvar`/`atualizar`/`publicar` **recusam arte com ERRO de auditoria**; `salvar` recusa imagem embutida (`data:`/`idb://`) porque ela não sobe ao Storage por aqui — o Estúdio faz isso. Por isso PSD com raster vira template pelo Estúdio; o MCP serve para PSD vetorial/texto e para ajustar templates existentes.
- `criado_por` = `sub` do JWT; `formats/permissoes/bg` vêm do irmão (`copiar_de`).
- ⚠ **As escritas ainda não foram exercitadas com login real** (só dry-run, recusas e erro sem login). Faça o primeiro teste num template de rascunho.

### Notas de qualidade
- O `luma_psd_importar` segue o caminho **idêntico** ao do Estúdio (`_dPsdCollectBoards`): só camadas incluídas, z-order por `_dPsdShouldInvert` + `_dPsdFundoPrimeiro`, e `_dPsdLayersParaImport` (fundo fiel). Uma 1ª versão pulava essa etapa e saía só com a forma de fundo (fidelidade 34%); com o caminho certo o `Materiais Consultores.psd` dá 94–99%.
- `luma_render`, `luma_render_lote` e `luma_psd_lote` gravam em disco; `luma_render_lote`/`luma_psd_lote` emitem `notifications/progress` quando o cliente envia `progressToken`.
- Prompts: `arte_de_preco`, `psd_para_template`, `refinar_arte`.

### Módulo Potencial (Aladim)
`mcp/potencial.js` carrega o `js/potencial/potencial.js` **real** numa sandbox `vm` (o motor é puro: sem DOM nem rede). Não há segunda conta: se a regra mudar na tela, muda aqui. Cidades, faixas e parâmetros vêm de `luma.potencial_*` pelo login do usuário (RLS: só a equipe); tarifa fica em cache por 10 min. **Somente leitura.** Fora de escopo de propósito: `gerar_slide` (efeito externo: cria arquivo no Drive via Apps Script) — só com confirmação explícita, numa próxima etapa.
- Verificação: conta conferida à mão contra o motor (investimento R$ 27.600, lucro R$ 13.536, payback 24,47 meses) e as 5 ferramentas rodadas com dados **sintéticos** simulados (só no teste). ⚠ Não foram rodadas contra o banco real (falta login).

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
| `luma_editar_layers` | fonte + `patches`, `remover`, `adicionar`, `devolver_layers` | imagem + veredito; edição por id, ordem preservada |
| `luma_derivar_story` | fonte (feed) + `patches` do story | feed e story renderizados + avisos de zona segura; fundo cresce e rodapé desce por padrão |
| `luma_auditar` | fonte | erros/avisos da marca (id, margem 72, corpo ≥ 22, contraste ≥ 4,5, raio, zona segura) |
| `luma_variaveis`, `luma_pastas` | — / `busca` | catálogo de campos; pastas (campanhas) com id |
| `luma_template_salvar` ⚠ escreve | `pasta_id`, `nome`, `fmt`, fonte, `copiar_de`, `confirmar` | rascunho em `luma.templates` (dry-run sem `confirmar`) |
| `luma_template_atualizar` ⚠ escreve | `id`, `patches`/`layers`, `confirmar` | altera layers do banco; publicado ganha versão automática |
| `luma_template_publicar` ⚠ escreve | `ids`, `confirmar` | `publicado=true`; recusa se a auditoria achar ERRO |
| `luma_template_versoes` / `luma_template_reverter` | `id` / `version_id`, `confirmar` | histórico e `luma.restaurar_versao(p_version)` |
| `luma_comparar` | `a`, `b` (PNGs), `tolerancia`, `salvar_diff_em` | % de pixels que batem + imagem de diferença (vermelho = diverge) |
| `luma_render_lote` | fonte + `lote:[{nome,dados}]`, `saida` | 1 PNG por linha, tabela de encaixe, grade-contato; emite progresso |
| `luma_psd_lote` | `pasta`, `saida?`, `recursivo?`, `limite?`, `filtro?` | tabela por PSD: pranchetas, camadas, fidelidade média, erros; emite progresso |
| `luma_potencial_cidades` | `busca`, `limite?` | cidades da base comercial (chave, população, concorrentes, "DM já opera", "não vender") |
| `luma_potencial_calcular` | `cidade`, `ajustes?` ({concorrentes, ticket, comissao, rebate, simples}) | investimento + 3 cenários + AVISOS — o **mesmo** `potCalcular` da tela |
| `luma_potencial_comparar` | `cidades[]`, `cenario?`, `ordenar_por?` | ranking por ROI/payback/lucro/investimento |
| `luma_potencial_sensibilidade` | `cidade`, `parametro`, `valores[]` ou `de/ate/passos` | efeito de variar um parâmetro no payback/ROI |
| `luma_potencial_slide_campos` | `cidade`, `ajustes?` | os `{{placeholders}}` do slide, sem gerar nada |
| `luma_psd_importar` | `psd` (caminho absoluto), `saida?`, `pranchetas?` | PNG da Luma e composto do Photoshop por prancheta, `layers.json`, **fidelidade %** (render × Photoshop), resumo (ocultas e erros marcados) |
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
- [x] Fase 2b: `luma_psd_importar` — testado com `01_Banners/Materiais Consultores.psd` (20 MB, 4 pranchetas, ~7 s). Não roda a bateria de fidelidade; só exporta.
- [x] Fase 2c: salvar/atualizar/publicar/versões/reverter com dry-run + auditoria (escrita **não testada com login**).
- [x] Edição por patches, derivação de story, auditor de marca, grade de estresse, catálogo (`variaveis`, `pastas`).
- [x] Registrado em `.mcp.json` (stdio). Credenciais por `-e` ou `.claude/settings.local.json`, nunca no repo.
- [ ] Ainda aberto: progresso/cancelamento em renders longos; caso de teste automatizado do MCP (não coube nas suítes de navegador); subir imagens ao Storage pelo MCP.
- [ ] Decidir hospedagem para uso do Ateliê em produção (item 3/4).
