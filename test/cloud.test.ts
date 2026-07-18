import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createCloudScanPayload,
  uploadScanReport,
  type CloudScanPayload,
} from "../src/cloud.js";
import { defaultConfig } from "../src/config.js";
import { discoverSqlFiles } from "../src/discover.js";
import { scanSqlFiles } from "../src/scanner.js";
import type { ScanReport } from "../src/types.js";

async function vulnerableReport(): Promise<ScanReport> {
  const target = path.resolve("test/fixtures/vulnerable");
  const config = structuredClone(defaultConfig);
  const files = await discoverSqlFiles(target, config);
  const report = scanSqlFiles(target, files, config);
  report.target = "C:/Users/example/private/customer-repository";
  report.warnings.push("Internal warning that should remain local");
  report.findings[0]!.evidence =
    "api_key='fw_1234567890abcdefghijklmnop' in ../../private/001.sql";
  report.findings[0]!.location.file = "../../private/001.sql";
  return report;
}

async function vulnerablePayload(): Promise<CloudScanPayload> {
  return createCloudScanPayload(
    await vulnerableReport(),
    {
      repository: "acme/billing",
      commitSha: "abc123",
      branch: "feature/tenant-policy",
      pullRequest: 42,
      failOn: "high",
      includeAiInExitCode: false,
    },
    "de305d54-75b4-431b-adb2-eb6b9e546014",
  );
}

describe("BoundaryCI Cloud client", () => {
  it("creates a minimized, redacted, repository-scoped payload", async () => {
    const payload = await vulnerablePayload();
    const serialized = JSON.stringify(payload);

    expect(payload).toMatchObject({
      schemaVersion: "1.0",
      externalId: "de305d54-75b4-431b-adb2-eb6b9e546014",
      repository: "acme/billing",
      provider: "github",
      outcome: "failed",
      fileCount: 1,
    });
    expect(payload.findings[0]).toMatchObject({
      file: "private/001.sql",
      evidence: "api_key='[REDACTED_SECRET]' in ../../private/001.sql",
    });
    expect(serialized).not.toContain("C:/Users/example");
    expect(serialized).not.toContain("Internal warning");
    expect(serialized).not.toContain("fw_1234567890abcdefghijklmnop");
    expect(serialized).not.toContain('"target"');
    expect(serialized).not.toContain('"files"');

    const reportWithAbsoluteFinding = await vulnerableReport();
    reportWithAbsoluteFinding.findings[0]!.location.file =
      "C:/Users/example/private/migrations/001.sql";
    const absolutePathPayload = createCloudScanPayload(reportWithAbsoluteFinding, {
      repository: "acme/billing",
      commitSha: null,
      branch: null,
      pullRequest: null,
      failOn: "none",
      includeAiInExitCode: false,
    });
    expect(absolutePathPayload.findings[0]?.file).toBe("001.sql");
    expect(JSON.stringify(absolutePathPayload)).not.toContain("Users/example");
  });

  it("uploads with a repository token and accepts a dashboard link", async () => {
    const payload = await vulnerablePayload();
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer bci_1234567890abcdefghijklmnop",
        "Content-Type": "application/json",
      });
      expect(JSON.parse(String(init?.body))).toMatchObject({ repository: "acme/billing" });
      return new Response(
        JSON.stringify({
          scanId: "9f6e28af-c516-41f9-bf37-e0e5a9dc93b1",
          dashboardUrl: "https://boundaryci.com/scans/9f6e28af-c516-41f9-bf37-e0e5a9dc93b1",
        }),
        { status: 202, headers: { "Content-Type": "application/json" } },
      );
    });

    const result = await uploadScanReport(
      "https://cloud.boundaryci.com/v1/scans",
      "bci_1234567890abcdefghijklmnop",
      payload,
      fetchMock as typeof fetch,
    );

    expect(result).toEqual({
      scanId: "9f6e28af-c516-41f9-bf37-e0e5a9dc93b1",
      dashboardUrl: "https://boundaryci.com/scans/9f6e28af-c516-41f9-bf37-e0e5a9dc93b1",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects insecure remote endpoints and invalid repository identities", async () => {
    const payload = await vulnerablePayload();
    await expect(
      uploadScanReport(
        "http://cloud.boundaryci.com/v1/scans",
        "bci_1234567890abcdefghijklmnop",
        payload,
        vi.fn() as typeof fetch,
      ),
    ).rejects.toThrow("requires HTTPS");

    const report = await vulnerableReport();
    expect(() =>
      createCloudScanPayload(
        report,
        {
          repository: "not-a-repository",
          commitSha: null,
          branch: null,
          pullRequest: null,
          failOn: "high",
          includeAiInExitCode: false,
        },
      ),
    ).toThrow("owner/name format");
  });
});
