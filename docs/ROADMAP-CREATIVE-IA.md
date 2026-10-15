# Roadmap — Luma Creative: IA que usa um banco de assets gigante (v0, 15/10/2026)

> Desenhado em conversa com o Ryan em 15/10/2026. **É um rascunho vivo**: marque os checks ao
> concluir e registre aqui toda decisão nova. Não substitui o `luma-brain/07_ROADMAP.md` (v1 do produto).

## O que o Ryan quer

Artes **extremamente boas** feitas pela IA, com um **banco de assets grande, fora do repositório**
(para o repo não pesar), **segmentado** por marca, objetivo e formato, e **refinado arte por arte**
("isso não ficou legal") **sem bloquear a criatividade** do agente.

## Onde estamos (código real, 15/10/2026)

- A IA (`arte.compor`, `crDesenhos` em `js/creative/creative.js`) **não desenha**: posiciona os blocos
  oficiais em caixas e escolhe grafismos do inventário. Quem desenha é o motor local; `crAvaliar`
  confere a geometria e `crNota` dá a nota. O prompt diz "Você NÃO desenha nem cria imagem ou asset".
- Assets do Creative moram **no repo**: `assets/creative/` (elementos, fontes, inv, logos, régua, slides).
  O `assets/` inteiro pesa ~32 MB.
- **Já existe precedente fora do repo:** o Estúdio sobe a biblioteca para o bucket público
  `luma-template-assets` (Supabase) e cataloga no banco (`js/designer/library.js`,
  migration `20260618094000_storage_buckets.sql`). Imagem `https` no canvas já usa
  `crossOrigin='anonymous'` (`png-generator.js`), e o bucket público serve CORS aberto, então o PNG
  não "contamina" o canvas — **confirmar no navegador na Fase 1**.
- Já existem peças para refinar: juiz de visão `arte.criticar`, curadoria 👍/👎 (`curadoria.js`),
  golden das composições e a bancada `tests/_bancada-creative.html`.

## Decisões do Ryan (15/10/2026)

| Tema | Decisão |
|---|---|
| Liberdade da IA | **Só o 1º degrau por agora:** a IA escolhe os assets e compõe melhor, mantendo os blocos oficiais. SVG livre e imagem gerada ficam para depois. |
| Tipos de asset | Grafismos/ilustrações/selos · fundos e texturas · artes aprovadas como referência. (**Fotos de produto não entram agora.**) |
| Origem | Drive/Figma do time de design (já há acervo). |
| Segmentos | **Marca** (Delivery Much, much+, outras) · **objetivo** · **canal/formato**. Sazonalidade fica de fora por enquanto. |
| Quem alimenta | **Designer do time entra direto; a gestão só audita.** Escrita de asset já é só `equipe_dm`/`gestao` (`is_designer()`), então coincide com a regra da casa. |
| Refino | O "não ficou legal" vira **regra por marca + objetivo**, editável. |
| Meta de qualidade | **O olho do Ryan decide**, fase a fase. Sem métrica formal. |
| Primeiro passo | **Banco no Supabase + upload manual.** A esteira Drive → banco (n8n) vem depois. |

## Princípio: regra dura × preferência

É isso que dá liberdade sem virar bagunça.

- **Regra dura** = marca. Cores, fontes, logo, margens e legibilidade ficam no motor e no lint, como
  hoje. A IA nunca quebra, e `crAvaliar` reprova se quebrar.
- **Preferência** = gosto e estilo (clima, tipo de fundo, referência). Entra no prompt como
  orientação, não como grade. A IA pode ousar dentro dela.
- Todo "não ficou legal" nasce como **preferência**. Só vira regra dura se o Ryan promover.

## Fases

### Fase 0 — Linha de base (barata)
- [ ] Salvar uma rodada da bancada (`tests/_bancada-creative.html`, `?antes=`) com o motor atual,
  para comparar o antes/depois **olhando as saídas**.

### Fase 1 — Banco fora do repo, com upload manual  ← **primeiro passo**
- [ ] Bucket público `luma-creative-assets` (mesmo molde dos buckets `luma-*`, escrita só `is_designer()`).
- [ ] Tabela `luma.creative_assets`: `id`, `url`, `tipo` (grafismo, ilustração, selo, fundo,
  textura, referência), `marca`, `objetivos[]`, `formatos[]`, `estilo[]`, `tags[]`, `status`
  (ativo/arquivado), `criado_por`, `criado_em`. RLS: leitura `authenticated`; escrita `is_designer()`
  com `WITH CHECK`; sem delete físico (arquiva). Migration no `docs/LUMA-BACKEND-CHANGELOG.md`.
- [ ] Tela de upload e edição de tags para o designer (extensão do painel que já existe no Estúdio;
  ver `js/designer/library.js` antes de criar tela nova).
- [ ] ~10 assets de teste entrando, e o Creative **usando um asset de fora do repo** na arte, com o
  PNG exportando sem erro de CORS.
- [ ] Decidir o destino de `assets/creative/inv` e `elementos` (migrar para o banco ou ficar no repo
  só o essencial: fontes e logos).

### Fase 2 — Ingestão Drive/Figma (n8n)
- [ ] Fluxo n8n: pasta do Drive → Storage + linha em `creative_assets`; IA de visão **sugere** as tags.
  O n8n fica **fora do caminho crítico** (o Creative funciona sem ele) e a chave `service_role` mora só nele.
- [ ] Ritual de auditoria da gestão (lista do que entrou, arquivar o que não presta).

### Fase 3 — Regras por marca × objetivo × canal
- [ ] Tabela de regras com `dura` ou `preferência`, por marca, objetivo e formato.
- [ ] Mais de uma marca de fato (hoje Delivery Much e much+): levantar quais são as "outras".
- [ ] Tela simples de edição (só gestão).

### Fase 4 — A IA escolhe os assets
- [ ] Filtro por marca, objetivo e formato monta uma **lista curta com miniaturas**; a IA escolhe e
  compõe (`crPromptDesenho` + função `ai`). O motor desenha e `crAvaliar` valida, como hoje.
- [ ] Artes aprovadas de referência entram no prompt como exemplos visuais.
- [ ] Atualizar o prompt que hoje proíbe a IA de usar assets fora do inventário.

### Fase 5 — Refino arte por arte
- [ ] Voto "não ficou legal" + motivo → **preferência** por marca/objetivo (extensão da `curadoria.js`).
- [ ] O juiz `arte.criticar` passa a enxergar as referências do banco.
- [ ] Regra de promoção de preferência para regra dura (só gestão).

### Depois (decidido NÃO fazer agora)
- IA escrevendo SVG livre dentro de guarda-corpos.
- Modelo de imagem gerando fundos e ilustrações.
- Fotos de produto no banco (direitos de uso e recorte).
- Sazonalidade/calendário como eixo de segmentação.

## Em aberto (precisa do Ryan)

1. Quais são as "outras" marcas além da Delivery Much e da much+?
2. Quais são as **regras duras** de cada marca, exatamente? (Parte já está na skill luma-creative; falta conferir.)
3. Quem do time de design entra primeiro e com quantos assets de teste?
4. Os assets do Drive têm licença para uso (se vieram de banco externo)?
