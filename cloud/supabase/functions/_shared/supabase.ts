export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface BillingOrganization {
  id: string;
  name: string;
  plan: "trial" | "team" | "growth" | "enterprise";
  subscription_status: string;
  stripe_customer_id: string | null;
}

interface SupabaseEnvironment {
  url: string;
  serviceRoleKey: string;
}

function environment(): SupabaseEnvironment {
  const url = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service configuration is missing.");
  }
  return { url, serviceRoleKey };
}

function serviceHeaders(extra: HeadersInit = {}): Headers {
  const { serviceRoleKey } = environment();
  const headers = new Headers(extra);
  headers.set("apikey", serviceRoleKey);
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${serviceRoleKey}`);
  }
  return headers;
}

async function responseJson<T>(
  response: Response,
  fallback: string,
): Promise<T> {
  const body = await response.text();
  if (!response.ok) {
    let message = fallback;
    try {
      const parsed = JSON.parse(body) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch {
      // Keep internal gateway output out of the client response.
    }
    throw new Error(message);
  }
  return (body ? JSON.parse(body) : null) as T;
}

export async function authenticatedUser(
  request: Request,
): Promise<AuthenticatedUser> {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    throw new Error("Authentication is required.");
  }
  const { url } = environment();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: serviceHeaders({ Authorization: authorization }),
  });
  const user = await responseJson<{ id?: string; email?: string }>(
    response,
    "Authentication is required.",
  );
  if (!user.id || !user.email) {
    throw new Error("A verified email address is required.");
  }
  return { id: user.id, email: user.email };
}

export async function managedOrganization(
  organizationId: string,
  userId: string,
): Promise<BillingOrganization> {
  if (!/^[0-9a-f-]{36}$/i.test(organizationId)) {
    throw new Error("Invalid organization.");
  }
  const { url } = environment();
  const membershipQuery = new URLSearchParams({
    select: "role",
    organization_id: `eq.${organizationId}`,
    user_id: `eq.${userId}`,
    role: "in.(owner,admin)",
    limit: "1",
  });
  const membershipResponse = await fetch(
    `${url}/rest/v1/organization_members?${membershipQuery}`,
    { headers: serviceHeaders() },
  );
  const memberships = await responseJson<Array<{ role: string }>>(
    membershipResponse,
    "Unable to verify organization access.",
  );
  if (memberships.length === 0) {
    throw new Error("Owner or administrator access is required.");
  }

  const organizationQuery = new URLSearchParams({
    select: "id,name,plan,subscription_status,stripe_customer_id",
    id: `eq.${organizationId}`,
    limit: "1",
  });
  const organizationResponse = await fetch(
    `${url}/rest/v1/organizations?${organizationQuery}`,
    { headers: serviceHeaders() },
  );
  const organizations = await responseJson<BillingOrganization[]>(
    organizationResponse,
    "Unable to load billing details.",
  );
  if (!organizations[0]) throw new Error("Organization not found.");
  return organizations[0];
}

export async function attachStripeCustomer(
  organizationId: string,
  customerId: string,
): Promise<string> {
  const { url } = environment();
  const query = new URLSearchParams({
    id: `eq.${organizationId}`,
    stripe_customer_id: "is.null",
  });
  const response = await fetch(`${url}/rest/v1/organizations?${query}`, {
    method: "PATCH",
    headers: serviceHeaders({
      "Content-Type": "application/json",
      Prefer: "return=representation",
    }),
    body: JSON.stringify({ stripe_customer_id: customerId }),
  });
  const updated = await responseJson<Array<{ stripe_customer_id: string }>>(
    response,
    "Unable to link the Stripe customer.",
  );
  if (updated[0]?.stripe_customer_id) return updated[0].stripe_customer_id;

  const organization = await organizationById(organizationId);
  if (!organization.stripe_customer_id) {
    throw new Error("Unable to link the Stripe customer.");
  }
  return organization.stripe_customer_id;
}

async function organizationById(
  organizationId: string,
): Promise<BillingOrganization> {
  const { url } = environment();
  const query = new URLSearchParams({
    select: "id,name,plan,subscription_status,stripe_customer_id",
    id: `eq.${organizationId}`,
    limit: "1",
  });
  const response = await fetch(`${url}/rest/v1/organizations?${query}`, {
    headers: serviceHeaders(),
  });
  const organizations = await responseJson<BillingOrganization[]>(
    response,
    "Unable to load billing details.",
  );
  if (!organizations[0]) throw new Error("Organization not found.");
  return organizations[0];
}

export async function syncStripeSubscription(
  body: Record<string, unknown>,
): Promise<boolean> {
  const { url } = environment();
  const response = await fetch(`${url}/rest/v1/rpc/sync_stripe_subscription`, {
    method: "POST",
    headers: serviceHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  return responseJson<boolean>(
    response,
    "Unable to synchronize the Stripe subscription.",
  );
}
