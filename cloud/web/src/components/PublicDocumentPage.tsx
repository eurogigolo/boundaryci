import type { PublicPage } from "../content/publicPages";
import { RULE_SUMMARIES } from "../content/publicPages";
import { GITHUB_URL, PublicFooter, PublicNavigation, publicHref } from "./PublicNavigation";

function destinationHref(baseUrl: string, href: string): string {
  return /^https?:\/\//.test(href) ? href : publicHref(baseUrl, href);
}

function categoryLabel(page: PublicPage): string {
  if (page.kind === "legal") return "Company";
  if (page.kind === "guide") return "Guides";
  if (page.kind === "rule" || page.kind === "rule-index") return "Rules";
  if (page.kind === "documentation") return "Documentation";
  if (page.kind === "security") return "Security";
  return "Product";
}

function categoryHref(page: PublicPage): string | undefined {
  if (page.kind === "guide") return "/guides/tenant-isolation-testing/";
  if (page.kind === "rule") return "/rules/";
  if (page.kind === "documentation") return "/docs/quickstart/";
  if (page.kind === "product") return "/supabase-rls-scanner/";
  return undefined;
}

function displayDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function RuleCards({ baseUrl }: { baseUrl: string }) {
  return (
    <div className="document-rule-grid" aria-label="BoundaryCI deterministic rules">
      {RULE_SUMMARIES.map((rule) => (
        <a href={publicHref(baseUrl, rule.path)} key={rule.id}>
          <div>
            <code>{rule.id}</code>
            <span className={`document-severity severity-${rule.severity}`}>{rule.severity}</span>
          </div>
          <h2>{rule.title}</h2>
          <p>{rule.summary}</p>
          <b>Read rule <span aria-hidden="true">→</span></b>
        </a>
      ))}
    </div>
  );
}

export function PublicDocumentPage({
  page,
  baseUrl,
}: {
  page: PublicPage;
  baseUrl: string;
}) {
  const category = categoryLabel(page);
  const categoryUrl = categoryHref(page);
  const currentBreadcrumbLabel = page.ruleId
    ?? (page.kind === "rule-index" || page.kind === "security" ? category : page.eyebrow);
  const ctaHref = page.ctaHref
    ? destinationHref(baseUrl, page.ctaHref)
    : page.kind === "security"
      ? GITHUB_URL
      : publicHref(baseUrl, "?auth=signup");

  return (
    <main className="launch-site document-site">
      <PublicNavigation baseUrl={baseUrl} currentPath={page.path} />

      <div className="document-breadcrumbs" aria-label="Breadcrumb">
        <a href={baseUrl}>Home</a>
        <span aria-hidden="true">/</span>
        {categoryUrl && categoryUrl !== page.path
          ? <><a href={publicHref(baseUrl, categoryUrl)}>{category}</a><span aria-hidden="true">/</span></>
          : null}
        <span>{currentBreadcrumbLabel}</span>
      </div>

      <article className="document-article">
        <header className="document-hero">
          <span className="eyebrow">{page.eyebrow}</span>
          <h1>{page.heading}</h1>
          <p>{page.introduction}</p>
          <div className="document-byline">
            <span>{page.kind === "legal" ? "BoundaryCI policy" : "By BoundaryCI"}</span>
            <span aria-hidden="true">·</span>
            {page.kind === "legal" ? (
              <>
                <time dateTime={page.publishedAt}>Effective {displayDate(page.publishedAt)}</time>
                <span aria-hidden="true">·</span>
                <time dateTime={page.modifiedAt}>Updated {displayDate(page.modifiedAt)}</time>
              </>
            ) : (
              <>
                <time dateTime={page.modifiedAt}>Updated {displayDate(page.modifiedAt)}</time>
                <span aria-hidden="true">·</span>
                <span>Reviewed against BoundaryCI v0.4</span>
              </>
            )}
          </div>
        </header>

        <div className="document-layout">
          <aside className="document-toc" aria-label="On this page">
            <b>On this page</b>
            {page.kind === "rule-index" && <a href="#rule-reference">Rule reference</a>}
            {page.sections.map((section) => <a href={`#${section.id}`} key={section.id}>{section.heading}</a>)}
            {page.faqs && <a href="#frequently-asked-questions">Frequently asked questions</a>}
          </aside>

          <div className="document-content">
            {page.kind === "rule-index" && (
              <section id="rule-reference">
                <h2>Rule reference</h2>
                <RuleCards baseUrl={baseUrl} />
              </section>
            )}

            {page.sections.map((section) => (
              <section id={section.id} key={section.id}>
                <h2>{section.heading}</h2>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.bullets && (
                  <ul>
                    {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                  </ul>
                )}
                {section.code && (
                  <div className="document-code">
                    <div><span>{section.code.label}</span><code>{section.code.language}</code></div>
                    <pre><code>{section.code.value}</code></pre>
                  </div>
                )}
                {section.note && <aside className="document-note"><b>Scope note</b>{section.note}</aside>}
              </section>
            ))}

            {page.faqs && (
              <section id="frequently-asked-questions" className="document-faq">
                <h2>Frequently asked questions</h2>
                <div className="document-faq-list">
                  {page.faqs.map((faq) => (
                    <details key={faq.question}>
                      <summary>{faq.question}<span aria-hidden="true">+</span></summary>
                      <p>{faq.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </article>

      <section className="document-related" aria-labelledby="related-heading">
        <span className="eyebrow">{page.kind === "legal" ? "Related policies" : "Continue learning"}</span>
        <h2 id="related-heading">
          {page.kind === "legal" ? "Related company information" : "Related BoundaryCI resources"}
        </h2>
        <div>
          {page.related.map((related) => (
            <a href={publicHref(baseUrl, related.href)} key={related.href}>
              <b>{related.label}</b>
              <p>{related.description}</p>
              <span>Read more →</span>
            </a>
          ))}
        </div>
      </section>

      {page.kind !== "legal" && (
        <section className="document-cta">
          <span className="eyebrow">Protect the boundary</span>
          <h2>{page.ctaHeading ?? "Make tenant isolation a repeatable pull-request check."}</h2>
          <p>{page.ctaDescription ?? "Run the deterministic scanner locally without database credentials, then add Cloud only when your team needs shared history."}</p>
          <div>
            <a className="button button-primary" href={ctaHref}>{page.ctaLabel} <span>→</span></a>
            <a className="button button-secondary" href={publicHref(baseUrl, page.ctaSecondaryHref ?? "/docs/quickstart/")}>{page.ctaSecondaryLabel ?? "Read the quickstart"}</a>
          </div>
        </section>
      )}

      <PublicFooter baseUrl={baseUrl} />
    </main>
  );
}
