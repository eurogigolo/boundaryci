create table public.finding_dismissals (
  organization_id uuid not null,
  repository_id uuid not null,
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{24}$'),
  hidden_by uuid default auth.uid() references auth.users(id) on delete set null,
  hidden_at timestamptz not null default now(),
  primary key (repository_id, fingerprint),
  foreign key (repository_id, organization_id)
    references public.repositories(id, organization_id) on delete cascade
);

alter table public.finding_dismissals enable row level security;

create policy "members can view finding dismissals"
  on public.finding_dismissals
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy "owners and admins can hide findings"
  on public.finding_dismissals
  for insert
  to authenticated
  with check (
    hidden_by = auth.uid()
    and public.has_organization_role(organization_id, array['owner', 'admin'])
    and exists (
      select 1
      from public.scan_findings findings
      where findings.organization_id = finding_dismissals.organization_id
        and findings.repository_id = finding_dismissals.repository_id
        and findings.fingerprint = finding_dismissals.fingerprint
    )
  );

create policy "owners and admins can restore findings"
  on public.finding_dismissals
  for delete
  to authenticated
  using (public.has_organization_role(organization_id, array['owner', 'admin']));

create view public.visible_scan_findings
with (security_invoker = true)
as
select findings.*
from public.scan_findings findings
where not exists (
  select 1
  from public.finding_dismissals dismissals
  where dismissals.repository_id = findings.repository_id
    and dismissals.fingerprint = findings.fingerprint
);

revoke all on table public.finding_dismissals from public, anon, authenticated;
grant select, insert, delete on table public.finding_dismissals to authenticated;

revoke all on table public.visible_scan_findings from public, anon, authenticated;
grant select on table public.visible_scan_findings to authenticated;
