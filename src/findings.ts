import { createHash } from "node:crypto";
import type { Finding, ReportFinding } from "./types.js";

function normalizeIdentity(value: string): string {
  return value
    .replaceAll("\\", "/")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function fingerprintFinding(finding: Finding): string {
  const stableRule = finding.source === "fireworks" ? "AI" : finding.ruleId;
  const semanticIdentity =
    finding.source === "fireworks"
      ? `${normalizeIdentity(finding.title)}|${normalizeIdentity(finding.evidence)}`
      : normalizeIdentity(finding.evidence);
  const identity = [
    stableRule,
    normalizeIdentity(finding.location.file),
    semanticIdentity,
  ].join("|");

  return createHash("sha256").update(identity).digest("hex").slice(0, 24);
}

export function prepareFindings(findings: Finding[]): ReportFinding[] {
  return findings.map((finding) => ({
    ...finding,
    fingerprint: fingerprintFinding(finding),
    disposition: "new",
    waiver: null,
  }));
}

export function sortFindings(findings: ReportFinding[]): ReportFinding[] {
  return findings.sort((left, right) => {
    const fileOrder = left.location.file.localeCompare(right.location.file);
    return fileOrder || left.location.line - right.location.line || left.ruleId.localeCompare(right.ruleId);
  });
}
