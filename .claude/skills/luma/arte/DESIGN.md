# Sistema de design das artes (1080 px)

> As artes **não** são a interface do Luma, mas obedecem à mesma filosofia (`luma-brain/04_DESIGN_SYSTEM.md`, `05_DESIGN_PHILOSOPHY.md`, `design-review.md`): preciso, quente, sem cara de template genérico. Os números abaixo saíram do refino do Açaí aqui (aprovado) e do padrão das artes de preço.

## Formatos
| Formato | px | Observação |
|---|---|---|
| feed | 1080 × 1350 | padrão da maioria das artes |
| story | 1080 × 1920 | zona segura: **~250 px do topo** e **~250 px da base** podem ficar sob a interface; nada essencial ali (rodapé de marca é assinatura, pode) |
| post / wide | 1200 × 628 | raro; calcule a grade de novo |

## Grade e respiro
- **Margem lateral 72** (feed e story). Coluna útil `72 … 1008`.
- **Margem superior 64**, rodapé com respiro de **40** entre a foto e a faixa.
- **Tudo em múltiplos de 8** (4 para ajuste fino). Distância entre blocos **40**; entre rótulo e bloco **24**; entre linhas de texto do mesmo bloco **16–24**.
- **Alinhamento pela tinta, não pela caixa.** Fontes têm recuo (Realce ≈ 4–6 px à esquerda): compense o `x` da caixa para a **tinta** cair em 72 (medir com `medir.js bordas`). Imagens com alpha (banner) alinhem pelo **cartão**, não pelo enfeite que sai (mirtilos podem passar da margem).
- Centros alinhados quando os elementos estão lado a lado (banner × logo da loja: mesmo centro vertical).
- Respiro ≠ vazio: bloco vazio sem âncora é defeito (`design-review.md`). Se sobrou espaço, a foto cresce.

## Tipografia
| Papel | Fonte | Tamanho (feed) | Cor (fundo claro) |
|---|---|---|---|
| Produto | `custom:Realce` | 80 (1 linha) — o motor encolhe se passar | roxo escuro `#4a0f63` |
| Detalhe | `custom:Realce` | 48 | roxo médio `#6b2a86` |
| Descrição | `'Roboto',400` | 26 (lineHeight 1,3) | roxo médio |
| Preço (inteiro) | `custom:Realce` | 84–134 (k×84) | conforme herói |
| "DE" tachado | `custom:Realce` | 32–36 | roxo médio / branco no selo |
| Selo "PROCURE O BANNER" | `'Roboto Black'` | 20 | branco sobre roxo |
| Rodapé | `'Roboto',400` | 24 | branco sobre roxo |

- **Corpo ≥ 24 px no feed** (regra do brain: nunca < 12 px na UI; em arte 1080 o piso prático é 22).
- Realce: altura de maiúscula ≈ **0,69 em**; título em caixa-alta. Roboto 900/`'Roboto Black'` para microrrótulos.
- Poucos tamanhos (4–5 no total). Peso contrasta com o corpo.
- Texto tachado **nativo** (`strikethrough:true`) tem espessura 5 % do corpo — fino e legível. **Não** desenhe risco por retângulo grosso (já gerou reclamação: "29 parece 23"); se precisar de risco gráfico, ≤ 5 px.

## Paleta
Marca (tokens do brain): laranja `#FF9000`, laranja-escuro `#F85400`, amarelo `#FFB900`, vermelho `#C81818`. Campanha traz a sua (Açaí: roxo `#831CA5`, escuro `#4A0F63`, médio `#6B2A86`, lilás `#FBF2FF`).
- **Fundo claro** (lilás/creme) + **cor de campanha** nos blocos de peso funciona e destaca banner e preço.
- **Nunca texto branco sobre `#FF9000`** (2,27:1 — reprova). Sobre `#F85400` só texto **grande e bold** (3,35:1).
- Texto pequeno laranja sobre claro: `#F85400` grande/bold ou `#C81818`; nunca `#FF9000`.
- Texto sobre foto: nunca direto — cartão/faixa translúcida (≥ 70 % de opacidade) por baixo.
- Contrastes medidos nas artes aprovadas: título 12,5:1 · apoio 8,4:1 · preço sobre amarelo 7,9:1 · branco sobre roxo 7,9:1 · "DE" 5,9:1. Alvo: **≥ 4,5:1 em tudo que é lido**.
- No máx. **1 acento** novo além da paleta da campanha.

## Forma, raio, sombra
- **Uma família de raio** por arte: 40 (cartão, foto, etiqueta), pílula (`h/2`) para selos, círculo para logo da loja. Nada de raio aleatório.
- **Uma sombra de elevação** para tudo: `rgba(74,15,99,0.22)`, blur 16, dist 6, ângulo **90** (reta para baixo; o padrão do motor é 135 — diagonal). Banner: contorno branco 4 px + sombra `rgba(0,0,0,.22)` blur 10 dist 4. Sombra pesada/preta cheia é proibida.
- Logo da loja: círculo com aro (8 px), cor de acento.
- Sobreposição entre elementos: **uma só e de propósito** (ex.: selo de preço sobre o canto da foto). O resto não encosta em nada.

## Peso da promoção (artes de preço)
O preço é o herói. Escalas que funcionaram, da mais discreta à mais forte:
1. **Etiqueta amarela** arredondada com o preço em roxo escuro (limpa, legível).
2. **Selo serrilhado** laranja (28 pontas, girado −8°) sobre selo amarelo maior (18 pontas, +6°), preço em **branco** 134 px, "POR APENAS" embaixo, "DE" tachado em cima, 3 brilhos — **o que o Ryan aprovou** para "dinâmico e com peso". Exige `rotarGrupo` (cada layer gira no próprio centro).
3. Preço tipográfico gigante sem caixa (só quando o fundo é liso).
Regras: "DE" ≈ metade do "POR"; centavos menores e subidos (superscript); `R$` pequeno na linha de base; sem preço ⇒ selo, preço e brilhos somem; sem "DE" ⇒ preço sobe e centraliza (grupo duplicado com `rules`).

## Banner, logos, selos
- **Banner da campanha** sempre presente, com o selo "PROCURE O BANNER" (pílula roxa, texto branco) **acima ou ao lado**, nunca cobrindo o banner. Banner + logo da loja numa **linha própria** (sem tocar na foto) é o padrão limpo.
- Logo DM no **rodapé** (branco sobre roxo) ou no topo (laranja sobre claro); largura 176–198; sem deformar (`38/198`).
- Logo da loja: círculo 160–176 px no feed; centro alinhado ao do banner.
- Filete amarelo de 6 px no topo da faixa do rodapé amarra a etiqueta amarela à base.

## Fundo
- **Liso primeiro.** Forma de fundo só quando muda a leitura (faixas, toldo, anéis). O fundo claro limpo foi o que ele escolheu entre 3 caminhos.
- Fundos raster: PNG gerado, **nome novo a cada versão**, em `assets/campanhas/<campanha>/`, 1080×1350 e 1080×1920 (story é outra imagem, não esticada).
- Formas que passam **atrás** da foto/banner só precisam existir na parte visível.

## Proibições (resumo do brain aplicado a arte)
Cards enormes sem função · cinza demais · branco vazio sem âncora · botões/selos gigantes · raio inconsistente · sombra preta/pesada · tipografia pequena · layout apertado · componentes desalinhados · emoji como ícone · gradiente em botão/selo de ação · cor solta fora da paleta.
