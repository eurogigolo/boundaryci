import { useState, type FormEvent } from "react";
import { errorMessage } from "../lib/errors";
import { requireSupabase } from "../lib/supabase";
import { Brand } from "./Brand";

export function PasswordRecovery({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const { error: updateError } = await requireSupabase().auth.updateUser({ password });
      if (updateError) throw updateError;
      window.history.replaceState({}, "", import.meta.env.BASE_URL);
      onComplete();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <Brand />
        <div className="auth-copy">
          <span className="eyebrow">Account recovery</span>
          <h1>Secure the account that protects your customer boundaries.</h1>
          <p>
            Choose a new password for BoundaryCI Cloud. Your active recovery link is required
            before this change can be saved.
          </p>
          <div className="assurance-list" aria-label="Recovery safeguards">
            <span><b>01</b> Expiring recovery link</span>
            <span><b>02</b> Eight-character minimum</span>
            <span><b>03</b> Encrypted Supabase Auth session</span>
          </div>
        </div>
        <p className="auth-footnote">BoundaryCI never receives your password.</p>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-mobile-brand"><Brand /></div>
          <span className="eyebrow">BoundaryCI Cloud</span>
          <h2>Set a new password</h2>
          <p className="muted">Use at least eight characters and avoid reusing another password.</p>

          <form className="recovery-form" onSubmit={(event) => void submit(event)}>
            <label>
              New password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            <button className="button button-primary button-full" type="submit" disabled={busy}>
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
