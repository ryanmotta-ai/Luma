-- ============================================================
-- LUMA — exemplo de uso da gíria (14/10/2026)
-- ------------------------------------------------------------
-- A pesquisa de gírias (task `girias`, js/franqueado/chat.js) devolve, para cada expressão, uma
-- frase curta de delivery que a usa ("Bah, a fome chegou! Pede no app."). Ela é a rede de
-- segurança da legenda: quando a IA não usa a expressão aprovada (ou o provedor cai e a legenda
-- sai do motor local), a frase entra pronta no "engajar" (`_fGiriaGarante`).
-- Até aqui o exemplo morava só no localStorage do aparelho que fez a pesquisa: em outro
-- aparelho, ou depois de limpar a aba, a gíria aprovada ficava sem rede de segurança.
-- Coluna nova, opcional; RLS da tabela não muda (quem grava a gíria grava o exemplo).
-- ============================================================
alter table luma.franquia_girias
  add column if not exists exemplo text
  check (exemplo is null or char_length(exemplo) <= 160);
