create table public.accounts (
  id uuid primary key,
  tenant_id uuid not null,
  name text not null
);

create view public.account_directory as
select id, tenant_id, name from public.accounts;

create table public.projects (
  id uuid primary key,
  tenant_id uuid not null,
  name text not null
);

alter table public.projects enable row level security;

create policy "anyone can read projects"
on public.projects
for select
to anon
using (true);

create policy "profile tenant access"
on public.projects
for select
to authenticated
using ((auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid = tenant_id);

create table public.tasks (
  id uuid primary key,
  tenant_id uuid not null,
  title text not null
);

alter table public.tasks enable row level security;

create policy "all users can mutate tasks"
on public.tasks
for all
to authenticated
using (true)
with check (true);

create table public.server_only (
  id uuid primary key
);

alter table public.server_only enable row level security;

create or replace function public.dangerous_admin_lookup(target_tenant uuid)
returns setof public.accounts
language sql
security definer
as $$
  select * from public.accounts where tenant_id = target_tenant;
$$;

create materialized view public.account_rollup as
select tenant_id, count(*) as account_count
from public.accounts
group by tenant_id;

create foreign table public.partner_accounts (
  id uuid,
  tenant_id uuid,
  name text
) server partner_database;

alter default privileges in schema public
grant select on tables to authenticated;

create function public.client_admin_lookup(target_tenant uuid)
returns setof public.accounts
language sql
security definer
set search_path = ''
as $$
  select * from public.accounts where tenant_id = target_tenant;
$$;

revoke execute on function public.client_admin_lookup(uuid) from public;
grant execute on function public.client_admin_lookup(uuid) to authenticated;
