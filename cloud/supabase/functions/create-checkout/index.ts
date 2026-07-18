import { appUrl, json, options } from "../_shared/http.ts";
import {
  attachStripeCustomer,
  authenticatedUser,
  managedOrganization,
} from "../_shared/supabase.ts";
import {
  configuredPrice,
  isBillingInterval,
  isPaidPlan,
  stripeClient,
} from "../_shared/stripe.ts";

const MAX_BODY_BYTES = 10_000;

Deno.serve(async (request) => {
  const preflight = options(request);
  if (preflight) return preflight;
  if (request.method !== "POST") {
    return json(request, 405, { error: "Method not allowed." });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json(request, 413, { error: "The checkout request is too large." });
  }

  let body: { organizationId?: unknown; plan?: unknown; interval?: unknown };
  try {
    body = await request.json();
  } catch {
    return json(request, 400, {
      error: "The request body must be valid JSON.",
    });
  }
  if (typeof body.organizationId !== "string") {
    return json(request, 400, { error: "Choose an organization to upgrade." });
  }
  if (!isPaidPlan(body.plan) || !isBillingInterval(body.interval)) {
    return json(request, 400, {
      error: "Choose a valid BoundaryCI plan and billing interval.",
    });
  }

  let user;
  let organization;
  try {
    user = await authenticatedUser(request);
    organization = await managedOrganization(body.organizationId, user.id);
  } catch (caught) {
    const message = caught instanceof Error
      ? caught.message
      : "Authentication is required.";
    const status = message.includes("Owner or administrator") ? 403 : 401;
    return json(request, status, { error: message });
  }

  if (
    organization.plan !== "trial" &&
    !["canceled", "incomplete_expired"].includes(
      organization.subscription_status,
    )
  ) {
    return json(request, 409, {
      error:
        "This organization already has a subscription. Use Manage billing to change it.",
    });
  }

  try {
    const stripe = stripeClient();
    let customerId = organization.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email: user.email,
          name: organization.name,
          metadata: { boundaryci_organization_id: organization.id },
        },
        { idempotencyKey: `boundaryci-customer-${organization.id}` },
      );
      customerId = await attachStripeCustomer(organization.id, customer.id);
    }

    const priceId = configuredPrice(body.plan, body.interval);
    const dashboardUrl = appUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: organization.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url:
        `${dashboardUrl}/?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${dashboardUrl}/?billing=canceled`,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      tax_id_collection: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
      metadata: {
        boundaryci_organization_id: organization.id,
        boundaryci_plan: body.plan,
        boundaryci_interval: body.interval,
      },
      subscription_data: {
        metadata: {
          boundaryci_organization_id: organization.id,
          boundaryci_plan: body.plan,
        },
      },
    });
    if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
    return json(request, 200, { url: session.url });
  } catch (caught) {
    console.error("BoundaryCI Checkout creation failed.", caught);
    const configurationError = caught instanceof Error && (
      caught.message.includes("not configured") ||
      caught.message.includes("price is unavailable")
    );
    return json(request, configurationError ? 503 : 502, {
      error: configurationError
        ? "BoundaryCI billing is being configured. Please try again shortly."
        : "Stripe Checkout is temporarily unavailable.",
    });
  }
});
