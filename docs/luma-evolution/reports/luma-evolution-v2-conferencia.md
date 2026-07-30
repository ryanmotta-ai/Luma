# Conferência visual dos slides

`presentation/luma-evolution.html` — **39 slides**, palco de 1920×1080.

Medido em cada slide: elemento fora da página; texto realmente cortado (só conta quando um contêiner com `overflow` diferente de `visible` clipa — `scrollHeight > clientHeight` sozinho é falso positivo);
imagem sem espaço; fonte abaixo de 14px; mais de 1.500 caracteres num slide; e contraste do texto de corpo (mínimo 4.5:1, WCAG AA).

| Verificação | Resultado |
|---|---|
| Slides | 39 |
| Problemas de layout | **nenhum** |
| Textos de corpo medidos | 63 |
| Contraste abaixo de 4.5:1 | **nenhum** |
| Menor contraste medido | 8.26:1 |

## Problemas de layout

Nenhum.

## Contraste

Todos os 63 textos de corpo medidos passam de 4.5:1.

---

## O que esta conferência NÃO cobre

- Se a narrativa faz sentido na ordem em que está.
- Se a captura escolhida é a que melhor mostra o ponto do slide.
- Se o texto está correto quanto ao fato — isso é o índice de evidências que responde.

Essas três coisas precisam de leitura humana.
