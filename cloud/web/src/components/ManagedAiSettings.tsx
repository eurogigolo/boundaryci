import { useState } from "react";
import { errorMessage } from "../lib/errors";
import { requireSupabase } from "../lib/supabase";
import type { Organization, Repository } from "../types";

export function ManagedAiSettings({
  organization,
  repositories,
  canManage,
  onViewPlans,
  onRefresh,
}: {
  organization: Organization;
  repositories: Repository[];
  canManage: boolean;
  onViewPlans: () => void;
  onRefresh: () => void;
}) {
  const [consented, setConsented] = useState(false);
  const [savingOrganization, setSavingOrganization] = useState(false);
  const [savingRepositoryId, setSavingRepositoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const entitled = organization.plan !== "trial";
  const subscriptionActive = ["active", "trialing"].includes(
    organization.subscription_status,
  );
  const enabled = entitled && subscriptionActive && organization.managed_ai_enabled;

  async function setOrganizationReview(nextEnabled: boolean) {
    setSavingOrganization(true);
    setError(null);
    try {
      const { data, error: rpcError } = await requireSupabase().rpc("set_managed_ai_review", {
        target_organization_id: organization.id,
        enabled: nextEnabled,
      });
      if (rpcError) throw rpcError;
      if (data !== true) throw new Error("BoundaryCI did not update managed AI review.");
      setConsented(false);
      onRefresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSavingOrganization(false);
    }
  }

  async function setRepositoryReview(repository: Repository, nextEnabled: boolean) {
    setSavingRepositoryId(repository.id);
    setError(null);
    try {
      const { data, error: rpcError } = await requireSupabase().rpc(
        "set_repository_managed_ai_review",
        {
          target_repository_id: repository.id,
          enabled: nextEnabled,
        },
      );
      if (rpcError) throw rpcError;
      if (data !== true) throw new Error("BoundaryCI did not update the repository setting.");
      onRefresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSavingRepositoryId(null);
    }
  }

  return (
    <section className={`managed-ai-card${enabled ? " enabled" : ""}`}>
      <div className="managed-ai-heading">
        <div className="managed-ai-icon" aria-hidden="true">AI</div>
        <div>
          <span className="eyebrow">Semantic review</span>
          <h2>Managed Fireworks AI</h2>
          <p>
            Adds a second-pass review for tenant reassignment, incorrect membership joins,
            mutable authorization data, and policy interactions that static rules can miss.
          </p>
        </div>
        <span className={`managed-ai-status ${enabled ? "active" : "inactive"}`}>
          {enabled ? "Active" : entitled ? "Off" : "Paid plans"}
        </span>
      </div>

      <div className="managed-ai-disclosure">
        <b>How customer code is handled</b>
        <p>
          BoundaryCI redacts common secrets inside the GitHub runner, sends up to 80,000
          characters of migration text through BoundaryCI to Fireworks for this review, does not
          store that migration text, and stores the normalized findings, review status, and an
          input hash. Redaction cannot guarantee removal of every sensitive value.
        </p>
        <a href="/privacy/" target="_blank" rel="noreferrer">Read the privacy notice</a>
      </div>

      {!entitled ? (
        <div className="managed-ai-action-row">
          <p>Managed AI review is included with Team, Growth, and Enterprise.</p>
          {canManage && (
            <button className="button button-secondary button-small" type="button" onClick={onViewPlans}>
              View plans
            </button>
          )}
        </div>
      ) : !subscriptionActive ? (
        <div className="alert alert-warning">
          Managed AI review is paused until the Cloud subscription becomes active again.
        </div>
      ) : enabled ? (
        <>
          <div className="managed-ai-repositories">
            <div>
              <b>Automatic review by repository</b>
              <span>New repositories start enabled. Owners and administrators can opt out individually.</span>
            </div>
            {repositories.map((repository) => (
              <label key={repository.id}>
                <span><b>{repository.full_name}</b><small>{repository.managed_ai_enabled ? "AI review enabled" : "Deterministic only"}</small></span>
                <input
                  type="checkbox"
                  checked={repository.managed_ai_enabled}
                  disabled={!canManage || savingRepositoryId === repository.id}
                  onChange={(event) => void setRepositoryReview(repository, event.target.checked)}
                  aria-label={`Managed AI review for ${repository.full_name}`}
                />
              </label>
            ))}
          </div>
          {canManage && (
            <button
              className="text-button managed-ai-disable"
              type="button"
              disabled={savingOrganization}
              onClick={() => void setOrganizationReview(false)}
            >
              {savingOrganization ? "Saving…" : "Disable for organization"}
            </button>
          )}
        </>
      ) : canManage ? (
        <div className="managed-ai-consent">
          <label>
            <input
              type="checkbox"
              checked={consented}
              onChange={(event) => setConsented(event.target.checked)}
            />
            <span>
              I authorize BoundaryCI to process this organization’s redacted migration text with
              Fireworks under BoundaryCI’s managed account as described above.
            </span>
          </label>
          <button
            className="button button-primary button-small"
            type="button"
            disabled={!consented || savingOrganization}
            onClick={() => void setOrganizationReview(true)}
          >
            {savingOrganization ? "Enabling…" : "Enable managed AI review"}
          </button>
        </div>
      ) : (
        <p className="managed-ai-readonly">
          Ask an organization owner or administrator to review the disclosure and enable managed AI.
        </p>
      )}

      {organization.managed_ai_consented_at && (
        <small className="managed-ai-consent-date">
          Last authorized {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
            new Date(organization.managed_ai_consented_at),
          )}
        </small>
      )}
      {error && <div className="alert alert-error">{error}</div>}
    </section>
  );
}
