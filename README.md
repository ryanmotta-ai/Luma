# Luma

**Plataforma interna de Creative Automation da Delivery Much.**

Substitui Deskfy + Placid. Permite que designers criem templates e franqueados gerem artes prontas para postar — sem saber design.

---

## O que é

O Luma conecta dois papéis num único app:

- **Designer** — cria templates num editor estilo Photoshop, define variáveis editáveis, validade, permissões por layer, e publica para a rede.
- **Franqueado** — escolhe uma campanha, responde um chat guiado com perguntas sobre produto e preço, envia a foto, e baixa a arte pronta em Story, Feed ou Wide.

A ponte entre os dois é o sistema de **variáveis** (`{{produto}}`, `foto_produto`) e um interpolador único compartilhado entre o editor do designer e o gerador de PNG do franqueado.

---

## Como rodar

Sem instalação. Sem npm. Sem build.

```bash
git clone <repo>
cd luma
# Abra index.html no navegador
# Ou use Live Server no VS Code (recomendado)
```

Tudo roda localmente. Persistência via `localStorage`.

---

## Stack

| | |
|---|---|
| Linguagem | HTML · CSS · JavaScript puro (vanilla) |
| Framework | nenhum |
| Build | nenhum |
| Dependências | nenhuma |
| Persistência | `localStorage` |
| Backend | nenhum (ainda) |

---

## Estrutura

```
luma/
├── index.html              # ponto de entrada — carrega tudo
├── assets/
│   ├── fonts/              # Realce Black (fonte proprietária DM)
│   └── logos/              # logos DM e Luma em PNG
├── css/
│   ├── 00-tokens.css       # variáveis CSS — cores, fontes, espaçamentos
│   ├── 01-reset.css
│   ├── 02-animations.css   # keyframes globais reutilizáveis
│   ├── 03-fonts.css
│   ├── components/         # topbar, modais, toast, splash, tutorial
│   └── modules/            # franqueado, designer, analytics, toolbar, layers
├── js/
│   ├── 00-config.js        # campanhas ativas, formatos, constantes
│   ├── 01-state.js         # estado global do franqueado
│   ├── core/               # toast, help, layout (smart resize), splash
│   ├── franqueado/         # catálogo, chat, gerador de PNG, histórico
│   ├── designer/           # canvas, layers, tools, publish, PSD/SVG import
│   ├── tutorial/           # engine de tutoriais animados
│   ├── dados/              # módulo analytics (em construção)
│   └── main.js             # bootstrap — troca de módulo
└── docs/
    ├── LUMA-CONTEXTO.md    # contexto completo para o Claude Code
    └── LUMA-INVENTARIO.md  # inventário de funções e componentes
```

---

## Módulos

### Módulo 1 — Franqueado `f*`
Chatbot guiado que gera artes a partir de templates publicados pelo designer.

Fluxo: catálogo de campanhas → seleciona material → chat (produto, preço, foto) → confirm card → PNG gerado → download.

Funcionalidades: upload de imagem com drag & drop, geração em lote via CSV, live preview ao vivo, histórico de artes, bulk com tela de revisão.

### Módulo 2 — Designer `d*`
Editor visual estilo Photoshop para criação de templates.

Funcionalidades: layers (texto, shape, moldura, imagem), variáveis `{{}}`, smart resize multi-formato, importação de PSD (ag-psd) e SVG (Illustrator), brush/eraser/eyedropper/bucket, undo/redo, upload de fontes, tutoriais animados, exportação PNG/JPG/SVG.

### Módulo 3 — CRM Visual *(planejado)*
Editor de inapp e push para CleverTap. Substitui o fluxo atual de ChatGPT + edição manual de HTML.

---

## Convenções de código

| Prefixo | Módulo |
|---------|--------|
| `f*` | Franqueado (`fStartChat`, `fGerarArte`) |
| `d*` | Designer (`dRenderCanvas`, `dPublishOpen`) |
| `g*` | Global (`gToast`, `gOpenHelp`) |
| `tut*` | Tutorial Engine (`tutOpen`, `tutNext`) |
| `pv*` | Preview Engine (`pvRender`) |
| `sp*` | Splash screen |

Funções são globais — sem `import`/`export`. Estado é variável `let` global modificada diretamente. Sem reatividade.

---

## Atalhos do Designer

| Tecla | Ação |
|-------|------|
| `V` | Mover |
| `T` | Texto |
| `R` | Retângulo |
| `F` | Moldura |
| `M` | Imagem |
| `B` | Pincel |
| `E` | Borracha |
| `I` | Conta-gotas |
| `G` | Bucket fill |
| `Ctrl+Z` | Desfazer |
| `Ctrl+Shift+Z` | Refazer |
| `Ctrl+C` | Copiar layer |
| `Ctrl+V` | Colar layer |
| `Ctrl+D` | Duplicar |
| `Ctrl+G` | Agrupar |
| `Ctrl+S` | Salvar rascunho |
| `P` | Preview |
| `Del` | Excluir layer |

---

## localStorage

| Chave | Conteúdo |
|-------|---------|
| `yngs_folders_v1` | pastas + templates + layers |
| `yngs_artboards_v1` | pranchetas do designer |
| `yngs_vars_v1` | catálogo de variáveis |
| `yngs_snippets_v1` | blocos reutilizáveis |
| `yngs_fonts_v1` | fontes enviadas em base64 |
| `dm_artes_hist_v2` | histórico de artes do franqueado |

Para limpar tudo e começar do zero:
```javascript
localStorage.clear(); location.reload();
```

---

## Brand book DM aplicado

| Token | Valor |
|-------|-------|
| `--dm-orange` | `#FF9000` |
| `--dm-orange-d` | `#F85400` |
| `--dm-red` | `#C81818` |
| `--dm-yellow` | `#FFB900` |
| `--dm-black` | `#0A0A0A` |
| Fonte display | Realce Black |
| Fonte UI | Roboto |

---

## Para o Claude Code

Antes de qualquer sessão, leia `docs/LUMA-CONTEXTO.md`.

Regras principais:
- Patch cirúrgico — adicione sem quebrar o que funciona
- Prefixos são sagrados — nunca renomeie funções existentes
- Sem dependências externas — sem npm, sem CDN, sem build
- Confirme o plano antes de executar qualquer fase
- `node --check` nos arquivos JS após cada mudança
- Não faça commit automático — mostre o diff e aguarde confirmação

---

## Time

| Papel | Pessoa |
|-------|--------|
| Design + produto | Ryan |
| Backend + dados | Pedro |

---

*Delivery Much · uso interno*
