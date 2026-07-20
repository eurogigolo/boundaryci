import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Organization } from "../types";
import { RepositoryConnectionForm, repositoryCreationErrorMessage } from "./Onboarding";

const organization: Organization = {
  id: "organization-id",
  name: "Acme",
  slug: "acme",
  plan: "trial",
  subscription_status: "active",
  monthly_scan_limit: 100,
  billing_interval: null,
  current_period_start: null,
  current_period_end: null,
  cancel_at_period_end: false,
};

describe("repository connection form", () => {
  it("collects the exact GitHub repository and default branch", () => {
    const markup = renderToStaticMarkup(
      <RepositoryConnectionForm organization={organization} onConnected={vi.fn()} />,
    );

    expect(markup).toContain("GitHub repository");
    expect(markup).toContain('placeholder="owner/repository"');
    expect(markup).toContain("Default branch");
    expect(markup).toContain('value="main"');
    expect(markup).toContain("Connect repository");
    expect(markup).not.toContain("bci_");
  });

  it("turns a uniqueness violation into an actionable duplicate message", () => {
    expect(repositoryCreationErrorMessage({ code: "23505", message: "duplicate key" }))
      .toContain("already connected to the organization");
    expect(repositoryCreationErrorMessage(new Error("network unavailable")))
      .toBe("network unavailable");
  });
});
