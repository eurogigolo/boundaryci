create table public.documents (
  id uuid primary key,
  tenant_id uuid not null,
  body text not null
);

alter table public.documents enable row level security;

create policy "tenant members read documents"
on public.documents
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_members members
    where members.tenant_id = documents.tenant_id
      and members.user_id = auth.uid()
  )
);

create policy "tenant members insert documents"
on public.documents
for insert
to authenticated
with check (
  exists (
    select 1
    from public.tenant_members members
    where members.tenant_id = documents.tenant_id
      and members.user_id = auth.uid()
  )
);

create policy "trusted tenant claim reads documents"
on public.documents
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id);

create view public.document_directory
with (security_invoker = true)
as select id, tenant_id from public.documents;

create or replace function public.safe_current_tenant()
returns uuid
language sql
security definer
set search_path = ''
as $$
  select null::uuid;
$$;

revoke execute on function public.safe_current_tenant() from public;

alter default privileges in schema public
revoke all on tables from anon, authenticated;

create materialized view public.private_document_rollup as
select tenant_id, count(*) as document_count
from public.documents
group by tenant_id;

create foreign table public.private_partner_documents (
  id uuid,
  tenant_id uuid
) server partner_database;

alter default privileges in schema public
grant select on tables to authenticated;
alter default privileges in schema public
revoke select on tables from authenticated;

alter default privileges in schema public
grant execute on functions to authenticated;
alter default privileges in schema public
revoke execute on functions from authenticated;

create function public.internal_document_count()
returns bigint
language sql
security definer
set search_path = ''
as $$
  select count(*) from public.documents;
$$;

revoke execute on function public.internal_document_count() from public;
grant execute on function public.internal_document_count() to authenticated;
revoke execute on function public.internal_document_count() from authenticated;
