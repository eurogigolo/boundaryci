import { describe, expect, it } from "vitest";
import {
  GITHUB_ACTION_SECRET_NAME,
  GITHUB_WORKFLOW_PATH,
  buildActionYaml,
  formatRelative,
  highestSeverity,
  isGitHubRepository,
  slugify,
} from "./format";

describe("Cloud presentation helpers", () => {
  it("creates safe organization slugs", () => {
    expect(slugify("Ryan's SaaS Company!" )).toBe("ryan-s-saas-company");
    expect(slugify("  Déjà Vu  ")).toBe("deja-vu");
  });

  it("validates GitHub owner/repository identities", () => {
    expect(isGitHubRepository("sir-gig/boundaryci")).toBe(true);
    expect(isGitHubRepository("missing-owner")).toBe(false);
    expect(isGitHubRepository("owner/repo/extra")).toBe(false);
  });

  it("builds setup YAML without embedding the ingestion token", () => {
    const yaml = buildActionYaml("https://example.supabase.co/functions/v1/ingest-scan");
    expect(yaml).toContain("BOUNDARYCI_CLOUD_TOKEN");
    expect(yaml).toContain("https://example.supabase.co/functions/v1/ingest-scan");
    expect(yaml).toContain("permissions:\n  contents: read");
    expect(yaml).toContain("sir-gig/boundaryci@v0.4.0");
    expect(yaml).toContain('managed-fireworks: "true"');
    expect(yaml).not.toContain("bci_");
    expect(GITHUB_ACTION_SECRET_NAME).toBe("BOUNDARYCI_CLOUD_TOKEN");
    expect(GITHUB_WORKFLOW_PATH).toBe(".github/workflows/boundaryci.yml");
  });

  it("formats relative run times and selects the worst severity", () => {
    const now = new Date("2026-07-18T00:00:00.000Z").getTime();
    expect(formatRelative("2026-07-17T23:00:00.000Z", now)).toContain("hour");
    expect(
      highestSeverity({
        critical: 0,
        high: 2,
        medium: 3,
        low: 0,
        info: 0,
        newFindings: 5,
        baseline: 0,
        waived: 0,
      }),
    ).toBe("high");
  });
});
