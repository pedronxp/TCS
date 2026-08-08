-- Exposes only aggregate operating totals and official protocol identifiers for
-- the public product preview. No location, person, UUID, or inspection content
-- leaves the protected inspection table.
create or replace function public.get_public_marketing_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with active_inspections as (
    select
      v."agenteUid",
      v.status,
      v.protocolo,
      v.protocolo_seq,
      v."nivelRisco",
      v."criadoEm"
    from public.vistorias as v
    where v.archived_at is null
  ),
  totals as (
    select
      count(*)::integer as total_vistorias,
      count(*) filter (
        where coalesce(lower(status), '') not in ('concluida', 'concluída')
      )::integer as pendencias,
      count(distinct "agenteUid") filter (where "agenteUid" is not null)::integer as agentes
    from active_inspections
  ),
  latest_protocols as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'protocolo', recent.protocolo,
          'risco', lower(coalesce(recent."nivelRisco", ''))
        )
        order by recent.protocolo_seq desc nulls last, recent."criadoEm" desc
      ),
      '[]'::jsonb
    ) as items
    from (
      select protocolo, protocolo_seq, "nivelRisco", "criadoEm"
      from active_inspections
      where protocolo is not null and btrim(protocolo) <> ''
      order by protocolo_seq desc nulls last, "criadoEm" desc
      limit 4
    ) as recent
  )
  select jsonb_build_object(
    'total_vistorias', totals.total_vistorias,
    'pendencias', totals.pendencias,
    'agentes', totals.agentes,
    'latest_protocols', latest_protocols.items,
    'updated_at', statement_timestamp()
  )
  from totals
  cross join latest_protocols;
$function$;

comment on function public.get_public_marketing_snapshot() is
  'Public sanitized product-preview totals and recent official protocol numbers; excludes personal and location data.';

revoke all on function public.get_public_marketing_snapshot() from public;
grant execute on function public.get_public_marketing_snapshot() to anon, authenticated;
