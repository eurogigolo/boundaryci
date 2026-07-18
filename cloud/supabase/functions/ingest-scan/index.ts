const MAX_BODY_BYTES = 1_000_000;

interface DatabaseError {
  code?: string;
  message?: string;
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function statusForDatabaseError(error: DatabaseError): number {
  if (error.code === "28000") return 401;
  if (error.message?.includes("monthly scan limit")) return 429;
  if (error.message?.includes("subscription is not active")) return 402;
  return 400;
}

function publicDatabaseMessage(error: DatabaseError): string {
  const allowedMessages = [
    "Invalid or revoked ingestion token.",
    "The token is not valid for this repository.",
    "The BoundaryCI Cloud subscription is not active.",
    "The monthly scan limit has been reached.",
  ];
  return allowedMessages.includes(error.message ?? "")
    ? String(error.message)
    : "The scan payload was rejected.";
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json(413, { error: "The scan payload is too large." });
  }

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer bci_")) {
    return json(401, { error: "A BoundaryCI ingestion token is required." });
  }
  const token = authorization.slice("Bearer ".length).trim();
  if (token.length < 24 || token.length > 200) {
    return json(401, { error: "The BoundaryCI ingestion token is invalid." });
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return json(413, { error: "The scan payload is too large." });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return json(400, { error: "The request body must be valid JSON." });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return json(400, { error: "The scan payload must be a JSON object." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "BoundaryCI Cloud is missing its Supabase service configuration.",
    );
    return json(503, { error: "BoundaryCI Cloud is temporarily unavailable." });
  }

  const databaseResponse = await fetch(
    `${supabaseUrl}/rest/v1/rpc/ingest_scan`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key_sha256: await sha256(token),
        payload,
      }),
    },
  );

  const databaseBody = await databaseResponse.text();
  if (!databaseResponse.ok) {
    let databaseError: DatabaseError = {};
    try {
      databaseError = JSON.parse(databaseBody) as DatabaseError;
    } catch {
      // Do not expose an unexpected database or gateway response.
    }
    console.error("BoundaryCI scan ingestion was rejected.", {
      status: databaseResponse.status,
      code: databaseError.code,
    });
    return json(statusForDatabaseError(databaseError), {
      error: publicDatabaseMessage(databaseError),
    });
  }

  let scanId: unknown;
  try {
    scanId = JSON.parse(databaseBody) as unknown;
  } catch {
    scanId = null;
  }
  if (typeof scanId !== "string") {
    console.error("BoundaryCI scan ingestion returned no scan identifier.");
    return json(503, { error: "BoundaryCI Cloud is temporarily unavailable." });
  }

  const appUrl = Deno.env.get("BOUNDARYCI_APP_URL")?.replace(/\/$/, "");
  return json(202, {
    scanId,
    dashboardUrl: appUrl ? `${appUrl}/scans/${scanId}` : null,
  });
});
