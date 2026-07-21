import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ScanFinding } from "../types";
import { filterVisibleFindings, FindingVisibilityControl } from "./ScanDetail";

const findings: ScanFinding[] = [
  {
    id: 1,
    scan_run_id: "run-id",
    fingerprint: "111111111111111111111111",
    rule_id: "AI001",
    title: "First finding",
    description: "Description",
    severity: "medium",
    confidence: "medium",
    source: "fireworks",
    disposition: "new",
    file_path: "migrations/001.sql",
    line: 10,
    evidence: "Evidence",
    recommendation: "Recommendation",
    tags: [],
    waiver: null,
  },
  {
    id: 2,
    scan_run_id: "run-id",
    fingerprint: "222222222222222222222222",
    rule_id: "BND012",
    title: "Second finding",
    description: "Description",
    severity: "high",
    confidence: "high",
    source: "deterministic",
    disposition: "baseline",
    file_path: "migrations/002.sql",
    line: 20,
    evidence: "Evidence",
    recommendation: "Recommendation",
    tags: [],
    waiver: null,
  },
];

describe("scan finding visibility", () => {
  it("hides repository-dismissed fingerprints by default", () => {
    expect(filterVisibleFindings(findings, [findings[0].fingerprint], false)).toEqual([
      findings[1],
    ]);
  });

  it("returns hidden findings when the user asks to show them", () => {
    expect(filterVisibleFindings(findings, [findings[0].fingerprint], true)).toEqual(findings);
  });

  it("explains that the checkbox persists for matching future scans", () => {
    const markup = renderToStaticMarkup(
      <FindingVisibilityControl
        finding={findings[0]}
        hidden={false}
        saving={false}
        onChange={vi.fn()}
      />,
    );

    expect(markup).toContain("Hide this finding");
    expect(markup).toContain("matching future scans");
    expect(markup).toContain("Hide AI001: First finding");
  });
});
