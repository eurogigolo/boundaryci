alter table public.organizations
  drop constraint if exists organizations_subscription_status_check;

alter table public.organizations
  add constraint organizations_subscription_status_check
  check (
    subscription_status in (
      'trialing',
      'active',
      'past_due',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'unpaid',
      'paused'
    )
  ),
  add column stripe_price_id text,
  add column billing_interval text check (billing_interval in ('month', 'year')),
  add column current_period_start timestamptz,
  add column cancel_at_period_end boolean not null default false;

create table public.stripe_events (
  id text primary key check (id ~ '^evt_[A-Za-z0-9]+$'),
  event_type text not null check (char_length(event_type) between 3 and 120),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text,
  processed_at timestamptz not null default now()
);

create index stripe_events_organization_processed_idx
  on public.stripe_events (organization_id, processed_at desc);

alter table public.stripe_events enable row level security;

create policy "Stripe events are server managed"
  on public.stripe_events
  for all
  to authenticated
  using (false)
  with check (false);

revoke all on table public.stripe_events from anon, authenticated;

create function public.sync_stripe_subscription(
  stripe_event_id text,
  stripe_event_type text,
  target_organization_id uuid,
  customer_id text,
  subscription_id text,
  price_id text,
  next_plan text,
  next_status text,
  next_billing_interval text,
  period_start timestamptz,
  period_end timestamptz,
  ends_at_period_end boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  organization_record public.organizations%rowtype;
  inserted_rows integer;
begin
  if stripe_event_id !~ '^evt_[A-Za-z0-9]+$' then
    raise exception 'Invalid Stripe event identifier.';
  end if;
  if customer_id is null or customer_id !~ '^cus_[A-Za-z0-9]+$' then
    raise exception 'Invalid Stripe customer identifier.';
  end if;
  if subscription_id is null or subscription_id !~ '^sub_[A-Za-z0-9]+$' then
    raise exception 'Invalid Stripe subscription identifier.';
  end if;
  if price_id is null or price_id !~ '^price_[A-Za-z0-9]+$' then
    raise exception 'Invalid Stripe price identifier.';
  end if;
  if next_plan not in ('team', 'growth', 'enterprise') then
    raise exception 'Invalid BoundaryCI plan.';
  end if;
  if next_status not in (
    'trialing',
    'active',
    'past_due',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'unpaid',
    'paused'
  ) then
    raise exception 'Invalid subscription status.';
  end if;
  if next_billing_interval not in ('month', 'year') then
    raise exception 'Invalid billing interval.';
  end if;

  if target_organization_id is not null then
    select organizations.*
    into organization_record
    from public.organizations organizations
    where organizations.id = target_organization_id
      and (
        organizations.stripe_customer_id is null
        or organizations.stripe_customer_id = customer_id
      )
    for update;
  else
    select organizations.*
    into organization_record
    from public.organizations organizations
    where organizations.stripe_customer_id = customer_id
    for update;
  end if;

  if not found then
    return false;
  end if;

  insert into public.stripe_events (
    id,
    event_type,
    organization_id,
    stripe_customer_id,
    stripe_subscription_id
  )
  values (
    stripe_event_id,
    stripe_event_type,
    organization_record.id,
    customer_id,
    subscription_id
  )
  on conflict (id) do nothing;

  get diagnostics inserted_rows = row_count;
  if inserted_rows = 0 then
    return false;
  end if;

  update public.organizations organizations
  set
    plan = next_plan,
    subscription_status = next_status,
    monthly_scan_limit = case next_plan
      when 'team' then 1000
      when 'growth' then 10000
      when 'enterprise' then 0
    end,
    stripe_customer_id = customer_id,
    stripe_subscription_id = subscription_id,
    stripe_price_id = price_id,
    billing_interval = next_billing_interval,
    current_period_start = period_start,
    current_period_end = period_end,
    cancel_at_period_end = ends_at_period_end,
    updated_at = now()
  where organizations.id = organization_record.id;

  return true;
end;
$$;

revoke all on function public.sync_stripe_subscription(
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  boolean
) from public, anon, authenticated;

grant execute on function public.sync_stripe_subscription(
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  boolean
) to service_role;
