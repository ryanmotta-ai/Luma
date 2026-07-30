# Luma — apresentação da evolução

Apresentação visual de como o Luma mudou, montada **executando cada versão antiga** em vez de descrevê-la. Toda imagem é uma captura real; nenhuma é reconstrução ou ilustração.

```bash
node docs/luma-evolution/scripts/tudo.js                 # reconstrói tudo (~25 min)
node docs/luma-evolution/scripts/tudo.js --faltando      # captura só os marcos sem PNG
node docs/luma-evolution/scripts/tudo.js --sem-captura   # só remonta os slides (~1 min)
```

Saída em `presentation/`: `.pptx`, `.pdf`, `.html`, um PNG por slide, notas do apresentador e índice de evidências.

---

## Como funciona

O Luma não tem build: é HTML, CSS e JS servidos direto. Por isso **qualquer commit do passado ainda roda hoje** — basta servir a pasta daquele commit. É o que torna esta apresentação possível sem nenhum deploy antigo guardado.

O motor é `scripts/versao.js` (na raiz do projeto), reaproveitado aqui — não clonado:

1. `git worktree` do commit, em `/tmp`. A árvore de trabalho nunca é tocada.
2. As credenciais do Supabase são **zeradas dentro da cópia**. Um front de duas semanas atrás escrevendo no banco de hoje seria estrago silencioso.
3. Uma sessão de demonstração é injetada, então não há login nem credencial em lugar nenhum.
4. Playwright navega até cada tela e fotografa.

O que aparece nos prints é o **conteúdo de exemplo do próprio commit**, renderizado offline.

---

## Estrutura

```
docs/luma-evolution/
├── research/origem/         o piloto Yungas — a única evidência anterior ao git
├── commit-map/
│   ├── milestones.json      os marcos, com a justificativa de cada escolha
│   ├── luma-timeline.md     todos os commits, por dia, com área afetada
│   └── screens-by-commit.json  o que cada marco conseguiu renderizar
├── screenshots/
│   ├── original/<marco>/    as capturas, sem anotação
│   └── metadata/<marco>/    um JSON por PNG: tela, commit, data, viewport, tipo
├── scripts/                 ver abaixo
├── presentation/            as saídas
└── reports/                 runtime por marco, conferência visual, limitações
```

---

## Os scripts

| Arquivo | O que faz |
|---|---|
| `tudo.js` | Roda tudo na ordem certa. É o comando que você quer. |
| `capturar.js` | Sobe cada marco e fotografa as cenas. Timeout por cena e por marco. |
| `cenas.js` | **Define o que é fotografado.** Cada cena sabe chegar até si mesma. |
| `slides.js` | A narrativa. Os números do produto são contados aqui, a cada montagem. |
| `estilo.css` | A identidade visual dos slides. |
| `publicar.js` | HTML → confere o layout → PNGs → PDF → notas → índice. |
| `montar-pptx.py` | Empacota os PNGs no `.pptx`, com as notas no campo de notas. |

---

## Tarefas comuns

**Incluir um commit como marco** — acrescente um objeto em `commit-map/milestones.json` com `id`, `data`, `hash`, `rotulo`, `era`, `porQue` e `fatos`, e rode `node scripts/capturar.js <id>`. O campo `porQue` não é enfeite: é o que impede a lista de virar uma coleção de commits aleatórios.

**Capturar uma tela nova** — acrescente uma cena em `scripts/cenas.js`. Ela precisa saber navegar até a tela e devolver `true` só quando a tela realmente apareceu. Cena que devolve `false` numa versão antiga vira evidência de que a tela ainda não existia.

**Mudar o texto de um slide** — em `scripts/slides.js`, depois `node scripts/tudo.js --sem-captura`.

**Mudar a identidade visual** — `scripts/estilo.css`. Um slide é 1920×1080 em px absolutos: o destino é PNG e PDF de tamanho fixo, não há responsividade a resolver.

**Recapturar um marco só** — `node scripts/capturar.js M7`. O mapa dos outros marcos é preservado.

---

## Dependências

| O quê | Onde | Nota |
|---|---|---|
| Node 22 + Playwright | já no ambiente | `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` |
| `python-pptx` | `pip install python-pptx` | só para gerar o `.pptx` |

⚠️ **Isto não fere a regra de "nenhuma dependência nova" do Luma.** Aquela regra é sobre o **front do produto**, que continua vanilla JS, sem build e com zero dependência de runtime. Playwright e python-pptx são ferramenta de autoria desta apresentação e não entram em nada que o franqueado carrega.

---

## Problemas conhecidos

- **O git não guarda o começo do Luma.** Duas raízes órfãs, ambas de 2026-07-16, ambas já com o produto inteiro. A única evidência anterior é `research/origem/yungas-artes-piloto.html`, entregue fora do repositório.
- **O histórico versionado tem 15 dias** (16 a 30 de julho de 2026), 71 commits, sem tags nem releases. Não há como mostrar eras de meses.
- **Telas que dependem do banco aparecem com o conteúdo de exemplo do commit**, não com dados reais. Proposital: nenhuma captura toca produção.
- **Algumas telas não são alcançáveis offline** — as que exigem um template salvo no banco. Cada caso está em `reports/limitacoes.md`.
- **O texto do `.pptx` não é editável**: cada slide é a imagem conferida. Para mudar conteúdo, mexa em `slides.js` e rode `tudo.js --sem-captura`.
- **Peso em disco**: as capturas são PNG a 2× e somam dezenas de MB. Se o repositório ficar pesado, o caminho é versionar só `presentation/` e reconstruir `screenshots/` sob demanda.
