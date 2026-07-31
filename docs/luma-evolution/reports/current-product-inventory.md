# Inventário do produto atual — Luma

> Levantado em 2026-07-30 a partir do código real da branch `talpaipai` (`5408748`).
> Cada número foi contado no repositório, não estimado. Onde não há evidência, está escrito que não há.

---

## 1. Stack e forma de execução

| Item | Realidade |
|---|---|
| **Framework** | Nenhum. Vanilla JS, HTML e CSS. |
| **Build** | Não existe. Nenhum bundler, nenhum transpilador, nenhum passo de compilação. |
| **Módulos** | Scripts clássicos com funções globais. Sem `import`/`export`, sem ESM. |
| **Sistema de rotas** | Não existe roteador. A navegação é troca de estado no DOM (`setMode`, `fSwitchTab`, `fSelectCamp`) — não há URL por tela. |
| **Inicialização** | Abrir `index.html`. É o comando inteiro. |
| **Dependências de runtime no front** | Zero. `package.json` só tem pacotes do Supabase, usados por scripts de apoio, não pela página. |
| **Backend** | Supabase (Postgres + Auth + Storage + Edge Functions). 18 migrations, 2 Edge Functions (`ai`, `invite-user`). |
| **Fronteira de segurança** | RLS no Postgres. Nada de segurança no front — o gate por role na interface é de UX. |
| **Empacotamento extra** | PWA instalável (`manifest.json`) e casca desktop Electron (`desktop/`) apontando pra versão publicada. |

**Tamanho medido**

| Camada | Números |
|---|---|
| JavaScript | 41.416 linhas em 53 arquivos |
| CSS | 20.766 linhas |
| `index.html` | 3.535 linhas (256 KB) |
| Módulos por área | `core/` 15 · `designer/` 22 · `franqueado/` 10 · `tutorial/` 5 · `widgets/` 1 |
| Funções globais por prefixo | `d*` 697 (designer) · `f*` 234 (franqueado) · `g*` 140 (globais) |
| Migrations SQL | 18 |

---

## 2. Autenticação e perfis

- **Login:** e-mail e senha via `sb.auth.signInWithPassword`. Tela `#g-login-screen`, mostrada quando o boot não encontra sessão.
- **Três roles** em `public.profiles.role`, com hierarquia em `js/core/auth.js`:

| Role | Nível | O que enxerga |
|---|---|---|
| `franqueado` | 1 | Só a área do franqueado |
| `equipe_dm` | 2 | Franqueado + Estúdio + console interno |
| `gestao` | 3 | Tudo, incluindo gestão de equipe |

- `gIsAdmin()` = `equipe_dm` ou `gestao`. `gIsSuperAdmin()` = `gestao`.
- Não há rota pública além da tela de login: sem sessão, a interface não monta.
- **Guard anti-auto-promoção** no banco (trigger `guard_profile_role`) impede que alguém troque a própria role.

---

## 3. Telas e áreas

### 3.1 Acesso

| Tela | Como chegar | Perfil | Estado |
|---|---|---|---|
| Login | Primeira carga sem sessão | — | Implementado |
| Splash de boot | Automático, segura até o boot decidir (mín. 2,8 s / teto 9 s) | — | Implementado |

### 3.2 Franqueado

| Tela | Como chegar | Perfil | Estado |
|---|---|---|---|
| Vitrine (home) | Entrada padrão | Todos | Implementado |
| Busca e filtros de campanha | Campo no topo da vitrine | Todos | Implementado |
| Campanha aberta — materiais | Clique num card | Todos | Implementado |
| Chat que monta a arte | Campanha → material → Personalizar | Todos | Implementado |
| Prévia ao vivo | Coluna direita, junto do chat | Todos | Implementado |
| Prévia "Ver postado" (mockup de celular) | Dentro da prévia | Todos | Implementado |
| Minhas artes (histórico) | Botão "Minhas artes" no cabeçalho | Todos | Implementado |
| Central de ajuda | FAB de ajuda | Todos | Implementado |

### 3.3 Designer — o Estúdio

| Tela | Como chegar | Perfil | Estado |
|---|---|---|---|
| Home do Estúdio | Alternador "Designer" na topbar | `equipe_dm`+ | Implementado |
| Canvas com template aberto | Home do Estúdio → template | `equipe_dm`+ | Implementado |
| Camadas e propriedades | Painéis laterais do canvas | `equipe_dm`+ | Implementado |
| Publicar template | Ação no Estúdio (`dPublishOpen`) | `equipe_dm`+ | Implementado |
| Exportar (PNG/PDF/SVG) | `dOpenExportModal` | `equipe_dm`+ | Implementado |
| Import de PSD | Modal `d-psd-modal` | `equipe_dm`+ | Implementado |
| Biblioteca de recursos | Gaveta `d-resources-drawer` | `equipe_dm`+ | Implementado |
| Simulação de campos | `d-sim-modal` | `equipe_dm`+ | Implementado |
| Linter do template | `d-panel-linter` | `equipe_dm`+ | Implementado |
| Atalhos (cheat sheet) | `d-cheat-modal` | `equipe_dm`+ | Implementado |

### 3.4 Interno

| Tela | Como chegar | Perfil | Estado |
|---|---|---|---|
| Luma CLI | `Ctrl+\`` no desktop; painel de perfil no celular | `equipe_dm`+ | Implementado |
| Perfil do usuário | Avatar na topbar | Todos | Implementado |
| Equipe (convites) | Painel de perfil | `gestao` | Implementado |

### 3.5 Recursos de IA

Cinco recursos sobre um motor único (`js/core/ai.js` → Edge Function `ai`):

| Recurso | Onde | Estado |
|---|---|---|
| Sugestão de legenda | Fim do fluxo do franqueado | Implementado |
| Encaixar texto no limite | Chat de preenchimento | Implementado |
| Ajuda que responde aterrada na Central de Ajuda | Central de ajuda | Implementado |
| Ler cardápio em foto/PDF (Luma Sheets) | Fluxo em lote | Implementado |
| Casar fotos com as linhas | Fluxo em lote | Implementado |
| Conversa dentro do console | Luma CLI | Implementado |

### 3.6 Tema por campanha

- **Much+** é o primeiro e único caso. Campanha com `theme:'muchplus'` re-tokeniza o app enquanto o franqueado está dentro dela.
- Na vitrine o tema é contido: filete, olho-de-boi e CTA. Dentro da campanha, troca fonte, cor de acento e traz motion do logo.

---

## 4. O que NÃO existe (para não ser inventado na apresentação)

- Não há dashboard de indicadores nem analytics visual — há emissão de eventos de funil, sem tela.
- Não há CRM visual implementado. Aparece como intenção no `luma-brain`, não em código.
- Não há telas de RH ou de outros setores.
- Não há exportação PSD (só import). A exportação é PNG, PDF e SVG.
- Não há feature flags. A visibilidade é por role, não por flag.
- Não há testes automatizados — a verificação do projeto é manual, no navegador, por decisão registrada em `luma-brain/03_ENGINEERING.md`.
- Não há sistema de rotas, portanto não há "rota" no sentido de URL para nenhuma tela.

---

## 5. Prioridade para a apresentação

| Prioridade | Telas | Por quê |
|---|---|---|
| **Alta** | Vitrine, chat, campanha aberta, Estúdio, CLI, mobile | São as que mudam mais entre versões e contam a história |
| **Média** | Minhas artes, exportar, ajuda | Existem em quase todas as versões, com evolução menor |
| **Baixa** | Modais internos do Estúdio (linter, cheat, simulação) | Pouca mudança visual e difíceis de alcançar offline |
