import { useEffect, useMemo, useState } from "react";
import { errorMessage } from "../lib/errors";
import { formatDate, shortCommit } from "../lib/format";
import { requireSupabase } from "../lib/supabase";
import type { Repository, ScanFinding, ScanRun } from "../types";

export function ScanDetail({
  run,
  repository,
  canManage,
  onBack,
  onVisibilityChange,
}: {
  run: ScanRun;
  repository: Repository;
  canManage: boolean;
  onBack: () => void;
  onVisibilityChange: () => void;
}) {
  const [findings, setFindings] = useState<ScanFinding[]>([]);
  const [hiddenFingerprints, setHiddenFingerprints] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [savingFingerprint, setSavingFingerprint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hiddenFingerprintSet = useMemo(
    () => new Set(hiddenFingerprints),
    [hiddenFingerprints],
  );
  const hiddenCount = findings.filter(
    (finding) => hiddenFingerprintSet.has(finding.fingerprint),
  ).length;
  const visibleFindings = filterVisibleFindings(findings, hiddenFingerprints, showHidden);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      const [findingResult, dismissalResult] = await Promise.all([
        requireSupabase()
          .from("scan_findings")
          .select(
            "id, scan_run_id, fingerprint, rule_id, title, description, severity, confidence, source, disposition, file_path, line, evidence, recommendation, tags, waiver",
          )
          .eq("scan_run_id", run.id)
          .order("id", { ascending: true }),
        requireSupabase()
          .from("finding_dismissals")
          .select("fingerprint")
          .eq("repository_id", repository.id),
      ]);
      if (!active) return;
      const queryError = findingResult.error ?? dismissalResult.error;
      if (queryError) setError(queryError.message);
      else {
        setFindings((findingResult.data ?? []) as ScanFinding[]);
        setHiddenFingerprints(
          (dismissalResult.data ?? []).map((dismissal) => dismissal.fingerprint as string),
        );
      }
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [repository.id, run.id]);

  async function setFindingHidden(finding: ScanFinding, hidden: boolean) {
    setSavingFingerprint(finding.fingerprint);
    setError(null);
    try {
      const query = hidden
        ? requireSupabase()
            .from("finding_dismissals")
            .upsert(
              {
                organization_id: run.organization_id,
                repository_id: repository.id,
                fingerprint: finding.fingerprint,
              },
              { onConflict: "repository_id,fingerprint", ignoreDuplicates: true },
            )
        : requireSupabase()
            .from("finding_dismissals")
            .delete()
            .eq("organization_id", run.organization_id)
            .eq("repository_id", repository.id)
            .eq("fingerprint", finding.fingerprint);
      const { error: visibilityError } = await query;
      if (visibilityError) throw visibilityError;
      setHiddenFingerprints((current) => hidden
        ? [...new Set([...current, finding.fingerprint])]
        : current.filter((fingerprint) => fingerprint !== finding.fingerprint));
      onVisibilityChange();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSavingFingerprint(null);
    }
  }

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

      <div className="section-heading finding-section-heading">
        <div>
          <span className="eyebrow">Evidence</span>
          <h2>{visibleFindings.length} visible finding{visibleFindings.length === 1 ? "" : "s"}</h2>
          {hiddenCount > 0 && <p>{hiddenCount} hidden for this repository</p>}
        </div>
        {hiddenCount > 0 && (
          <label className="show-hidden-control">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(event) => setShowHidden(event.target.checked)}
            />
            <span>Show hidden findings</span>
          </label>
        )}
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
      {!loading && !error && findings.length > 0 && visibleFindings.length === 0 && (
        <div className="empty-state compact">
          <div className="success-orb">✓</div>
          <h3>All findings are hidden</h3>
          <p>Use “Show hidden findings” to review or restore them.</p>
        </div>
      )}
      <div className="finding-list">
        {visibleFindings.map((finding) => {
          const hidden = hiddenFingerprintSet.has(finding.fingerprint);
          return (
            <article className={`finding-card${hidden ? " hidden-finding" : ""}`} key={finding.id}>
            <div className="finding-topline">
              <div className="finding-labels">
                <span className={`severity-pill ${finding.severity}`}>{finding.severity}</span>
                <span className="rule-pill">{finding.rule_id}</span>
                <span className={`disposition-pill ${finding.disposition}`}>{finding.disposition}</span>
                {hidden && <span className="visibility-pill">hidden</span>}
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
            {canManage && (
              <FindingVisibilityControl
                finding={finding}
                hidden={hidden}
                saving={savingFingerprint === finding.fingerprint}
                onChange={(nextHidden) => void setFindingHidden(finding, nextHidden)}
              />
            )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function filterVisibleFindings(
  findings: ScanFinding[],
  hiddenFingerprints: string[],
  showHidden: boolean,
): ScanFinding[] {
  if (showHidden || hiddenFingerprints.length === 0) return findings;
  const hidden = new Set(hiddenFingerprints);
  return findings.filter((finding) => !hidden.has(finding.fingerprint));
}

export function FindingVisibilityControl({
  finding,
  hidden,
  saving,
  onChange,
}: {
  finding: ScanFinding;
  hidden: boolean;
  saving: boolean;
  onChange: (hidden: boolean) => void;
}) {
  return (
    <label className="finding-visibility-control">
      <input
        type="checkbox"
        checked={hidden}
        disabled={saving}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={`Hide ${finding.rule_id}: ${finding.title}`}
      />
      <span>
        <b>{saving ? "Saving…" : "Hide this finding"}</b>
        <small>Applies to this fingerprint in this repository and matching future scans.</small>
      </span>
    </label>
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
