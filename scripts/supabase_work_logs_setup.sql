-- Tabla base para control diario de horas
-- Inicio por defecto: 07:30

begin;

create table if not exists public.work_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_date date not null,
  start_time time not null default '07:30',
  end_time time not null default '19:00',
  lunch_minutes integer not null default 90,
  skipped_lunch boolean not null default false,
  regular_minutes integer not null default 0,
  extra_minutes integer not null default 0,
  total_minutes integer generated always as (regular_minutes + extra_minutes) stored,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_logs_unique_user_day unique (user_id, work_date),
  constraint work_logs_lunch_minutes_check check (lunch_minutes >= 0 and lunch_minutes <= 240),
  constraint work_logs_regular_minutes_check check (regular_minutes >= 0),
  constraint work_logs_extra_minutes_check check (extra_minutes >= 0),
  constraint work_logs_time_order_check check (end_time > start_time)
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_work_logs_touch_updated_at on public.work_logs;
create trigger trg_work_logs_touch_updated_at
before update on public.work_logs
for each row
execute procedure public.touch_updated_at();

alter table public.work_logs enable row level security;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

drop policy if exists work_logs_select_admin_or_owner on public.work_logs;
create policy work_logs_select_admin_or_owner
on public.work_logs
for select
to authenticated
using (
  public.is_current_user_admin() or user_id = auth.uid()
);

drop policy if exists work_logs_insert_admin_or_owner on public.work_logs;
create policy work_logs_insert_admin_or_owner
on public.work_logs
for insert
to authenticated
with check (
  public.is_current_user_admin() or user_id = auth.uid()
);

drop policy if exists work_logs_update_admin_or_owner on public.work_logs;
create policy work_logs_update_admin_or_owner
on public.work_logs
for update
to authenticated
using (
  public.is_current_user_admin() or user_id = auth.uid()
)
with check (
  public.is_current_user_admin() or user_id = auth.uid()
);

drop policy if exists work_logs_delete_admin_or_owner on public.work_logs;
create policy work_logs_delete_admin_or_owner
on public.work_logs
for delete
to authenticated
using (
  public.is_current_user_admin() or user_id = auth.uid()
);

-- Permisos SQL base para que RLS pueda evaluar políticas en peticiones autenticadas.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.work_logs to authenticated;

commit;
