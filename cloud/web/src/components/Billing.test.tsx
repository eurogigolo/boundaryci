import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Organization } from "../types";
import { Billing } from "./Billing";

const freeOrganization: Organization = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Acme",
  slug: "acme",
  plan: "trial",
  subscription_status: "active",
  monthly_scan_limit: 100,
  billing_interval: null,
  current_period_start: null,
  current_period_end: null,
  cancel_at_period_end: false,
  managed_ai_enabled: false,
  managed_ai_consented_at: null,
};

describe("BoundaryCI billing conversion", () => {
  it("shows the selected plan and interval without starting checkout", () => {
    const markup = renderToStaticMarkup(
      <Billing
        organization={freeOrganization}
        monthlyUsage={0}
        canManage
        result={null}
        selectedPlan="team"
        initialInterval="annual"
        onRefresh={() => undefined}
      />,
    );

    expect(markup).toContain("Team selected");
    expect(markup).toContain("pricing-card featured selected");
    expect(markup).toContain("$41");
    expect(markup).toContain("$490 USD/year, billed annually");
    expect(markup).toContain(">Choose Team</button>");
  });
});
