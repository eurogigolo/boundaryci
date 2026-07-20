import type { ScanSummary, Severity } from "../types";

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63);
}

export function isGitHubRepository(value: string): boolean {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value.trim());
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatRelative(value: string, now = Date.now()): string {
  const elapsed = now - new Date(value).getTime();
  const future = elapsed < 0;
  const absolute = Math.abs(elapsed);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, milliseconds] of units) {
    if (absolute >= milliseconds || unit === "minute") {
      const amount = Math.max(1, Math.round(absolute / milliseconds));
      return formatter.format(future ? amount : -amount, unit);
    }
  }
  return "just now";
}

export function shortCommit(value: string | null): string {
  return value ? value.slice(0, 8) : "local";
}

export function highestSeverity(summary: ScanSummary): Severity | null {
  if (summary.critical > 0) return "critical";
  if (summary.high > 0) return "high";
  if (summary.medium > 0) return "medium";
  if (summary.low > 0) return "low";
  if (summary.info > 0) return "info";
  return null;
}

export const GITHUB_ACTION_SECRET_NAME = "BOUNDARYCI_CLOUD_TOKEN";
export const GITHUB_WORKFLOW_PATH = ".github/workflows/boundaryci.yml";

export function buildActionYaml(ingestEndpoint: string): string {
  return `name: Tenant isolation
on: [pull_request]

permissions:
  contents: read

jobs:
  boundaryci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: sir-gig/boundaryci@v0.3.0
        with:
          target: .
          fail-on: high
          managed-fireworks: "true"
          upload: "true"
          cloud-url: ${ingestEndpoint}
          cloud-token: \${{ secrets.BOUNDARYCI_CLOUD_TOKEN }}
`;
}
