-- ============================================================
-- LUMA — profiles.telefone (opcional, preenchido no convite de membro)
-- ============================================================
-- Fase 2 da gestão de usuários: o convite pelo app (Edge Function invite-user)
-- grava telefone quando informado. Coluna herda as políticas RLS existentes
-- de profiles (leitura autenticada / escrita gestão) — nada a alterar.
-- Não-destrutivo: linhas antigas ficam NULL.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telefone TEXT;
