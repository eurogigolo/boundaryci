import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RepositorySetupGuide } from "./RepositorySetupGuide";

describe("repository GitHub setup guide", () => {
  const endpoint = "https://example.supabase.co/functions/v1/ingest-scan";
  const markup = renderToStaticMarkup(
    <RepositorySetupGuide
      repository={{ full_name: "acme/tenant-api" }}
      endpoint={endpoint}
    />,
  );

  it("separates the one-time token from reusable workflow instructions", () => {
    expect(markup).toContain("Connect acme/tenant-api in three steps");
    expect(markup).toContain("Secrets and variables");
    expect(markup).toContain("BOUNDARYCI_CLOUD_TOKEN");
    expect(markup).toContain(".github/workflows/boundaryci.yml");
    expect(markup).toContain("secrets.BOUNDARYCI_CLOUD_TOKEN");
    expect(markup).toContain(endpoint);
    expect(markup).toContain('managed-fireworks: &quot;true&quot;');
    expect(markup).not.toContain("bci_");
  });

  it("explains the first pull request and token replacement path", () => {
    expect(markup).toContain("Open a pull request containing SQL");
    expect(markup).toContain("high-severity regression fails the check");
    expect(markup).toContain("Lost the token?");
    expect(markup).toContain("leave this workflow unchanged");
    expect(markup).toContain("never receives the Fireworks API key");
    expect(markup).toContain('managed-fireworks: &quot;false&quot;');
  });

  it("directs read-only members to an organization manager for replacement tokens", () => {
    const readOnlyMarkup = renderToStaticMarkup(
      <RepositorySetupGuide
        repository={{ full_name: "acme/tenant-api" }}
        endpoint={endpoint}
        canManageToken={false}
      />,
    );
    expect(readOnlyMarkup).toContain("Ask an organization owner or administrator");
  });
});
