# 01 — DOMÍNIO / NEGÓCIO · Como a Delivery Much funciona

> O arquivo que impede a IA de **inventar regras**. O `00_PRODUCT.md` diz _por que_ o Luma existe; este diz _quais são as regras do mundo em que ele opera_.
> Antes de propor qualquer solução ("criar campanhas", "dar acesso a X", "publicar template"), leia a seção correspondente aqui. As **invariantes** (⛔) são regras que **não se inventa** — se uma proposta as viola, ela está errada, por mais elegante que pareça.
> Última revisão: 2026-07-31. Fonte técnica: `docs/LUMA.md`. Fonte de negócio: pesquisa Delivery Much (ver `00_PRODUCT.md` §10).

---

## Como ler este arquivo

Cada conceito segue o mesmo padrão:

- **No mundo real (Delivery Much):** o que o termo significa para o negócio.
- **No Luma (sistema):** como o produto modela isso (entidade, campo, role).
- **Regras / invariantes:** o que é sempre verdade. Violou → a solução está errada.

Glossário de dois mundos: um mesmo nome pode significar coisas diferentes no negócio e no código. Onde isso acontece, está marcado explicitamente.

---

## 1. Franquias

**No mundo real.** A Delivery Much é uma **rede de franquias**. A unidade é a **cidade**: cada município é operado por **um único franqueado**, com **exclusividade territorial** garantida em contrato. O franqueado é "o dono do app na sua cidade" — ele capta restaurantes, atrai usuários e faz o marketing local. A **franqueadora** (DM central, em Florianópolis) fornece a tecnologia, a marca, as campanhas nacionais e o suporte. Foco em **cidades do interior** (até ~150 mil hab).

**No Luma.** A franquia/cidade **não é uma entidade rica no Luma** hoje — o Luma é single-tenant na prática (todos os franqueados veem o mesmo catálogo de campanhas publicadas). O vínculo formal franqueado↔cidade vive no **Portal / CRM da DM** (outro sistema, Supabase `gplxnzgsculryjykbcuo`, tabela `franqueado_franquias`), **não** no Luma (Supabase `uqrqzjafhigjuvtjqzid`).

**Regras / invariantes:**
- ⛔ **1 franqueado por cidade.** Nunca modele "vários franqueados disputando a mesma cidade".
- ⛔ **Hierarquia é DM-central → franqueado**, não franqueado → franqueado. Não existe "franqueado que gerencia outro".
- O franqueado **executa** marketing local; ele **não** define a marca nem cria as regras — isso é da DM central.
- ⚠️ Se pedirem algo "por cidade/multi-tenant" no Luma (ex.: catálogo diferente por franquia), isso **ainda não existe** — é decisão de arquitetura, não um dado que já está lá. Confirme antes de assumir.

---

## 2. Usuários e Papéis

**No mundo real.** Três tipos de gente mexem no ecossistema: o **franqueado** (lojista da cidade), a **equipe interna da DM** (marketing, design, tecnologia — segmentada por departamento) e a **gestão** (direção da rede).

**No Luma.** Três _roles_, em `public.profiles.role`, com hierarquia crescente:

| Role | Nível | Quem é | No Luma pode |
|------|-------|--------|--------------|
| `franqueado` | 1 | Dono do app numa cidade | Gerar arte a partir de templates publicados; ver o próprio histórico |
| `equipe_dm` | 2 | Funcionário interno (design/marketing/…) | Tudo do franqueado + criar/editar/publicar templates, campos, assets (o "Estúdio") |
| `gestao` | 3 | Direção | Tudo + administração de usuários + leitura de analytics por SQL/BI |

Helpers no código: `gIsAdmin()` = `equipe_dm` **ou** `gestao`; `gIsSuperAdmin()` = `gestao`. `ROLE_HIERARCHY = {franqueado:1, equipe_dm:2, gestao:3}`.

**Regras / invariantes:**
- ⛔ **O role vem sempre de `profiles.role` (servidor), nunca do metadata do JWT.** Não confie em claim do token para decidir permissão.
- ⛔ **Franqueado não vê o Estúdio.** O gate por role esconde a aba no front e a RLS protege o conteúdo no banco. Analytics não possui dashboard no app; a gestão consulta por SQL/BI.
- ⛔ **Escrita de conteúdo (template/campo/asset) é só `equipe_dm`/`gestao`** (`is_designer()` no backend). Franqueado só **lê** o que foi publicado e **escreve o próprio histórico de artes**.
- Criação/exclusão de usuário é feita **direto no Dashboard do Supabase** (decisão vigente) — não há tela de admin de usuários no Luma que crie contas.
- ⚠️ `equipe_dm` tem `departamento`, mas o Luma **não** segmenta acesso por departamento hoje (isso é regra do Portal, não do Luma).

---

## 3. Permissões

Existem **duas camadas de permissão** no Luma — não confunda:

**(A) Permissão de sistema (quem pode operar o quê).**
É a hierarquia de roles + **RLS** (Row Level Security) no Supabase. A RLS é a **única fronteira de segurança** — o front fala direto com o banco via anon key pública, então **quem protege o dado é a policy SQL**, não o JavaScript.

**(B) Permissão por campo no template (o que o franqueado pode editar numa arte).**
Quando o designer publica um template, ele define, campo a campo, o que o franqueado pode mexer. Isso vive em `template.publishMeta.permissoes`:

```
permissoes: { nome_do_campo: { edit: true|false, maxLen: 32 } }
```

- `edit:false` → o campo é fixo; o franqueado **não** pode alterar (ex.: um selo "OFERTA" travado).
- `maxLen` → limite de caracteres que o chat do franqueado aceita naquele campo.

**Regras / invariantes:**
- ⛔ **Nunca proponha "confiar no front" para segurança.** Se a regra precisa valer, ela vive na RLS. O JS é conveniência/UX.
- ⛔ **Republicar um template não pode "resfriar" permissões silenciosamente** — a config de permissões/validade/instruções anterior é preservada e re-carregada. (Já foi bug; ver histórico.)
- Permissão por campo é **do designer para o franqueado**, dentro de um template. Não confunda com role.
- ⚠️ Ao mexer em RLS: policy de UPDATE precisa de `WITH CHECK`; RLS habilitado **sem** policy = _deny-all_ (quebra a feature em silêncio). Toda mudança de backend vai no `docs/LUMA-BACKEND-CHANGELOG.md`.

---

## 4. Campanhas

⚠️ **Termo de dois sentidos — a maior fonte de confusão do domínio.**

**No mundo real (Delivery Much).** "Campanha" é uma ação de marketing: uma promoção, uma data comemorativa, um combo. Podem ser **nacionais** (criadas pela DM central e seguidas por todos os franqueados) ou **locais** (o franqueado, em parceria com um restaurante, cria uma promo "para além das campanhas nacionais").

**No Luma.** Uma **campanha é uma _pasta_ (`folder`) que agrupa templates/materiais** de um mesmo tema. É a "gaveta" do catálogo. Cada pasta tem: `id`, `name`, `campId` (liga ao catálogo), `cover` (capa) e uma lista de `templates`. O catálogo do franqueado é **config + banco** (desde 2026-07-16): a base são as campanhas de `js/00-config.js` (`CAMPS_ATIVAS`, `CAMPS_OUTRAS`, `CAMPS_IMPLEMENTACAO` — esta última = onboarding de cidade nova), e **pastas criadas no Estúdio sem campanha correspondente entram como campanhas dinâmicas** (`fGetCampaigns`), com o id da própria pasta. A capa segue a mesma regra: **pasta existente manda** (capa vazia = removida de propósito → cor da marca); o `cover` do config é só semente de primeira carga.

**Fluxo:** o **designer/gestão cria a campanha (pasta) e publica templates dentro dela**. O **franqueado escolhe uma campanha no catálogo → escolhe um material → gera a arte**. O franqueado **consome** campanhas; ele **não cria** campanhas no Luma.

**Regras / invariantes:**
- ⛔ **"Criar campanha" ≠ ação do franqueado.** Se alguém pedir "franqueado cria campanha", pare e questione — no Luma isso é papel do designer/gestão. (Este é exatamente o tipo de regra que a IA inventaria sem este arquivo.)
- ⛔ **Campanha (Luma) = pasta que agrupa materiais.** Não é um "envio", não é um "disparo", não é uma "audiência". É organização de catálogo.
- Uma campanha pode ter **validade** (via `publishMeta.validade` de seus materiais) — materiais expirados somem do catálogo do franqueado.
- Só materiais com `publishMeta.publicado === true` aparecem para o franqueado. Rascunho fica invisível.

---

## 5. Templates e Materiais

⚠️ **Mesma coisa, dois nomes por público.**

- **Template** = nome **interno** (o que o designer monta no Estúdio).
- **Material** = nome no **catálogo do franqueado** (o que ele escolhe para gerar).

**No Luma.** Um template é uma peça editável: uma lista de **camadas** (texto, forma, moldura de foto, imagem) num canvas, com **campos** (`{{variáveis}}`) que o franqueado preencherá. Vive dentro de uma pasta/campanha. Ao publicar, ganha `publishMeta` (`publicado`, `validade`, `permissoes`, `instrucoes`).

**A ponte designer → franqueado** é o **sistema de campos** + um **interpolador único** (`gInterpolate`), usado igual na simulação do designer, na prévia ao vivo e no PNG final. **O que o designer monta é exatamente o que o franqueado obtém** — não há dois motores.

**Formatos** (dimensões fixas): `story` 1080×1920 · `feed` 1080×1350 · `post`/`wide` 1200×628. Um template pode ter tamanho nativo próprio (ex.: importado de PSD) e o motor de _smart resize_ re-ancora entre formatos sem distorcer.

**Regras / invariantes:**
- ⛔ **Template e material são a MESMA entidade.** Não modele dois bancos.
- ⛔ **O franqueado nunca edita camadas** — ele preenche campos. Redesenhar é só do designer.
- ⛔ **Publicar não pode destruir a arte publicada anterior.** Cada publicação vincula a um template próprio (já foi bug de colisão de ID).
- Ao editar um template já publicado, a cópia publicada e a de edição **não compartilham a mesma referência de array de camadas** (senão editar corrompe o publicado).

---

## 6. Campos (Variáveis)

**No mundo real.** São os "espaços a preencher" de uma arte: o nome do produto, o preço de/por, a foto, a validade. O que muda de uma peça para outra sem mudar o layout.

**No Luma.** É o **core do produto**. Sintaxe `{{nome}}` (`[a-zA-Z0-9_]`). Catálogo em `dVars`, cada campo:

```
{ name, label, type, defaultValue?, example?, required, options?, palette?, maxLen?, category }
```

Tipos: `text`, `number`, `currency`, `date`, `image`, `select`, `color`, `boolean`. Categorias: produto, preço, campanha, mídia, outros. Recursos avançados: **bindings** (`l.bindings` — liga uma propriedade da camada a um campo), **regras** (`l.rules` — "se campo vazio → esconder camada").

**Regras / invariantes:**
- ⛔ **`{{ }}` e nome de campo são jargão de código — nunca aparecem para o franqueado.** Na UI o franqueado vê "Produto", "Preço", não `{{produto}}`. (Ver `docs/UX` absorvido no `LUMA.md`.)
- ⛔ **Um campo `image` (ex.: `foto_produto`, `logo_loja`) liga-se a molduras/imagens via `imgVar`** — não é texto.
- Renomear um campo deve atualizar **content, imgVar, bindings E rules** — senão o vínculo aponta para nome morto.
- Campo sem exemplo/default renderiza um placeholder amigável, nunca o token cru.
- ⛔ **Campo de PREÇO não encolhe por causa de outro campo** (regra de 19/08/2026). O Auto-layout só reduz um campo de preço quando o PRÓPRIO valor não cabe na caixa desenhada pra ele; título longo, colisão de terceiros ou a escala do componente nunca mexem no corpo do preço. O preço é o argumento da peça — se ele encolhe porque o nome do produto ficou grande, a promessa vira detalhe. Consequência aceita: uma camada autorada maior pode terminar menor que o preço. Detalhe técnico e medições em `docs/LUMA.md` §Auto-layout 8.1.

---

## 7. Assets (Recursos da marca)

**No mundo real.** A marca da Delivery Much (e das promoções): logos, fontes oficiais, imagens, ícones. O que dá identidade e não pode "escapar do trilho".

**No Luma.** Vários tipos, cada um com regra de persistência própria:
- **Fontes** (`.ttf/.otf/.woff`, máx 3MB) → FontFace API + bucket `luma-fontes`. Referenciadas como `custom:Família`.
- **Biblioteca de imagens/ícones** → bucket `luma-template-assets`.
- **Capas de campanha** → bucket `luma-covers`.
- **Fotos enviadas pelo franqueado** (produto) → bucket `luma-user-uploads` (público — viram arte pública).
- **Logos da marca** → tokens CSS (`--logo-h-*`), fisicamente em `assets/logos/`.

**Regras / invariantes:**
- ⛔ **Cores e espaçamentos sempre via tokens de `00-tokens.css` — nunca hex hardcoded** (nem em CSS, nem em JS). É regra de marca, não só de estilo.
- ⛔ **Ícone de UI = SVG inline** (stroke, `currentColor`), nunca emoji. Emoji renderiza diferente por sistema e quebra a marca.
- Imagens base64 grandes não moram no `localStorage` — sobem para o Storage e viram URL (senão estouram a quota de ~5MB).
- Nome de asset/fonte vindo do usuário ou do backend entra em `innerHTML` **sempre escapado** (`gEsc`/`_dEsc`) — XSS armazenado é risco real.

---

## 8. Artes geradas

**No mundo real.** O entregável final: o PNG/JPG/PDF que o franqueado posta.

**No Luma.** Gerada pelo módulo Franqueado. Fluxo: campanha → material → chat guiado (produto, preço, foto) → confirmação → render (PNG 2× super-sampling, ou PDF). Registrada no **histórico** (`localStorage dm_artes_hist_v2`, cap 50 + tabela `luma.artes`), com status `rascunho` → `baixada`.

**Regras / invariantes:**
- ⛔ **A arte final é da loja do franqueado, não do Luma.** Não queime a marca "Luma" no PNG (é decisão de produto — a logo foi removida do gerador).
- O histórico é **por usuário** (RLS por dono em `luma.artes`).
- Geração em lote (CSV) existe: 1 linha = 1 arte, via PapaParse, em fila.

---

## 9. CRM e Fidelidade (Much+)

**No mundo real.** A Delivery Much tem o programa de vantagens **Much+** (cupons, promoções, combos, clube) e faz comunicação com o usuário final do app. Hoje o time monta inapp/push **à mão** (HTML no ChatGPT → CleverTap).

**No Luma.** É o **módulo 3 — CRM Visual (💡 planejado, não implementado)**: editor de inapp/push que reaproveita os mesmos templates e campos, com Brand Guardian antes de subir, exportando compatível com o **CleverTap**.

**Regras / invariantes:**
- ⛔ **O Luma NÃO envia mensagem.** Ele _prepara_ a peça; o disparo é no CleverTap. Não modele "Luma manda push".
- ⛔ **Much+ é programa da DM, não entidade do Luma.** Não invente tabela de fidelidade no Luma.
- ⚠️ **Não confundir com o "CRM/Portal de Franqueados"** — é **outro produto**, outro Supabase, com comunicados/tickets/helpdesk. O Luma não tem esses módulos. (Docs daquele projeto viviam em `LUMA-BACK_CONTEXT.md`/`LUMA-REGRAS_BACKEND.md`.)
- Dependência crítica antes de construir: **estudar os formatos que o CleverTap aceita**.

---

## 10. Notificações

**No mundo real.** Comunicação com o usuário do app (push, inapp) e, no Portal, avisos ao franqueado.

**No Luma.** Duas coisas distintas:
- **Notificações de UI** (feedback ao usuário do editor): sempre via `gToast` — nunca `alert()`/`console.log()`. É status curto, orientado à ação.
- **Notificações de produto** (push/inapp para o usuário final): fazem parte do **CRM Visual planejado** (§9), não existem hoje.

**Regras / invariantes:**
- ⛔ **`gToast` é o único canal de feedback ao usuário.** Sem `alert`, sem `confirm` nativo espalhado.
- Push/inapp para consumidor **não é uma feature atual** do Luma — é roadmap.

---

## 11. Workflow (o fluxo ponta a ponta)

O ciclo de vida que amarra tudo. **Este é o mapa mental que a IA precisa ter antes de sugerir qualquer coisa:**

```
   ┌─ EQUIPE DM / GESTÃO (Estúdio) ──────────────────────────────┐
   │ 1. Cria/escolhe a CAMPANHA (pasta)                          │
   │ 2. Monta o TEMPLATE: camadas + CAMPOS ({{produto}}, foto…)  │
   │ 3. Define PERMISSÕES por campo + VALIDADE + instruções      │
   │ 4. PUBLICA  →  publishMeta.publicado = true                 │
   └───────────────────────────┬─────────────────────────────────┘
                                │  (Supabase luma.* + RLS)
                                ▼
   ┌─ FRANQUEADO (catálogo) ─────────────────────────────────────┐
   │ 5. Vê a campanha no catálogo (só materiais publicados/válidos)│
   │ 6. Escolhe o MATERIAL → chat guiado (preenche os CAMPOS)     │
   │ 7. Prévia ao vivo (mesmo motor do PNG)                       │
   │ 8. Confirma → gera ARTE (PNG/PDF) → histórico                │
   │ 9. Baixa e POSTA (passo manual, fora do Luma)                │
   └──────────────────────────────────────────────────────────────┘
```

**Regras / invariantes do fluxo:**
- ⛔ **O sentido é sempre Estúdio → catálogo → franqueado.** O franqueado é a ponta que _consome_; ele não volta para o Estúdio.
- ⛔ **Nada aparece para o franqueado sem `publicado === true` e dentro da validade.**
- ⛔ **Postar não é etapa do Luma** (hoje). O Luma entrega o arquivo; publicar no Instagram/status é manual.
- Persistência é **offline-first**: localStorage é cache; o Supabase é a fonte compartilhada (sync no boot, push em background).

---

## 12. Formação do Franqueado (Academia)

**No mundo real.** Antes de a cidade entrar no ar, o franqueado passa por uma **implementação**: entender o modelo, preparar a operação, conhecer os sistemas, captar os primeiros restaurantes, lançar. Hoje isso é conduzido pela franqueadora com reunião, planilha e material solto.

**No Luma.** É o módulo **Academia** (`ac*`, aba própria na topbar), com uma jornada chamada **Formação do Franqueado**: módulos ordenados → aulas (vídeo + materiais + anotações + transcrição + atividade) → conclusão → **certificado**. Entidades em `luma.*`: `cursos`, `curso_modulos`, `curso_aulas`, `matriculas`, `aula_progresso`, `aula_notas`, `aula_mensagens`, `certificados`.

**Regras / invariantes:**
- ⛔ **Franqueado não cria nem edita conteúdo de formação** — mesma lógica de campanha/template: quem monta é `equipe_dm`/`gestao`. O franqueado **estuda**, anota, conclui e emite o **próprio** certificado.
- ⛔ **"Academia" ≠ "Implementação".** No catálogo, **Implementação** é a categoria de **materiais de marketing** para lançar cidade nova (`CAMPS_IMPLEMENTACAO`). A formação é outra coisa, com outro nome. Não unifique os dois.
- ⛔ **Concluir a formação não tira o acesso.** Depois de formado o franqueado continua com aulas, materiais, anotações e tutor — a interface muda de "implementação" para "formação concluída", o conteúdo não.
- ⛔ **Atualizar uma aula não apaga formação de ninguém.** Correção pequena não mexe em conclusão nem em certificado; a aula só aparece marcada como atualizada. Mudança grande = **nova versão do curso**, e certificados antigos seguem válidos na versão que a pessoa concluiu.
- ⛔ **Certificado é emitido pelo servidor**, nunca pelo cliente: a RPC `luma.ac_emitir_certificado` revalida as aulas obrigatórias. Ninguém emite certificado para outra pessoa.
- ⛔ **Anotação pessoal e conversa com o tutor são privadas** — nem `equipe_dm` nem `gestao` leem. Acompanhamento da rede é agregado (quem iniciou, quem concluiu), não leitura de estudo alheio.
- ⛔ **O tutor não decide pela rede.** Ele explica o conteúdo oficial da aula; risco operacional, financeiro, jurídico ou decisão da rede exige confirmação humana da equipe DM. E ele **não** entrega resposta de atividade avaliativa.
- Aula pode ser **obrigatória** (conta para o certificado) ou **opcional**. Só material publicado aparece — igual ao catálogo.

---

## 13. Invariantes do domínio (resumo — a lista que não se viola)

Se uma proposta contradiz qualquer item abaixo, ela está **errada** — reveja antes de codar:

1. **1 franqueado por cidade**, exclusividade territorial. Hierarquia é DM→franqueado.
2. **Franqueado consome, não cria** campanhas/templates. Criar é do designer/gestão.
3. **Campanha (Luma) = pasta** que agrupa materiais. Não é envio/disparo/audiência.
4. **Template = Material** (mesma entidade, nomes por público). Franqueado preenche campos, nunca edita camadas.
5. **Role vem do servidor (`profiles.role`) + RLS.** Front nunca é fronteira de segurança.
6. **Nada é visível ao franqueado sem `publicado` + validade.**
7. **Luma prepara peças; não envia mensagem, não posta, não opera o delivery.**
8. **Much+ / CRM-Portal são outros sistemas** — não são entidades do Luma.
9. **Marca por construção:** tokens de cor, SVG (não emoji), campos com trilho de permissão, `gToast` para feedback.
10. **Segurança e escape são regra, não opção:** RLS com `WITH CHECK`, `gEsc`/`_dEsc` em todo dado de usuário.
11. **Formação:** franqueado estuda e se forma (não edita conteúdo); concluir não tira acesso; atualização de aula não apaga certificado; certificado só o servidor emite; anotação e conversa com o tutor são privadas.

---

## Ver também

- `00_PRODUCT.md` — propósito, público, missão, o que o Luma NÃO faz.
- `docs/LUMA.md` — documentação técnica oficial (arquitetura, código, backend, RLS).
- `docs/LUMA-BACKEND-CHANGELOG.md` — histórico vivo de mudanças de backend.
