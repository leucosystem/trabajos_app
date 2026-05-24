-- Agrega columna estado a public.jobs
-- Valores permitidos: supervisar, pasado, emitido, pagada
-- Si existia la columna status, la migra a estado

begin;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jobs'
      and column_name = 'status'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jobs'
      and column_name = 'estado'
  ) then
    alter table public.jobs rename column status to estado;
  end if;
end $$;

alter table public.jobs
  add column if not exists estado text;

-- Quitar checks anteriores antes de normalizar datos legacy.
-- Se eliminan por nombre conocido y tambien cualquier check que mencione "estado".
alter table public.jobs
  drop constraint if exists jobs_status_check;

alter table public.jobs
  drop constraint if exists jobs_estado_check;

do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.jobs'::regclass
      and contype = 'c'
      and lower(pg_get_constraintdef(oid)) like '%estado%'
  loop
    execute format('alter table public.jobs drop constraint if exists %I', c.conname);
  end loop;
end $$;

-- Si coexistieron status y estado, conservar el valor previo en estado cuando falte.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jobs'
      and column_name = 'status'
  ) then
    execute '
      update public.jobs
      set estado = coalesce(
        estado,
        case
          when status is null or btrim(status) = '''' then ''supervisar''
          when lower(btrim(status)) in (''pagada'', ''cobrada'', ''cobrado'') then ''pagada''
          when lower(btrim(status)) = ''emitida'' then ''emitido''
          when lower(btrim(status)) in (''supervisar'', ''pasado'', ''emitido'', ''pagada'') then lower(btrim(status))
          else ''supervisar''
        end
      )
      where estado is null or btrim(estado) = ''''
    ';
  end if;
end $$;

update public.jobs
set estado = case
  when estado is null or btrim(estado) = '' then 'supervisar'
  when lower(btrim(estado)) in ('pagada', 'cobrada', 'cobrado') then 'pagada'
  when lower(btrim(estado)) = 'emitida' then 'emitido'
  when lower(btrim(estado)) in ('supervisar', 'pasado', 'emitido', 'pagada') then lower(btrim(estado))
  else 'supervisar'
end;

alter table public.jobs
  alter column estado set default 'supervisar';

alter table public.jobs
  alter column estado set not null;

do $$
begin
  alter table public.jobs
    add constraint jobs_estado_check
    check (estado in ('supervisar', 'pasado', 'emitido', 'pagada'));
end $$;

commit;
