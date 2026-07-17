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

create or replace function public.safe_current_tenant()
returns uuid
language sql
security definer
set search_path = ''
as $$
  select null::uuid;
$$;

revoke execute on function public.safe_current_tenant() from public;
