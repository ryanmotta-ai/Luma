# Fotos de exemplo do campo de imagem

Três fotos que o franqueado vê em **“Teste rapidamente com exemplos”**, no painel que abre
ao enviar uma foto. Servem para testar um material — e para mostrar o Luma em uma
apresentação — sem depender da galeria de ninguém.

## Coloque os arquivos aqui

| Arquivo | Conteúdo |
|---|---|
| `hamburguer.jpg` | um hambúrguer |
| `acai.jpg` | um açaí |
| `pizza.jpg` | uma pizza |

**Enquanto o arquivo não existir, a miniatura se remove sozinha** e, sem nenhuma delas, a
seção inteira some. Não fica quadrado quebrado na tela.

## O que faz uma boa foto aqui

- **Quadrada** (ou perto disso) e de **1000 a 1400px** de lado — o card é quadrado e a arte
  costuma recortar. Acima disso é peso sem ganho.
- **Até ~300KB** em JPG. A foto viaja junto no rascunho e no PNG final.
- **Produto sozinho, fundo limpo**, luz boa. Nada de texto, preço ou marca na foto: quem
  escreve o preço é a arte.
- Direitos resolvidos. É foto que vai para uma peça publicada.

## Trocar, acrescentar ou tirar

Tudo mora em uma lista só, em `js/franqueado/upload-panel.js`:

```js
const F_DEMO_IMGS = [
  { id:'burger', label:'Hambúrguer', src:'assets/demo/hamburguer.jpg', para:'produto' },
  …
];
```

- **Trocar a foto:** substitua o arquivo. Nada de código.
- **Trocar o nome que aparece:** mude o `label`.
- **Acrescentar uma quarta:** mais uma linha (a grade é de três por linha e quebra sozinha).
- **Logo de exemplo:** mesma lista, com `para:'logo'` — o painel já filtra por campo e as de
  logo só aparecem no campo do logo.

⚠ **O arquivo tem que ser local.** Foto de outro domínio contamina o canvas (*tainted*) e
quebra o download do PNG — e o franqueado só descobriria na hora de baixar a arte.
