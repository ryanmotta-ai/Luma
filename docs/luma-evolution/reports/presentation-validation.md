# Validação visual dos slides

Rodada automática sobre `presentation/luma-evolution.html` — **31 slides**, palco de 1920×1080.

O que foi medido em cada slide:

1. Elemento que sai da página.
2. Texto realmente cortado — só conta quando algo clipa de fato (`overflow` diferente de `visible`), porque `scrollHeight > clientHeight` sozinho dispara em qualquer `line-height` abaixo de 1.
3. Imagem deformada (proporção natural contra a da caixa, tolerância de 6%).
4. Fonte abaixo de 14px.
5. Densidade: mais de 1.400 caracteres num slide.
6. Contraste do texto de corpo (mínimo 4.5:1, WCAG AA).

---

## Resultado

| Verificação | Resultado |
|---|---|
| Slides analisados | 31 |
| Problemas de layout | **nenhum** |
| Textos de corpo medidos | 61 |
| Contraste abaixo de 4.5:1 | **nenhum** |
| Menor contraste medido | 8.26:1 |

## Problemas de layout

Nenhum. Nenhum elemento sai da página, nenhum texto está cortado, nenhuma imagem está deformada e nenhum slide passou do teto de densidade.

## Contraste

Todos os 61 textos de corpo medidos passam de 4.5:1.

---

## O que esta rodada NÃO cobre

- Se a narrativa faz sentido na ordem em que está.
- Se a captura escolhida é a que melhor mostra o ponto do slide.
- Se o texto está correto quanto ao fato — isso é o índice de evidências que responde.

Essas três coisas precisam de leitura humana. O resto é o que está medido acima.
