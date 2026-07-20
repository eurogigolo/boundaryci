import type { BoundaryConfig } from "./config.js";
import {
  normalizeFireworksFindings,
  prepareReviewInput,
} from "./fireworks.js";
import type { Finding, SqlFile } from "./types.js";

type FetchLike = typeof fetch;
const MAX_MANAGED_INPUT_CHARACTERS = 80_000;

export interface ManagedFireworksReviewResult {
  status:
    | "completed"
    | "pending"
    | "not-entitled"
    | "subscription-inactive"
    | "organization-disabled"
    | "repository-disabled";
  findings: Finding[];
  warnings: string[];
  model?: string;
}

interface ManagedReviewOptions {
  cloudUrl: string;
  token: string;
  repository: string;
  externalId: string;
}

function managedReviewUrl(cloudUrl: string): string {
  let url: URL;
  try {
    url = new URL(cloudUrl);
  } catch {
    throw new Error("BOUNDARYCI_CLOUD_URL must be a valid URL.");
  }
  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && localHosts.has(url.hostname))) {
    throw new Error("BoundaryCI managed AI review requires HTTPS except on localhost.");
  }
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.at(-1) !== "ingest-scan") {
    throw new Error("BOUNDARYCI_CLOUD_URL must point to the ingest-scan function.");
  }
  segments[segments.length - 1] = "managed-fireworks";
  url.pathname = `/${segments.join("/")}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function responseError(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const message = (payload as { error?: unknown }).error;
    if (typeof message === "string" && message.trim()) return message.slice(0, 300);
  }
  return `HTTP ${status}`;
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const responseText = (await response.text()).slice(0, 200_000);
  try {
    return responseText ? JSON.parse(responseText) as unknown : null;
  } catch {
    return null;
  }
}

export async function reviewWithManagedFireworks(
  files: SqlFile[],
  config: BoundaryConfig,
  options: ManagedReviewOptions,
  fetchImplementation: FetchLike = fetch,
): Promise<ManagedFireworksReviewResult> {
  const reviewInput = prepareReviewInput(
    files,
    Math.min(config.fireworks.maxInputCharacters, MAX_MANAGED_INPUT_CHARACTERS),
  );
  if (reviewInput.files.length === 0) {
    throw new Error("No migration content was available for managed Fireworks review.");
  }

  const endpoint = managedReviewUrl(options.cloudUrl);
  const headers = {
    Authorization: `Bearer ${options.token}`,
    "Content-Type": "application/json",
    "User-Agent": "boundaryci-managed-review/1.0",
  };
  const statusResponse = await fetchImplementation(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      schemaVersion: "1.0",
      operation: "status",
      repository: options.repository,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const statusPayload = await readResponsePayload(statusResponse);
  if (!statusResponse.ok) {
    throw new Error(
      `Managed Fireworks review failed: ${responseError(statusPayload, statusResponse.status)}`,
    );
  }
  const availability = statusPayload && typeof statusPayload === "object"
    ? (statusPayload as { status?: unknown }).status
    : null;
  const inactiveStatuses: ManagedFireworksReviewResult["status"][] = [
    "pending",
    "not-entitled",
    "subscription-inactive",
    "organization-disabled",
    "repository-disabled",
  ];
  if (typeof availability === "string" && inactiveStatuses.includes(
    availability as ManagedFireworksReviewResult["status"],
  )) {
    return {
      status: availability as ManagedFireworksReviewResult["status"],
      findings: [],
      warnings: [],
    };
  }
  if (availability !== "enabled") {
    throw new Error("BoundaryCI Cloud returned an unknown managed Fireworks status.");
  }

  const response = await fetchImplementation(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      schemaVersion: "1.0",
      operation: "review",
      externalId: options.externalId,
      repository: options.repository,
      files: reviewInput.files,
      truncated: reviewInput.truncated,
    }),
    signal: AbortSignal.timeout(55_000),
  });

  const payload = await readResponsePayload(response);
  if (!response.ok) {
    throw new Error(`Managed Fireworks review failed: ${responseError(payload, response.status)}`);
  }
  if (!payload || typeof payload !== "object") {
    throw new Error("BoundaryCI Cloud returned an invalid managed Fireworks response.");
  }

  const status = (payload as { status?: unknown }).status;
  if (typeof status === "string" && inactiveStatuses.includes(
    status as ManagedFireworksReviewResult["status"],
  )) {
    return {
      status: status as ManagedFireworksReviewResult["status"],
      findings: [],
      warnings: status === "pending"
        ? ["Managed Fireworks review is already in progress for this scan."]
        : [],
    };
  }
  if (status !== "completed") {
    throw new Error("BoundaryCI Cloud returned an unknown managed Fireworks status.");
  }

  const model = (payload as { model?: unknown }).model;
  const warnings = (payload as { warnings?: unknown }).warnings;
  const normalized = normalizeFireworksFindings(payload, files);
  if (typeof model !== "string" || !model.trim()) {
    throw new Error("BoundaryCI Cloud returned no managed Fireworks model.");
  }

  const safeWarnings = Array.isArray(warnings)
    ? warnings.filter((warning): warning is string => typeof warning === "string")
      .map((warning) => warning.slice(0, 500))
      .slice(0, 20)
    : [];
  if (normalized.discarded > 0) {
    safeWarnings.push(
      `Discarded ${normalized.discarded} malformed managed Fireworks finding${normalized.discarded === 1 ? "" : "s"}.`,
    );
  }

  return {
    status: "completed",
    findings: normalized.findings,
    warnings: safeWarnings,
    model,
  };
}
