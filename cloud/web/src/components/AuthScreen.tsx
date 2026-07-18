import { useState, type FormEvent } from "react";
import { errorMessage } from "../lib/errors";
import { requireSupabase } from "../lib/supabase";
import { Brand } from "./Brand";

type AuthMode = "signin" | "signup";

export function AuthScreen({
  initialMode = "signin",
  publicUrl,
}: {
  initialMode?: AuthMode;
  publicUrl: string;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const authRedirectUrl = new URL(import.meta.env.BASE_URL, window.location.origin).toString();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const client = requireSupabase();
      if (mode === "signup") {
        const { data, error: authError } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: authRedirectUrl },
        });
        if (authError) throw authError;
        if (!data.session) {
          setNotice("Check your email to confirm your account, then return here to sign in.");
        }
      } else {
        const { error: authError } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) throw authError;
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!email.trim()) {
      setError("Enter your email first, then request a reset link.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: resetError } = await requireSupabase().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: authRedirectUrl,
      });
      if (resetError) throw resetError;
      setNotice("Password reset instructions are on the way.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  function changeMode(next: AuthMode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <Brand />
        <div className="auth-copy">
          <span className="eyebrow">Continuous tenant assurance</span>
          <h1>Know when a code change weakens a customer boundary.</h1>
          <p>
            Track tenant-isolation findings across every repository, preserve the evidence, and
            give the right engineer a clear fix before production.
          </p>
          <div className="assurance-list" aria-label="BoundaryCI assurances">
            <span><b>01</b> Local-first scanning</span>
            <span><b>02</b> Repository-bound ingestion</span>
            <span><b>03</b> Tenant-isolated history</span>
          </div>
        </div>
        <p className="auth-footnote">Built for SaaS teams using Supabase and PostgreSQL.</p>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <a className="auth-back" href={publicUrl}>← Back to BoundaryCI</a>
          <div className="auth-mobile-brand"><Brand /></div>
          <span className="eyebrow">BoundaryCI Cloud</span>
          <h2>{mode === "signin" ? "Welcome back" : "Create your workspace"}</h2>
          <p className="muted">
            {mode === "signin"
              ? "Sign in to review your latest tenant-boundary runs."
              : "Start with one organization and your first GitHub repository."}
          </p>

          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              className={mode === "signin" ? "active" : ""}
              onClick={() => changeMode("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === "signup" ? "active" : ""}
              onClick={() => changeMode("signup")}
            >
              Create account
            </button>
          </div>

          <form onSubmit={(event) => void submit(event)}>
            <label>
              Work email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="you@company.com"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                minLength={8}
                placeholder="At least 8 characters"
                required
              />
            </label>
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            {notice && <div className="alert alert-success" role="status">{notice}</div>}
            <button className="button button-primary button-full" type="submit" disabled={busy}>
              {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          {mode === "signin" && (
            <button className="text-button" type="button" disabled={busy} onClick={() => void resetPassword()}>
              Forgot your password?
            </button>
          )}
          <p className="legal-copy">
            By continuing, you agree to the <a href="https://github.com/sir-gig/boundaryci/blob/main/EULA.md">BoundaryCI terms</a> and acknowledge the <a href="https://github.com/sir-gig/boundaryci/blob/main/PRIVACY.md">privacy notice</a>.
          </p>
        </div>
      </section>
    </main>
  );
}
