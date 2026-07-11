# 05 — FILOSOFIA DE DESIGN · O espírito visual do Luma

> Este documento define a bússola estética e de experiência do Luma. 
> Responde o que o Luma é, o que ele quer transmitir, como o usuário deve se sentir e o que ele **nunca** deve parecer.
> Use-o como guia conceitual antes de criar novas interfaces ou propor interações.

---

## 1. O que é o Luma (sob a ótica do Design)?

O Luma é uma ferramenta de **autoatendimento visual** corporativo. Não é um editor gráfico de propósito geral, mas uma **esteira inteligente de montagem**. 
O design do Luma não serve para dar liberdade total de criação, mas para **viabilizar velocidade e consistência de marca**. A beleza do Luma está na eficiência estrutural e na perfeição da entrega final, garantindo que o franqueado no interior do Brasil crie peças excelentes sem precisar saber design.

---

## 2. Como o usuário deve se sentir ao usar?

### O Franqueado (Dono da unidade no interior)
* **Seguro e amparado:** Deve sentir que é impossível errar ou estragar a marca.
* **Rápido:** Sensação de superpoder e agilidade. O processo deve parecer um atalho, não um dever de casa.
* **Valorizado:** Sentir que está entregando material de nível de agência para os seus restaurantes locais.

### O Designer / Estúdio (Criador dos templates)
* **No controle:** Sentir que a ferramenta respeita sua intenção original de design e regras de grid/texto.
* **Focado:** Experiência profissional, limpa e produtiva, sem distrações visuais.

---

## 3. Valores que o design transmite

### Simples, mas poderoso
O Luma esconde a complexidade sob um capô elegante. A interface do franqueado resolve com perguntas simples do chat e prévia imediata. A interface do estúdio organiza dezenas de propriedades complexas de camadas em uma barra lateral limpa e hierárquica.

### Profissional sem ser intimidador
A linguagem visual é acolhedora (tema claro e convidativo para o franqueado) mas transmite seriedade operacional. Não usamos uma estética infantil nem "gamificada" de forma boba; a tipografia é sóbria (Roboto) e as superfícies são elegantes.

### Pouca poluição visual (Minimalismo focado)
Cada tela tem uma intenção primária. Se o franqueado está preenchendo a arte, a própria arte em progresso é o herói da tela. Se o designer está editando, as réguas, camadas e canvas dominam. Espaçamentos fluidos e margens generosas dão "respiro" à UI.

### Alta velocidade percebida
As transições são ultra-rápidas e sutilmente fluidas (`--dur-fast` 180ms e `--dur-micro` 140ms). O feedback visual de carregamento ou prévia é instantâneo e progressivo. O usuário nunca deve sentir que a tela travou ou que a renderização é pesada.

### Aparência premium
Uso consistente de tokens, bordas finas com transparência, sombras coloridas baseadas na marca, efeitos de vidro (`backdrop-filter`) e gradientes suaves na topbar. Detalhes minuciosos (micro-animações de hover, entradas em cascata, pulso suave de confirmação) que dão o aspecto de produto lapidado e topo de linha.

### Consistência acima de criatividade
A consistência do sistema de design acelera o aprendizado e reduz a fricção. Reutilizamos as mesmas estruturas de grid, filtros, botões, chips e inputs. No Luma, "inventar" uma nova forma de interagir só porque parece bonita é desencorajado. A consistência da marca e o comportamento uniforme da UI são prioridades absolutas.

---

## 4. O que o Luma NUNCA deve parecer?

* **❌ Não deve parecer um "Canva genérico" ou "Photoshop na nuvem":** O Luma não deve ter centenas de botões de efeitos, layouts de colagem bagunçados ou ferramentas flutuantes desorganizadas na tela do franqueado.
* **❌ Não deve parecer amador ou improvisado:** Nada de emojis perdidos na interface do usuário (com exceção de toasts legados temporários), cores vibrantes aleatórias fora dos tokens, ou desalinhamento de pixels.
* **❌ Não deve parecer um sistema corporativo cinza e burocrático (ERP antigo):** O Luma não é um dashboard estático e sem vida. Ele tem movimento, tem o brilho do Laranja Delivery Much, e responde com transições fluidas que dão a sensação de dinamismo.
* **❌ Não deve parecer "pesado" ou lento:** Nada de spinners gigantes travando a tela inteira por segundos. O renderizador deve atualizar em tempo real ou mostrar transições parciais leves.
* **❌ Não deve parecer fora da marca Delivery Much:** A identidade visual é forte. As cores do Luma e os componentes devem sempre remeter ao universo visual da DM (como o laranja primário, neutros sofisticados e tipografia preta pesada).

---

## 5. Como aplicar a Filosofia no código

1. **Use os tokens:** Hexadecimal solto viola a Aparência Premium.
2. **Trilho de marca para o Franqueado:** O front deve guiar, nunca dar liberdade excessiva (consistência acima de criatividade).
3. **Motion funcional:** Transições e hovers sutis aumentam a velocidade percebida e a elegância.
4. **Icons consistentes:** SVGs limpos com `currentColor`, sem variação de estilo ou emojis.
