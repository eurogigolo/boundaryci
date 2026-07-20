import { GITHUB_ACTION_SECRET_NAME, GITHUB_WORKFLOW_PATH, buildActionYaml } from "../lib/format";
import { ingestionUrl } from "../lib/supabase";
import type { Repository } from "../types";
import { CopyButton } from "./CopyButton";

export function RepositorySetupGuide({
  repository,
  endpoint = ingestionUrl,
  embedded = false,
  canManageToken = true,
  onClose,
}: {
  repository: Pick<Repository, "full_name">;
  endpoint?: string;
  embedded?: boolean;
  canManageToken?: boolean;
  onClose?: () => void;
}) {
  const workflow = buildActionYaml(endpoint);

  return (
    <section
      className={`repository-setup-guide${embedded ? " embedded" : ""}`}
      aria-label={`GitHub setup for ${repository.full_name}`}
    >
      <header className="setup-guide-header">
        <div>
          <span className="eyebrow">GitHub setup</span>
          <h2>Connect {repository.full_name} in three steps</h2>
          <p>The private token and workflow file have different jobs. The token stays in GitHub Secrets; the YAML only refers to it by name.</p>
        </div>
        {onClose && <button className="text-button" type="button" onClick={onClose}>Close</button>}
      </header>

      <ol className="setup-guide-steps">
        <li>
          <span className="setup-step-number">01</span>
          <div>
            <span className="detail-label">Protect the token</span>
            <h3>Add one GitHub Actions secret</h3>
            <p>In the GitHub repository, open <b>Settings → Secrets and variables → Actions</b>. Create a repository secret with this exact name and paste the one-time BoundaryCI token as its value.</p>
            <div className="setup-copy-row">
              <code>{GITHUB_ACTION_SECRET_NAME}</code>
              <CopyButton value={GITHUB_ACTION_SECRET_NAME} label="Copy name" />
            </div>
            <small>Never paste the token into a committed file, issue, pull request, or support message.</small>
          </div>
        </li>

        <li>
          <span className="setup-step-number">02</span>
          <div>
            <span className="detail-label">Install the scanner</span>
            <h3>Add the workflow to the repository</h3>
            <p>Create the file below on the default branch. The secret expression is a safe reference—GitHub replaces it only while the Action runs.</p>
            <div className="setup-copy-row">
              <code>{GITHUB_WORKFLOW_PATH}</code>
              <CopyButton value={GITHUB_WORKFLOW_PATH} label="Copy path" />
            </div>
            <div className="setup-yaml">
              <div><span>Workflow YAML</span><CopyButton value={workflow} label="Copy YAML" /></div>
              <pre><code>{workflow}</code></pre>
            </div>
          </div>
        </li>

        <li>
          <span className="setup-step-number">03</span>
          <div>
            <span className="detail-label">Verify the connection</span>
            <h3>Open a pull request containing SQL</h3>
            <p>BoundaryCI scans ordered migrations inside GitHub, annotates unsafe lines, and then uploads a minimized result. A high-severity regression fails the check; a corrected commit reruns automatically and preserves both results here.</p>
            <small>GitHub does not provide repository secrets to pull requests from untrusted forks. Test with a branch inside the repository first.</small>
          </div>
        </li>
      </ol>

      <div className="setup-managed-ai-note">
        <b>Managed AI review</b>
        <span>
          The workflow requests BoundaryCI&apos;s managed Fireworks review automatically after an
          organization owner or administrator accepts the dashboard disclosure. Your workflow
          never receives the Fireworks API key. Set <code>managed-fireworks: &quot;false&quot;</code> in
          the workflow or disable this repository in the dashboard to use deterministic checks only.
        </span>
      </div>

      <div className="setup-token-note">
        <b>Lost the token?</b>
        <span>{canManageToken
          ? "Create a new repository token from the Repositories card, replace the GitHub secret value, and leave this workflow unchanged."
          : "Ask an organization owner or administrator to create a new repository token and replace the GitHub secret value. The workflow stays unchanged."}</span>
      </div>
    </section>
  );
}
