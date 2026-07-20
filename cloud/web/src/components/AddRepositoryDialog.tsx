import type { Organization, Repository } from "../types";
import { RepositoryConnectionForm } from "./Onboarding";

export function AddRepositoryDialog({
  organization,
  onClose,
  onRepositoryPersisted,
  onConnected,
}: {
  organization: Organization;
  onClose: () => void;
  onRepositoryPersisted: (repository: Repository) => void;
  onConnected: (repository: Repository, token: string) => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Add repository">
      <div className="modal-card">
        <section className="onboarding-card repository-add-card">
          <header>
            <div>
              <span className="eyebrow">Repository coverage</span>
              <h2>Add another repository</h2>
            </div>
            <button className="text-button" type="button" onClick={onClose}>Close</button>
          </header>
          <p className="muted">Use the exact GitHub owner/repository name. BoundaryCI creates a separate repository-bound token and scan history for every connection.</p>
          <RepositoryConnectionForm
            organization={organization}
            onRepositoryPersisted={onRepositoryPersisted}
            onConnected={onConnected}
          />
        </section>
      </div>
    </div>
  );
}
