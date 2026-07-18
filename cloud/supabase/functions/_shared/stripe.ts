import Stripe from "npm:stripe@22.3.2";

export type PaidPlan = "team" | "growth";
export type BillingInterval = "monthly" | "annual";

interface PriceConfiguration {
  plan: PaidPlan;
  interval: BillingInterval;
  stripeInterval: "month" | "year";
  environmentName: string;
}

const PRICE_CONFIGURATION: PriceConfiguration[] = [
  {
    plan: "team",
    interval: "monthly",
    stripeInterval: "month",
    environmentName: "STRIPE_PRICE_TEAM_MONTHLY",
  },
  {
    plan: "team",
    interval: "annual",
    stripeInterval: "year",
    environmentName: "STRIPE_PRICE_TEAM_ANNUAL",
  },
  {
    plan: "growth",
    interval: "monthly",
    stripeInterval: "month",
    environmentName: "STRIPE_PRICE_GROWTH_MONTHLY",
  },
  {
    plan: "growth",
    interval: "annual",
    stripeInterval: "year",
    environmentName: "STRIPE_PRICE_GROWTH_ANNUAL",
  },
];

export function stripeClient(): Stripe {
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secretKey) throw new Error("Stripe billing is not configured.");
  return new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
  });
}

export function webhookSecret(): string {
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) {
    throw new Error("Stripe webhook verification is not configured.");
  }
  return secret;
}

export function configuredPrice(
  plan: PaidPlan,
  interval: BillingInterval,
): string {
  const configuration = PRICE_CONFIGURATION.find(
    (candidate) => candidate.plan === plan && candidate.interval === interval,
  );
  const priceId = configuration
    ? Deno.env.get(configuration.environmentName)?.trim()
    : null;
  if (!priceId?.startsWith("price_")) {
    throw new Error(`The ${plan} ${interval} price is unavailable.`);
  }
  return priceId;
}

export function planForPrice(priceId: string): {
  plan: PaidPlan;
  stripeInterval: "month" | "year";
} | null {
  for (const configuration of PRICE_CONFIGURATION) {
    if (Deno.env.get(configuration.environmentName)?.trim() === priceId) {
      return {
        plan: configuration.plan,
        stripeInterval: configuration.stripeInterval,
      };
    }
  }
  return null;
}

export function isPaidPlan(value: unknown): value is PaidPlan {
  return value === "team" || value === "growth";
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "monthly" || value === "annual";
}
