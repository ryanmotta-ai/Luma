# Arte — como criar, adaptar e refinar um template de arte no Luma

> Sub-skill da `luma`. Vale quando o pedido é **uma arte**: "faz o template do X", "refaz essa arte", "olha essa referência, adapta pra gente", "melhora o preço", "cria o story". O fluxo geral da `luma` (lê o brain → planeja → implementa) continua valendo; aqui está o **como** de arte.
>
> Nasceu de uma sessão longa de trabalho com o Ryan (out/2026): dezenas de templates feitos, refeitos e refinados. O que está aqui é o que ele aprovou, o que ele rejeitou e as armadilhas do motor — não é teoria.

## Mapa deste diretório

| Arquivo | Para quê |
|---|---|
| **`ARTE.md`** (este) | O fluxo completo, do pedido ao push. Comece aqui. |
| `REFINO-15.md` | As **15 rodadas de refino** (padrão): o que olhar em cada uma, a nota, o critério de parada. |
| `REFERENCIA.md` | Quando o Ryan manda uma **referência** ("achei legal"): como ler, extrair a intenção e **adaptar** (sem copiar). |
| `DESIGN.md` | O sistema de design das artes: grade, margens, ritmo, escala tipográfica, paleta, raio, sombra, contraste, regras de ouro e proibições. |
| `MOTOR.md` | Como o motor de render funciona de verdade (layers, regras, Local Fit, fontes, armadilhas). **Leia antes de montar layers à mão.** |
| `BANCO.md` | Supabase: projeto certo, inserir/clonar/atualizar/publicar/reverter, assets no repositório, changelog, git. |
| `ferramentas/` | Harness de render real (Chromium), biblioteca de blocos (`lib.js`), medidor de PNG, exemplo funcional. Zero dependência. |

## Princípios (o que o Ryan pede, em ordem de peso)

1. **Palavra dele > tudo.** Ele corrige direto e rápido ("fica de fora", "só o banner", "esquece isso"). Obedeça literalmente; não "melhore" o que ficou fora do pedido.
2. **Proposta ≠ aplicar.** "Faz uma proposta / 3 opções / testa reimaginar" = **mostrar imagens e esperar a escolha** (nada no banco). "Faz", "sobe pra produção", "aplica" = **aplicar e publicar**. Na dúvida, mostre e recomende uma.
3. **Recomende, não faça menu.** Em toda proposta diga qual escolheria e por quê, em uma frase.
4. **Marca primeiro.** Logo DM, banner da campanha, paleta (roxo/amarelo/laranja/lilás conforme a campanha), Realce + Roboto. Nunca emoji (ícone é SVG), nunca cor fora da paleta sem motivo.
5. **A arte é dado, não imagem.** Tudo vira `layers` jsonb editáveis no Estúdio, com campos do franqueado (`{{produto}}`…). Fundo raster só quando for decoração que não muda; nome de arquivo **novo** a cada versão (cache do GitHub Pages).
6. **O franqueado digita qualquer coisa.** A arte precisa aguentar título longo, campo vazio, preço de 1 ou 3 dígitos. Se não aguenta, não está pronta (rodada 11).
7. **Feed e story andam juntos.** Mesmo nome nos dois ⇒ o app já os vincula (botão "Gerar versão Story/Feed"). Sempre entregue os dois, salvo pedido contrário.
8. **PT-BR** na conversa e na copy. Resposta curta, sem enrolação (modo caveman-lite).

## O fluxo (8 passos)

```
1 ENTENDER   → o que é a arte? pasta (campanha)? formatos? existe algo igual no banco? o que está FORA do pedido?
2 INVENTARIAR→ essenciais, assets que já existem (banner, logos, fontes), campos, regras de negócio
3 REFERÊNCIA → se veio uma: REFERENCIA.md (intenção → adaptação)
4 PROPOSTAS  → 3 caminhos (ou 1, se o pedido já é fechado), renderizados, lado a lado, com recomendação
5 REFINO     → 15 rodadas sobre a escolhida (REFINO-15.md) — render real em cada uma, olhar, nota, corrigir
6 STORY      → derivar do feed (zona segura), refinar o que o formato pede
7 PUBLICAR   → assets no git ANTES; inserir/atualizar no banco; publicar; changelog; commit + push (BANCO.md)
8 ENTREGAR   → resumo em PT-BR: o que ficou, o que mudou, o que NÃO foi feito, como reverter, uma pergunta de próximo passo
```

### 1 · Entender
- **Qual pasta?** `luma.pastas` (nome, `camp_id`). Se o pedido cita "a pasta X" e ela não existe com esse nome, **pergunte** qual usar (aconteceu: "Ofertas Favoritas" era a pasta "OFERTAS | Tudo no Precinho").
- **O que já existe?** Liste os templates da pasta e dos vizinhos. Pasta com rascunhos vazios ("Novo material") → deixe como está e diga.
- **Exclusões:** o Ryan já excluiu pastas inteiras (Aniversário, Entrega Grátis, Cupons) de lotes. Nunca mexa em template **existente** de outra pasta sem pedido explícito; criar template novo é seguro (só `insert`).
- **Banco certo:** o projeto Supabase mudou em 16/10/2026. Confira `.mcp.json` (hoje `xqsazcazsjxajmtmirzd`); o antigo `uqrqzjafhigjuvtjqzid` está pausado. Ver `BANCO.md`.
- **Repositório em dia:** `git pull --ff-only origin talpaipai` antes de tudo (o Ryan comita sem avisar; já passei por 44 commits de atraso).

### 2 · Inventariar (os essenciais de toda arte de preço)
Logo DM · banner da campanha · produto / detalhe / descrição · preço de/por · foto do produto · logo da loja · validade ou texto do rodapé. **Tudo o mais é decoração** e pode ser repensado — a menos que a referência/pedido exija.
- Banners: `assets/banners/<id>.png` (764×204 ou o PNG largo da campanha, alpha). Procure no repo; senão no Drive do Ryan (`mcp__Google_Drive__search_files`); se achar mais de um, mostre e use o mais próximo do pedido (foi assim com o "Combos/Combão com desconto").
- Logos DM: `assets/logos/dm-h-branca.png | dm-h-laranja.png | dm-h-preta.png | dm-h-principal.png`.
- Fotos/logos de teste: `assets/demo/*.jpg|png` (o `render.js` já os injeta com `{{FOTO}}` / `{{LOGO}}`).
- Fontes: `assets/fonts` — **Realce** (títulos e preço, `custom:Realce`) e **Roboto** (`'Roboto',400|700`, `'Roboto Black'`).

### 4 · Propostas
- 3 propostas **realmente diferentes** (estrutura, não só cor). Aconteceu: três variações do mesmo grid foram recusadas com "a forma de fundo ser diferente".
- Renderize no motor real (`ferramentas/render.js`), junte lado a lado numa imagem (PIL, canvas ou o próprio `render.js` + montagem) e mande com `SendUserFile`.
- Depois da escolha: refino (passo 5). Se ele já escolheu ("gostei da com fundo branco"), vá direto.

### 5 · Refino — ver `REFINO-15.md`
15 rodadas, cada uma = **render real → olhar a imagem → nota (rubrica) → lista de defeitos → correção**. Não pule o "olhar": é o que pega alinhamento torto, texto invadindo, contraste fraco.

### 6 · Story
1080×1920. **Zona segura:** ~250 px do topo e ~250 px da base podem ficar sob a interface do Instagram — nada essencial ali (rodapé de marca pode ficar, é assinatura). Derive do feed por **patches de posição** (mesmos ids, y diferente): topo livre, bloco do banner mais baixo, foto mais alta, rodapé em ~1760. Rode o estresse no story também.

### 7 · Publicar — ver `BANCO.md`
Ordem: (1) assets novos no git + push; (2) `insert` em rascunho; (3) conferir; (4) `publicado=true`; (5) changelog; (6) commit e push. Rascunho primeiro se for template novo; atualização in-place de template publicado só quando o pedido for explícito (a versão anterior fica em `template_versions`).

### 8 · Entregar
Estrutura da resposta (curta, PT-BR): **o que ficou** (3–6 bullets com as decisões visíveis) · **o que não fiz / limites** · **como reverter** · **uma pergunta** de próximo passo. Se verificou só no harness (não no app com login), **diga**.

## Quando parar e perguntar
- Pasta/campanha ambígua, banner que não achou, exclusão duvidosa, mudança que atinge template já publicado de outra campanha.
- Gosto/direção quando as 3 propostas não bastam (mostre e pergunte **uma** coisa).
- Não pergunte o que o código ou o banco respondem.

## Erros que já custaram caro (não repita)
- **Encher a arte para "melhorar"** — o Ryan cortou cupom, pílula, sobretítulo e plaquinhas da Black Bumerangue: *menos é mais, com mais assertividade no lugar certo*. Antes de pôr um elemento, pergunte o que ele faz pelo objetivo da peça; se repete outro (ex.: pílula "SÓ NO APP" + validade "no app"), sai.
- **Fonte fora de Realce + Roboto** — nem quando o pedido é "fora do comum" e a fonte já está registrada no Luma (Obviously, Nek Salma…). O Ryan cortou na hora (Black Bumerangue, 28/10/2026). O peso vem da composição, não da família.
- Gravar no banco antigo (pausado) ou esquecer de conferir o `.mcp.json`.
- Apontar template para asset que **ainda não foi pushado** (o app mostra imagem quebrada até o Pages publicar).
- Reaproveitar o **mesmo nome de arquivo** de um fundo e o navegador servir o antigo (cache).
- `spawnSync` do Chromium dentro do mesmo processo do servidor estático (trava: use o `render.js`, que é assíncrono).
- Confiar em render local de job **antigo**: reconstruir sempre a partir das layers do banco ou da lib (os campos de preço mudaram de posição ao longo do tempo).
- Entregar 3 "propostas" que são a mesma com outra cor.
- Texto que invade o vizinho quando o título quebra em 2 linhas (o motor **não** reflui).
- Aplicar em produção algo que era "só proposta".
