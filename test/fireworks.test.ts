import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultConfig } from "../src/config.js";
import {
  describeReviewCoverage,
  normalizeFireworksFindings,
  prepareReviewInput,
  reviewWithFireworks,
} from "../src/fireworks.js";
import type { SqlFile } from "../src/types.js";

const originalApiKey = process.env.FIREWORKS_API_KEY;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalApiKey === undefined) delete process.env.FIREWORKS_API_KEY;
  else process.env.FIREWORKS_API_KEY = originalApiKey;
});

describe("Fireworks semantic review", () => {
  it("prioritizes newest migrations when the review input is truncated", () => {
    const files: SqlFile[] = [
      {
        path: "C:/repo/supabase/migrations/001_old.sql",
        relativePath: "supabase/migrations/001_old.sql",
        content: "select 'old';".repeat(10),
      },
      {
        path: "C:/repo/supabase/migrations/002_new.sql",
        relativePath: "supabase/migrations/002_new.sql",
        content: "select 'new';".repeat(10),
      },
    ];

    const prepared = prepareReviewInput(files, 100);

    expect(prepared.files.map((file) => file.path)).toEqual([
      "supabase/migrations/002_new.sql",
    ]);
    expect(prepared.partialFiles).toEqual(["supabase/migrations/002_new.sql"]);
    expect(prepared.omittedFiles).toEqual(["supabase/migrations/001_old.sql"]);
    expect(describeReviewCoverage(prepared)).toContain("Newest migrations were prioritized");
  });

  it("redacts secrets and validates structured findings", async () => {
    process.env.FIREWORKS_API_KEY = "test-fireworks-key";
    const fakeSecret = ["sk", "super", "secret", "value", "123456789"].join("_");
    const files: SqlFile[] = [
      {
        path: "C:/repo/supabase/migrations/001.sql",
        relativePath: "supabase/migrations/001.sql",
        content: `select service_role_key = '${fakeSecret}';\nselect 1;`,
      },
    ];
    let requestBody = "";
    const fetchMock = vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      requestBody = String(init?.body ?? "");
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  findings: [
                    {
                      title: "Tenant ID can be reassigned",
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
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const result = await reviewWithFireworks(files, structuredClone(defaultConfig), fetchMock);

    expect(requestBody).toContain("[REDACTED_");
    expect(requestBody).not.toContain(fakeSecret);
    const parsedRequest = JSON.parse(requestBody) as {
      max_tokens: number;
      response_format: { json_schema: { schema: { properties: { findings: unknown } } } };
      messages: Array<{ content: string }>;
    };
    expect(parsedRequest.max_tokens).toBe(8_192);
    expect(parsedRequest.response_format.json_schema.schema.properties.findings)
      .not.toHaveProperty("maxItems");
    expect(parsedRequest.messages[0]?.content).toContain("valid JSON object");
    expect(parsedRequest.messages[0]?.content).toContain(
      "Do not assume compromise of the database owner, service role",
    );
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      ruleId: "AI001",
      source: "fireworks",
      severity: "high",
      location: { file: "supabase/migrations/001.sql", line: 2 },
    });
  });

  it("disables reasoning for DeepSeek V4 structured reviews", async () => {
    process.env.FIREWORKS_API_KEY = "test-fireworks-key";
    const config = structuredClone(defaultConfig);
    config.fireworks.model = "accounts/fireworks/models/deepseek-v4-flash";
    let requestBody = "";
    const fetchMock = vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      requestBody = String(init?.body ?? "");
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ findings: [] }) } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    await reviewWithFireworks([], config, fetchMock);

    expect(JSON.parse(requestBody)).toMatchObject({ reasoning_effort: "none" });
  });

  it("requires an API key only when semantic review is invoked", async () => {
    delete process.env.FIREWORKS_API_KEY;
    await expect(reviewWithFireworks([], structuredClone(defaultConfig))).rejects.toThrow(
      "FIREWORKS_API_KEY",
    );
  });

  it("rejects type-coerced line numbers from provider output", () => {
    const files: SqlFile[] = [{
      path: "C:/repo/supabase/migrations/001.sql",
      relativePath: "supabase/migrations/001.sql",
      content: "select 1;",
    }];
    const normalized = normalizeFireworksFindings({
      findings: [{
        title: "Untrusted result",
        description: "The line number is not an integer value.",
        severity: "high",
        confidence: "high",
        file: "supabase/migrations/001.sql",
        line: "1",
        evidence: "A string should not pass the response validator.",
        recommendation: "Discard the malformed finding.",
        tags: ["tenant-isolation"],
      }],
    }, files);

    expect(normalized).toEqual({ findings: [], discarded: 1 });
  });

  it("turns account suspension responses into a safe billing message", async () => {
    process.env.FIREWORKS_API_KEY = "test-fireworks-key";
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: {
            message: "Account private-account-name is suspended due to unpaid invoices.",
          },
        }),
        { status: 412, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    await expect(
      reviewWithFireworks([], structuredClone(defaultConfig), fetchMock),
    ).rejects.toThrow("account or billing action is required (HTTP 412)");

    try {
      await reviewWithFireworks([], structuredClone(defaultConfig), fetchMock);
    } catch (error) {
      expect(String(error)).not.toContain("private-account-name");
    }
  });
});
