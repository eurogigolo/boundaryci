import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Organization, Repository } from "../types";
import { ManagedAiSettings } from "./ManagedAiSettings";

const organization: Organization = {
  id: "organization-id",
  name: "Acme",
  slug: "acme",
  plan: "team",
  subscription_status: "active",
  monthly_scan_limit: 1_000,
  billing_interval: "month",
  current_period_start: null,
  current_period_end: null,
  cancel_at_period_end: false,
  managed_ai_enabled: false,
  managed_ai_consented_at: null,
};

const repository: Repository = {
  id: "repository-id",
  organization_id: organization.id,
  full_name: "acme/tenant-api",
  default_branch: "main",
  active: true,
  managed_ai_enabled: true,
  created_at: "2026-07-19T00:00:00.000Z",
};

describe("managed AI settings", () => {
  it("requires an explicit disclosure acknowledgment before enablement", () => {
    const markup = renderToStaticMarkup(
      <ManagedAiSettings
        organization={organization}
        repositories={[repository]}
        canManage
        onViewPlans={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    expect(markup).toContain("Managed Fireworks AI");
    expect(markup).toContain("redacts common secrets inside the GitHub runner");
    expect(markup).toContain("I authorize BoundaryCI");
    expect(markup).toContain("Enable managed AI review");
    expect(markup).toContain("disabled");
  });

  it("shows per-repository opt-outs after organization consent", () => {
    const markup = renderToStaticMarkup(
      <ManagedAiSettings
        organization={{
          ...organization,
          managed_ai_enabled: true,
          managed_ai_consented_at: "2026-07-19T00:00:00.000Z",
        }}
        repositories={[repository]}
        canManage
        onViewPlans={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    expect(markup).toContain("Active");
    expect(markup).toContain("acme/tenant-api");
    expect(markup).toContain("AI review enabled");
    expect(markup).toContain("Disable for organization");
  });

  it("presents an upgrade path without collecting consent on Free", () => {
    const markup = renderToStaticMarkup(
      <ManagedAiSettings
        organization={{ ...organization, plan: "trial" }}
        repositories={[repository]}
        canManage
        onViewPlans={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    expect(markup).toContain("included with Team, Growth, and Enterprise");
    expect(markup).toContain("View plans");
    expect(markup).not.toContain("I authorize BoundaryCI");
  });
});
