import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config.js";
import { discoverSqlFiles } from "../src/discover.js";
import { shouldFail, toSarif } from "../src/report.js";
import { scanSqlFiles } from "../src/scanner.js";

function config() {
  return structuredClone(defaultConfig);
}

describe("BoundaryCI scanner", () => {
  it("falls back to other migrations when a configured directory is empty", async () => {
    const target = path.resolve("test/fixtures/discovery/fallback");
    const files = await discoverSqlFiles(target, config());

    expect(files.map((file) => file.relativePath)).toEqual(["drizzle/001_init.sql"]);
  });

  it("finds the baseline tenant-isolation hazards", async () => {
    const target = path.resolve("test/fixtures/vulnerable");
    const files = await discoverSqlFiles(target, config());
    const report = scanSqlFiles(target, files, config());
    const ruleIds = report.findings.map((finding) => finding.ruleId);

    expect(ruleIds).toEqual(["BND001", "BND003", "BND004", "BND002", "BND005", "BND006"]);
    expect(report.summary).toMatchObject({ critical: 1, high: 4, medium: 1, deterministic: 6 });
    expect(report.databaseProfile.effective).toBe("supabase");
    expect(shouldFail(report, "high", false)).toBe(true);
  });

  it("does not treat a server-side PostgreSQL public schema as a Supabase API", () => {
    const files = [
      {
        path: "C:/server-app/drizzle/001.sql",
        relativePath: "drizzle/001.sql",
        content: "create table public.users (id uuid primary key);",
      },
    ];
    const report = scanSqlFiles("C:/server-app", files, config());

    expect(report.databaseProfile).toMatchObject({
      configured: "auto",
      effective: "postgres",
    });
    expect(report.findings).toEqual([]);
  });

  it("allows Supabase exposure checks to be forced", () => {
    const forcedConfig = config();
    forcedConfig.databaseProfile = "supabase";
    const files = [
      {
        path: "C:/server-app/drizzle/001.sql",
        relativePath: "drizzle/001.sql",
        content: "create table public.users (id uuid primary key);",
      },
    ];
    const report = scanSqlFiles("C:/server-app", files, forcedConfig);

    expect(report.databaseProfile).toMatchObject({
      configured: "supabase",
      effective: "supabase",
    });
    expect(report.findings.map((finding) => finding.ruleId)).toEqual(["BND001"]);
  });

  it("keeps the secure fixture clean", async () => {
    const target = path.resolve("test/fixtures/secure");
    const files = await discoverSqlFiles(target, config());
    const report = scanSqlFiles(target, files, config());

    expect(report.findings).toEqual([]);
    expect(report.semanticReview.status).toBe("not-requested");
    expect(shouldFail(report, "low", false)).toBe(false);
  });

  it("produces SARIF for code scanning", async () => {
    const target = path.resolve("test/fixtures/vulnerable");
    const files = await discoverSqlFiles(target, config());
    const report = scanSqlFiles(target, files, config());
    const sarif = toSarif(report) as { version: string; runs: Array<{ results: unknown[] }> };

    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs[0]?.results).toHaveLength(6);
  });
});
