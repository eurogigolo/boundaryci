alter table public.organizations
  alter column subscription_status set default 'active';

update public.organizations
set
  subscription_status = 'active',
  updated_at = now()
where plan = 'trial'
  and subscription_status = 'trialing';
