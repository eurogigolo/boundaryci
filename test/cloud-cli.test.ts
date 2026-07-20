import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Cloud CLI integration", () => {
  it("scans locally and uploads the minimized report", async () => {
    let authorization = "";
    let receivedPayload: Record<string, unknown> | null = null;
    let managedReviewPayload: Record<string, unknown> | null = null;
    const server = createServer(async (request, response) => {
      authorization = request.headers.authorization ?? "";
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
      if (request.url?.endsWith("/managed-fireworks")) {
        if (payload.operation === "status") {
          response.writeHead(200, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ status: "enabled" }));
          return;
        }
        managedReviewPayload = payload;
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({
          status: "completed",
          model: "accounts/fireworks/models/deepseek-v4-flash",
          findings: [],
          warnings: [],
        }));
        return;
      }
      receivedPayload = payload;
      response.writeHead(202, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          scanId: "bc43d5e0-e303-40fa-844a-f1f97257a118",
          dashboardUrl: null,
        }),
      );
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    try {
      const address = server.address() as AddressInfo;
      const child = spawn(
        process.execPath,
        [
          path.resolve("node_modules/tsx/dist/cli.mjs"),
          "src/cli.ts",
          "scan",
          "test/fixtures/secure",
          "--profile",
          "supabase",
          "--format",
          "json",
          "--upload",
          "--cloud-url",
          `http://127.0.0.1:${address.port}/functions/v1/ingest-scan`,
          "--repository",
          "acme/billing",
          "--commit",
          "abc123",
        ],
        {
          cwd: path.resolve("."),
          env: {
            ...process.env,
            BOUNDARYCI_CLOUD_TOKEN: "bci_1234567890abcdefghijklmnop",
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
      });
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });
      const [exitCode] = (await once(child, "exit")) as [number];

      expect(exitCode).toBe(0);
      expect(JSON.parse(stdout)).toMatchObject({ schemaVersion: "1.0", findings: [] });
      expect(stderr).toContain("BoundaryCI Cloud accepted scan bc43d5e0");
      expect(authorization).toBe("Bearer bci_1234567890abcdefghijklmnop");
      expect(managedReviewPayload).toMatchObject({
        schemaVersion: "1.0",
        repository: "acme/billing",
      });
      expect(JSON.stringify(managedReviewPayload)).not.toContain("service_role_key");
      expect(receivedPayload).toMatchObject({
        repository: "acme/billing",
        commitSha: "abc123",
        outcome: "passed",
        findings: [],
      });
      expect(JSON.stringify(receivedPayload)).not.toContain("test/fixtures/secure");
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
