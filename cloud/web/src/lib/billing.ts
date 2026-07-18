import type { Plan } from "../types";

export type CheckoutPlan = "team" | "growth";
export type CheckoutInterval = "monthly" | "annual";

export interface BillingPlan {
  key: Plan;
  name: string;
  description: string;
  monthlyPrice: number;
  annualMonthlyPrice: number;
  monthlyScanLimit: number;
  featured?: boolean;
  features: string[];
}

export const BILLING_PLANS: BillingPlan[] = [
  {
    key: "trial",
    name: "Free",
    description: "Prove tenant isolation on your first SaaS repository.",
    monthlyPrice: 0,
    annualMonthlyPrice: 0,
    monthlyScanLimit: 100,
    features: [
      "100 Cloud scans per month",
      "Repository-bound upload tokens",
      "Scan history and finding evidence",
      "Deterministic tenant-isolation checks",
    ],
  },
  {
    key: "team",
    name: "Team",
    description: "Continuous protection for a shipping SaaS team.",
    monthlyPrice: 49,
    annualMonthlyPrice: 41,
    monthlyScanLimit: 1_000,
    featured: true,
    features: [
      "1,000 Cloud scans per month",
      "Organization-wide security history",
      "Fireworks AI finding storage",
      "Self-service billing and invoices",
    ],
  },
  {
    key: "growth",
    name: "Growth",
    description: "Higher-volume assurance across a growing SaaS portfolio.",
    monthlyPrice: 149,
    annualMonthlyPrice: 124,
    monthlyScanLimit: 10_000,
    features: [
      "10,000 Cloud scans per month",
      "Everything in Team",
      "Capacity for multi-repository CI",
      "Priority product support",
    ],
  },
];

export function planName(plan: Plan): string {
  return BILLING_PLANS.find((candidate) => candidate.key === plan)?.name ?? "Enterprise";
}

export function checkoutPlan(plan: Plan): CheckoutPlan | null {
  return plan === "team" || plan === "growth" ? plan : null;
}

export function isStripeHostedUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (
      url.hostname === "checkout.stripe.com" ||
      url.hostname === "billing.stripe.com"
    );
  } catch {
    return false;
  }
}
