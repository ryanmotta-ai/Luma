-- Modo visitante (QR do deck): o anon NÃO ganha USAGE no schema luma nem policy nova.
-- Só uma função SECURITY DEFINER em public devolve, somente leitura, as pastas marcadas
-- `visitante` (+ seus templates publicados e vigentes), as variáveis e as fontes.
-- APLICADA em produção em 30/09/2026 (autorizada pelo Ryan).
alter table luma.pastas add column if not exists visitante boolean not null default false;

create or replace function public.luma_visitante_catalogo()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'pastas', coalesce((select jsonb_agg((to_jsonb(p) - 'criado_por') order by p.ordem)
                        from luma.pastas p where p.visitante and p.ativa), '[]'::jsonb),
    'templates', coalesce((select jsonb_agg(to_jsonb(t) - 'criado_por')
                           from luma.templates t join luma.pastas p on p.id = t.pasta_id
                           where p.visitante and p.ativa and t.publicado
                             and (t.validade is null or t.validade >= current_date)), '[]'::jsonb),
    'variaveis', coalesce((select jsonb_agg(to_jsonb(v) order by v.ordem) from luma.variaveis v), '[]'::jsonb),
    'fontes', coalesce((select jsonb_agg(to_jsonb(f)) from luma.fontes f), '[]'::jsonb)
  );
$$;

revoke all on function public.luma_visitante_catalogo() from public;
grant execute on function public.luma_visitante_catalogo() to anon, authenticated;

-- Campanha que o visitante enxerga: Copa Do Mundo 2026 (2 materiais vigentes hoje).
update luma.pastas set visitante = true where id = '828d73ae-94d0-4e37-a2ce-c03508ff46c1';
