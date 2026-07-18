revoke select on table public.organizations from authenticated;

grant select (
  id,
  name,
  slug,
  plan,
  subscription_status,
  monthly_scan_limit,
  billing_interval,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  created_by,
  created_at,
  updated_at
) on table public.organizations to authenticated;
