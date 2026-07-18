# BoundaryCI production launch

This checklist promotes the existing public beta from Supabase's development email service and
Stripe sandbox billing to customer-ready authentication and live payments. Never paste SMTP,
Stripe, Supabase, or DNS secrets into issues, commits, chat, or screenshots.

## 1. Production authentication

### Domain and SMTP

Use a BoundaryCI-owned domain or subdomain for authentication email. Keep transactional auth
mail separate from future marketing mail; for example, send auth mail from
`no-reply@auth.example.com` and marketing mail from a different subdomain.

1. Create an account with an SMTP provider such as Resend, Postmark, Amazon SES, SendGrid,
   ZeptoMail, or Brevo.
2. Add the provider's SPF and DKIM records to DNS. Add a DMARC record in monitoring mode, then
   verify the sending domain in the provider.
3. In Supabase, open **Authentication → Email → SMTP settings** and enable custom SMTP.
4. Enter the provider's SMTP host, port, username, and password. Set the sender name to
   `BoundaryCI` and use the verified From address.
5. In **Authentication → URL Configuration**, set the Site URL to
   `https://boundaryci.com/` and add that exact URL to the redirect allow list.
6. Keep email confirmation enabled. Start with Supabase's default custom-SMTP rate limit and
   raise it only after bot protection is configured.

Recommended Supabase subjects:

| Template | Subject |
| --- | --- |
| Confirm sign up | Confirm your BoundaryCI account |
| Reset password | Reset your BoundaryCI password |
| Password changed | Your BoundaryCI password was changed |

Keep the templates short and use Supabase's `{{ .ConfirmationURL }}` for the action button.
Disable click tracking in the email provider because rewritten authentication links can fail.

### Verify authentication

Use an address that is not a member of the Supabase project team:

1. Create an account from the public BoundaryCI signup page.
2. Confirm the email and verify that the link returns to BoundaryCI already authenticated.
3. Sign out, request a password reset, follow the email, and set a new password on the BoundaryCI
   recovery screen.
4. Confirm SPF and DKIM pass in the received message headers and that the message does not land in
   spam.

## 2. Stripe account activation

Before creating live objects, finish Stripe's business verification and confirm that live charges
and payouts are enabled. In Stripe's public business information, configure:

- the legal/business name and BoundaryCI website;
- a customer-visible support email and support URL;
- the business address and support phone requested by Stripe;
- a recognizable statement descriptor such as `BOUNDARYCI`;
- a payout bank account and the required owner/representative information.

Decide how sales tax, VAT, and GST will be handled before charging customers. Stripe price tax
behavior becomes difficult to change after use, and enabling Stripe Tax can add fees. Obtain tax
or legal advice appropriate to the business rather than treating this checklist as tax advice.

## 3. Create live BoundaryCI billing objects

Stripe sandboxes and live mode have separate prices, webhooks, portal configurations, customers,
and subscriptions.

1. Turn off sandbox/test-data view in Stripe.
2. Copy the BoundaryCI Team and Growth products to live mode, or recreate them with exactly these
   recurring prices:

   | Plan | Monthly | Annual |
   | --- | ---: | ---: |
   | Team | $49 USD | $490 USD |
   | Growth | $149 USD | $1,490 USD |

3. Create a live webhook destination for:

   `https://banbckoxtzptmrtsctki.supabase.co/functions/v1/stripe-webhook`

4. Subscribe it only to:

   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

5. Copy the live signing secret and live IDs into a local ignored file:

   ```powershell
   cd C:\Users\Ryan\Desktop\fw_ai
   Copy-Item cloud\supabase\billing-secrets.live.example cloud\supabase\.env.billing.live.local
   notepad cloud\supabase\.env.billing.live.local
   ```

6. Validate the live account, all four prices, and create the live customer portal configuration:

   ```powershell
   cd cloud\supabase
   npx.cmd --yes deno run --allow-env --allow-net --env-file=.env.billing.live.local scripts/configure-stripe.ts --live
   ```

7. Put the printed `STRIPE_PORTAL_CONFIGURATION_ID` into
   `.env.billing.live.local`. Run the same command again; every check must pass.

## 4. Retire the sandbox billing record

The existing BoundaryCI organization used a sandbox customer and subscription. A sandbox customer
ID cannot be used with a live secret key. Immediately before uploading live secrets, open the
Supabase SQL Editor and identify only the test organization:

```sql
select id, name, plan, subscription_status, stripe_customer_id
from public.organizations
where stripe_customer_id is not null;
```

After confirming there are no real customers yet, replace `YOUR_ORGANIZATION_ID` below with that
organization's UUID and run the transaction. Do not run this against an organization that has ever
received a real payment.

```sql
begin;

delete from public.stripe_events
where organization_id = 'YOUR_ORGANIZATION_ID'::uuid;

update public.organizations
set
  plan = 'trial',
  subscription_status = 'active',
  monthly_scan_limit = 100,
  stripe_customer_id = null,
  stripe_subscription_id = null,
  stripe_price_id = null,
  billing_interval = null,
  current_period_start = null,
  current_period_end = null,
  cancel_at_period_end = false,
  updated_at = now()
where id = 'YOUR_ORGANIZATION_ID'::uuid;

commit;
```

## 5. Upload live secrets

Only after the live validation and sandbox-record reset succeed:

```powershell
cd C:\Users\Ryan\Desktop\fw_ai
npx.cmd supabase secrets set --project-ref banbckoxtzptmrtsctki --env-file cloud/supabase/.env.billing.live.local
```

The hosted billing functions read the new secrets without exposing them to the browser. Keep the
test and live local files so sandbox testing does not overwrite production accidentally.

## 6. Live smoke test

1. Sign in to BoundaryCI and confirm the organization is back on Free.
2. Buy the Team monthly plan with a real card. This creates a real $49 charge.
3. Confirm the dashboard changes to Team, the Stripe event delivery returns HTTP 200, and the
   customer portal opens.
4. Download the invoice, update the payment method, and schedule cancellation at period end.
5. Refund the launch-test payment from Stripe if desired, and verify the resulting subscription
   state. Refunds and subscription cancellation are separate Stripe actions.

BoundaryCI is ready for paid traffic only when external email delivery and the entire live billing
smoke test pass.
