-- Tabla de festivos manuales (gestionados por admin)
-- Un festivo aplica a todos los usuarios para el calculo de horas.

begin;

create table if not exists public.holidays (
  holiday_date date primary key,
  label text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_holidays_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_holidays_touch_updated_at on public.holidays;
create trigger trg_holidays_touch_updated_at
before update on public.holidays
for each row
execute procedure public.touch_holidays_updated_at();

alter table public.holidays enable row level security;

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

drop policy if exists holidays_select_all_authenticated on public.holidays;
create policy holidays_select_all_authenticated
on public.holidays
for select
to authenticated
using (true);

drop policy if exists holidays_admin_insert on public.holidays;
create policy holidays_admin_insert
on public.holidays
for insert
to authenticated
with check (public.is_current_user_admin());

drop policy if exists holidays_admin_update on public.holidays;
create policy holidays_admin_update
on public.holidays
for update
to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

drop policy if exists holidays_admin_delete on public.holidays;
create policy holidays_admin_delete
on public.holidays
for delete
to authenticated
using (public.is_current_user_admin());

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.holidays to authenticated;

commit;
