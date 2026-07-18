import { BILLING_PLANS } from "../lib/billing";
import { Brand } from "./Brand";

const GITHUB_URL = "https://github.com/sir-gig/boundaryci";
const NPM_URL = "https://www.npmjs.com/package/boundaryci";
const MARKETPLACE_URL =
  "https://github.com/marketplace/actions/boundaryci-tenant-isolation-scan";

function publicHref(baseUrl: string, suffix: string): string {
  return `${baseUrl}${suffix}`;
}

export function PublicSite({ baseUrl }: { baseUrl: string }) {
  const signInUrl = publicHref(baseUrl, "?auth=signin");
  const signUpUrl = publicHref(baseUrl, "?auth=signup");

  return (
    <main className="launch-site">
      <nav className="launch-nav" aria-label="Main navigation">
        <a className="launch-brand-link" href={baseUrl} aria-label="BoundaryCI home">
          <Brand />
        </a>
        <div className="launch-nav-links">
          <a href="#product">Product</a>
          <a href="#security">Security</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
          <a href={GITHUB_URL}>Docs</a>
        </div>
        <div className="launch-nav-actions">
          <a className="launch-sign-in" href={signInUrl}>Sign in</a>
          <a className="button button-primary button-small" href={signUpUrl}>Start free</a>
        </div>
      </nav>

      <section className="launch-hero">
        <div className="launch-hero-glow" aria-hidden="true" />
        <div className="launch-hero-copy">
          <a className="launch-release-pill" href={`${GITHUB_URL}/releases`}>
            <span>New</span> BoundaryCI Cloud is live <b>→</b>
          </a>
          <span className="eyebrow">Tenant-isolation security for SaaS</span>
          <h1>Stop one customer from seeing <em>another customer&apos;s data.</em></h1>
          <p>
            BoundaryCI catches dangerous Supabase and PostgreSQL authorization changes before
            they reach production—then preserves the evidence your team needs to ship with
            confidence.
          </p>
          <div className="launch-hero-actions">
            <a className="button button-primary launch-primary-cta" href={signUpUrl}>
              Protect your first repository <span>→</span>
            </a>
            <a className="button button-secondary" href={GITHUB_URL}>
              View on GitHub
            </a>
          </div>
          <div className="launch-command" aria-label="BoundaryCI quick start command">
            <span>$</span><code>npx boundaryci scan .</code>
          </div>
          <p className="launch-hero-note">Free local scanner · No database credentials · Cloud optional</p>
        </div>

        <div className="launch-terminal-wrap" aria-label="Example BoundaryCI scan result">
          <div className="launch-terminal-orbit orbit-one" aria-hidden="true" />
          <div className="launch-terminal-orbit orbit-two" aria-hidden="true" />
          <div className="launch-terminal">
            <div className="terminal-bar">
              <div><i /><i /><i /></div>
              <span>boundaryci / pull request #142</span>
              <b>CI</b>
            </div>
            <div className="terminal-body">
              <div className="terminal-command"><span>❯</span> npx boundaryci scan .</div>
              <p className="terminal-muted">Scanning 12 SQL migrations...</p>
              <div className="terminal-divider" />
              <div className="terminal-finding-heading">
                <span className="terminal-severity">HIGH</span>
                <code>BND004</code>
              </div>
              <h2>Authenticated policy is not tenant-scoped</h2>
              <p>
                Every signed-in user can read rows without checking the active organization.
              </p>
              <div className="terminal-location">
                <span>↳</span><code>supabase/migrations/004_customers.sql:17</code>
              </div>
              <pre><code><span>using</span> (true)</code></pre>
              <div className="terminal-fix">
                <b>FIX</b>
                <span>Match organization_id to the user&apos;s active membership.</span>
              </div>
              <div className="terminal-divider" />
              <div className="terminal-summary">
                <span><b>1</b> high</span>
                <span><b>0</b> medium</span>
                <span><b>0</b> low</span>
                <strong>Merge blocked</strong>
              </div>
            </div>
          </div>
          <div className="launch-proof-card proof-card-top">
            <span>Policy review</span><b>Tenant boundary checked</b><i>✓</i>
          </div>
          <div className="launch-proof-card proof-card-bottom">
            <span>Cloud history</span><b>Evidence preserved</b><i>✓</i>
          </div>
        </div>
      </section>

      <section className="launch-trust" aria-label="BoundaryCI availability">
        <span>AVAILABLE THROUGH</span>
        <a href={NPM_URL}><b>npm</b> Public package</a>
        <a href={MARKETPLACE_URL}><b>GitHub</b> Marketplace</a>
        <a href={GITHUB_URL}><b>Open</b> source CLI</a>
        <span className="launch-trust-stat"><b>6</b> deterministic security rules</span>
      </section>

      <section className="launch-problem launch-section" id="product">
        <div className="launch-section-heading">
          <span className="eyebrow">The boundary problem</span>
          <h2>Your database can be online, encrypted, and still expose the wrong customer.</h2>
          <p>
            Multi-tenant SaaS depends on small authorization policies being correct everywhere.
            One permissive migration can quietly turn a shared database into a cross-customer breach.
          </p>
        </div>
        <div className="launch-risk-grid">
          <article>
            <span className="risk-number">01</span>
            <div className="risk-icon">RLS</div>
            <h3>Missing row-level security</h3>
            <p>A new table enters an exposed schema without enabling or enforcing tenant policies.</p>
          </article>
          <article>
            <span className="risk-number">02</span>
            <div className="risk-icon">ANY</div>
            <h3>Policies that trust everyone</h3>
            <p>An authenticated check proves a user signed in, but never proves which tenant they belong to.</p>
          </article>
          <article>
            <span className="risk-number">03</span>
            <div className="risk-icon">DEF</div>
            <h3>Privileged function bypasses</h3>
            <p>A security-definer function introduces a path around otherwise-correct access controls.</p>
          </article>
        </div>
      </section>

      <section className="launch-workflow launch-section">
        <div className="launch-section-heading launch-heading-centered">
          <span className="eyebrow">From migration to evidence</span>
          <h2>Security that lives in the pull request.</h2>
          <p>Start locally in seconds. Add Cloud when your team needs durable proof across repositories.</p>
        </div>
        <div className="launch-steps">
          <article>
            <div className="step-top"><span>01</span><code>LOCAL</code></div>
            <div className="step-visual step-scan" aria-hidden="true">
              <i /><i /><i /><b>⌕</b>
            </div>
            <h3>Scan the final policy state</h3>
            <p>BoundaryCI follows migrations in order and evaluates what security actually remains.</p>
          </article>
          <div className="step-connector" aria-hidden="true">→</div>
          <article>
            <div className="step-top"><span>02</span><code>CI</code></div>
            <div className="step-visual step-gate" aria-hidden="true">
              <span>PR #142</span><i>✓</i><i className="failed">!</i>
            </div>
            <h3>Block dangerous regressions</h3>
            <p>GitHub annotations point to the vulnerable policy before the pull request can merge.</p>
          </article>
          <div className="step-connector" aria-hidden="true">→</div>
          <article>
            <div className="step-top"><span>03</span><code>CLOUD</code></div>
            <div className="step-visual step-history" aria-hidden="true">
              <i /><i /><i /><span>Evidence</span>
            </div>
            <h3>Preserve team-wide history</h3>
            <p>Store minimized findings, usage, and remediation evidence behind tenant-safe access.</p>
          </article>
        </div>
      </section>

      <section className="launch-security launch-section" id="security">
        <div className="launch-security-copy">
          <span className="eyebrow">Local-first by design</span>
          <h2>Your database credentials never belong in a scanner.</h2>
          <p>
            Deterministic scans run inside your machine or GitHub runner. Cloud upload is explicit
            and sends a minimized, secret-redacted result—not your full migration files or database password.
          </p>
          <ul>
            <li><i>✓</i><span><b>No database connection required</b>Analyze migrations without production access.</span></li>
            <li><i>✓</i><span><b>Cloud is opt-in</b>Local scans make no BoundaryCI network request.</span></li>
            <li><i>✓</i><span><b>Repository-bound tokens</b>Upload credentials cannot cross repository boundaries.</span></li>
            <li><i>✓</i><span><b>Fireworks is optional</b>AI review is separate, explicit, and schema-constrained.</span></li>
          </ul>
          <a className="launch-text-link" href={`${GITHUB_URL}#product-architecture`}>Read the security model →</a>
        </div>
        <div className="boundary-diagram" aria-label="Local-first BoundaryCI data flow">
          <div className="boundary-zone customer-zone">
            <span>Your environment</span>
            <div className="diagram-node"><b>SQL migrations</b><small>Source remains local</small></div>
            <div className="diagram-arrow">↓</div>
            <div className="diagram-node scanner-node"><b>BoundaryCI scanner</b><small>Deterministic analysis</small></div>
          </div>
          <div className="diagram-boundary"><span>Explicit --upload only</span><i>→</i></div>
          <div className="boundary-zone cloud-zone">
            <span>BoundaryCI Cloud</span>
            <div className="diagram-node"><b>Minimized finding</b><small>Evidence + remediation</small></div>
            <div className="diagram-arrow">↓</div>
            <div className="diagram-node"><b>Tenant-safe history</b><small>Hashed ingestion token</small></div>
          </div>
        </div>
      </section>

      <section className="launch-pricing launch-section" id="pricing">
        <div className="launch-section-heading launch-heading-centered">
          <span className="eyebrow">Simple pricing</span>
          <h2>Start free. Pay when BoundaryCI becomes part of how your team ships.</h2>
          <p>Annual plans include two months free. Cancel or change plans through Stripe at any time.</p>
        </div>
        <div className="launch-pricing-grid">
          {BILLING_PLANS.map((plan) => (
            <article className={`launch-price-card ${plan.featured ? "featured" : ""}`} key={plan.key}>
              {plan.featured && <span className="launch-price-badge">Recommended</span>}
              <span className="eyebrow">{plan.name}</span>
              <p>{plan.description}</p>
              <div className="launch-price">
                <strong>${plan.monthlyPrice}</strong><span>/ month</span>
              </div>
              {plan.monthlyPrice > 0
                ? <small>${plan.monthlyPrice * 10}/year when billed annually</small>
                : <small>No card required</small>}
              <ul>
                {plan.features.map((feature) => <li key={feature}><i>✓</i>{feature}</li>)}
              </ul>
              <a
                className={`button ${plan.featured ? "button-primary" : "button-secondary"} button-full`}
                href={signUpUrl}
              >
                {plan.key === "trial" ? "Start scanning free" : `Choose ${plan.name}`}
              </a>
            </article>
          ))}
        </div>
        <div className="launch-enterprise">
          <div><span className="eyebrow">Enterprise</span><h3>Need private runners, custom controls, or procurement support?</h3></div>
          <a className="button button-secondary" href={`${GITHUB_URL}/issues/new?title=BoundaryCI%20Enterprise`}>Talk to us</a>
        </div>
      </section>

      <section className="launch-faq launch-section" id="faq">
        <div className="launch-section-heading">
          <span className="eyebrow">Questions, answered</span>
          <h2>What teams need to know before trusting a security check.</h2>
        </div>
        <div className="launch-faq-list">
          <details>
            <summary>Does BoundaryCI connect to my production database?<span>+</span></summary>
            <p>No. The current scanner analyzes migration files and does not require database credentials. Active testing against disposable environments is a future, separately configured capability.</p>
          </details>
          <details>
            <summary>What does BoundaryCI Cloud receive?<span>+</span></summary>
            <p>Only when you enable upload, Cloud receives repository and commit context, summary counts, finding metadata, and short redacted evidence and remediation snippets. It does not receive complete migration files.</p>
          </details>
          <details>
            <summary>Is Fireworks AI required?<span>+</span></summary>
            <p>No. Six deterministic checks work without an AI account and should remain the source of truth for merge decisions. Fireworks adds an optional semantic review for subtler policy interactions.</p>
          </details>
          <details>
            <summary>Does this replace a penetration test?<span>+</span></summary>
            <p>No. BoundaryCI is a focused continuous control for tenant-isolation regressions. It complements threat modeling, code review, testing, and independent security assessments.</p>
          </details>
          <details>
            <summary>Can I adopt it with existing findings?<span>+</span></summary>
            <p>Yes. Commit a reviewed baseline, then fail CI only when a new regression appears. Owned, expiring waivers keep temporary exceptions visible.</p>
          </details>
        </div>
      </section>

      <section className="launch-final-cta">
        <div className="final-cta-grid" aria-hidden="true" />
        <span className="eyebrow">Protect the boundary</span>
        <h2>Your next migration should not become your next breach.</h2>
        <p>Run the scanner locally, then connect your first repository to preserve the evidence.</p>
        <div>
          <a className="button button-primary launch-primary-cta" href={signUpUrl}>Start free <span>→</span></a>
          <a className="button button-secondary" href={MARKETPLACE_URL}>Add from Marketplace</a>
        </div>
      </section>

      <footer className="launch-footer">
        <div>
          <Brand />
          <p>Continuous tenant-isolation assurance for Supabase and PostgreSQL SaaS.</p>
        </div>
        <div className="launch-footer-links">
          <section><b>Product</b><a href="#product">How it works</a><a href="#pricing">Pricing</a><a href={MARKETPLACE_URL}>GitHub Action</a></section>
          <section><b>Resources</b><a href={GITHUB_URL}>Documentation</a><a href={NPM_URL}>npm package</a><a href={`${GITHUB_URL}/blob/main/SECURITY.md`}>Security</a></section>
          <section><b>Company</b><a href={`${GITHUB_URL}/blob/main/SUPPORT.md`}>Support</a><a href={`${GITHUB_URL}/blob/main/EULA.md`}>Terms</a><a href={`${GITHUB_URL}/blob/main/PRIVACY.md`}>Privacy</a></section>
        </div>
        <div className="launch-footer-bottom">
          <span>© 2026 BoundaryCI. Open-source scanner, paid Cloud assurance.</span>
          <span className="launch-status"><i /> Open-source scanner available</span>
        </div>
      </footer>
    </main>
  );
}
