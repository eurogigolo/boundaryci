alter table public.organizations
  add column managed_ai_enabled boolean not null default false,
  add column managed_ai_consented_at timestamptz,
  add column managed_ai_consented_by uuid references auth.users(id) on delete set null;

alter table public.repositories
  add column managed_ai_enabled boolean not null default true;

create table public.managed_ai_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  repository_id uuid not null,
  external_id uuid not null,
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed')),
  model text check (model is null or char_length(model) between 1 and 200),
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  error_code text check (error_code is null or char_length(error_code) between 1 and 80),
  attempts integer not null default 1 check (attempts between 1 and 20),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (repository_id, organization_id)
    references public.repositories(id, organization_id) on delete cascade,
  unique (repository_id, external_id)
);

create index managed_ai_reviews_organization_created_idx
  on public.managed_ai_reviews (organization_id, created_at desc);

alter table public.managed_ai_reviews enable row level security;

create policy "Managed AI reviews are server managed"
  on public.managed_ai_reviews
  for all
  to authenticated
  using (false)
  with check (false);

create function public.set_managed_ai_review(
  target_organization_id uuid,
  enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  organization_record public.organizations%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  select organizations.*
  into organization_record
  from public.organizations organizations
  where organizations.id = target_organization_id
    and public.has_organization_role(
      organizations.id,
      array['owner', 'admin']
    )
  for update;

  if not found then
    raise exception 'Owner or administrator access is required.' using errcode = '42501';
  end if;

  if enabled and organization_record.plan not in ('team', 'growth', 'enterprise') then
    raise exception 'Managed AI review requires a paid BoundaryCI plan.';
  end if;

  if enabled and organization_record.subscription_status not in ('trialing', 'active') then
    raise exception 'The BoundaryCI Cloud subscription is not active.';
  end if;

  update public.organizations organizations
  set
    managed_ai_enabled = enabled,
    managed_ai_consented_at = case
      when enabled then now()
      else organizations.managed_ai_consented_at
    end,
    managed_ai_consented_by = case
      when enabled then actor_id
      else organizations.managed_ai_consented_by
    end,
    updated_at = now()
  where organizations.id = target_organization_id;

  return true;
end;
$$;

revoke all on function public.set_managed_ai_review(uuid, boolean)
  from public, anon;
grant execute on function public.set_managed_ai_review(uuid, boolean)
  to authenticated;

create function public.set_repository_managed_ai_review(
  target_repository_id uuid,
  enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  update public.repositories repositories
  set
    managed_ai_enabled = enabled,
    updated_at = now()
  where repositories.id = target_repository_id
    and public.has_organization_role(
      repositories.organization_id,
      array['owner', 'admin']
    );

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Repository was not found.' using errcode = '42501';
  end if;
  return true;
end;
$$;

revoke all on function public.set_repository_managed_ai_review(uuid, boolean)
  from public, anon;
grant execute on function public.set_repository_managed_ai_review(uuid, boolean)
  to authenticated;

create function public.reserve_managed_ai_review(
  key_sha256 text,
  repository_name text,
  external_review_id uuid,
  input_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  key_record record;
  existing_review public.managed_ai_reviews%rowtype;
  new_review_id uuid;
  reviews_this_month integer;
  concurrent_reviews integer;
begin
  if key_sha256 !~ '^[0-9a-f]{64}$' or input_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid managed review request.' using errcode = '28000';
  end if;

  select
    keys.organization_id,
    repositories.id as repository_id,
    repositories.full_name,
    repositories.managed_ai_enabled as repository_ai_enabled,
    organizations.plan,
    organizations.subscription_status,
    organizations.monthly_scan_limit,
    organizations.managed_ai_enabled as organization_ai_enabled
  into key_record
  from public.ingestion_keys keys
  join public.repositories repositories
    on repositories.id = keys.repository_id
   and repositories.organization_id = keys.organization_id
  join public.organizations organizations
    on organizations.id = keys.organization_id
  where keys.key_hash = key_sha256
    and keys.revoked_at is null
    and repositories.active
  for update of organizations;

  if not found then
    raise exception 'Invalid or revoked ingestion token.' using errcode = '28000';
  end if;
  if lower(repository_name) is distinct from lower(key_record.full_name) then
    raise exception 'The token is not valid for this repository.' using errcode = '28000';
  end if;
  if key_record.plan not in ('team', 'growth', 'enterprise') then
    return jsonb_build_object('status', 'not-entitled');
  end if;
  if key_record.subscription_status not in ('trialing', 'active') then
    return jsonb_build_object('status', 'subscription-inactive');
  end if;
  if not key_record.organization_ai_enabled then
    return jsonb_build_object('status', 'organization-disabled');
  end if;
  if not key_record.repository_ai_enabled then
    return jsonb_build_object('status', 'repository-disabled');
  end if;

  select reviews.*
  into existing_review
  from public.managed_ai_reviews reviews
  where reviews.repository_id = key_record.repository_id
    and reviews.external_id = external_review_id
  for update;

  if found then
    if existing_review.input_hash is distinct from input_sha256 then
      raise exception 'The managed review identifier was already used for different input.';
    end if;
    if existing_review.status = 'completed' and existing_review.result is not null then
      return jsonb_build_object(
        'status', 'cached',
        'reviewId', existing_review.id,
        'result', existing_review.result
      );
    end if;
    if existing_review.status = 'pending'
      and existing_review.started_at >= now() - interval '2 minutes' then
      return jsonb_build_object('status', 'pending', 'reviewId', existing_review.id);
    end if;
    if existing_review.attempts >= 3 then
      return jsonb_build_object('status', 'retry-exhausted');
    end if;

    select count(*)
    into concurrent_reviews
    from public.managed_ai_reviews reviews
    where reviews.organization_id = key_record.organization_id
      and reviews.status = 'pending'
      and reviews.started_at >= now() - interval '2 minutes';
    if concurrent_reviews >= 5 then
      return jsonb_build_object('status', 'capacity-reached');
    end if;

    update public.managed_ai_reviews reviews
    set
      status = 'pending',
      result = null,
      error_code = null,
      attempts = least(reviews.attempts + 1, 20),
      started_at = now(),
      completed_at = null,
      updated_at = now()
    where reviews.id = existing_review.id;

    return jsonb_build_object('status', 'allowed', 'reviewId', existing_review.id);
  end if;

  select count(*)
  into concurrent_reviews
  from public.managed_ai_reviews reviews
  where reviews.organization_id = key_record.organization_id
    and reviews.status = 'pending'
    and reviews.started_at >= now() - interval '2 minutes';
  if concurrent_reviews >= 5 then
    return jsonb_build_object('status', 'capacity-reached');
  end if;

  if key_record.monthly_scan_limit > 0 then
    select count(*)
    into reviews_this_month
    from public.managed_ai_reviews reviews
    where reviews.organization_id = key_record.organization_id
      and reviews.created_at >= date_trunc('month', now());
    if reviews_this_month >= key_record.monthly_scan_limit then
      return jsonb_build_object('status', 'limit-reached');
    end if;
  end if;

  insert into public.managed_ai_reviews (
    organization_id,
    repository_id,
    external_id,
    input_hash
  )
  values (
    key_record.organization_id,
    key_record.repository_id,
    external_review_id,
    input_sha256
  )
  returning id into new_review_id;

  return jsonb_build_object('status', 'allowed', 'reviewId', new_review_id);
end;
$$;

create function public.managed_ai_review_status(
  key_sha256 text,
  repository_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  key_record record;
begin
  if key_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid managed review request.' using errcode = '28000';
  end if;

  select
    repositories.full_name,
    repositories.managed_ai_enabled as repository_ai_enabled,
    organizations.plan,
    organizations.subscription_status,
    organizations.managed_ai_enabled as organization_ai_enabled
  into key_record
  from public.ingestion_keys keys
  join public.repositories repositories
    on repositories.id = keys.repository_id
   and repositories.organization_id = keys.organization_id
  join public.organizations organizations
    on organizations.id = keys.organization_id
  where keys.key_hash = key_sha256
    and keys.revoked_at is null
    and repositories.active;

  if not found then
    raise exception 'Invalid or revoked ingestion token.' using errcode = '28000';
  end if;
  if lower(repository_name) is distinct from lower(key_record.full_name) then
    raise exception 'The token is not valid for this repository.' using errcode = '28000';
  end if;
  if key_record.plan not in ('team', 'growth', 'enterprise') then
    return jsonb_build_object('status', 'not-entitled');
  end if;
  if key_record.subscription_status not in ('trialing', 'active') then
    return jsonb_build_object('status', 'subscription-inactive');
  end if;
  if not key_record.organization_ai_enabled then
    return jsonb_build_object('status', 'organization-disabled');
  end if;
  if not key_record.repository_ai_enabled then
    return jsonb_build_object('status', 'repository-disabled');
  end if;
  return jsonb_build_object('status', 'enabled');
end;
$$;

create function public.complete_managed_ai_review(
  target_review_id uuid,
  review_result jsonb,
  review_model text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  if jsonb_typeof(review_result) is distinct from 'object'
    or jsonb_typeof(review_result -> 'findings') is distinct from 'array'
    or char_length(review_model) not between 1 and 200 then
    raise exception 'Invalid managed review result.';
  end if;

  update public.managed_ai_reviews reviews
  set
    status = 'completed',
    model = review_model,
    result = review_result,
    error_code = null,
    completed_at = now(),
    updated_at = now()
  where reviews.id = target_review_id
    and reviews.status = 'pending';

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

create function public.fail_managed_ai_review(
  target_review_id uuid,
  failure_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  update public.managed_ai_reviews reviews
  set
    status = 'failed',
    error_code = left(nullif(trim(failure_code), ''), 80),
    completed_at = now(),
    updated_at = now()
  where reviews.id = target_review_id
    and reviews.status = 'pending';

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

revoke all on function public.reserve_managed_ai_review(text, text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.managed_ai_review_status(text, text)
  from public, anon, authenticated;
revoke all on function public.complete_managed_ai_review(uuid, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.fail_managed_ai_review(uuid, text)
  from public, anon, authenticated;
grant execute on function public.reserve_managed_ai_review(text, text, uuid, text)
  to service_role;
grant execute on function public.managed_ai_review_status(text, text)
  to service_role;
grant execute on function public.complete_managed_ai_review(uuid, jsonb, text)
  to service_role;
grant execute on function public.fail_managed_ai_review(uuid, text)
  to service_role;

revoke all on table public.managed_ai_reviews from anon, authenticated;
