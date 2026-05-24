-- RLS mínimo para jobs basado en user_id
-- No crea columnas nuevas. Solo protege permisos.

begin;

alter table public.jobs enable row level security;

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

-- SELECT: admin ve todo, usuario normal solo sus filas
-- Se recrea para evitar duplicados de nombre.
drop policy if exists jobs_select_admin_or_owner on public.jobs;
create policy jobs_select_admin_or_owner
on public.jobs
for select
to authenticated
using (
  public.is_current_user_admin() or user_id = auth.uid()
);

-- INSERT: admin inserta para cualquiera, usuario normal solo para sí mismo
drop policy if exists jobs_insert_admin_or_owner on public.jobs;
create policy jobs_insert_admin_or_owner
on public.jobs
for insert
to authenticated
with check (
  public.is_current_user_admin() or user_id = auth.uid()
);

-- UPDATE: solo se permite actualizar filas en estado "supervisar"
-- Admin puede actualizar cualquiera en supervisar; usuario normal solo las suyas en supervisar.
drop policy if exists jobs_update_admin_or_owner on public.jobs;
create policy jobs_update_admin_or_owner
on public.jobs
for update
to authenticated
using (
  estado = 'supervisar'
  and (public.is_current_user_admin() or user_id = auth.uid())
)
with check (
  public.is_current_user_admin() or user_id = auth.uid()
);

-- DELETE: admin borra cualquiera, usuario normal solo sus filas
drop policy if exists jobs_delete_admin_or_owner on public.jobs;
create policy jobs_delete_admin_or_owner
on public.jobs
for delete
to authenticated
using (
  public.is_current_user_admin() or user_id = auth.uid()
);

commit;
