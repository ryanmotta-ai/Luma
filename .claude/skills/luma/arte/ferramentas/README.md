# Ferramentas de arte (zero dependência)

Tudo em Node (já usado pelo `scripts/run-browser-tests.js`) + o Chromium que a máquina já tem. **Nada de npm install.**

| Arquivo | O que faz |
|---|---|
| `harness.html` | Página que carrega o motor real do franqueado (`00-config.js`, Local Fit, `png-generator.js`, fontes) e renderiza um job. |
| `serve.js` | Servidor estático mínimo; raiz temporária com symlinks para `js/`, `css/`, `assets/` do repo. |
| `render.js` | **O comando principal.** `node render.js job.json [...] --out pasta` → PNG + `layers.json` + `fit.json` + 1 linha de resumo por job (`INVÁLIDA` = o franqueado seria bloqueado). `{{FOTO}}`/`{{LOGO}}` no `dados` viram imagens de `assets/demo`. `CHROME=…` aponta outro navegador. |
| `lib.js` | Blocos de layer: `rect text img foto logoLoja banner selo preco seloSerrilhado sparkle star rotarGrupo descricaoComSem ticket ticketRot`, `job()`, `contraste()`, `ESTRESSE` (as 7 variantes), `PAL`, `ELEV`. |
| `medir.js` | `bordas` (bordas esq./dir. da tinta numa faixa), `cor`, `paleta`, `caixa` (acha uma cor), para renders e referências em PNG. |
| `png.js` | Decodificador PNG mínimo (zlib). JPEG: converta antes. |
| `exemplo.js` | Arte de preço completa (a do Açaí aqui) + as 7 variantes de estresse. **Ponto de partida.** |

## Receita rápida
```bash
node .claude/skills/luma/arte/ferramentas/exemplo.js /tmp/arte          # 8 renders, ~1 min
node .claude/skills/luma/arte/ferramentas/render.js meu-job.json --out /tmp/arte
node .claude/skills/luma/arte/ferramentas/medir.js bordas /tmp/arte/meu-job.png 580 1224 '#fbf2ff'
```
Escreva o seu `minha-arte.js` copiando o `exemplo.js`: monte `layers` com a lib, gere `job(layers,{dados})` para o feed, derive o story por patches de `y`/`h`, rode `render.js` para todos, **olhe os PNGs**.

## Pegadinhas
- `render.js` é **assíncrono de propósito** (o servidor mora no mesmo processo; `spawnSync` do Chromium trava).
- Cada job leva ~8–15 s (Chromium + fontes). Rode as variantes de estresse em **um** comando (um servidor só).
- `--mode preview` renderiza como a prévia ao vivo (às vezes difere do export em adaptação de texto); decida pela **export**.
- A medida do `fit.json` vem do motor real; se `invalid:true`, **a arte não exporta**.
- Para montar imagem lado a lado das propostas, use Python/PIL fora da skill (`Image.paste`) ou qualquer visualizador; a skill não impõe.
- **Windows:** a busca do Chromium é de Linux — defina `CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe"`. O `serve.js` usa *junction* (symlink de pasta exige admin). Render solo leva ~1 s por job; vários agentes renderizando juntos disputam CPU e cada job fica 10× mais lento.
- **Trabalho longo com agentes:** notebook em Modern Standby dorme quando a tela apaga e derruba as chamadas dos agentes (eles reiniciam do zero). Segure a tela acesa (`SetThreadExecutionState` com `ES_DISPLAY_REQUIRED`) ou mantenha na tomada com a tela ligada.
