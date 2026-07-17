-- This example is intentionally vulnerable. Run `npm run scan:example` from the repository root.

create table public.invoices (
  id uuid primary key,
  organization_id uuid not null,
  amount_cents integer not null
);

create table public.customers (
  id uuid primary key,
  organization_id uuid not null,
  email text not null
);

alter table public.customers enable row level security;

create policy "every signed-in user can read every customer"
on public.customers
for select
to authenticated
using (true);

create table public.contracts (
  id uuid primary key,
  organization_id uuid not null,
  body text not null
);

alter table public.contracts enable row level security;

create policy "organization members can read contracts"
on public.contracts
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members members
    where members.user_id = auth.uid()
  )
);
