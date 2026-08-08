-- Store the intentionally public values in an isolated cache. Anonymous users
-- can read this table directly without receiving SECURITY DEFINER execution on
-- the protected inspection table.
create table if not exists public.public_marketing_snapshot (
  id boolean primary key default true check (id),
  total_vistorias integer not null default 0 check (total_vistorias >= 0),
  pendencias integer not null default 0 check (pendencias >= 0),
  agentes integer not null default 0 check (agentes >= 0),
  latest_protocols jsonb not null default '[]'::jsonb check (jsonb_typeof(latest_protocols) = 'array'),
  updated_at timestamptz not null default now()
);

comment on table public.public_marketing_snapshot is
  'Sanitized public product-preview cache. Contains no personal, location, UUID, or inspection response data.';

alter table public.public_marketing_snapshot enable row level security;

drop policy if exists public_marketing_snapshot_read on public.public_marketing_snapshot;
create policy public_marketing_snapshot_read
on public.public_marketing_snapshot
for select
to anon, authenticated
using (id is true);

revoke all on table public.public_marketing_snapshot from public;
grant select on table public.public_marketing_snapshot to anon, authenticated;

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
    updated_at
  )
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
  select true, totals.total_vistorias, totals.pendencias, totals.agentes, latest_protocols.items, statement_timestamp()
  from totals
  cross join latest_protocols
  on conflict (id) do update set
    total_vistorias = excluded.total_vistorias,
    pendencias = excluded.pendencias,
    agentes = excluded.agentes,
    latest_protocols = excluded.latest_protocols,
    updated_at = excluded.updated_at;
$function$;

create or replace function public.on_vistorias_refresh_public_marketing_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform public.refresh_public_marketing_snapshot();
  return null;
end;
$function$;

drop trigger if exists vistorias_refresh_public_marketing_snapshot on public.vistorias;
create trigger vistorias_refresh_public_marketing_snapshot
after insert or update or delete or truncate on public.vistorias
for each statement execute function public.on_vistorias_refresh_public_marketing_snapshot();

select public.refresh_public_marketing_snapshot();

revoke all on function public.refresh_public_marketing_snapshot() from public, anon, authenticated;
revoke all on function public.on_vistorias_refresh_public_marketing_snapshot() from public, anon, authenticated;

drop function if exists public.get_public_marketing_snapshot();
