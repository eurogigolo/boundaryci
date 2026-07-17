create table public.accounts (
  id uuid primary key,
  tenant_id uuid not null,
  name text not null
);

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
