import { describe, expect, it, vi } from "vitest";
import { defaultConfig } from "../src/config.js";
import { reviewWithManagedFireworks } from "../src/managed-fireworks.js";
import type { SqlFile } from "../src/types.js";

const files: SqlFile[] = [
  {
    path: "C:/repo/supabase/migrations/001.sql",
    relativePath: "supabase/migrations/001.sql",
    content: "select service_role_key = 'sk_super_secret_value_123456789';\nselect 1;",
  },
];

const options = {
  cloudUrl: "https://example.supabase.co/functions/v1/ingest-scan",
  token: "bci_repository_token_that_is_long_enough",
  repository: "acme/tenant-api",
  externalId: "8ab86a48-16fa-4af9-87af-a62ff5369438",
};

describe("managed Fireworks review", () => {
  it("redacts migration input and validates Cloud findings", async () => {
    let requestUrl = "";
    const requestBodies: string[] = [];
    const fetchMock = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      requestUrl = String(input);
      const requestBody = String(init?.body ?? "");
      requestBodies.push(requestBody);
      if ((JSON.parse(requestBody) as { operation?: string }).operation === "status") {
        return new Response(JSON.stringify({ status: "enabled" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        status: "completed",
        model: "accounts/fireworks/models/deepseek-v4-flash",
        warnings: [],
        findings: [
          {
            title: "Tenant reassignment is possible",
            description: "The proposed-row predicate is broader than the existing-row tenant check.",
            severity: "high",
            confidence: "high",
            file: "supabase/migrations/001.sql",
            line: 2,
            evidence: "WITH CHECK (true) permits tenant_id reassignment.",
            recommendation: "Replace WITH CHECK (true) with the tenant membership predicate.",
            tags: ["rls", "tenant-isolation"],
          },
        ],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as unknown as typeof fetch;

    const result = await reviewWithManagedFireworks(
      files,
      structuredClone(defaultConfig),
      options,
      fetchMock,
    );

    expect(requestUrl).toBe("https://example.supabase.co/functions/v1/managed-fireworks");
    expect(requestBodies).toHaveLength(2);
    expect(requestBodies[0]).not.toContain("service_role_key");
    expect(requestBodies[0]).not.toContain("sk_super_secret_value_123456789");
    expect(requestBodies[1]).toContain("[REDACTED_");
    expect(requestBodies[1]).not.toContain("sk_super_secret_value_123456789");
    expect(result).toMatchObject({
      status: "completed",
      model: "accounts/fireworks/models/deepseek-v4-flash",
    });
    expect(result.findings[0]).toMatchObject({
      ruleId: "AI001",
      source: "fireworks",
      location: { file: "supabase/migrations/001.sql", line: 2 },
    });
  });

  it("quietly honors an organization opt-out", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ status: "organization-disabled" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as unknown as typeof fetch;

    const result = await reviewWithManagedFireworks(
      files,
      structuredClone(defaultConfig),
      options,
      fetchMock,
    );

    expect(result).toEqual({
      status: "organization-disabled",
      findings: [],
      warnings: [],
    });
  });

  it("enforces the managed 80,000-character cap even when direct-review config is higher", async () => {
    const largeFiles: SqlFile[] = [{
      path: "C:/repo/supabase/migrations/large.sql",
      relativePath: "supabase/migrations/large.sql",
      content: "x".repeat(100_000),
    }];
    let reviewPayload: { files: Array<{ content: string }>; truncated: boolean } | undefined;
    const fetchMock = vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        operation?: string;
        files?: Array<{ content: string }>;
        truncated?: boolean;
      };
      if (body.operation === "status") {
        return new Response(JSON.stringify({ status: "enabled" }), { status: 200 });
      }
      reviewPayload = {
        files: body.files ?? [],
        truncated: body.truncated === true,
      };
      return new Response(JSON.stringify({
        status: "completed",
        model: "accounts/fireworks/models/deepseek-v4-flash",
        warnings: [],
        findings: [],
      }), { status: 200 });
    }) as unknown as typeof fetch;
    const config = structuredClone(defaultConfig);
    config.fireworks.maxInputCharacters = 1_000_000;

    await reviewWithManagedFireworks(largeFiles, config, options, fetchMock);

    expect(reviewPayload?.truncated).toBe(true);
    expect(reviewPayload?.files.reduce((total, file) => total + file.content.length, 0))
      .toBeLessThan(80_000);
  });

  it("keeps provider failures safe and actionable", async () => {
    const fetchMock = vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { operation?: string };
      return body.operation === "status"
        ? new Response(JSON.stringify({ status: "enabled" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
        : new Response(JSON.stringify({
          error: "Managed AI review is temporarily rate limited.",
        }), { status: 429, headers: { "Content-Type": "application/json" } });
    }) as unknown as typeof fetch;

    await expect(reviewWithManagedFireworks(
      files,
      structuredClone(defaultConfig),
      options,
      fetchMock,
    )).rejects.toThrow("temporarily rate limited");
  });
});
