import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { errorMessage } from "../lib/errors";
import { planName } from "../lib/billing";
import { formatRelative, highestSeverity, shortCommit } from "../lib/format";
import { canManageOrganization } from "../lib/permissions";
import { requireSupabase } from "../lib/supabase";
import type { IngestionKeyResult, Organization, Repository, ScanRun } from "../types";
import { AddRepositoryDialog } from "./AddRepositoryDialog";
import { Brand } from "./Brand";
import { Billing } from "./Billing";
import { OrganizationOnboarding, RepositoryOnboarding } from "./Onboarding";
import { RepositorySetupGuide } from "./RepositorySetupGuide";
import { ScanDetail } from "./ScanDetail";
import { TokenReveal } from "./TokenReveal";

interface SelectedScan {
  run: ScanRun;
  repository: Repository;
}

interface RevealedToken {
  repository: Repository;
  token: string;
}

interface RefreshOptions {
  background?: boolean;
}

type DashboardView = "overview" | "history" | "billing";

export function Dashboard({ session }: { session: Session }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [runs, setRuns] = useState<ScanRun[]>([]);
  const [monthlyUsage, setMonthlyUsage] = useState(0);
  const [openFindings, setOpenFindings] = useState(0);
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedScan, setSelectedScan] = useState<SelectedScan | null>(null);
  const [revealedToken, setRevealedToken] = useState<RevealedToken | null>(null);
  const [repositoryFilter, setRepositoryFilter] = useState<string>("all");
  const [setupRepositoryId, setSetupRepositoryId] = useState<string | null>(null);
  const [addingRepository, setAddingRepository] = useState(false);
  const [creatingTokenFor, setCreatingTokenFor] = useState<string | null>(null);
  const [organizationRole, setOrganizationRole] = useState<string | null>(null);
  const billingResult = new URLSearchParams(window.location.search).get("billing");
  const [dashboardView, setDashboardView] = useState<DashboardView>(
    billingResult ? "billing" : "overview",
  );

  const loadOrganizations = useCallback(async (
    preferredId?: string,
    options: RefreshOptions = {},
  ) => {
    if (!options.background) {
      setLoadingOrganizations(true);
      setError(null);
    }
    const { data, error: queryError } = await requireSupabase()
      .from("organizations")
      .select(
        "id, name, slug, plan, subscription_status, monthly_scan_limit, billing_interval, current_period_start, current_period_end, cancel_at_period_end",
      )
      .order("created_at", { ascending: true });
    if (queryError) {
      setError(queryError.message);
      if (!options.background) setLoadingOrganizations(false);
      return;
    }
    const next = (data ?? []) as Organization[];
    setOrganizations(next);
    setSelectedOrganizationId((current) => {
      const candidate = preferredId ?? current;
      return candidate && next.some((organization) => organization.id === candidate)
        ? candidate
        : next[0]?.id ?? null;
    });
    if (!options.background) setLoadingOrganizations(false);
  }, []);

  const loadWorkspace = useCallback(async (
    organizationId: string,
    options: RefreshOptions = {},
  ) => {
    if (!options.background) {
      setLoadingWorkspace(true);
      setError(null);
    }
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const [repositoryResult, runResult, usageResult, findingResult, membershipResult] = await Promise.all([
      requireSupabase()
        .from("repositories")
        .select("id, organization_id, full_name, default_branch, active, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true }),
      requireSupabase()
        .from("scan_runs")
        .select(
          "id, organization_id, repository_id, external_id, commit_sha, branch, pull_request, outcome, tool_version, summary, scanned_at, received_at",
        )
        .eq("organization_id", organizationId)
        .order("received_at", { ascending: false })
        .limit(100),
      requireSupabase()
        .from("scan_runs")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("received_at", monthStart.toISOString()),
      requireSupabase()
        .from("scan_findings")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("disposition", "new"),
      requireSupabase()
        .from("organization_members")
        .select("role")
        .eq("organization_id", organizationId)
        .eq("user_id", session.user.id)
        .single(),
    ]);

    const firstError = [
      repositoryResult.error,
      runResult.error,
      usageResult.error,
      findingResult.error,
      membershipResult.error,
    ].find(Boolean);
    if (firstError) setError(firstError.message);
    else {
      setRepositories((repositoryResult.data ?? []) as Repository[]);
      setRuns((runResult.data ?? []) as ScanRun[]);
      setMonthlyUsage(usageResult.count ?? 0);
      setOpenFindings(findingResult.count ?? 0);
      setOrganizationRole(membershipResult.data?.role ?? null);
    }
    if (!options.background) setLoadingWorkspace(false);
  }, [session.user.id]);

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    if (selectedOrganizationId) void loadWorkspace(selectedOrganizationId);
    else {
      setRepositories([]);
      setRuns([]);
    }
    setSelectedScan(null);
    setRepositoryFilter("all");
    setSetupRepositoryId(null);
    setAddingRepository(false);
  }, [loadWorkspace, selectedOrganizationId]);

  useEffect(() => {
    if (dashboardView !== "history") return;
    window.setTimeout(() => {
      document.querySelector(".runs-section")?.scrollIntoView({ behavior: "smooth" });
    }, 0);
  }, [dashboardView]);

  useEffect(() => {
    if (billingResult !== "success" || !selectedOrganizationId) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      void loadOrganizations(selectedOrganizationId, { background: true });
      void loadWorkspace(selectedOrganizationId, { background: true });
      if (attempts >= 5) window.clearInterval(timer);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [billingResult, loadOrganizations, loadWorkspace, selectedOrganizationId]);

  const selectedOrganization = organizations.find(
    (organization) => organization.id === selectedOrganizationId,
  );
  const repositoriesById = useMemo(
    () => new Map(repositories.map((repository) => [repository.id, repository])),
    [repositories],
  );
  const visibleRuns =
    repositoryFilter === "all" ? runs : runs.filter((run) => run.repository_id === repositoryFilter);
  const setupRepository = repositories.find((repository) => repository.id === setupRepositoryId);
  const passedRuns = runs.filter((run) => run.outcome === "passed").length;
  const passRate = runs.length === 0 ? null : Math.round((passedRuns / runs.length) * 100);
  const canManage = canManageOrganization(organizationRole);

  async function signOut() {
    await requireSupabase().auth.signOut();
  }

  async function createReplacementToken(repository: Repository) {
    setCreatingTokenFor(repository.id);
    setError(null);
    try {
      const { data, error: rpcError } = await requireSupabase().rpc("create_ingestion_key", {
        target_repository_id: repository.id,
        key_name: `Dashboard ${new Date().toISOString().slice(0, 10)}`,
      });
      if (rpcError) throw rpcError;
      const key = Array.isArray(data) ? (data[0] as IngestionKeyResult | undefined) : undefined;
      if (!key?.token) throw new Error("BoundaryCI did not return a token.");
      setRevealedToken({ repository, token: key.token });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setCreatingTokenFor(null);
    }
  }

  if (loadingOrganizations) {
    return <div className="full-loading"><Brand /><span>Loading your workspace…</span></div>;
  }

  if (organizations.length === 0) {
    return (
      <div className="onboarding-shell">
        <header><Brand /><button className="text-button" onClick={() => void signOut()}>Sign out</button></header>
        <OrganizationOnboarding onCreated={(id) => void loadOrganizations(id)} />
      </div>
    );
  }

  if (!selectedOrganization) return null;

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-switcher">
          <span>Workspace</span>
          <select
            value={selectedOrganization.id}
            onChange={(event) => setSelectedOrganizationId(event.target.value)}
          >
            {organizations.map((organization) => (
              <option value={organization.id} key={organization.id}>{organization.name}</option>
            ))}
          </select>
        </div>
        <nav>
          <button
            className={dashboardView === "overview" ? "active" : ""}
            type="button"
            onClick={() => {
              setSelectedScan(null);
              setDashboardView("overview");
            }}
          >
            <span>⌁</span> Overview
          </button>
          <button
            className={dashboardView === "history" ? "active" : ""}
            type="button"
            onClick={() => {
              setSelectedScan(null);
              setDashboardView("history");
            }}
          >
            <span>▤</span> Scan history
          </button>
          <button type="button" disabled title="Team management is the next Cloud product slice">
            <span>♙</span> Team <em>Soon</em>
          </button>
          <button
            className={dashboardView === "billing" ? "active" : ""}
            type="button"
            onClick={() => {
              setSelectedScan(null);
              setDashboardView("billing");
            }}
          >
            <span>◇</span> Billing
          </button>
        </nav>
        <div className="sidebar-plan">
          <div><span>{planName(selectedOrganization.plan)}</span><b>{monthlyUsage} / {selectedOrganization.monthly_scan_limit || "∞"}</b></div>
          <div className="usage-track"><i style={{ width: `${selectedOrganization.monthly_scan_limit ? Math.min(100, (monthlyUsage / selectedOrganization.monthly_scan_limit) * 100) : 0}%` }} /></div>
          <small>scans used this month</small>
        </div>
        <div className="sidebar-user">
          <span>{session.user.email?.slice(0, 1).toUpperCase() ?? "U"}</span>
          <div><b>{session.user.email}</b><button type="button" onClick={() => void signOut()}>Sign out</button></div>
        </div>
      </aside>

      <main className="dashboard-main">
        {dashboardView === "billing" ? (
          <Billing
            organization={selectedOrganization}
            monthlyUsage={monthlyUsage}
            canManage={canManage}
            result={billingResult}
            onRefresh={() => {
              void loadOrganizations(selectedOrganization.id, { background: true });
              void loadWorkspace(selectedOrganization.id, { background: true });
            }}
          />
        ) : selectedScan ? (
          <ScanDetail
            run={selectedScan.run}
            repository={selectedScan.repository}
            onBack={() => setSelectedScan(null)}
          />
        ) : (
          <div className="content-page">
            <header className="page-heading">
              <div>
                <span className="eyebrow">Tenant assurance</span>
                <h1>{selectedOrganization.name}</h1>
                <p>Continuous evidence that customer data boundaries survive every migration.</p>
              </div>
              <div className="heading-actions">
                <span className={`subscription-pill ${selectedOrganization.subscription_status}`}>
                  {selectedOrganization.subscription_status}
                </span>
                <button className="button button-secondary" type="button" onClick={() => void loadWorkspace(selectedOrganization.id)}>
                  Refresh
                </button>
              </div>
            </header>

            {error && <div className="alert alert-error">{error}</div>}

            {repositories.length === 0 && !loadingWorkspace ? (
              <RepositoryOnboarding
                organization={selectedOrganization}
                onComplete={() => void loadWorkspace(selectedOrganization.id)}
              />
            ) : (
              <>
                <section className="metric-grid">
                  <Metric label="Repositories" value={repositories.length} note="actively monitored" icon="⌘" />
                  <Metric label="Pass rate" value={passRate === null ? "—" : `${passRate}%`} note={`last ${runs.length} runs`} icon="✓" tone="positive" />
                  <Metric label="Open findings" value={openFindings} note="new, not waived" icon="!" tone={openFindings > 0 ? "danger" : "positive"} />
                  <Metric label="Monthly usage" value={monthlyUsage} note={`${selectedOrganization.monthly_scan_limit || "Unlimited"} scan allowance`} icon="↗" />
                </section>

                <section className="repository-section">
                  <div className="section-heading">
                    <div><span className="eyebrow">Coverage</span><h2>Repositories</h2></div>
                    {canManage && (
                      <button
                        className="button button-secondary button-small"
                        type="button"
                        onClick={() => setAddingRepository(true)}
                      >
                        Add repository
                      </button>
                    )}
                  </div>
                  <div className="repository-grid">
                    {repositories.map((repository) => {
                      const latest = runs.find((run) => run.repository_id === repository.id);
                      return (
                        <article className="repository-card" key={repository.id}>
                          <div className="repo-icon">GH</div>
                          <div className="repo-card-copy">
                            <h3>{repository.full_name}</h3>
                            <p>{latest ? `Last scan ${formatRelative(latest.received_at)}` : "Waiting for first scan"}</p>
                          </div>
                          <span className={`repo-status ${latest?.outcome ?? "waiting"}`}>
                            {latest?.outcome ?? "waiting"}
                          </span>
                          <div className="repo-card-actions">
                            <button
                              className="text-button"
                              type="button"
                              aria-expanded={setupRepositoryId === repository.id}
                              onClick={() => setSetupRepositoryId((current) => current === repository.id ? null : repository.id)}
                            >
                              {setupRepositoryId === repository.id ? "Hide setup" : "Setup guide"}
                            </button>
                            {canManage && (
                              <button
                                className="text-button"
                                type="button"
                                disabled={creatingTokenFor === repository.id}
                                onClick={() => void createReplacementToken(repository)}
                              >
                                {creatingTokenFor === repository.id ? "Creating…" : "New token"}
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  {setupRepository && (
                    <RepositorySetupGuide
                      repository={setupRepository}
                      canManageToken={canManage}
                      onClose={() => setSetupRepositoryId(null)}
                    />
                  )}
                </section>

                <section className="runs-section">
                  <div className="section-heading runs-heading">
                    <div><span className="eyebrow">Evidence stream</span><h2>Recent scans</h2></div>
                    <select value={repositoryFilter} onChange={(event) => setRepositoryFilter(event.target.value)}>
                      <option value="all">All repositories</option>
                      {repositories.map((repository) => <option key={repository.id} value={repository.id}>{repository.full_name}</option>)}
                    </select>
                  </div>
                  {loadingWorkspace ? (
                    <div className="loading-card">Loading scan history…</div>
                  ) : visibleRuns.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-radar"><i /><i /><span>⌁</span></div>
                      <h3>Waiting for the first scan</h3>
                      <p>Install the generated workflow, open a pull request, and the run will appear here.</p>
                    </div>
                  ) : (
                    <div className="runs-table-wrap">
                      <table className="runs-table">
                        <thead><tr><th>Status</th><th>Repository</th><th>Commit</th><th>Branch / PR</th><th>Findings</th><th>Received</th><th /></tr></thead>
                        <tbody>
                          {visibleRuns.map((run) => {
                            const repository = repositoriesById.get(run.repository_id);
                            const severity = highestSeverity(run.summary);
                            if (!repository) return null;
                            return (
                              <tr key={run.id}>
                                <td><span className={`outcome-pill ${run.outcome}`}>{run.outcome}</span></td>
                                <td><b>{repository.full_name}</b></td>
                                <td><code>{shortCommit(run.commit_sha)}</code></td>
                                <td>{run.pull_request ? `PR #${run.pull_request}` : run.branch ?? "local"}</td>
                                <td>
                                  {run.summary.newFindings > 0 ? (
                                    <span className={`finding-count ${severity ?? "info"}`}>{run.summary.newFindings} {severity}</span>
                                  ) : <span className="clean-count">0 new</span>}
                                </td>
                                <td title={run.received_at}>{formatRelative(run.received_at)}</td>
                                <td><button className="row-action" type="button" onClick={() => setSelectedScan({ run, repository })}>View →</button></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        )}
      </main>

      {revealedToken && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="New ingestion token">
          <div className="modal-card">
            <TokenReveal
              repository={revealedToken.repository}
              token={revealedToken.token}
              onDone={() => setRevealedToken(null)}
            />
          </div>
        </div>
      )}

      {addingRepository && canManage && (
        <AddRepositoryDialog
          organization={selectedOrganization}
          onClose={() => setAddingRepository(false)}
          onRepositoryPersisted={() => void loadWorkspace(selectedOrganization.id, { background: true })}
          onConnected={(repository, token) => {
            setAddingRepository(false);
            setRevealedToken({ repository, token });
            void loadWorkspace(selectedOrganization.id, { background: true });
          }}
        />
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  note,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  note: string;
  icon: string;
  tone?: "neutral" | "positive" | "danger";
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}
