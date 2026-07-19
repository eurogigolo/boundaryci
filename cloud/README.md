# BoundaryCI Cloud control plane

This directory is the paid BoundaryCI Cloud product: organization and repository setup, repository-bound ingestion keys, durable scan history, tenant-safe reads, Stripe subscriptions, and subscription-aware usage limits.

The scanner remains local. Cloud receives a minimized result only when a customer enables `--upload`; it never needs the customer's database credentials or full migration files.

## Components

- `supabase/migrations/20260718000000_cloud_control_plane.sql` creates organizations, memberships, repositories, hashed ingestion keys, scan runs, findings, indexes, row-level security, onboarding RPCs, and the atomic ingestion RPC.
- `supabase/functions/ingest-scan/index.ts` is the public HTTP boundary. It hashes the bearer token, delegates all authorization and writes to one database transaction, and returns only a scan identifier.
- `supabase/functions/create-checkout/index.ts` creates organization-owned Stripe Checkout sessions for owners and administrators.
- `supabase/functions/create-portal/index.ts` creates short-lived Stripe customer portal sessions for authorized organization managers.
- `supabase/functions/stripe-webhook/index.ts` verifies Stripe signatures and atomically synchronizes idempotent subscription events.
- `supabase/migrations/20260718010000_stripe_billing.sql` adds the Stripe billing state, event ledger, expanded subscription statuses, and server-only subscription synchronization RPC.
- `../src/cloud.ts` is the CLI payload minimizer and HTTPS upload client.
- `web` is the React dashboard for authentication, organization/repository onboarding,
  one-time token creation, plan usage, scan history, and finding detail.

## Security model

- A plaintext ingestion token is shown once by `create_ingestion_key`; only its SHA-256 hash is stored.
- Every key is bound to one active repository and organization.
- The database verifies that the payload's `owner/repository` matches the key.
- Duplicate `externalId` values return the original run, making retries idempotent.
- Organization members can read only organizations, repositories, runs, and findings for organizations they belong to.
- The ingestion-key table has an explicit deny-all client policy and no authenticated table grants.
- Organization administrators cannot edit plan, subscription, quota, or Stripe fields through client credentials.
- Ingestion stops when a subscription is inactive or its monthly scan allowance is exhausted.
- The Edge Function limits request size and does not expose unexpected database errors.
- Stripe price IDs are mapped to BoundaryCI plans on the server. The browser and webhook metadata cannot grant a plan or quota.
- Stripe webhook event IDs are recorded in the same database transaction as the subscription update, so retries are safe.
- Checkout and portal functions re-check the caller's Supabase identity and owner/admin membership server-side.

## Deploy a beta environment

Create and link a Supabase project, then apply the migration and deploy the function:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy ingest-scan --no-verify-jwt
supabase secrets set BOUNDARYCI_APP_URL=https://boundaryci.com
```

JWT verification is disabled only at the Edge gateway because uploads use a repository-bound BoundaryCI token instead of a Supabase user JWT. The function authenticates that token through the database RPC. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied to hosted Supabase Edge Functions; never expose the service-role key to the CLI, browser, or GitHub workflow.

## Onboard an organization

The dashboard performs these calls with the signed-in user's Supabase JWT:

1. Call `create_organization(name, slug)`. It creates the organization and its first owner atomically.
2. Insert a `repositories` row for a GitHub `owner/repository`. Row-level security requires an owner or administrator.
3. Call `create_ingestion_key(repository_id, name)`. Display the returned plaintext token once and instruct the user to save it as the GitHub secret `BOUNDARYCI_CLOUD_TOKEN`.
4. Store the Edge Function URL as `BOUNDARYCI_CLOUD_URL` and enable the Action's `upload` input.

Billing webhooks must use a server-side service credential to update `plan`, `subscription_status`, `monthly_scan_limit`, and the Stripe identifiers. Those columns are deliberately not writable by authenticated browser clients. A limit of `0` means unlimited scans and should be reserved for contracted Enterprise accounts.

## Configure Stripe Billing

Use Stripe test mode first. Create these four recurring prices under BoundaryCI products:

| Plan | Monthly | Annual |
| --- | ---: | ---: |
| Team | $49/month | $490/year |
| Growth | $149/month | $1,490/year |

Copy `supabase/billing-secrets.example` to `supabase/.env.billing.local`, replace every placeholder with the BoundaryCI test-mode key, webhook secret, and price IDs, then upload the secrets without putting them in shell history:

```powershell
Copy-Item cloud/supabase/billing-secrets.example cloud/supabase/.env.billing.local
npx.cmd supabase secrets set --project-ref YOUR_PROJECT_REF --env-file cloud/supabase/.env.billing.local
```

Validate the test prices and create or update the dedicated BoundaryCI customer
portal configuration. The command prints the non-secret
`STRIPE_PORTAL_CONFIGURATION_ID`; add it to Supabase secrets before deploying
`create-portal`:

```powershell
cd cloud/supabase
npx.cmd --yes deno run --allow-env --allow-net --env-file=.env.billing.local scripts/configure-stripe.ts
npx.cmd supabase secrets set --project-ref YOUR_PROJECT_REF STRIPE_PORTAL_CONFIGURATION_ID=bpc_YOUR_ID
cd ../..
```

Deploy the authenticated billing functions and the signature-authenticated webhook:

```powershell
npx.cmd supabase functions deploy create-checkout --project-ref YOUR_PROJECT_REF --no-verify-jwt
npx.cmd supabase functions deploy create-portal --project-ref YOUR_PROJECT_REF --no-verify-jwt
npx.cmd supabase functions deploy stripe-webhook --project-ref YOUR_PROJECT_REF --no-verify-jwt
```

In Stripe Workbench, create a webhook destination pointing to:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook
```

Subscribe only to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy that destination's signing secret into `STRIPE_WEBHOOK_SECRET` and upload the secrets again. Configure the Stripe customer portal to allow payment-method updates, invoice history, cancellation at period end, and switching between the four BoundaryCI prices.

Do not reuse PursuitPilot/day_duh price IDs. A Stripe account can be shared, but each product's prices and webhook metadata must remain distinct. The webhook safely ignores subscriptions whose price IDs are not in the BoundaryCI secret mapping.

To promote the verified sandbox integration to live payments, follow the root
[`PRODUCTION.md`](../PRODUCTION.md) checklist. The live validation command is intentionally
separate and rejects test keys or test prices:

```powershell
cd cloud/supabase
npx.cmd --yes deno run --allow-env --allow-net --env-file=.env.billing.live.local scripts/configure-stripe.ts --live
```

## Run the dashboard locally

Use the project's public publishable key, never its secret or service-role key:

```bash
cd cloud/web
cp .env.example .env.local
npm install
npm run dev
```

The production build is static and is deployed by `.github/workflows/deploy-cloud-web.yml`.
Configure these public GitHub repository variables before running that workflow:

- `BOUNDARYCI_SUPABASE_URL`
- `BOUNDARYCI_SUPABASE_PUBLISHABLE_KEY`
- `BOUNDARYCI_INGEST_URL`

For the production GitHub Pages host, set the Supabase Auth Site URL to
`https://boundaryci.com/` and add that exact URL to the redirect allow list.
The publishable key is intentionally browser-visible. The Supabase secret and legacy
service-role keys must never be placed in Vite variables or GitHub Pages configuration.

## Dashboard scope

The authenticated dashboard now uses these read models:

- organization overview: newest runs, pass rate, and new findings by severity;
- repository page: run history by commit and branch;
- scan page: finding evidence, recommendation, and disposition;
- onboarding: organization, repository, and one-time ingestion-token creation;
- plan usage is visible.
- owners and administrators can purchase Team or Growth monthly/annual plans;
- subscription, renewal, cancellation, and payment-problem states are webhook-driven;
- customers manage payment methods, invoices, plan changes, and cancellation in Stripe's hosted portal.

After five design-partner repositories are sending real runs, prioritize the workflow customers repeatedly request rather than expanding into a generic security dashboard.
