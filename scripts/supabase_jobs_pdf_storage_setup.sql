-- Vincular PDF generado al trabajo (tabla jobs + Storage)
-- Ejecutar en SQL Editor de Supabase

begin;

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

alter table public.jobs
  add column if not exists pdf_filename text,
  add column if not exists pdf_storage_path text,
  add column if not exists pdf_generated_at timestamptz,
  add column if not exists pdf_signed boolean not null default false,
  add column if not exists pdf_photo_count integer not null default 0;

insert into storage.buckets (id, name, public)
values ('job-pdfs', 'job-pdfs', false)
on conflict (id) do nothing;

-- Permisos de lectura: admin o propietario de la fila en jobs.
drop policy if exists "job_pdfs_select_admin_or_owner" on storage.objects;
create policy "job_pdfs_select_admin_or_owner"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'job-pdfs'
  and exists (
    select 1
    from public.jobs j
    where j.pdf_storage_path = storage.objects.name
      and (public.is_current_user_admin() or j.user_id = auth.uid())
  )
);

-- Permisos de insercion: admin o propietario de la fila en jobs.
drop policy if exists "job_pdfs_insert_admin_or_owner" on storage.objects;
create policy "job_pdfs_insert_admin_or_owner"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'job-pdfs'
  and split_part(storage.objects.name, '/', 1) = auth.uid()::text
);

-- Permisos de update/delete: admin o propietario de la fila en jobs.
drop policy if exists "job_pdfs_update_admin_or_owner" on storage.objects;
create policy "job_pdfs_update_admin_or_owner"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'job-pdfs'
  and exists (
    select 1
    from public.jobs j
    where j.pdf_storage_path = storage.objects.name
      and (public.is_current_user_admin() or j.user_id = auth.uid())
  )
)
with check (
  bucket_id = 'job-pdfs'
  and split_part(storage.objects.name, '/', 1) = auth.uid()::text
);

drop policy if exists "job_pdfs_delete_admin_or_owner" on storage.objects;
create policy "job_pdfs_delete_admin_or_owner"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'job-pdfs'
  and exists (
    select 1
    from public.jobs j
    where j.pdf_storage_path = storage.objects.name
      and (public.is_current_user_admin() or j.user_id = auth.uid())
  )
);

commit;
