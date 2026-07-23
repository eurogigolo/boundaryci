import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { AuthScreen } from "./components/AuthScreen";
import { Brand } from "./components/Brand";
import { Dashboard } from "./components/Dashboard";
import { PasswordRecovery } from "./components/PasswordRecovery";
import { PublicRoute } from "./components/PublicRoute";
import { getPublicPage } from "./content/publicPages";
import { checkoutIntentFromSearch } from "./lib/billing";
import { cloudConfigurationError, supabase } from "./lib/supabase";

function isPasswordRecoveryUrl(): boolean {
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  return fragment.get("type") === "recovery" || query.get("type") === "recovery";
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [recoveringPassword, setRecoveringPassword] = useState(isPasswordRecoveryUrl);
  const publicUrl = import.meta.env.BASE_URL;
  const publicPath = window.location.pathname;
  const requestedAuthMode = new URLSearchParams(window.location.search).get("auth");
  const checkoutIntent = checkoutIntentFromSearch(window.location.search);
  const authMode = requestedAuthMode === "signup" || requestedAuthMode === "signin"
    ? requestedAuthMode
    : null;

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") setRecoveringPassword(true);
      setSession(nextSession);
      setLoading(false);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (getPublicPage(publicPath)) {
    return <PublicRoute baseUrl={publicUrl} pathname={publicPath} />;
  }

  if (loading) {
    return <PublicRoute baseUrl={publicUrl} pathname={publicPath} />;
  }

  if (!session && !authMode) return <PublicRoute baseUrl={publicUrl} pathname={publicPath} />;

  if (cloudConfigurationError) {
    return (
      <main className="configuration-screen">
        <Brand />
        <div className="configuration-card">
          <span className="eyebrow">Configuration required</span>
          <h1>Connect the Cloud dashboard</h1>
          <p>{cloudConfigurationError}</p>
          <pre><code>cp .env.example .env.local</code></pre>
        </div>
      </main>
    );
  }

  if (session && recoveringPassword) {
    return <PasswordRecovery onComplete={() => setRecoveringPassword(false)} />;
  }
  if (session) return <Dashboard session={session} checkoutIntent={checkoutIntent} />;
  if (authMode) {
    return (
      <AuthScreen
        initialMode={authMode}
        publicUrl={publicUrl}
        checkoutIntent={checkoutIntent}
      />
    );
  }
  return <PublicRoute baseUrl={publicUrl} pathname={publicPath} />;
}
