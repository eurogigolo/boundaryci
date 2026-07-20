import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicSite } from "./PublicSite";

describe("BoundaryCI public launch site", () => {
  const markup = renderToStaticMarkup(<PublicSite baseUrl="/" />);

  it("renders the core tenant-isolation promise and real scanner command", () => {
    expect(markup).toContain("Stop one customer from seeing");
    expect(markup).toContain("npx boundaryci scan .");
    expect(markup).toContain("No database credentials");
  });

  it("publishes the current pricing without changing product limits", () => {
    expect(markup).toContain("$49");
    expect(markup).toContain("$149");
    expect(markup).toContain("USD / month");
    expect(markup).toContain("1,000 Cloud scans per month");
    expect(markup).toContain("10,000 Cloud scans per month");
    expect(markup).toContain("Paid subscriptions renew automatically until canceled");
    expect(markup).toContain('href="/terms/"');
    expect(markup).toContain('href="/privacy/"');
  });

  it("routes public conversion actions into the Cloud signup", () => {
    expect(markup).toContain('href="/?auth=signup"');
    expect(markup).toContain('href="/?auth=signin"');
  });

  it("explains the GitHub token and workflow without exposing a credential", () => {
    expect(markup).toContain("How do I connect a GitHub repository?");
    expect(markup).toContain("BOUNDARYCI_CLOUD_TOKEN");
    expect(markup).toContain("The token never goes in the file");
    expect(markup).toContain("Can one workspace monitor multiple repositories?");
    expect(markup).toContain("select Add repository in the dashboard");
    expect(markup).not.toContain("bci_");
  });
});
