-- Expande o cache publico de marketing com os municipios em operacao,
-- usando somente nome do municipio e centroide arredondado (0.01 grau ~ 1 km).
-- Sem dados pessoais, enderecos ou identificadores de vistoria.

alter table public.public_marketing_snapshot
  add column if not exists municipios jsonb not null default '[]'::jsonb
  check (jsonb_typeof(municipios) = 'array');

comment on column public.public_marketing_snapshot.municipios is
  'Municipios com operacao ativa: nome e centroide arredondado. Sem dados pessoais nem enderecos.';

create or replace function public.refresh_public_marketing_snapshot()
returns void
language sql
security definer
set search_path = ''
as $function$
  insert into public.public_marketing_snapshot (
    id,
    total_vistorias,
    pendencias,
    agentes,
    latest_protocols,
    municipios,
    updated_at
  )
  with active_inspections as (
    select
      v."agenteUid",
      v.status,
      v.protocolo,
      v.protocolo_seq,
      v."nivelRisco",
      v."criadoEm",
      v.municipio,
      v.latitude,
      v.longitude
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
  ),
  municipio_stats as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object('nome', grouped.municipio, 'lat', grouped.lat, 'lng', grouped.lng, 'vistorias', grouped.total)
        order by grouped.total desc
      ),
      '[]'::jsonb
    ) as items
    from (
      select
        btrim(municipio) as municipio,
        count(*)::integer as total,
        round(avg(latitude)::numeric, 2) as lat,
        round(avg(longitude)::numeric, 2) as lng
      from active_inspections
      where municipio is not null
        and btrim(municipio) <> ''
        and latitude is not null
        and longitude is not null
      group by btrim(municipio)
      order by count(*) desc
      limit 6
    ) as grouped
  )
  select true, totals.total_vistorias, totals.pendencias, totals.agentes, latest_protocols.items, municipio_stats.items, statement_timestamp()
  from totals
  cross join latest_protocols
  cross join municipio_stats
  on conflict (id) do update set
    total_vistorias = excluded.total_vistorias,
    pendencias = excluded.pendencias,
    agentes = excluded.agentes,
    latest_protocols = excluded.latest_protocols,
    municipios = excluded.municipios,
    updated_at = excluded.updated_at;
$function$;

revoke all on function public.refresh_public_marketing_snapshot() from public, anon, authenticated;

select public.refresh_public_marketing_snapshot();
