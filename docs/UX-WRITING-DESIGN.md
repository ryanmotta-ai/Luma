# UX Writing — Módulo de Design (Luma)

Guia de redação da interface do **editor/designer** (não do franqueado). Baseado na
auditoria da copy real (≈155 toasts + tooltips, rótulos, modais e estados vazios).
Serve como referência viva: toda copy nova do designer deve seguir isto.

---

## 1. Quem lê e qual a voz

**Usuário:** equipe de design da Delivery Much (designer/gestão) montando templates.
Não é o franqueado — então pode usar vocabulário de design (camada, máscara, traçado),
mas **nunca** vocabulário de programador (função, token, `destination-out`, `e.message`).

**Voz da Luma:** parceira de trabalho competente — clara, direta, calma. Nem robótica
("Operação não permitida"), nem fofa demais ("carimbado! 🎉").

**Princípios:**
1. **Português do Brasil**, sempre. Nada de Layer, Flow, Background, Story solto.
2. **Direto e curto** — toast é status, não conversa. Uma linha.
3. **Orientado à ação** — todo erro diz **o que fazer**, não só o que falhou.
4. **Terceira pessoa neutra** — "Não foi possível salvar", nunca "Não consegui" / "me peça".
5. **Consistente** — um conceito = uma palavra (ver glossário). Mesma ação = mesma frase.

---

## 2. Glossário canônico (decisões de termo)

Use **sempre** a coluna "✅ Usar". As variantes proibidas hoje aparecem misturadas na UI.

| Conceito | ✅ Usar | ❌ Não usar | Observação |
|---|---|---|---|
| Elemento na lista | **camada** | layer, Layer | nunca "layer" na UI (só em código) |
| Tela de trabalho | **prancheta** | artboard, canvas | "canvas" some da UI |
| Objeto geométrico | **forma** | shape | |
| Dado editável pelo franqueado | **campo** | variável, var, token | esconder `{{ }}` do usuário (ver §6) |
| Contorno da forma | **traçado** | contorno, borda, stroke | já consistente — manter |
| Preenchimento (cor) | **preenchimento** | fill | não reutilizar a palavra p/ opacidade |
| Origem do carimbo | **origem** | fonte, source | "fonte" confunde com tipografia |
| Apagar do projeto | **excluir** | deletar, remover (p/ permanente) | "remover" = tirar de uma lista |
| Material salvo/publicado | **template** (interno) / **material** (catálogo) | rascunho, prancheta, modelo | padronizar os dois únicos sentidos |
| Borrar (ferramenta) | **Borrar** | Dedo, Smudge | |
| Conta-gotas de cor | **Conta-gotas** | Eyedrop | |
| Amostra de cor (pino) | **Amostra de cor** | Sampler, Classificador de Cores | |
| Varinha de seleção | **Varinha mágica** | Magic Wand | um nome só (hoje tem os dois) |
| Encaixar na tela | **Enquadrar na tela** | Fit to screen | |
| Modos de mescla | traduzir: **Multiplicar, Sobrepor, Clarear…** | Multiply, Overlay… | ou manter EN + tooltip PT (decidir) |

**Formatos sociais:** "Story", "Feed", "Wide" são nomes de produto aceitáveis, mas
**sempre com a dimensão** na primeira aparição: `Story (1080×1920)`. Nunca "Wide" sozinho.

---

## 3. Sistema de feedback (toasts)

Padronizar em **3 tipos**, sem zoo de emojis (hoje há ✓ ⚠ 🔒 🪣 🎯 🚀 💡 ☀ 🌙 ↩ ↪ ↔ 📌 📏 📝 🔢…):

| Tipo | Prefixo | Quando | Exemplo |
|---|---|---|---|
| Sucesso | (sem emoji ou ✓ — **escolher um e padronizar**) | ação concluída | `Camada duplicada` |
| Alerta/bloqueio | `⚠ ` | impediu ou avisou | `⚠ Selecione uma camada primeiro` |
| Erro | `⚠ ` + **o que fazer** | falhou | `⚠ Sem espaço — exclua materiais e tente de novo` |

**Recomendação:** abandonar os emojis temáticos (📌📏📝🔢🪣🎯🚀💡) — eles criam ruído
e inconsistência. Manter no máximo `⚠` para alerta/erro e nada (ou só `✓`) para sucesso.
Decidir **uma** convenção de sucesso e aplicar em 100% dos casos (hoje metade tem ✓, metade não).

**Regras de escrita do toast:**
- Sem ponto final (status curto). Frase capitalizada normal, não CAIXA ALTA.
- Sem jargão de atalho cru no texto ("(Ctrl+C)", "(T, R, F, M)") — atalho vai no tooltip, não no toast.
- Nunca expor `e.message` cru nem nome de função.
- Mesma ação → exatamente a mesma frase (não "clonado" aqui e "duplicado" ali).

---

## 4. Microcopy por superfície

**Tooltips (`title`)** — uma linha clara do que a ferramenta faz + atalho.
- Padrão: `Nome da ferramenta (X)` e, se útil, 2ª linha curta. Ex.: `Conta-gotas (I)`.
- Não deixar vago: "Seleção de Objeto", "Seleção Rápida", "Contagem" precisam de 1 frase
  do que fazem. Ex.: `Contagem — marca e numera itens na arte`.
- `title` e o rótulo visível devem **bater** (hoje "Classificador de Cores" → label "Classificador Cores").
- Padronizar "Botão direito para opções" (hoje mistura "Clique direito"/"Botão direito").

**Botões** — verbo no infinitivo: "Criar campo", "Publicar", "Importar". Capitalização só na 1ª palavra.

**Placeholders** — exemplo real, prefixado por "Ex.:". Ex.: `Ex.: Hambúrguer Fest`.
Não usar placeholder como rótulo (campo precisa de `<label>` próprio).

**Estados vazios** — 1 título curto + 1 linha de próximo passo (já bem feitos em vários lugares):
- ✅ Bom: "Nenhuma campanha ainda / Crie sua primeira campanha para organizar os materiais."
- Manter esse padrão (título + ação) em todos.

---

## 5. Correções prioritárias (before → after)

### 5.1 O bug de copy mais grave: "Preview"
O botão **"Preview"** da topbar abre o modal **"SIMULAR DADOS REAIS"** — e existe OUTRO
modal chamado **"PREVIEW"** (a tela de exportação). Dois conceitos, mesmo nome.
- **Antes:** botão "Preview" → modal "SIMULAR DADOS REAIS"; modal "PREVIEW" separado; atalho P.
- **Depois:** botão da topbar vira **"Simular dados"** (abre "Simular dados reais"); a tela
  de exportação continua **"Pré-visualização"**. Atalho P → Pré-visualização.

### 5.2 camada vs layer (a inconsistência nº 1)
Trocar **todo** "layer/layers" visível por "camada/camadas".
| Antes | Depois |
|---|---|
| `Layer clonado: X` | `Camada duplicada: X` |
| `X layer(s) selecionado(s)` | `X camada(s) selecionada(s)` |
| `Adicione layers antes de publicar.` | `Adicione camadas antes de publicar` |
| `Selecione 2+ layers (Shift+click) pra agrupar` | `Selecione 2 ou mais camadas para agrupar` |
| `Nenhum layer criado` | `Nenhuma camada criada` |

### 5.3 Erros que não dizem o que fazer
| Antes | Depois |
|---|---|
| `⚠ Não consegui ler o arquivo` | `⚠ Não foi possível ler o arquivo — verifique se é um .psd válido` |
| `⚠ Falha ao gerar o arquivo` | `⚠ Não foi possível gerar o arquivo — tente novamente` |
| `⚠ Pasta não encontrada` | `⚠ Pasta não encontrada — selecione outra campanha` |
| `Magic Eraser: limite de 2M pixels atingido` | `⚠ Área grande demais para apagar — reduza a seleção` |

### 5.4 Jargão técnico exposto
| Antes | Depois |
|---|---|
| `Fonte do carimbo: X` | `Origem do carimbo: X` |
| `📌 Sampler #1: #FF9000` | `Amostra 1: #FF9000` |
| `✓ Auto-fit: 40px → 28px` | `Texto ajustado para caber (28px)` |
| `Eyedrop não funciona em moldura` | `O conta-gotas funciona em texto e forma` |
| `Snap ativado` | `Ímã ativado` (ou "Alinhamento automático ativado") |
| label `Flow` | `Fluxo` (com tooltip: "quanta tinta sai por passada") |
| label `Background` / `Radius` / `Portrait/Landscape` | `Fundo` / `Raio` / `Retrato/Paisagem` |

### 5.5 Voz em 1ª pessoa → neutra
`Não consegui ler esse PSD` → `Não foi possível ler este PSD`.
`me peça pra integrar uma lib de QR` → `Gerador de QR Code em breve`.

### 5.6 Campo vs variável vs `{{ }}`
Padronizar em **campo** na UI. Onde hoje aparece `{{precoDe}}`/`{{nome}}` cru em texto de
ajuda, trocar por linguagem humana:
- **Antes:** "Para cada variável {{nome}} do template, defina se o franqueado pode editar…"
- **Depois:** "Para cada campo do material, defina se o franqueado pode editar e o limite de caracteres."

---

## 6. Detalhe de consistência (passar o pente fino)
- **Pontuação:** toasts sem ponto final; textos de ajuda (frases completas) com ponto.
- **Reticências:** usar sempre `…` (um caractere), nunca `...`.
- **Aspas:** retas `"` no código de UI; evitar curvas `“ ”` misturadas.
- **Capitalização:** só a 1ª palavra ("Balde de tinta", não "Balde de Tinta"); igual em tooltip e label.
- **Atalho duplicado:** a tecla **O** está em Elipse, Nitidez e Grupo Efeitos — resolver (1 tecla, 1 ação).
- **"Wide (12:6.28)"** está errado — a proporção de 1200×628 é ~**1.91:1**.

---

## 7. Checklist para escrever copy nova no designer
- [ ] Está em PT-BR, sem termo da lista proibida (§2)?
- [ ] É a **mesma frase** que já uso para essa ação em outro lugar?
- [ ] Se é erro, diz **o que fazer**?
- [ ] Sem jargão de código / atalho cru / `{{ }}` / nome de função?
- [ ] Voz neutra (3ª pessoa), curta, sem exclamação fofa?
- [ ] Emoji só `⚠` (alerta/erro) — nada de zoo temático?
- [ ] Tooltip bate com o rótulo visível e diz o que a ferramenta faz?
