/**
 * js/core/supabase-config.example.js
 *
 * MODELO versionado. Copie para `supabase-config.js` (que é gitignored) e
 * preencha com as credenciais do seu projeto Supabase.
 *
 *   cp js/core/supabase-config.example.js js/core/supabase-config.js
 *
 * A anon/publishable key é PÚBLICA por design (vai no browser; a RLS protege
 * os dados). NUNCA coloque aqui a chave `service_role`.
 */
window.LUMA_SUPABASE = {
  url:     'COLE_A_PROJECT_URL_AQUI',   // ex.: https://abcdefgh.supabase.co
  anonKey: 'COLE_A_ANON_KEY_AQUI',      // ex.: sb_publishable_...
};
