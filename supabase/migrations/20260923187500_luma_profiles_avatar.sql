-- ============================================================
-- LUMA — Foto de perfil no banco, 23/09/2026
-- ============================================================
-- A foto vivia SÓ no localStorage (__luma_user_photo_<email>): sumia ao trocar de navegador
-- ou de aparelho, e ninguém além do próprio usuário a via (a lista da Equipe lia o
-- localStorage de QUEM OLHAVA — só aparecia a foto de quem já tinha logado naquela máquina).
--
-- A coluna public.profiles.avatar_url JÁ EXISTE desde o schema inicial (espelho do DM CRM),
-- mas nunca foi usada. Agora: o arquivo vai para luma-user-uploads/<uid>/avatar.jpeg (bucket
-- público, escrita só na pasta do dono — policies já existentes) e a URL mora nessa coluna. O
-- usuário grava a própria linha pela policy de UPDATE que já existe em profiles (o gatilho
-- guard_profile_role não trava avatar_url).
--
-- O CHECK prende a URL ao Storage do projeto: sem ele, alguém grava um link externo e cada
-- pessoa que abre a lista da Equipe (ou a caixa do suporte) faz uma requisição para fora.
-- NOT VALID: vale para toda escrita daqui em diante sem reprovar a migration por um valor
-- antigo que ninguém conhece (a coluna nunca foi escrita pelo app, deve estar toda nula).

alter table public.profiles drop constraint if exists profiles_avatar_url_storage;
alter table public.profiles add constraint profiles_avatar_url_storage
  check (avatar_url is null
         or (char_length(avatar_url) <= 500
             and avatar_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/luma-user-uploads/'))
  not valid;
comment on column public.profiles.avatar_url is
  'Foto de perfil: URL pública de luma-user-uploads/<uid>/avatar.jpeg (+ ?v= para furar cache). Gravada pelo próprio usuário.';
