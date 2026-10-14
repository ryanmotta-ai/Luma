# Imagens de exemplo do campo de imagem

O que o franqueado (e o visitante do QR) vê em **“Teste rapidamente com exemplos”**, no painel que
abre ao enviar uma foto ou um logo. Servem para testar um material — e para mostrar o Luma em uma
apresentação — sem depender da galeria de ninguém. A lista mora em `F_DEMO_IMGS`
(`js/franqueado/upload-panel.js`); **trocar ou acrescentar = pôr o arquivo aqui e mexer numa linha lá.**

## O que tem

| Tipo | Arquivos |
|---|---|
| Produto (17) | `hamburguer` `burger-classico` `burger-batata` `pizza` `batata-frita` `cachorro-quente` `sanduiche` `sushi` `churrasco` `prato` `bowl` `donuts` `bolo` `sorvete` `picole` `milkshake` `bebida` (`.jpg`, 1100×1100, ≤ 280 KB) |
| Logo (7) | `logo-loja.png` (neutro) + `logo-burger-club` `logo-pizzaria-nonna` `logo-acai-tropical` `logo-sushi-kai` `logo-cafe-do-bairro` `logo-doce-vida` (`.png`, 800×800) |

A **miniatura do catálogo** usa a 1ª foto `para:'produto'` e o 1º logo `para:'logo'`
(`fSampleDadosForLayers`, em `png-generator.js`). Por isso `hamburguer.jpg` e `logo-loja.png` seguem no topo.

## Procedência e direitos

- **Fotos:** Unsplash (licença Unsplash: uso livre, inclusive comercial, sem atribuição obrigatória).
  Ids: `burger` 1568901346375-23c9450c58cd · `burger-classico` 1571091718767-18b5b1457add ·
  `burger-batata` 1551782450-a2132b4ba21d · `pizza` 1565299624946-b28f40a0ae38 ·
  `batata-frita` 1630384060421-cb20d0e0649d · `cachorro-quente` 1612392062631-94dd858cba88 ·
  `sanduiche` 1553909489-cd47e0907980 · `sushi` 1579871494447-9811cf80d66c ·
  `churrasco` 1555939594-58d7cb561ad1 · `prato` 1600891964092-4316c288032e ·
  `bowl` 1546069901-ba9599a7e63c · `donuts` 1551024601-bec78aea704b ·
  `bolo` 1565958011703-44f9829ba187 · `sorvete` 1497034825429-c343d7c6a68f ·
  `picole` 1488900128323-21503983a07e · `milkshake` 1577805947697-89e18249d767 ·
  `bebida` 1556679343-c7306c1976bc  (`https://unsplash.com/photos/<id>`).
- **Logos:** marcas **fictícias**, desenhadas para o Luma (SVG → PNG, fonte Roboto Black). Nenhuma
  marca real: logo "genérico da internet" quase sempre é marca registrada de alguém.
- **Sem açaí:** não achei foto de açaí limpa e livre; o `logo-acai-tropical` existe, a foto não.

## ⚠ Regras que não mudam

- O arquivo é **LOCAL** de propósito. Imagem de outro domínio contamina o canvas (*tainted*) e quebra
  o download do PNG — o franqueado só descobriria na hora de baixar a arte.
- Enquanto o arquivo não existir, a miniatura se remove sozinha (`fDemoImgMissing`).
- Foto boa aqui: quadrada, 1000–1400 px, ≤ ~300 KB, produto em destaque, **sem texto, preço ou marca
  visível** (descartei fotos com lata de refrigerante e papel de embrulho estampado).
