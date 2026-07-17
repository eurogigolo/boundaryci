import pc from "picocolors";
import type { FailThreshold, ReportFinding, ScanReport, ScanSummary, Severity } from "./types.js";

const severityWeight: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

export function summarizeFindings(findings: ReportFinding[]): ScanSummary {
  return findings.reduce<ScanSummary>(
    (summary, finding) => {
      summary[finding.severity] += 1;
      summary[finding.source] += 1;
      if (finding.disposition === "new") summary.newFindings += 1;
      else summary[finding.disposition] += 1;
      return summary;
    },
    {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      deterministic: 0,
      fireworks: 0,
      newFindings: 0,
      baseline: 0,
      waived: 0,
    },
  );
}

function severityLabel(severity: Severity): string {
  const label = severity.toUpperCase().padEnd(8);
  if (severity === "critical") return pc.bgRed(pc.white(label));
  if (severity === "high") return pc.red(label);
  if (severity === "medium") return pc.yellow(label);
  if (severity === "low") return pc.cyan(label);
  return pc.dim(label);
}

export function renderPrettyReport(report: ScanReport): string {
  const lines: string[] = [];
  lines.push(pc.bold(`BoundaryCI ${report.tool.version}`));
  lines.push(`Scanned ${report.files.length} SQL file${report.files.length === 1 ? "" : "s"} in ${report.target}`);
  lines.push(
    `Database profile: ${pc.bold(report.databaseProfile.effective)} (${report.databaseProfile.reason})`,
  );
  if (report.semanticReview.status === "completed") {
    lines.push(
      pc.green(
        `Fireworks review completed - ${report.semanticReview.findings} additional finding${report.semanticReview.findings === 1 ? "" : "s"} - ${report.semanticReview.model}`,
      ),
    );
  } else if (report.semanticReview.status === "unavailable") {
    lines.push(pc.yellow("Fireworks review unavailable - deterministic scan continued"));
  }
  lines.push("");

  if (report.findings.length === 0) {
    lines.push(pc.green(pc.bold("No tenant-boundary findings detected.")));
  } else {
    for (const finding of report.findings) {
      const disposition =
        finding.disposition === "new"
          ? pc.red("NEW")
          : finding.disposition === "baseline"
            ? pc.dim("BASELINE")
            : pc.cyan(`WAIVED until ${finding.waiver?.expiresOn ?? "unknown"}`);
      lines.push(
        `${severityLabel(finding.severity)} ${pc.bold(`[${finding.ruleId}] ${finding.title}`)} ${disposition}`,
      );
      lines.push(`  ${pc.dim(`${finding.location.file}:${finding.location.line}`)} · ${finding.source}`);
      lines.push(`  ${finding.description}`);
      lines.push(`  ${pc.dim("Evidence:")} ${finding.evidence}`);
      lines.push(`  ${pc.dim("Fix:")} ${finding.recommendation}`);
      lines.push(`  ${pc.dim("Fingerprint:")} ${finding.fingerprint}`);
      if (finding.waiver) {
        lines.push(`  ${pc.dim("Waiver:")} ${finding.waiver.owner} - ${finding.waiver.reason}`);
      }
      lines.push("");
    }
  }

  const summary = report.summary;
  lines.push(
    `Summary: ${pc.red(`${summary.critical} critical`)}, ${pc.red(`${summary.high} high`)}, ${pc.yellow(`${summary.medium} medium`)}, ${pc.cyan(`${summary.low} low`)}, ${summary.info} info`,
  );
  lines.push(
    `Adoption: ${pc.red(`${summary.newFindings} new`)}, ${pc.dim(`${summary.baseline} baseline`)}, ${pc.cyan(`${summary.waived} waived`)}`,
  );
  if (report.warnings.length > 0) {
    lines.push("");
    for (const warning of report.warnings) lines.push(pc.yellow(`Warning: ${warning}`));
  }
  return `${lines.join("\n")}\n`;
}

export function shouldFail(
  report: ScanReport,
  threshold: FailThreshold,
  includeFireworks: boolean,
): boolean {
  if (threshold === "none") return false;
  const minimum = severityWeight[threshold];
  return report.findings.some(
    (finding) =>
      finding.disposition === "new" &&
      (includeFireworks || finding.source === "deterministic") &&
      severityWeight[finding.severity] >= minimum,
  );
}

function githubEscapeData(value: string): string {
  return value.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}

function githubEscapeProperty(value: string): string {
  return githubEscapeData(value).replaceAll(":", "%3A").replaceAll(",", "%2C");
}

export function renderGithubReport(report: ScanReport): string {
  const lines: string[] = [];
  for (const finding of report.findings.filter((item) => item.disposition === "new")) {
    const level =
      finding.severity === "critical" || finding.severity === "high"
        ? "error"
        : finding.severity === "medium"
          ? "warning"
          : "notice";
    const title = `BoundaryCI ${finding.ruleId}: ${finding.title}`;
    const message = `${finding.description} Fix: ${finding.recommendation} Fingerprint: ${finding.fingerprint}`;
    lines.push(
      `::${level} file=${githubEscapeProperty(finding.location.file)},line=${finding.location.line},title=${githubEscapeProperty(title)}::${githubEscapeData(message)}`,
    );
  }
  lines.push(
    `BoundaryCI: ${report.summary.newFindings} new, ${report.summary.baseline} baseline, ${report.summary.waived} waived finding${report.findings.length === 1 ? "" : "s"}.`,
  );
  for (const warning of report.warnings) {
    lines.push(`::warning title=BoundaryCI::${githubEscapeData(warning)}`);
  }
  return `${lines.join("\n")}\n`;
}

export function toSarif(report: ScanReport): object {
  const includedFindings = report.findings.filter((finding) => finding.disposition === "new");
  const rules = [...new Map(includedFindings.map((finding) => [finding.ruleId, finding])).values()].map(
    (finding) => ({
      id: finding.ruleId,
      name: finding.title.replace(/[^A-Za-z0-9]+/g, ""),
      shortDescription: { text: finding.title },
      fullDescription: { text: finding.description },
      help: { text: finding.recommendation },
      properties: { tags: finding.tags, source: finding.source },
    }),
  );

  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: report.tool.name,
            version: report.tool.version,
            informationUri: "https://github.com/eurogigolo/boundaryci",
            rules,
          },
        },
        results: includedFindings.map((finding) => ({
          ruleId: finding.ruleId,
          level:
            finding.severity === "critical" || finding.severity === "high"
              ? "error"
              : finding.severity === "medium"
                ? "warning"
                : "note",
          message: { text: `${finding.description} ${finding.recommendation}` },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: finding.location.file },
                region: { startLine: finding.location.line },
              },
            },
          ],
          properties: {
            severity: finding.severity,
            confidence: finding.confidence,
            source: finding.source,
            evidence: finding.evidence,
            fingerprint: finding.fingerprint,
            disposition: finding.disposition,
          },
        })),
        properties: {
          databaseProfile: report.databaseProfile,
          semanticReview: report.semanticReview,
        },
      },
    ],
  };
}
