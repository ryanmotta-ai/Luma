# Banco, assets e git — publicar uma arte

## Projeto Supabase (ATENÇÃO)
- Em **16/10/2026** o Luma virou para o projeto **`xqsazcazsjxajmtmirzd`** (org "DM - Inovação e IA", Pro). O antigo `uqrqzjafhigjuvtjqzid` está **pausado**. Fonte da verdade: `.mcp.json` e `js/core/supabase-config.js`. Confira antes de gravar.
- Ferramenta: `mcp__Supabase__execute_sql` com `project_id`. Se o MCP pedir autenticação, **avise o Ryan** (ele conecta no claude.ai) — não tente contornar.
- Multi-statement: o resultado só devolve o **último** statement. Para ver o de antes, rode separado.
- Resultados grandes (layers) viram arquivo no disco; leia com `python3` (`json.load` + regex do bloco `<untrusted-data-…>`), não pelo chat.

## Tabelas que importam
| Tabela | Campos úteis |
|---|---|
| `luma.pastas` | `id, nome, camp_id` — a pasta (campanha) agrupa os materiais |
| `luma.templates` | `id, pasta_id, nome, fmt ('feed'|'story'), formats, layers (jsonb), publicado, publicado_em, validade, instrucoes, permissoes (jsonb por campo: {edit,maxLen}), criado_por, w, h, bg ('transparent'), thumb_url, versao_atual_id, created_at, updated_at` |
| `luma.template_versions` | criada pelo trigger `luma.versionar_template` a cada mudança de conteúdo **publicado** |
| `luma.variaveis` | catálogo de campos (`name,label,type,required,ordem,category`) |

`camp_id` liga a pasta à campanha de `js/00-config.js` (`CAMPS_ATIVAS`). Pasta nova de campanha ainda exige código (campanha é hardcode) — **pergunte** antes.

## Receitas SQL

**Listar a pasta e o que tem dentro**
```sql
select p.id,p.nome,p.camp_id,(select jsonb_agg(jsonb_build_object('id',t.id,'nome',t.nome,'fmt',t.fmt,'pub',t.publicado)) from luma.templates t where t.pasta_id=p.id) ts from luma.pastas p where p.nome ilike '%açaí%';
```

**Inserir template novo (rascunho)** — copie `formats/permissoes/criado_por/bg` de um irmão publicado:
```sql
insert into luma.templates (pasta_id,nome,fmt,formats,layers,publicado,permissoes,criado_por,w,h,bg)
select '<pasta>','Açaí aqui — Oferta com preço','feed',s.formats,$j$[ …layers… ]$j$::jsonb,false,s.permissoes,s.criado_por,1080,1350,s.bg
from luma.templates s where s.id='<irmão>' returning id;
```
`permissoes` típica: `{"produto":{"edit":true,"maxLen":32},"detalhes":{…},"precoDe":{"maxLen":12},"precoPor":{"maxLen":20},"validade":{"maxLen":32},"descricao":{"maxLen":72},"logo_loja":{"edit":true,"maxLen":0},"foto_produto":{…}}`.

**Derivar o story do feed (patches por id)** — o jeito leve de gravar:
```sql
with p as (select key id, value patch from jsonb_each($j${"l-bg":{"h":1920},"l-banner":{"y":208}, …}$j$::jsonb))
insert into luma.templates (pasta_id,nome,fmt,formats,layers,publicado,permissoes,criado_por,w,h,bg)
select t.pasta_id,t.nome,'story',t.formats,
 (select jsonb_agg(case when p.id is not null then e.l||p.patch else e.l end order by e.ord) from jsonb_array_elements(t.layers) with ordinality e(l,ord) left join p on p.id=e.l->>'id'),
 false,t.permissoes,t.criado_por,1080,1920,t.bg
from luma.templates t where t.id='<feed>' returning id;
```
Gere o JSON de patch comparando as layers do feed e do story **no seu script** (`lib.js` → diffs por id).

**Atualizar um template publicado (cria versão sozinho)** — `update … set layers = …` (inteiro ou por patch com `||`). Gere o novo conteúdo **do banco atual**, não de um job antigo.

**Remover/inserir layers no meio** (ex.: trocar a etiqueta por um selo): `jsonb_agg(… order by ordem)` com `union all` e ordem fracionária antes do id âncora (ex.: antes de `l-br`). Padrão testado.

**Publicar**
```sql
update luma.templates set publicado=true, publicado_em=now() where id in ('<feed>','<story>') returning id,fmt,publicado;
```

**Conferir versões / reverter**
```sql
select id, created_at from luma.template_versions where template_id='<id>' order by created_at desc;
-- reverter para uma versão (UM argumento: o id da VERSÃO). Copia layers/w/h/bg/fmt/formats/permissoes de volta e cria nova versão:
select luma.restaurar_versao('<version_id>');
```
Quem pode: `security invoker` — vale a RLS de `luma.templates` (designer/gestão). Pelo MCP costuma funcionar; se recusar, diga ao Ryan.
Template **novo** nasce na versão 1: para desfazer, `delete`. Apague só com autorização explícita.

**Ver todos os pares feed/story do ponto de vista do app** — `fKitPar` (materials.js) pareia pelo **nome-base** (nome sem Feed/Story) na mesma pasta; nomes iguais nos dois ⇒ vinculado. `ferramentas` não tem checador; rode a lógica copiando `fKitPar` num `node -e` se precisar provar.

## Assets no repositório
- Fundos/decoração: `assets/campanhas/<campanha>/…png`. Banners de campanha: `assets/banners/<id-da-campanha>.png` (o **nome é o id da campanha**: `cd`, `aai`, `tr25`…; ver `assets/banners/README.md`). Logos: `assets/logos/`.
- **Nomes sem acento/espaço/vírgula/`@`** (URL no Pages). **Nome novo a cada versão** de fundo (`bg-toldo-feed.png` em vez de reescrever `bg-feed.png`) — cache.
- **Push dos assets ANTES de publicar** o template (senão o app mostra imagem quebrada). O Pages leva ~1–2 min.
- O template aponta por **caminho relativo** (`assets/…`), igual às artes já existentes. Não suba arquivo para o Storage (o MCP não faz upload).
- Asset que saiu de uso: `git rm` (diga no changelog).

## Changelog e git
- Toda mudança de dados entra em `docs/LUMA-BACKEND-CHANGELOG.md`, **no topo, abaixo do cabeçalho**: título `## AAAA-MM-DD — O quê (✅ dados, sem migration)`, ids dos templates, o que mudou, como reverter.
- **Commit e push automáticos, só na `talpaipai`**, **só arquivos da tarefa, pelo nome** (nunca `git add .`). Co-Authored-By/Claude-Session conforme o lembrete da sessão. Se a branch local divergir, recrie de `FETCH_HEAD`. Sem `?v=N` quando só mexe em `assets/` e `docs/` (só `js/`, `css/`, `index.html`).
- Hook de parada reclama de mudança não commitada: `luma-brain/MAPA.md` é regenerado sozinho — comite como `docs(mapa): regenera MAPA.md`.
- Antes de começar: `git pull --ff-only origin talpaipai`.

## Checklist de publicação
- [ ] `.mcp.json` e `project_id` conferidos · repo em dia
- [ ] assets novos no git **e pushados**
- [ ] feed e story com **o mesmo nome**; mesmos ids; `permissoes` e `formats` copiados de irmão
- [ ] render real dos dois + 7 variantes de estresse sem `INVÁLIDA`
- [ ] nenhum template existente de outra pasta tocado (ou tocado só com pedido)
- [ ] `publicado=true` só depois de conferir; contagem de versões coerente
- [ ] changelog + commit + push; resumo ao Ryan com **como reverter**
