import { Brand } from "./Brand";

export const GITHUB_URL = "https://github.com/sir-gig/boundaryci";
export const NPM_URL = "https://www.npmjs.com/package/boundaryci";
export const MARKETPLACE_URL =
  "https://github.com/marketplace/actions/boundaryci-tenant-isolation-scan";

export function publicHref(baseUrl: string, suffix: string): string {
  const root = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${root}${suffix.replace(/^\//, "")}`;
}

export function PublicNavigation({
  baseUrl,
  currentPath = "/",
}: {
  baseUrl: string;
  currentPath?: string;
}) {
  const links = [
    { href: "/supabase-rls-scanner/", label: "Product" },
    { href: "/guides/tenant-isolation-testing/", label: "Guides" },
    { href: "/rules/", label: "Rules" },
    { href: "/security/", label: "Security" },
    { href: "/docs/quickstart/", label: "Docs" },
  ];

  return (
    <nav className="launch-nav" aria-label="Main navigation">
      <a className="launch-brand-link" href={baseUrl} aria-label="BoundaryCI home">
        <Brand />
      </a>
      <div className="launch-nav-links">
        {links.map((link) => (
          <a
            aria-current={currentPath === link.href ? "page" : undefined}
            href={publicHref(baseUrl, link.href)}
            key={link.href}
          >
            {link.label}
          </a>
        ))}
      </div>
      <div className="launch-nav-actions">
        <a className="launch-sign-in" href={publicHref(baseUrl, "?auth=signin")}>Sign in</a>
        <a className="button button-primary button-small" href={publicHref(baseUrl, "?auth=signup")}>Start free</a>
      </div>
    </nav>
  );
}

export function PublicFooter({ baseUrl }: { baseUrl: string }) {
  return (
    <footer className="launch-footer">
      <div>
        <Brand />
        <p>Continuous tenant-isolation assurance for Supabase and PostgreSQL SaaS.</p>
      </div>
      <div className="launch-footer-links">
        <section>
          <b>Product</b>
          <a href={publicHref(baseUrl, "/supabase-rls-scanner/")}>Supabase scanner</a>
          <a href={publicHref(baseUrl, "/github-action/")}>GitHub Action</a>
          <a href={publicHref(baseUrl, "/rules/")}>Rule reference</a>
        </section>
        <section>
          <b>Resources</b>
          <a href={publicHref(baseUrl, "/docs/quickstart/")}>Quickstart</a>
          <a href={publicHref(baseUrl, "/guides/tenant-isolation-testing/")}>Tenant-isolation guide</a>
          <a href={GITHUB_URL}>GitHub</a>
        </section>
        <section>
          <b>Company</b>
          <a href={publicHref(baseUrl, "/security/")}>Security</a>
          <a href={publicHref(baseUrl, "/support/")}>Support</a>
          <a href={publicHref(baseUrl, "/terms/")}>Terms</a>
          <a href={publicHref(baseUrl, "/privacy/")}>Privacy</a>
        </section>
      </div>
      <div className="launch-footer-bottom">
        <span>© 2026 BoundaryCI. Open-source scanner, paid Cloud assurance.</span>
        <span className="launch-status"><i /> Open-source scanner available</span>
      </div>
    </footer>
  );
}
