import { useState } from "react";
import { errorMessage } from "../lib/errors";
import {
  BILLING_PLANS,
  checkoutPlan,
  isStripeHostedUrl,
  planName,
  type CheckoutPlan,
  type CheckoutInterval,
} from "../lib/billing";
import { requireSupabase } from "../lib/supabase";
import type { Organization } from "../types";

interface BillingProps {
  organization: Organization;
  monthlyUsage: number;
  canManage: boolean;
  result: string | null;
  selectedPlan?: CheckoutPlan | null;
  initialInterval?: CheckoutInterval;
  onRefresh: () => void;
}

async function functionError(caught: unknown): Promise<string> {
  if (
    caught &&
    typeof caught === "object" &&
    "context" in caught &&
    caught.context instanceof Response
  ) {
    try {
      const body = await caught.context.clone().json() as { error?: string };
      if (body.error) return body.error;
    } catch {
      // Fall through to the SDK error text.
    }
  }
  return errorMessage(caught);
}

export function Billing({
  organization,
  monthlyUsage,
  canManage,
  result,
  selectedPlan = null,
  initialInterval = "monthly",
  onRefresh,
}: BillingProps) {
  const [interval, setInterval] = useState<CheckoutInterval>(initialInterval);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasPaidHistory = organization.plan !== "trial";
  const activePaidPlan = hasPaidHistory && !["canceled", "incomplete_expired"].includes(
    organization.subscription_status,
  );

  async function redirectToFunction(
    functionName: "create-checkout" | "create-portal",
    body: Record<string, string>,
    busyKey: string,
  ) {
    setBusy(busyKey);
    setError(null);
    try {
      const { data, error: invokeError } = await requireSupabase().functions.invoke(functionName, {
        body,
      });
      if (invokeError) throw invokeError;
      if (!isStripeHostedUrl(data?.url)) throw new Error("Stripe returned an invalid redirect URL.");
      window.location.assign(data.url);
    } catch (caught) {
      setError(await functionError(caught));
      setBusy(null);
    }
  }

  async function startCheckout(plan: Organization["plan"]) {
    const paidPlan = checkoutPlan(plan);
    if (!paidPlan) return;
    if (activePaidPlan) {
      await manageBilling();
      return;
    }
    await redirectToFunction(
      "create-checkout",
      { organizationId: organization.id, plan: paidPlan, interval },
      paidPlan,
    );
  }

  async function manageBilling() {
    await redirectToFunction(
      "create-portal",
      { organizationId: organization.id },
      "portal",
    );
  }

  const periodEnd = organization.current_period_end
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
        new Date(organization.current_period_end),
      )
    : null;

  return (
    <div className="content-page billing-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Plans and billing</span>
          <h1>Protect every release</h1>
          <p>Choose the scan capacity that matches how often your team ships.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={onRefresh}>
          Refresh status
        </button>
      </header>

      {result === "success" && (
        <div className="alert alert-success billing-alert">
          Checkout completed. Stripe is confirming your subscription; refresh if the new plan is not visible yet.
        </div>
      )}
      {result === "canceled" && (
        <div className="alert alert-warning billing-alert">Checkout was canceled. Your plan was not changed.</div>
      )}
      {result === "portal" && (
        <div className="alert alert-success billing-alert">Billing changes are synchronized from Stripe.</div>
      )}
      {selectedPlan && organization.plan === "trial" && !result && (
        <div className="alert alert-success billing-alert">
          {planName(selectedPlan)} selected. Review the plan below; Stripe opens only after you confirm.
        </div>
      )}
      {error && <div className="alert alert-error billing-alert">{error}</div>}

      <section className="billing-summary">
        <div>
          <span className="detail-label">Current plan</span>
          <strong>{planName(organization.plan)}</strong>
          <small className={`subscription-state ${organization.subscription_status}`}>
            {organization.subscription_status.replaceAll("_", " ")}
          </small>
        </div>
        <div>
          <span className="detail-label">Usage this month</span>
          <strong>{monthlyUsage.toLocaleString()}</strong>
          <small>of {organization.monthly_scan_limit.toLocaleString()} scans</small>
        </div>
        <div>
          <span className="detail-label">Billing period</span>
          <strong>{organization.billing_interval ?? "—"}</strong>
          <small>
            {organization.cancel_at_period_end
              ? `Cancels ${periodEnd ?? "at period end"}`
              : periodEnd
                ? `Renews ${periodEnd}`
                : "No paid subscription"}
          </small>
        </div>
        <div className="billing-summary-action">
          {hasPaidHistory && canManage ? (
            <button
              className="button button-secondary"
              type="button"
              disabled={busy !== null}
              onClick={() => void manageBilling()}
            >
              {busy === "portal" ? "Opening…" : "Manage billing"}
            </button>
          ) : (
            <small>{canManage ? "Upgrade below when you need more capacity." : "Ask an owner or admin to manage billing."}</small>
          )}
        </div>
      </section>

      <div className="billing-toggle" aria-label="Billing interval">
        <button
          type="button"
          className={interval === "monthly" ? "active" : ""}
          onClick={() => setInterval("monthly")}
        >
          Monthly
        </button>
        <button
          type="button"
          className={interval === "annual" ? "active" : ""}
          onClick={() => setInterval("annual")}
        >
          Annual <span>2 months free</span>
        </button>
      </div>

      <section className="pricing-grid">
        {BILLING_PLANS.map((plan) => {
          const current = organization.plan === plan.key;
          const price = interval === "annual" ? plan.annualMonthlyPrice : plan.monthlyPrice;
          return (
            <article
              className={`pricing-card ${plan.featured ? "featured" : ""} ${selectedPlan === plan.key ? "selected" : ""}`}
              key={plan.key}
            >
              {plan.featured && <span className="pricing-badge">Built for SaaS teams</span>}
              <span className="eyebrow">{plan.name}</span>
              <h2>{price === 0 ? "$0" : `$${price}`}<small> USD/month</small></h2>
              {interval === "annual" && price > 0 && (
                <p className="annual-total">${plan.monthlyPrice * 10} USD/year, billed annually</p>
              )}
              <p>{plan.description}</p>
              <ul>
                {plan.features.map((feature) => <li key={feature}><span>✓</span>{feature}</li>)}
              </ul>
              {plan.key === "trial" ? (
                <button className="button button-secondary button-full" type="button" disabled>
                  {current ? "Current plan" : "Included"}
                </button>
              ) : (
                <button
                  className={`button ${plan.featured ? "button-primary" : "button-secondary"} button-full`}
                  type="button"
                  disabled={!canManage || busy !== null || (current && activePaidPlan)}
                  onClick={() => void startCheckout(plan.key)}
                >
                  {busy === plan.key
                    ? "Opening Stripe…"
                    : current && activePaidPlan
                      ? "Current plan"
                      : activePaidPlan
                        ? "Change in billing portal"
                        : `Choose ${plan.name}`}
                </button>
              )}
            </article>
          );
        })}
      </section>

      <p className="billing-terms">
        Paid subscriptions renew automatically until canceled. Cancellation normally takes effect at the end of the current paid period. Charges are non-refundable except where required by law or agreed in writing. Stripe processes card details. Review the <a href="/terms/" target="_blank" rel="noreferrer">subscription terms</a> and <a href="/privacy/" target="_blank" rel="noreferrer">privacy notice</a> before purchase.
      </p>

      <section className="enterprise-callout">
        <div>
          <span className="eyebrow">Enterprise</span>
          <h2>Need custom volume, onboarding, or procurement?</h2>
          <p>We can tailor scan capacity and commercial terms around your SaaS portfolio.</p>
        </div>
        <a
          className="button button-secondary"
          href="https://github.com/sir-gig/boundaryci/issues/new?title=BoundaryCI%20Enterprise"
          target="_blank"
          rel="noreferrer"
        >
          Talk to us
        </a>
      </section>
    </div>
  );
}
