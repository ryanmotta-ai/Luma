# V1 — HANDOFF DE BACKEND (o que o front NÃO consegue provar)

> Criado em 2026-09-06, na auditoria de **honestidade do produto** do fluxo do franqueado.
>
> **Regra deste arquivo:** aqui entra tudo que só se comprova com acesso ao Supabase
> (dado real, policy real, RPC real). Nada nesta lista pode ser dado como aprovado a partir
> da leitura do front. Quem tiver acesso ao projeto roda a verificação e marca o item.
>
> O que o front já garante e o que ele mede está em `luma-brain/07_ROADMAP.md` e nas suítes
> de `tests/`. O changelog de schema continua em `docs/LUMA-BACKEND-CHANGELOG.md`.

---

## 1. `luma.artes` — o histórico que a interface chama de "minhas artes"

- [ ] **Confirmar que o `upsert` realmente grava.** O front usa
  `sb.schema('luma').from('artes').upsert(row,{onConflict:'id'})` em
  `js/franqueado/history.js` e trata `error` — mas um `error` de RLS e um sucesso vazio
  chegam iguais na tela: em ambos a arte fica no localStorage e a pessoa vê a mesma
  biblioteca. **Verificar com um usuário `franqueado` de teste** que a linha existe no banco
  depois de baixar uma arte.
- [ ] **Regressão do lock (06/09/2026).** Até esta auditoria, `fPushArtesToBackend` estourava
  `ReferenceError` no `finally` (variáveis do `try` invisíveis lá) e o lock
  `_fArtesPushBusy` ficava preso: **depois do primeiro push da sessão, nenhuma arte subia**,
  em silêncio (a rejeição era engolida pelo `.catch(()=>{})` do `fSaveHist`). O bug está
  corrigido e coberto por `tests/franqueado-honestidade.html`, mas **é preciso conferir no
  banco quantas artes deixaram de subir** enquanto ele existiu, e se algum franqueado tem
  biblioteca local mais rica que a do servidor.
- [ ] **Artes de DEMONSTRAÇÃO nunca podem existir no banco.** O front agora pula entradas
  `_demo` no push. Conferir se restou lixo de antes: linhas de `luma.artes` com
  `template_id IS NULL` e `material_name` começando por `Modelo ` são candidatas a arte
  gerada em cima do material-demo — decidir se apaga ou marca.
- [ ] **`fClearHist` apaga mesmo.** O front só limpa o local depois do `delete` remoto dar
  certo. Verificar a policy "dono apaga suas artes" com um usuário de teste.

## 2. `luma.templates` / `luma.pastas` — o que a vitrine chama de "pronto"

- [ ] **`publicado` e `validade` são confiáveis?** A vitrine inteira agora depende deles:
  "Prontas para usar", a contagem do card, o hero, a prévia e os dias restantes saem de
  `publishMeta.publicado === true` + `publishMeta.validade`. Se o banco tiver template
  publicado sem validade, ou validade em formato diferente de `YYYY-MM-DD`, a interface
  volta a calar (não mente, mas some com a informação). **Rodar um `select` de sanidade**
  em `templates(publicado, validade)`.
- [ ] **Template publicado com `layers` vazio.** O front já trata (`fEnsureMaterialLayers`
  mantém a flag e o card cai em estado de erro), mas isso é um dado quebrado no banco:
  **listar `templates` com `publicado=true` e `layers` nulo/vazio** e corrigir na origem.
- [ ] **`expira_dias` (pastas) não é mais fonte de verdade em lugar nenhum da interface.**
  Ele continua existindo no schema e no Estúdio. Decidir se vira campo de rascunho/planejamento
  ou se sai — hoje ele é um número que ninguém decrementa.

## 3. Analytics / eventos

- [ ] **`gTrackEvent('material_aberto', {demo:…})`.** O evento carrega a flag `demo`. Conferir
  se o consumo desses eventos (dashboards, extrações) filtra `demo=true` — senão a abertura
  de material de demonstração interna vira número de uso da rede.
- [ ] **`_fCampAnaBackend`** (`js/franqueado/catalog.js`) lê `luma.artes` direto para o painel
  da campanha e cai no histórico LOCAL quando não vem nada. O painel diz qual escopo está
  mostrando — **confirmar qual dos dois o staff realmente enxerga** (depende da policy de
  leitura ampla existir de fato).

## 4. Storage

- [ ] **`luma-user-uploads`.** O front sobe as fotos do franqueado e, se o upload falhar,
  deixa a arte local e re-tenta (não grava base64 no banco). Verificar a policy do bucket com
  um usuário `franqueado` — hoje um erro de policy é indistinguível de falha de rede na tela.

---

### Como o front se comporta enquanto isto não é verificado

O fluxo do franqueado foi ajustado para **nunca afirmar o que não pode provar**: sem material
real publicado a campanha aparece como "Materiais em breve"; sem data de validade a interface
não anuncia prazo; sem `layers` o card vai para estado de erro em vez de girar para sempre.
Nenhuma tela diz "sincronizado". O risco que sobra é o inverso — **dizer menos do que a
verdade** — e esse é o lado seguro de errar.
