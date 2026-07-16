# Luma

> **A arte do post pronta em menos de um minuto — sem saber design.**

Luma é a plataforma de **creative automation** interna da Delivery Much. O designer monta o template **uma vez**; cada franqueado gera a própria arte, sempre dentro da marca, respondendo um chat guiado. **Um template, todas as cidades. Zero peça fora do padrão.**

---

### Para quem cria (designer)
Editor estilo Photoshop no navegador — camadas, campos editáveis (`{{produto}}`, `{{preço}}`), validade e permissões por camada. Publica e a rede inteira já tem acesso, sem deploy.

### Para quem usa (franqueado)
Escolhe a campanha, responde umas perguntas (produto, preço, foto) e baixa a arte pronta em **Story, Feed ou Post** — PNG ou PDF. De brinde, 3 sugestões de **legenda** prontas pra colar.

---

### Por que importa
- **Arte em menos de 1 min** — do template ao PNG, sem fricção.
- **Sempre na marca** — o franqueado preenche, nunca desenha do zero.
- **Um template, muitas cidades** — o designer não refaz a mesma peça N vezes.
- **Zero setup** — HTML/CSS/JS puro. Sem build, sem dependências. Abre e roda.

---

### Rodar

```bash
git clone <repo> && cd luma
# abra index.html no navegador (ou Live Server no VS Code)
```

Roda 100% no navegador. Com Supabase configurado, sincroniza o catálogo entre dispositivos; sem credenciais, cai em modo local (`localStorage`).

**Detalhe técnico, arquitetura e convenções — [`docs/LUMA.md`](docs/LUMA.md)** · Contexto de produto — [`luma-brain/`](luma-brain/).

---

<sub>Delivery Much · uso interno · Design/produto: Ryan · Backend/dados: Pedro</sub>
