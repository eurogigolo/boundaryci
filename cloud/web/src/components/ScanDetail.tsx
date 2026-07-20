import { useEffect, useState } from "react";
import { errorMessage } from "../lib/errors";
import { formatDate, shortCommit } from "../lib/format";
import { requireSupabase } from "../lib/supabase";
import type { Repository, ScanFinding, ScanRun } from "../types";

export function ScanDetail({
  run,
  repository,
  onBack,
}: {
  run: ScanRun;
  repository: Repository;
  onBack: () => void;
}) {
  const [findings, setFindings] = useState<ScanFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: queryError } = await requireSupabase()
        .from("scan_findings")
        .select(
          "id, scan_run_id, fingerprint, rule_id, title, description, severity, confidence, source, disposition, file_path, line, evidence, recommendation, tags, waiver",
        )
        .eq("scan_run_id", run.id)
        .order("id", { ascending: true });
      if (!active) return;
      if (queryError) setError(queryError.message);
      else setFindings((data ?? []) as ScanFinding[]);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [run.id]);

  return (
    <div className="content-page">
      <button className="back-button" type="button" onClick={onBack}>← All runs</button>
      <div className="scan-heading">
        <div>
          <div className="heading-kicker">
            <span className={`status-dot ${run.outcome}`} />
            {repository.full_name}
          </div>
          <h1>Scan {shortCommit(run.commit_sha)}</h1>
          <p className="muted">
            {run.branch ?? "Local run"} · {formatDate(run.scanned_at)} · BoundaryCI {run.tool_version}
          </p>
          {run.semantic_review.status === "completed" && (
            <p className="managed-review-summary">
              Managed Fireworks review completed · {run.semantic_review.findings} AI finding{run.semantic_review.findings === 1 ? "" : "s"} · {run.semantic_review.model}
            </p>
          )}
        </div>
        <span className={`outcome-pill ${run.outcome}`}>{run.outcome}</span>
      </div>

      <div className="summary-strip">
        <SummaryCount label="Critical" value={run.summary.critical} severity="critical" />
        <SummaryCount label="High" value={run.summary.high} severity="high" />
        <SummaryCount label="Medium" value={run.summary.medium} severity="medium" />
        <SummaryCount label="AI review" value={run.summary.fireworks ?? 0} />
        <SummaryCount label="Baseline" value={run.summary.baseline} />
        <SummaryCount label="Waived" value={run.summary.waived} />
      </div>

      <div className="section-heading">
        <div>
          <span className="eyebrow">Evidence</span>
          <h2>{findings.length} finding{findings.length === 1 ? "" : "s"}</h2>
        </div>
      </div>

      {loading && <div className="loading-card">Loading findings…</div>}
      {error && <div className="alert alert-error">{errorMessage(error)}</div>}
      {!loading && !error && findings.length === 0 && (
        <div className="empty-state compact">
          <div className="success-orb">✓</div>
          <h3>No tenant-boundary findings</h3>
          <p>This run did not identify a migration policy regression.</p>
        </div>
      )}
      <div className="finding-list">
        {findings.map((finding) => (
          <article className="finding-card" key={finding.id}>
            <div className="finding-topline">
              <div className="finding-labels">
                <span className={`severity-pill ${finding.severity}`}>{finding.severity}</span>
                <span className="rule-pill">{finding.rule_id}</span>
                <span className={`disposition-pill ${finding.disposition}`}>{finding.disposition}</span>
                <span className={`source-pill ${finding.source}`}>
                  {finding.source === "fireworks" ? "Managed AI" : "Deterministic"}
                </span>
              </div>
              <code className="fingerprint">{finding.fingerprint}</code>
            </div>
            <h3>{finding.title}</h3>
            <p>{finding.description}</p>
            <div className="file-location">
              <span>↳</span><code>{finding.file_path}:{finding.line}</code>
            </div>
            <div className="finding-grid">
              <div>
                <span className="detail-label">Evidence</span>
                <pre><code>{finding.evidence}</code></pre>
              </div>
              <div>
                <span className="detail-label">Recommended fix</span>
                <p>{finding.recommendation}</p>
              </div>
            </div>
            {finding.waiver && (
              <div className="waiver-note">
                Waived by <strong>{finding.waiver.owner}</strong> until {finding.waiver.expiresOn}: {finding.waiver.reason}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function SummaryCount({
  label,
  value,
  severity,
}: {
  label: string;
  value: number;
  severity?: string;
}) {
  return (
    <div className="summary-count">
      <span className={severity ? `count-value ${severity}` : "count-value"}>{value}</span>
      <span>{label}</span>
    </div>
  );
}
