import { useEffect, useState, type FormEvent } from "react";
import { errorMessage } from "../lib/errors";
import { isGitHubRepository, slugify } from "../lib/format";
import { requireSupabase } from "../lib/supabase";
import type { IngestionKeyResult, Organization, Repository } from "../types";
import { TokenReveal } from "./TokenReveal";

export function repositoryCreationErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error
    ? String(error.code)
    : null;
  return code === "23505"
    ? "This GitHub repository is already connected to the organization. Use its existing Setup guide or create a new token from the repository card."
    : errorMessage(error);
}

export function OrganizationOnboarding({ onCreated }: { onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [customSlug, setCustomSlug] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function changeName(value: string) {
    setName(value);
    if (!customSlug) setSlug(slugify(value));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcError } = await requireSupabase().rpc("create_organization", {
        organization_name: name.trim(),
        organization_slug: slug,
      });
      if (rpcError) throw rpcError;
      if (typeof data !== "string") throw new Error("The organization was created without an ID.");
      onCreated(data);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="onboarding-wrap">
      <div className="progress-rail" aria-label="Onboarding progress">
        <span className="active">1</span><i /><span>2</span><i /><span>3</span>
      </div>
      <div className="onboarding-card">
        <span className="eyebrow">Step 1 of 3</span>
        <h1>Create your organization</h1>
        <p className="muted">This is the security boundary for repositories, members, runs, and billing.</p>
        <form className="wide-form" onSubmit={(event) => void submit(event)}>
          <label>
            Organization name
            <input
              value={name}
              onChange={(event) => changeName(event.target.value)}
              placeholder="Acme Software"
              minLength={2}
              maxLength={120}
              autoFocus
              required
            />
          </label>
          <label>
            Workspace URL
            <div className="input-prefix">
              <span>boundaryci.com/</span>
              <input
                value={slug}
                onChange={(event) => {
                  setCustomSlug(true);
                  setSlug(slugify(event.target.value));
                }}
                placeholder="acme-software"
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                required
              />
            </div>
          </label>
          {error && <div className="alert alert-error">{error}</div>}
          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? "Creating…" : "Continue to repository"}
          </button>
        </form>
      </div>
    </section>
  );
}

export function RepositoryConnectionForm({
  organization,
  onConnected,
  onRepositoryPersisted,
}: {
  organization: Organization;
  onConnected: (repository: Repository, token: string) => void;
  onRepositoryPersisted?: (repository: Repository) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [createdRepository, setCreatedRepository] = useState<Repository | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createToken(repository: Repository): Promise<string> {
    const { data, error: keyError } = await requireSupabase().rpc("create_ingestion_key", {
      target_repository_id: repository.id,
      key_name: "GitHub Actions",
    });
    if (keyError) throw keyError;
    const result = Array.isArray(data) ? (data[0] as IngestionKeyResult | undefined) : undefined;
    if (!result?.token) throw new Error("BoundaryCI did not return the one-time ingestion token.");
    return result.token;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!isGitHubRepository(fullName)) {
        throw new Error("Enter the GitHub repository in owner/name format.");
      }
      let repository = createdRepository;
      if (!repository) {
        const { data, error: insertError } = await requireSupabase()
          .from("repositories")
          .insert({
            organization_id: organization.id,
            full_name: fullName.trim(),
            default_branch: defaultBranch.trim() || null,
          })
          .select("id, organization_id, full_name, default_branch, active, managed_ai_enabled, created_at")
          .single();
        if (insertError) throw insertError;
        repository = data as Repository;
        setCreatedRepository(repository);
        onRepositoryPersisted?.(repository);
      }
      onConnected(repository, await createToken(repository));
    } catch (caught) {
      setError(repositoryCreationErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setError(null);
  }, [fullName]);

  return (
    <form className="wide-form" onSubmit={(event) => void submit(event)}>
      <label>
        GitHub repository
        <input
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="owner/repository"
          disabled={Boolean(createdRepository)}
          autoFocus
          required
        />
      </label>
      <label>
        Default branch
        <input
          value={defaultBranch}
          onChange={(event) => setDefaultBranch(event.target.value)}
          placeholder="main"
          disabled={Boolean(createdRepository)}
          maxLength={255}
        />
      </label>
      {error && <div className="alert alert-error">{error}</div>}
      <button className="button button-primary" type="submit" disabled={busy}>
        {busy ? "Connecting…" : createdRepository ? "Retry token creation" : "Connect repository"}
      </button>
    </form>
  );
}

export function RepositoryOnboarding({
  organization,
  onComplete,
}: {
  organization: Organization;
  onComplete: () => void;
}) {
  const [connection, setConnection] = useState<{ repository: Repository; token: string } | null>(null);

  if (connection) {
    return (
      <TokenReveal
        repository={connection.repository}
        token={connection.token}
        onDone={onComplete}
      />
    );
  }

  return (
    <section className="onboarding-wrap">
      <div className="progress-rail" aria-label="Onboarding progress">
        <span className="done">✓</span><i className="done" /><span className="active">2</span><i /><span>3</span>
      </div>
      <div className="onboarding-card">
        <span className="eyebrow">Step 2 of 3</span>
        <h1>Connect your first repository</h1>
        <p className="muted">
          The ingestion token will be locked to this exact GitHub repository and stored only as a hash.
        </p>
        <RepositoryConnectionForm
          organization={organization}
          onConnected={(repository, token) => setConnection({ repository, token })}
        />
      </div>
    </section>
  );
}
