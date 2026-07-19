import { useRef, useState, type FormEvent } from "react";
import { captchaTokenOptions, turnstileSiteKey } from "../lib/captcha";
import { errorMessage } from "../lib/errors";
import { requireSupabase } from "../lib/supabase";
import { Brand } from "./Brand";
import { TurnstileWidget, type TurnstileWidgetHandle } from "./TurnstileWidget";

type AuthMode = "signin" | "signup";

export function AuthScreen({
  initialMode = "signin",
  publicUrl,
  captchaSiteKey = turnstileSiteKey,
}: {
  initialMode?: AuthMode;
  publicUrl: string;
  captchaSiteKey?: string;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileWidgetHandle>(null);
  const captchaEnabled = Boolean(captchaSiteKey);
  const authRedirectUrl = new URL(import.meta.env.BASE_URL, window.location.origin).toString();

  function resetCaptcha() {
    if (!captchaEnabled) return;
    setCaptchaToken(null);
    captchaRef.current?.reset();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const client = requireSupabase();
      const captchaOptions = captchaTokenOptions(captchaSiteKey, captchaToken);
      if (mode === "signup") {
        const { data, error: authError } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: authRedirectUrl, ...captchaOptions },
        });
        if (authError) throw authError;
        if (!data.session) {
          setNotice("Check your email to confirm your account, then return here to sign in.");
        }
      } else {
        const { error: authError } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
          options: captchaOptions,
        });
        if (authError) throw authError;
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      resetCaptcha();
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
      const captchaOptions = captchaTokenOptions(captchaSiteKey, captchaToken);
      const { error: resetError } = await requireSupabase().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: authRedirectUrl,
        ...captchaOptions,
      });
      if (resetError) throw resetError;
      setNotice("Password reset instructions are on the way.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      resetCaptcha();
      setBusy(false);
    }
  }

  function changeMode(next: AuthMode) {
    setMode(next);
    setError(null);
    setNotice(null);
    setCaptchaError(null);
    resetCaptcha();
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
            {captchaEnabled && (
              <TurnstileWidget
                ref={captchaRef}
                siteKey={captchaSiteKey}
                onToken={setCaptchaToken}
                onError={setCaptchaError}
              />
            )}
            {captchaError && <div className="alert alert-error" role="alert">{captchaError}</div>}
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            {notice && <div className="alert alert-success" role="status">{notice}</div>}
            <button
              className="button button-primary button-full"
              type="submit"
              disabled={busy || (captchaEnabled && !captchaToken)}
            >
              {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          {mode === "signin" && (
            <button
              className="text-button"
              type="button"
              disabled={busy || (captchaEnabled && !captchaToken)}
              onClick={() => void resetPassword()}
            >
              Forgot your password?
            </button>
          )}
          <p className="legal-copy">
            By continuing, you agree to the <a href="/terms/">BoundaryCI terms</a> and acknowledge the <a href="/privacy/">privacy notice</a>.
          </p>
        </div>
      </section>
    </main>
  );
}
