import { appUrl, json, options } from "../_shared/http.ts";
import { authenticatedUser, managedOrganization } from "../_shared/supabase.ts";
import { stripeClient } from "../_shared/stripe.ts";

Deno.serve(async (request) => {
  const preflight = options(request);
  if (preflight) return preflight;
  if (request.method !== "POST") {
    return json(request, 405, { error: "Method not allowed." });
  }

  let body: { organizationId?: unknown };
  try {
    body = await request.json();
  } catch {
    return json(request, 400, {
      error: "The request body must be valid JSON.",
    });
  }
  if (typeof body.organizationId !== "string") {
    return json(request, 400, { error: "Choose an organization to manage." });
  }

  let organization;
  try {
    const user = await authenticatedUser(request);
    organization = await managedOrganization(body.organizationId, user.id);
  } catch (caught) {
    const message = caught instanceof Error
      ? caught.message
      : "Authentication is required.";
    const status = message.includes("Owner or administrator") ? 403 : 401;
    return json(request, status, { error: message });
  }
  if (!organization.stripe_customer_id) {
    return json(request, 409, {
      error: "This organization does not have a billing account yet.",
    });
  }

  try {
    const session = await stripeClient().billingPortal.sessions.create({
      customer: organization.stripe_customer_id,
      return_url: `${appUrl()}/?billing=portal`,
    });
    return json(request, 200, { url: session.url });
  } catch (caught) {
    console.error("BoundaryCI billing portal creation failed.", caught);
    return json(request, 502, {
      error: "The Stripe billing portal is temporarily unavailable.",
    });
  }
});
