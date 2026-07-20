import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Organization } from "../types";
import { AddRepositoryDialog } from "./AddRepositoryDialog";

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
};

describe("add repository dialog", () => {
  it("explains that each connection gets an isolated token and history", () => {
    const markup = renderToStaticMarkup(
      <AddRepositoryDialog
        organization={organization}
        onClose={vi.fn()}
        onRepositoryPersisted={vi.fn()}
        onConnected={vi.fn()}
      />,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("Add another repository");
    expect(markup).toContain("separate repository-bound token and scan history");
    expect(markup).toContain('placeholder="owner/repository"');
    expect(markup).toContain("Connect repository");
    expect(markup).not.toContain("bci_");
  });
});
