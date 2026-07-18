import { describe, expect, it } from "vitest";
import { BILLING_PLANS, checkoutPlan, isStripeHostedUrl, planName } from "./billing";

describe("billing catalog", () => {
  it("keeps paid capacity above the free allowance", () => {
    const [free, team, growth] = BILLING_PLANS;
    expect(free.monthlyScanLimit).toBe(100);
    expect(team.monthlyScanLimit).toBeGreaterThan(free.monthlyScanLimit);
    expect(growth.monthlyScanLimit).toBeGreaterThan(team.monthlyScanLimit);
  });

  it("maps public and checkout plan names", () => {
    expect(planName("trial")).toBe("Free");
    expect(planName("enterprise")).toBe("Enterprise");
    expect(checkoutPlan("team")).toBe("team");
    expect(checkoutPlan("trial")).toBeNull();
  });

  it("accepts only Stripe-hosted redirect URLs", () => {
    expect(isStripeHostedUrl("https://checkout.stripe.com/c/pay/cs_test_123")).toBe(true);
    expect(isStripeHostedUrl("https://billing.stripe.com/p/session/test_123")).toBe(true);
    expect(isStripeHostedUrl("http://checkout.stripe.com/c/pay/test")).toBe(false);
    expect(isStripeHostedUrl("https://stripe.example.com/steal")).toBe(false);
  });
});
