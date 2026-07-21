import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyAdoptionDocuments,
  createBaseline,
  type WaiversFile,
} from "../src/adoption.js";
import { defaultConfig } from "../src/config.js";
import { discoverSqlFiles } from "../src/discover.js";
import { fingerprintFinding } from "../src/findings.js";
import { renderGithubReport, shouldFail, toSarif } from "../src/report.js";
import { scanSqlFiles } from "../src/scanner.js";

async function vulnerableReport() {
  const target = path.resolve("test/fixtures/vulnerable");
  const config = structuredClone(defaultConfig);
  const files = await discoverSqlFiles(target, config);
  return scanSqlFiles(target, files, config);
}

describe("adoption controls", () => {
  it("keeps fingerprints stable across line and whitespace changes", async () => {
    const report = await vulnerableReport();
    const finding = report.findings[0];
    expect(finding).toBeDefined();
    if (!finding) return;

    const changed = {
      ...finding,
      location: { ...finding.location, line: finding.location.line + 50 },
      evidence: `  ${finding.evidence.replaceAll(" ", "   ")}  `,
    };
    expect(fingerprintFinding(changed)).toBe(finding.fingerprint);
  });

  it("baselines existing findings and leaves a missing entry new", async () => {
    const original = await vulnerableReport();
    const baseline = createBaseline(original, new Date("2026-07-17T00:00:00.000Z"));
    const fullyBaselined = await vulnerableReport();
    applyAdoptionDocuments(fullyBaselined, baseline, undefined);

    expect(fullyBaselined.summary).toMatchObject({ newFindings: 0, baseline: 12, waived: 0 });
    expect(shouldFail(fullyBaselined, "high", false)).toBe(false);
    const sarif = toSarif(fullyBaselined) as { runs: Array<{ results: unknown[] }> };
    expect(sarif.runs[0]?.results).toEqual([]);

    const partialBaseline = { ...baseline, findings: baseline.findings.slice(1) };
    const oneNew = await vulnerableReport();
    applyAdoptionDocuments(oneNew, partialBaseline, undefined);
    expect(oneNew.summary).toMatchObject({ newFindings: 1, baseline: 11 });
    expect(shouldFail(oneNew, "high", false)).toBe(true);
  });

  it("honors active waivers and reactivates expired waivers", async () => {
    const activeReport = await vulnerableReport();
    activeReport.findings = activeReport.findings.slice(0, 1);
    const fingerprint = activeReport.findings[0]?.fingerprint;
    expect(fingerprint).toBeDefined();
    if (!fingerprint) return;

    const activeWaivers: WaiversFile = {
      schemaVersion: "1.0",
      waivers: [
        {
          fingerprint,
          owner: "security-team",
          reason: "Temporary exception while the migration is replaced.",
          expiresOn: "2026-08-01",
          createdAt: "2026-07-17T00:00:00.000Z",
        },
      ],
    };
    applyAdoptionDocuments(
      activeReport,
      undefined,
      activeWaivers,
      new Date("2026-07-17T12:00:00.000Z"),
    );
    expect(activeReport.findings[0]).toMatchObject({
      disposition: "waived",
      waiver: { owner: "security-team", expiresOn: "2026-08-01" },
    });
    expect(shouldFail(activeReport, "high", false)).toBe(false);

    const expiredReport = await vulnerableReport();
    expiredReport.findings = expiredReport.findings.slice(0, 1);
    const expiredWaivers: WaiversFile = {
      ...activeWaivers,
      waivers: [{ ...activeWaivers.waivers[0]!, expiresOn: "2026-07-16" }],
    };
    applyAdoptionDocuments(
      expiredReport,
      undefined,
      expiredWaivers,
      new Date("2026-07-17T12:00:00.000Z"),
    );
    expect(expiredReport.findings[0]?.disposition).toBe("new");
    expect(expiredReport.warnings[0]).toContain("expired on 2026-07-16");
  });

  it("emits GitHub annotations only for new findings", async () => {
    const report = await vulnerableReport();
    const baseline = createBaseline(report);
    applyAdoptionDocuments(report, baseline, undefined);
    expect(renderGithubReport(report)).not.toContain("::error file=");

    report.findings[0]!.disposition = "new";
    report.summary.newFindings = 1;
    report.summary.baseline -= 1;
    const output = renderGithubReport(report);
    expect(output).toContain("::error file=");
    expect(output).toContain(`Fingerprint: ${report.findings[0]!.fingerprint}`);
  });
});
